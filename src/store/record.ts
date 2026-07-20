import { computed, ref } from "vue";
import type API from "./api";
import Api from "@/utils/Api";
import store from ".";
import Auth from "@/utils/Auth";

interface ListResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

const nextRecordsPage = ref(1)

const load = async () => {
  await Auth.ready()
  const page = nextRecordsPage.value
  nextRecordsPage.value += 1
  const response = (await Api.get<ListResponse<API.Record>>(`/api/admin/records?page=${page}`)).data
  response.items.forEach((record) => {
    store.records[record.id] = record
  })
}

const updateStatus = async (id: number, status: string, worker_desc?: string) => {
  const payload: Record<string, unknown> = { status }
  if (worker_desc !== undefined) {
    payload.worker_desc = worker_desc
  }
  const res = await Api.put<API.Record>(`/api/admin/records/${id}`, payload)
  store.records[id] = res.data
}

const markConfirmed = async (id: number) => {
  const res = await Api.post<API.Record>(`/api/admin/records/${id}/confirm`)
  store.records[id] = res.data
}

const markArrived = async (id: number) => {
  const res = await Api.post<API.Record>(`/api/admin/records/${id}/arrive`)
  store.records[id] = res.data
}

const markInProgress = async (id: number) => {
  const res = await Api.post<API.Record>(`/api/admin/records/${id}/in-progress`)
  store.records[id] = res.data
}

const markCompleted = async (id: number) => {
  const res = await Api.post<API.Record>(`/api/admin/records/${id}/complete`)
  store.records[id] = res.data
}

const markRejected = async (id: number, reason: string) => {
  const res = await Api.post<API.Record>(`/api/admin/records/${id}/reject`, { reason })
  store.records[id] = res.data
}

const markReferred = async (id: number, reason?: string) => {
  const res = await Api.post<API.Record>(`/api/admin/records/${id}/refer`, { reason })
  store.records[id] = res.data
}

const markNoShow = async (id: number) => {
  const res = await Api.post<API.Record>(`/api/admin/records/${id}/no-show`)
  store.records[id] = res.data
}

const revertRecord = async (id: number) => {
  const history = store.history.get(id)
  if (!history || history.length === 0) return
  const last = history.pop()!
  store.records[id] = last
  return last
}

const filter = (record: API.Record, filters: typeof store.filters) => {
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
    Object.keys(store.records)
      .map((key) => {
        return filter(store.records[parseInt(key)], store.filters) ? parseInt(key) : null
      })
      .filter((value) => value !== null) as number[]
)

const prevRecord = ((id: number) => {
  const index = visibility.value.indexOf(id)
  if (index - 1 < 0) {
    return null
  }
  return visibility.value[index - 1]
})

const nextRecord = ((id: number) => {
  const index = visibility.value.indexOf(id)
  if (index + 1 >= visibility.value.length) {
    return null
  }
  return visibility.value[index + 1]
})

const isPrevRecordExist = ((id: number) => {
  const index = visibility.value.indexOf(id)
  if (index - 1 < 0) {
    return false
  }
  return true
})

const isNextRecordExist = ((id: number) => {
  const index = visibility.value.indexOf(id)
  if (index + 1 >= visibility.value.length) {
    return false
  }
  return true
})

//@ts-ignore
window.$update = updateStatus

export {
  load,
  updateStatus,
  markConfirmed,
  markArrived,
  markInProgress,
  markCompleted,
  markRejected,
  markReferred,
  markNoShow,
  revertRecord,
  visibility,
  nextRecord,
  prevRecord,
  isPrevRecordExist,
  isNextRecordExist
}
