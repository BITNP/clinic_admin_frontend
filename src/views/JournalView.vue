<template>
  <PageWrapper title="业务日志">
    <n-space vertical :size="18">
      <n-card class="filter-card" :bordered="false">
        <div class="filter-heading">
          <div>
            <n-text strong>筛选</n-text>
            <n-text depth="3" style="margin-left: 8px; font-size: 0.82rem">
              字符串筛选使用精确匹配
            </n-text>
          </div>
          <n-button text @click="toggleFilters">
            {{ filtersExpanded ? '收起' : '展开' }}
          </n-button>
        </div>

        <div v-show="filtersExpanded" class="filter-body">
          <label class="filter-field">
            <span>实体类型</span>
            <n-select
              v-model:value="draft.entityType"
              :options="entityOptions"
              :loading="entityKindsLoading"
              placeholder="全部"
              clearable
            />
          </label>
          <label class="filter-field">
            <span>实体 ID</span>
            <n-input
              v-model:value="draft.entityId"
              placeholder="精确匹配"
              clearable
              @keyup.enter="applyFilters"
            />
          </label>
          <label class="filter-field">
            <span>操作者类型</span>
            <n-select
              v-model:value="draft.actorType"
              :options="actorOptions"
              placeholder="全部"
              clearable
            />
          </label>
          <label class="filter-field">
            <span>操作者 ID</span>
            <n-input
              v-model:value="draft.actorId"
              placeholder="例如 42"
              clearable
              @keyup.enter="applyFilters"
            />
          </label>
          <label class="filter-field">
            <span>操作</span>
            <n-select
              v-model:value="draft.action"
              :options="actionOptions"
              :loading="entityKindsLoading"
              placeholder="全部"
              clearable
            />
          </label>
          <label class="filter-field date-field">
            <span>发生日期</span>
            <n-date-picker
              v-model:value="dateRange"
              type="daterange"
              clearable
              :actions="['clear', 'confirm']"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              style="width: 100%"
            />
          </label>

          <div class="filter-actions">
            <n-button @click="resetFilters">重置</n-button>
            <n-button type="primary" :loading="loading" @click="applyFilters">应用筛选</n-button>
          </div>
        </div>
      </n-card>

      <n-alert
        v-if="errorMessage && events.length"
        type="error"
        closable
        @close="errorMessage = ''"
      >
        {{ errorMessage }}
      </n-alert>

      <div class="journal-layout">
        <n-card class="stream-card" :bordered="false">
          <div class="stream-heading">
            <div>
              <n-text strong>日志时间线</n-text>
              <n-text depth="3" class="loaded-count">
                已加载 {{ events.length }} 条<template v-if="nextCursor === null && events.length">
                  · 已到底
                </template>
              </n-text>
            </div>
            <n-button :loading="loading" :disabled="loading" @click="refresh">
              <template #icon>
                <n-icon><RefreshFilled /></n-icon>
              </template>
              刷新
            </n-button>
          </div>

          <div v-if="loading && events.length === 0" class="loading-state">
            <n-spin size="large" />
            <n-text depth="3">正在加载业务日志</n-text>
          </div>

          <n-result
            v-else-if="errorMessage && events.length === 0"
            status="error"
            title="日志加载失败"
            :description="errorMessage"
          >
            <template #footer>
              <n-button type="primary" @click="loadFirst(false)">重试</n-button>
            </template>
          </n-result>

          <n-empty
            v-else-if="!loading && events.length === 0"
            description="当前筛选条件下没有业务日志"
            style="padding: 72px 24px"
          />

          <n-list v-else hoverable clickable class="event-list">
            <n-list-item
              v-for="event in events"
              :key="event.id"
              :class="{ selected: selectedId === event.id }"
              @click="selectEvent(event.id)"
            >
              <JournalItem :data="event" />
            </n-list-item>

            <div class="load-more">
              <n-button
                v-if="nextCursor !== null"
                block
                :loading="loadingMore"
                :disabled="loadingMore || loading"
                @click="loadMore"
              >
                {{ loadingMore ? '正在加载' : '加载更多' }}
              </n-button>
              <n-text v-else depth="3">没有更早的日志了</n-text>
            </div>
          </n-list>
        </n-card>

        <n-card v-if="!lt800px" class="detail-card inspector" :bordered="false">
          <JournalEventDetail :event="selectedEvent" />
        </n-card>
      </div>
    </n-space>

    <n-drawer
      v-if="lt800px"
      v-model:show="detailDrawerOpen"
      placement="right"
      :width="lt600px ? '100vw' : '520px'"
    >
      <n-drawer-content title="事件详情" closable :native-scrollbar="false">
        <JournalEventDetail :event="selectedEvent" />
      </n-drawer-content>
    </n-drawer>
  </PageWrapper>
</template>

<script setup lang="ts">
import PageWrapper from '@/components/PageWrapper.vue'
import JournalEventDetail from '@/components/JournalEventDetail.vue'
import JournalItem from '@/components/JournalItem.vue'
import Api from '@/utils/Api'
import Auth from '@/utils/Auth'
import {
  emptyJournalFilters,
  journalActionLabel,
  journalActorTypes,
  journalActorTypeLabel,
  journalDateRange,
  journalEntityTypeLabel,
  journalFilterSignature,
  journalFiltersFromRouteQuery,
  journalFiltersToRouteQuery,
  journalRequestURL,
  normalizeJournalEntityKinds,
  normalizeJournalPage,
  normalizeJournalFilters,
  withJournalDateRange,
  type JournalFilters
} from '@/utils/Journal'
import { isAdminRole } from '@/utils/Roles'
import { lt600px, lt800px } from '@/utils/Responsive'
import type API from '@/store/api'
import RefreshFilled from '@vicons/material/RefreshFilled'
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useMessage } from 'naive-ui'
import { useRoute, useRouter } from 'vue-router'

const message = useMessage()
const route = useRoute()
const router = useRouter()

const filters = reactive<JournalFilters>(emptyJournalFilters())
const draft = reactive<JournalFilters>(emptyJournalFilters())
const dateRange = ref<[number, number] | null>(null)
const filtersExpanded = ref(true)
const events = ref<API.JournalEvent[]>([])
const entityKinds = ref<API.JournalEntityKind[]>([])
const entityKindsLoading = ref(false)
const selectedId = ref<number | null>(null)
const nextCursor = ref<number | null>(null)
const loading = ref(false)
const loadingMore = ref(false)
const errorMessage = ref('')
const detailDrawerOpen = ref(false)

let authorized = false
let requestGeneration = 0
let requestController: AbortController | null = null

const actorOptions = journalActorTypes.map((value) => ({
  value,
  label: journalActorTypeLabel(value)
}))

const entityOptions = computed(() => [
  { label: '全部', value: '' },
  ...entityKinds.value.map((kind) => ({
    value: kind.entity_type,
    label: journalEntityTypeLabel(kind.entity_type)
  }))
])

const actionValues = computed(() => {
  if (draft.entityType) {
    return entityKinds.value.find((kind) => kind.entity_type === draft.entityType)?.actions ?? []
  }
  return [...new Set(entityKinds.value.flatMap((kind) => kind.actions))].sort()
})

const actionOptions = computed(() => {
  const values = [...actionValues.value]
  if (draft.action && !values.includes(draft.action)) values.push(draft.action)
  return values.map((value) => ({
    value,
    label: journalActionLabel(value)
  }))
})

const selectedEvent = computed(() => {
  return events.value.find((event) => event.id === selectedId.value) ?? null
})

watch(
  () => draft.entityType,
  (entityType) => {
    if (!entityType || !draft.action) return
    const kind = entityKinds.value.find((item) => item.entity_type === entityType)
    if (kind && !kind.actions.includes(draft.action)) draft.action = ''
  }
)

watch(dateRange, (range) => {
  const next = withJournalDateRange(draft, range)
  draft.from = next.from
  draft.to = next.to
})

const toggleFilters = () => {
  filtersExpanded.value = !filtersExpanded.value
}

const errorText = (error: unknown): string => {
  const response = (
    error as { response?: { status?: number; data?: { error?: string; msg?: string } } }
  )?.response
  return (
    response?.data?.error ||
    response?.data?.msg ||
    (error instanceof Error ? error.message : '') ||
    '日志加载失败，请稍后重试。'
  )
}

const handleRequestError = (error: unknown) => {
  const status = (error as { response?: { status?: number } })?.response?.status
  if (status === 401) {
    window.location.href = '/login'
    return
  }
  if (status === 403) {
    message.error('没有权限查看业务日志。')
    router.replace('/')
    return
  }
  errorMessage.value = errorText(error)
}

const loadEntityKinds = async (): Promise<boolean> => {
  entityKindsLoading.value = true
  try {
    const response = await Api.get<unknown>('/api/admin/journal/entity-kinds')
    entityKinds.value = normalizeJournalEntityKinds(response.data)
    return true
  } catch (error) {
    const status = (error as { response?: { status?: number } })?.response?.status
    if (status === 401 || status === 403) {
      handleRequestError(error)
      return false
    }
    message.warning('加载筛选选项失败，仍可使用当前筛选。')
    return true
  } finally {
    entityKindsLoading.value = false
  }
}

const cancelActiveRequest = () => {
  requestGeneration += 1
  requestController?.abort()
  requestController = null
}

const loadFirst = async (clearSelection: boolean) => {
  if (!authorized) return
  cancelActiveRequest()
  loadingMore.value = false
  const generation = requestGeneration
  const controller = new AbortController()
  requestController = controller
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await Api.get<unknown>(journalRequestURL(filters), {
      signal: controller.signal
    })
    if (generation !== requestGeneration) return
    const page = normalizeJournalPage(response.data)
    events.value = page.items
    nextCursor.value = page.next_cursor
    const previousStillPresent = events.value.some((event) => event.id === selectedId.value)
    if (clearSelection || !previousStillPresent) {
      selectedId.value = events.value[0]?.id ?? null
    }
  } catch (error) {
    if (controller.signal.aborted || generation !== requestGeneration) return
    handleRequestError(error)
  } finally {
    if (generation === requestGeneration && requestController === controller) {
      loading.value = false
      requestController = null
    }
  }
}

const loadMore = async () => {
  if (!authorized || nextCursor.value === null || loading.value || loadingMore.value) return
  const generation = requestGeneration
  const cursor = nextCursor.value
  loadingMore.value = true
  errorMessage.value = ''

  try {
    const response = await Api.get<unknown>(journalRequestURL(filters, cursor))
    if (generation !== requestGeneration) return
    const page = normalizeJournalPage(response.data)
    const known = new Set(events.value.map((event) => event.id))
    events.value = [...events.value, ...page.items.filter((event) => !known.has(event.id))]
    nextCursor.value = page.next_cursor
  } catch (error) {
    if (generation !== requestGeneration) return
    handleRequestError(error)
  } finally {
    if (generation === requestGeneration) loadingMore.value = false
  }
}

const applyFilters = async () => {
  const next = normalizeJournalFilters(draft)
  if (next.from && next.to && Date.parse(next.from) > Date.parse(next.to)) {
    message.warning('开始日期不能晚于结束日期。')
    return
  }
  const changed = journalFilterSignature(next) !== journalFilterSignature(filters)
  Object.assign(filters, next)
  Object.assign(draft, next)
  dateRange.value = journalDateRange(next)
  await router.replace({ name: 'journal', query: journalFiltersToRouteQuery(next) })
  if (!changed && events.value.length) {
    selectedId.value = events.value[0]?.id ?? null
  }
  await loadFirst(true)
}

const resetFilters = async () => {
  const next = emptyJournalFilters()
  Object.assign(filters, next)
  Object.assign(draft, next)
  dateRange.value = null
  await router.replace({ name: 'journal' })
  await loadFirst(true)
}

const refresh = async () => {
  await loadFirst(false)
}

const selectEvent = (id: number) => {
  selectedId.value = id
  if (lt800px.value) detailDrawerOpen.value = true
}

onMounted(async () => {
  await Auth.ready()
  if (!isAdminRole(Auth.user.value?.role)) {
    message.error('无权限访问业务日志。')
    router.replace('/')
    return
  }

  authorized = true
  if (!(await loadEntityKinds())) return
  const initial = journalFiltersFromRouteQuery(route.query)
  Object.assign(filters, initial)
  Object.assign(draft, initial)
  dateRange.value = journalDateRange(initial)
  filtersExpanded.value = window.innerWidth >= 800
  await loadFirst(true)
})

onBeforeUnmount(() => {
  cancelActiveRequest()
})
</script>

<style scoped>
.filter-card,
.stream-card,
.detail-card {
  background: var(--color-background-soft);
}

.filter-heading,
.stream-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.filter-body {
  display: grid;
  grid-template-columns: repeat(5, minmax(130px, 1fr));
  gap: 14px;
  margin-top: 18px;
}

.filter-field {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.filter-field > span {
  color: var(--color-text);
  font-size: 0.78rem;
  opacity: 0.65;
}

.filter-field.date-field {
  grid-column: span 2;
}

.filter-actions {
  display: flex;
  align-items: end;
  justify-content: end;
  gap: 8px;
}

.journal-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.65fr) minmax(340px, 0.95fr);
  gap: 18px;
  align-items: start;
}

.inspector {
  position: sticky;
  top: 16px;
  max-height: calc(100vh - 96px);
  overflow: auto;
}

.loaded-count {
  margin-left: 10px;
  font-size: 0.8rem;
}

.loading-state {
  display: flex;
  min-height: 260px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.event-list {
  margin-top: 14px;
}

.event-list :deep(.n-list-item) {
  transition:
    background-color 0.16s ease,
    border-color 0.16s ease;
}

.event-list :deep(.n-list-item.selected) {
  background: rgba(24, 160, 88, 0.09);
  box-shadow: inset 3px 0 #18a058;
}

.load-more {
  display: flex;
  min-height: 54px;
  align-items: center;
  justify-content: center;
  padding: 12px 20px;
}

@media screen and (max-width: 1200px) {
  .filter-body {
    grid-template-columns: repeat(3, minmax(140px, 1fr));
  }

  .journal-layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .inspector {
    position: static;
    max-height: none;
  }
}

@media screen and (max-width: 800px) {
  .filter-body {
    grid-template-columns: minmax(0, 1fr);
  }

  .filter-field.date-field {
    grid-column: auto;
  }

  .filter-actions {
    justify-content: stretch;
  }

  .filter-actions > * {
    flex: 1;
  }
}
</style>
