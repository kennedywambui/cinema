#!/bin/bash

# Cinema Nest Security Fixes - Deployment Checklist
# Run this before and after deployment to verify everything is working

set -e

echo "🚀 Cinema Nest Security Deployment Checklist"
echo "=============================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
WEBHOOK_WORKER="https://your-webhook-worker.workers.dev"
TMDB_PROXY="https://tmdb-proxy.YOUR-ACCOUNT.workers.dev"
SUBSCRIPTION_CHECK="https://subscription-check.YOUR-ACCOUNT.workers.dev"
SELAR_SECRET="your-selar-secret-here"
DOMAIN="https://yourdomain.com"

echo "⚙️  Configuration Check"
echo "---------------------"
echo "Webhook URL: $WEBHOOK_WORKER"
echo "TMDB Proxy: $TMDB_PROXY"
echo "Subscription Check: $SUBSCRIPTION_CHECK"
echo "Domain: $DOMAIN"
echo ""

# Update these values before running!
if [[ "$WEBHOOK_WORKER" == *"your-"* ]]; then
  echo -e "${RED}❌ ERROR: Please update the URLs in this script first!${NC}"
  exit 1
fi

echo "✅ Configuration looks good"
echo ""

# Phase 1: Backend Deployment
echo "📦 Phase 1: Backend Deployment"
echo "------------------------------"
echo ""

echo "Step 1: Cloudflare Worker - Webhook Handler"
echo "  - File: cloudflare-worker.js"
echo "  - Action: Deploy to your webhook Worker"
echo "  - Env vars needed:"
echo "    • SELAR_SECRET=$SELAR_SECRET"
echo "    • FIREBASE_PROJECT_ID=cinema-nest-2bf23"
echo "    • FIREBASE_API_KEY=AIzaSyARv0yl2troYUULCo-7avpF4yg5nZ-xoEE"
echo "    • ALLOWED_ORIGINS=$DOMAIN"
read -p "  Press enter when deployed..."
echo ""

echo "Step 2: Cloudflare Worker - TMDB Proxy"
echo "  - File: workers/tmdb-proxy.js"
echo "  - Action: Deploy as new Worker 'tmdb-proxy'"
echo "  - Env vars needed:"
echo "    • TMDB_API_KEY=1d3ae144acfb6bfcb25f70361cedcf29"
echo "    • ALLOWED_ORIGINS=$DOMAIN"
read -p "  Press enter when deployed..."
echo ""

echo "Step 3: Cloudflare Worker - Subscription Check"
echo "  - File: workers/subscription-check.js"
echo "  - Action: Deploy as new Worker 'subscription-check'"
echo "  - Env vars needed:"
echo "    • FIREBASE_PROJECT_ID=cinema-nest-2bf23"
echo "    • FIREBASE_API_KEY=AIzaSyARv0yl2troYUULCo-7avpF4yg5nZ-xoEE"
read -p "  Press enter when deployed..."
echo ""

# Phase 2: Test Webhook
echo "🧪 Phase 2: Webhook Authentication Test"
echo "--------------------------------------"
echo ""

echo "Testing webhook endpoint..."
echo "Command:"
echo "curl -X POST $WEBHOOK_WORKER \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -H \"Origin: $DOMAIN\" \\"
echo "  -H \"x-selar-token: $SELAR_SECRET\" \\"
echo "  -d '{\"buyer_email\": \"test@example.com\", \"amount\": 3, \"product_id\": \"1c7tz476t8\"}'"
echo ""

echo "Test webhook manually and verify:"
echo "  - ✅ Valid secret returns 200 with success message"
echo "  - ✅ Invalid secret returns 401 Unauthorized"
echo "  - ✅ Wrong origin returns 403 Forbidden"
read -p "  Press enter after testing..."
echo ""

# Phase 3: Test TMDB Proxy
echo "🧪 Phase 3: TMDB Proxy Test"
echo "-------------------------"
echo ""

echo "Testing TMDB proxy..."
echo "Command:"
echo "curl -H \"Origin: $DOMAIN\" \\"
echo "  \"$TMDB_PROXY/discover/movie?sort_by=popularity.desc&page=1\""
echo ""

echo "Verify:"
echo "  - ✅ Returns valid movie data"
echo "  - ✅ No api_key visible in response"
echo "  - ✅ Images load correctly"
read -p "  Press enter after testing..."
echo ""

# Phase 4: Test Subscription Check
echo "🧪 Phase 4: Subscription Check Test"
echo "-----------------------------------"
echo ""

echo "Testing subscription verification..."
echo "Command:"
echo "curl -X POST $SUBSCRIPTION_CHECK \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"uid\": \"test-user-id\"}'"
echo ""

echo "Verify:"
echo "  - ✅ Returns valid/invalid response"
echo "  - ✅ No sensitive data in response"
echo "  - ✅ Handles missing user gracefully"
read -p "  Press enter after testing..."
echo ""

# Phase 5: Frontend Updates
echo "📝 Phase 5: Frontend Updates"
echo "---------------------------"
echo ""

echo "Step 1: Update browse.html"
echo "  - Replace API_KEY constant"
echo "  - Update all TMDB fetch calls"
echo "  - Replace paywall logic"
read -p "  Press enter when done..."
echo ""

echo "Step 2: Update index.html"
echo "  - Replace API_KEY constant"
echo "  - Update all TMDB fetch calls"
read -p "  Press enter when done..."
echo ""

# Phase 6: Security Verification
echo "🔒 Phase 6: Security Verification"
echo "--------------------------------"
echo ""

echo "1. Check DevTools for API key exposure"
echo "   - Open your site"
echo "   - Press F12"
echo "   - Go to Network tab"
echo "   - ✅ Verify: No requests contain 'api_key='"
echo "   - ✅ Verify: No hardcoded keys visible in code"
read -p "   Press enter after checking..."
echo ""

echo "2. Test Paywall Bypass Prevention"
echo "   - Open Console in DevTools"
echo "   - Run: localStorage.setItem('cinemanest-paid', 'true')"
echo "   - Refresh page"
echo "   - ✅ Verify: Paywall still shows (server check prevents bypass)"
read -p "   Press enter after checking..."
echo ""

echo "3. Test Browse Page"
echo "   - Verify movies load"
echo "   - Verify search works"
echo "   - Verify modals work"
echo "   - ✅ Check for any console errors"
read -p "   Press enter after checking..."
echo ""

echo "4. Test Paywall on Browse"
echo "   - ✅ Logged-out: See paywall"
echo "   - ✅ Trial user: See content"
echo "   - ✅ Expired subscriber: See paywall"
echo "   - ✅ Active subscriber: See content"
read -p "   Press enter after checking..."
echo ""

# Phase 7: Production Deployment
echo "🌍 Phase 7: Production Deployment"
echo "--------------------------------"
echo ""

echo "Ready to deploy to production?"
echo "Checklist:"
echo "  ☐ All tests passed"
echo "  ☐ No console errors"
echo "  ☐ Paywall working correctly"
echo "  ☐ No API keys exposed"
echo "  ☐ Webhooks authenticated"
echo "  ☐ Team notified of deployment"
echo ""

read -p "Type 'yes' to proceed with production merge: " CONFIRM
if [[ "$CONFIRM" != "yes" ]]; then
  echo -e "${YELLOW}Deployment cancelled${NC}"
  exit 0
fi

echo ""
echo "📋 Production Deployment Steps:"
echo "1. Create Pull Request on GitHub"
echo "   - Branch: fix/security-critical-issues"
echo "   - Target: main"
echo "   - Description: Include link to SECURITY_FIXES.md"
echo ""
echo "2. Get team approval"
echo "3. Merge PR to main"
echo "4. Deploy main branch to production"
echo "5. Monitor logs for errors"
echo ""

echo "⏱️  Deployment Timeline:"
echo "  - Webhook: Immediate (backward compatible)"
echo "  - TMDB Proxy: Immediate (no UI changes needed yet)"
echo "  - Subscription Check: When frontend updated"
echo ""

echo "📊 Post-Deployment Monitoring:"
echo "  - ✅ Monitor Cloudflare Worker logs"
echo "  - ✅ Check for authentication errors"
echo "  - ✅ Verify no 4xx/5xx spikes"
echo "  - ✅ Test payment webhook processing"
echo "  - ✅ Verify users can still access"
echo ""

echo -e "${GREEN}✅ Deployment checklist complete!${NC}"
echo ""
echo "🎉 Security fixes deployed successfully!"
echo ""
echo "📚 Documentation:"
echo "  - SECURITY_FIXES.md - Full setup guide"
echo "  - MIGRATION_GUIDE.md - Frontend changes"
echo ""
