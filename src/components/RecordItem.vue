<template>
  <n-thing>
    <template #avatar>
      <n-avatar style="height: 48px; width: 48px;" >
        <n-icon >
          <StatusAvatar />
        </n-icon>
      </n-avatar>
    </template>
    <template #header> {{ props.data?.realname ?? "无名氏"}}</template>
    <template #header-extra> <n-text depth="3">{{ `#${props.data?.id}` }} </n-text> </template>
    <template #description> {{ props.data?.appointment_time }}</template>
    {{ props.data?.model }}
    <template #action>
      <n-space>
        <StatusBadge :status="props.data?.status!" />
        <StatusBadge status="default" :text="props.data?.campus" @click.stop="filterCampus"/>
      </n-space>
    </template>
  </n-thing>
</template>

<script setup lang="tsx">
import type API from '@/store/api';
import type { PropType } from 'vue';
import StatusBadge from "@/components/StatusBadge.vue"
import store from '@/store';

import AccessTimeFilledFilled from "@vicons/material/AccessTimeFilledFilled"
import AccessTimeOutline from "@vicons/material/AccessTimeOutlined"
import CancelFilled from "@vicons/material/CancelFilled"
import FactoryFilled from '@vicons/material/FactoryFilled';
import DoneFilled from '@vicons/material/DoneFilled';
import CalendarMonthFilled from '@vicons/material/CalendarMonthFilled';
import PersonOffFilled from '@vicons/material/PersonOffFilled';
import HandymanFilled from '@vicons/material/HandymanFilled';

const props = defineProps({
  data: Object as PropType<API.Record>
})

const StatusAvatar = () => {
  const status = props.data?.status
  if (
    status === "pending" ||
    status === "confirmed"
  ) return <AccessTimeOutline />

  if (
    status === "arrived" ||
    status === "in_progress"
  ) return <HandymanFilled />

  if (
    status === "rejected"
  ) return <CancelFilled />

  if (
    status === "referred"
  ) return <FactoryFilled />

  if (
    status === "completed"
  ) return <DoneFilled />

  if (
    status === "no_show"
  ) return <PersonOffFilled />

  return <AccessTimeOutline />
}

const filterCampus = () => {
  const filters = store.filters

  filters['campus'] = [{
    value: props.data?.campus!,
    filter: (ele) => ele.campus === props.data?.campus
  }]
  // eslint-disable-next-line no-self-assign
  store.filters = filters
}
</script>
