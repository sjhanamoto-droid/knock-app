#!/bin/bash
set -e

echo "=== Knock V2 Local Setup ==="
echo ""

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "ERROR: Node.js is required. Install via: brew install node"; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "ERROR: pnpm is required. Install via: npm install -g pnpm"; exit 1; }

# Check PostgreSQL
if pg_isready -q 2>/dev/null || /opt/homebrew/opt/postgresql@16/bin/pg_isready -q 2>/dev/null; then
  echo "PostgreSQL: Running"
else
  echo "WARNING: PostgreSQL may not be running. Start with: brew services start postgresql@16"
fi

echo ""

# Install dependencies
echo "[1/3] Installing dependencies..."
pnpm install

# Push schema & seed
echo "[2/3] Syncing database schema & seeding..."
pnpm db:push
pnpm db:seed

echo ""
echo "[3/3] Setup complete!"
echo ""
echo "Start the dev server:"
echo "  pnpm dev:user    (user app - http://localhost:3000)"
echo "  pnpm dev:admin   (admin app - http://localhost:3001)"
echo ""
echo "Test accounts:"
echo "  yamada@test.com / password123  (orderer)"
echo "  sato@test.com   / password123  (orderer)"
echo "  suzuki@test.com / password123  (contractor)"
echo "  tanaka@test.com / password123  (contractor)"
