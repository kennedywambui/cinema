# Activating Subscriptions After Selar Payment — Setup Guide

This connects Selar (who has the money) to Firestore (who controls access) using a free Cloudflare Worker as the go-between. No Firebase Blaze plan, no credit card.

## Part 1 — Get a Firebase service account key

1. Go to the [Firebase console](https://console.firebase.google.com) → your `cinema-nest-2bf23` project.
2. Project settings (gear icon) → **Service accounts** tab.
3. Click **Generate new private key**. A JSON file downloads — keep it private, never commit it to GitHub.
4. Open it. You need two values from it: `client_email` and `private_key`.

## Part 2 — Deploy the Cloudflare Worker

1. Sign up free at [dash.cloudflare.com](https://dash.cloudflare.com) (no card needed).
2. Go to **Workers & Pages** → **Create** → **Create Worker**. Give it a name like `cinemanest-selar-webhook`, click **Deploy** (it'll deploy a placeholder first).
3. Click **Edit code**, delete everything in the editor, and paste in the contents of `worker.js` (provided alongside this guide).
4. Click **Deploy**.
5. Go to the Worker's **Settings → Variables and Secrets**. Add three secrets (use "Encrypt" for all of them):
   - `WEBHOOK_SECRET` — make up a long random string (e.g. generate one at a password generator site). You'll reuse this in Part 3.
   - `FIREBASE_CLIENT_EMAIL` — paste the `client_email` value from your service account JSON.
   - `FIREBASE_PRIVATE_KEY` — paste the full `private_key` value from the JSON, including the `-----BEGIN PRIVATE KEY-----` / `-----END PRIVATE KEY-----` lines.
6. Your Worker now lives at a URL like `https://cinemanest-selar-webhook.<your-subdomain>.workers.dev`. The full webhook URL you'll give Selar is:

   ```
   https://cinemanest-selar-webhook.<your-subdomain>.workers.dev/?token=YOUR_WEBHOOK_SECRET
   ```

## Part 3 — Tell Selar to call that URL on every sale

Selar doesn't publish one fixed way to do this, so try in this order:

**Option A — Native webhook (try first):** In your Selar dashboard, check **Settings → Integrations**. If you see a "Webhook" option, paste the URL from step 6 above there.

**Option B — Zapier bridge (confirmed to work, free):**
1. Sign up free at [zapier.com](https://zapier.com).
2. Create a Zap: Trigger = **Selar → New Sale**. Connect your Selar account.
3. Action = **Webhooks by Zapier → POST**.
4. URL = the webhook URL from step 6. Payload type = JSON. Map the sale's email and amount fields into the body (Zapier will show you Selar's actual field names here — note them down, since you may need to add those exact field names to `worker.js`'s list of checked fields if they differ).
5. Turn the Zap on. (A single-trigger, single-action Zap like this works fine on Zapier's free plan.)

## Part 4 — Test it for real

1. Make a real (or Selar test-mode, if available) purchase using an email that matches an existing Cinema Nest account.
2. In the Cloudflare dashboard, open your Worker → **Logs** (Real-time Logs) to watch the request come in.
3. Check the `console.log("Incoming Selar webhook...")` line — this shows you the *exact* payload Selar/Zapier sent. Confirm the email and amount are being found correctly. If not, tell me what the logged payload looks like and I'll adjust the field names in `worker.js`.
4. In Firestore (Firebase console → Firestore Database → `users` collection → that user's document), confirm `plan` is now `"active"` and `subscriptionEnd` is a future date.
5. Reload `watch.html` signed in as that user — the paywall should no longer appear.

## What this does NOT yet handle

- **Recurring/renewal reminders** — nothing currently emails a user before their `subscriptionEnd` passes. That's a separate, smaller feature if you want it later.
- **Refunds/chargebacks** — if Selar sends a refund event, this Worker ignores it (it only listens for sales). A refunded user would keep access until `subscriptionEnd`. Low risk at small scale, but worth knowing.
- **Selar's exact payload format** — I wrote `worker.js` to check several likely field names for email/amount/order id, but I can't guarantee Selar's real payload matches without testing. Step 3 above is how you'll confirm and correct it.
