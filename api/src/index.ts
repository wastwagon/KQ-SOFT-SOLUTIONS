import 'dotenv/config';
import express from 'express';

// Production safety: require JWT_SECRET
const isProd = process.env.NODE_ENV === 'production';
if (isProd && (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'dev-secret')) {
  console.error('FATAL: JWT_SECRET must be set to a strong, unique value in production.');
  process.exit(1);
}
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import authRoutes from './routes/auth.js';
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

const corsOrigins = process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()).filter(Boolean) || [];
const allowedOrigins = [
  'http://localhost:9000',
  'http://localhost:9100',
  'http://127.0.0.1:9000',
  'http://127.0.0.1:9100',
  ...corsOrigins,
].filter(Boolean) as string[];
if (isProd && corsOrigins.length === 0) {
  console.warn('WARN: CORS_ORIGIN not set. Add your frontend URL(s) for production.');
}

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) cb(null, origin || true);
    else cb(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
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

app.get('/health', (_, res) => {
  res.json({ status: 'ok', service: 'brs-api' });
});

app.get('/api/v1', (_, res) => {
  res.json({
    name: 'Bank Reconciliation SaaS API',
    version: '1.0',
    endpoints: { auth: '/api/v1/auth', admin: '/api/v1/admin', clients: '/api/v1/clients', projects: '/api/v1/projects', upload: '/api/v1/upload', attachments: '/api/v1/attachments', documents: '/api/v1/documents', reconcile: '/api/v1/reconcile', report: '/api/v1/report', subscription: '/api/v1/subscription', audit: '/api/v1/audit', settings: '/api/v1/settings', apiKeys: '/api/v1/api-keys', bankRules: '/api/v1/bank-rules', bankAccounts: '/api/v1/bank-accounts' },
  });
});

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

// Global error handler — catches multer and other errors
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const msg = err instanceof Error ? err.message : 'Request failed'
  const code = err && typeof err === 'object' && 'code' in err ? (err as { code?: string }).code : undefined
  let status = 500
  if (msg.includes('File type') || msg.includes('not allowed')) status = 400
  else if (code === 'LIMIT_FILE_SIZE' || msg.includes('too large')) {
    status = 413
    return res.status(413).json({ error: `File too large. Max ${process.env.MAX_UPLOAD_SIZE_MB || '10'}MB.` })
  }
  res.status(status).json({ error: msg })
})

app.listen(PORT, () => {
  console.log(`BRS API running at http://localhost:${PORT}`);
});
