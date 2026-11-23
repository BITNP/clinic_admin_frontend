<template>
  <n-tag
    class="sync-status"
    size="small"
    round
    :bordered="false"
    :type="connected ? 'success' : 'error'"
    role="status"
    aria-live="polite"
  >
    <span class="sync-status-content">
      <span class="sync-status-dot" aria-hidden="true"></span>
      {{ status }}
    </span>
  </n-tag>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Sync from '@/utils/Sync'

const connected = Sync.isConnected
const status = computed(() => (connected.value ? 'connected' : 'disconnected'))
</script>

<style scoped>
.sync-status {
  --n-font-size: 11px;
  --n-height: 24px;
  white-space: nowrap;
}

.sync-status-content {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.sync-status-dot {
  width: 7px;
  height: 7px;
  flex: 0 0 7px;
  border-radius: 50%;
  background-color: currentColor;
}
</style>
