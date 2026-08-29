#!/usr/bin/env bash
# Smoke test for the Forge Plan path of POST /forge.
#
# Sends a free-text brain-dump and asserts the response contains an ordered
# plan whose steps carry a title, a valid duration, and a reason. Uses an
# ephemeral Cognito user so it never consumes the owner's daily forge quota.
#
# Note: this is a smoke script, not a test framework. It asserts on shape and
# invariants, not on model wording (which is non-deterministic by nature).

set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
STACK_NAME="${STACK_NAME:-focusforge}"

POOL_ID=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
  --output text --region "$REGION" --no-cli-pager)
CLIENT_ID=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' \
  --output text --region "$REGION" --no-cli-pager)
API_URL=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text --region "$REGION" --no-cli-pager)

if [[ -z "$API_URL" || -z "$POOL_ID" || -z "$CLIENT_ID" ]]; then
  echo "❌ Missing stack outputs. Is the stack deployed?"
  exit 1
fi

echo "── Testing Forge Plan at: $API_URL/forge ──"

TEST_EMAIL="forgeplan-test-$(date +%s)@test.local"
# Ephemeral credential — user is deleted on exit.
# EFF Diceware (https://www.eff.org/dice): 6 words (~77.5 bits entropy), which
# already satisfies the Cognito policy once a digit and a safe symbol are added.
# Deliberately *not* using diceware's `-s` random specials: those can emit `"`
# or `\`, which break JSON/shell quoting downstream.
TEST_PASS="$(diceware -n 6)$((RANDOM % 10))-Aa"

cleanup() {
  echo "── Cleaning up test user ──"
  aws cognito-idp admin-delete-user --user-pool-id "$POOL_ID" \
    --username "$TEST_EMAIL" --region "$REGION" 2>/dev/null || true
}
trap cleanup EXIT

aws cognito-idp admin-create-user --user-pool-id "$POOL_ID" \
  --username "$TEST_EMAIL" \
  --user-attributes Name=email,Value="$TEST_EMAIL" Name=email_verified,Value=true \
  --region "$REGION" --no-cli-pager > /dev/null
aws cognito-idp admin-set-user-password --user-pool-id "$POOL_ID" \
  --username "$TEST_EMAIL" --password "$TEST_PASS" --permanent --region "$REGION"

# Build with jq, not printf: a generated password can contain `"` or `\`, which
# would break hand-built JSON. jq escapes correctly.
AUTH_PARAMS=$(jq -n --arg u "$TEST_EMAIL" --arg p "$TEST_PASS" \
  '{USERNAME: $u, PASSWORD: $p}')
TOKEN=$(aws cognito-idp initiate-auth --client-id "$CLIENT_ID" \
  --auth-flow USER_PASSWORD_AUTH \
  --auth-parameters "$AUTH_PARAMS" \
  --region "$REGION" --query 'AuthenticationResult.AccessToken' --output text)

if [[ -z "$TOKEN" || "$TOKEN" == "None" ]]; then
  echo "  ❌ Could not authenticate test user"
  exit 1
fi
echo "  ✅ Authenticated ephemeral test user"

DUMP='study for calc 2 test
email advisor
fix the login bug
read a NYT article'

BODY=$(jq -n --arg d "$DUMP" '{brainDump: $d}')

RESPONSE=$(curl -s -X POST "$API_URL/forge" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$BODY")

# 1. Response must contain a plan array with at least one step.
STEPS=$(echo "$RESPONSE" | jq '(.plan // []) | length')
if [[ "$STEPS" -lt 1 ]]; then
  echo "  ❌ No plan returned. Response was:"
  echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
  exit 1
fi
echo "  ✅ Plan returned with $STEPS step(s)"

# 2. Every step must have a non-empty title and reason.
BAD_FIELDS=$(echo "$RESPONSE" | jq '
  [.plan[] | select((.title // "") == "" or (.reason // "") == "")] | length')
if [[ "$BAD_FIELDS" -ne 0 ]]; then
  echo "  ❌ $BAD_FIELDS step(s) missing title or reason"
  exit 1
fi
echo "  ✅ Every step has a title and a reason"

# 3. Durations must be one of the allowed session lengths (schema invariant).
BAD_MINUTES=$(echo "$RESPONSE" | jq '
  [.plan[] | select((.minutes | IN(5, 15, 25, 45, 60)) | not)] | length')
if [[ "$BAD_MINUTES" -ne 0 ]]; then
  echo "  ❌ $BAD_MINUTES step(s) have a disallowed duration"
  echo "$RESPONSE" | jq '.plan[].minutes'
  exit 1
fi
echo "  ✅ All durations are valid session lengths"

# 4. `order` must be a strictly increasing sequence starting at 1 — the whole
#    point of the feature is sequencing, so verify it actually sequenced.
ORDER_OK=$(echo "$RESPONSE" | jq '
  ([.plan[].order] | sort) == ([range(1; (.plan | length) + 1)])')
if [[ "$ORDER_OK" != "true" ]]; then
  echo "  ❌ Plan order is not a 1..n sequence"
  echo "$RESPONSE" | jq '[.plan[].order]'
  exit 1
fi
echo "  ✅ Plan is ordered 1..$STEPS"

if [[ "$(echo "$RESPONSE" | jq -r '._fallback // false')" == "true" ]]; then
  echo "  ⚠️  Served by the local fallback (Bedrock unavailable or output"
  echo "      failed validation). Shape is valid but not model-generated."
fi

echo "✅ Forge Plan smoke test passed."
