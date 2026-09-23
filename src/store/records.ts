import { computed, reactive } from 'vue'
import type API from './api'
import Api from '@/utils/Api'
import Auth from '@/utils/Auth'

interface ListResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

// Records (repair tickets) list, plus the client-side filters that drive the sidebar.
const state = reactive({
  items: {} as {
    [k: API.Record['id']]: API.Record
  },
  filters: {} as {
    [key: string]: {
      value: string
      filter: (record: API.Record) => boolean
    }[]
  },
  // next page to fetch for "load more"
  page: 1,
  // highest page reached so far, used to know how much to reload on refresh()
  loadedPages: 0,
  loading: false,
})

const fetchPage = async (target: number) => {
  const response = (await Api.get<ListResponse<API.Record>>(`/api/admin/records?page=${target}`)).data
  response.items.forEach((record) => {
    state.items[record.id] = record
  })
  state.loadedPages = Math.max(state.loadedPages, target)
  state.page = target + 1
}

const loadMore = async () => {
  if (state.loading) return
  state.loading = true
  try {
    await Auth.ready()
    await fetchPage(state.page)
  } finally {
    state.loading = false
  }
}

// Reload every page that has already been loaded, preserving list depth and filters.
const refresh = async () => {
  if (state.loading) return
  state.loading = true
  try {
    await Auth.ready()
    const pages = Math.max(state.loadedPages, 1)
    state.items = {}
    state.page = 1
    state.loadedPages = 0
    for (let target = 1; target <= pages; target++) {
      await fetchPage(target)
    }
  } finally {
    state.loading = false
  }
}

const ensureLoaded = async () => {
  if (Object.keys(state.items).length > 0) return
  await refresh()
}

const updateStatus = async (id: number, status: string, worker_desc?: string) => {
  const payload: Record<string, unknown> = { status }
  if (worker_desc !== undefined) {
    payload.worker_desc = worker_desc
  }
  const res = await Api.put<API.Record>(`/api/admin/records/${id}`, payload)
  state.items[id] = res.data
}

const markConfirmed = async (id: number) => {
  const res = await Api.post<API.Record>(`/api/admin/records/${id}/confirm`)
  state.items[id] = res.data
}

const markArrived = async (id: number) => {
  const res = await Api.post<API.Record>(`/api/admin/records/${id}/arrive`)
  state.items[id] = res.data
}

const markInProgress = async (id: number) => {
  const res = await Api.post<API.Record>(`/api/admin/records/${id}/in-progress`)
  state.items[id] = res.data
}

const markCompleted = async (id: number) => {
  const res = await Api.post<API.Record>(`/api/admin/records/${id}/complete`)
  state.items[id] = res.data
}

const markRejected = async (id: number, reason: string) => {
  const res = await Api.post<API.Record>(`/api/admin/records/${id}/reject`, { reason })
  state.items[id] = res.data
}

const markReferred = async (id: number, reason?: string) => {
  const res = await Api.post<API.Record>(`/api/admin/records/${id}/refer`, { reason })
  state.items[id] = res.data
}

const markNoShow = async (id: number) => {
  const res = await Api.post<API.Record>(`/api/admin/records/${id}/no-show`)
  state.items[id] = res.data
}

const revertRecord = async (id: number) => {
  const res = await Api.post<API.Record>(`/api/admin/records/${id}/revert`)
  state.items[id] = res.data
  return res.data
}

const filterRecord = (record: API.Record, filters: typeof state.filters) => {
  let result = true
  for (const key in filters) {
    const filterList = filters[key]
    const res = filterList.reduce<boolean>((pre, f) => f.filter(record) || pre, false)
    result &&= res
  }
  return result
}

const visibility = computed(
  () =>
    Object.keys(state.items)
      .map((key) => {
        return filterRecord(state.items[parseInt(key)], state.filters) ? parseInt(key) : null
      })
      .filter((value) => value !== null) as number[]
)

const prevRecord = (id: number) => {
  const index = visibility.value.indexOf(id)
  if (index - 1 < 0) {
    return null
  }
  return visibility.value[index - 1]
}

const nextRecord = (id: number) => {
  const index = visibility.value.indexOf(id)
  if (index + 1 >= visibility.value.length) {
    return null
  }
  return visibility.value[index + 1]
}

const isPrevRecordExist = (id: number) => {
  const index = visibility.value.indexOf(id)
  return index - 1 >= 0
}

const isNextRecordExist = (id: number) => {
  const index = visibility.value.indexOf(id)
  return index + 1 < visibility.value.length
}

export default reactive({
  state,
  visibility,
  prevRecord,
  nextRecord,
  isPrevRecordExist,
  isNextRecordExist,
  loadMore,
  refresh,
  ensureLoaded,
  updateStatus,
  markConfirmed,
  markArrived,
  markInProgress,
  markCompleted,
  markRejected,
  markReferred,
  markNoShow,
  revertRecord,
})
