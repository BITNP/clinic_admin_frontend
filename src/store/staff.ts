import { reactive } from 'vue'
import Api from '@/utils/Api'
import type API from './api'

// Staff list ("staff" section).
const state = reactive({
  list: [] as API.Staff[],
  loaded: false,
  loading: false,
})

const load = async () => {
  state.loading = true
  try {
    const res = await Api.get<{ items: API.Staff[] }>('/api/admin/staff')
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

export default reactive({
  state,
  load,
  ensureLoaded,
  refresh,
})
