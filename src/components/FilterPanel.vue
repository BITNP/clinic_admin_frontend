<template>
  <n-h5>筛选</n-h5>
  <n-form-item label="校区">
    <n-select v-model:value="campus" :options="campusList" />
  </n-form-item>
  <n-form-item label="时间">
    <n-checkbox v-model:checked="dateAll" label="全部" style="flex-shrink: 0" />
    <n-checkbox-group v-model:value="date" style="width: 100%" :disabled="dateAll">
      <n-checkbox value="today" label="今天" />
      <n-checkbox value="past" label="之前" />
      <n-checkbox value="future" label="以后" />
    </n-checkbox-group>
  </n-form-item>
  <n-space style="padding: 8px 0">
    <n-button type="primary" @click="() => {
      store.filters = generateFilters()
      emit('close')
    }">确认</n-button>
    <n-button @click="() => {
      store.filters = {}
      emit('close')
    }">重置</n-button>
  </n-space>
</template>

<script setup lang="ts">
import store from "@/store";
import type API from "@/store/api";
import { onMounted, ref, watchEffect } from "vue"

const emit = defineEmits(["close"])

const campus = ref<string>("all")
const campusList = ref<{
  label: string,
  value: string
}[]>([{
  label: "全部",
  value: "all"
}])

type FilterDates = "today" | "past" | "future"
const date = ref<FilterDates[]>(["today", "past", "future"])
const dateAll = ref<boolean>(true)

onMounted(() => {
  campus.value = store.filters["campus"] ? store.filters["campus"][0].value : "all"
  date.value = store.filters["date"] ? store.filters["date"].map((filter) => filter.value) as FilterDates[] : ["today", "past", "future"]
  dateAll.value = date.value.length === 3

  store.campusList.forEach((campus) => campusList.value.push({
    label: campus.name,
    value: campus.name
  }))
})

watchEffect(() => {
  if (dateAll.value) {
    date.value = ["today", "past", "future"]
  }
})

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

  date.value.forEach((d) => {
    if (!filters["date"]) filters["date"] = []
    let now = (new Date()).toISOString().slice(0, 10)
    let filter = ref<(args: any) => boolean>();
    switch (d) {
      case "today":
        filter.value = (ele) => ele.appointment_time === now;
        break;
      case "future":
        filter.value = (ele) => ele.appointment_time > now;
        break;
      case "past":
        filter.value = (ele) => ele.appointment_time < now;
        break;
    }
    filters["date"].push({
      value: d,
      filter: filter.value
    })
  })
  return filters
}
</script>
