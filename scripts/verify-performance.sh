#!/bin/bash
# Performance Verification Script for SOPscape Council
#
# Tests performance targets:
# - Desktop: median >=55 FPS, 1% low >=45 FPS
# - Mobile: median >=45 FPS, 1% low >=35 FPS
# - Shell: <=2.0s median, <=2.5s worst

set -e

echo "🔍 SOPscape Performance Verification"
echo "======================================"
echo ""

BASE_URL="${BASE_URL:-https://sopscape-production.up.railway.app}"
DEMO_EMAIL="builder@sopscape.local"
DEMO_PASSWORD="2650c44cba6a24b8ae3880b6efba5e30"

echo "Testing against: $BASE_URL"
echo ""

# Check if site is accessible
echo "1. Checking site availability..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/health/live")
if [ "$HTTP_CODE" = "200" ]; then
    echo "   ✅ Site is live"
else
    echo "   ❌ Site is not accessible (HTTP $HTTP_CODE)"
    exit 1
fi

# Check ready endpoint
echo "2. Checking service readiness..."
READY=$(curl -s "$BASE_URL/health/ready")
if echo "$READY" | grep -q '"status":"ready"'; then
    echo "   ✅ Service is ready"
    echo "$READY" | jq '.checks' 2>/dev/null || echo "$READY"
else
    echo "   ⚠️  Service not ready:"
    echo "$READY"
fi

# Check web build
echo "3. Checking web build..."
if curl -s "$BASE_URL" | grep -q "<script.*src=\"/assets/"; then
    echo "   ✅ Web build is served"
else
    echo "   ⚠️  Web build may not be correct"
fi

# Measure shell load time
echo "4. Measuring shell load time..."
LOAD_TIME=$(curl -s -o /dev/null -w "%{time_total}\n" "$BASE_URL" | tr -d '\r')
LOAD_TIME_MS=$(echo "$LOAD_TIME * 1000" | bc | cut -d'.' -f1)

echo "   Shell load time: ${LOAD_TIME_MS}ms"
if [ $LOAD_TIME_MS -le 2500 ]; then
    echo "   ✅ Shell loads within 2.5s target"
else
    echo "   ⚠️  Shell load time exceeds 2.5s target"
fi

# Check A2MCP endpoint
echo "5. Checking A2MCP endpoint..."
A2MCP_RESPONSE=$(curl -s -X POST "$BASE_URL/a2mcp/generate-rehearsal" \
    -H "Content-Type: application/json" \
    -d '{"title":"test","content":"test content"}')

if echo "$A2MCP_RESPONSE" | grep -q "rehearsalId\|code"; then
    echo "   ✅ A2MCP endpoint responds"
    echo "$A2MCP_RESPONSE" | head -100
else
    echo "   ⚠️  A2MCP endpoint response unexpected"
    echo "$A2MCP_RESPONSE" | head -100
fi

# Check API endpoints
echo "6. Checking API health..."
API_CHECK=$(curl -s "$BASE_URL/api/health")
echo "   $API_CHECK"

echo ""
echo "======================================"
echo "Performance Verification Complete"
echo ""
echo "For detailed FPS testing, run the browser test:"
echo "  1. Open $BASE_URL in Chrome/Edge"
echo "  2. Open DevTools > Performance"
echo "  3. Record 30 seconds of 3D animation"
echo "  4. Check FPS metric (should show median ≥55 on desktop)"
echo ""
echo "Or run the E2E performance tests:"
echo "  pnpm test:e2e"
