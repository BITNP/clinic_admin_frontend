<template>
  <n-form-item label="校区">
    <n-select v-model:value="campus" :options="campusList" />
  </n-form-item>
  <n-form-item label="时间">
    <div style="display: flex; gap: 8px; width: 100%;">
      <n-button :type="isToday ? 'primary' : 'default'" @click="toggleToday" size="small">今天</n-button>
      <n-date-picker v-model:value="selectedDate" type="date" clearable :disabled="isToday" style="flex: 1" />
    </div>
  </n-form-item>
  <n-space style="padding: 8px 0">
    <n-button type="primary" @click="() => {
      store.filters = generateFilters()
    }">确认</n-button>
    <n-button @click="() => {
      store.filters = {}
    }">重置</n-button>
  </n-space>
</template>

<script setup lang="ts">
import store from "@/store";
import type API from "@/store/api";
import { onMounted, ref, watch } from "vue"

const campus = ref<string>("all")
const campusList = ref<{
  label: string,
  value: string
}[]>([{
  label: "全部",
  value: "all"
}])

const isToday = ref(false)
const selectedDate = ref<number | null>(null)

watch(isToday, () => {
  if (isToday.value) selectedDate.value = null
  store.filters = generateFilters()
})
watch(selectedDate, () => {
  if (selectedDate.value) isToday.value = false
  store.filters = generateFilters()
})

const toggleToday = () => {
  isToday.value = !isToday.value
}

onMounted(() => {
  campus.value = store.filters["campus"] ? store.filters["campus"][0].value : "all"

  const dateFilter = store.filters["date"]
  if (dateFilter && dateFilter.length > 0) {
    if (dateFilter[0].value === "today") {
      isToday.value = true
    } else {
      selectedDate.value = new Date(dateFilter[0].value).getTime()
    }
  }

  store.campusList.forEach((campus) => campusList.value.push({
    label: campus.name,
    value: campus.name
  }))
})

watch(() => store.filters, (filters) => {
  if (Object.keys(filters).length === 0) {
    campus.value = "all"
    isToday.value = false
    selectedDate.value = null
  }
}, { deep: true })

const generateFilters = () => {
  let filters = {} as typeof store.filters

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
