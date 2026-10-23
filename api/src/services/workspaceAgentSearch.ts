import { z } from 'zod'
import { projectPathForStatus } from '../lib/projectRoutes.js'

export type WorkspaceDestination = {
  path: string
  label: string
  kind: 'page' | 'project' | 'client_filter' | 'project_filter'
  hint?: string
}

export type WorkspaceSearchContext = {
  role: string
  isPlatformAdmin: boolean
  features: {
    api_access: boolean
    bank_rules: boolean
    audit_trail: boolean
    multi_client: boolean
  }
  projects: {
    slug: string
    name: string
    status: string
    clientName?: string | null
  }[]
  clients: { id: string; name: string }[]
}

const agentPickSchema = z.object({
  path: z.string().min(1).max(300),
  label: z.string().min(1).max(120),
  reason: z.string().max(200).optional(),
})

const agentResponseSchema = z.object({
  answer: z.string().max(600),
  picks: z.array(agentPickSchema).max(5),
})

export type WorkspaceAgentSearchResult = {
  available: boolean
  answer?: string
  picks: { path: string; label: string; reason?: string }[]
  model?: string
}

/** Build allowlisted navigation targets the model may return. */
export function buildWorkspaceSearchCatalog(ctx: WorkspaceSearchContext): WorkspaceDestination[] {
  const list: WorkspaceDestination[] = [
    { path: '/dashboard', label: 'Dashboard', kind: 'page', hint: 'Home overview' },
    { path: '/projects', label: 'Projects', kind: 'page' },
    { path: '/projects?status=reconciling', label: 'Reconciling projects', kind: 'project_filter' },
    { path: '/projects?status=submitted_for_review', label: 'Projects awaiting review', kind: 'project_filter' },
    { path: '/projects?status=draft', label: 'Draft projects', kind: 'project_filter' },
    { path: '/reports', label: 'Reports', kind: 'page' },
    { path: '/tools/clean-bank-statement', label: 'Clean bank statement', kind: 'page' },
    { path: '/tools/clean-cash-book', label: 'Clean cash book', kind: 'page' },
    { path: '/settings/branding', label: 'Branding settings', kind: 'page' },
    { path: '/settings/billing', label: 'Billing', kind: 'page' },
    { path: '/settings/members', label: 'Team members', kind: 'page' },
    { path: '/settings/connections', label: 'Connections', kind: 'page' },
    { path: '/projects/new', label: 'New project', kind: 'page' },
    { path: '/manual', label: 'User manual', kind: 'page' },
  ]

  if (ctx.features.multi_client) {
    list.push({ path: '/clients', label: 'Clients', kind: 'page' })
  }
  if (ctx.features.api_access) {
    list.push({ path: '/settings/api-keys', label: 'API keys', kind: 'page' })
  }
  if (ctx.features.bank_rules) {
    list.push({ path: '/settings/bank-rules', label: 'Bank rules', kind: 'page' })
  }
  if (ctx.features.audit_trail) {
    list.push({ path: '/audit', label: 'Audit log', kind: 'page' })
  }
  if (ctx.isPlatformAdmin) {
    list.push({ path: '/platform-admin', label: 'Platform admin', kind: 'page' })
  }

  for (const p of ctx.projects) {
    const slug = p.slug
    list.push({
      path: projectPathForStatus(slug, p.status),
      label: p.name,
      kind: 'project',
      hint: p.clientName ? `${p.status.replace(/_/g, ' ')} · ${p.clientName}` : p.status.replace(/_/g, ' '),
    })
    list.push({
      path: `/projects/${slug}/reconcile`,
      label: `${p.name} — reconcile`,
      kind: 'project',
      hint: 'Matching step',
    })
    list.push({
      path: `/projects/${slug}/report`,
      label: `${p.name} — BRS report`,
      kind: 'project',
      hint: 'Bank reconciliation statement',
    })
  }

  for (const c of ctx.clients) {
    list.push({
      path: `/projects?clientId=${encodeURIComponent(c.id)}`,
      label: c.name,
      kind: 'client_filter',
      hint: 'Client projects',
    })
  }

  const seen = new Set<string>()
  return list.filter((d) => {
    if (seen.has(d.path)) return false
    seen.add(d.path)
    return true
  })
}

export function filterAgentPicksToCatalog(
  picks: { path: string; label: string; reason?: string }[],
  catalog: WorkspaceDestination[]
): { path: string; label: string; reason?: string }[] {
  const byPath = new Map(catalog.map((d) => [d.path, d]))
  const out: { path: string; label: string; reason?: string }[] = []
  for (const pick of picks) {
    const normalized = pick.path.startsWith('/') ? pick.path : `/${pick.path}`
    const dest = byPath.get(normalized)
    if (!dest) continue
    out.push({
      path: dest.path,
      label: pick.label.trim() || dest.label,
      reason: pick.reason,
    })
  }
  return out
}

function workspaceAgentEnabled(): boolean {
  if ((process.env.WORKSPACE_AGENT_SEARCH || '1').trim() === '0') return false
  return Boolean(process.env.OPENAI_API_KEY?.trim())
}

function buildSystemPrompt(catalog: WorkspaceDestination[]): string {
  const paths = catalog.map((d) => ({
    path: d.path,
    label: d.label,
    hint: d.hint,
    kind: d.kind,
  }))
  return `You are the KQ-SOFT BRS workspace assistant. The user asks in natural language where to go or what to open.

Rules:
- Return ONLY valid JSON: {"answer":"...","picks":[{"path":"/exact/path","label":"Short label","reason":"optional"}]}
- "picks" must use paths from ALLOWED_DESTINATIONS only (copy path exactly).
- Prefer 1–3 picks; put the best match first.
- "answer" is one or two short sentences (plain language, no markdown).
- For "reconcile X" or "open project Y", pick the project reconcile or status-appropriate path.
- For billing/plan/subscription questions, pick /settings/billing.
- If nothing fits, suggest /projects or /dashboard in picks and explain in answer.

ALLOWED_DESTINATIONS:
${JSON.stringify(paths)}`
}

export async function runWorkspaceAgentSearch(
  query: string,
  ctx: WorkspaceSearchContext
): Promise<WorkspaceAgentSearchResult> {
  if (!workspaceAgentEnabled()) {
    return { available: false, picks: [] }
  }

  const catalog = buildWorkspaceSearchCatalog(ctx)
  const apiKey = process.env.OPENAI_API_KEY!.trim()
  const base = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')
  const model = (process.env.OPENAI_MODEL || 'gpt-4o-mini').trim()

  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 500,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: buildSystemPrompt(catalog) },
        {
          role: 'user',
          content: JSON.stringify({
            role: ctx.role,
            query: query.trim(),
          }),
        },
      ],
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Assistant request failed (${res.status}): ${text.slice(0, 200)}`)
  }

  const payload = (await res.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  const raw = payload.choices?.[0]?.message?.content
  if (!raw) {
    return { available: true, answer: 'No response from the assistant.', picks: [], model }
  }

  let parsed: z.infer<typeof agentResponseSchema>
  try {
    parsed = agentResponseSchema.parse(JSON.parse(raw))
  } catch {
    return { available: true, answer: 'Could not parse assistant response. Try a shorter query.', picks: [], model }
  }

  const picks = filterAgentPicksToCatalog(parsed.picks, catalog)
  return {
    available: true,
    answer: parsed.answer.trim(),
    picks,
    model,
  }
}

export function isWorkspaceAgentConfigured(): boolean {
  return workspaceAgentEnabled()
}
