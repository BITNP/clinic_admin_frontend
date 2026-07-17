<template>
  <n-button size="small" secondary :type="color(props.status)">
    <template #icon>
      <slot />
    </template>
    {{ RECORD_STATUS_DESC[props.status] ?? props.text ?? props.status }}
  </n-button>
</template>

<script setup lang="ts">
import { RECORD_STATUS_DESC } from '@/utils/constants';

const props = defineProps<{
  status: string,
  text?: string,
}>()

const color = (status: string) => {
  if (
    status === "pending" ||
    status === "in_progress"
  ) return "warning"

  if (
    status === "arrived"
  ) return "primary"

  if (
    status === "completed"
  ) return "success"

  if (
    status === "rejected" ||
    status === "no_show"
  ) return "error"

  if (
    status === "confirmed" ||
    status === "referred"
  ) return "info"

  else return status
}
</script>
