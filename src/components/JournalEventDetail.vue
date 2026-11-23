<template>
  <section v-if="event" class="journal-detail">
    <div class="detail-heading">
      <div>
        <n-text depth="3">事件 #{{ event.id }}</n-text>
        <h2>{{ journalActionLabel(event.action) }}</h2>
        <code class="raw-action">{{ event.action }}</code>
      </div>
      <n-space :size="6" vertical align="end">
        <n-tag size="small" :bordered="false" :type="actorTagType">
          {{ journalActorTypeLabel(event.actor_type) }}
        </n-tag>
        <n-tag size="small" :bordered="false">
          {{ journalEntityTypeLabel(event.entity_type) }} #{{ event.entity_id }}
        </n-tag>
      </n-space>
    </div>

    <n-button
      v-if="recordPath"
      secondary
      type="primary"
      size="small"
      style="margin-top: 12px"
      @click="router.push(recordPath)"
    >
      查看关联工单
    </n-button>

    <div class="fact-grid">
      <div class="fact">
        <span>发生时间</span>
        <strong>{{ formatJournalDateTime(event.occurred_at) }}</strong>
      </div>
      <div class="fact">
        <span>写入时间</span>
        <strong>{{ formatJournalDateTime(event.recorded_at) }}</strong>
      </div>
      <div class="fact">
        <span>操作者</span>
        <strong> {{ journalActorTypeLabel(event.actor_type) }} · {{ event.actor_id }} </strong>
      </div>
      <div class="fact">
        <span>关联对象</span>
        <strong>{{ journalEntityTypeLabel(event.entity_type) }} #{{ event.entity_id }}</strong>
      </div>
      <div class="fact wide">
        <span>操作组</span>
        <code>{{ event.operation_id }}</code>
      </div>
      <div v-if="event.caused_by_event_id" class="fact wide">
        <span>因果事件</span>
        <strong>#{{ event.caused_by_event_id }}</strong>
      </div>
    </div>

    <n-divider />

    <div class="section-heading">
      <n-text strong>字段变更</n-text>
      <n-tag v-if="changes.length" size="small" :bordered="false"> {{ changes.length }} 项 </n-tag>
    </div>

    <div v-if="changes.length" class="change-list">
      <div v-for="change in changes" :key="change.field" class="change-row">
        <div class="change-label">{{ change.label }}</div>
        <template v-if="change.redacted">
          <n-tag size="small" type="warning" :bordered="false">已脱敏</n-tag>
          <span class="change-note">敏感值已变更，具体内容不记录</span>
        </template>
        <div v-else class="change-compare">
          <div class="change-side">
            <span>变更前</span>
            <pre class="change-value">{{ formatJournalValue(change.before) }}</pre>
          </div>
          <span class="change-arrow">→</span>
          <div class="change-side">
            <span>变更后</span>
            <pre class="change-value after">{{ formatJournalValue(change.after) }}</pre>
          </div>
        </div>
      </div>
    </div>
    <n-empty v-else description="该事件没有结构化字段变更" size="small" />

    <template v-if="otherDetails.length">
      <n-divider />
      <div class="section-heading">
        <n-text strong>事件信息</n-text>
      </div>
      <dl class="other-details">
        <div v-for="[key, value] in otherDetails" :key="key">
          <dt>{{ journalOtherDetailLabel(key) }}</dt>
          <dd>{{ formatJournalValue(value) }}</dd>
        </div>
      </dl>
    </template>

    <n-divider />
    <n-button text type="primary" @click="rawOpen = !rawOpen">
      {{ rawOpen ? '收起原始 JSON' : '查看原始 JSON' }}
    </n-button>
    <pre v-if="rawOpen" class="raw-json">{{ rawJSON }}</pre>
  </section>

  <n-empty v-else description="选择一条日志查看详情" style="padding: 48px 0" />
</template>

<script setup lang="ts">
import type API from '@/store/api'
import {
  formatJournalDateTime,
  formatJournalValue,
  journalActionLabel,
  journalActorTypeLabel,
  journalChangeRows,
  journalEntityTypeLabel,
  journalOtherDetailLabel,
  journalOtherDetails,
  journalRecordPath
} from '@/utils/Journal'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps<{
  event: API.JournalEvent | null
}>()

const router = useRouter()
const rawOpen = ref(false)

const changes = computed(() => (props.event ? journalChangeRows(props.event.details) : []))
const otherDetails = computed(() => (props.event ? journalOtherDetails(props.event.details) : []))
const recordPath = computed(() => (props.event ? journalRecordPath(props.event) : null))
const rawJSON = computed(() => (props.event ? JSON.stringify(props.event.details, null, 2) : '{}'))
const actorTagType = computed(() => {
  switch (props.event?.actor_type) {
    case 'staff':
      return 'success'
    case 'customer':
      return 'info'
    case 'integration':
      return 'warning'
    default:
      return 'default'
  }
})

watch(
  () => props.event?.id,
  () => {
    rawOpen.value = false
  }
)
</script>

<style scoped>
.journal-detail {
  min-width: 0;
  container-type: inline-size;
}

.detail-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.detail-heading h2 {
  margin: 4px 0;
  font-size: 1.3rem;
  line-height: 1.35;
  color: var(--color-heading);
}

.raw-action,
.raw-json,
.fact code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.raw-action {
  color: var(--color-text);
  font-size: 0.78rem;
  opacity: 0.65;
}

.fact-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 20px;
}

.fact {
  min-width: 0;
}

.fact.wide {
  grid-column: 1 / -1;
}

.fact span {
  display: block;
  margin-bottom: 2px;
  color: var(--color-text);
  font-size: 0.76rem;
  opacity: 0.55;
}

.fact strong,
.fact code {
  overflow-wrap: anywhere;
  font-size: 0.86rem;
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.change-list {
  display: grid;
  gap: 10px;
}

.change-row {
  display: grid;
  gap: 10px;
  padding: 10px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
}

.change-label {
  font-weight: 600;
  overflow-wrap: anywhere;
}

.change-compare {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  gap: 10px;
  align-items: start;
}

.change-side {
  display: grid;
  min-width: 0;
  gap: 5px;
}

.change-side > span {
  color: var(--color-text);
  font-size: 0.72rem;
  opacity: 0.5;
}

.change-value {
  min-width: 0;
  max-height: 160px;
  overflow: auto;
  padding: 7px 9px;
  border-radius: 7px;
  background: var(--color-background-mute);
  font-size: 0.78rem;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.change-value.after {
  border-left: 3px solid #18a058;
}

.change-arrow {
  padding-top: 26px;
  opacity: 0.45;
}

.change-note {
  align-self: center;
  color: var(--color-text);
  font-size: 0.82rem;
  opacity: 0.65;
}

.other-details {
  display: grid;
  gap: 10px;
  margin: 0;
}

.other-details div {
  display: grid;
  grid-template-columns: minmax(110px, 0.7fr) minmax(0, 1.3fr);
  gap: 12px;
}

.other-details dt {
  color: var(--color-text);
  opacity: 0.6;
}

.other-details dd {
  min-width: 0;
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.raw-json {
  max-height: 420px;
  overflow: auto;
  margin-top: 12px;
  padding: 14px;
  border-radius: 10px;
  background: var(--color-background-mute);
  font-size: 0.78rem;
  line-height: 1.55;
}

@container (max-width: 520px) {
  .change-compare {
    grid-template-columns: minmax(0, 1fr);
  }

  .change-arrow {
    padding-top: 0;
    transform: rotate(90deg);
    justify-self: center;
  }
}
</style>
