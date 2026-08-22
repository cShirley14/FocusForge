#!/usr/bin/env bash
# Creates the DynamoDB table in the local instance.
# Idempotent — skips if table already exists.

set -euo pipefail

ENDPOINT="http://localhost:8000"
TABLE_NAME="focusforge-tasks-local"

# Check if table exists
if aws dynamodb describe-table \
  --table-name "$TABLE_NAME" \
  --endpoint-url "$ENDPOINT" \
  --no-cli-pager &>/dev/null; then
  echo "Table '$TABLE_NAME' already exists, skipping."
  exit 0
fi

aws dynamodb create-table \
  --table-name "$TABLE_NAME" \
  --attribute-definitions \
    AttributeName=userId,AttributeType=S \
    AttributeName=taskId,AttributeType=S \
  --key-schema \
    AttributeName=userId,KeyType=HASH \
    AttributeName=taskId,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --endpoint-url "$ENDPOINT" \
  --no-cli-pager

echo "✅ Table '$TABLE_NAME' created."
