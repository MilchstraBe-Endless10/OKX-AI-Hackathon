#!/bin/bash
# Post-deployment verification script for SOPscape Railway staging
# Run after sealed variables are set in Railway Dashboard

BASE_URL="https://sopscape-production.up.railway.app"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "  ${GREEN}PASS${NC} $1"; }
fail() { echo -e "  ${RED}FAIL${NC} $1"; }
warn() { echo -e "  ${YELLOW}WARN${NC} $1"; }

echo "=== SOPscape Railway Staging Verification ==="
echo "Target: $BASE_URL"
echo ""

# 1. Health checks
echo "--- Health Endpoints ---"
LIVE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/health/live")
if [ "$LIVE_STATUS" = "200" ]; then pass "/health/live ($LIVE_STATUS)"; else fail "/health/live ($LIVE_STATUS)"; fi

READY_HTTP=$(curl -s -w "\n%{http_code}" "$BASE_URL/health/ready")
READY_STATUS=$(echo "$READY_HTTP" | tail -1)
READY_BODY=$(echo "$READY_HTTP" | sed '$d')
if [ "$READY_STATUS" = "200" ]; then pass "/health/ready ($READY_STATUS)"; else fail "/health/ready ($READY_STATUS)"; fi
echo "  Response: $READY_BODY" | head -c 200

# Check individual readiness checks
if echo "$READY_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); exit(0 if d.get('checks',{}).get('model_config',{}).get('ok') else 1)" 2>/dev/null; then
  pass "model_config check"
else
  fail "model_config check (sealed vars not set?)"
fi

# 2. Static assets
echo ""
echo "--- Static Assets ---"
ROOT_HTTP=$(curl -sI "$BASE_URL/")
ROOT_STATUS=$(echo "$ROOT_HTTP" | head -1 | awk '{print $2}')
if [ "$ROOT_STATUS" = "200" ]; then pass "/ ($ROOT_STATUS)"; else fail "/ ($ROOT_STATUS)"; fi

JS_URL=$(curl -s "$BASE_URL/" | grep -oP 'src="/assets/index-[^"]+\.js"' | head -1 | tr -d 'src= "' )
if [ -n "$JS_URL" ]; then
  JS_STATUS=$(curl -sI -o /dev/null -w "%{http_code}" "$BASE_URL$JS_URL")
  if [ "$JS_STATUS" = "200" ]; then pass "$JS_URL ($JS_STATUS)"; else fail "$JS_URL ($JS_STATUS)"; fi
else
  warn "Could not extract JS URL from index.html"
fi

CSS_URL=$(curl -s "$BASE_URL/" | grep -oP 'href="/assets/index-[^"]+\.css"' | head -1 | tr -d 'href= "')
if [ -n "$CSS_URL" ]; then
  CSS_STATUS=$(curl -sI -o /dev/null -w "%{http_code}" "$BASE_URL$CSS_URL")
  if [ "$CSS_STATUS" = "200" ]; then pass "$CSS_URL ($CSS_STATUS)"; else fail "$CSS_URL ($CSS_STATUS)"; fi
else
  warn "Could not extract CSS URL from index.html"
fi

# 3. SPA routing
echo ""
echo "--- SPA Fallback ---"
SPA_STATUS=$(curl -sI -o /dev/null -w "%{http_code}" "$BASE_URL/r/test-share-token")
if [ "$SPA_STATUS" = "200" ]; then pass "/r/test-share-token ($SPA_STATUS)"; else fail "/r/test-share-token ($SPA_STATUS)"; fi

# 4. Security headers
echo ""
echo "--- Security Headers ---"
HEADERS=$(curl -sI "$BASE_URL/")
for header in "x-frame-options" "x-content-type-options" "content-security-policy" "referrer-policy"; do
  if echo "$HEADERS" | grep -qi "$header"; then pass "$header present"; else warn "$header missing"; fi
done

# 5. API routes
echo ""
echo "--- API Endpoints ---"
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/scenarios" -H "Content-Type: application/json" -d '{}')
if [ "$API_STATUS" = "400" ] || [ "$API_STATUS" = "401" ] || [ "$API_STATUS" = "422" ]; then pass "/api/scenarios ($API_STATUS - route exists)"; else warn "/api/scenarios ($API_STATUS)"; fi

echo ""
echo "=== Verification Complete ==="
