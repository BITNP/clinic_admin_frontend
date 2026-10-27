<template>
  <n-modal
    class="record-note-editor"
    preset="card"
    :show="show"
    :mask-closable="false"
    :close-on-esc="false"
    :auto-focus="false"
    :closable="!saving && !draftLoading"
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

        <n-space align="center" :size="8" :wrap="true">
          <n-text v-if="persistState === 'saved'" depth="3" class="draft-status">
            草稿已保存在本机
          </n-text>
          <n-text v-else-if="persistState === 'saving'" depth="3" class="draft-status">
            正在保存草稿…
          </n-text>
          <n-text v-else-if="persistState === 'error'" type="error" class="draft-status">
            无法保存草稿到本机，草稿仅保留在当前页面。
          </n-text>
          <n-button
            v-if="hasLocalDraft"
            text
            type="error"
            size="tiny"
            :disabled="saving"
            @click="confirmDiscard"
          >
            放弃草稿
          </n-button>
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
      <n-alert
        v-if="hasConflict"
        type="warning"
        title="服务器上的处理记录已变化"
        class="conflict-alert"
      >
        <div>本地草稿基于旧版本。请先选择要保留的版本，再保存。</div>
        <n-space :size="8" style="margin-top: 8px">
          <n-button size="small" type="primary" @click="keepLocalDraft"> 保留本地草稿 </n-button>
          <n-button size="small" @click="useServerVersion">使用服务器版本</n-button>
        </n-space>
        <n-collapse style="margin-top: 8px">
          <n-collapse-item title="查看两个版本" name="compare">
            <n-grid cols="1 720:2" :x-gap="12">
              <n-grid-item>
                <n-text depth="3">本地草稿</n-text>
                <pre class="conflict-text">{{ editorText }}</pre>
              </n-grid-item>
              <n-grid-item>
                <n-text depth="3">服务器版本</n-text>
                <pre class="conflict-text">{{ conflictServerText ?? '' }}</pre>
              </n-grid-item>
            </n-grid>
          </n-collapse-item>
        </n-collapse>
      </n-alert>

      <n-space v-if="draftLoading" align="center" :size="8">
        <n-spin size="small" />
        <n-text depth="3">正在恢复本地草稿…</n-text>
      </n-space>
      <RecordNoteMarkdownEditor
        v-else
        ref="editorRef"
        :key="editorRevision"
        :initial-value="editorText"
        @update="onEditorUpdate"
        @ready="onEditorReady"
      />
    </div>

    <template #footer>
      <n-space justify="end" :wrap="true">
        <n-button :disabled="saving || draftLoading" @click="requestClose">返回</n-button>
        <n-button :loading="savingAction === 'save'" :disabled="!canSave" @click="save(false)">
          保存
        </n-button>
        <n-button
          type="primary"
          :loading="savingAction === 'save-close'"
          :disabled="!canSave"
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
import RecordNoteMarkdownEditor from '@/components/RecordNoteMarkdownEditor.vue'
import Auth from '@/utils/Auth'
import {
  deleteSessionRecordNoteDraft,
  getSessionRecordNoteDraft,
  setSessionRecordNoteDraft
} from '@/utils/RecordNoteDrafts'
import {
  deleteRecordNoteDraft,
  loadRecordNoteDraft,
  saveRecordNoteDraft
} from '@/utils/RecordNoteDraftDB'
import { useDialog, useMessage } from 'naive-ui'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

const props = defineProps<{
  show: boolean
  record: API.Record | null
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'after-leave'): void
}>()

const message = useMessage()
const dialog = useDialog()

const editorText = ref('')
const savedText = ref('')
const editorInitialText = ref('')
const editorBaseline = ref('')
const editorReady = ref(false)
const draftOriginalServerText = ref('')
const conflictServerText = ref<string | null>(null)
const draftLoading = ref(false)
const saving = ref(false)
const savingAction = ref<'save' | 'save-close' | null>(null)
const persistState = ref<'idle' | 'saving' | 'saved' | 'error'>('idle')
const editorRevision = ref(0)
const problemExpanded = ref(false)

const editorRef = ref<InstanceType<typeof RecordNoteMarkdownEditor> | null>(null)
const draftDebounceMs = 500
let draftTimer: ReturnType<typeof setTimeout> | null = null
let persistRun: Promise<boolean> | null = null
let suppressDraftWatch = false
let draftGeneration = 0
let openRequestId = 0

const isDirty = computed(() => editorText.value !== savedText.value)
const hasConflict = computed(() => conflictServerText.value !== null)
const hasLocalDraft = computed(() => isDirty.value || hasConflict.value)
const canSave = computed(() => {
  return !saving.value && !draftLoading.value && !hasConflict.value && isDirty.value
})

const currentAccountId = () => Auth.user.value?.account_id ?? ''

const draftSnapshot = () => {
  const record = props.record
  if (!record) return null
  return {
    accountId: currentAccountId(),
    recordId: record.id,
    text: editorText.value,
    originalServerText: draftOriginalServerText.value,
    updatedAt: Date.now()
  }
}

const cancelDraftTimer = () => {
  if (draftTimer !== null) {
    clearTimeout(draftTimer)
    draftTimer = null
  }
}

const removeLocalDrafts = async () => {
  const record = props.record
  if (!record) return

  const accountId = currentAccountId()
  deleteSessionRecordNoteDraft(accountId, record.id)
  if (!accountId) return
  try {
    await deleteRecordNoteDraft(accountId, record.id)
  } catch (error) {
    console.warn('failed to remove local note draft', error)
  }
}

const persistLatestDraft = async (): Promise<boolean> => {
  if (persistRun) return persistRun
  cancelDraftTimer()

  persistRun = (async () => {
    for (;;) {
      const draft = draftSnapshot()
      if (!draft) return true
      if (draft.text === draft.originalServerText && !hasConflict.value) {
        deleteSessionRecordNoteDraft(draft.accountId, draft.recordId)
        if (draft.accountId) {
          try {
            await deleteRecordNoteDraft(draft.accountId, draft.recordId)
          } catch {
            // Best effort.
          }
        }
        persistState.value = 'idle'
        return true
      }
      if (!draft.accountId) {
        setSessionRecordNoteDraft(draft)
        persistState.value = 'error'
        return false
      }

      const generation = draftGeneration
      persistState.value = 'saving'
      try {
        await saveRecordNoteDraft(draft)
      } catch (error) {
        if (generation === draftGeneration) {
          setSessionRecordNoteDraft(draft)
          persistState.value = 'error'
          console.warn('failed to persist local note draft', error)
        }
        return false
      }

      if (generation !== draftGeneration) {
        // The draft was discarded or saved while this write was in flight.
        deleteSessionRecordNoteDraft(draft.accountId, draft.recordId)
        try {
          await deleteRecordNoteDraft(draft.accountId, draft.recordId)
        } catch {
          // Best effort: the clean/missing draft will not be restored.
        }
        const current = draftSnapshot()
        if (current && (current.text !== savedText.value || hasConflict.value)) {
          continue
        }
        return true
      }

      const current = draftSnapshot()
      if (!current) return true
      if (current.text === draft.text && current.originalServerText === draft.originalServerText) {
        deleteSessionRecordNoteDraft(draft.accountId, draft.recordId)
        if (current.text === savedText.value && !hasConflict.value) {
          try {
            await deleteRecordNoteDraft(draft.accountId, draft.recordId)
          } catch {
            // Best effort.
          }
          persistState.value = 'idle'
        } else {
          persistState.value = 'saved'
        }
        return true
      }

      // Newer edits arrived while the write was in flight; persist them too.
    }
  })()

  try {
    return await persistRun
  } finally {
    persistRun = null
  }
}

const scheduleDraftPersist = () => {
  cancelDraftTimer()
  draftTimer = setTimeout(() => {
    draftTimer = null
    void persistLatestDraft()
  }, draftDebounceMs)
}

const flushDraft = async (): Promise<boolean> => {
  cancelDraftTimer()
  if (!isDirty.value && !hasConflict.value) {
    draftGeneration += 1
    await removeLocalDrafts()
    persistState.value = 'idle'
    return true
  }
  return persistLatestDraft()
}

const initialize = async () => {
  const record = props.record
  if (!record) return

  const requestId = ++openRequestId
  draftLoading.value = true
  suppressDraftWatch = true
  conflictServerText.value = null
  persistState.value = 'idle'
  cancelDraftTimer()

  const initialServerText = record.worker_desc ?? ''
  savedText.value = initialServerText
  draftOriginalServerText.value = initialServerText
  editorText.value = initialServerText
  editorInitialText.value = initialServerText

  try {
    const accountId = currentAccountId()
    const sessionDraft = getSessionRecordNoteDraft(accountId, record.id)
    let draft: { text: string; originalServerText: string } | null = sessionDraft ?? null
    let storageError = !accountId

    if (!draft && accountId) {
      try {
        draft = await loadRecordNoteDraft(accountId, record.id)
      } catch (error) {
        storageError = true
        console.warn('failed to load local note draft', error)
      }
    }

    if (draft && draft.text === draft.originalServerText) {
      deleteSessionRecordNoteDraft(accountId, record.id)
      if (accountId) {
        try {
          await deleteRecordNoteDraft(accountId, record.id)
        } catch {
          // Best effort.
        }
      }
      draft = null
    }

    if (requestId !== openRequestId || !props.show || props.record?.id !== record.id) {
      return
    }

    const currentServerText = props.record?.worker_desc ?? initialServerText
    savedText.value = currentServerText

    if (draft && draft.text === currentServerText) {
      deleteSessionRecordNoteDraft(accountId, record.id)
      if (accountId) {
        try {
          await deleteRecordNoteDraft(accountId, record.id)
        } catch {
          // Best effort.
        }
      }
      draft = null
    }

    if (!draft) {
      editorText.value = currentServerText
      draftOriginalServerText.value = currentServerText
      conflictServerText.value = null
      persistState.value = storageError ? 'error' : 'idle'
    } else {
      editorText.value = draft.text
      draftOriginalServerText.value = draft.originalServerText
      if (draft.originalServerText === currentServerText) {
        conflictServerText.value = null
        message.info('已恢复本地草稿')
      } else {
        conflictServerText.value = currentServerText
      }
      persistState.value = sessionDraft ? 'saving' : 'saved'
    }

    editorInitialText.value = editorText.value
    editorBaseline.value = ''
    editorReady.value = false
    editorRevision.value += 1
    await nextTick()
  } finally {
    if (requestId === openRequestId) {
      draftLoading.value = false
      suppressDraftWatch = false
      const sessionDraft = getSessionRecordNoteDraft(currentAccountId(), record.id)
      if (sessionDraft && sessionDraft.text !== sessionDraft.originalServerText) {
        void persistLatestDraft()
      } else if (sessionDraft) {
        deleteSessionRecordNoteDraft(currentAccountId(), record.id)
      }
      if (props.show) setTimeout(focusEditor, 0)
    }
  }
}

watch(
  () => props.show,
  (show, wasShow) => {
    if (show) {
      problemExpanded.value = false
      void initialize()
      return
    }
    if (wasShow) {
      void flushDraft()
    }
  },
  { immediate: true }
)

watch(
  () => props.record?.id,
  () => {
    if (!props.show) return
    cancelDraftTimer()
    void initialize()
  }
)

// Background refreshes must not replace what the user is editing. If the server
// text changes, keep the editor text and review both versions before overwriting.
watch(
  () => props.record?.worker_desc,
  (value) => {
    if (!props.show || value === undefined || saving.value || draftLoading.value) return
    if (value === savedText.value) return

    savedText.value = value
    if (editorText.value === value) {
      conflictServerText.value = null
      draftOriginalServerText.value = value
      draftGeneration += 1
      cancelDraftTimer()
      void removeLocalDrafts()
      persistState.value = 'idle'
      return
    }
    conflictServerText.value = value
  }
)

watch(editorText, (text) => {
  if (suppressDraftWatch || draftLoading.value) return
  const record = props.record
  if (!record) return

  if (text === savedText.value && !hasConflict.value) {
    draftGeneration += 1
    cancelDraftTimer()
    void removeLocalDrafts()
    persistState.value = 'idle'
    return
  }

  const draft = draftSnapshot()
  if (!draft) return
  setSessionRecordNoteDraft(draft)
  persistState.value = 'saving'
  scheduleDraftPersist()
})

const onEditorUpdate = (value: string) => {
  editorText.value = value
}

const onEditorReady = (markdown: string | undefined) => {
  editorBaseline.value = markdown ?? ''
  editorReady.value = true
}

// Milkdown debounces its markdown update event. Read the current document
// directly before saving or closing so the last keystrokes are not lost.
const syncEditorText = () => {
  if (!editorReady.value) return
  const latest = editorRef.value?.getMarkdown()
  if (latest === undefined) return

  if (latest === editorBaseline.value) {
    // The editor content is still (or again) the content it opened with. Keep
    // the original raw text so plain-text notes are not rewritten by a no-op
    // open/close cycle.
    if (editorText.value !== editorInitialText.value) {
      editorText.value = editorInitialText.value
    }
    return
  }
  if (latest !== editorText.value) {
    editorText.value = latest
  }
}

function focusEditor() {
  let attempts = 0
  const tryFocus = () => {
    const element = document.querySelector(
      '.record-note-markdown-editor .milkdown .editor'
    ) as HTMLElement | null
    if (element) {
      element.focus()
      return
    }
    attempts += 1
    if (attempts < 20) setTimeout(tryFocus, 50)
  }
  tryFocus()
}

const requestClose = async (): Promise<boolean> => {
  if (saving.value || draftLoading.value) return false
  syncEditorText()
  const saved = await flushDraft()
  if (!saved) {
    message.warning('草稿未能保存到本机，将仅保留在当前页面。')
  }
  emit('update:show', false)
  // Stop n-modal from also hiding itself when this is the header close button.
  return false
}

const save = async (closeAfter: boolean) => {
  if (!props.record || saving.value || draftLoading.value || hasConflict.value) return
  syncEditorText()
  if (!isDirty.value) return

  const recordId = props.record.id
  const textToSave = editorText.value
  saving.value = true
  savingAction.value = closeAfter ? 'save-close' : 'save'

  try {
    const updated = await records.updateWorkerDesc(recordId, textToSave)
    const serverText = updated.worker_desc ?? ''

    // Capture edits that landed while the request was in flight.
    syncEditorText()
    const hasNewerEdits = editorText.value !== textToSave
    savedText.value = serverText
    draftOriginalServerText.value = serverText
    conflictServerText.value = null

    if (!hasNewerEdits) {
      draftGeneration += 1
      cancelDraftTimer()
      if (serverText !== textToSave) {
        suppressDraftWatch = true
        editorText.value = serverText
        editorInitialText.value = serverText
        editorBaseline.value = ''
        editorReady.value = false
        editorRevision.value += 1
        await nextTick()
        suppressDraftWatch = false
      } else {
        editorInitialText.value = serverText
        editorBaseline.value = editorRef.value?.getMarkdown() ?? textToSave
        editorReady.value = true
      }
      await removeLocalDrafts()
      persistState.value = 'idle'
    } else {
      editorInitialText.value = editorText.value
      editorBaseline.value = editorText.value
      editorReady.value = true
      const draft = draftSnapshot()
      if (draft) {
        setSessionRecordNoteDraft(draft)
        persistState.value = 'saving'
        void persistLatestDraft()
      }
    }

    message.success('保存成功')
    if (closeAfter) {
      const draftSaved = await flushDraft()
      if (!draftSaved) {
        message.warning('草稿未能保存到本机，将仅保留在当前页面。')
      }
      emit('update:show', false)
    }
  } catch {
    message.error('保存失败，请重试')
  } finally {
    saving.value = false
    savingAction.value = null
  }
}

const keepLocalDraft = () => {
  const serverText = conflictServerText.value
  if (serverText === null) return

  savedText.value = serverText
  draftOriginalServerText.value = serverText
  conflictServerText.value = null

  const draft = draftSnapshot()
  if (draft) {
    setSessionRecordNoteDraft(draft)
    persistState.value = 'saving'
    void persistLatestDraft()
  }
}

const useServerVersion = async () => {
  const serverText = conflictServerText.value
  if (serverText === null) return

  draftGeneration += 1
  cancelDraftTimer()
  suppressDraftWatch = true
  savedText.value = serverText
  draftOriginalServerText.value = serverText
  editorText.value = serverText
  editorInitialText.value = serverText
  editorBaseline.value = ''
  editorReady.value = false
  conflictServerText.value = null
  editorRevision.value += 1
  await removeLocalDrafts()
  persistState.value = 'idle'
  await nextTick()
  suppressDraftWatch = false
}

const discardDraft = async () => {
  if (!props.record) return

  const serverText = props.record.worker_desc ?? savedText.value
  draftGeneration += 1
  cancelDraftTimer()
  suppressDraftWatch = true
  savedText.value = serverText
  draftOriginalServerText.value = serverText
  editorText.value = serverText
  editorInitialText.value = serverText
  editorBaseline.value = ''
  editorReady.value = false
  conflictServerText.value = null
  editorRevision.value += 1
  await removeLocalDrafts()
  persistState.value = 'idle'
  await nextTick()
  suppressDraftWatch = false
  message.success('已放弃本地草稿')
}

const confirmDiscard = () => {
  if (!hasLocalDraft.value) return

  dialog.warning({
    title: '放弃草稿',
    content: '本地草稿会被删除，服务器上的处理记录不会改变。',
    positiveText: '放弃草稿',
    negativeText: '取消',
    onPositiveClick: () => {
      void discardDraft()
    }
  })
}

const handleKeydown = (event: KeyboardEvent) => {
  if (!props.show) return
  if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 's') return

  event.preventDefault()
  if (hasConflict.value) {
    message.warning('请先处理服务器版本冲突')
    return
  }
  if (saving.value || draftLoading.value) return
  void save(false)
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  cancelDraftTimer()
})
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

.draft-status {
  font-size: 12px;
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

.conflict-alert {
  margin-bottom: 4px;
}

.conflict-text {
  max-height: 20vh;
  margin: 6px 0 0;
  padding: 8px;
  overflow: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  border-radius: 4px;
  background: var(--n-color-embedded, #f5f5f5);
  font-family: inherit;
  font-size: 12px;
}
</style>
