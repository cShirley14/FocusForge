#!/usr/bin/env bash
# Quick smoke test against the deployed API.
# Gets a token and hits the /tasks endpoint.

set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
STACK_NAME="${STACK_NAME:-focusforge}"

# Get API URL
API_URL=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text \
  --no-cli-pager)

if [[ -z "$API_URL" ]]; then
  echo "❌ Could not find API URL. Is the stack deployed?"
  exit 1
fi

echo "── Testing API at: $API_URL ──"
echo ""

# Test 1: Unauthenticated request should be rejected
echo "Test 1: Unauthenticated request → expect 401"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/tasks")
if [[ "$STATUS" == "401" ]]; then
  echo "  ✅ Got 401 (unauthorized). Auth is enforced."
else
  echo "  ❌ Got $STATUS (expected 401). Auth may not be configured!"
  exit 1
fi

echo ""
echo "Test 2: Authenticated request (requires token)"
echo "  Run: just get-token <your-email>"
echo "  Then: curl -H 'Authorization: Bearer <token>' $API_URL/tasks"
echo ""
echo "── All automated checks passed ──"
