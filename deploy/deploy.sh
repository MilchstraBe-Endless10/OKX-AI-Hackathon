#!/bin/bash
# SOPscape Production Deployment Script
# Usage: ./deploy/deploy.sh [staging|production]

set -e

ENVIRONMENT=${1:-production}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== SOPscape Deployment ==="
echo "Environment: $ENVIRONMENT"
echo "Project: $PROJECT_DIR"
echo ""

# Check prerequisites
echo "1. Checking prerequisites..."

if ! command -v node &> /dev/null; then
  echo "❌ Node.js not installed"
  exit 1
fi
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 24 ]; then
  echo "❌ Node.js version 24+ required (found $NODE_VERSION)"
  exit 1
fi
echo "✓ Node.js $(node -v)"

if ! command -v pnpm &> /dev/null; then
  echo "❌ pnpm not installed"
  exit 1
fi
echo "✓ pnpm $(pnpm -v)"

if [ ! -f "$PROJECT_DIR/.env" ]; then
  echo " .env file not found, copying from .env.example"
  cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env"
  echo "  Please edit .env with real values before proceeding"
fi

# Install dependencies
echo ""
echo "2. Installing dependencies..."
cd "$PROJECT_DIR"
pnpm install --frozen-lockfile
echo "✓ Dependencies installed"

# Build
echo ""
echo "3. Building project..."
pnpm build
echo "✓ Build complete"

# Run tests
echo ""
echo "4. Running tests..."
pnpm test:unit
pnpm test:fixtures
echo "✓ Tests passed"

# Security audit
echo ""
echo "5. Running security audit..."
pnpm audit --prod
echo "✓ Audit passed"

# PM2 deployment
if command -v pm2 &> /dev/null; then
  echo ""
  echo "6. Deploying with PM2..."
  cd "$PROJECT_DIR"
  pm2 stop sopscape-server || true
  pm2 delete sopscape-server || true
  pm2 start deploy/ecosystem.config.js
  pm2 save
  pm2 startup
  echo "✓ PM2 deployment complete"
else
  echo ""
  echo "⚠ PM2 not installed, skipping process management"
  echo "  Install: npm install -g pm2"
fi

# Health check
echo ""
echo "7. Health check..."
sleep 3
HEALTH=$(curl -s http://127.0.0.1:3000/health/live 2>/dev/null || echo "FAILED")
if [ "$HEALTH" = '{"status":"ok"}' ]; then
  echo "✓ Health check passed"
else
  echo "⚠ Health check failed: $HEALTH"
  echo "  Check logs: pm2 logs sopscape-server"
fi

echo ""
echo "=== Deployment Complete ==="
echo "Server: http://127.0.0.1:3000"
echo "Logs: pm2 logs sopscape-server"
echo ""
echo "Next steps:"
echo "1. Configure Nginx: sudo cp deploy/nginx.conf /etc/nginx/sites-available/sopscape"
echo "2. Enable site: sudo ln -s /etc/nginx/sites-available/sopscape /etc/nginx/sites-enabled/"
echo "3. Get SSL cert: sudo certbot --nginx -d your-domain.com"
echo "4. Update firewall: sudo ufw allow 443/tcp"
echo "5. Restart Nginx: sudo systemctl restart nginx"
