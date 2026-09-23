import { reactive } from 'vue'
import Api from '@/utils/Api'
import type API from './api'

// Work schedules ("work-schedule" section): list + currently selected detail.
const state = reactive({
  list: [] as API.WorkSchedule[],
  selected: null as API.WorkSchedule | null,
  validStaff: [] as API.Staff[],
  loaded: false,
  loading: false,
})

const loadList = async () => {
  state.loading = true
  try {
    const res = await Api.get<{ items: API.WorkSchedule[] }>('/api/admin/work-schedules/all')
    state.list = res.data.items
    state.loaded = true
  } finally {
    state.loading = false
  }
}

const ensureLoaded = async () => {
  if (!state.loaded) await loadList()
}

const loadDetail = async (id: number) => {
  const [detailRes, validRes] = await Promise.all([
    Api.get<API.WorkSchedule>(`/api/admin/work-schedules/${id}`),
    Api.get<{ items: API.Staff[] }>(`/api/admin/work-schedules/${id}/valid-staff`),
  ])
  state.selected = detailRes.data
  state.validStaff = validRes.data.items ?? []
}

// Read a schedule without disturbing the selected detail (used by schedule generation).
const getDetail = async (id: number) => {
  return (await Api.get<API.WorkSchedule>(`/api/admin/work-schedules/${id}`)).data
}

const refresh = async () => {
  await loadList()
  if (state.selected) await loadDetail(state.selected.id)
}

const isLoaded = () => state.loaded

const select = (id: number | null) => {
  if (id === null) {
    state.selected = null
    state.validStaff = []
  }
}

const create = async (payload: unknown) => {
  await Api.post('/api/admin/work-schedules', payload)
  await loadList()
}

const remove = async (id: number) => {
  await Api.delete(`/api/admin/work-schedules/${id}`)
  if (state.selected?.id === id) {
    state.selected = null
    state.validStaff = []
  }
  await loadList()
}

const updateMeta = async (id: number, payload: unknown) => {
  await Api.put(`/api/admin/work-schedules/${id}`, payload)
  await loadList()
  if (state.selected?.id === id) await loadDetail(id)
}

const setEnabled = async (id: number, enabled: boolean) => {
  await Api.put(`/api/admin/work-schedules/${id}`, { enabled })
}

const addStaff = async (scheduleId: number, body: unknown) => {
  await Api.post(`/api/admin/work-schedules/${scheduleId}/staff`, body)
  await loadDetail(scheduleId)
}

const removeStaff = async (scheduleId: number, body: unknown) => {
  await Api.delete(`/api/admin/work-schedules/${scheduleId}/staff`, { data: body })
  await loadDetail(scheduleId)
}

const updateWeekday = async (scheduleId: number, body: unknown) => {
  await Api.put(`/api/admin/work-schedules/${scheduleId}/weekdays`, body)
  await loadDetail(scheduleId)
}

const fetchAvailability = async (from: string, to: string, roomIds: number[]) => {
  const res = await Api.get<{ items: { room_id: number; date: string; available: boolean }[] }>(
    `/api/admin/work-schedules/service-availability?from=${from}&to=${to}&room_ids=${roomIds.join(',')}`
  )
  return res.data.items
}

export default reactive({
  state,
  loadList,
  ensureLoaded,
  loadDetail,
  getDetail,
  refresh,
  isLoaded,
  select,
  create,
  remove,
  updateMeta,
  setEnabled,
  addStaff,
  removeStaff,
  updateWeekday,
  fetchAvailability,
})
