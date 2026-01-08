#!/bin/bash
# API Test Harness - Run before any production deployment
# Usage: ./run-tests.sh [local|prod]

set -e

if [ "$1" = "prod" ]; then
  echo "Testing PRODUCTION: https://endpoint-weaver--rcxpysgzgc.replit.app"
  TEST_URL=https://endpoint-weaver--rcxpysgzgc.replit.app npx tsx tests/api-test-harness.ts
else
  echo "Testing LOCAL: http://localhost:5000"
  npx tsx tests/api-test-harness.ts
fi
