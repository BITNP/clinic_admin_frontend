<template>
  <n-element class="page-wrapper">
    <n-grid cols="1 l:21" responsive="screen" x-gap="48" y-gap="0">
      <n-grid-item span="13">
        <RecordInfo :record="record" :owner="owner" />
      </n-grid-item>

      <n-grid-item span="8">
        <n-h2 prefix="bar" align-text style="margin-top: 28px;">
          处理情况
        </n-h2>
        <RepairInfo :record="record" />
        <RepairStatus :record="record" />
        <RecordNotePanel v-if="record" :record="record" />
      </n-grid-item>
    </n-grid>

    <n-space justify="space-between" style="margin: 28px 0">
      <n-button size="large" @click="toPrevRecord" :disabled="!isPrevRecord">
        <template #icon>
          <ArrowBackFilled />
        </template>
        上一条
      </n-button>
      <n-button size="large" @click="toNextRecord" :disabled="!isNextRecord">
        <template #icon>
          <ArrowForwardFilled />
        </template>
        下一条
      </n-button>
    </n-space>
  </n-element>
</template>

<script setup lang="tsx">
import type API from '@/store/api';
import { records } from '@/store';
import { useMessage } from 'naive-ui';
import { onMounted, onUpdated, ref, watch, computed } from 'vue';
import { useRouter } from 'vue-router';
import ArrowBackFilled from "@vicons/material/ArrowBackFilled";
import ArrowForwardFilled from "@vicons/material/ArrowForwardFilled";
import RecordNotePanel from "@/components/RecordNotePanel.vue";

const router = useRouter()
const message = useMessage()

const props = defineProps({
  recordId: {
    type: String,
    required: true
  }
})

const toPrevRecord = () => {
  router.push(`/records/${records.prevRecord(currentId.value)}`)
}

const toNextRecord = () => {
  router.push(`/records/${records.nextRecord(currentId.value)}`)
}

const record = ref<API.Record | null>(null)
const owner = ref<API.IUsers | null>(null)
const currentId = ref<number>(0)

const loadRecord = () => {
  currentId.value = parseInt(props.recordId)
  record.value = records.state.items[parseInt(props.recordId)]!

  setTimeout(() => {
    if (!record.value) {
      message.error("加载不出来了啦 qwq")
      router.replace("/")
      return
    }
  }, 2000)

  // owner info is now directly in record.user and record.realname
  if (record.value) {
    owner.value = {
      id: 0,
      account_id: record.value.user,
      realname: record.value.realname,
      email: "",
      role: ""
    }
  }
}

onMounted(async () => {
  await records.ensureLoaded()
  loadRecord()
})
onUpdated(() => {
  owner.value = null
  loadRecord()
})

watch(() => records.state.items, loadRecord)
watch(() => {
  return records.state.items[parseInt(props.recordId)]!
}, () => {
  record.value = records.state.items[parseInt(props.recordId)]!
  loadRecord()
})

const isPrevRecord = computed(() => {
  return records.isPrevRecordExist(currentId.value)
})

const isNextRecord = computed(() => {
  return records.isNextRecordExist(currentId.value)
})
</script>

<style scoped>
.page-wrapper {
  padding: 12px 48px 48px;
  max-width: 1600px;
  margin: 0 auto;
}

@media screen and (max-width: 600px) {
  .page-wrapper {
    padding: 12px 36px 36px;
  }
}
</style>
