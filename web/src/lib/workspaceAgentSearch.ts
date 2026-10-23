/**
 * Natural-language workspace search (LLM on the API). Deterministic ⌘K ranking still runs first.
 */

export type WorkspaceAgentPick = {
  path: string
  label: string
  reason?: string
}

export type WorkspaceAgentSearchResponse = {
  available: boolean
  answer?: string
  picks: WorkspaceAgentPick[]
  model?: string
}

const AGENT_PREFIX_RE =
  /^(how|what|where|which|show|find|take me|help me|i need|can i|open my|go to my)\b/i

/** When true, the palette will call POST /workspace/agent-search (debounced). */
export function shouldUseWorkspaceAgent(query: string): boolean {
  const q = query.trim()
  if (q.length < 10) return false
  if (q.includes('?')) return true
  if (AGENT_PREFIX_RE.test(q)) return true
  const words = q.split(/\s+/).filter(Boolean)
  return words.length >= 4
}

export function agentPicksToPaletteItems(
  picks: WorkspaceAgentPick[],
  existingIds: Set<string>
): {
  id: string
  label: string
  hint?: string
  group: string
  to: string
  keywords?: string
}[] {
  return picks
    .filter((p) => p.path && !existingIds.has(`agent-${p.path}`))
    .map((p) => ({
      id: `agent-${p.path}`,
      label: p.label,
      hint: p.reason ? `Assistant · ${p.reason}` : 'Assistant suggestion',
      group: 'Assistant',
      to: p.path,
      keywords: 'ai agent assistant',
    }))
}
