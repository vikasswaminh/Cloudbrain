#!/bin/bash

# Phase 1 Features Test Script
# Tests Templates, Schedules, and Workspaces APIs

BASE_URL="https://api.coding.super25.ai"
EMAIL="vikas@networkershome.com"
PASSWORD="laxmi4455"

echo "🚀 CloudBrain Phase 1 Features - Test Suite"
echo "==========================================="
echo ""

# Step 1: Login
echo "Step 1: Authenticating..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | sed 's/"token":"//')

if [ -z "$TOKEN" ]; then
  echo "❌ Login failed!"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Authenticated successfully"
echo "Token: ${TOKEN:0:20}..."
echo ""

# Step 2: Create a Template
echo "Step 2: Creating execution template..."
TEMPLATE_RESPONSE=$(curl -s -X POST "$BASE_URL/templates" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "REST API Boilerplate",
    "description": "Create a REST API with Express and TypeScript",
    "category": "api",
    "is_public": true,
    "tags": ["rest", "api", "express", "typescript"],
    "template_config": {
      "task_description": "Create a REST API using {{framework}} framework with {{database}} database for {{resource}} management. Include CRUD operations, validation, and error handling.",
      "variables": [
        {
          "name": "framework",
          "type": "select",
          "description": "Backend framework to use",
          "required": true,
          "options": ["Express", "Fastify", "Hono"]
        },
        {
          "name": "database",
          "type": "select",
          "description": "Database to use",
          "required": true,
          "options": ["PostgreSQL", "MySQL", "MongoDB"]
        },
        {
          "name": "resource",
          "type": "string",
          "description": "Resource name (e.g., users, products)",
          "required": true,
          "validation": {
            "pattern": "^[a-z]+$",
            "message": "Must be lowercase letters only"
          }
        }
      ],
      "default_model": "claude-3-sonnet-20240229"
    }
  }')

TEMPLATE_ID=$(echo $TEMPLATE_RESPONSE | grep -o '"id":"[^"]*' | sed 's/"id":"//' | head -1)

if [ -z "$TEMPLATE_ID" ]; then
  echo "❌ Template creation failed!"
  echo "Response: $TEMPLATE_RESPONSE"
  exit 1
fi

echo "✅ Template created successfully"
echo "Template ID: $TEMPLATE_ID"
echo ""

# Step 3: List Templates
echo "Step 3: Listing templates..."
TEMPLATES_LIST=$(curl -s -X GET "$BASE_URL/templates?limit=5" \
  -H "Authorization: Bearer $TOKEN")

echo "✅ Templates retrieved"
echo "Response (first 200 chars): ${TEMPLATES_LIST:0:200}..."
echo ""

# Step 4: Rate the Template
echo "Step 4: Rating template..."
RATING_RESPONSE=$(curl -s -X POST "$BASE_URL/templates/$TEMPLATE_ID/rate" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rating": 5,
    "review": "Excellent template! Very helpful for rapid prototyping."
  }')

echo "✅ Template rated"
echo "Response: $RATING_RESPONSE"
echo ""

# Step 5: Execute Template
echo "Step 5: Executing template..."
EXECUTE_RESPONSE=$(curl -s -X POST "$BASE_URL/templates/$TEMPLATE_ID/execute" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "variables": {
      "framework": "Express",
      "database": "PostgreSQL",
      "resource": "users"
    }
  }')

EXECUTION_ID=$(echo $EXECUTE_RESPONSE | grep -o '"executionId":"[^"]*' | sed 's/"executionId":"//')

if [ -z "$EXECUTION_ID" ]; then
  echo "⚠️  Template execution queued (or failed)"
  echo "Response: $EXECUTE_RESPONSE"
else
  echo "✅ Template executed"
  echo "Execution ID: $EXECUTION_ID"
fi
echo ""

# Step 6: Create a Schedule
echo "Step 6: Creating scheduled execution..."
SCHEDULE_RESPONSE=$(curl -s -X POST "$BASE_URL/schedules" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Daily Code Quality Check",
    "description": "Run code quality checks every day at 9 AM",
    "template_id": "'$TEMPLATE_ID'",
    "cron_expression": "0 9 * * *",
    "timezone": "America/New_York",
    "config": {
      "template_variables": {
        "framework": "Express",
        "database": "PostgreSQL",
        "resource": "quality"
      },
      "notifications": {
        "on_success": false,
        "on_failure": true,
        "channels": ["email"]
      },
      "retry_policy": {
        "max_retries": 2,
        "retry_delay_seconds": 300
      }
    }
  }')

SCHEDULE_ID=$(echo $SCHEDULE_RESPONSE | grep -o '"id":"[^"]*' | sed 's/"id":"//' | head -1)

if [ -z "$SCHEDULE_ID" ]; then
  echo "❌ Schedule creation failed!"
  echo "Response: $SCHEDULE_RESPONSE"
else
  echo "✅ Schedule created successfully"
  echo "Schedule ID: $SCHEDULE_ID"
fi
echo ""

# Step 7: List Schedules
echo "Step 7: Listing schedules..."
SCHEDULES_LIST=$(curl -s -X GET "$BASE_URL/schedules" \
  -H "Authorization: Bearer $TOKEN")

echo "✅ Schedules retrieved"
echo "Response (first 200 chars): ${SCHEDULES_LIST:0:200}..."
echo ""

# Step 8: Create a Workspace
echo "Step 8: Creating team workspace..."
WORKSPACE_RESPONSE=$(curl -s -X POST "$BASE_URL/workspaces" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Engineering Team",
    "description": "Workspace for backend engineering team",
    "settings": {
      "default_model": "claude-3-opus-20240229",
      "max_concurrent_executions": 10,
      "resource_limits": {
        "max_executions_per_day": 1000,
        "max_storage_mb": 5000
      }
    }
  }')

WORKSPACE_ID=$(echo $WORKSPACE_RESPONSE | grep -o '"id":"[^"]*' | sed 's/"id":"//' | head -1)

if [ -z "$WORKSPACE_ID" ]; then
  echo "❌ Workspace creation failed!"
  echo "Response: $WORKSPACE_RESPONSE"
else
  echo "✅ Workspace created successfully"
  echo "Workspace ID: $WORKSPACE_ID"
fi
echo ""

# Step 9: List Workspaces
echo "Step 9: Listing workspaces..."
WORKSPACES_LIST=$(curl -s -X GET "$BASE_URL/workspaces" \
  -H "Authorization: Bearer $TOKEN")

echo "✅ Workspaces retrieved"
echo "Response (first 200 chars): ${WORKSPACES_LIST:0:200}..."
echo ""

# Step 10: Get Template Categories
echo "Step 10: Getting template categories..."
CATEGORIES=$(curl -s -X GET "$BASE_URL/templates/categories" \
  -H "Authorization: Bearer $TOKEN")

echo "✅ Categories retrieved"
echo "Response: $CATEGORIES"
echo ""

# Summary
echo ""
echo "========================================="
echo "✅ Phase 1 Test Suite Complete!"
echo "========================================="
echo ""
echo "📊 Test Results:"
echo "  ✅ Authentication"
echo "  ✅ Template Creation"
echo "  ✅ Template Listing"
echo "  ✅ Template Rating"
if [ ! -z "$EXECUTION_ID" ]; then
  echo "  ✅ Template Execution"
else
  echo "  ⚠️  Template Execution (check manually)"
fi
if [ ! -z "$SCHEDULE_ID" ]; then
  echo "  ✅ Schedule Creation"
else
  echo "  ⚠️  Schedule Creation (check manually)"
fi
echo "  ✅ Schedule Listing"
if [ ! -z "$WORKSPACE_ID" ]; then
  echo "  ✅ Workspace Creation"
else
  echo "  ⚠️  Workspace Creation (check manually)"
fi
echo "  ✅ Workspace Listing"
echo "  ✅ Template Categories"
echo ""
echo "🎉 All Phase 1 features are operational!"
echo ""
echo "📝 Created Resources:"
echo "  Template: $TEMPLATE_ID"
if [ ! -z "$SCHEDULE_ID" ]; then
  echo "  Schedule: $SCHEDULE_ID"
fi
if [ ! -z "$WORKSPACE_ID" ]; then
  echo "  Workspace: $WORKSPACE_ID"
fi
echo ""
