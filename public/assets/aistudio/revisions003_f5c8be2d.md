# Revision 003
## AI Agent Directives (Read First)
> 1. **Context Recollection:** The Second set of revision instructions, it is a must to retrieve previous context .md files from the brain and assests of the project for proper context. This will align the AI agent properly on the previous/latest state of the project, to the proceeding queries/revisions. This shall enable the Agent to properly plan out changes and refactorizations without being destructive to the entire codebase.
> 2. **Coupling and Context Reliance:** Ensure to work alongside `requirements.md` and `SPEC.md` for full project context and requirements. That will help the Agent to retrieve necessary information to the codebase and impending software architecture. Adjust and update `requirements.md`, `SPEC.md`, `README.md` with regards to the recent changes made.
> 3. **Milestones and State Management:** The Agent shall produce `lastState.md` in the codebase's brain folder after every state changes into the codebase. This will help the Agent to retrieve previous changes quickly in-case the input context window has degraded.
>4. **Unchanged Function State:** For functions that were not in state to be changed in this revision shall remain unchanged. If other functions that were not explicitly stated for change, needs modification due to parallel logical alignment. **ASK FIRST**.

This revision document contains minor front-end UI changes and minor function migration updates. Lukewarm but thorough implementation planning could be applied since minor revisions would not intervene much with the system architecture. (this must be done only for AI agent efficiency on tokens and limits)

### General Changes
#### Centralized Sync Calendar
> 1. A centralized calendar, in-sync accross all unified and independent outlets.
> 2. Schedules, bookings, ongoing activities, must be seen within all outlets
> 3. Calendar must be situated within the dashboards of each outlet.
> 4. Calendar must have outlet filters that filters out the calendar based on the chosen outlet.
> 5. The calendar must also have a `General` filter option into which shows all activities on all outlets.
> 6. Use `https://fullcalendar.io/` as calendar API. **Reason for choice:** They offer native Tailwind rendering. **Supporting Document/Resource:** `https://fullcalendar.io/docs/react`

### Front-desk
> 1. Migrate the Default dashboard UI `Central Transactions` to its own dedicated right menu-bar selector named `Master Ledger`.
> 2. `Header Cards` (`All outlets today, Pending Accounts, Pending Balances, Managed Outlets`). Must have a `privacy toggle` icon `eye icon` that hides all money and other numerical values within the dashboard UI. Transforming sensitive numerical data displays into `*****`. 
> 3. **Timer alert cards** must be visible on Front-desk dashboard
> 4. Pending rolling timer must be shown in Front-desk dashboard. Must state the pending event attributes (e.g `customer name`, `outlet name`, `remaining time`)
> 5. **Acknowledge Timer Alert Overlay** must be visible within the whole front-desk interface and not just only be seen when entering a specified outlet.
```
Problem:
> When a timer ends for a specific outlet the alert card only shows when entering the proprietary outlet.
> this raises a problem that the front-desk would need to scan through the outlets with timers just to check whenever the times are up.

Solution:
> Timer alert overlays must be visible all throughout the interface of front-desk. Even on the dash boards.
> Adding the rolling timer cards within the dashboard for constant reminders and easy view access.
```
> 6. Include and add proper and necessary KPI card components within the dashboard (e.g `outstanding balances`, `pending transactions`, `top outlets sales`, `sales distribution`).
```
> These may be shown as either cards with numerical values and/or using pie, bar, line graphs.
> As an AI AGENT; you have the AUTHORITY to analyze and think of other necessary KPI cards to be added within the dashboard of Front-Desk.
```

### Log-in
> 1. Add show password icon. Enabling show and hiding of password on log-in interface.