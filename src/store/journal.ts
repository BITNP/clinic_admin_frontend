import { reactive } from 'vue'
import type API from './api'
import Api from '@/utils/Api'
import Auth from '@/utils/Auth'
import {
  emptyJournalFilters,
  journalFilterSignature,
  journalRequestURL,
  normalizeJournalEntityKinds,
  normalizeJournalFilters,
  normalizeJournalPage,
  type JournalFilters
} from '@/utils/Journal'

export const JOURNAL_PAGE_SIZE = 100

const state = reactive({
  filters: emptyJournalFilters(),
  entityKinds: [] as API.JournalEntityKind[],
  entityKindsLoaded: false,
  events: [] as API.JournalEvent[],
  selectedId: null as number | null,
  nextCursor: null as number | null,
  loaded: false,
  loading: false,
  loadingMore: false,
  entityKindsLoading: false,
  error: ''
})

let requestGeneration = 0
let requestController: AbortController | null = null

const errorText = (error: unknown): string => {
  const response = (
    error as { response?: { status?: number; data?: { error?: string; msg?: string } } }
  )?.response
  switch (response?.status) {
    case 401:
      return '登录已过期，请重新登录后重试。'
    case 403:
      return '没有权限查看业务日志。'
    default:
      return (
        response?.data?.error ||
        response?.data?.msg ||
        (error instanceof Error ? error.message : '') ||
        '日志加载失败，请稍后重试。'
      )
  }
}

const cancelActiveRequest = () => {
  requestGeneration += 1
  requestController?.abort()
  requestController = null
}

const beginRequest = () => {
  cancelActiveRequest()
  const generation = requestGeneration
  const controller = new AbortController()
  requestController = controller
  return { generation, controller }
}

const finishRequest = (generation: number, controller: AbortController) => {
  if (generation === requestGeneration && requestController === controller) {
    state.loading = false
    state.loadingMore = false
    requestController = null
  }
}

const selectedEvent = () => {
  return state.events.find((event) => event.id === state.selectedId) ?? null
}

const select = (id: number) => {
  state.selectedId = id
}

const normalizeSelection = (preserve: boolean) => {
  const exists = state.events.some((event) => event.id === state.selectedId)
  if (!preserve || !exists) {
    state.selectedId = state.events[0]?.id ?? null
  }
}

const loadEntityKinds = async () => {
  state.entityKindsLoading = true
  try {
    const response = await Api.get<unknown>('/api/admin/journal/entity-kinds')
    state.entityKinds = normalizeJournalEntityKinds(response.data)
    state.entityKindsLoaded = true
  } finally {
    state.entityKindsLoading = false
  }
}

const fetchPage = async (
  filters: JournalFilters,
  cursor: number | null,
  signal?: AbortSignal
): Promise<API.JournalPage> => {
  const response = await Api.get<unknown>(journalRequestURL(filters, cursor, JOURNAL_PAGE_SIZE), {
    signal
  })
  return normalizeJournalPage(response.data)
}

const loadFirst = async (nextFilters: JournalFilters, clearSelection = true) => {
  const { generation, controller } = beginRequest()
  state.filters = normalizeJournalFilters(nextFilters)
  state.loading = true
  state.loadingMore = false
  state.error = ''

  try {
    await Auth.ready()
    const page = await fetchPage(state.filters, null, controller.signal)
    if (generation !== requestGeneration) return
    state.events = page.items
    state.nextCursor = page.next_cursor
    state.loaded = true
    normalizeSelection(!clearSelection)
  } catch (error) {
    if (controller.signal.aborted || generation !== requestGeneration) return
    state.error = errorText(error)
    throw error
  } finally {
    finishRequest(generation, controller)
  }
}

const ensureLoaded = async (filters: JournalFilters = state.filters) => {
  const normalized = normalizeJournalFilters(filters)
  if (
    state.loaded &&
    journalFilterSignature(normalized) === journalFilterSignature(state.filters)
  ) {
    if (!state.entityKindsLoaded) await loadEntityKinds()
    return
  }
  await Promise.all([loadEntityKinds(), loadFirst(normalized)])
}

const applyFilters = async (filters: JournalFilters) => {
  await loadFirst(filters, true)
}

const resetFilters = async () => {
  await loadFirst(emptyJournalFilters(), true)
}

const appendUnique = (target: API.JournalEvent[], items: API.JournalEvent[]) => {
  const known = new Set(target.map((event) => event.id))
  for (const event of items) {
    if (!known.has(event.id)) {
      known.add(event.id)
      target.push(event)
    }
  }
}

const lastEventID = (events: API.JournalEvent[]): number | null => {
  return events.length ? events[events.length - 1].id : null
}

// Background sync reloads the current filter from the newest event. It keeps
// fetching cursor pages until the previous oldest event is covered, preserving
// the user's loaded history while prepending new events.
const refresh = async () => {
  if (!state.loaded || state.loading || state.loadingMore) return

  const { generation, controller } = beginRequest()
  const previousOldest = lastEventID(state.events)
  const fresh: API.JournalEvent[] = []
  let nextCursor: number | null
  let cursor: number | null = null
  state.loading = true
  state.error = ''

  try {
    await Auth.ready()
    do {
      const page = await fetchPage(state.filters, cursor, controller.signal)
      if (generation !== requestGeneration) return
      appendUnique(fresh, page.items)
      nextCursor = page.next_cursor
      if (previousOldest === null || nextCursor === null) break
      const oldestFetched = lastEventID(fresh)
      if (oldestFetched !== null && oldestFetched <= previousOldest) break
      cursor = nextCursor
    } while (nextCursor !== null)

    state.events = fresh
    state.nextCursor = nextCursor
    normalizeSelection(true)
    try {
      await loadEntityKinds()
    } catch {
      // Event refresh remains useful even if filter metadata is temporarily unavailable.
    }
  } catch (error) {
    if (controller.signal.aborted || generation !== requestGeneration) return
    state.error = errorText(error)
    throw error
  } finally {
    finishRequest(generation, controller)
  }
}

const loadMore = async () => {
  if (!state.loaded || state.nextCursor === null || state.loading || state.loadingMore) return
  const { generation, controller } = beginRequest()
  const cursor = state.nextCursor
  state.loadingMore = true
  state.error = ''

  try {
    const page = await fetchPage(state.filters, cursor, controller.signal)
    if (generation !== requestGeneration) return
    appendUnique(state.events, page.items)
    state.nextCursor = page.next_cursor
  } catch (error) {
    if (controller.signal.aborted || generation !== requestGeneration) return
    state.error = errorText(error)
    throw error
  } finally {
    finishRequest(generation, controller)
  }
}

const isLoaded = () => state.loaded || state.loading

export default reactive({
  state,
  selectedEvent,
  select,
  loadEntityKinds,
  ensureLoaded,
  applyFilters,
  resetFilters,
  refresh,
  loadMore,
  isLoaded
})
