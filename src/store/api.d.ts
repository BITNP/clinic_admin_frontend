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

  // /api/admin/work-schedules
  type WorkSchedule = {
    id: number
    name: string
    start_date: DateString
    end_date: DateString
    enabled: boolean
    weekdays?: WorkScheduleWeekday[]
  }

  type WorkScheduleWeekday = {
    id: number
    work_schedule_id: number
    weekday: number
    start_time: string
    end_time: string
    room_id: number
    room?: Room
    staff?: WorkScheduleStaff[]
  }

  type WorkScheduleStaff = {
    id: number
    weekday_id: number
    staff_id: number
    staff?: Staff
  }

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
