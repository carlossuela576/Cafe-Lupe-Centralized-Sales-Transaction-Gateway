# Project Specification: Cafe Lupe Centralized Sales Report and Transaction Gateway System

> **AI AGENT DIRECTIVES (READ FIRST)**

> **Single Source of Truth:** This document (`SPEC.md`) is the canonical state of the project. Do not deviate from the architecture, tech stack, or conventions defined here without explicit user approval.

> **Coupling and Context Reliance:** During planning, ensure to work alongside **requirements.md** for full project context and requirement knowledge, **design-requirements.md** for design requirements and standards.
---

## Project Overview & Goals
* **Project Name:** `Cafe Lupe Centralized Sales Report and Transaction Gateway System`
* **One-Line Pitch:** `Create an accessible Web Application that creates transactions, record transactions, and validates online transactions (via QrPh API), cash transactions via admin request and approval. This system enables Cafe Lupe to have a systemized Transaction System with Sales Tracking, Report, and Analysis.`
* **Core Value Proposition:** `This project aims to solve the rigorous and vague sale system of various service outlet of Cafe Lupe by creating a centralized system that stores and manages all service transaction from different service outlets.`
* **Target Audience / Personas:**
  * **[Staff]:** `Manages Incoming customers by creating and managing their payment transactions. Staffs have different duties on different service outlets within Cafe Lupe.`
  * **[Admin]:** `Manages the entire system, approving account creations (for new staffs), and approving deletion or modification of transaaction history.`
  * **[Accountant]:** `Ensures that financial statements remain balanced by reconciliating historical transactions and bank statements.`
  * **[Customers]:** `Are the people that Cafe Lupe Staff's cater, guide, and provide services into.`

### Scope Boundaries
* **In Scope (MVP):**
  *   * `Different user accounts and people must be able to log-in within a single log-in interface and be directed into their own interfaces via their log-in credentials`
  * `Staffs must be able to create their own accounts to be approved by the admin.`
  * `Staff must be able to create new transactions and provide prior informations to the dedicated input fields.`
  * `Must be able to view transactional history after every successfull transaction.`
  * `Separate POS interface for Food and Beverages`
* **Out of Scope (Non-Goals for now):**
  * `Financial Management and financial balancing`

---

## Tech Stack & Environment
*Strict adherence is required. Do not install alternative packages for these core functions without asking.*

* **Language / Backend:** `PHP (latest version)`
* **Styling & UI:** `Vanilla HTML / CSS`
* **Database:** `MySQL / PHPMysql / PHPMyAdmin`
* **Runtime:** `localhost XAMPP`

---

## System Architecture & Directory Structure

### High-Level Architecture
`Vanilla HTML / CSS handles ffront-end object, styling -> PHP handles all back-end logics -> Mysql stores all values (transactions and accounts)`

---

## 4. Data Models & Database Schema
*Update this section whenever a migration or schema change occurs. (Per R3, R4, NFR7-NFR9.)*

### Core Tables
```text
users                (id, name, email, password, role[staff|admin|accountant|owner], outlet_id NULL,
                      approval_status[pending|approved|rejected], created_at)
outlets              (id, name, slug, template NULL, is_active)        -- admin can add dynamically (FR88); custom outlets reuse a template's table
services             (id, outlet_id, name, default_price, preset_fields JSON, category NULL, is_active)  -- dropdown presets; category set = POS menu item
transactions         (transactionID PK, outletName, outletService, customerName, employeeHandler,
                      transactionAmount, transactionStatus[pending|paid|void], transactionDateTime,
                      paymentArrangement, paymentChannel, discount, totalAmount,
                      outlet_ref_table, outlet_ref_id, qr_token NULL, paid_at NULL, locked_by NULL, locked_at NULL, version)
                      -- NFR9: the one table pointing at every outlet table (unfiltered history)
void_requests        (id, transaction_id, requested_by, reason, note, status[pending|approved|rejected], decided_by, decided_at)
edit_requests        (id, transaction_id, requested_by, changes JSON, note, status, decided_by, decided_at)  -- accountant FR92
cash_confirmations   (id, transaction_id UNIQUE, approved_by NULL, approved_at NULL)    -- FR83: a row exists for every paid cash sale until the admin confirms
```

### Outlet-Specific Tables (one each, own primary key)
```text
pickleball_transactions (pickleballID PK, transaction_id FK, court[al_fresco|indoor], pax, hours, paddle_rent, ball_rent)
hostel_transactions     (hostelID PK, transaction_id FK, room_type[small|suite], booking_source[walk_in|agoda|traveloka], check_in, check_out)
gym_transactions        (gymID PK, transaction_id FK, age, membership_start, membership_type, plan[monthly|walk_in|student|unlimited_1m|bundle_12_15|free_trial], trainer_program)
pool_transactions       (poolID PK, transaction_id FK, adults, children, is_hostel_guest)
generic_transactions    (genericID PK, transaction_id FK, notes)   -- template for outlets added "from scratch"
ktv_transactions        (ktvID PK, transaction_id FK, room[small_a|small_b|large], pax, package)
fnb_transactions        (fnbID PK, transaction_id FK, audited_to[walk_in|function|ktv], order_items JSON, receipt_printed_at)
billiards_transactions  (billiardsID PK, transaction_id FK, table_no, hours)
tabletennis_transactions(tabletennisID PK, transaction_id FK, table_no, hours)
parking_transactions    (parkingID PK, transaction_id FK, plate_number, vehicle_type, parking_type[day|night|overnight])
events_transactions     (eventsID PK, transaction_id FK, event_type, event_date, headcount)
```

---

## Core Features 

### Single login and role redirect (FR1-FR5)
* **Description:** One login form; middleware redirects by role/outlet; new accounts start `pending` until admin approval.
* **Acceptance Criteria:**
  * [ ] Approved user is redirected to their own outlet interface.
  * [ ] Pending/rejected user sees an approval-status screen and cannot enter.
  * [ ] Profile page and logout work for every role.

### Create / edit / view transaction (shared across outlets)
* **Description:** Create CTA first, then outlet-specific form with preset-service dropdown that auto-fills fields; datetime auto-generated; paid -> resolved, unpaid -> pending (editable).
* **Contract:** `TransactionService::create(Outlet $outlet, array $data): Result` returns `{ data: Transaction|null, error: {code, message}|null }`
* **Auth Requirement:** Authenticated, approved, and assigned to that outlet (admin may switch outlets, FR84).

### Payment, void and approval rules
* Cash + upfront (or a zero total) saves as `paid` immediately and creates a `cash_confirmations` row for the admin (FR83). QR Ph + upfront saves `pending`; the QR screen polls and flips to `paid` when the token is validated (simulated scan, NFR2). Pay later saves `pending` and stays editable (FR9).
* Clerks and accountants never delete: they create `void_requests`; the admin approves, which sets status `void` (row kept). Admin deletes directly (FR87). Accountant edit requests change only `transactionStatus` or `transactionAmount` and apply on admin approval (FR92, FR93).
* Concurrency: DB transactions, `lockForUpdate`, 120 s edit lock with heartbeat, `version` check, DB-generated ids (NFR4 to NFR6).
* Contract: every service method returns `Result { data, error{code,message} }`.

### Feature 5.4: Outlets, POS, summaries
* POS orders are transactions with `order_items` and a printable kitchen receipt (FR94 to FR96). Accountant summary groups paid and pending totals by outlet for day, week, month or year (FR91). Admin can simulate any outlet (FR84), approve accounts (FR81) and add outlets and services (FR88).

---

## UI/UX, Coding Standards & Guardrails

### Code Style & Conventions
* **Files:** `PascalCase.php` classes, `camelCase` methods and variables.
* **Clean code (requirements.md):** object-oriented, small single-purpose classes, controllers/components stay thin, early returns instead of nested conditionals.

### Error Handling & Logging
* Never swallow exceptions silently. Log with context.
* Services return a standardized result object: `{ data: T|null, error: { code: string, message: string }|null }`.
* Show friendly toast/flash feedback for every mutation.

### UI/UX & Accessibility
* Interactive elements are keyboard reachable with visible focus rings and ARIA labels; touch targets at least 44px.
* Every async action shows a pending state (`wire:loading`, disabled button + spinner).
* Empty states for every list/table.
* **Design standards:** follow `figma-handoff.md` (60-30-10 with #F7F7F7 / #FFE27A / #FF5252, iOS-style, no violet, one button pair, one card style, one radius scale). Text on #FF5252 or #FFE27A uses dark ink `#1A1A1A` (white on #FF5252 is about 3.2:1 and fails WCAG AA).
* **Mobile baseline:** `viewport-fit=cover`, safe-area insets, `100dvh` shells, 16px minimum inputs, hover styles only inside `@media (hover: hover) and (pointer: fine)`, `:active` press feedback, `prefers-reduced-motion` respected.
* **Stress test:** run worst-case data (long names, empty lists, large totals) before marking a screen done.