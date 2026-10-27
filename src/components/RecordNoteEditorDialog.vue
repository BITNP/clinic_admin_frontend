<template>
  <n-modal
    class="record-note-editor"
    preset="card"
    :show="show"
    :mask-closable="false"
    :close-on-esc="false"
    :auto-focus="false"
    :closable="!saving"
    :on-close="requestClose"
    :on-esc="requestClose"
    @after-enter="focusEditor"
    @after-leave="emit('after-leave')"
  >
    <template #header>
      <div class="note-editor-header">
        <n-space align="center" :size="8" :wrap="true">
          <n-text strong class="record-number">#{{ record?.id ?? '' }}</n-text>
          <n-tag size="small" :bordered="false">{{ record?.model || '未知型号' }}</n-tag>
          <n-tag v-if="isDirty" size="small" type="warning" :bordered="false">未保存</n-tag>
        </n-space>
        <n-button text size="tiny" @click="problemExpanded = !problemExpanded">
          {{ problemExpanded ? '收起问题描述' : '展开问题描述' }}
        </n-button>
        <n-collapse-transition :show="problemExpanded">
          <div v-if="record?.description" class="problem-description">
            {{ record.description }}
          </div>
          <n-text v-else depth="3">无</n-text>
        </n-collapse-transition>
      </div>
    </template>

    <div class="note-editor-body">
      <n-input
        ref="editorInput"
        v-model:value="editorText"
        type="textarea"
        placeholder="记录本次处理过程..."
        :autosize="{ minRows: 14, maxRows: 30 }"
        :disabled="saving"
      />
      <n-text depth="3" class="note-editor-hint">保存不会改变工单状态。</n-text>
    </div>

    <template #footer>
      <n-space justify="end" :wrap="true">
        <n-button :disabled="saving" @click="requestClose">返回</n-button>
        <n-button
          :loading="savingAction === 'save'"
          :disabled="saving || !isDirty"
          @click="save(false)"
        >
          保存
        </n-button>
        <n-button
          type="primary"
          :loading="savingAction === 'save-close'"
          :disabled="saving || !isDirty"
          @click="save(true)"
        >
          保存并关闭
        </n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import type API from '@/store/api'
import { records } from '@/store'
import {
  discardRecordNoteDraft,
  getRecordNoteDraft,
  setRecordNoteDraft
} from '@/utils/RecordNoteDrafts'
import type { InputInst } from 'naive-ui'
import { useMessage } from 'naive-ui'
import { computed, nextTick, ref, watch } from 'vue'

const props = defineProps<{
  show: boolean
  record: API.Record | null
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'after-leave'): void
}>()

const message = useMessage()
const editorInput = ref<InputInst | null>(null)
const editorText = ref('')
const savedText = ref('')
const saving = ref(false)
const savingAction = ref<'save' | 'save-close' | null>(null)
const problemExpanded = ref(false)

const isDirty = computed(() => editorText.value !== savedText.value)

const initialize = () => {
  if (!props.record) {
    editorText.value = ''
    savedText.value = ''
    return
  }

  const serverText = props.record.worker_desc ?? ''
  const draft = getRecordNoteDraft(props.record.id)

  savedText.value = serverText
  if (draft) {
    editorText.value = draft.text
    // Pick up a newer server value while keeping the user's draft text.
    setRecordNoteDraft(props.record.id, draft.text, serverText)
    return
  }
  editorText.value = serverText
}

watch(
  () => props.show,
  (show, wasShow) => {
    if (show) {
      problemExpanded.value = false
      initialize()
      return
    }
    if (wasShow && props.record) {
      setRecordNoteDraft(props.record.id, editorText.value, savedText.value)
    }
  },
  { immediate: true }
)

watch(
  () => props.record?.id,
  () => {
    if (!props.show) return
    problemExpanded.value = false
    initialize()
  }
)

// Background refreshes may replace the record object. Keep the current editor
// text when it is dirty, but keep savedText aligned with the server.
watch(
  () => props.record?.worker_desc,
  (value) => {
    if (!props.show || value === undefined || saving.value) return

    const serverText = value
    const wasDirty = editorText.value !== savedText.value
    savedText.value = serverText

    if (!wasDirty) {
      editorText.value = serverText
      if (props.record) discardRecordNoteDraft(props.record.id)
      return
    }
    if (props.record) {
      setRecordNoteDraft(props.record.id, editorText.value, serverText)
    }
  }
)

// Persist while typing so closing the editor or navigating with the keyboard
// never drops the current text.
watch(editorText, (text) => {
  if (!props.show || !props.record) return
  setRecordNoteDraft(props.record.id, text, savedText.value)
})

const focusEditor = async () => {
  await nextTick()
  editorInput.value?.focus()
}

const requestClose = () => {
  if (saving.value) return false
  if (props.record) {
    setRecordNoteDraft(props.record.id, editorText.value, savedText.value)
  }
  emit('update:show', false)
  // Stop n-modal from also hiding itself when this is the header close button.
  return false
}

const save = async (closeAfter: boolean) => {
  if (!props.record || saving.value) return

  const recordId = props.record.id
  const textToSave = editorText.value
  saving.value = true
  savingAction.value = closeAfter ? 'save-close' : 'save'

  try {
    const updated = await records.updateWorkerDesc(recordId, textToSave)
    const serverText = updated.worker_desc ?? ''
    savedText.value = serverText

    if (editorText.value === textToSave) {
      editorText.value = serverText
    }

    if (editorText.value === serverText) {
      discardRecordNoteDraft(recordId)
    } else {
      setRecordNoteDraft(recordId, editorText.value, serverText)
    }

    message.success('保存成功')
    if (closeAfter) {
      emit('update:show', false)
    }
  } catch {
    message.error('保存失败，请重试')
  } finally {
    saving.value = false
    savingAction.value = null
  }
}
</script>

<style>
.record-note-editor.n-modal {
  width: min(960px, calc(100vw - 32px));
  max-height: calc(100vh - 32px);
  display: flex;
  flex-direction: column;
}

.record-note-editor.n-modal > .n-card-header,
.record-note-editor.n-modal > .n-card__footer {
  flex: 0 0 auto;
}

.record-note-editor.n-modal > .n-card__content {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
}
</style>

<style scoped>
.note-editor-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-right: 32px;
}

.record-number {
  font-size: 18px;
}

.problem-description {
  max-height: 20vh;
  overflow-y: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.6;
}

.note-editor-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.note-editor-hint {
  font-size: 12px;
}
</style>
