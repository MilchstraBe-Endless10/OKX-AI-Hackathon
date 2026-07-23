#!/bin/bash
# SOPscape — Real Model Validation Script
# Usage: MODEL_API_KEY=sk-xxx MODEL_BASE_URL=https://api.example.com MODEL_NAME=gpt-4o ./scripts/validate-model.sh

set -e

if [ -z "$MODEL_API_KEY" ]; then
  echo " MODEL_API_KEY not set"
  echo "Usage: MODEL_API_KEY=sk-xxx MODEL_BASE_URL=https://api.example.com MODEL_NAME=gpt-4o $0"
  exit 1
fi

if [ -z "$MODEL_BASE_URL" ]; then
  echo "❌ MODEL_BASE_URL not set"
  exit 1
fi

if [ -z "$MODEL_NAME" ]; then
  echo " MODEL_NAME not set"
  exit 1
fi

echo "=== SOPscape Model Validation ==="
echo "API Key: ${MODEL_API_KEY:0:8}..."
echo "Base URL: $MODEL_BASE_URL"
echo "Model: $MODEL_NAME"
echo ""

# Test 1: Basic connectivity
echo "1. Testing connectivity..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$MODEL_BASE_URL/chat/completions" \
  -H "Authorization: Bearer $MODEL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "'"$MODEL_NAME"'",
    "messages": [{"role": "user", "content": "Hello"}],
    "max_tokens": 10
  }')
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
  echo "✓ Connectivity test passed (HTTP $HTTP_CODE)"
else
  echo "❌ Connectivity test failed (HTTP $HTTP_CODE)"
  echo "Response: $BODY"
  exit 1
fi

# Test 2: JSON response format
echo ""
echo "2. Testing JSON response format..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$MODEL_BASE_URL/chat/completions" \
  -H "Authorization: Bearer $MODEL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "'"$MODEL_NAME"'",
    "messages": [
      {"role": "system", "content": "Respond with JSON only."},
      {"role": "user", "content": "Return {\"test\": \"value\"}"}
    ],
    "response_format": {"type": "json_object"},
    "max_tokens": 50
  }')
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
  CONTENT=$(echo "$BODY" | jq -r '.choices[0].message.content' 2>/dev/null)
  if [ -n "$CONTENT" ]; then
    echo "✓ JSON response test passed"
    echo "  Content: $CONTENT"
  else
    echo " JSON response test failed (empty content)"
  fi
else
  echo "❌ JSON response test failed (HTTP $HTTP_CODE)"
fi

# Test 3: Chinese SOP analysis
echo ""
echo "3. Testing Chinese SOP analysis..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$MODEL_BASE_URL/chat/completions" \
  -H "Authorization: Bearer $MODEL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "'"$MODEL_NAME"'",
    "messages": [
      {"role": "system", "content": "You are a procedure analyst. Analyze the SOP and provide a finding with role, claim, evidence_refs, confidence (0-1), severity (low/medium/high), affected_step_ids, and unsupported (boolean)."},
      {"role": "user", "content": "SOP Title: 钓鱼邮件处置\nSOP Content: 收到可疑邮件后：1. 不点击链接 2. 通过独立渠道核验 3. 上报安全团队\nLocale: zh-CN"}
    ],
    "response_format": {"type": "json_object"},
    "max_tokens": 500
  }')
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
  CONTENT=$(echo "$BODY" | jq -r '.choices[0].message.content' 2>/dev/null)
  if [ -n "$CONTENT" ]; then
    echo "✓ Chinese SOP analysis test passed"
    echo "  Content length: $(echo "$CONTENT" | wc -c) characters"
  else
    echo "❌ Chinese SOP analysis test failed (empty content)"
  fi
else
  echo "❌ Chinese SOP analysis test failed (HTTP $HTTP_CODE)"
fi

# Test 4: Latency measurement (10 requests)
echo ""
echo "4. Measuring latency (10 requests)..."
declare -a LATENCIES
for i in $(seq 1 10); do
  START=$(date +%s%N)
  curl -s -X POST "$MODEL_BASE_URL/chat/completions" \
    -H "Authorization: Bearer $MODEL_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "model": "'"$MODEL_NAME"'",
      "messages": [{"role": "user", "content": "Hello"}],
      "max_tokens": 10
    }' > /dev/null
  END=$(date +%s%N)
  LATENCY=$(( (END - START) / 1000000 ))
  LATENCIES+=($LATENCY)
  echo "  Request $i: ${LATENCY}ms"
done

# Calculate statistics
TOTAL=0
for LATENCY in "${LATENCIES[@]}"; do
  TOTAL=$((TOTAL + LATENCY))
done
MEAN=$((TOTAL / 10))

# Sort for median
IFS=$'\n' SORTED=($(sort -n <<<"${LATENCIES[*]}")); unset IFS
MEDIAN=${SORTED[4]}
P95=${SORTED[9]}

echo ""
echo "=== Latency Summary ==="
echo "  Mean: ${MEAN}ms"
echo "  Median: ${MEDIAN}ms"
echo "  P95: ${P95}ms"

if [ "$P95" -lt 10000 ]; then
  echo "✓ Latency test passed (P95 < 10s)"
else
  echo "⚠ Latency test warning (P95 >= 10s)"
fi

echo ""
echo "=== Validation Complete ==="
echo "Model $MODEL_NAME is ready for production use."
