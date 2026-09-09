# QR Restaurant Ordering System — Starter

## What's included
- **backend/** — Express + PostgreSQL + Socket.IO API
  - `schema.sql` — full database schema
  - `routes/menu.js` — menu CRUD + availability toggle
  - `routes/tables.js` — table creation, QR generation, staff-call
  - `routes/orders.js` — order placement, kitchen order feed, status updates
  - `server.js` — entry point
- **frontend/src/**
  - `pages/CustomerMenu.jsx` — the QR-linked customer ordering screen
  - `pages/KitchenDashboard.jsx` — live kitchen order feed
  - `api.js` — fetch helpers for both

## Setup

### 1. Database
```bash
createdb qr_restaurant
psql qr_restaurant < backend/schema.sql
```

### 2. Backend
```bash
cd backend
npm install
# create a .env with DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, PORT, APP_URL
npm run dev
```

### 3. Frontend
This assumes a Vite + React app. If starting fresh:
```bash
npm create vite@latest frontend -- --template react
```
Then drop in the `src/pages` and `src/api.js` files from this project, and:
```bash
cd frontend
npm install socket.io-client
npm run dev
```

### 4. Wire up routing
`CustomerMenu` expects `restaurantId` and `tableId` props — pull these from the URL
(e.g. `/r/:restaurantId/t/:tableId` using React Router) since that's what the
QR code encodes.

## Not yet built (next steps)
- Admin panel for adding/editing menu items and generating table QR codes (the routes exist — just needs a UI)
- Auth for restaurant admins and kitchen staff
- Payment integration (currently orders are placed with no payment step)
- Order history / analytics for the restaurant owner
