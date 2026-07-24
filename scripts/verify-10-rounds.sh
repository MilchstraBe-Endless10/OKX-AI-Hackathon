#!/usr/bin/env bash
# Production 10-round continuous verification
# Must pass all 10 consecutive rounds — any failure resets counter
# Usage: scripts/verify-10-rounds.sh [base_url]

set -euo pipefail

BASE_URL="${1:-http://127.0.0.1:3000}"
ROUNDS=10
PASS=0

echo "=== SOPscape 10-Round Production Verification ==="
echo "Target: $BASE_URL"
echo "Rounds: $ROUNDS"
echo ""

PAYLOAD='{
  "title": "钓鱼邮件处置SOP",
  "content": "收到可疑邮件后的处置流程：1. 不要点击任何链接或下载附件 2. 通过独立渠道（电话或另一封邮件）向发件人核实 3. 保留邮件原始信息 4. 上报安全团队进行进一步分析 5. 在安全团队指导下进行后续处置",
  "locale": "zh-CN"
}'

for i in $(seq 1 $ROUNDS); do
  echo -n "Round $i/$ROUNDS ... "

  RESPONSE=$(curl -sf -X POST "$BASE_URL/a2mcp/generate-rehearsal" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" \
    -w "\n%{http_code}" 2>/dev/null) || {
    echo "FAIL (request failed)"
    PASS=0
    echo "  Reset: consecutive pass counter back to 0"
    continue
  }

  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  BODY=$(echo "$RESPONSE" | head -n -1)

  if [ "$HTTP_CODE" != "200" ]; then
    echo "FAIL (HTTP $HTTP_CODE)"
    echo "  Response: $(echo "$BODY" | head -c 200)"
    PASS=0
    echo "  Reset: consecutive pass counter back to 0"
    continue
  fi

  # Validate response has required fields
  HAS_REHEARSAL=$(echo "$BODY" | node -e "process.stdin.resume(); let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{try{const j=JSON.parse(d);console.log(j.rehearsalId&&j.consensus?'ok':'fail')}catch{console.log('fail')}})" 2>/dev/null) || HAS_REHEARSAL="fail"

  if [ "$HAS_REHEARSAL" != "ok" ]; then
    echo "FAIL (invalid response structure)"
    PASS=0
    echo "  Reset: consecutive pass counter back to 0"
    continue
  fi

  PASS=$((PASS + 1))
  echo "PASS ($PASS/$ROUNDS)"
done

echo ""
echo "=== Result ==="
if [ "$PASS" -eq "$ROUNDS" ]; then
  echo "SUCCESS: All $ROUNDS rounds passed consecutively"
  exit 0
else
  echo "FAILED: Only $PASS/$ROUNDS consecutive passes (need $ROUNDS)"
  exit 1
fi
