import 'dotenv/config';
import express from 'express';

// Production safety: require JWT_SECRET
const isProd = process.env.NODE_ENV === 'production';
const INSECURE_JWT_SECRETS = new Set([
  '',
  'dev-secret',
  'dev-secret-change-in-production',
  'change-me',
  'changeme',
  'test-secret',
]);
if (isProd && (!process.env.JWT_SECRET || INSECURE_JWT_SECRETS.has(process.env.JWT_SECRET))) {
  console.error('FATAL: JWT_SECRET must be set to a strong, unique value in production.');
  process.exit(1);
}
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import authRoutes from './routes/auth.js';
import publicRoutes from './routes/public.js';
import adminRoutes from './routes/admin/index.js';
import clientRoutes from './routes/clients.js';
import projectsRoutes from './routes/projects.js';
import uploadRoutes from './routes/upload.js';
import attachmentsRoutes from './routes/attachments.js';
import documentsRoutes from './routes/documents.js';
import reconcileRoutes from './routes/reconcile.js';
import reportRoutes from './routes/report.js';
import subscriptionRoutes, { handlePaystackWebhook } from './routes/subscription.js';
import bankRulesRoutes from './routes/bank-rules.js';
import bankAccountsRoutes from './routes/bank-accounts.js';
import currencyRoutes from './routes/currency.js';
import auditRoutes from './routes/audit.js';
import settingsRoutes from './routes/settings.js';
import apiKeysRoutes from './routes/api-keys.js';
import { securityMiddleware } from './middleware/security.js';
import { httpLogger, logger, REQUEST_ID_HEADER } from './middleware/logging.js';
import { livenessHandler, readinessHandler } from './middleware/readiness.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

const app = express();
const PORT = process.env.PORT || 9001;
const trustProxyEnv = (process.env.TRUST_PROXY || '').trim().toLowerCase()
const defaultTrustProxy = isProd ? 1 : 0
let trustProxySetting: boolean | number = defaultTrustProxy
if (trustProxyEnv === 'true') trustProxySetting = true
else if (trustProxyEnv === 'false') trustProxySetting = false
else if (trustProxyEnv) {
  const n = Number(trustProxyEnv)
  if (!Number.isNaN(n) && n >= 0) trustProxySetting = n
}
app.set('trust proxy', trustProxySetting)

// Security headers come before everything else so even error responses carry
// them.  Helmet sets CSP, HSTS, X-Content-Type-Options, Referrer-Policy, etc.
app.use(securityMiddleware());

// Structured per-request logging.  This also assigns/propagates an
// X-Request-Id which the error handler echoes back in error payloads.
app.use(httpLogger);
app.use((req, res, next) => {
  const id = (req as unknown as { id?: string | number }).id
  if (id) res.setHeader(REQUEST_ID_HEADER, String(id))
  next()
})

const corsOrigins = process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()).filter(Boolean) || [];
const devOrigins = [
  'http://localhost:9000',
  'http://localhost:9100',
  'http://127.0.0.1:9000',
  'http://127.0.0.1:9100',
];
// In production we only allow explicitly configured origins. In development we
// also allow the default Vite/Express ports for local work.
const allowedOrigins = (isProd ? [...corsOrigins] : [...devOrigins, ...corsOrigins]).filter(Boolean) as string[];
if (isProd && corsOrigins.length === 0) {
  console.error(
    'FATAL: CORS_ORIGIN must list the SPA origin(s) in production (comma-separated), e.g. https://kqsoftwaresolutions.com — browser requests from the web app will fail CORS without it.',
  );
  process.exit(1);
}

app.use(cors({
  origin: (origin, cb) => {
    // Same-origin / non-browser callers (origin === undefined) are always allowed.
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, origin);
    return cb(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', REQUEST_ID_HEADER],
  exposedHeaders: [REQUEST_ID_HEADER],
}));
// Paystack webhook — no auth; must be before subscription router
app.post('/api/v1/subscription/webhook', express.raw({ type: 'application/json' }), async (req, res, next) => {
  try {
    await handlePaystackWebhook(req, res)
  } catch (err) {
    next(err)
  }
});
app.use(express.json());

// Liveness / readiness probes.
//  - /health and /healthz are equivalent and intentionally cheap.  Prefer
//    /healthz for new callers — the un-suffixed form is kept for backwards
//    compatibility with existing Coolify health checks.
//  - /readyz pings the DB and returns 503 if anything required is unhealthy,
//    so orchestrators can do safe rolling restarts.
app.get('/health', livenessHandler);
app.get('/healthz', livenessHandler);
app.get('/readyz', readinessHandler);

app.get('/api/v1', (_, res) => {
  res.json({
    name: 'Bank Reconciliation SaaS API',
    version: '1.0',
    endpoints: { public: '/api/v1/public', auth: '/api/v1/auth', admin: '/api/v1/admin', clients: '/api/v1/clients', projects: '/api/v1/projects', upload: '/api/v1/upload', attachments: '/api/v1/attachments', documents: '/api/v1/documents', reconcile: '/api/v1/reconcile', report: '/api/v1/report', subscription: '/api/v1/subscription', audit: '/api/v1/audit', settings: '/api/v1/settings', apiKeys: '/api/v1/api-keys', bankRules: '/api/v1/bank-rules', bankAccounts: '/api/v1/bank-accounts' },
  });
});

// Public, unauthenticated marketing endpoints (plan list etc.).
app.use('/api/v1/public', publicRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/clients', clientRoutes);
app.use('/api/v1/projects', projectsRoutes);
app.use('/api/v1/upload', uploadRoutes);
app.use('/api/v1/attachments', attachmentsRoutes);
app.use('/api/v1/documents', documentsRoutes);
app.use('/api/v1/reconcile', reconcileRoutes);
app.use('/api/v1/report', reportRoutes);
app.use('/api/v1/subscription', subscriptionRoutes);
app.use('/api/v1/audit', auditRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/api-keys', apiKeysRoutes);
app.use('/api/v1/bank-rules', bankRulesRoutes);
app.use('/api/v1/bank-accounts', bankAccountsRoutes);
app.use('/api/v1/currency', currencyRoutes);

// Serve uploaded branding logos (no auth required - logos are shown on reports)
const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
const brandingDir = path.join(uploadDir, 'branding');
app.get('/api/v1/uploads/branding/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  if (!filename || filename.includes('..')) return res.status(400).send('Invalid filename');
  const fullPath = path.join(brandingDir, filename);
  if (!fs.existsSync(fullPath)) return res.status(404).send('File not found');
  const ext = path.extname(filename).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'application/octet-stream';
  res.setHeader('Content-Type', mime);
  res.sendFile(fullPath);
});

// 404 for any unmatched route — same shape as other error responses.
app.use(notFoundHandler);

// Central error handler — catches Zod, Prisma, multer, and unexpected errors.
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info({ port: PORT }, `BRS API listening`);
});
