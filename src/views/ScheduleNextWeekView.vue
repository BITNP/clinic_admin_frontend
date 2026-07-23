<template>
  <PageWrapper title="生成下周服务时间">
    <n-h3>选择日期范围</n-h3>
    <n-space>
      <n-button
        v-for="(day, idx) in weekdayLabels"
        :key="idx"
        :type="isDaySelected(idx) ? 'success' : 'default'"
        :style="{ width: '56px', height: '56px', '--n-border-radius': '0px' }"
        @click="handleDayClick(idx)"
      >
        {{ day }}
      </n-button>
    </n-space>
    <n-text depth="3" style="font-size: 0.85rem;">将根据当前排班中各校区的人员安排，自动过滤无人员的日期。</n-text>

    <n-h3>选择校区</n-h3>
    <n-space v-if="availableRooms.length" wrap>
      <n-button
        v-for="room in availableRooms"
        :key="room.id"
        :type="selectedRoomIds.includes(room.id) ? 'success' : 'default'"
        :style="{ height: '56px', '--n-border-radius': '0px', padding: '0 16px' }"
        @click="toggleRoom(room.id)"
      >
        {{ room.name }}
      </n-button>
    </n-space>
    <n-text v-else depth="3">暂无可用校区，请先启用一个排班</n-text>

    <n-h3>设置容量</n-h3>
    <n-space align="center">
      <n-button :disabled="capacity <= 1" @click="capacity--">-</n-button>
      <n-input-number v-model:value="capacity" :min="1" style="width: 100px" />
      <n-button @click="capacity++">+</n-button>
    </n-space>

    <n-h3>服务时间</n-h3>
    <n-space align="center">
      <n-time-picker v-model:value="formValue.startTime" placeholder="开始时间" style="width: 150px" />
      <n-text depth="3">至</n-text>
      <n-time-picker v-model:value="formValue.endTime" placeholder="结束时间" style="width: 150px" />
    </n-space>

    <n-h3>预览 (共 {{ plannedEntries.length }} 条)</n-h3>
    <n-table v-if="plannedEntries.length" :bordered="true" :single-line="false" size="small">
      <thead>
        <tr>
          <th>日期</th>
          <th>星期</th>
          <th>校区</th>
          <th>开始时间</th>
          <th>结束时间</th>
          <th>容量</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(entry, idx) in plannedEntries" :key="idx">
          <td>{{ entry.dateStr }}</td>
          <td>{{ entry.weekdayLabel }}</td>
          <td>{{ entry.roomName }}</td>
          <td>{{ entry.startTimeStr }}</td>
          <td>{{ entry.endTimeStr }}</td>
          <td>{{ entry.capacity }}</td>
        </tr>
      </tbody>
    </n-table>
    <n-empty v-else description="所选校区在选定日期内无排班人员，请调整日期或校区选择" />

    <n-form-item>
      <n-space>
        <n-button type="primary" @click="handleSubmit" :loading="loading" style="width: 150px">提交</n-button>
        <n-button @click="router.back()">返回</n-button>
      </n-space>
    </n-form-item>
  </PageWrapper>
</template>

<script lang="ts" setup>
import { ref, computed, reactive, onMounted } from 'vue'
import store, { load } from "@/store"
import type API from "@/store/api"
import { useRouter } from 'vue-router'
import Api from "@/utils/Api"
import Auth from "@/utils/Auth"
import { useMessage } from 'naive-ui'
import PageWrapper from '@/components/PageWrapper.vue'

const router = useRouter()
const message = useMessage()

const weekdayLabels = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

const rangeStart = ref(0)
const rangeEnd = ref(6)

const isDaySelected = (i: number) => {
  const s = Math.min(rangeStart.value, rangeEnd.value)
  const e = Math.max(rangeStart.value, rangeEnd.value)
  return i >= s && i <= e
}

const handleDayClick = (i: number) => {
  if (rangeStart.value === rangeEnd.value) {
    rangeEnd.value = i
  } else {
    rangeStart.value = i
    rangeEnd.value = i
  }
}

interface RoomOption {
  id: number
  name: string
}

const availableRooms = ref<RoomOption[]>([])
const selectedRoomIds = ref<number[]>([])

const toggleRoom = (id: number) => {
  const idx = selectedRoomIds.value.indexOf(id)
  if (idx >= 0) {
    selectedRoomIds.value.splice(idx, 1)
  } else {
    selectedRoomIds.value.push(id)
  }
}

const availability = ref<Map<string, boolean>>(new Map())

const isAvailable = (roomId: number, dateStr: string) => {
  return availability.value.get(`${roomId}-${dateStr}`) === true
}

const capacity = ref(10)

const formValue = reactive({
  startTime: new Date().setHours(18, 30, 0, 0),
  endTime: new Date().setHours(21, 0, 0, 0),
})

const formatDate = (ms: number) => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`
}

const formatTime = (ms: number) => {
  const d = new Date(ms)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

const nextWeekDates = computed(() => {
  const today = new Date()
  const dayOfWeek = today.getDay()
  const mondayThisWeek = new Date(today)
  mondayThisWeek.setDate(today.getDate() - ((dayOfWeek + 6) % 7))
  const mondayNextWeek = new Date(mondayThisWeek)
  mondayNextWeek.setDate(mondayThisWeek.getDate() + 7)
  const dates: number[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(mondayNextWeek)
    d.setDate(mondayNextWeek.getDate() + i)
    dates.push(d.getTime())
  }
  return dates
})

interface PlannedEntry {
  dateStr: string
  weekdayLabel: string
  roomName: string
  roomId: number
  dateMs: number
  startTimeStr: string
  endTimeStr: string
  capacity: number
}

const plannedEntries = computed(() => {
  const entries: PlannedEntry[] = []
  const start = Math.min(rangeStart.value, rangeEnd.value)
  const end = Math.max(rangeStart.value, rangeEnd.value)

  for (const roomId of selectedRoomIds.value) {
    const room = availableRooms.value.find(r => r.id === roomId)
    if (!room) continue
    for (let i = start; i <= end; i++) {
      const dateStr = formatDate(nextWeekDates.value[i])
      if (!isAvailable(roomId, dateStr)) continue
      entries.push({
        dateStr,
        weekdayLabel: weekdayLabels[i],
        roomName: room.name,
        roomId: room.id,
        dateMs: nextWeekDates.value[i],
        startTimeStr: formatTime(formValue.startTime),
        endTimeStr: formatTime(formValue.endTime),
        capacity: capacity.value,
      })
    }
  }

  entries.sort((a, b) => {
    if (a.dateStr !== b.dateStr) return a.dateStr.localeCompare(b.dateStr)
    return a.roomName.localeCompare(b.roomName)
  })

  return entries
})

const loading = ref(false)

const toRFC3339 = (dateMs: number, timeMs?: number) => {
  const d = new Date(dateMs)
  if (timeMs !== undefined) {
    const t = new Date(timeMs)
    d.setHours(t.getHours(), t.getMinutes(), t.getSeconds(), 0)
  }
  return d.toISOString()
}

const handleSubmit = async () => {
  if (!selectedRoomIds.value.length) {
    message.error('请至少选择一个校区')
    return
  }
  if (formValue.startTime >= formValue.endTime) {
    message.error('结束时间必须晚于开始时间')
    return
  }

  loading.value = true
  try {
    const start = Math.min(rangeStart.value, rangeEnd.value)
    const end = Math.max(rangeStart.value, rangeEnd.value)
    const payloads: any[] = []

    for (const roomId of selectedRoomIds.value) {
      for (let i = start; i <= end; i++) {
        const dateMs = nextWeekDates.value[i]
        const dateStr = formatDate(dateMs)
        if (!isAvailable(roomId, dateStr)) continue
        payloads.push({
          title: '正常服务',
          room_id: roomId,
          capacity: capacity.value,
          date: toRFC3339(dateMs),
          startTime: toRFC3339(dateMs, formValue.startTime),
          endTime: toRFC3339(dateMs, formValue.endTime),
        })
      }
    }

    if (!payloads.length) {
      message.error('所选校区在选定日期内无排班人员，无法生成服务时间')
      loading.value = false
      return
    }

    await Promise.all(payloads.map(p => Api.post('/api/admin/service-dates', p)))
    message.success('服务时间已创建')
    router.push('/schedule')
  } catch (e: any) {
    const errMsg = e.response?.data?.error || e.message || '提交失败'
    message.error(errMsg)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  if (!store.campusList.length) {
    await load()
  }
  await Auth.auth()

  try {
    const res = await Api.get<{ items: API.WorkSchedule[] }>('/api/admin/work-schedules/all')
    const enabled = res.data.items.find(s => s.enabled)

    if (enabled) {
      try {
        const detailRes = await Api.get<API.WorkSchedule>(`/api/admin/work-schedules/${enabled.id}`)
        const detail = detailRes.data
        if (detail.weekdays?.length) {
          const roomIds = new Set(detail.weekdays.map(wd => wd.room_id))
          availableRooms.value = store.campusList
            .filter(r => roomIds.has(r.id))
            .map(r => ({ id: r.id, name: r.name }))
        }

        if (availableRooms.value.length) {
          const today = new Date()
          const dayOfWeek = today.getDay()
          const mondayThisWeek = new Date(today)
          mondayThisWeek.setDate(today.getDate() - ((dayOfWeek + 6) % 7))
          const mondayNextWeek = new Date(mondayThisWeek)
          mondayNextWeek.setDate(mondayThisWeek.getDate() + 7)
          const sundayNextWeek = new Date(mondayNextWeek)
          sundayNextWeek.setDate(mondayNextWeek.getDate() + 6)

          const fromStr = mondayNextWeek.toISOString()
          const toStr = sundayNextWeek.toISOString()
          const roomIdStr = availableRooms.value.map(r => r.id).join(',')

          const availRes = await Api.get<{ items: { room_id: number; date: string; available: boolean }[] }>(
            `/api/admin/work-schedules/service-availability?from=${fromStr}&to=${toStr}&room_ids=${roomIdStr}`
          )

          const map = new Map<string, boolean>()
          for (const item of availRes.data.items) {
            map.set(`${item.room_id}-${item.date}`, item.available)
          }
          availability.value = map
        }
      } catch (e) {
        console.error('加载排班详情失败', e)
        message.error('加载排班详情失败')
      }
    }
  } catch (e) {
    console.error('加载排班失败', e)
    message.error('加载排班失败')
  }
})
</script>
