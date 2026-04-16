# Knock V2 - Local Development Setup

## Prerequisites

- Node.js 20+
- pnpm (`npm install -g pnpm`)
- PostgreSQL 16 (`brew install postgresql@16 && brew services start postgresql@16`)
- DB作成: `createdb knock` (初回のみ)

## Quick Start (3 steps)

```bash
pnpm install
pnpm db:push && pnpm db:seed
pnpm dev:user
```

Or use the setup script:

```bash
bash scripts/setup-local.sh
pnpm dev:user
```

Open http://localhost:3000

## Test Accounts

| Role | Email | Password | Company |
|------|-------|----------|---------|
| Orderer | yamada@test.com | password123 | Yamada Kensetsu |
| Orderer | sato@test.com | password123 | Sato Koumuten |
| Contractor | suzuki@test.com | password123 | Suzuki Denki |
| Contractor | tanaka@test.com | password123 | Tanaka Tosou |

## Sample Data

Seed creates:
- 4 companies (2 orderers, 2 contractors) with subscriptions (TRIAL)
- 2 factory floors (IN_PROGRESS, ORDER_REQUESTED)
- 2 orders (CONFIRMED, PENDING)
- 2 documents (ORDER_SHEET, DELIVERY_NOTE)
- 1 chat room with 3 messages (Yamada <-> Suzuki)
- 2 published job postings (with lat/lng for map search)
- 1 completion report

## Feature Testing Guide

### Login
1. Go to http://localhost:3000
2. Enter `yamada@test.com` / `password123`
3. You should see the home screen as orderer (blue accent)

### Chat
1. Login as yamada@test.com -> navigate to chat
2. Open the existing chat room with Suzuki Denki
3. You should see 3 sample messages

### Documents
1. Login as suzuki@test.com (contractor)
2. Navigate to documents page
3. You should see ORDER_SHEET and DELIVERY_NOTE
4. Invoice candidates section should show 1 candidate for March 2026

### Job Search (Map)
1. Navigate to the search page
2. 2 published jobs should appear (Shinjuku, Shibuya)
3. If NEXT_PUBLIC_MAPBOX_TOKEN is set, jobs appear on the map

### Mode Switching
- Login as yamada@test.com -> orderer mode (blue accent)
- Login as suzuki@test.com -> contractor mode (orange accent)

## Environment Variables

### apps/user/.env
```
DATABASE_URL="postgresql://<user>@localhost:5432/knock?schema=public&connection_limit=20&pool_timeout=10"
AUTH_SECRET="local-development-secret-key-32chars!"
AUTH_URL="http://localhost:3000"
DEFAULT_ADMIN_COMPANY_ID="cmmc0eyld0000c9ozfkn3v26y"
```

### packages/db/.env
```
DATABASE_URL="postgresql://<user>@localhost:5432/knock?schema=public"
```

## Troubleshooting

### ERR_CONNECTION_REFUSED
Dev server is not running. Run `pnpm dev:user`.

### "relation does not exist"
Tables not created. Run `pnpm db:push`.

### Login fails
Seed data may not be inserted. Run `pnpm db:seed`.

### PostgreSQL not running
```bash
brew services start postgresql@16
```

### Reset everything
```bash
dropdb knock && createdb knock
pnpm db:push && pnpm db:seed
```

## Dev Commands

| Command | Description |
|---------|-------------|
| `pnpm dev:user` | Start user app (port 3000) |
| `pnpm dev:admin` | Start admin app (port 3001) |
| `pnpm db:push` | Sync Prisma schema to DB |
| `pnpm db:seed` | Seed master + test data |
| `pnpm build` | Build all packages |
