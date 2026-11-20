<template>
  <PageWrapper title="系统设置">
    <n-space vertical :size="20">
      <n-alert type="info" :bordered="false"> 内置配置保存后自动生效，客户端同步间隔可能需要一分钟更新。 </n-alert>

      <n-space justify="end" align="center" wrap>
        <n-button :loading="config.state.loading" @click="refresh"> 刷新 </n-button>
      </n-space>

      <n-spin :show="config.state.loading">
        <n-empty
          v-if="config.state.loaded && sections.length === 0"
          description="暂无配置项"
          style="padding: 64px 0"
        />

        <n-space v-else vertical :size="16">
          <n-card
            v-for="section in sections"
            :key="section.group.id"
            :title="section.group.display_name"
            embedded
          >
            <n-empty
              v-if="section.items.length === 0"
              description="该分组暂无配置项"
              style="padding: 24px 0"
            />

            <div v-else class="settings-list">
              <div v-for="item in section.items" :key="item.id" class="setting-row">
                <div class="setting-meta">
                  <div class="setting-title">{{ item.display_name }}</div>
                  <n-space :size="6" align="center">
                    <n-tag size="small" :bordered="false">
                      {{ valueTypeLabel(item.value_type) }}
                    </n-tag>
                    <n-tag v-if="item.is_required" size="small" type="warning" :bordered="false">
                      必填
                    </n-tag>
                    <n-tag v-if="item.writeonly" size="small" type="info" :bordered="false">
                      仅写入
                    </n-tag>
                  </n-space>
                  <div v-if="settingHint(item)" class="setting-hint">{{ settingHint(item) }}</div>
                </div>

                <div class="setting-editor">
                  <n-switch
                    v-if="item.value_type === 'boolean'"
                    v-model:value="draftFor(item).boolean"
                    :disabled="draftFor(item).saving"
                    @update:value="draftFor(item).writeOnlyTouched = true"
                  />

                  <div
                    v-else-if="item.value_type === 'int' || item.value_type === 'double'"
                    class="number-editor"
                  >
                    <n-input-number
                      v-model:value="draftFor(item).number"
                      :min="numberMin(item)"
                      :precision="item.value_type === 'int' ? 0 : undefined"
                      :show-button="false"
                      :disabled="draftFor(item).saving"
                      class="value-control"
                      :placeholder="settingPlaceholder(item)"
                      @update:value="draftFor(item).writeOnlyTouched = true"
                    />
                    <span v-if="numberUnit(item)" class="setting-unit">{{ numberUnit(item) }}</span>
                  </div>

                  <n-input
                    v-else
                    v-model:value="draftFor(item).text"
                    :type="stringInputType(item)"
                    :autosize="isSingleLineSetting(item) ? undefined : { minRows: 1, maxRows: 4 }"
                    :show-password-on="isWriteOnly(item) ? 'click' : undefined"
                    :disabled="draftFor(item).saving"
                    class="value-control"
                    :placeholder="settingPlaceholder(item)"
                    @update:value="draftFor(item).writeOnlyTouched = true"
                  />

                  <n-button
                    type="primary"
                    :disabled="!isDirty(item)"
                    :loading="draftFor(item).saving"
                    @click="save(item)"
                  >
                    保存
                  </n-button>
                </div>
              </div>
            </div>
          </n-card>
        </n-space>
      </n-spin>
    </n-space>
  </PageWrapper>
</template>

<script setup lang="ts">
import PageWrapper from '@/components/PageWrapper.vue'
import { config } from '@/store'
import type API from '@/store/api'
import Auth from '@/utils/Auth'
import { isAdminRole } from '@/utils/Roles'
import { computed, onMounted, reactive, watch } from 'vue'
import { useMessage } from 'naive-ui'
import { useRouter } from 'vue-router'

interface Draft {
  text: string
  number: number | null
  boolean: boolean
  saving: boolean
  writeOnlyTouched: boolean
}

const message = useMessage()
const router = useRouter()
const drafts = reactive<Record<number, Draft>>({})

const sections = computed(() =>
  config.state.groups.map((group) => ({
    group,
    items: config.itemsForGroup(group.id)
  }))
)

const valueTypeLabel = (type: API.ConfigValueType) => {
  switch (type) {
    case 'int':
      return '整数'
    case 'double':
      return '小数'
    case 'boolean':
      return '开关'
    case 'string':
      return '文本'
  }
}

const singleLineSettings = new Set([
  'SYNC_POLL_INTERVAL',
  'RECORD_ACTION_WINDOW',
  'TAGGER_LLM_API_KEY',
  'TAGGER_LLM_BASE_URL',
  'TAGGER_LLM_MODEL',
  'TAGGER_TIMEOUT',
  'MESSAGE_GATEWAY_ACCOUNT'
])

const isWriteOnly = (item: API.ConfigItem) => item.writeonly

const isSingleLineSetting = (item: API.ConfigItem) => singleLineSettings.has(item.name)

const stringInputType = (item: API.ConfigItem) => {
  if (isWriteOnly(item)) return 'password'
  if (item.name === 'TAGGER_LLM_BASE_URL') return 'url'
  return isSingleLineSetting(item) ? 'text' : 'textarea'
}

const settingPlaceholder = (item: API.ConfigItem) => {
  if (item.writeonly) return '请输入新值（当前值不可读取）'
  if (item.name === 'TAGGER_TIMEOUT') return '例如 30s'
  if (item.value_type === 'int' || item.value_type === 'double') return '请输入数值'
  return '请输入配置值'
}

const numberMin = (item: API.ConfigItem) => {
  if (item.name === 'STAFF_VERSION') return 0
  return item.value_type === 'int' ? 1 : undefined
}

const numberUnit = (item: API.ConfigItem) => {
  switch (item.name) {
    case 'RECORD_PHOTO_MAX_SIZE_BYTES':
      return '字节'
    case 'TAGGER_CONTEXT_TOKENS':
      return 'tokens'
    case 'TAGGER_AGENT_POOL_SIZE':
      return '并发'
    default:
      return ''
  }
}

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return ''
  if (bytes >= 1024 * 1024) {
    const mib = bytes / (1024 * 1024)
    return `${Number.isInteger(mib) ? mib : mib.toFixed(1)} MiB`
  }
  if (bytes >= 1024) {
    const kib = bytes / 1024
    return `${Number.isInteger(kib) ? kib : kib.toFixed(1)} KiB`
  }
  return `${bytes} B`
}

const settingHint = (item: API.ConfigItem) => {
  switch (item.name) {
    case 'TAGGER_LLM_API_KEY':
      return '仅写入；保存后不会回显当前密钥。'
    case 'TAGGER_LLM_BASE_URL':
      return 'OpenAI 兼容接口地址；填写密钥时必填。'
    case 'TAGGER_LLM_MODEL':
      return '模型 ID；填写密钥时必填。'
    case 'TAGGER_AGENT_POOL_SIZE':
      return '扩容立即生效；缩容会等待多余的在途任务结束。'
    case 'TAGGER_CONTEXT_TOKENS':
      return '会话达到该 token 数后重置上下文。'
    case 'TAGGER_TIMEOUT':
      return 'Go 时长格式，必须大于 0。'
    case 'RECORD_PHOTO_MAX_SIZE_BYTES': {
      const bytes = draftFor(item).number
      const formatted = bytes === null ? '' : formatBytes(bytes)
      return `${formatted ? `当前输入 ${formatted}；` : ''}保存后下一次上传立即使用该限制。`
    }
    case 'MESSAGE_GATEWAY_ACCOUNT':
      return '下一条提醒立即使用该账号；网关 Token 必须与账号匹配。'
    default:
      return ''
  }
}

const toDraft = (item: API.ConfigItem): Draft => {
  const value = item.value ?? ''
  const numeric = item.value_type === 'int' || item.value_type === 'double'
  const parsed = numeric && value !== '' ? Number(value) : Number.NaN
  return {
    text: value,
    number: Number.isFinite(parsed) ? parsed : null,
    boolean: value === 'true',
    saving: false,
    writeOnlyTouched: false
  }
}

const draftFor = (item: API.ConfigItem): Draft => {
  if (!drafts[item.id]) drafts[item.id] = toDraft(item)
  return drafts[item.id]
}

const resetDrafts = () => {
  for (const key of Object.keys(drafts)) delete drafts[Number(key)]
  for (const item of config.state.items) drafts[item.id] = toDraft(item)
}

const serializeDraft = (item: API.ConfigItem, draft: Draft) => {
  if (item.value_type === 'boolean') return String(draft.boolean)
  if (item.value_type === 'int' || item.value_type === 'double') {
    return draft.number === null ? '' : String(draft.number)
  }
  return draft.text
}

const isDirty = (item: API.ConfigItem) => {
  const draft = draftFor(item)
  if (item.writeonly) return draft.writeOnlyTouched
  return serializeDraft(item, draft) !== (item.value ?? '')
}

// Adopt remote changes only for drafts that still match their previous value.
watch(
  () => config.state.items.slice(),
  (items, previous) => {
    const previousById = new Map(previous.map((item) => [item.id, item]))
    for (const item of items) {
      const oldItem = previousById.get(item.id)
      const draft = drafts[item.id]
      if (!oldItem || !draft) continue
      const unchanged = oldItem.writeonly
        ? !draft.writeOnlyTouched
        : serializeDraft(oldItem, draft) === (oldItem.value ?? '')
      if (!draft.saving && unchanged) {
        drafts[item.id] = toDraft(item)
      }
    }
  },
  { flush: 'sync' }
)

const errorText = (error: unknown) => {
  const response = (error as { response?: { status?: number; data?: { error?: string } } })
    ?.response
  if (response?.status === 401) return '登录已过期，请重新登录后再试。'
  if (response?.status === 403) return '没有权限修改系统配置。'
  return response?.data?.error || '保存失败，请稍后重试。'
}

const save = async (item: API.ConfigItem) => {
  const draft = draftFor(item)
  const value = serializeDraft(item, draft)
  if (item.is_required && value.trim() === '') {
    message.warning(`${item.display_name}不能为空。`)
    return
  }

  draft.saving = true
  try {
    const updated = await config.updateValue(item.id, value)
    drafts[item.id] = toDraft(updated)
    message.success(`${item.display_name}已保存。`)
  } catch (error) {
    message.error(errorText(error))
  } finally {
    draft.saving = false
  }
}

const refresh = async () => {
  try {
    await config.refresh()
    resetDrafts()
  } catch (error) {
    message.error(errorText(error))
  }
}

onMounted(async () => {
  if (!isAdminRole(Auth.user.value?.role)) {
    message.error('无权限访问系统设置。')
    router.replace('/')
    return
  }

  try {
    await config.ensureLoaded()
    resetDrafts()
  } catch (error) {
    message.error(errorText(error))
  }
})
</script>

<style scoped>
.settings-list {
  display: flex;
  flex-direction: column;
}

.setting-row {
  display: grid;
  grid-template-columns: minmax(180px, 0.8fr) minmax(320px, 1.4fr);
  gap: 24px;
  padding: 16px 0;
  border-top: 1px solid var(--color-border);
}

.setting-row:first-child {
  border-top: none;
  padding-top: 0;
}

.setting-row:last-child {
  padding-bottom: 0;
}

.setting-meta {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.setting-title {
  color: var(--color-heading);
  font-weight: 600;
  overflow-wrap: anywhere;
}

.setting-hint {
  color: var(--text-color-3);
  font-size: 12px;
  line-height: 1.5;
}

.setting-editor {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  min-width: 0;
}

.value-control {
  flex: 1;
  min-width: 0;
}

.number-editor {
  display: flex;
  flex: 1;
  min-width: 0;
  gap: 8px;
}

.setting-unit {
  color: var(--text-color-3);
  font-size: 12px;
  padding-top: 8px;
  white-space: nowrap;
}

@media screen and (max-width: 800px) {
  .setting-row {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .setting-editor {
    align-items: stretch;
  }
}

@media screen and (max-width: 480px) {
  .setting-editor {
    flex-direction: column;
  }
}
</style>
