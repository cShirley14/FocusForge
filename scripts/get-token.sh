#!/usr/bin/env bash
# Authenticate with Cognito and get a JWT token for API testing.
# Usage: ./get-token.sh your@email.com
# You'll be prompted for password (not stored).

set -euo pipefail

EMAIL="${1:?Usage: get-token.sh <email>}"
REGION="${AWS_REGION:-us-east-1}"
STACK_NAME="${STACK_NAME:-focusforge}"

# Get Cognito IDs from stack outputs
USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
  --output text \
  --no-cli-pager)

CLIENT_ID=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' \
  --output text \
  --no-cli-pager)

if [[ -z "$USER_POOL_ID" || -z "$CLIENT_ID" ]]; then
  echo "❌ Could not find Cognito outputs. Is the stack deployed?"
  exit 1
fi

# Prompt for password securely
read -rsp "Password for $EMAIL: " PASSWORD
echo ""

# Authenticate
RESULT=$(aws cognito-idp initiate-auth \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id "$CLIENT_ID" \
  --auth-parameters USERNAME="$EMAIL",PASSWORD="$PASSWORD" \
  --region "$REGION" \
  --no-cli-pager 2>&1)

# Check for NEW_PASSWORD_REQUIRED challenge (first login with temp password)
if echo "$RESULT" | grep -q "NEW_PASSWORD_REQUIRED"; then
  SESSION=$(echo "$RESULT" | jq -r '.Session')
  echo ""
  read -rsp "New permanent password: " NEW_PASSWORD
  echo ""

  RESULT=$(aws cognito-idp respond-to-auth-challenge \
    --client-id "$CLIENT_ID" \
    --challenge-name NEW_PASSWORD_REQUIRED \
    --session "$SESSION" \
    --challenge-responses USERNAME="$EMAIL",NEW_PASSWORD="$NEW_PASSWORD" \
    --region "$REGION" \
    --no-cli-pager)
fi

# Extract tokens
ID_TOKEN=$(echo "$RESULT" | jq -r '.AuthenticationResult.IdToken // empty')

if [[ -z "$ID_TOKEN" ]]; then
  echo "❌ Authentication failed:"
  echo "$RESULT"
  exit 1
fi

echo ""
echo "✅ Authenticated. Token (use as Authorization header):"
echo ""
echo "$ID_TOKEN"
echo ""
echo "Example usage:"
echo "  curl -H 'Authorization: Bearer $ID_TOKEN' \\"

API_URL=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text \
  --no-cli-pager)

echo "    $API_URL/tasks"
