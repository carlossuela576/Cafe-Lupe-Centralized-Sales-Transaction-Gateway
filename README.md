# Cafe Lupe Centralized Sales Report & Transaction Gateway

A responsive web application for **Cafe Lupe** that centralizes transaction entry, real-time pricing, session countdown tracking, **QR Ph** payment validation, **Cash** settlement confirmation, and cross-outlet financial reporting into a unified relational data model — complete with exportable **MySQL DDL** and **PHP PDO** gateway code.

---

## Key Features

- **Single Unified Login & Role Routing**
  - Routes staff directly to their assigned portal based on credentials: **Front-Desk (Admin)**, **Accountant**, **Gym & Combat Training**, or **Restaurant / F&B POS**.
  - Includes new staff registration with an approval status checker by email and Front-Desk account approval/rejection controls.
- **Front-Desk Multi-Outlet Control**
  - Front-Desk (Admin) manages all **9 merged outlets** (`Pickleball Courts`, `Hostel`, `Swimming Pool`, `KTV Rooms`, `Billiards`, `Table Tennis`, `Parking Lot`, `Events & Location Rentals`) directly via the persistent **Outlets** dropdown menu.
  - Full administrative privileges for account approvals, void/edit request decisions, cash deposit confirmations, direct transaction edits/deletions, and dynamic outlet/service management.
- **Outlet-Specific Forms & Real-Time Pricing**
  - **Billiards:** Place selector (`Without Aircon` ₱200/hr, `With Aircon` ₱400/hr), hours, and session countdown timer.
  - **Pickleball Courts:** Court (`Al Fresco` / `Indoor`), `150 × pax × hours` plus paddle (₱100) and ball (₱50) rentals, and countdown timer.
  - **Table Tennis:** Tables 1–3 at ₱250/hr with countdown timer.
  - **KTV Rooms:** Rooms 1–4, `Custom Hourly` (₱1,000/hr) or consumable packages (`KTV 1 & 2` +₱5,000, `KTV Suite 4` +₱15,000), hours, pax, and countdown timer.
  - **Hostel:** Room types (`2 Single Bed` ₱1,680, `Queen Size Bed` ₱2,800, `King Size Bed` ₱3,136, `Suite Room - Overlooking` ₱4,480), check-in/out night calculation (12% VAT-inclusive, no service charge), Agoda/Traveloka/Walk-in booking sources, and non-billable amenities log.
  - **Swimming Pool:** Walk-in rates (₱300 adult / ₱150 child) vs. complimentary Hotel Guest access.
  - **Parking Lot:** `Car`, `Van`, `Truck` (4 wheels · ₱50), `Motorcycle`, `Tricycle` (2 wheels · ₱30), `Others` (custom vehicle name & wheel count), Day/Night/Overnight type, and free checked-in guest tickets (`₱0.00`).
  - **Gym & Combat Training:** Cascaded selector covering Annual Membership (₱1,600), Monthly Packages (Unlimited ₱3,500, 12-Session Boxing ₱2,000, 12-Session Muay Thai ₱5,000), Per-Session Training (Boxing/Muay Thai across Member, Non-Member, Student rates), and Self-Train Sessions with inclusion summaries.
  - **Events & Location Rentals:** Venue packages, event dates, headcounts, and space reservations.
- **Live Session Timers, Extensions & Balance Settlement**
  - Live `HH:MM:SS` countdown timers in transaction tables and detail views for Billiards, Pickleball, Table Tennis, and KTV Rooms.
  - Expiry notification banner with **Acknowledge** and **Extend** actions (remembers hourly rate and recalculates payable balance).
  - **Pay Balance** workflow for pending/down-payment transactions supporting Cash confirmation (`Confirm Payment` / `Cancel`) and simulated **QR Ph** scanning.
- **F&B POS Terminal & Kitchen Tickets**
  - Dedicated POS ordering interface featuring the full **Cafe Lupe Menu** and **Drinks** catalog with category filters, inline option/variant selection, instant sync to the central database, and printable kitchen receipts.
- **Universal Discount & Payment Rules**
  - **Yes / No** 20% SC/PWD VAT-exempt discount calculation: `Final Price = (Selling Price ÷ 1.12) × 0.80`.
  - **Full Payment** and **Down Payment** arrangements with auto-calculated `balanceDue` and **Payment cash received by** staff tracking.
- **Accountant Analytics & Audit Controls**
  - Period-filtered sales dashboards (`day`, `week`, `month`, `year`), stacked paid/pending outlet charts, listed summaries, and admin-approved edit/void request workflows.
- **PHP & MySQL Code Generator**
  - Built-in **PHP / SQL Export** modal generating the normalized MySQL DDL (`transactions` master table + 10 `*_transactions` child tables) and PHP PDO service code.

---

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, Lucide React
- **State & Persistence:** Local relational store (`localStorage` persistence with concurrency edit locks) + exportable PHP 8+ / MySQL schema & PDO service

---

## Default Login Credentials

| Portal / Role | Email | Password |
| :--- | :--- | :--- |
| **Front-Desk (Admin — All 9 Merged Outlets)** | `admin@cafelupe.com` | `password123` |
| **Accountant** | `accountant@cafelupe.com` | `password123` |
| **Gym & Combat Training** | `gym@cafelupe.com` | `password123` |
| **Restaurant / F&B POS** | `fnb@cafelupe.com` | `password123` |

*Sample pending staff registration (for testing Front-Desk approvals): `trainee@cafelupe.com` / `password123`*

---

## Getting Started

### Prerequisites
- Node.js 20+ (or Bun)
- npm

### Local Development

```bash
# 1. Install dependencies
npm install

# 2. Start the development server (runs on http://localhost:3000)
npm run dev
```

### Build & Type Check

```bash
# Type-check with TypeScript
npm run lint

# Build production bundle into dist/
npm run build

# Preview production build locally
npm run preview
```

---

## Deploying to Vercel

This project is a Vite React single-page application ready for zero-config deployment on **Vercel**:

- **Framework Preset:** `Vite`
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Node / Tooling:** Configured with `esbuild@0.28.0` in `devDependencies` for Vercel build compatibility.

---

## Project Structure

```text
src/
├── App.tsx                                # Root router by role and Front-Desk outlet switcher
├── index.css                              # Tailwind CSS v4 setup & design tokens
├── types/
│   └── index.ts                           # Master, outlet child table, and workflow TypeScript interfaces
├── db/
│   ├── initialData.ts                     # Seed users, outlets, F&B menu catalog, and sample records
│   └── store.ts                           # Relational store, timers, locks, QR/Cash handlers, PHP/SQL exporter
└── components/
    ├── auth/
    │   ├── LoginView.tsx                  # Unified sign-in, registration, and email approval lookup
    │   └── PendingApprovalView.tsx        # Pending account status screen
    ├── admin/
    │   └── AdminDashboard.tsx             # Front-Desk overview, Outlets menu, Approvals, Requests, Outlets setup
    ├── accountant/
    │   └── AccountantDashboard.tsx        # Period sales charts, listed summaries, edit/void request flows
    ├── outlets/
    │   ├── OutletWorkspace.tsx            # Outlet dashboard, live timers, Pay Balance, Extend, details modal
    │   ├── OutletTransactionForm.tsx      # Outlet-specific transaction forms with real-time calculation
    │   └── PosTerminal.tsx                # F&B POS terminal with variant picker and kitchen receipt
    └── common/
        ├── SidebarShell.tsx               # Responsive desktop rail + mobile navigation drawer
        ├── StatTile.tsx                   # KPI stat card
        ├── StatusChip.tsx                 # Paid / Pending / Void status badge
        ├── QrPhModal.tsx                  # Interactive QR Ph payment validation prototype
        ├── ReceiptModal.tsx               # Printable kitchen & order ticket modal
        ├── ProfileModal.tsx               # Active user profile details
        └── PhpSqlExportModal.tsx          # Exportable MySQL DDL & PHP PDO code viewer
```
