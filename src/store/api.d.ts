namespace API {
  type DateString = string
  type TimeString = string

  // /api/admin/rooms
  type Room = {
    id: number
    name: string
    address: string
    enabled: boolean
  }

  // /api/admin/service-dates
  type ServiceDate = {
    id: number
    capacity: number
    room_id: number
    date: DateString
    startTime: string
    endTime: string
    title: string
    count: number
  }

  // /api/users/me/ or /api/user/
  interface IUsers {
    id: number
    account_id: string
    realname: string
    phone_num: string
    role: string
  }

  // /api/admin/records
  type Record = {
    id: number
    user: string
    realname: string
    phone_num: string
    status: string
    appointment_time: DateString
    description: string
    campus: string
    worker_desc: string
    reject_reason: string
    referral_reason: string
    model: string
    password: string
    arrive_time: string | null
    finish_time: string | null
    worker_id: number | null
  }

  interface IRecords {
    items: Record[]
    total: number
    page: number
    pageSize: number
  }

  type RecordDesc = {
    label: string,
    value: string,
    children?: RecordDesc[]
  }

  interface IAnnouncement {
    id: number
    title: string
    content: string
    brief: string
    priority: number
    tag: AnnouncementTags
    createdTime: string
    lastEditedTime: string
    expireDate: DateString
  }

  type AnnouncementTags = "tos" | "pinned" | "normal"

  // /api/admin/staff
  type Staff = {
    id: number
    account_id: string
    realname: string
    phone_num: string
    role: string
    handled_count: number
    work_years: number[]
  }
}

export default API
