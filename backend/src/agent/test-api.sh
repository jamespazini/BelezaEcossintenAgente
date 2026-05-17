#!/bin/bash
# 🧠 Agent API Testing Script
# Usage: bash backend/src/agent/test-api.sh

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="http://localhost:3000"
AUTH_TOKEN="YOUR_JWT_TOKEN_HERE"
ESTABLISHMENT_ID="550e8400-e29b-41d4-a716-446655440000"

echo -e "${BLUE}🧠 Beleza Ecosystem - Agent API Tests${NC}\n"

# Test 1: Get Info
echo -e "${BLUE}[TEST 1] GET /api/ia - Informações do Agente${NC}"
curl -X GET \
  "$BASE_URL/api/ia" \
  -H "Content-Type: application/json" \
  -w "\nStatus: %{http_code}\n\n"

# Test 2: Health Check
echo -e "${BLUE}[TEST 2] GET /api/ia/health - Status da IA${NC}"
curl -X GET \
  "$BASE_URL/api/ia/health" \
  -H "Content-Type: application/json" \
  -w "\nStatus: %{http_code}\n\n"

# Test 3: Send Message
echo -e "${BLUE}[TEST 3] POST /api/ia - Aumentar Faturamento${NC}"
curl -X POST \
  "$BASE_URL/api/ia" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{
    "message": "Como eu aumento meu faturamento em 30%?",
    "establishmentId": "'$ESTABLISHMENT_ID'"
  }' \
  -w "\nStatus: %{http_code}\n\n"

# Test 4: Create Appointment
echo -e "${BLUE}[TEST 4] POST /api/ia - Criar Agendamento${NC}"
curl -X POST \
  "$BASE_URL/api/ia" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{
    "message": "Agende uma consulta para João Silva em 2026-05-10 às 14:00",
    "establishmentId": "'$ESTABLISHMENT_ID'"
  }' \
  -w "\nStatus: %{http_code}\n\n"

# Test 5: Generate Report
echo -e "${BLUE}[TEST 5] POST /api/ia - Gerar Relatório${NC}"
curl -X POST \
  "$BASE_URL/api/ia" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{
    "message": "Preciso de um relatório dos últimos 30 dias de vendas",
    "establishmentId": "'$ESTABLISHMENT_ID'"
  }' \
  -w "\nStatus: %{http_code}\n\n"

echo -e "${GREEN}✅ Testes concluídos!${NC}\n"
echo -e "${RED}⚠️  Nota: Substitua YOUR_JWT_TOKEN_HERE por um token real${NC}"
