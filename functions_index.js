const { onRequest } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

initializeApp();
const db = getFirestore();

// ── Map Selar tier names → subscription days ──
// These must exactly match what Selar sends in the webhook payload.
// Check your Selar dashboard → product → tier names if unsure.
const TIER_DAYS = {
  "every month":    30,
  "every quarter":  90,
  "every 6 months": 180,
  "every year":     365,
  // fallbacks in case Selar sends slightly different casing
  "monthly":        30,
  "quarterly":      90,
  "biannual":       180,
  "yearly":         365,
  "annual":         365,
};

const TIER_LABELS = {
  "every month":    "1 Month",
  "every quarter":  "3 Months",
  "every 6 months": "6 Months",
  "every year":     "1 Year",
  "monthly":        "1 Month",
  "quarterly":      "3 Months",
  "biannual":       "6 Months",
  "yearly":         "1 Year",
  "annual":         "1 Year",
};

// ── Selar webhook handler ──
exports.selarWebhook = onRequest(
  { cors: false, region: "us-central1" },
  async (req, res) => {
    // Only accept POST
    if (req.method !== "POST") {
      return res.status(405).send("Method Not Allowed");
    }

    try {
      const body = req.body;

      // Log the full payload during development so you can inspect it
      console.log("Selar webhook received:", JSON.stringify(body, null, 2));

      // ── Extract buyer email ──
      // Selar sends buyer_email or customer_email — handle both
      const email =
        (body.buyer_email || body.customer_email || "").trim().toLowerCase();

      if (!email) {
        console.error("No email in payload:", body);
        return res.status(400).send("Missing buyer email");
      }

      // ── Extract tier/plan name ──
      // Selar sends subscription_interval or plan_name for tiered subscriptions
      const rawTier = (
        body.subscription_interval ||
        body.plan_name ||
        body.tier_name ||
        body.product_name ||
        ""
      )
        .trim()
        .toLowerCase();

      const days  = TIER_DAYS[rawTier];
      const label = TIER_LABELS[rawTier];

      if (!days) {
        // Unknown tier — log it so you can add it to TIER_DAYS above
        console.error(`Unknown tier received: "${rawTier}". Full body:`, body);
        // Still return 200 so Selar doesn't keep retrying
        return res.status(200).send(`Unknown tier: ${rawTier}`);
      }

      // ── Find the user in Firestore by email ──
      const usersRef = db.collection("users");
      const snapshot = await usersRef
        .where("email", "==", email)
        .limit(1)
        .get();

      if (snapshot.empty) {
        // No account found — store a pending activation record
        // so when they sign up, activate.html can pick it up
        console.warn(`No user found for email: ${email}. Storing pending activation.`);
        await db.collection("pending_activations").doc(email).set({
          email,
          tier:           rawTier,
          label,
          days,
          selarPayload:   body,
          receivedAt:     new Date().toISOString(),
          status:         "pending",
        });
        return res.status(200).send("Pending activation stored");
      }

      // ── Calculate subscription end date ──
      const userDoc  = snapshot.docs[0];
      const userId   = userDoc.id;
      const userData = userDoc.data();

      const now = new Date();

      // If they already have an active subscription, extend from its end date
      // (so they don't lose time if they renew early)
      let startFrom = now;
      if (userData.subscriptionEnd) {
        const existing = new Date(userData.subscriptionEnd);
        if (existing > now) {
          startFrom = existing; // extend from current expiry
        }
      }

      const subscriptionEnd = new Date(
        startFrom.getTime() + days * 24 * 60 * 60 * 1000
      );

      // ── Write to Firestore ──
      await db.collection("users").doc(userId).update({
        plan:              rawTier,
        planLabel:         label,
        subscriptionStart: now.toISOString(),
        subscriptionEnd:   subscriptionEnd.toISOString(),
        trialEnd:          null, // clear trial once paid
        lastPaymentAt:     now.toISOString(),
        selarOrderId:      body.order_id || body.id || null,
      });

      console.log(
        `✅ Activated ${label} for ${email} until ${subscriptionEnd.toISOString()}`
      );

      return res.status(200).send("OK");
    } catch (err) {
      console.error("Webhook error:", err);
      // Return 200 anyway — Selar retries on non-200, which could cause double-activation
      return res.status(200).send("Internal error logged");
    }
  }
);
