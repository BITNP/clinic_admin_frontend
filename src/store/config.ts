import { reactive } from 'vue'
import Api from '@/utils/Api'
import type API from './api'

const state = reactive({
  groups: [] as API.ConfigGroup[],
  items: [] as API.ConfigItem[],
  loaded: false,
  loading: false
})

const load = async () => {
  state.loading = true
  try {
    const res = await Api.get<API.ConfigCatalog>('/api/admin/config')
    state.groups = res.data.groups
    state.items = res.data.items
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

const itemsForGroup = (groupId: number) => state.items.filter((item) => item.group_id === groupId)

const updateValue = async (id: number, value: string) => {
  const res = await Api.put<API.ConfigItem>(`/api/admin/config/items/${id}`, { value })
  const index = state.items.findIndex((item) => item.id === id)
  if (index >= 0) state.items[index] = res.data
  return res.data
}

export default reactive({
  state,
  load,
  ensureLoaded,
  refresh,
  isLoaded,
  itemsForGroup,
  updateValue
})
