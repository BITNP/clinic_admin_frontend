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
  <n-space style="padding: 8px 0">
    <n-button type="primary" @click="() => {
      records.state.filters = generateFilters()
    }">确认</n-button>
    <n-button @click="() => {
      records.state.filters = {}
    }">重置</n-button>
  </n-space>
</template>

<script setup lang="ts">
import { records, rooms } from "@/store";
import type API from "@/store/api";
import { RECORD_STATUS_DESC } from "@/utils/constants";
import { computed, onMounted, ref, watch } from "vue"

const campus = ref<string>("all")
const campusList = ref<{
  label: string,
  value: string
}[]>([{
  label: "全部",
  value: "all"
}])

const status = ref<string>("all")
const statusList: { label: string, value: string }[] = [
  { label: "全部", value: "all" },
  ...Object.entries(RECORD_STATUS_DESC).map(([value, label]) => ({ label, value })),
]

const selectedDate = ref<number | null>(null)

// isToday mirrors the picker: the button is active (and the filter applies)
// only while the selected date is today's date.
const isToday = computed(() => {
  if (selectedDate.value === null) return false
  return new Date(selectedDate.value).toLocaleDateString('en-CA') === new Date().toLocaleDateString('en-CA')
})

watch(selectedDate, () => {
  records.state.filters = generateFilters()
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
  records.state.filters = generateFilters()
}

onMounted(() => {
  campus.value = records.state.filters["campus"] ? records.state.filters["campus"][0].value : "all"
  status.value = records.state.filters["status"] ? records.state.filters["status"][0].value : "all"

  const dateFilter = records.state.filters["date"]
  if (dateFilter && dateFilter.length > 0) {
    if (dateFilter[0].value === "today") {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      selectedDate.value = today.getTime()
    } else {
      selectedDate.value = new Date(dateFilter[0].value).getTime()
    }
  }

  rooms.state.list.forEach((campus) => campusList.value.push({
    label: campus.name,
    value: campus.name
  }))
})

watch(() => records.state.filters, (filters) => {
  if (Object.keys(filters).length === 0) {
    campus.value = "all"
    status.value = "all"
    selectedDate.value = null
  }
}, { deep: true })

const generateFilters = () => {
  let filters = {} as typeof records.state.filters

  if (!filters["campus"]) filters["campus"] = []
  if (campus.value !== "all") {
    filters["campus"].push({
      value: campus.value,
      filter: (ele) => ele.campus === campus.value
    })
  }
  else {
    filters["campus"].push({
      value: campus.value,
      filter: () => true
    })
  }

  if (!filters["status"]) filters["status"] = []
  if (status.value !== "all") {
    filters["status"].push({
      value: status.value,
      filter: (ele) => ele.status === status.value
    })
  }
  else {
    filters["status"].push({
      value: status.value,
      filter: () => true
    })
  }

  if (isToday.value) {
    let now = new Date().toLocaleDateString('en-CA')
    if (!filters["date"]) filters["date"] = []
    filters["date"].push({
      value: "today",
      filter: (ele: any) => ele.appointment_time === now
    })
  } else if (selectedDate.value) {
    let dateStr = new Date(selectedDate.value).toLocaleDateString('en-CA')
    if (!filters["date"]) filters["date"] = []
    filters["date"].push({
      value: dateStr,
      filter: (ele: any) => ele.appointment_time === dateStr
    })
  }

  return filters
}
</script>
