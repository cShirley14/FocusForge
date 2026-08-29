#!/usr/bin/env bash
# Create a user in Cognito (admin-only signup mode).
# Usage: ./create-user.sh your@email.com

set -euo pipefail

EMAIL="${1:?Usage: create-user.sh <email>}"
REGION="${AWS_REGION:-us-east-1}"
STACK_NAME="${STACK_NAME:-focusforge}"

# Get User Pool ID from stack outputs
USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
  --output text \
  --no-cli-pager)

if [[ -z "$USER_POOL_ID" ]]; then
  echo "❌ Could not find UserPoolId. Is the stack deployed?"
  exit 1
fi

echo "Creating user '$EMAIL' in pool '$USER_POOL_ID'..."

# Create the user — they'll get a temporary password via email
aws cognito-idp admin-create-user \
  --user-pool-id "$USER_POOL_ID" \
  --username "$EMAIL" \
  --user-attributes Name=email,Value="$EMAIL" Name=email_verified,Value=true \
  --region "$REGION" \
  --no-cli-pager

echo "✅ User created."
echo ""
echo "Set a permanent password:"
echo "  just set-password $EMAIL 'YourPassphrase'   # your own, or"
echo "  just set-password $EMAIL                     # generate + print one"
