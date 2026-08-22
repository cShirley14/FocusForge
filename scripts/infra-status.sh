#!/usr/bin/env bash
# Show all resources in the deployed CloudFormation stack.
# Gives you full visibility into what exists.

set -euo pipefail

STACK_NAME="${STACK_NAME:-focusforge}"
REGION="${AWS_REGION:-us-east-1}"

echo "═══════════════════════════════════════════════════════"
echo " Stack: $STACK_NAME | Region: $REGION"
echo "═══════════════════════════════════════════════════════"
echo ""

# Stack status
echo "── Stack Status ──"
aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query 'Stacks[0].StackStatus' \
  --output text \
  --no-cli-pager 2>/dev/null || echo "❌ Stack not found"

echo ""

# All resources
echo "── Resources ──"
aws cloudformation describe-stack-resources \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query 'StackResources[].{Type:ResourceType,LogicalId:LogicalResourceId,Status:ResourceStatus}' \
  --output table \
  --no-cli-pager 2>/dev/null || echo "❌ No resources (stack may not exist)"

echo ""

# Outputs (API URL, Cognito IDs, etc.)
echo "── Outputs ──"
aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query 'Stacks[0].Outputs[].{Key:OutputKey,Value:OutputValue}' \
  --output table \
  --no-cli-pager 2>/dev/null || echo "❌ No outputs"
