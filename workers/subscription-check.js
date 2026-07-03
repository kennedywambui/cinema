/**
 * Cinema Nest – Subscription Verification Endpoint
 * Deploy this as a Cloudflare Worker or Express endpoint.
 *
 * Purpose: Server-side subscription check. Frontend MUST verify with this endpoint
 * on every sensitive action, not just rely on localStorage.
 *
 * ENV VARS:
 *   FIREBASE_PROJECT_ID   → cinema-nest-2bf23
 *   FIREBASE_API_KEY      → Your Firebase Web API key
 */

const FIRESTORE_API = 'https://firestore.googleapis.com/v1';

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const body = await request.json().catch(() => null);
    if (!body || !body.uid) {
      return new Response(JSON.stringify({ valid: false, error: 'Missing uid' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const uid = body.uid;

    try {
      const snap = await getFirestoreUser(uid, env);

      if (!snap) {
        return respond({ valid: false, reason: 'User not found' });
      }

      const data = snap.fields;

      // Check for active paid subscription
      if (data.plan?.stringValue === 'active' && data.subscriptionEnd?.stringValue) {
        const endDate = new Date(data.subscriptionEnd.stringValue);
        if (endDate > new Date()) {
          return respond({
            valid: true,
            type: 'paid',
            planDuration: data.planDuration?.stringValue || 'unknown',
            expiresAt: data.subscriptionEnd.stringValue,
          });
        } else {
          return respond({ valid: false, reason: 'Subscription expired', type: 'paid_expired' });
        }
      }

      // Check for trial
      if (data.trialEnd?.stringValue) {
        const endDate = new Date(data.trialEnd.stringValue);
        if (endDate > new Date()) {
          return respond({
            valid: true,
            type: 'trial',
            expiresAt: data.trialEnd.stringValue,
            daysRemaining: Math.ceil((endDate - new Date()) / (1000 * 60 * 60 * 24)),
          });
        } else {
          return respond({ valid: false, reason: 'Trial expired', type: 'trial_expired' });
        }
      }

      return respond({ valid: false, reason: 'No active plan or trial' });
    } catch (err) {
      console.error('Subscription check error:', err);
      return respond({ valid: false, error: 'Server error' }, 500);
    }
  },
};

async function getFirestoreUser(uid, env) {
  const projectId = env.FIREBASE_PROJECT_ID;
  const apiKey = env.FIREBASE_API_KEY;
  const url = `${FIRESTORE_API}/projects/${projectId}/databases/(default)/documents/users/${uid}?key=${apiKey}`;

  const res = await fetch(url);
  if (!res.ok) return null;

  const doc = await res.json();
  return doc.fields ? doc : null;
}

function respond(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
    },
  });
}
