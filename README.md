# Core Financial Engine (Ledger-Based Wallet Service)

A robust, closed-loop wallet service engineered for high-traffic environments to track virtual credits (e.g., Reward Points) precisely. This application implements a strict **Double-Entry Ledger Architecture**, ensuring that balances never fall out of sync even under extreme concurrent load or network replication failures.

---

## 🚀 Live Demo (Render)
The application has been fully containerized and deployed to the cloud. You can interact with the Swagger API Documentation directly:
👉 **[Live Swagger UI](https://core-financial-engine.onrender.com)** 
---

## 💻 How to Run Locally (Containerized Setup)

The application is fully containerized requiring almost zero setup. You only need Docker installed and a connection string to a PostgreSQL database (the app uses `pg` pool optimized for modern PostgreSQL connection handlers like Neon).

1. Clone or download the source code.
2. Provide your Database URL directly to Docker Compose:
   ```bash
   export NEON_DATABASE_URL="postgresql://user:password@endpoint/dbname"
   docker-compose up --build
   ```

### Automated Seeding
The orchestrator in `docker-compose.yml` (and `render.yaml`) automatically runs `npm run seed` before booting the API server. This executes `seed.sql` idempotently, which:
1. Defines the **Assets** (`POINTS`).
2. Creates the **System Accounts** (`Treasury`, `Revenue`, `Marketing_Expense`, `Cash_Reserve`).
3. Provisions **User Accounts** and seeds them with initial balances.

---

##  Choice of Technology

*   **Runtime:** `Node.js` (ES Modules) via `Express.js`. Selected for its lightweight, non-blocking asynchronous event loop, which handles high I/O throughput typical in financial systems mapping numerous concurrent requests.
*   **Database:** `PostgreSQL`. Selected for its robust ACID compliance and row-level locking capabilities (`SELECT ... FOR UPDATE`), which are absolute necessities in preventing race conditions and guaranteeing data integrity inside a ledger.
*   **Architecture:** **Double-Entry Ledger**. Instead of a highly-vulnerable `balance` integer column on a user table, every movement of virtual credits operates as an atomistic transaction containing mathematically constrained `postings` (a debit and a credit mapping to `0`). Balances are strictly derived via `COALESCE(SUM(amount), 0)`.

---

##  Concurrency & Race Conditions

In a high-traffic environment, you cannot verify a balance and subtract from it in two disparate queries without another concurrent request sneaking in and draining the funds in between. 

### 1. Pessimistic Locking
To combat this, all core transactions are processed entirely within a `BEGIN` -> `COMMIT/ROLLBACK` wrapper. Inside this block, before any action is authorized, the system relies on **Strict Pessimistic Locking (`SELECT ... FOR UPDATE`)**. This delegates the locking out to the Postgres engine itself, forcing any simultaneous requests targeting the same `account_ids` to quietly form a queue and wait sequentially until the current transaction commits and releases the lock.

### 2. 🌟 Deadlock Avoidance Mechanism
A known hazard of pessimistic locking is "Deadlocks"—where Request A locks Account A to transfer to B, and Request B locks Account B to transfer to A, causing an infinite standoff.
To solve this, our ledger utility **deterministically sorts all requested `account_ids` alphabetically** *before* they are ever passed to the lock queries. By ensuring that DB rows are always locked in the identical sequence universally, deadlocks become mathematically impossible.

### 3. Idempotency (Network Resiliency)
Network requests fail, and clients automatically retry. To prevent double-spending, all routes demand a unique UUID `Idempotency-Key` specified in the headers.
*   The system executes an express middleware that intercepts the key, checking it against the `transactions` table (which also enforces a `UNIQUE` constraint on the column to resolve microscopic race conditions during transit).
*   If the key is recognized as a duplicate, the system short-circuits the wallet logic entirely, returning a cached **200 OK (Idempotent replay)** response.

---



✅ **Functional Logic:**
   - [x] Wallet Top-up (Purchase vs `Cash_Reserve`)
   - [x] Bonus/Incentive (Bonus vs `Marketing_Expense`)
   - [x] Purchase/Spend (Spend vs `Revenue` and strict balance validation mapping to HTTP 400).

✅ **Data Seeding & Setup:**
   - [x] `seed.sql` populates Asset Types, System Accounts, and User Accounts correctly.


   - [x] **Deadlock Avoidance:** Guaranteed via deterministic alphanumeric lock ordering constraints.
   - [x] **Ledger-Based Architecture:** Executed via Parent `transactions` and atomistic `postings` enforcing Double-Entry constraint validation.
   - [x] **Containerization:** Provided completely via orchestrating `Dockerfile` and `docker-compose.yml`.
   - [x] **Hosting:** Deployed via Infrastructure-as-Code (`render.yaml`) to Render alongside interactive Swagger documentation.
