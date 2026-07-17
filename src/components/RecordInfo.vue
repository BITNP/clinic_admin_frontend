<template>
  <n-h1 type="primary" style="position: relative; left: -24px; margin: unset">
    <n-text type="primary" style="display: inline-block; width: 24px;">#</n-text>
    <n-text>{{ props.record?.id }}</n-text>
  </n-h1>
  <StatusBadge :status="record?.status" />

  <n-h2 prefix="bar" align-text>
    <n-text>问题描述</n-text>
  </n-h2>
  {{ record?.description }}
  <n-h2 prefix="bar" align-text>
    具体信息
  </n-h2>
  <n-grid cols="1 xs:2 s:2 m:3 l:3 xl:4" responsive="screen" x-gap="8" y-gap="32">
    <n-grid-item>
      <n-thing>
        <template #header>机主</template>
        {{ `${record?.realname ?? "无名氏"} - ${record?.user ?? ""}` }}
      </n-thing>
    </n-grid-item>
    <n-grid-item>
      <n-thing>
        <template #header>联系方式</template>
        {{ record?.phone_num ?? "无" }}
      </n-thing>
    </n-grid-item>
    <n-grid-item>
      <n-thing>
        <template #header>校区</template>
        {{ record?.campus }}
      </n-thing>
    </n-grid-item>
    <n-grid-item>
      <n-thing>
        <template #header>预约时间</template>
        {{ record?.appointment_time }}
      </n-thing>
    </n-grid-item>
    <n-grid-item>
      <n-thing>
        <template #header>设备型号</template>
        {{ record?.model ?? "未知" }}
      </n-thing>
    </n-grid-item>
    <n-grid-item>
      <n-thing>
        <template #header>设备密码</template>
        <n-element>{{ record?.password || "无" }}</n-element>
      </n-thing>
    </n-grid-item>
  </n-grid>
</template>

<script setup lang="ts">
import type API from "@/store/api"
const props = defineProps<{
  record: API.Record | null,
  owner: API.IUsers | null
}>()
</script>
