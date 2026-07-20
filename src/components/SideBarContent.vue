<template>
  <div ref="listDOM" style="margin-top: 64px; overflow: auto; height: calc(100vh - 64px)" @scroll="handleScroll">
    <n-list hoverable clickable v-if="recordCount > 0">
      <div v-if="Auth.user.value?.role === 'admin'" style="padding: 8px 20px 0">
        <div role="none" style="display: flex; align-items: center; gap: 6px; cursor: pointer; user-select: none;" @click="filterExpanded = !filterExpanded">
          <n-icon :style="{ transition: 'transform 0.2s', transform: filterExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }">
            <ArrowDropDownFilled />
          </n-icon>
          <span>筛选</span>
        </div>
        <div class="filter-collapse" :class="{ expanded: filterExpanded }">
          <div>
            <FilterPanel />
          </div>
        </div>
      </div>
      <n-list-item v-for="record in records" :key="record.id" @click="showRecord(record)"
        v-show="visibility.includes(record.id)">
        <RecordItem :data="record" />
      </n-list-item>
      <div style="padding: 12px 20px;">
        <n-button block :loading="loading" :disabled="loading" @click="loadRecords">
          {{ loading ? "正在加载" : "加载更多" }}
        </n-button>
      </div>
    </n-list>
    <n-element v-else style="height: 100%; width: 100%; display: flex; justify-content: center; align-items: center;">
      <n-spin v-if="loading" />
      <n-text v-else depth="3">暂时没有任务</n-text>
    </n-element>
  </div>
</template>

<script setup lang="ts">
import Auth from "@/utils/Auth";
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router"
import type API from "@/store/api";
import { load, visibility } from "@/store/record"
import store from "@/store"
import { lt800px as isShrink, lt600px as isPopup } from "@/utils/Responsive"
import ArrowDropDownFilled from "@vicons/material/ArrowDropDownFilled"

import RecordItem from "@/components/RecordItem.vue"
import FilterPanel from "./FilterPanel.vue";

const router = useRouter()

onMounted(async () => {
  if (Object.keys(store.records).length === 0) loadRecords()
  console.debug(listDOM.value, store.drawerScroll)
  setTimeout(() => listDOM.value!.scrollTo({
    top: store.drawerScroll
  }), 50)
})

const listDOM = ref<HTMLDivElement | null>(null)

const handleScroll = () => {
  let { scrollHeight, scrollTop, clientHeight } = listDOM.value!
  if (scrollHeight - scrollTop - clientHeight <= 100) {
    loadRecords()
  }
  store.drawerScroll = listDOM.value!.scrollTop
}

const loading = ref(false)
const loadRecords = async () => {
  if (loading.value) return
  loading.value = true
  await load()
  loading.value = false
}

const showRecord = (record: API.Record) => {
  router.push(`/records/${record.id}`)

  if (isShrink.value) store.isDrawerOpen = false
}

watch(() => store.filters, () => {
  console.debug("filters: ", store.filters)
})
watch(() => store.records, () => {
  console.debug("records: ", store.records)
}, { deep: true })

const filterExpanded = ref(!isPopup.value)
watch(isPopup, () => {
  filterExpanded.value = !isPopup.value
})
const filterCount = computed(() => Object.keys(store.filters).length)
const recordCount = computed(() => Object.keys(store.records).length)
const records = computed(() => Object.keys(store.records).reverse().map((key) => store.records[parseInt(key)]))
</script>

<style scoped>
.filter-collapse {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.25s ease;
}
.filter-collapse.expanded {
  grid-template-rows: 1fr;
}
.filter-collapse > div {
  overflow: hidden;
  min-height: 0;
}
</style>
