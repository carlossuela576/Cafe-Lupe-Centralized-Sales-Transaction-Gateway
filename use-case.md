# Cafe Lupe Centralized Sales Report & Transaction Gateway — Use-Case Diagram (Revision 002)

This document maps all **actors**, **system capabilities**, and **UML `<<include>>` / `<<extend>>` relationships** implemented in Revision 002 of the **Cafe Lupe Transaction Gateway**.

---

## 1. Master System Use-Case Diagram

```mermaid
flowchart LR
    %% Actors (Font Awesome actor icons)
    classDef actor fill:#FEF9C3,stroke:#CA8A04,stroke-width:2px,color:#111827
    classDef sysActor fill:#E0F2FE,stroke:#0284C7,stroke-width:2px,color:#0F172A

    FD["fa:fa-user<br/>Front-Desk (Admin)<br/>9 Merged Outlets"]:::actor
    GYM["fa:fa-user<br/>Gym Staff"]:::actor
    FNB["fa:fa-user<br/>F&B POS Staff"]:::actor
    ACC["fa:fa-user<br/>Accountant"]:::actor
    QR["fa:fa-qrcode<br/>QR Ph Payment<br/>Gateway"]:::sysActor
    AI["fa:fa-robot<br/>Gemini AI Server<br/>(/api/ai/*)"]:::sysActor

    subgraph SYS["Cafe Lupe Centralized Sales Report & Transaction Gateway"]
        direction TB

        subgraph AUTH["Authentication & Access"]
            UC_LOGIN(["Unified Role-Based Login & Profile"])
            UC_SIGNUP(["Register Account & Check Approval Status"])
            UC_APPROVE_USR(["Approve / Reject New Staff Accounts"])
        end

        subgraph OUTLET_TX["Outlet Transaction & Payment Lifecycle"]
            UC_SWITCH(["Switch 9 Merged Outlets via Sidebar"])
            UC_CREATE_TX(["Create Outlet Transaction"])
            UC_GYM_TX(["Create Gym Membership / Session"])
            UC_POS(["Process F&B POS Order (Full Payment)"])
            UC_FNB_DISC(["Apply SC/PWD Pax & Valid ID Discount"])
            UC_KITCHEN(["Print Kitchen Order Ticket"])

            UC_DOWN_INIT(["Confirm Initial Down Payment"])
            UC_VOID_CANCEL(["Instant Void on Cancelled Initial Payment"])
            UC_PAY_BAL(["Settle Remaining Balance (Cash / QR Ph Switch)"])
            UC_QR_SCAN(["Validate Unique QR Ph Payment"])
            UC_EYE(["Inspect Transaction Details (Eye Modal)"])
        end

        subgraph TIMERS["Timed Outlet Supervision"]
            UC_TIMER(["Track Live Session Countdown"])
            UC_STOP(["Stop Timer Early Check-Out"])
            UC_EXTEND(["Extend Session Hours"])
            UC_EXPIRE(["Acknowledge Blocking Expiry Overlay"])
        end

        subgraph GOV["Governance & Outlet Setup"]
            UC_ADD_OUTLET(["Add Outlets & Service Presets"])
            UC_REQ_EDIT(["Submit Edit Request"])
            UC_REQ_VOID(["Submit Void Request"])
            UC_ACC_EDIT(["Direct Edit Transaction (No Approval)"])
            UC_APP_CASH(["Confirm Cash Deposit Audit"])
            UC_APP_EDIT(["Approve / Reject Edit Requests"])
            UC_APP_VOID(["Approve / Reject Void Requests"])
        end

        subgraph ACC_AI["Accountant Analytics & AI Suite"]
            UC_SUMMARY(["View Sales Summary (Day/Week/Month/Year)"])
            UC_HISTORY(["Search & Filter All Transactions (Cash / QR Ph)"])
            UC_AI_DEP(["Daily Cash Deposit Slip Validation"])
            UC_AI_FIN(["Financial Analysis Dashboard & PDF Export"])
            UC_AI_FORE(["Generate Per-Outlet Forecast Action Plans"])
            UC_AI_ADV(["Consult Decision Analysis Business Advisor"])
            UC_AI_RECON(["Per-Outlet Bank Statement Reconciliation"])
        end
    end

    %% Actor -> Use Case Associations
    FD --> UC_LOGIN
    FD --> UC_APPROVE_USR
    FD --> UC_ADD_OUTLET
    FD --> UC_SWITCH
    FD --> UC_CREATE_TX
    FD --> UC_TIMER
    FD --> UC_STOP
    FD --> UC_EXTEND
    FD --> UC_EXPIRE
    FD --> UC_PAY_BAL
    FD --> UC_EYE
    FD --> UC_REQ_EDIT
    FD --> UC_REQ_VOID

    GYM --> UC_LOGIN
    GYM --> UC_SIGNUP
    GYM --> UC_GYM_TX
    GYM --> UC_PAY_BAL
    GYM --> UC_EYE
    GYM --> UC_REQ_VOID

    FNB --> UC_LOGIN
    FNB --> UC_SIGNUP
    FNB --> UC_POS
    FNB --> UC_EYE
    FNB --> UC_REQ_VOID

    ACC --> UC_LOGIN
    ACC --> UC_SIGNUP
    ACC --> UC_SUMMARY
    ACC --> UC_HISTORY
    ACC --> UC_EYE
    ACC --> UC_ACC_EDIT
    ACC --> UC_APP_CASH
    ACC --> UC_APP_EDIT
    ACC --> UC_APP_VOID
    ACC --> UC_AI_DEP
    ACC --> UC_AI_FIN
    ACC --> UC_AI_FORE
    ACC --> UC_AI_ADV
    ACC --> UC_AI_RECON

    %% UML Include / Extend & External System Links
    UC_CREATE_TX -.->|"<<extend>> Down Payment"| UC_DOWN_INIT
    UC_GYM_TX -.->|"<<extend>> Down Payment"| UC_DOWN_INIT
    UC_DOWN_INIT -.->|"<<extend>> Customer Cancels"| UC_VOID_CANCEL

    UC_POS -.->|"<<include>>"| UC_KITCHEN
    UC_POS -.->|"<<extend>> SC/PWD = Yes"| UC_FNB_DISC

    UC_CREATE_TX -.->|"<<extend>> QR Ph"| UC_QR_SCAN
    UC_POS -.->|"<<extend>> QR Ph"| UC_QR_SCAN
    UC_DOWN_INIT -.->|"<<extend>> QR Ph"| UC_QR_SCAN
    UC_PAY_BAL -.->|"<<extend>> QR Ph"| UC_QR_SCAN

    UC_QR_SCAN --> QR
    UC_AI_DEP --> AI
    UC_AI_FIN --> AI
    UC_AI_FORE --> AI
    UC_AI_ADV --> AI
    UC_AI_RECON --> AI
```

---

## 2. Role & Capability Matrix

| Actor | Primary Responsibilities | Outlet / Portal Scope |
| :--- | :--- | :--- |
| **Front-Desk (Admin)** | Staff account approvals, outlet/service management (`Add outlet`), operating all 9 merged outlets via the sidebar Outlet Selector, timed session controls (`Stop`, `Extend`, blocking expiry `Acknowledge`), submitting Edit & Void requests to Accountant | Pickleball, Hostel, Swimming Pool, KTV Rooms, Billiards, Table Tennis, Parking Lot, Events & Location Rentals |
| **Gym Staff** | Recording Annual/Monthly/Per-Session/Self-Train transactions, collecting Cash/QR Ph & Down Payments, inspecting transaction details (`Eye`), submitting Void requests | Gym & Combat Training |
| **F&B POS Staff** | Ordering across Food & Drinks catalog, applying `Pax + Valid SC/PWD IDs` discount formula, upfront Full Payment (`Cash` / `QR Ph`), printing kitchen receipts | Restaurant / F&B POS |
| **Accountant** | Reviewing Sales Summary & History (`Cash` / `QR Ph` filters + multi-attribute search), direct edits without approval, approving **Cash Confirmations / Edit Requests / Void Requests**, running the 5 Gemini AI modules & downloading PDF reports | All Outlets (Central Governance & AI Suite) |
