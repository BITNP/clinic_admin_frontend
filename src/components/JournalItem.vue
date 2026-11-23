<template>
  <n-thing>
    <template #avatar>
      <n-avatar class="journal-avatar" :class="`actor-${props.data.actor_type}`" :size="48">
        <n-icon :size="24">
          <ActorIcon />
        </n-icon>
      </n-avatar>
    </template>
    <template #header>
      {{ props.data.action }}
    </template>
    <template #header-extra>
      <n-text depth="3">{{ `#${props.data.id}` }}</n-text>
    </template>
    <template #description>
      {{ formatJournalDate(props.data.occurred_at) }}
      {{ formatJournalTime(props.data.occurred_at) }}
    </template>
    <div class="journal-body">
      <span>{{ props.data.entity_type }} #{{ props.data.entity_id }}</span>
      <code>{{ props.data.action }}</code>
      <span class="operation-id">{{ props.data.operation_id }}</span>
    </div>
    <template #action>
      <n-space>
        <StatusBadge status="default" :text="props.data.entity_type" />
        <StatusBadge status="default" :text="props.data.actor_type" />
      </n-space>
    </template>
  </n-thing>
</template>

<script setup lang="tsx">
import StatusBadge from '@/components/StatusBadge.vue'
import type API from '@/store/api'
import { formatJournalDate, formatJournalTime } from '@/utils/Journal'
import ApiFilled from '@vicons/material/ApiFilled'
import ComputerFilled from '@vicons/material/ComputerFilled'
import PersonFilled from '@vicons/material/PersonFilled'

const props = defineProps<{
  data: API.JournalEvent
}>()

const ActorIcon = () => {
  if (props.data.actor_type === 'system') return <ComputerFilled />
  if (props.data.actor_type === 'integration') return <ApiFilled />
  return <PersonFilled />
}
</script>

<style scoped>
.journal-avatar {
  color: #fff;
  background: #2080f0;
}

.journal-avatar.actor-staff {
  background: #18a058;
}

.journal-avatar.actor-system {
  background: #8a8a8a;
}

.journal-avatar.actor-integration {
  background: #7b61ff;
}

.journal-body {
  display: grid;
  gap: 4px;
}

code,
.operation-id {
  overflow: hidden;
  color: var(--color-text);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.75rem;
  opacity: 0.58;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
