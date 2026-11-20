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
            <template #header-extra>
              <n-tag size="small" :bordered="false"> {{ section.items.length }} 项 </n-tag>
            </template>

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
                  </n-space>
                </div>

                <div class="setting-editor">
                  <n-switch
                    v-if="item.value_type === 'boolean'"
                    v-model:value="draftFor(item).boolean"
                    :disabled="draftFor(item).saving"
                  />

                  <n-input-number
                    v-else-if="item.value_type === 'int' || item.value_type === 'double'"
                    v-model:value="draftFor(item).number"
                    :precision="item.value_type === 'int' ? 0 : undefined"
                    :show-button="false"
                    :disabled="draftFor(item).saving"
                    class="value-control"
                    placeholder="请输入数值"
                  />

                  <n-input
                    v-else
                    v-model:value="draftFor(item).text"
                    type="textarea"
                    :autosize="{ minRows: 1, maxRows: 4 }"
                    :disabled="draftFor(item).saving"
                    class="value-control"
                    placeholder="请输入配置值"
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
import { computed, onMounted, reactive } from 'vue'
import { useMessage } from 'naive-ui'
import { useRouter } from 'vue-router'

interface Draft {
  text: string
  number: number | null
  boolean: boolean
  saving: boolean
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

const toDraft = (item: API.ConfigItem): Draft => {
  const numeric = item.value_type === 'int' || item.value_type === 'double'
  const parsed = numeric && item.value !== '' ? Number(item.value) : Number.NaN
  return {
    text: item.value,
    number: Number.isFinite(parsed) ? parsed : null,
    boolean: item.value === 'true',
    saving: false
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

const isDirty = (item: API.ConfigItem) => serializeDraft(item, draftFor(item)) !== item.value

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
