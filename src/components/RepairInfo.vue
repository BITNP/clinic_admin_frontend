<template>
  <n-grid cols="1 xs:2 s:2 m:3 l:3 xl:4" responsive="screen" x-gap="8" y-gap="32"
    v-if="record && record.status !== 'pending'"
    style="margin-bottom: 16px">
    <n-grid-item v-if="record.worker_id">
      <n-thing>
        <template #header>处理人员</template>
        <n-skeleton text width="100px" v-if="!props.worker?.realname" />
        {{ props.worker?.realname ?? "" }}
      </n-thing>
    </n-grid-item>
    <n-grid-item v-if="record.arrive_time">
      <n-thing>
        <template #header>到达时间</template>
        {{ (new Date(record.arrive_time)).toLocaleString() }}
      </n-thing>
    </n-grid-item>
    <n-grid-item v-if="record.status === 'completed'">
      <n-thing>
        <template #header>完成时间</template>
        {{ record.finish_time ? (new Date(record.finish_time)).toLocaleString() : "" }}
      </n-thing>
    </n-grid-item>
    <n-grid-item v-if="record.status === 'completed' && record.worker_desc">
      <n-thing>
        <template #header>问题判断</template>
        {{ record.worker_desc }}
      </n-thing>
    </n-grid-item>
    <n-grid-item v-if="record.reject_reason">
      <n-thing>
        <template #header>驳回理由</template>
        {{ record.reject_reason }}
      </n-thing>
    </n-grid-item>
    <n-grid-item v-if="record.referral_reason">
      <n-thing>
        <template #header>返厂理由</template>
        {{ record.referral_reason }}
      </n-thing>
    </n-grid-item>
  </n-grid>
</template>

<script setup lang="ts">
import type API from "@/store/api"

const props = defineProps<{
  record: API.Record | null,
  worker: API.IUsers | null
}>()
</script>
