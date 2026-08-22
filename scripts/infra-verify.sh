#!/usr/bin/env bash
# Verify the stack is completely gone. No orphan resources.

set -euo pipefail

STACK_NAME="${STACK_NAME:-focusforge}"
REGION="${AWS_REGION:-us-east-1}"

echo "Checking if stack '$STACK_NAME' exists..."

STATUS=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query 'Stacks[0].StackStatus' \
  --output text \
  --no-cli-pager 2>/dev/null || echo "DOES_NOT_EXIST")

if [[ "$STATUS" == "DOES_NOT_EXIST" ]]; then
  echo "✅ Stack does not exist. Clean."
elif [[ "$STATUS" == "DELETE_COMPLETE" ]]; then
  echo "✅ Stack deletion confirmed."
else
  echo "⚠️  Stack still exists with status: $STATUS"
  echo "Resources remaining:"
  aws cloudformation describe-stack-resources \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query 'StackResources[?ResourceStatus!=`DELETE_COMPLETE`].{Type:ResourceType,Id:LogicalResourceId,Status:ResourceStatus}' \
    --output table \
    --no-cli-pager
  exit 1
fi
