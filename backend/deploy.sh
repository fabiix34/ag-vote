#!/bin/bash

# Nom du service et région
SERVICE_NAME="ag-copro-api"
REGION="europe-west1"
GCP_PROJECT_ID="api-ag-copro"

SUPABASE_URL="https://sbowyzpkqptlzqwkowlr.supabase.co"
SUPABASE_ANON="sb_publishable_EC2Opi85XbcrGBbXKugCzg_iHLbwC5B"
SUPABASE_SERVICE="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNib3d5enBrcXB0bHpxd2tvd2xyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM3NDg2NywiZXhwIjoyMDg5OTUwODY3fQ.vzcMCn6RGc8W6LB_xBX4iNFNUc4ma9iLM7WlHpTR3K4"
CORS="https://syndic.api-works.com,https://copro.api-works.com"


echo "Déploiement de $SERVICE_NAME vers Cloud Run..."

# Utilisation de l'argument flag pour dire à gcloud que les virgules 
# à l'intérieur des valeurs sont protégées ou changer le séparateur
gcloud run deploy $SERVICE_NAME \
  --source . \
  --project $GCP_PROJECT_ID \
  --region $REGION \
  --allow-unauthenticated \
  --set-env-vars="^|^NODE_ENV=production|SUPABASE_URL=$SUPABASE_URL|SUPABASE_ANON_KEY=$SUPABASE_ANON|SUPABASE_SERVICE_KEY=$SUPABASE_SERVICE|CORS_ORIGINS=$CORS"