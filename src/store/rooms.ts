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
  loaded: false,
  loading: false,
})

const load = async () => {
  state.loading = true
  try {
    const res = await Api.get<ListResponse<API.Room>>('/api/admin/rooms?pageSize=1000')
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

const update = async (id: number, payload: Partial<Pick<API.Room, 'name' | 'address' | 'enabled'>>) => {
  await Api.put<API.Room>(`/api/admin/rooms/${id}`, payload)
  await load()
}

const options = computed(() => state.list.map((room) => ({ label: room.name, value: room.id })))

export default reactive({
  state,
  options,
  load,
  ensureLoaded,
  refresh,
  isLoaded,
  update,
})
