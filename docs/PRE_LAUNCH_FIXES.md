# Pre-Launch Fixes Applied

**Date:** 2026-03-10

---

## Summary

Critical and high-priority gaps identified in the pre-launch review have been fixed.

---

## 1. Security

### JWT_SECRET (Critical) ✅
- **Fix:** API exits on startup if `NODE_ENV=production` and `JWT_SECRET` is missing or equals `dev-secret`
- **File:** `api/src/index.ts`

### Auth rate limiting (High) ✅
- **Fix:** Added `express-rate-limit` — 30 requests per 15 min per IP for auth routes (login, register, forgot-password, reset-password)
- **File:** `api/src/routes/auth.ts`
- **Dependency:** `express-rate-limit`

### CORS (High) ✅
- **Fix:** Support comma-separated `CORS_ORIGIN`; warn in production if not set
- **File:** `api/src/index.ts`

### File upload/download (Medium) ✅
- **Fix:** `sanitizeFilename()` strips path traversal, control chars, quotes from stored filenames
- **Fix:** Attachment download validates `filepath` is under `UPLOAD_DIR`; sanitizes `Content-Disposition` filename
- **Files:** `api/src/lib/sanitizeFilename.ts`, `api/src/routes/upload.ts`, `api/src/routes/attachments.ts`

### Client name max length (Low) ✅
- **Fix:** `z.string().min(1).max(200)` for client create
- **File:** `api/src/routes/clients.ts`

---

## 2. Data Integrity

### Bulk match transaction (Medium) ✅
- **Fix:** Bulk match validates all pairs first, then creates in `prisma.$transaction` for atomicity
- **File:** `api/src/routes/reconcile.ts`

---

## 3. Error Handling

### API client non-JSON (Medium) ✅
- **Fix:** Handle non-JSON responses (e.g. HTML error pages); extract error message from text when JSON parse fails
- **File:** `web/src/lib/api.ts`

---

## 4. Configuration & Documentation

### .env.example (High) ✅
- **Fix:** Complete production env template with `JWT_SECRET`, `CORS_ORIGIN`, `UPLOAD_DIR`, `MAX_UPLOAD_SIZE_MB`, `API_BASE_URL`, etc.
- **File:** `.env.example`

### Production deployment guide (Medium) ✅
- **Fix:** Added `docs/PRODUCTION_DEPLOYMENT.md` with checklist, env vars, Paystack webhook, security notes
- **File:** `docs/PRODUCTION_DEPLOYMENT.md`

---

## 5. Not Implemented (Lower Priority)

| Item | Reason |
|------|--------|
| Redis for rate limiting | In-memory OK for single instance; document for multi-instance |
| OpenAPI/Swagger | Add in future iteration |
| Integration/E2E tests | Add in future iteration |
| Paystack dedicated webhook secret | Prefer `PAYSTACK_WEBHOOK_SECRET`; document in .env.example |

---

## 6. Build Status

- API: ✅ `npm run build`
- Web: ✅ `npm run build`

---

## 7. Pre-Launch Checklist

Before going live:

1. [ ] Set `JWT_SECRET` (min 32 chars, unique)
2. [ ] Set `CORS_ORIGIN` to frontend URL(s)
3. [ ] Set `NODE_ENV=production`
4. [ ] Run `prisma migrate deploy`
5. [ ] Configure Paystack webhook URL and secret
6. [ ] Set `API_BASE_URL` for logos/links
7. [ ] Ensure `UPLOAD_DIR` is writable and persisted
