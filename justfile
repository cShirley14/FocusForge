# FocusForge — Command Runner
# All operations go through here. No memorizing CLI flags.

set dotenv-load
set shell := ["bash", "-euo", "pipefail", "-c"]

# Default: show available recipes
default:
    @just --list

# ─── Local Development ────────────────────────────────────────────────────────

# Install all dependencies
setup:
    cd frontend && npm install
    cd functions/tasks && npm install
    cd functions/forge-master && npm install

# Start DynamoDB Local in Docker
db-up:
    docker compose up -d dynamodb-local
    @echo "⏳ Waiting for DynamoDB Local..."
    @sleep 2
    @bash scripts/create-local-table.sh
    @echo "✅ DynamoDB Local ready on port 8000"

# Stop DynamoDB Local
db-down:
    docker compose down

# Run frontend dev server (Vite)
dev-frontend:
    cd frontend && npm run dev

# Run SAM local API (Lambda + API Gateway emulation)
dev-api:
    sam local start-api --docker-network focusforge-net --env-vars env.json --warm-containers EAGER

# Run both frontend and API (use two terminals, or run each separately)
dev:
    @echo "Run in separate terminals:"
    @echo "  just dev-frontend"
    @echo "  just dev-api"
    @echo ""
    @echo "Or: just dev-frontend & just dev-api"

# ─── Testing ──────────────────────────────────────────────────────────────────

# Check theme colours against WCAG 2.2 AA contrast minimums
test-contrast:
    cd frontend && node check-contrast.mjs

# Run axe-core accessibility audit against the built frontend
test-a11y:
    cd frontend && npm run build && npm run test:a11y

# Run frontend unit tests
test-frontend:
    cd frontend && npm test -- --run

# Run all tests
test: test-contrast test-a11y test-frontend test-audit

# Check for known vulnerabilities in dependencies
test-audit:
    cd frontend && npm audit --omit=dev
    cd functions/tasks && npm audit --omit=dev
    cd functions/forge-master && npm audit --omit=dev

# Scan for leaked secrets in source and git history
test-secrets:
    @echo "Running TruffleHog (git history)..."
    trufflehog git file://. --only-verified --fail
    @echo "Running Gitleaks (git history)..."
    gitleaks detect --source . --verbose
    @echo "Running detect-secrets (filesystem baseline)..."
    detect-secrets scan --all-files --exclude-files 'node_modules|\.aws-sam|dist' .
    @echo "✅ No secrets found"

# ─── Infrastructure Lifecycle ─────────────────────────────────────────────────

# First-time deploy (creates artifacts bucket + full stack)
bootstrap:
    #!/usr/bin/env bash
    set -euo pipefail
    ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
    BUCKET="focusforge-sam-artifacts-${ACCOUNT}"
    REGION="${AWS_REGION:-us-east-1}"
    # Create artifacts bucket if it doesn't exist
    if ! aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
      aws s3 mb "s3://$BUCKET" --region "$REGION"
      echo "✅ Created deployment bucket: $BUCKET"
    fi
    sam build
    sam deploy \
      --stack-name focusforge \
      --region "$REGION" \
      --capabilities CAPABILITY_IAM \
      --s3-bucket "$BUCKET" \
      --no-confirm-changeset \
      --parameter-overrides Stage=dev
    # Write samconfig.toml for subsequent deploys
    cat > samconfig.toml <<EOF
    version = 0.1

    [default.build.parameters]
    cached = true

    [default.deploy.parameters]
    stack_name = "focusforge"
    region = "$REGION"
    capabilities = "CAPABILITY_IAM"
    s3_bucket = "$BUCKET"
    confirm_changeset = false
    no_fail_on_empty_changeset = true
    parameter_overrides = "Stage=dev"
    EOF
    echo "✅ Stack deployed. samconfig.toml written."

# Deploy the stack (uses saved samconfig.toml)
infra-up:
    sam build
    sam deploy --capabilities CAPABILITY_IAM

# Show all resources in the deployed stack
infra-status:
    @bash scripts/infra-status.sh

# Test the deployed API with a real Cognito token
infra-test:
    @bash scripts/infra-test.sh

# Smoke-test the Forge Plan endpoint (brain-dump → ordered plan)
test-forge-plan:
    @bash scripts/test-forge-plan.sh

# Test the Forge Master rate limit (creates temp user, hits limit, verifies 429, cleans up)
test-rate-limit:
    #!/usr/bin/env bash
    set -euo pipefail
    REGION="${AWS_REGION:-us-east-1}"
    POOL_ID=$(aws cloudformation describe-stacks --stack-name focusforge \
      --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
      --output text --region "$REGION")
    CLIENT_ID=$(aws cloudformation describe-stacks --stack-name focusforge \
      --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' \
      --output text --region "$REGION")
    API_URL=$(aws cloudformation describe-stacks --stack-name focusforge \
      --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
      --output text --region "$REGION")
    TEST_EMAIL="ratelimit-test-$(date +%s)@test.local"
    # Ephemeral credential — user deleted at end of test
    # EFF Diceware (https://www.eff.org/dice)
    # CISA 16+ chars (https://www.cisa.gov/resources-tools/training/formulate-strong-passwords-and-pin-codes)
    # 6 words (~77.5 bits entropy) + 3 random specials injected by CSPRNG
    # No `-s` random specials: they can emit `"` or `\`, which break the JSON
    # auth-parameters built below. A digit + fixed safe symbols satisfy the
    # Cognito policy without risking quoting bugs.
    TEST_PASS="$(diceware -n 6)$((RANDOM % 10))-Aa"
    # Guarantee cleanup on any exit (success, failure, or signal)
    cleanup() {
      echo "── Cleaning up test user ──"
      aws cognito-idp admin-delete-user --user-pool-id "$POOL_ID" \
        --username "$TEST_EMAIL" --region "$REGION" 2>/dev/null || true
    }
    trap cleanup EXIT
    echo "── Creating temp user: $TEST_EMAIL ──"
    aws cognito-idp admin-create-user --user-pool-id "$POOL_ID" \
      --username "$TEST_EMAIL" \
      --user-attributes Name=email,Value="$TEST_EMAIL" Name=email_verified,Value=true \
      --region "$REGION" --no-cli-pager > /dev/null
    aws cognito-idp admin-set-user-password --user-pool-id "$POOL_ID" \
      --username "$TEST_EMAIL" --password "$TEST_PASS" --permanent --region "$REGION"
    # Build with jq rather than printf so any special characters are escaped.
    AUTH_PARAMS=$(jq -n --arg u "$TEST_EMAIL" --arg p "$TEST_PASS" \
      '{USERNAME: $u, PASSWORD: $p}')
    TOKEN=$(aws cognito-idp initiate-auth --client-id "$CLIENT_ID" \
      --auth-flow USER_PASSWORD_AUTH \
      --auth-parameters "$AUTH_PARAMS" \
      --region "$REGION" --query 'AuthenticationResult.AccessToken' --output text)
    # Create a task so forge has something to work with
    curl -s -X POST "$API_URL/tasks" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"title":"Rate limit test task"}' > /dev/null
    # Read the limit straight from the Lambda source so this test can't drift
    # out of sync with it (it previously hard-coded 5 and silently passed).
    LIMIT=$(grep -oP 'const DAILY_LIMIT = \K[0-9]+' functions/forge-master/index.ts)
    OVER=$((LIMIT + 1))
    echo "── Calling /forge $OVER times (limit is $LIMIT) ──"
    for i in $(seq 1 "$OVER"); do
      STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/forge" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json")
      echo "  Call $i: HTTP $STATUS"
      if [ "$i" -eq "$OVER" ] && [ "$STATUS" != "429" ]; then
        echo "  ❌ Expected 429 on call $OVER, got $STATUS"
        exit 1
      fi
    done
    echo "  ✅ Rate limit enforced (429 on call $OVER)"
    echo "✅ Rate limit test passed."

# Destroy the entire stack (removes all AWS resources)
infra-down:
    #!/usr/bin/env bash
    set -euo pipefail
    REGION="${AWS_REGION:-us-east-1}"
    # Empty frontend bucket first (CloudFormation can't delete non-empty buckets)
    FRONTEND_BUCKET=$(aws cloudformation describe-stacks --stack-name focusforge \
      --query 'Stacks[0].Outputs[?OutputKey==`FrontendBucketName`].OutputValue' \
      --output text --region "$REGION" 2>/dev/null || true)
    if [ -n "$FRONTEND_BUCKET" ] && [ "$FRONTEND_BUCKET" != "None" ]; then
      echo "Emptying frontend bucket..."
      aws s3 rm "s3://$FRONTEND_BUCKET" --recursive --region "$REGION"
    fi
    sam delete --no-prompts --region "$REGION"
    rm -f samconfig.toml frontend/.env
    echo "✅ Stack deleted"

# Verify no orphan resources remain
infra-verify:
    @bash scripts/infra-verify.sh

# Emergency teardown — no prompts, no confirmation, removes everything including logs
panic:
    #!/usr/bin/env bash
    set -euo pipefail
    ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
    BUCKET="focusforge-sam-artifacts-${ACCOUNT}"
    REGION="${AWS_REGION:-us-east-1}"
    # 1. Empty frontend bucket (CloudFormation can't delete non-empty buckets)
    FRONTEND_BUCKET=$(aws cloudformation describe-stacks --stack-name focusforge \
      --query 'Stacks[0].Outputs[?OutputKey==`FrontendBucketName`].OutputValue' \
      --output text --region "$REGION" 2>/dev/null || true)
    if [ -n "$FRONTEND_BUCKET" ] && [ "$FRONTEND_BUCKET" != "None" ]; then
      echo "Emptying frontend bucket..."
      aws s3 rm "s3://$FRONTEND_BUCKET" --recursive --region "$REGION" 2>/dev/null || true
    fi
    # 2. Delete the CloudFormation stack (all template.yaml resources)
    echo "Deleting stack..."
    sam delete --no-prompts --region "$REGION" 2>/dev/null || true
    # 3. Remove the SAM artifacts bucket
    echo "Removing artifacts bucket..."
    aws s3 rb "s3://$BUCKET" --force --region "$REGION" 2>/dev/null || true
    # 4. Delete CloudWatch log groups created by Lambda at runtime
    echo "Removing CloudWatch log groups..."
    for LOG_GROUP in $(aws logs describe-log-groups \
      --log-group-name-prefix "/aws/lambda/focusforge" \
      --query 'logGroups[].logGroupName' --output text --region "$REGION" 2>/dev/null); do
      aws logs delete-log-group --log-group-name "$LOG_GROUP" --region "$REGION" 2>/dev/null || true
    done
    # 5. Clean up local config
    rm -f samconfig.toml frontend/.env
    # 6. Verify nothing remains
    bash scripts/infra-verify.sh
    echo "🔥 Everything is gone. Zero AWS resources remain."

# ─── User Management (Cognito) ───────────────────────────────────────────────

# Create yourself as a user (admin-only signup)
create-user email:
    @bash scripts/create-user.sh {{email}}

# Set a permanent password for a user.
# Pass one explicitly, or omit it to generate a strong one and print it once.
set-password email password='':
    #!/usr/bin/env bash
    set -euo pipefail
    REGION="${AWS_REGION:-us-east-1}"
    POOL_ID=$(aws cloudformation describe-stacks --stack-name focusforge \
      --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
      --output text --region "$REGION")
    PASSWORD='{{password}}'
    GENERATED=0
    if [ -z "$PASSWORD" ]; then
      # EFF Diceware (https://www.eff.org/dice): 6 words (~77.5 bits entropy)
      # plus a digit and safe symbols. Satisfies the Cognito policy (12+ chars,
      # mixed case, number, symbol). Avoids diceware's `-s` random specials,
      # which can emit `"` or `\` and break JSON/shell quoting downstream.
      PASSWORD="$(diceware -n 6)$((RANDOM % 10))-Aa"
      GENERATED=1
    fi
    aws cognito-idp admin-set-user-password \
      --user-pool-id "$POOL_ID" \
      --username "{{email}}" \
      --password "$PASSWORD" \
      --permanent \
      --region "$REGION"
    echo "✅ Password set for {{email}}"
    if [ "$GENERATED" -eq 1 ]; then
      echo ""
      echo "   Generated password (save it in your password manager — not stored on disk):"
      echo ""
      echo "   $PASSWORD"
      echo ""
    fi

# Get a JWT token for API testing
get-token email:
    @bash scripts/get-token.sh {{email}}

# Clear the daily Forge Master rate limit for a user (for testing)
reset-forge-limit email:
    #!/usr/bin/env bash
    set -euo pipefail
    REGION="${AWS_REGION:-us-east-1}"
    POOL_ID=$(aws cloudformation describe-stacks --stack-name focusforge \
      --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
      --output text --region "$REGION")
    TABLE=$(aws cloudformation describe-stacks --stack-name focusforge \
      --query 'Stacks[0].Outputs[?OutputKey==`TasksTableName`].OutputValue' \
      --output text --region "$REGION")
    USER_SUB=$(aws cognito-idp admin-get-user --user-pool-id "$POOL_ID" \
      --username "{{email}}" --region "$REGION" \
      --query 'UserAttributes[?Name==`sub`].Value' --output text)
    TODAY=$(date +%Y-%m-%d)
    aws dynamodb delete-item --table-name "$TABLE" \
      --key "{\"userId\":{\"S\":\"$USER_SUB\"},\"taskId\":{\"S\":\"_ratelimit#forge#$TODAY\"}}" \
      --region "$REGION"
    echo "✅ Forge Master limit cleared for {{email}} (today: $TODAY)"

# Reset all data for a user (tasks, rate limits) — keeps Cognito account
reset-user-data email:
    #!/usr/bin/env bash
    set -euo pipefail
    REGION="${AWS_REGION:-us-east-1}"
    POOL_ID=$(aws cloudformation describe-stacks --stack-name focusforge \
      --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
      --output text --region "$REGION")
    TABLE=$(aws cloudformation describe-stacks --stack-name focusforge \
      --query 'Stacks[0].Outputs[?OutputKey==`TasksTableName`].OutputValue' \
      --output text --region "$REGION")
    USER_SUB=$(aws cognito-idp admin-get-user --user-pool-id "$POOL_ID" \
      --username "{{email}}" --region "$REGION" \
      --query 'UserAttributes[?Name==`sub`].Value' --output text)
    echo "Deleting all DynamoDB items for $USER_SUB..."
    ITEMS=$(aws dynamodb query --table-name "$TABLE" \
      --key-condition-expression "userId = :uid" \
      --expression-attribute-values "{\":uid\":{\"S\":\"$USER_SUB\"}}" \
      --projection-expression "userId, taskId" \
      --region "$REGION" --output json | jq -c '.Items[]')
    COUNT=0
    for ITEM in $ITEMS; do
      aws dynamodb delete-item --table-name "$TABLE" --key "$ITEM" --region "$REGION"
      COUNT=$((COUNT + 1))
    done
    echo "✅ Deleted $COUNT items for {{email}}. User starts fresh on next login."
    echo ""
    echo "To also reset progress (XP, streak, smithy), click the 🗑️ button in the app header."

# ─── Build & Package ─────────────────────────────────────────────────────────

# Regenerate root .env from stack outputs (non-secret config only)
sync-env:
    #!/usr/bin/env bash
    set -euo pipefail
    REGION="${AWS_REGION:-us-east-1}"
    STACK="${STACK_NAME:-focusforge}"
    OUTPUTS=$(aws cloudformation describe-stacks --stack-name "$STACK" \
      --query "Stacks[0].Outputs" --output json --region "$REGION")
    API_URL=$(echo "$OUTPUTS" | jq -r '.[] | select(.OutputKey=="ApiUrl") | .OutputValue')
    POOL_ID=$(echo "$OUTPUTS" | jq -r '.[] | select(.OutputKey=="UserPoolId") | .OutputValue')
    CLIENT_ID=$(echo "$OUTPUTS" | jq -r '.[] | select(.OutputKey=="UserPoolClientId") | .OutputValue')
    cat > .env <<EOF
    # AWS Region for deployment
    AWS_REGION=$REGION

    # Stack name (matches samconfig.toml)
    STACK_NAME=$STACK

    # Stage
    STAGE=dev

    # Stack outputs — regenerated by \`just sync-env\`. Non-secret: the client ID
    # and API URL also ship in the frontend bundle. Do not hand-edit; re-run sync.
    API_URL=$API_URL
    USER_POOL_ID=$POOL_ID
    USER_POOL_CLIENT_ID=$CLIENT_ID
    EOF
    echo "✅ .env regenerated from stack outputs"

# Build frontend for production
build-frontend:
    cd frontend && npm run build

# Deploy frontend to S3 + invalidate CloudFront cache
deploy-frontend:
    #!/usr/bin/env bash
    set -euo pipefail
    # Pull stack outputs into frontend env vars
    OUTPUTS=$(aws cloudformation describe-stacks --stack-name focusforge \
      --query "Stacks[0].Outputs" --output json --region us-east-1)
    API_URL=$(echo "$OUTPUTS" | jq -r '.[] | select(.OutputKey=="ApiUrl") | .OutputValue')
    CLIENT_ID=$(echo "$OUTPUTS" | jq -r '.[] | select(.OutputKey=="UserPoolClientId") | .OutputValue')
    BUCKET=$(echo "$OUTPUTS" | jq -r '.[] | select(.OutputKey=="FrontendBucketName") | .OutputValue')
    DIST_DOMAIN=$(echo "$OUTPUTS" | jq -r '.[] | select(.OutputKey=="FrontendUrl") | .OutputValue')
    DIST_ID=$(aws cloudfront list-distributions \
      --query "DistributionList.Items[?Origins.Items[0].DomainName=='${BUCKET}.s3.us-east-1.amazonaws.com'].Id" \
      --output text)
    # Write frontend .env from stack outputs
    cat > frontend/.env <<EOF
    VITE_API_URL=$API_URL
    VITE_AWS_REGION=us-east-1
    VITE_USER_POOL_CLIENT_ID=$CLIENT_ID
    EOF
    echo "✅ frontend/.env written from stack outputs"
    # Build and sync
    cd frontend && npm run build && cd ..
    aws s3 sync frontend/dist "s3://$BUCKET" --delete --region us-east-1
    # Invalidate CloudFront cache
    if [ -n "$DIST_ID" ]; then
      aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths "/*" > /dev/null
      echo "✅ CloudFront cache invalidated"
    fi
    echo "✅ Frontend deployed to $DIST_DOMAIN"

# Build SAM (compile Lambda functions)
build-sam:
    sam build

# Full build
build: build-frontend build-sam
