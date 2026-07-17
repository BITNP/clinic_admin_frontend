import { reactive } from 'vue'
import type API from './api';
import Api from "@/utils/Api";
import { load as loadRecords } from './record'
import { probDescs, repairMethods } from '@/utils/constants';

interface ListResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

const store = reactive({
  isDrawerOpen: false,
  drawerScroll: 0,
  records: {} as {
    [k: API.Record['id']]: API.Record
  },
  filters: {} as {
    [key: string]: {
      value: string
      filter: (record: API.Record) => boolean
    }[]
  },
  campusList: [] as API.Room[],
  dateList: [] as API.ServiceDate[],
  repairMethods: [] as API.RecordDesc[],
  probDescs: [] as API.RecordDesc[],
  history: new Map<API.Record['id'], API.Record[]>(),
  announcementList: [] as API.IAnnouncement[],
})

const load = async () => {
  await loadRecords()

  const campusRes = await Api.get<ListResponse<API.Room>>('/api/admin/rooms')
  store.campusList = campusRes.data.items

  const datesRes = await Api.get<ListResponse<API.ServiceDate>>('/api/admin/service-dates')
  store.dateList = datesRes.data.items

  const announcementRes = await Api.get<ListResponse<API.IAnnouncement>>('/api/admin/announcements')
  store.announcementList = announcementRes.data.items

  console.debug("storeLoad: ", repairMethods)
  store.repairMethods = repairMethods
  store.probDescs = probDescs
}

//@ts-ignore
window.$store = store

export default store;
export { load }
