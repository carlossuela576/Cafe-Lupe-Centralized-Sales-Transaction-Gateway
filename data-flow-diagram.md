# Cafe Lupe Centralized Sales Report & Transaction Gateway — Data Flow Diagram (DFD)

This document defines the **Level 0 (Context)**, **Level 1 (System Overview)**, and **Level 2 (Sub-Process)** Data Flow Diagrams for the **Cafe Lupe Centralized Sales Report and Transaction Gateway System** (Revision 002), mapped directly to the implemented React client, `CafeLupeStore` relational engine (`src/db/store.ts`), and Express Gemini AI proxy (`server.ts`).

---

## Legend

- **Rectangle `[Entity]`**: External Entity (human actor or external system)
- **Rounded Pill / Circle `((Process))`**: System Process (`1.0` – `6.0`)
- **Cylinder `[(Data Store)]`**: Persistent Data Store (`D1` – `D7`, backed by `localStorage` under `cafelupe_v3_rev002_` / target MySQL schema)
- **Arrow `-->|data flow|`**: Directed movement of data between entities, processes, and stores

---

## 1. Level 0 — Context Diagram

Shows the system boundary and all data exchanged with external actors and third-party services.

```mermaid
flowchart LR
    %% Styling
    classDef entity fill:#FEF9C3,stroke:#CA8A04,stroke-width:2px,color:#111827
    classDef extSys fill:#E0F2FE,stroke:#0284C7,stroke-width:2px,color:#0F172A
    classDef sys fill:#1A1A1A,stroke:#FFE27A,stroke-width:3px,color:#FFFFFF

    FD["Front-Desk (Admin)<br/>9 Merged Outlets"]:::entity
    GYM["Gym Staff"]:::entity
    FNB["F&B POS Staff"]:::entity
    ACC["Accountant"]:::entity
    CUST["Customer /<br/>QR Ph Payer"]:::entity
    GEMINI["Google Gemini API<br/>(gemini-4-hydrogen)"]:::extSys

    SYS(("0.0<br/>Cafe Lupe Centralized<br/>Sales Report &<br/>Transaction Gateway")):::sys

    %% Front-Desk flows
    FD -->|Login creds, outlet/service defs,<br/>user approvals, outlet transactions,<br/>timer actions, edit & void requests| SYS
    SYS -->|Portal UI, live timers, expiry alerts,<br/>master & outlet ledgers, receipts| FD

    %% Gym Staff flows
    GYM -->|Login/signup, gym member & session tx,<br/>payment updates, void requests| SYS
    SYS -->|Gym workspace, payment status,<br/>QR Ph tokens, void statuses| GYM

    %% F&B POS Staff flows
    FNB -->|Login/signup, F&B POS orders,<br/>SC/PWD Pax & ID counts, void requests| SYS
    SYS -->|POS catalog, discount totals,<br/>kitchen order tickets| FNB

    %% Accountant flows
    ACC -->|Login/signup, period/channel filters,<br/>cash/edit/void decisions, direct edits,<br/>deposit slips, bank statements, advisor prompts| SYS
    SYS -->|Sales summaries, approval queues,<br/>AI audit & recon results, advisor replies,<br/>PDF financial reports| ACC

    %% Customer / QR Ph flows
    CUST -->|QR Ph scan confirmation,<br/>cash/digital payment| SYS
    SYS -->|Generated QR Ph token,<br/>payment receipt| CUST

    %% Gemini API flows
    SYS -->|Base64 slip/statement images,<br/>financial snapshots, forecast context,<br/>advisor chat prompts| GEMINI
    GEMINI -->|Structured OCR JSON, executive briefs,<br/>outlet action plans, recon comparisons,<br/>advisor text replies| SYS
```

---

## 2. Level 1 — Core System Data Flow Diagram

Decomposes the gateway into six primary processes and seven normalized data stores.

```mermaid
flowchart TB
    classDef entity fill:#FEF9C3,stroke:#CA8A04,stroke-width:2px,color:#111827
    classDef extSys fill:#E0F2FE,stroke:#0284C7,stroke-width:2px,color:#0F172A
    classDef proc fill:#FFFFFF,stroke:#1A1A1A,stroke-width:2px,color:#1A1A1A
    classDef store fill:#F3F4F6,stroke:#4B5563,stroke-width:1.5px,color:#111827

    %% External Entities
    FD["Front-Desk (Admin)"]:::entity
    STAFF["Gym & F&B POS Staff"]:::entity
    ACC["Accountant"]:::entity
    CUST["Customer / QR Ph"]:::entity
    GEMINI["Google Gemini API"]:::extSys

    %% Processes
    P1(("1.0<br/>Auth, Registration &<br/>Role Routing")):::proc
    P2(("2.0<br/>Outlet Transaction &<br/>F&B POS Entry")):::proc
    P3(("3.0<br/>Payment Settlement,<br/>Installments & QR Ph")):::proc
    P4(("4.0<br/>Timed Sessions &<br/>Edit Concurrency Locks")):::proc
    P5(("5.0<br/>Accountant Governance<br/>& Approvals")):::proc
    P6(("6.0<br/>Reporting, AI Auditing &<br/>Bank Reconciliation")):::proc

    %% Data Stores
    D1[("D1: users")]:::store
    D2[("D2: outlets &<br/>services")]:::store
    D3[("D3: transactions<br/>(Master Ledger)")]:::store
    D4[("D4: *_transactions<br/>(11 Outlet Child Tables)")]:::store
    D5[("D5: payment_<br/>installments")]:::store
    D6[("D6: cash_confirmations,<br/>edit_requests &<br/>void_requests")]:::store
    D7[("D7: ai_audit_logs &<br/>reconciliation_batches")]:::store

    %% 1.0 Auth & Setup
    FD -->|Credentials & user<br/>approval decisions| P1
    STAFF -->|Credentials &<br/>signup request| P1
    ACC -->|Credentials &<br/>signup request| P1
    P1 <-->|Verify credentials,<br/>read/write approvalStatus| D1
    P1 -->|Portal route & session| FD
    P1 -->|Portal route & session| STAFF
    P1 -->|Portal route & session| ACC

    %% 2.0 Outlet & POS Entry
    FD -->|New outlet/service<br/>& outlet tx inputs| P2
    STAFF -->|Gym tx / F&B POS order<br/>& SC/PWD Pax/IDs| P2
    P2 <-->|Read presets /<br/>save dynamic outlets| D2
    P2 -->|Insert Master record| D3
    P2 -->|Insert outlet-specific<br/>child record| D4
    P2 -->|Printable kitchen /<br/>order receipt| STAFF
    P2 -->|New tx & payment mode| P3

    %% 3.0 Payment & Installments
    CUST -->|QR Ph scan /<br/>Cash payment| P3
    FD -->|Confirm initial down /<br/>pay balance| P3
    STAFF -->|Confirm initial down /<br/>pay balance| P3
    P3 <-->|Create/confirm/void<br/>initial & balance phases| D5
    P3 <-->|Update amountPaid, balanceDue,<br/>status, qrToken, paidAt| D3
    P3 -->|Queue Cash audit item| D6

    %% 4.0 Timers & Locks
    FD -->|Start/Stop/Extend timer,<br/>acknowledge expiry, edit lock| P4
    STAFF -->|Acquire/release 120s<br/>pending edit lock| P4
    P4 <-->|Read/update timerEndsAt,<br/>lockedBy, hours, balanceDue| D3
    P4 -->|Increment booked hours| D4

    %% 5.0 Governance & Approvals
    FD -->|Submit Edit / Void requests| P5
    STAFF -->|Submit Void requests /<br/>update pending tx| P5
    ACC -->|Approve/reject Cash, Edit, Void;<br/>or Direct Edit| P5
    P5 <-->|Read/write queues &<br/>decision metadata| D6
    P5 <-->|Apply approved edits/voids<br/>or direct updates| D3

    %% 6.0 Analytics, AI & PDF
    ACC -->|Period/channel filters,<br/>deposit slip & statement images,<br/>forecast & advisor queries| P6
    D3 -->|Master sales & cash totals| P6
    D5 -->|Confirmed Cash installments| P6
    D2 -->|Active outlets list| P6
    P6 <-->|Read/persist AI logs &<br/>recon batches| D7
    P6 -->|HTTPS /api/ai/*<br/>image & JSON payload| GEMINI
    GEMINI -->|Structured JSON &<br/>advisory reply| P6
    P6 -->|Dashboards, recon flags,<br/>PDF Financial Report| ACC
```

---

## 3. Level 2A — Transaction Creation, Split-Payment & QR Ph Settlement Flow

Details how processes `2.0` and `3.0` handle pricing, SC/PWD discounts, normalized child inserts, and Revision 002 two-step Down Payment vs. Full Payment settlements.

```mermaid
flowchart TD
    classDef entity fill:#FEF9C3,stroke:#CA8A04,stroke-width:2px,color:#111827
    classDef proc fill:#FFFFFF,stroke:#1A1A1A,stroke-width:2px,color:#1A1A1A
    classDef store fill:#F3F4F6,stroke:#4B5563,stroke-width:1.5px,color:#111827

    CLERK["Front-Desk / Gym /<br/>F&B POS Clerk"]:::entity
    PAYER["Customer / QR Ph App"]:::entity

    P2_1(("2.1<br/>Compute Gross Total<br/>& SC/PWD Discount")):::proc
    P2_2(("2.2<br/>Write Master &<br/>Child Records")):::proc
    P3_1(("3.1<br/>Full Payment<br/>Settlement")):::proc
    P3_2(("3.2<br/>Two-Step Down Payment<br/>& Balance Switcher")):::proc
    P3_3(("3.3<br/>QR Ph Prototype<br/>Validation")):::proc

    D2[("D2: services")]:::store
    D3[("D3: transactions")]:::store
    D4[("D4: *_transactions")]:::store
    D5[("D5: payment_installments")]:::store
    D6[("D6: cash_confirmations")]:::store

    CLERK -->|Outlet inputs / POS cart,<br/>SC/PWD flag, Pax & Valid IDs| P2_1
    D2 -->|Preset prices| P2_1
    P2_1 -->|Standard: (Price/1.12)*0.80<br/>F&B: ((Bill/1.12)/Pax*IDs)*0.20| P2_2

    P2_2 -->|Create TRX-YYYY-NNNN| D3
    P2_2 -->|Create outlet row via<br/>outletRefTable + outletRefId| D4
    P2_2 -->|Create 'initial' installment| D5

    P2_2 -->|arrangement = Full Payment| P3_1
    P2_2 -->|arrangement = Down Payment| P3_2

    P3_1 -->|Channel = Cash or Total = 0:<br/>status='paid', balanceDue=0| D3
    P3_1 -->|Cash > 0: queue 'pending_audit'| D6
    P3_1 -->|Channel = QRPh: generate qrToken| P3_3

    P3_2 -->|Starts pending (amountPaid=0)| D3
    CLERK -->|Confirm Initial Cash| P3_2
    P3_2 -->|Customer Cancels Initial:<br/>status='void' & inst='voided'| D3
    P3_2 -->|Initial Cash confirmed:<br/>tx stays 'pending' w/ balanceDue| D6
    P3_2 -->|Initial or Balance = QRPh| P3_3
    CLERK -->|Pay Balance (Cash / QRPh switch)| P3_2
    P3_2 -->|Record 'balance' installment<br/>& mark tx 'paid'| D5
    P3_2 -->|Cash balance audit item| D6

    PAYER -->|Simulate QR Ph Scan| P3_3
    P3_3 -->|Confirm pending installment| D5
    P3_3 -->|Initial down: deduct down & stay 'pending'<br/>Full/Balance: set status='paid', balanceDue=0| D3
```

---

## 4. Level 2B — Accountant AI Auditing, Bank Reconciliation & PDF Reporting Flow

Details how process `6.0` bridges the client-side `CafeLupeStore` with the server-side Express `/api/ai/*` Gemini proxy (`server.ts`) and `jsPDF` exporter (`src/utils/pdfReport.ts`).

```mermaid
flowchart LR
    classDef entity fill:#FEF9C3,stroke:#CA8A04,stroke-width:2px,color:#111827
    classDef extSys fill:#E0F2FE,stroke:#0284C7,stroke-width:2px,color:#0F172A
    classDef proc fill:#FFFFFF,stroke:#1A1A1A,stroke-width:2px,color:#1A1A1A
    classDef store fill:#F3F4F6,stroke:#4B5563,stroke-width:1.5px,color:#111827

    ACC["Accountant"]:::entity
    GEMINI["Google Gemini API<br/>(gemini-4-hydrogen)<br/>via GEMINI_API_KEY"]:::extSys

    D3[("D3: transactions")]:::store
    D5[("D5: payment_installments")]:::store
    D7[("D7: ai_audit_logs &<br/>reconciliation_batches")]:::store

    P6_1(("6.1<br/>Daily Cash Deposit<br/>Validation")):::proc
    P6_2(("6.2<br/>Financial Analysis &<br/>PDF Export")):::proc
    P6_3(("6.3<br/>Outlet Forecasting &<br/>AI Business Advisor")):::proc
    P6_4(("6.4<br/>Per-Outlet Bank<br/>Reconciliation")):::proc
    EXPRESS["Express Proxy<br/>server.ts (/api/ai/*)"]:::proc

    %% Store Inputs
    D5 -->|Confirmed Cash installments<br/>by targetDate| P6_1
    D3 -->|Master transactions,<br/>revenue, channels, outlets| P6_1
    D3 -->|Filtered period metrics<br/>& outlet/channel breakdown| P6_2
    D3 -->|Gross revenue, receivables,<br/>outlet metrics| P6_3
    D3 -->|Outlet transactions in<br/>startDate..endDate| P6_4

    %% Accountant Inputs & Outputs
    ACC -->|Target date + Base64<br/>deposit slip image| P6_1
    ACC -->|Period filter +<br/>Download PDF click| P6_2
    ACC -->|External context +<br/>Advisor questions| P6_3
    ACC -->|Outlet + date range +<br/>Base64 bank statement image| P6_4

    %% Express Proxy <-> Gemini
    P6_1 -->|POST /api/ai/deposit-validate| EXPRESS
    P6_2 -->|POST /api/ai/financial-summary| EXPRESS
    P6_3 -->|POST /api/ai/forecasting<br/>POST /api/ai/advisor| EXPRESS
    P6_4 -->|POST /api/ai/reconcile| EXPRESS

    EXPRESS <-->|@google/genai<br/>Multimodal OCR &<br/>JSON Schema / Chat| GEMINI

    EXPRESS -->|Extracted total, variance,<br/>matched/conflict| P6_1
    EXPRESS -->|Executive summary,<br/>findings, recommendations| P6_2
    EXPRESS -->|Outlet action plans &<br/>advisor replies| P6_3
    EXPRESS -->|Extracted entries &<br/>line-by-line comparisons| P6_4

    %% Persistence & Output
    P6_1 -->|Save AUD-* log| D7
    P6_2 -->|Save AUD-* log| D7
    P6_3 -->|Save AUD-* log| D7
    P6_4 -->|Save REC-* batch| D7

    P6_2 -->|jsPDF report file| ACC
    P6_1 -->|Discrepancy alert| ACC
    P6_3 -->|Action plans & chat| ACC
    P6_4 -->|Matched/conflict table| ACC
```

---

## 5. Data Flow & Code Mapping Reference

| Flow / Component | Origin -> Destination | Code Implementation |
| :--- | :--- | :--- |
| **Role Authentication & Routing** | `LoginView` -> `D1: users` -> `App.tsx` | `store.authenticate()`, `store.registerUser()`, `store.updateUserApproval()` (`src/db/store.ts`, `src/App.tsx`) |
| **Master + Child Transaction Write** | `OutletTransactionForm` / `PosTerminal` -> `D3: transactions` + `D4: *_transactions` | `store.createTransaction()` (`src/db/store.ts`) |
| **SC/PWD Discount Calculation** | Clerk/POS Input -> Pricing Engine -> `D3: transactions` | `calculateDiscountBreakdown()`, `calculateFnbScPwdDiscount()` (`src/db/store.ts`) |
| **Split Down Payment & Mode Switch** | `PaymentWorkflowModals` / `QrPhModal` -> `D5: payment_installments` + `D3` + `D6` | `store.confirmInitialDownPayment()`, `store.voidCancelledInitialPayment()`, `store.payBalance()`, `store.validateQrPayment()` |
| **Timers & 120s Pessimistic Edit Locks** | `OutletWorkspace` -> `D3: transactions` + `D4` | `store.acquireLock()`, `store.releaseLock()`, `store.extendTimedTransaction()`, `store.stopTimer()`, `store.acknowledgeTimer()` |
| **Governance Queues & Direct Edits** | `AdminDashboard` / `OutletWorkspace` -> `D6` -> `AccountantDashboard` -> `D3` | `store.createVoidRequest()`, `store.decideVoidRequest()`, `store.createEditRequest()`, `store.decideEditRequest()`, `store.approveCashConfirmation()`, `store.accountantDirectUpdate()` |
| **Server-Side AI Auditing & Recon** | `AccountantAiViews` -> `server.ts` -> Gemini API -> `D7` | `/api/ai/deposit-validate`, `/api/ai/financial-summary`, `/api/ai/forecasting`, `/api/ai/advisor`, `/api/ai/reconcile` (`server.ts`, `store.addAiAuditLog()`, `store.addReconciliationBatch()`) |
| **PDF Financial Report Export** | `FinancialAnalysisView` + `D3` + AI Summary -> `Accountant` | `downloadFinancialPdfReport()` (`src/utils/pdfReport.ts`) |
