#!/bin/bash
# SOPscape — 10-Round Production Model Verification
# Usage: MODEL_API_KEY=sk-xxx MODEL_BASE_URL=https://api.okx.ai/v1 MODEL_NAME=xxx \
#        SOPSCAPE_OWNER_PASSWORD=demo-password SOPSCAPE_SESSION_SECRET=demo-secret \
#        SOPSCAPE_API_KEY=demo-api-key \
#        ./scripts/prod-verify-10round.sh

set -euo pipefail

# MODEL_API_KEY, MODEL_BASE_URL, MODEL_NAME — only needed for local server testing
# When testing a remote server (e.g. Railway), these are not required

BASE_URL="${SERVER_URL:-http://127.0.0.1:3100}"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

pass() { echo -e "  ${GREEN}PASS${NC} $1"; }
fail() { echo -e "  ${RED}FAIL${NC} $1"; FAILURES=$((FAILURES + 1)); }
info() { echo -e "  ${CYAN}INFO${NC} $1"; }

FAILURES=0
TOTAL=10

# 5 SOP types for testing (locale is full format like zh-CN, en-US)
SOPS=(
  'zh-CN|zh-phishing|钓鱼邮件处置|收到可疑邮件要求修改密码：1. 点击邮件链接 2. 输入账号密码 3. 完成修改'
  'zh-CN|zh-emergency|生产事故应急响应|生产服务出现 502：1. 重启服务 2. 检查日志 3. 通知团队 4. 回滚版本'
  'zh-CN|zh-compliance|数据合规审查流程|收集用户数据：1. 获取同意 2. 存储加密 3. 定期审计 4. 用户可删除'
  'en-US|en-onboarding|New Employee Onboarding|Day 1 setup: 1. Create accounts 2. Install tools 3. Review docs 4. Meet team'
  'en-US|en-incident|Security Incident Response|Data breach detected: 1. Isolate systems 2. Notify legal 3. Preserve evidence 4. Notify users'
)

echo "=== SOPscape 10-Round Production Model Verification ==="
echo "Server: $BASE_URL"
MODEL_INFO="${MODEL_NAME:-remote}"
MODEL_URL="${MODEL_BASE_URL:-configured-on-server}"
echo "Model: $MODEL_INFO @ $MODEL_URL"
echo "Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""

# 1. Health check
echo "--- 1. Health Check ---"
READY_HTTP=$(curl -s -w "\n%{http_code}" "$BASE_URL/health/ready" 2>/dev/null || echo "000")
READY_STATUS=$(echo "$READY_HTTP" | tail -1)
READY_BODY=$(echo "$READY_HTTP" | sed '$d')

if [ "$READY_STATUS" = "200" ]; then
  pass "Server ready (HTTP 200)"
  MODEL_CHECK=$(echo "$READY_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print('OK' if d.get('checks',{}).get('model_config',{}).get('ok') else 'FAIL')" 2>/dev/null || echo "FAIL")
  if [ "$MODEL_CHECK" = "OK" ]; then
    pass "Model config: OK"
  else
    fail "Model config: NOT READY"
  fi
else
  fail "Server not ready (HTTP $READY_STATUS)"
  echo "  Body: $READY_BODY" | head -c 300
  echo ""
  exit 1
fi
echo ""

# 2. 10-round model verification
echo "--- 2. 10-Round Model Verification ---"
echo ""

SUCCESS_COUNT=0
FALLBACK_COUNT=0
TOTAL_LATENCY=0
FIRST_MODEL_SUCCESS=0
TOTAL_REQUESTS=0

for round in $(seq 1 $TOTAL); do
  # Pick SOP (cycle through 5 types, 2 rounds each = 10)
  SOP_IDX=$(( (round - 1) % 5 ))
  SOP_ENTRY="${SOPS[$SOP_IDX]}"
  SOP_LOCALE=$(echo "$SOP_ENTRY" | cut -d'|' -f1)
  SOP_KEY=$(echo "$SOP_ENTRY" | cut -d'|' -f2)
  SOP_TITLE=$(echo "$SOP_ENTRY" | cut -d'|' -f3)
  SOP_CONTENT=$(echo "$SOP_ENTRY" | cut -d'|' -f4)

  START_MS=$(python3 -c "import time; print(int(time.time()*1000))")

  RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/a2mcp/generate-rehearsal" \
    -H "Content-Type: application/json" \
    -d "{
      \"title\": \"$SOP_TITLE\",
      \"content\": \"$SOP_CONTENT\",
      \"locale\": \"$SOP_LOCALE\"
    }" 2>/dev/null)

  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  BODY=$(echo "$RESPONSE" | sed '$d')
  END_MS=$(python3 -c "import time; print(int(time.time()*1000))")
  LATENCY=$((END_MS - START_MS))
  TOTAL_LATENCY=$((TOTAL_LATENCY + LATENCY))
  TOTAL_REQUESTS=$((TOTAL_REQUESTS + 1))

  STATUS=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status','unknown'))" 2>/dev/null || echo "unknown")

  echo "  Round $round [$SOP_KEY] — HTTP $HTTP_CODE — ${LATENCY}ms"

  if [ "$HTTP_CODE" = "200" ] && [ "$STATUS" = "READY" ]; then
    REHEARSAL_ID=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('rehearsalId','none'))" 2>/dev/null || echo "none")
    DECISION_NODES=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('decisionNodes',[])))" 2>/dev/null || echo "0")
    DISAGREEMENTS=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('disagreements',[])))" 2>/dev/null || echo "0")
    EVIDENCE_GAPS=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('evidenceGaps',[])))" 2>/dev/null || echo "0")
    CONSENSUS=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('consensus',[])))" 2>/dev/null || echo "0")

    echo "    rehearsalId: $REHEARSAL_ID"
    echo "    consensus: $CONSENSUS, disagreements: $DISAGREEMENTS, evidenceGaps: $EVIDENCE_GAPS, decisionNodes: $DECISION_NODES"

    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    FIRST_MODEL_SUCCESS=$((FIRST_MODEL_SUCCESS + 1))
    pass "READY — $SOP_TITLE"
  elif [ "$HTTP_CODE" = "200" ] && [ "$STATUS" = "PARTIAL_FAILED" ]; then
    FAILED_ROLES=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(','.join(d.get('failedRoles',[])))" 2>/dev/null || echo "unknown")
    PARTIAL=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('partialFindings',[])))" 2>/dev/null || echo "0")
    echo "    PARTIAL_FAILED — failed: $FAILED_ROLES, partial: $PARTIAL"
    FAILURES=$((FAILURES + 1))
  else
    echo "    Body: $(echo "$BODY" | head -c 200)"
    FAILURES=$((FAILURES + 1))
    fail "Unexpected: HTTP $HTTP_CODE status=$STATUS"
  fi

  echo ""
done

# 3. Summary
echo "--- 3. Summary ---"
echo ""
echo "  Rounds: $TOTAL_REQUESTS"
echo "  Success (READY): $SUCCESS_COUNT / $TOTAL"
echo "  Failures: $FAILURES"

if [ "$TOTAL_REQUESTS" -gt 0 ]; then
  MEAN_LATENCY=$((TOTAL_LATENCY / TOTAL_REQUESTS))
  echo "  Mean latency: ${MEAN_LATENCY}ms"
fi

# 27/30 first-call success rate check
if [ "$FIRST_MODEL_SUCCESS" -ge 7 ]; then
  pass "First-call success rate: $FIRST_MODEL_SUCCESS / $TOTAL (≥ 70%)"
else
  fail "First-call success rate: $FIRST_MODEL_SUCCESS / $TOTAL (< 70%)"
fi

# Overall: need 10/10 for production readiness
if [ "$SUCCESS_COUNT" -eq "$TOTAL" ] && [ "$FAILURES" -eq 0 ]; then
  echo ""
  echo -e "  ${GREEN}=== ALL $TOTAL ROUNDS PASSED ===${NC}"
  echo "  Production model verification: PASSED"
  exit 0
else
  echo ""
  echo -e "  ${RED}=== $FAILURES ROUNDS FAILED ===${NC}"
  echo "  Production model verification: FAILED"
  exit 1
fi
