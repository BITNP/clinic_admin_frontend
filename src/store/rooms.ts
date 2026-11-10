import { computed, reactive } from 'vue'
import Api from '@/utils/Api'
import type API from './api'

interface ListResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

// Shared reference data: campus/room list is needed by the records filter,
// schedule and work-schedule, so it lives on its own and can be refreshed alone.
const state = reactive({
  list: [] as API.Room[],
  campuses: [] as API.Campus[],
  loaded: false,
  loading: false,
})

const load = async () => {
  state.loading = true
  try {
    const [roomRes, campusRes] = await Promise.all([
      Api.get<ListResponse<API.Room>>('/api/admin/rooms?pageSize=1000'),
      Api.get<ListResponse<API.Campus>>('/api/admin/campuses?pageSize=1000'),
    ])
    state.list = roomRes.data.items
    state.campuses = campusRes.data.items
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

type RoomUpdatePayload = Partial<Pick<API.Room, 'name' | 'address' | 'enabled' | 'campus_id' | 'type'>>

type RoomCreatePayload = Pick<API.Room, 'name' | 'address' | 'campus_id'> & {
  type?: API.RoomType
}

const update = async (id: number, payload: RoomUpdatePayload) => {
  await Api.put<API.Room>(`/api/admin/rooms/${id}`, payload)
  await load()
}

const create = async (payload: RoomCreatePayload) => {
  await Api.post<API.Room>('/api/admin/rooms', payload)
  await load()
}

const remove = async (id: number) => {
  await Api.delete(`/api/admin/rooms/${id}`)
  await load()
}

const createCampus = async (payload: Pick<API.Campus, 'name'>) => {
  await Api.post<API.Campus>('/api/admin/campuses', payload)
  await load()
}

const updateCampus = async (id: number, payload: Partial<Pick<API.Campus, 'name'>>) => {
  await Api.put<API.Campus>(`/api/admin/campuses/${id}`, payload)
  await load()
}

const removeCampus = async (id: number) => {
  await Api.delete(`/api/admin/campuses/${id}`)
  await load()
}

const options = computed(() => state.list.map((room) => ({ label: room.name, value: room.id })))

const campusOptions = computed(() =>
  state.campuses.map((campus) => ({ label: campus.name, value: campus.id }))
)

export default reactive({
  state,
  options,
  campusOptions,
  load,
  ensureLoaded,
  refresh,
  isLoaded,
  update,
  create,
  remove,
  createCampus,
  updateCampus,
  removeCampus,
})
