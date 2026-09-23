import { reactive } from 'vue'
import Api from '@/utils/Api'
import type API from './api'

interface ListResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

// Service dates ("schedule" section).
const state = reactive({
  list: [] as API.ServiceDate[],
  loaded: false,
  loading: false,
})

const load = async () => {
  state.loading = true
  try {
    const res = await Api.get<ListResponse<API.ServiceDate>>('/api/admin/service-dates')
    state.list = res.data.items
    state.loaded = true
  } finally {
    state.loading = false
  }
}

const ensureLoaded = async () => {
  if (!state.loaded) await load()
}

const refresh = async () => {
  await load()
}

const isLoaded = () => state.loaded

// Dates already occupied in a room, used by the add/edit form date pickers.
const fetchBusyDates = async (roomId: number, all = false) => {
  const path = all
    ? `/api/admin/service-dates/all?room_ids=${roomId}&pageSize=1000`
    : `/api/admin/service-dates?room_ids=${roomId}&pageSize=1000`
  const res = await Api.get<{ items: API.ServiceDate[] }>(path)
  return res.data.items.map((item) => item.date.slice(0, 10))
}

const createMany = async (payloads: unknown[]) => {
  await Promise.all(payloads.map((payload) => Api.post('/api/admin/service-dates', payload)))
  await refresh()
}

const update = async (id: number | string, payload: unknown) => {
  await Api.put(`/api/admin/service-dates/${id}`, payload)
  await refresh()
}

const remove = async (id: number) => {
  await Api.delete(`/api/admin/service-dates/${id}`)
  await refresh()
}

export default reactive({
  state,
  load,
  ensureLoaded,
  refresh,
  isLoaded,
  fetchBusyDates,
  createMany,
  update,
  remove,
})
