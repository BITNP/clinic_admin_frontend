import type API from '@/store/api'

export type JournalFilters = {
  entityType: string
  entityId: string
  actorType: '' | API.JournalActorType
  actorId: string
  action: string
  from: string
  to: string
}

export type JournalRouteQuery = Record<string, unknown>

export type JournalChangeRow = {
  field: string
  label: string
  before?: unknown
  after?: unknown
  redacted: boolean
}

export const journalActorTypes: API.JournalActorType[] = [
  'staff',
  'customer',
  'system',
  'integration'
]

export const emptyJournalFilters = (): JournalFilters => ({
  entityType: '',
  entityId: '',
  actorType: '',
  actorId: '',
  action: '',
  from: '',
  to: ''
})

const routeValue = (value: unknown): string => {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0].trim() : ''
  }
  return typeof value === 'string' ? value.trim() : ''
}

const validTime = (value: string): string => {
  if (!value || Number.isNaN(Date.parse(value))) return ''
  return new Date(value).toISOString()
}

const objectValue = (value: unknown, message: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(message)
  }
  return value as Record<string, unknown>
}

const wireValue = (
  value: Record<string, unknown>,
  snakeCase: string,
  exportedName: string
): unknown => value[snakeCase] ?? value[exportedName]

const requiredWireString = (
  value: Record<string, unknown>,
  snakeCase: string,
  exportedName: string
): string => {
  const raw = wireValue(value, snakeCase, exportedName)
  if (typeof raw !== 'string' || raw === '') {
    throw new Error(`journal response is missing ${snakeCase}`)
  }
  return raw
}

const integerValue = (value: unknown, name: string): number => {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`journal response has an invalid ${name}`)
  }
  return parsed
}

export const normalizeJournalEvent = (value: unknown): API.JournalEvent => {
  const event = objectValue(value, 'journal response event is invalid')
  const details = wireValue(event, 'details', 'Details') ?? {}
  const causedBy = wireValue(event, 'caused_by_event_id', 'CausedByEventID')
  return {
    id: integerValue(wireValue(event, 'id', 'ID'), 'event id'),
    occurred_at: requiredWireString(event, 'occurred_at', 'OccurredAt'),
    recorded_at: requiredWireString(event, 'recorded_at', 'RecordedAt'),
    actor_type: requiredWireString(event, 'actor_type', 'ActorType') as API.JournalActorType,
    actor_id: requiredWireString(event, 'actor_id', 'ActorID'),
    action: requiredWireString(event, 'action', 'Action'),
    entity_type: requiredWireString(event, 'entity_type', 'EntityType'),
    entity_id: requiredWireString(event, 'entity_id', 'EntityID'),
    operation_id: requiredWireString(event, 'operation_id', 'OperationID'),
    caused_by_event_id:
      causedBy === null || causedBy === undefined
        ? null
        : integerValue(causedBy, 'caused_by_event_id'),
    details: objectValue(details, 'journal response details are invalid')
  }
}

export const normalizeJournalPage = (value: unknown): API.JournalPage => {
  const page = objectValue(value, 'journal response is invalid')
  const rawItems = wireValue(page, 'items', 'Items')
  if (!Array.isArray(rawItems)) {
    throw new Error('journal response items are invalid')
  }
  const rawCursor = wireValue(page, 'next_cursor', 'NextCursor')
  return {
    items: rawItems.map(normalizeJournalEvent),
    next_cursor:
      rawCursor === null || rawCursor === undefined ? null : integerValue(rawCursor, 'next cursor')
  }
}

export const normalizeJournalEntityKinds = (value: unknown): API.JournalEntityKind[] => {
  const response = objectValue(value, 'journal entity kinds response is invalid')
  const rawItems = wireValue(response, 'items', 'Items')
  if (!Array.isArray(rawItems)) {
    throw new Error('journal entity kinds response items are invalid')
  }
  return rawItems.map((raw) => {
    const item = objectValue(raw, 'journal entity kind is invalid')
    const rawActions = wireValue(item, 'actions', 'Actions')
    if (!Array.isArray(rawActions)) {
      throw new Error('journal entity kind actions are invalid')
    }
    const actions = rawActions.map((action) => {
      if (typeof action !== 'string' || action.trim() === '') {
        throw new Error('journal entity kind action is invalid')
      }
      return action.trim()
    })
    return {
      entity_type: requiredWireString(item, 'entity_type', 'EntityType'),
      actions: [...new Set(actions)]
    }
  })
}

export const normalizeJournalFilters = (filters: JournalFilters): JournalFilters => {
  const actorType =
    filters.actorType && journalActorTypes.includes(filters.actorType) ? filters.actorType : ''
  return {
    entityType: filters.entityType.trim(),
    entityId: filters.entityId.trim(),
    actorType,
    actorId: filters.actorId.trim(),
    action: filters.action.trim(),
    from: validTime(filters.from),
    to: validTime(filters.to)
  }
}

export const journalFiltersFromRouteQuery = (query: JournalRouteQuery): JournalFilters => {
  return normalizeJournalFilters({
    entityType: routeValue(query.entity_type),
    entityId: routeValue(query.entity_id),
    actorType: routeValue(query.actor_type) as JournalFilters['actorType'],
    actorId: routeValue(query.actor_id),
    action: routeValue(query.action),
    from: routeValue(query.from),
    to: routeValue(query.to)
  })
}

export const journalFiltersToRouteQuery = (filters: JournalFilters): Record<string, string> => {
  const normalized = normalizeJournalFilters(filters)
  const query: Record<string, string> = {}
  if (normalized.entityType) query.entity_type = normalized.entityType
  if (normalized.entityId) query.entity_id = normalized.entityId
  if (normalized.actorType) query.actor_type = normalized.actorType
  if (normalized.actorId) query.actor_id = normalized.actorId
  if (normalized.action) query.action = normalized.action
  if (normalized.from) query.from = normalized.from
  if (normalized.to) query.to = normalized.to
  return query
}

export const journalFilterSignature = (filters: JournalFilters): string => {
  const normalized = normalizeJournalFilters(filters)
  return JSON.stringify(normalized)
}

export const journalRequestURL = (
  filters: JournalFilters,
  cursor: number | null = null,
  limit = 100
): string => {
  const normalized = normalizeJournalFilters(filters)
  const params = new URLSearchParams()
  if (normalized.entityType) params.set('entity_type', normalized.entityType)
  if (normalized.entityId) params.set('entity_id', normalized.entityId)
  if (normalized.actorType) params.set('actor_type', normalized.actorType)
  if (normalized.actorId) params.set('actor_id', normalized.actorId)
  if (normalized.action) params.set('action', normalized.action)
  if (normalized.from) params.set('from', normalized.from)
  if (normalized.to) params.set('to', normalized.to)
  if (cursor !== null) params.set('cursor', String(cursor))
  params.set('limit', String(limit))
  return `/api/admin/journal?${params.toString()}`
}

export const journalDateRange = (filters: JournalFilters): [number, number] | null => {
  if (!filters.from || !filters.to) return null
  const from = new Date(filters.from)
  const to = new Date(filters.to)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null
  from.setHours(0, 0, 0, 0)
  to.setHours(0, 0, 0, 0)
  return [from.getTime(), to.getTime()]
}

export const withJournalDateRange = (
  filters: JournalFilters,
  range: [number, number] | null
): JournalFilters => {
  if (!range) return { ...filters, from: '', to: '' }
  const from = new Date(range[0])
  const to = new Date(range[1])
  from.setHours(0, 0, 0, 0)
  to.setHours(23, 59, 59, 999)
  return { ...filters, from: from.toISOString(), to: to.toISOString() }
}

export const journalChangeRows = (details: Record<string, unknown>): JournalChangeRow[] => {
  const changes = details.changes
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) return []
  return Object.entries(changes as Record<string, unknown>).map(([field, raw]) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return { field, label: field, before: raw, redacted: false }
    }
    const value = raw as Record<string, unknown>
    return {
      field,
      label: field,
      before: value.before,
      after: value.after,
      redacted: value.redacted === true
    }
  })
}

export const journalOtherDetails = (details: Record<string, unknown>): Array<[string, unknown]> => {
  return Object.entries(details).filter(([key]) => key !== 'version' && key !== 'changes')
}

export const formatJournalValue = (value: unknown): string => {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'string') return value || '""'
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value, null, 2)
}

export const formatJournalDate = (value: string): string => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date)
}

export const formatJournalTime = (value: string): string => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(date)
}

export const formatJournalDateTime = (value: string): string => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(date)
}

export const journalRecordPath = (event: API.JournalEvent): string | null => {
  if (event.entity_type !== 'record' || !/^\d+$/.test(event.entity_id)) return null
  return `/records/${event.entity_id}`
}
