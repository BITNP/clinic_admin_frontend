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
    const res = await Api.get<ListResponse<API.Room>>('/api/admin/rooms')
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

const options = computed(() => state.list.map((room) => ({ label: room.name, value: room.id })))

export default reactive({
  state,
  options,
  load,
  ensureLoaded,
  refresh,
})
