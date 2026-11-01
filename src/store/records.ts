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

type RecordFilters = {
  status: string
  roomID: number | null
  date: string
}

type RecordQuery = Partial<RecordFilters & { realname: string }>

// Records (repair tickets) list, plus the server-side filters that drive the sidebar.
const state = reactive({
  items: {} as {
    [k: API.Record['id']]: API.Record
  },
  // Active server-side filters. Empty strings and null mean "no filter".
  filters: {
    status: '',
    roomID: null as number | null,
    date: ''
  } as RecordFilters,
  // Active server-side realname search term. Empty means no search filter.
  realname: '',
  // next page to fetch for "load more"
  page: 1,
  // highest page reached so far, used to know how much to reload on refresh()
  loadedPages: 0,
  loading: false,
  // Incremented whenever the record list is refreshed from the server. Views
  // that cache per-record data (such as photo lists) use this to refresh even
  // when photo_count did not change.
  revision: 0,
  // Cache-busting versions keyed by record and photo id. Image URLs contain
  // positions, so ordering refreshes the sources after a reorder as well.
  photoVersions: {} as Record<number, Record<number, number>>
})

const fetchPageData = async (target: number) => {
  const params = new URLSearchParams({ page: String(target) })
  if (state.realname) {
    params.set('realname', state.realname)
  }
  if (state.filters.status) {
    params.set('status', state.filters.status)
  }
  if (state.filters.roomID !== null) {
    params.set('room_id', String(state.filters.roomID))
  }
  if (state.filters.date) {
    params.set('from_date', state.filters.date)
    params.set('to_date', state.filters.date)
  }
  return (await Api.get<ListResponse<API.Record>>(`/api/admin/records?${params.toString()}`)).data
}

const fetchPage = async (target: number) => {
  const response = await fetchPageData(target)
  response.items.forEach((record) => {
    state.items[record.id] = record
  })
  state.loadedPages = Math.max(state.loadedPages, target)
  state.page = target + 1
}

// Serialize list requests. A refresh must run after an in-flight request, since
// that request may have read its snapshot before the change that triggered sync.
let listLoad: Promise<void> = Promise.resolve()

const queueListLoad = (load: () => Promise<void>) => {
  state.loading = true
  // A failed previous load must not block the next one. Its own caller still
  // receives the rejection; sync can retry a failed refresh as usual.
  const result = listLoad.then(load, load)
  listLoad = result
  return result.finally(() => {
    if (listLoad === result) state.loading = false
  })
}

const loadMore = async () => {
  if (state.loading) return
  await queueListLoad(async () => {
    await Auth.ready()
    await fetchPage(state.page)
  })
}

// Reload every page that has already been loaded, preserving list depth and filters.
// Records are fetched into a fresh map and swapped in at the end so the list is never
// momentarily emptied; that keeps the sidebar's scroll position intact during the
// background (auto) refresh. A manually reloaded page starts empty, so it still
// opens at the top.
const refresh = async () => {
  await queueListLoad(async () => {
    await Auth.ready()
    const pages = Math.max(state.loadedPages, 1)
    const next: typeof state.items = {}
    for (let target = 1; target <= pages; target++) {
      const response = await fetchPageData(target)
      response.items.forEach((record) => {
        next[record.id] = record
      })
    }
    state.items = next
    state.loadedPages = pages
    state.page = pages + 1
    state.revision += 1
  })
}

const ensureLoaded = async () => {
  if (Object.keys(state.items).length > 0) return
  await refresh()
}

// Resolve a partial query against the active filters so callers such as the
// campus badge can change one field without clearing the rest.
const resolveQuery = (query: RecordQuery): Required<RecordQuery> => ({
  realname: query.realname !== undefined ? query.realname.trim() : state.realname,
  status: query.status !== undefined ? query.status : state.filters.status,
  roomID: query.roomID !== undefined ? query.roomID : state.filters.roomID,
  date: query.date !== undefined ? query.date : state.filters.date
})

const queryKey = (query: Required<RecordQuery>) => JSON.stringify(query)

// Apply server-side filters and reload the first page. The query is resolved
// inside the queued load so requests already in flight keep the filters they
// were created with, and submitting the same query again is a no-op.
const applyQuery = async (query: RecordQuery = {}) => {
  await queueListLoad(async () => {
    await Auth.ready()
    const next = resolveQuery(query)
    if (queryKey(next) === queryKey(resolveQuery({}))) return

    state.realname = next.realname
    state.filters.status = next.status
    state.filters.roomID = next.roomID
    state.filters.date = next.date

    const response = await fetchPageData(1)
    const items: typeof state.items = {}
    response.items.forEach((record) => {
      items[record.id] = record
    })
    state.items = items
    state.loadedPages = 1
    state.page = 2
    state.revision += 1
  })
}

// Include the initial load so sync queues changes that arrive during it.
const isLoaded = () => state.loadedPages > 0 || state.loading

const updateWorkerDesc = async (id: number, workerDesc: string) => {
  const res = await Api.put<API.Record>(`/api/admin/records/${id}`, {
    worker_desc: workerDesc
  })
  state.items[id] = res.data
  return res.data
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

// Refetch a single record and update the store. Used after a failed revert so
// the revertible fields reflect the server rather than a stale client view.
const reloadRecord = async (id: number) => {
  const res = await Api.get<API.Record>(`/api/admin/records/${id}`)
  state.items[id] = res.data
  return res.data
}

const listRecordPhotos = async (id: number): Promise<API.RecordPhotoList> => {
  const res = await Api.get<API.RecordPhotoList>(`/api/admin/records/${id}/photos`)
  return res.data
}

const appendRecordPhoto = async (id: number, file: File): Promise<API.RecordPhoto> => {
  const form = new FormData()
  form.append('photo', file, file.name || 'photo')
  const res = await Api.post<API.RecordPhoto>(`/api/admin/records/${id}/photos`, form)
  const record = state.items[id]
  if (record) {
    record.photo_count = (record.photo_count ?? 0) + 1
  }
  return res.data
}

const deleteRecordPhoto = async (id: number, position: number): Promise<void> => {
  await Api.delete(`/api/admin/records/${id}/photos/${position}`)
  const record = state.items[id]
  if (record) {
    record.photo_count = Math.max(0, (record.photo_count ?? 0) - 1)
  }
}

const reorderRecordPhotos = async (
  id: number,
  expectedPhotoIds: number[],
  photoIds: number[]
): Promise<API.RecordPhotoList> => {
  const body: API.RecordPhotoOrderRequest = {
    expected_photo_ids: expectedPhotoIds,
    photo_ids: photoIds
  }
  const res = await Api.put<API.RecordPhotoList>(`/api/admin/records/${id}/photos/order`, body)
  return res.data
}

const bumpPhotoVersion = (recordId: number, photoId: number) => {
  const versions = state.photoVersions[recordId] ?? {}
  const version = Math.max(Date.now(), (versions[photoId] ?? 0) + 1)
  state.photoVersions = {
    ...state.photoVersions,
    [recordId]: { ...versions, [photoId]: version }
  }
}

// Append the per-photo version after ordering so the browser fetches image
// bytes for the new positions instead of reusing cached content.
const photoSrc = (recordId: number, photo: API.RecordPhoto) => {
  const version = state.photoVersions[recordId]?.[photo.id]
  return version ? `${photo.url}?v=${version}` : photo.url
}

// The server has already applied the active filters, so every loaded record is
// visible. Keep this list for the sidebar and the prev/next record navigation.
const visibility = computed(() => Object.keys(state.items).map((key) => parseInt(key)))

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
  applyQuery,
  ensureLoaded,
  isLoaded,
  updateWorkerDesc,
  markConfirmed,
  markArrived,
  markInProgress,
  markCompleted,
  markRejected,
  markReferred,
  markNoShow,
  revertRecord,
  reloadRecord,
  listRecordPhotos,
  appendRecordPhoto,
  deleteRecordPhoto,
  reorderRecordPhotos,
  bumpPhotoVersion,
  photoSrc
})
