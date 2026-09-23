import { computed, reactive } from 'vue'
import Api from '@/utils/Api'
import type API from './api'

interface ListResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

// Announcements ("announcement" section). Keyed by id so edits/reloads are stable.
const state = reactive({
  items: {} as {
    [k: number]: API.IAnnouncement
  },
  loaded: false,
  loading: false,
})

const list = computed(() => Object.values(state.items))

const load = async () => {
  state.loading = true
  try {
    const res = await Api.get<ListResponse<API.IAnnouncement>>('/api/admin/announcements')
    const items: { [k: number]: API.IAnnouncement } = {}
    res.data.items.forEach((announcement) => {
      items[announcement.id] = announcement
    })
    state.items = items
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

const byId = (id: number) => state.items[id]

const upsert = (announcement: API.IAnnouncement) => {
  state.items[announcement.id] = announcement
}

export default reactive({
  state,
  list,
  byId,
  upsert,
  load,
  ensureLoaded,
  refresh,
  isLoaded,
})
