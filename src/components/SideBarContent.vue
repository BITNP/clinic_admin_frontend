<template>
  <div ref="listDOM" style="margin-top: 64px; overflow: auto; height: calc(100vh - 64px)" @scroll="handleScroll">
    <n-list hoverable clickable v-if="recordCount > 0">
      <div v-if="Auth.user.value?.role === 'admin'" style="padding: 12px 20px">
        <div role="none" style="display: flex; gap: 8px 12px; transition-duration: 0.267s;">
          <n-button type="primary"
            :style="(filterCount === 0 ? 'flex-shrink: 1; width: 100%;transition-duration: 0.267s;' : 'transition-duration: 0.267s;')"
            size="large" @click="createRecord">
            <template #icon>
              <AddFilled />
            </template>
            <template v-if="filterCount === 0">添加任务</template>
          </n-button>

          <n-modal v-if="isPopup" :show="filterPopupShow">
            <n-card>
              <FilterPanel @close="() => {
                  filterPopupShow = false
                }" />
            </n-card>
          </n-modal>
          <n-button v-if="isPopup" :type="filterCount > 0 ? 'info' : 'default'"
            :style="(filterCount > 0 ? 'flex-shrink: 1; width: 100%; transition-duration: 0.267s;' : 'transition-duration: 0.267s;')"
            size="large" @click="() => filterPopupShow = true">
            <template #icon>
              <FilterListFilled />
            </template>
            <template v-if="filterCount > 0">筛选</template>
          </n-button>
          <n-popover v-else :show="filterPanelShow" placement="bottom-end" trigger="click" style="width: 300px" title="筛选">
            <FilterPanel @close="() => {
                filterPanelShow = false
              }" />
            <template #trigger>
              <n-button :type="filterCount > 0 ? 'info' : 'default'"
                :style="(filterCount > 0 ? 'flex-shrink: 1; width: 100%; transition-duration: 0.267s;' : 'transition-duration: 0.267s;')"
                size="large" @click="() => filterPanelShow = true">
                <template #icon>
                  <FilterListFilled />
                </template>
                <template v-if="filterCount > 0">筛选</template>
              </n-button>
            </template>
          </n-popover>
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
import AddFilled from "@vicons/material/AddFilled"
import FilterListFilled from "@vicons/material/FilterListFilled"

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

const createRecord = () => {
  router.push("/createRecord")
}

const showRecord = (record: API.Record) => {
  router.push(`/records/${record.id}`)

  if (isShrink.value) store.isDrawerOpen = false
}

watch(isShrink, (prev) => {
  if (prev !== isShrink.value) {
    filterPanelShow.value = filterPopupShow.value = false;
  }
  return isShrink.value;
})

watch(() => store.filters, () => {
  console.debug("filters: ", store.filters)
})
watch(() => store.records, () => {
  console.debug("records: ", store.records)
}, { deep: true })

const filterPanelShow = ref(false)
const filterPopupShow = ref(false)
const filterCount = computed(() => Object.keys(store.filters).length)
const recordCount = computed(() => Object.keys(store.records).length)
const records = computed(() => Object.keys(store.records).reverse().map((key) => store.records[parseInt(key)]))
</script>
