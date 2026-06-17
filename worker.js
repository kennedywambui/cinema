/**
 * Cinema Nest — Selar Webhook Listener (Cloudflare Worker)
 * ----------------------------------------------------------
 * Receives a "sale completed" notification from Selar, finds the matching
 * Cinema Nest user by email in Firestore, and activates their subscription.
 *
 * Required Worker secrets (set these in the Cloudflare dashboard, never in code):
 *   WEBHOOK_SECRET          - random string you make up; must match the
 *                             ?token= query param on the URL you give Selar/Zapier
 *   FIREBASE_CLIENT_EMAIL   - from your Firebase service account JSON ("client_email")
 *   FIREBASE_PRIVATE_KEY    - from your Firebase service account JSON ("private_key")
 *
 * See SETUP_GUIDE.md for how to get these and deploy this Worker.
 */

const FIREBASE_PROJECT_ID = "cinema-nest-2bf23";

// KES amount -> plan length in days. Must match the prices on pricing.html.
const PLAN_BY_AMOUNT = {
  399: 30,    // 1 month
  699: 90,    // 3 months
  999: 180,   // 6 months
  1299: 365,  // 1 year
};

export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const url = new URL(request.url);
    if (url.searchParams.get("token") !== env.WEBHOOK_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response("Bad JSON body", { status: 400 });
    }

    // Selar doesn't publish one fixed payload schema, so we check the
    // common places a buyer email, amount, and order id could show up.
    const email = String(
      body.email || body.buyer_email || body.customer_email ||
      body.data?.email || body.data?.buyer_email ||
      body.customer?.email || body.user?.email || ""
    ).trim().toLowerCase();

    const amountRaw =
      body.amount ?? body.price ?? body.total ?? body.amount_paid ??
      body.sale_price ?? body.total_amount ?? body.data?.amount ?? null;
    const amount = amountRaw != null ? Math.round(parseFloat(amountRaw)) : null;

    const orderId = String(
      body.id || body.order_id || body.transaction_id || body.sale_id || body.data?.id || ""
    );

    console.log("Incoming Selar webhook:", JSON.stringify(body));

    if (!email) {
      return new Response("No email found in payload", { status: 400 });
    }

    const days = amount != null ? PLAN_BY_AMOUNT[amount] : null;
    if (!days) {
      console.log(`Unrecognized amount (${amount}) — not activating. Check PLAN_BY_AMOUNT.`);
      // 200 so Selar/Zapier don't treat this as a failure and keep retrying.
      return new Response("Unrecognized plan amount, logged for review", { status: 200 });
    }

    const accessToken = await getAccessToken(env);

    // Idempotency: don't double-credit the same sale on webhook retries.
    if (orderId) {
      const already = await firestoreGet(accessToken, `processedSales/${orderId}`);
      if (already) {
        return new Response("Already processed", { status: 200 });
      }
    }

    const userDoc = await findUserByEmail(accessToken, email);
    if (!userDoc) {
      console.log("No Cinema Nest account found for email:", email);
      return new Response("No matching user account", { status: 200 });
    }

    const now = new Date();
    const existingEnd = userDoc.fields?.subscriptionEnd?.stringValue
      ? new Date(userDoc.fields.subscriptionEnd.stringValue)
      : null;
    // If they still have active time left, extend it. Otherwise start from now.
    const base = existingEnd && existingEnd > now ? existingEnd : now;
    const newEnd = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);

    await firestorePatch(accessToken, userDoc.name, {
      plan: { stringValue: "active" },
      subscriptionEnd: { stringValue: newEnd.toISOString() },
      lastPaymentAt: { stringValue: now.toISOString() },
    });

    if (orderId) {
      await firestoreSet(accessToken, `processedSales/${orderId}`, {
        email: { stringValue: email },
        processedAt: { stringValue: now.toISOString() },
      });
    }

    return new Response("OK — activated", { status: 200 });
  },
};

/* ---------------- Firestore REST + Google auth helpers ---------------- */

async function getAccessToken(env) {
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: env.FIREBASE_CLIENT_EMAIL,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const b64url = (obj) =>
    btoa(JSON.stringify(obj)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  const unsigned = `${b64url(header)}.${b64url(claim)}`;

  const keyData = pemToArrayBuffer(env.FIREBASE_PRIVATE_KEY);
  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuf = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned)
  );
  const sig = btoa(String.fromCharCode(...new Uint8Array(sigBuf)))
    .replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  const jwt = `${unsigned}.${sig}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("Google auth failed: " + JSON.stringify(data));
  return data.access_token;
}

function pemToArrayBuffer(pem) {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\\n/g, "")
    .replace(/\n/g, "")
    .trim();
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function findUserByEmail(accessToken, email) {
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: "users" }],
          where: {
            fieldFilter: {
              field: { fieldPath: "email" },
              op: "EQUAL",
              value: { stringValue: email },
            },
          },
          limit: 1,
        },
      }),
    }
  );
  const data = await res.json();
  const match = Array.isArray(data) ? data.find((r) => r.document) : null;
  return match ? match.document : null;
}

async function firestoreGet(accessToken, path) {
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${path}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (res.status === 404) return null;
  return res.ok ? await res.json() : null;
}

async function firestoreSet(accessToken, path, fields) {
  await fetch(
    `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${path}`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ fields }),
    }
  );
}

async function firestorePatch(accessToken, docName, fields) {
  // docName looks like: projects/PROJECT/databases/(default)/documents/users/abc123
  const mask = Object.keys(fields)
    .map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
    .join("&");
  const url = `https://firestore.googleapis.com/v1/${docName}?${mask}`;
  await fetch(url, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });
}
