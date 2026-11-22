# Cafe Lupe Centralized Sales Report & Transaction Gateway

A full-stack responsive web application for **Cafe Lupe** that centralizes transaction entry, real-time pricing, session countdown tracking, **QR Ph** payment validation, two-step **Down Payment** settlements, Accountant financial governance, and **server-side Gemini AI** financial auditing & bank reconciliation — backed by a normalized relational data model and Express API server.

---

## Key Features (Revision 002)

- **Single Unified Login & Role Routing**
  - Routes staff directly to their assigned portal based on credentials: **Front-Desk (Admin)**, **Accountant**, **Gym & Combat Training**, or **Restaurant / F&B POS**.
  - Supports new staff registration with email approval status lookup and Front-Desk account approval controls.
- **Two-Step Down Payment Billing & Mode Switching**
  - Both **Cash** and **QR Ph** `Down Payment` arrangements require explicit initial down-payment collection (`amountPaid = 0` initially), keeping the transaction `pending` with only the remaining balance left payable.
  - Cancelling or refusing an initial down payment immediately voids the transaction.
  - **Pay Balance** supports switching payment modes (`Cash` or `QR Ph`) independently of the initial payment mode, recorded per installment in `payment_installments` and displayed individually with explicit `transactionDateTime` inside the universal **Transaction Details** (`Eye` icon) modal across every interface.
- **Front-Desk Multi-Outlet Control & Timed Supervision**
  - Left-sidebar **Outlet Selector** (separated below `Outlets` with a horizontal divider) manages all **9 merged outlets** (`Pickleball Courts`, `Hostel`, `Swimming Pool`, `KTV Rooms`, `Billiards`, `Table Tennis`, `Parking Lot`, `Events & Location Rentals`).
  - **Timed Outlets** (`Pickleball`, `Billiards`, `Table Tennis`, `KTV Rooms`) feature live countdown timers, an early checkout **Stop** button, hour **Extensions**, and an **unavoidable blocking overlay** upon timer expiration requiring acknowledgment.
  - Front-Desk edit and void requests route cleanly to the **Accountant** for approval.
- **F&B POS Terminal & Revised SC/PWD Formula**
  - Strictly upfront **Full Payment** ordering across the full **Cafe Lupe Menu** and **Drinks** catalog with kitchen ticket printing.
  - Selecting **Yes** on the SC/PWD discount reveals **Total Pax** and **Number of Valid SC & PWD IDs**, applying `Discount = ((Total Bill / 1.12) / Total Pax × Valid IDs) × 0.20`.
- **Accountant Governance & 5 Server-Side Gemini AI Tools**
  - **Approvals Hub:** Migrated **Cash Payments to Confirm**, **Edit Requests** (including Front-Desk submissions), and **Void Requests** queues; direct Accountant edits apply immediately without secondary approval.
  - **Enhanced History:** Filter by `Cash` / `QR Ph` payment channels, multi-attribute search, and `Eye` details inspection on every row.
  - **AI Analytics & Auditing (`/api/ai/*` via Express + `@google/genai`):**
    1. **Daily Cash Deposit Validation:** Pick a date, upload a bank deposit slip image, extract JSON fields via AI OCR, and compare against daily Cash totals.
    2. **Financial Analysis Dashboard:** Interactive period/channel/outlet analytics with an AI executive brief and downloadable **PDF Financial Report** (`jsPDF`).
    3. **Forecasting:** Per-outlet proposed business action plans combining historical revenue and external weather/event context.
    4. **Decision Analysis System:** Interactive AI Business Advisor chat anchored to live metrics and forecasts.
    5. **Financial Reconciliation:** Per-outlet date-range reconciliation uploading bank statement images to flag `matched` vs. `conflict` entries.

---

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, Lucide React, `jsPDF`
- **Backend Proxy:** Node.js, Express 5 (`tsx server.ts`), `@google/genai` (`GEMINI_API_KEY` kept strictly server-side)
- **Persistence:** Normalized local relational store (`localStorage` + concurrency edit locks) paired with developer MySQL DDL & PHP PDO artifacts in `src/db/store.ts` (hidden from end-user UI)

---

## Default Login Credentials

| Portal / Role | Email | Password |
| :--- | :--- | :--- |
| **Front-Desk (Admin — All 9 Merged Outlets)** | `admin@cafelupe.com` | `password123` |
| **Accountant (Approvals + AI Suite)** | `accountant@cafelupe.com` | `password123` |
| **Gym & Combat Training** | `gym@cafelupe.com` | `password123` |
| **Restaurant / F&B POS** | `fnb@cafelupe.com` | `password123` |

*Sample pending staff registration: `trainee@cafelupe.com` / `password123`*

---

## Getting Started

### Prerequisites
- Node.js 20+
- npm
- `GEMINI_API_KEY` configured in your environment or `.env` (for Accountant AI features)

### Local Development

```bash
# 1. Install dependencies
npm install

# 2. Start the full-stack Express + Vite dev server (http://localhost:3000)
npm run dev
```

### Build & Type Check

```bash
# Type-check with TypeScript
npm run lint

# Build production bundle into dist/
npm run build

# Run production server
npm start
```

---

## Deploying to Vercel

This project pins `esbuild@0.28.0` in `devDependencies` for Vercel build compatibility (`npm run build`, output directory `dist`). When deploying full-stack `/api/ai/*` routes, configure `GEMINI_API_KEY` as a server environment variable.

---

## Project Structure

```text
server.ts                                  # Express server (port 3000) + Vite middleware + /api/ai/* Gemini proxy
src/
├── App.tsx                                # Role router and sidebar Front-Desk Outlet Selector
├── index.css                              # Tailwind CSS v4 setup & design tokens
├── utils/
│   └── pdfReport.ts                       # jsPDF downloadable Financial Analysis report generator
├── types/
│   └── index.ts                           # Master, outlet child table, installment, and AI audit interfaces
├── db/
│   ├── initialData.ts                     # Seed users, outlets, F&B menu catalog, and sample installments
│   └── store.ts                           # Relational store, two-step down payments, timers, locks, MySQL/PHP code
└── components/
    ├── auth/
    │   ├── LoginView.tsx                  # Unified sign-in, registration, and email approval lookup
    │   └── PendingApprovalView.tsx        # Pending account status screen
    ├── admin/
    │   └── AdminDashboard.tsx             # Front-Desk overview, sidebar Outlet Selector, Approvals, Outlets setup
    ├── accountant/
    │   ├── AccountantDashboard.tsx        # Summary, History (Cash/QRPh + search), Approvals, 5 AI sidebar routes
    │   └── AccountantAiViews.tsx          # Deposit Validation, Financial Analysis, Forecasting, Advisor, Recon
    ├── outlets/
    │   ├── OutletWorkspace.tsx            # Outlet dashboard, Stop timer, blocking expiry overlay, Pay Balance
    │   ├── OutletTransactionForm.tsx      # Outlet-specific transaction forms with real-time calculation
    │   └── PosTerminal.tsx                # F&B POS terminal (Full Payment, SC/PWD Pax & Valid ID formula)
    └── common/
        ├── SidebarShell.tsx               # Responsive desktop rail + mobile drawer with dividers
        ├── TransactionDetailsModal.tsx    # Universal Eye modal (date/time, split payment modes, child data)
        ├── PaymentWorkflowModals.tsx      # Initial Cash Down Payment notice/void & Pay Balance mode switcher
        ├── StatTile.tsx                   # KPI stat card
        ├── StatusChip.tsx                 # Paid / Pending / Void status badge
        ├── QrPhModal.tsx                  # Interactive QR Ph modal supporting two-step down payments & void
        ├── ReceiptModal.tsx               # Printable kitchen & order ticket modal
        └── ProfileModal.tsx               # Active user profile details
```
