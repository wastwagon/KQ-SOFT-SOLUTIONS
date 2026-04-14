# Use the app yourself (local)

Short guide to run the BRS app and use it end-to-end on your machine.

---

## 1. Start the app

### Option A — Full Docker (easiest)

From the project root:

```bash
cp .env.example .env
docker compose up -d
```

Wait ~30 seconds for Postgres to become healthy and the API to run. Then open:

- **Web UI:** http://localhost:9100  
- (API: http://localhost:9101)

If you use different ports (e.g. 9000/9001), set `WEB_PORT` and `API_PORT` in `.env` and run `docker compose up -d` again.

### Option B — Postgres + Redis in Docker, API + Web on your machine

```bash
docker compose up -d postgres redis
```

Then:

```bash
# Terminal 1 — API
cd api
cp .env.example .env   # if not done
# In api/.env set: DATABASE_URL=postgresql://postgres:postgres@localhost:15432/brs_db
npm install && npm run dev
```

```bash
# Terminal 2 — Web
cd web
npm install && npm run dev
```

Open the URL shown by the web dev server (usually http://localhost:5173). Set `VITE_API_URL` in `web/.env` if it’s not pointing at your API (e.g. http://localhost:9001).

---

## 2. First time: sign in

- **Register:** Open the app → **Register** → create an account. You’ll be in your own organisation.
- **Or use seed accounts:** Run the seed (see README “Seed”) and sign in with e.g. `admin@qsoft.com` / `Test123!` to try different plans and roles.

---

## 3. Use a reconciliation (step by step)

1. **Create a project**  
   **Projects** → **New project**. Name it (e.g. “Ecobank Jan 2025”), optional client, currency (GHS default). Save.

2. **Upload**  
   Open the project → **Upload** step.  
   - **Cash book:** Upload **receipts** (money in) and **payments** (money out). Excel, CSV, or PDF.  
   - **Bank statement:** Upload **credits** and **debits** for the same period. If you have multiple accounts, choose or add a bank account name.  
   Ghana bank formats (Ecobank, GCB, Access, etc.) are auto-detected and mapped where possible.

3. **Map (if needed)**  
   If any document has unmapped columns, go to **Map**. Map date, amount, description, reference, cheque number to the expected fields, then save.

4. **Reconcile**  
   **Reconcile** step: switch between “Receipts vs credits” and “Payments vs debits”. Select a cash-book line and a bank line, then **Match**. Use suggestions (if your plan has them) or match manually. You can also filter by **bank account** if you have more than one.

5. **Review & report**  
   **Review** → submit for review if you have a reviewer. **Report** shows the BRS (balance per bank, uncredited lodgments, unpresented cheques, balance per cash book). Use **Edit summary & notes** to add a narrative or preparer/reviewer comments. **Export** PDF or Excel when ready.

6. **Approve (optional)**  
   If your role is reviewer/admin, you can **Approve** from the Report step. That marks the project as completed.

---

## 4. Handy links

- **Dashboard** — overview and recent projects  
- **Projects** — list, filter by status (draft, reconciling, completed, etc.)  
- **Settings** — branding (logo, colours, report title), members, bank rules, billing  
- **Audit** — action history (if your plan includes it)

---

## 5. If something fails

- **Can’t log in / 401:** Check API is running and `VITE_API_URL` (or proxy) points to it.  
- **DB errors:** Ensure Postgres is up: `docker compose ps`; start with `docker compose start postgres redis`.  
- **Upload / parse errors:** Use Excel or CSV for a quick test; PDFs need the correct parser or OCR.  
- **Port in use:** Change `WEB_PORT` / `API_PORT` in `.env` (e.g. 9100, 9101) and restart.

For full env vars and deployment, see the main **README** and **docs/DOCKER_START.md**.
