# Cinema Nest — Activating Paid Subscriptions (Selar → Firestore)

This covers the two pieces that aren't plain HTML edits: the Firestore
security rules, and the Zapier automation that listens for Selar sales and
writes the result into Firestore.

## 1. Why two collections

The automation needs a shared secret so random visitors can't grant
themselves free access by guessing your Firestore project ID and writing
to it directly (your `projectId` and `apiKey` are already public — they're
sitting in your page source, same as before). To stop that secret from
ever being readable by anyone (including the legitimate customer reading
their own subscription status in their browser), the data is split:

- `paymentRecords/{email}` — the raw, secret-gated write target. Holds the
  secret. **Never readable by anyone**, including the user it belongs to.
- `paidStatus/{email}` — what your site actually reads (`watch.html`,
  `index.html`). Holds only `subscriptionEnd` and `plan` — no secret. A
  write here is only valid if a matching, secret-verified `paymentRecords`
  document already exists with the same `subscriptionEnd`.

This way the secret never appears in any response your site's JavaScript
ever sees, even in the browser network tab.

## 2. Firestore rules to add

Open Firebase Console → Firestore Database → Rules, and add these two
`match` blocks inside your existing `service cloud.firestore { match
/databases/{database}/documents { ... } }` block (alongside whatever rules
you already have for `users` and `watchHistory` — don't replace those,
just add these two):

```
match /paymentRecords/{email} {
  allow read: if false;
  allow write: if request.resource.data.secret == "REPLACE_WITH_A_LONG_RANDOM_SECRET";
}

match /paidStatus/{email} {
  allow read: if request.auth != null
               && request.auth.token.email.lower() == email;
  allow write: if get(/databases/$(database)/documents/paymentRecords/$(email)).data.secret
                  == "REPLACE_WITH_A_LONG_RANDOM_SECRET"
               && request.resource.data.subscriptionEnd
                  == get(/databases/$(database)/documents/paymentRecords/$(email)).data.subscriptionEnd;
}
```

Generate a long random secret (32+ characters — e.g. run
`openssl rand -hex 24` in any terminal, or use a password generator) and
paste the same value in both places above. Keep it only in this rules
file and in the Zapier steps below — never in any HTML/JS file.

Note: Firestore document IDs (the `{email}` part) can't contain a `/`,
which emails never do, so using the lowercased email directly as the
document ID is safe.

## 3. The Zap (Selar → Firestore)

In Zapier, create a new Zap:

**Trigger:** Selar → *New Sale*. Connect your Selar account when prompted.

**Step 2 — Formatter (Utilities → Lookup Table):** map whichever field
Selar's trigger gives you for the product (its name or ID — check the
sample data Zapier pulls in) to a number of days:

| Selar product            | Output (days) |
|---------------------------|---------------|
| 1 Month plan               | 30            |
| 3 Months plan               | 90            |
| 6 Months plan               | 180           |
| 1 Year plan                 | 365           |

**Step 3 — Formatter (Date/Time → Add/Subtract Time):** take the current
time, add the number of days from Step 2. Output this as ISO 8601 — call
it `subscription_end`.

**Step 4 — Webhooks by Zapier → Custom Request** (writes the secret-gated
record):
- Method: `PATCH`
- URL: `https://firestore.googleapis.com/v1/projects/cinema-nest-2bf23/databases/(default)/documents/paymentRecords/{{buyer_email_lowercase}}`
  (lowercase the email from the trigger — add a Formatter "Lowercase" step
  before this if needed)
- Data (raw JSON):
  ```json
  {
    "fields": {
      "secret":          { "stringValue": "REPLACE_WITH_A_LONG_RANDOM_SECRET" },
      "subscriptionEnd": { "stringValue": "{{subscription_end_from_step_3}}" },
      "plan":            { "stringValue": "{{selar_product_name}}" }
    }
  }
  ```

**Step 5 — Webhooks by Zapier → Custom Request** (writes the readable
status, must run *after* Step 4):
- Method: `PATCH`
- URL: `https://firestore.googleapis.com/v1/projects/cinema-nest-2bf23/databases/(default)/documents/paidStatus/{{buyer_email_lowercase}}`
- Data (raw JSON):
  ```json
  {
    "fields": {
      "subscriptionEnd": { "stringValue": "{{subscription_end_from_step_3}}" },
      "plan":            { "stringValue": "{{selar_product_name}}" }
    }
  }
  ```

Test each Zap step with Zapier's built-in test feature before turning it
on — this also tells you immediately if a 403 comes back from Firestore
(usually means the rules text or the secret doesn't match exactly).

## 4. The Selar redirect URL you already set

Leave it pointed at your site (e.g. a simple `index.html` or a small
"Thanks — activating your account, this can take a few seconds" page).
That redirect is just for the user's browser; the actual activation now
happens through the Zap above, completely independently of where Selar
sends them afterward.

## 5. Testing end to end

1. Sign up for a trial account on the live site with a real email you
   control.
2. Go through a Selar checkout for the cheapest plan using that same
   email (Selar's test/sandbox mode if available, otherwise a real small
   payment).
3. Check Zapier's task history to confirm both PATCH steps returned 200.
4. Check Firestore Console for the new `paymentRecords` and `paidStatus`
   documents.
5. Visit `watch.html?id=...` on that account — even with an expired
   trial, it should let you in.
