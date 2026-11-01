<template>
  <n-form-item label="校区">
    <n-select v-model:value="campus" :options="campusList" />
  </n-form-item>
  <n-form-item label="时间">
    <div style="display: flex; gap: 8px; width: 100%;">
      <n-button :type="isToday ? 'primary' : 'default'" @click="toggleToday" size="small">今天</n-button>
      <n-date-picker v-model:value="selectedDate" type="date" clearable style="flex: 1" />
    </div>
  </n-form-item>
  <n-form-item label="状态">
    <div style="display: flex; gap: 8px; width: 100%;">
      <n-button :type="status === 'pending' ? 'primary' : 'default'" @click="togglePending" size="small">待确认</n-button>
      <n-select v-model:value="status" :options="statusList" style="flex: 1" />
    </div>
  </n-form-item>
  <n-form-item label="姓名">
    <n-input
      v-model:value="realname"
      placeholder="输入姓名搜索"
      clearable
      @clear="applyFilters"
      @keyup.enter="applyFilters"
    />
  </n-form-item>
  <n-space style="padding: 8px 0">
    <n-button type="primary" @click="applyFilters">确认</n-button>
    <n-button @click="resetFilters">重置</n-button>
  </n-space>
</template>

<script setup lang="ts">
import { records, rooms } from "@/store";
import { RECORD_STATUS_DESC } from "@/utils/constants";
import { computed, onMounted, ref, watch } from "vue"

const campus = ref<string | number>("all")
const campusList = computed(() => [
  { label: "全部", value: "all" },
  ...rooms.state.list.map((room) => ({ label: room.name, value: room.id }))
])

const status = ref<string>("all")
const statusList: { label: string, value: string }[] = [
  { label: "全部", value: "all" },
  ...Object.entries(RECORD_STATUS_DESC).map(([value, label]) => ({ label, value })),
]

const selectedDate = ref<number | null>(null)
const realname = ref<string>('')

const formatDate = (value: number) => {
  const date = new Date(value)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Parse YYYY-MM-DD as a local date so the picker does not shift the day in
// timezones behind UTC.
const parseDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day).getTime()
}

// isToday mirrors the picker: the button is active (and the filter applies)
// only while the selected date is today's date.
const isToday = computed(() => {
  if (selectedDate.value === null) return false
  return formatDate(selectedDate.value) === formatDate(Date.now())
})

// Ignore filter changes made while the panel is initializing itself from the
// store; otherwise opening the sidebar would refetch the current query.
const ready = ref(false)

const applyFilters = async () => {
  if (!ready.value) return
  await records.applyQuery({
    realname: realname.value,
    status: status.value === "all" ? "" : status.value,
    roomID: campus.value === "all" ? null : Number(campus.value),
    date: selectedDate.value === null ? "" : formatDate(selectedDate.value)
  })
}

// Mirror the date picker and status select: both apply immediately, without
// needing the 确认 button.
watch(selectedDate, applyFilters)
watch(status, applyFilters)

// Keep the panel in sync when another component (such as the campus badge on a
// record) changes the active query.
watch(() => ({ ...records.state.filters, realname: records.state.realname }), (filters) => {
  campus.value = filters.roomID ?? "all"
  status.value = filters.status || "all"
  realname.value = filters.realname
  selectedDate.value = filters.date ? parseDate(filters.date) : null
})

// Clicking toggles today's date: fill the picker, or clear it to cancel.
const toggleToday = () => {
  if (isToday.value) {
    selectedDate.value = null
  } else {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    selectedDate.value = today.getTime()
  }
}

// Shortcut beside the status select: click toggles the pending (待确认) filter,
// clicking again clears it.
const togglePending = () => {
  status.value = status.value === "pending" ? "all" : "pending"
}

onMounted(() => {
  campus.value = records.state.filters.roomID ?? "all"
  status.value = records.state.filters.status || "all"
  realname.value = records.state.realname
  selectedDate.value = records.state.filters.date ? parseDate(records.state.filters.date) : null
  ready.value = true
})

const resetFilters = async () => {
  realname.value = ''
  campus.value = "all"
  status.value = "all"
  selectedDate.value = null
  await applyFilters()
}
</script>
