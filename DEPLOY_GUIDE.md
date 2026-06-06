# Cinema Nest — Selar Webhook Setup Guide

## What you're deploying

A Firebase Cloud Function that:
1. Receives a POST from Selar when a customer pays
2. Reads their email + subscription tier from the payload
3. Writes `subscriptionEnd` to their Firestore user document
4. Customers land on `activate.html` which reads that record and shows success

---

## Folder structure

```
your-project/
├── firebase.json          ← Firebase config
├── .firebaserc            ← Links to your project ID
└── functions/
    ├── index.js           ← The webhook Cloud Function
    └── package.json       ← Dependencies
```

---

## Step 1 — Install Firebase CLI

```bash
npm install -g firebase-tools
```

---

## Step 2 — Log in to Firebase

```bash
firebase login
```

This opens a browser. Sign in with the Google account that owns the `cinema-nest-2bf23` project.

---

## Step 3 — Install function dependencies

```bash
cd functions
npm install
cd ..
```

---

## Step 4 — Deploy the function

From the root folder (where `firebase.json` is):

```bash
firebase deploy --only functions
```

When it finishes, you'll see a URL like:

```
https://us-central1-cinema-nest-2bf23.cloudfunctions.net/selarWebhook
```

**Copy that URL — you'll paste it into Selar next.**

---

## Step 5 — Add the webhook URL in Selar

1. Go to **Selar dashboard → Settings → Webhooks** (or Integrations → Webhook)
2. Paste in your function URL:
   ```
   https://us-central1-cinema-nest-2bf23.cloudfunctions.net/selarWebhook
   ```
3. Select the event: **New Sale** (or "Order Completed")
4. Save

---

## Step 6 — Set the redirect URL in Selar

1. Go to your CinemaNest product in Selar
2. Find **Redirect URL** (after successful payment)
3. Set it to:
   ```
   https://your-cinemanest-domain.com/activate.html
   ```
   (same URL for all tiers — no ?plan= needed)

---

## Step 7 — Update Firestore security rules

Add this to your Firestore rules so the Cloud Function (admin SDK) can write,
but clients cannot write to `pending_activations`:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users can read/write their own profile
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // pending_activations: only Cloud Functions (admin) can write
    // Users can read their own pending record by email
    match /pending_activations/{email} {
      allow read: if request.auth != null && request.auth.token.email == email;
      allow write: if false; // only admin SDK (Cloud Function) writes here
    }
  }
}
```

---

## Step 8 — Test it

### Test the webhook manually with curl:

```bash
curl -X POST \
  https://us-central1-cinema-nest-2bf23.cloudfunctions.net/selarWebhook \
  -H "Content-Type: application/json" \
  -d '{
    "buyer_email": "test@example.com",
    "subscription_interval": "every month",
    "order_id": "test-001"
  }'
```

You should get `OK` back, and see `subscriptionEnd` written in Firestore.

### Check logs:

```bash
firebase functions:log
```

---

## Troubleshooting

**"Unknown tier" in logs**
→ Selar is sending a tier name not in the `TIER_DAYS` map.
→ Check the raw payload in Firebase logs, copy the exact string, add it to `TIER_DAYS` in `index.js`, redeploy.

**User not found — pending activation stored**
→ Customer paid before creating an account.
→ When they sign up and visit `activate.html`, it claims the pending record automatically.

**Customer sees "Almost There" screen for more than 2 minutes**
→ The webhook hasn't fired. Check Selar's webhook delivery log for errors.
→ Most common cause: wrong webhook URL pasted in Selar.
