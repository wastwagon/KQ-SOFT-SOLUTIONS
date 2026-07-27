/**
 * GET /clients returns either a legacy bare array or
 * `{ clients, unassignedProjectCount, totalProjectCount }`.
 */
export type ClientListRow = { id: string; name: string; _count?: { projects: number } }

export type ClientsListPayload = {
  clients: ClientListRow[]
  unassignedProjectCount: number
  totalProjectCount: number
}

export function normalizeClientsPayload(data: unknown): ClientsListPayload {
  if (data == null) {
    return { clients: [], unassignedProjectCount: 0, totalProjectCount: 0 }
  }
  if (Array.isArray(data)) {
    return {
      clients: data as ClientListRow[],
      unassignedProjectCount: 0,
      totalProjectCount: 0,
    }
  }
  if (typeof data !== 'object') {
    return { clients: [], unassignedProjectCount: 0, totalProjectCount: 0 }
  }
  const obj = data as Partial<ClientsListPayload>
  return {
    clients: Array.isArray(obj.clients) ? obj.clients : [],
    unassignedProjectCount: obj.unassignedProjectCount ?? 0,
    totalProjectCount: obj.totalProjectCount ?? 0,
  }
}

/** Convenience when callers only need the client rows. */
export function normalizeClientsList(data: unknown): ClientListRow[] {
  return normalizeClientsPayload(data).clients
}
