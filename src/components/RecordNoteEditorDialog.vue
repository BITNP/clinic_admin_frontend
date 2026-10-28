<template>
  <n-modal
    class="record-note-editor"
    preset="card"
    :show="show"
    :mask-closable="false"
    :close-on-esc="false"
    :auto-focus="false"
    :trap-focus="true"
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
          <n-tag v-if="hasLocalDraft" size="small" type="warning" :bordered="false"> 未保存 </n-tag>
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

    <div class="sr-only" aria-live="polite" aria-atomic="true">{{ liveAnnouncement }}</div>

    <div class="note-editor-body" :aria-busy="saving" @paste.capture="handlePaste">
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

      <section class="note-photo-section">
        <n-space align="center" justify="space-between" :wrap="true">
          <n-h3 prefix="bar" style="margin: 0">照片</n-h3>
          <n-text depth="3" class="photo-count">
            {{ totalPhotoCount }}<template v-if="maxCount !== null"> / {{ maxCount }}</template>
          </n-text>
        </n-space>

        <n-space v-if="photosLoading" align="center" :size="8">
          <n-spin size="small" />
          <n-text depth="3">正在加载照片…</n-text>
        </n-space>
        <n-alert v-if="photosError" type="error" :show-icon="false" class="photo-alert">
          {{ photosError }}
          <n-button
            text
            type="primary"
            size="small"
            :disabled="saving"
            @click="loadPhotosForRecord()"
          >
            重试
          </n-button>
        </n-alert>

        <n-alert
          v-if="recoverablePhotos.length"
          type="warning"
          :show-icon="false"
          class="photo-alert"
        >
          <div>
            检测到旧版草稿中的
            {{ recoverablePhotos.length }}
            张替换图片。替换功能已移除，不会自动上传，也不会删除原照片。
          </div>
          <n-space :size="8" style="margin-top: 8px">
            <n-button size="small" type="primary" :disabled="saving" @click="recoverLegacyPhotos">
              恢复为新照片
            </n-button>
            <n-button size="small" :disabled="saving" @click="discardLegacyPhotos"> 丢弃 </n-button>
          </n-space>
        </n-alert>

        <RecordPhotoGallery
          v-if="activeGalleryItems.length || deletedGalleryItems.length"
          :items="activeGalleryItems"
          :deleted-items="deletedGalleryItems"
          editable
          sortable
          :disabled="saving"
          @delete="deletePhotoByKey"
          @undo-delete="undoDeleteByKey"
          @remove-pending="removePendingByKey"
          @move="moveGalleryItem"
          @move-step="moveGalleryStep"
        />

        <n-alert
          v-if="photoErrors.length"
          type="error"
          closable
          class="photo-alert"
          @close="photoErrors = []"
        >
          <div v-for="(error, index) in photoErrors" :key="index">{{ error }}</div>
        </n-alert>

        <div
          class="photo-add"
          :class="{ dragging: isDragging }"
          @dragenter.prevent="isDragging = true"
          @dragover.prevent="isDragging = true"
          @dragleave.prevent="isDragging = false"
          @drop.prevent="handleDrop"
        >
          <n-space align="center" :size="10" :wrap="true">
            <n-button
              size="small"
              :disabled="photosLoading || maxCount === null || saving"
              @click="openFilePicker"
            >
              添加照片
            </n-button>
            <n-text depth="3">拖拽照片到这里，或直接粘贴截图</n-text>
          </n-space>
          <n-text depth="3" class="photo-hint">
            支持 JPEG / PNG / WebP<template v-if="maxSizeBytes !== null">
              ，单张不超过 {{ formatBytes(maxSizeBytes) }}</template
            >
          </n-text>
          <input
            ref="fileInput"
            class="hidden-file-input"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            @change="handleFileInputChange"
          />
        </div>

        <n-button
          v-if="hasFailedPhotos"
          text
          type="primary"
          size="small"
          :disabled="saving || hasConflict"
          @click="save(false)"
        >
          重试未完成的照片
        </n-button>
      </section>
    </div>

    <template #footer>
      <n-space justify="end" :wrap="true">
        <n-button :disabled="saving || draftLoading" @click="requestClose">返回</n-button>
        <n-button
          :loading="savingAction === 'save'"
          :disabled="!canSave"
          title="保存 (Ctrl+S)"
          @click="save(false)"
        >
          保存
        </n-button>
        <n-button
          type="primary"
          :loading="savingAction === 'save-close'"
          :disabled="!canSave"
          title="保存并关闭 (Ctrl+S)"
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
import RecordPhotoGallery from '@/components/RecordPhotoGallery.vue'
import Auth from '@/utils/Auth'
import { apiErrorText, isUncertainRequestError, responseStatus } from '@/utils/ApiError'
import {
  deleteSessionRecordNoteDraft,
  getSessionRecordNoteDraft,
  setSessionRecordNoteDraft
} from '@/utils/RecordNoteDrafts'
import {
  deleteRecordNoteDraft,
  loadRecordNoteDraft,
  saveRecordNoteDraft,
  type PersistedLegacyPhotoEdit,
  type PersistedPendingPhoto,
  type PersistedPhotoDeletion,
  type PersistedPhotoOrderEntry
} from '@/utils/RecordNoteDraftDB'
import {
  isPhotoSequenceUnchanged,
  isSameKeySequence,
  isSamePhotoSequence,
  movePhotoByStep,
  movePhotoIdentity,
  orderDeletions,
  photoIdentityKey,
  reconcilePhotoOrder,
  resolveDesiredPhotoOrder,
  type PendingPhotoDeletion,
  type PhotoGalleryItem,
  type PhotoMoveRequest,
  type PhotoOrderIdentity
} from '@/utils/RecordPhotoEdits'
import { useMessage } from 'naive-ui'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

type PendingPhotoStatus = 'pending' | 'uploading' | 'uploaded' | 'failed'

interface PendingPhoto {
  clientId: string
  file: File
  previewUrl: string
  status: PendingPhotoStatus
  error?: string
  uncertain: boolean
  baselinePhotoIds: number[]
}

interface RecoverablePhoto {
  clientId: string
  file: File
  previewUrl: string
}

interface LoadedDraft {
  text: string
  originalServerText: string
  pendingPhotos?: PersistedPendingPhoto[]
  pendingDeletions?: PersistedPhotoDeletion[]
  recoverablePhotos?: PersistedPendingPhoto[]
  photoOrder?: PersistedPhotoOrderEntry[]
  photoBaselineIds?: number[]
  pendingEdits?: PersistedLegacyPhotoEdit[]
}

const props = defineProps<{
  show: boolean
  record: API.Record | null
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'after-leave'): void
}>()

const message = useMessage()

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
const liveAnnouncement = ref('')
const editorRevision = ref(0)
const problemExpanded = ref(false)

const photos = ref<API.RecordPhoto[]>([])
const pendingPhotos = ref<PendingPhoto[]>([])
const pendingDeletions = ref<PendingPhotoDeletion[]>([])
const recoverablePhotos = ref<RecoverablePhoto[]>([])
const photoOrder = ref<PhotoOrderIdentity[]>([])
const photoBaselineIds = ref<number[]>([])
const photosLoading = ref(false)
const photosError = ref('')
const maxCount = ref<number | null>(null)
const maxSizeBytes = ref<number | null>(null)
const photoErrors = ref<string[]>([])
const isDragging = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

const editorRef = ref<InstanceType<typeof RecordNoteMarkdownEditor> | null>(null)
const draftDebounceMs = 500
let draftTimer: ReturnType<typeof setTimeout> | null = null
let persistRun: Promise<boolean> | null = null
let suppressDraftWatch = false
let draftGeneration = 0
let openRequestId = 0
let photosRequestId = 0
const pendingPhotoRevision = ref(0)
const draftRecordId = ref<number | null>(null)
const draftAccountId = ref('')
let draftContextRevision = 0
let disposed = false

const isDirty = computed(() => editorText.value !== savedText.value)
const hasConflict = computed(() => conflictServerText.value !== null)
const pendingCount = computed(
  () => pendingPhotos.value.filter((photo) => photo.status !== 'uploaded').length
)
const hasPendingPhotos = computed(() => pendingCount.value > 0)
const deletedPhotoIds = computed(
  () => new Set(pendingDeletions.value.map((deletion) => deletion.photoId))
)
const hasPendingDeletions = computed(() => pendingDeletions.value.length > 0)
const naturalOrderKeys = computed(() => {
  const deleted = deletedPhotoIds.value
  return [
    ...photos.value.filter((photo) => !deleted.has(photo.id)).map((photo) => `photo:${photo.id}`),
    ...pendingPhotos.value.map((photo) => `pending:${photo.clientId}`)
  ]
})
const currentOrderKeys = computed(() => photoOrder.value.map(photoIdentityKey))
const hasOrderChanges = computed(
  () => !isSameKeySequence(currentOrderKeys.value, naturalOrderKeys.value)
)
const hasPendingPhotoWork = computed(
  () => hasPendingPhotos.value || hasPendingDeletions.value || hasOrderChanges.value
)
const hasRecoverablePhotos = computed(() => recoverablePhotos.value.length > 0)
const hasLocalDraft = computed(
  () =>
    isDirty.value || hasConflict.value || hasPendingPhotoWork.value || hasRecoverablePhotos.value
)
const hasFailedPhotos = computed(
  () =>
    pendingPhotos.value.some((photo) => photo.status === 'failed') ||
    pendingDeletions.value.some((deletion) => deletion.status === 'failed')
)
const stagedDeletionCount = computed(() => {
  const ids = deletedPhotoIds.value
  return photos.value.filter((photo) => ids.has(photo.id)).length
})
const totalPhotoCount = computed(
  () => photos.value.length - stagedDeletionCount.value + pendingCount.value
)
const activeGalleryItems = computed<PhotoGalleryItem[]>(() => {
  const serverById = new Map(photos.value.map((photo) => [photo.id, photo]))
  const pendingById = new Map(pendingPhotos.value.map((photo) => [photo.clientId, photo]))
  const recordId = props.record?.id

  return photoOrder.value.flatMap((identity): PhotoGalleryItem[] => {
    if (identity.kind === 'photo') {
      const photo = serverById.get(identity.photoId)
      if (!photo) return []
      return [
        {
          key: photoIdentityKey(identity),
          kind: 'photo',
          photoId: photo.id,
          src: recordId ? records.photoSrc(recordId, photo) : photo.url,
          alt: `处理照片 ${photo.position}`
        }
      ]
    }

    const pending = pendingById.get(identity.clientId)
    if (!pending) return []
    return [
      {
        key: photoIdentityKey(identity),
        kind: 'pending',
        clientId: pending.clientId,
        src: pending.previewUrl,
        alt: pending.file.name || '照片',
        status: pending.status,
        statusLabel: photoStatusLabel(pending.status),
        error: pending.error
      }
    ]
  })
})
const deletedGalleryItems = computed<PhotoGalleryItem[]>(() => {
  const serverById = new Map(photos.value.map((photo) => [photo.id, photo]))
  const recordId = props.record?.id
  return pendingDeletions.value.flatMap((deletion): PhotoGalleryItem[] => {
    const photo = serverById.get(deletion.photoId)
    if (!photo) return []
    return [
      {
        key: `photo:${photo.id}`,
        kind: 'photo',
        photoId: photo.id,
        src: recordId ? records.photoSrc(recordId, photo) : photo.url,
        alt: `处理照片 ${photo.position}`,
        status: 'deleting',
        statusLabel: '待删除',
        error: deletion.error
      }
    ]
  })
})
const canSave = computed(() => {
  return (
    !saving.value &&
    !draftLoading.value &&
    !hasConflict.value &&
    (isDirty.value || hasPendingPhotoWork.value)
  )
})

const currentAccountId = () => Auth.user.value?.account_id ?? ''

const formatBytes = (bytes: number | null) => {
  if (bytes === null) return ''
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} B`
}

const fileContentType = (file: File) => {
  if (['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return file.type
  const extension = file.name.toLowerCase().split('.').pop()
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg'
  if (extension === 'png') return 'image/png'
  if (extension === 'webp') return 'image/webp'
  return ''
}

const photoStatusLabel = (status: PendingPhotoStatus) => {
  switch (status) {
    case 'pending':
      return '待上传'
    case 'uploading':
      return '上传中'
    case 'uploaded':
      return '已上传'
    case 'failed':
      return '失败'
  }
}

const persistablePendingPhotos = (source: PendingPhoto[]): PersistedPendingPhoto[] => {
  return source
    .filter((photo) => photo.status !== 'uploaded')
    .map((photo) => ({
      clientId: photo.clientId,
      name: photo.file.name,
      type: photo.file.type,
      size: photo.file.size,
      lastModified: photo.file.lastModified,
      data: photo.file,
      error: photo.error,
      uncertain: photo.uncertain,
      baselinePhotoIds: [...photo.baselinePhotoIds]
    }))
}

const persistableRecoverablePhotos = (): PersistedPendingPhoto[] => {
  return recoverablePhotos.value.map((photo) => ({
    clientId: photo.clientId,
    name: photo.file.name,
    type: photo.file.type,
    size: photo.file.size,
    lastModified: photo.file.lastModified,
    data: photo.file
  }))
}

const persistableDeletions = (): PersistedPhotoDeletion[] => {
  return pendingDeletions.value.map((deletion) => ({
    photoId: deletion.photoId,
    index: deletion.index,
    error: deletion.error,
    uncertain: deletion.uncertain
  }))
}

const persistablePhotoOrder = (): PersistedPhotoOrderEntry[] => {
  return photoOrder.value.map((identity) =>
    identity.kind === 'photo'
      ? { kind: 'photo' as const, photoId: identity.photoId }
      : { kind: 'pending' as const, clientId: identity.clientId }
  )
}

const draftServerOrder = (draft: {
  photoOrder?: PersistedPhotoOrderEntry[]
  pendingDeletions?: PersistedPhotoDeletion[]
}): number[] => {
  const deleted = new Set((draft.pendingDeletions ?? []).map((item) => item.photoId))
  return (draft.photoOrder ?? []).flatMap((entry) => {
    if (entry.kind !== 'photo' || entry.photoId === undefined) return []
    if (deleted.has(entry.photoId)) return []
    return [entry.photoId]
  })
}

const draftHasPhotoWork = (draft: {
  pendingPhotos?: PersistedPendingPhoto[]
  pendingDeletions?: PersistedPhotoDeletion[]
  recoverablePhotos?: PersistedPendingPhoto[]
  photoOrder?: PersistedPhotoOrderEntry[]
}) => {
  if ((draft.pendingPhotos?.length ?? 0) > 0) return true
  if ((draft.pendingDeletions?.length ?? 0) > 0) return true
  if ((draft.recoverablePhotos?.length ?? 0) > 0) return true
  if (!draft.photoOrder) return false
  const deleted = new Set((draft.pendingDeletions ?? []).map((item) => item.photoId))
  const current = photos.value.filter((photo) => !deleted.has(photo.id)).map((photo) => photo.id)
  return !isSamePhotoSequence(draftServerOrder(draft), current)
}

const draftSnapshot = () => {
  const recordId = draftRecordId.value
  if (recordId === null) return null
  return {
    accountId: draftAccountId.value,
    recordId,
    text: editorText.value,
    originalServerText: draftOriginalServerText.value,
    updatedAt: Date.now(),
    pendingPhotos: persistablePendingPhotos(pendingPhotos.value),
    pendingDeletions: persistableDeletions(),
    recoverablePhotos: persistableRecoverablePhotos(),
    photoOrder: persistablePhotoOrder(),
    photoBaselineIds: [...photoBaselineIds.value]
  }
}

const revokePhotoPreviews = () => {
  for (const photo of pendingPhotos.value) {
    if (photo.previewUrl.startsWith('blob:')) URL.revokeObjectURL(photo.previewUrl)
  }
  for (const photo of recoverablePhotos.value) {
    if (photo.previewUrl.startsWith('blob:')) URL.revokeObjectURL(photo.previewUrl)
  }
}

const restorePendingPhotos = (stored?: PersistedPendingPhoto[]) => {
  pendingPhotos.value = (stored ?? []).map((photo) => {
    const file = new File([photo.data], photo.name, {
      type: photo.type,
      lastModified: photo.lastModified
    })
    return {
      clientId: photo.clientId,
      file,
      previewUrl: URL.createObjectURL(file),
      status: photo.uncertain || photo.error ? 'failed' : 'pending',
      error: photo.uncertain ? '上次上传状态未知，重试前会先核对服务器照片。' : photo.error,
      uncertain: photo.uncertain ?? false,
      baselinePhotoIds: photo.baselinePhotoIds ?? []
    }
  })
}

const restoreRecoverablePhotos = (stored?: PersistedPendingPhoto[]) => {
  recoverablePhotos.value = (stored ?? []).map((photo) => {
    const file = new File([photo.data], photo.name || '照片', {
      type: photo.type,
      lastModified: photo.lastModified
    })
    return {
      clientId: photo.clientId,
      file,
      previewUrl: URL.createObjectURL(file)
    }
  })
}

const restorePendingDeletions = (stored?: PersistedPhotoDeletion[]) => {
  pendingDeletions.value = (stored ?? []).map((deletion) => ({
    photoId: deletion.photoId,
    index: deletion.index,
    status: deletion.uncertain || deletion.error ? 'failed' : 'pending',
    error: deletion.uncertain ? '上次删除状态未知，保存时会先核对服务器照片。' : deletion.error,
    uncertain: deletion.uncertain ?? false
  }))
}

const restorePhotoOrder = (stored?: PersistedPhotoOrderEntry[]) => {
  photoOrder.value = (stored ?? []).flatMap((entry): PhotoOrderIdentity[] => {
    if (entry.kind === 'photo' && entry.photoId !== undefined) {
      return [{ kind: 'photo', photoId: entry.photoId }]
    }
    if (entry.kind === 'pending' && entry.clientId) {
      return [{ kind: 'pending', clientId: entry.clientId }]
    }
    return []
  })
}

const syncPhotoOrder = (storedOrder?: PhotoOrderIdentity[], adoptServerOrder = false) => {
  photoOrder.value = reconcilePhotoOrder(
    adoptServerOrder ? undefined : storedOrder ?? photoOrder.value,
    photos.value,
    pendingPhotos.value,
    deletedPhotoIds.value
  )
}

const clearPendingWork = (keepRecoverable = false) => {
  for (const photo of pendingPhotos.value) {
    if (photo.previewUrl.startsWith('blob:')) URL.revokeObjectURL(photo.previewUrl)
  }
  pendingPhotos.value = []
  pendingDeletions.value = []
  photoOrder.value = []
  if (!keepRecoverable) {
    for (const photo of recoverablePhotos.value) {
      if (photo.previewUrl.startsWith('blob:')) URL.revokeObjectURL(photo.previewUrl)
    }
    recoverablePhotos.value = []
  }
}

const cancelDraftTimer = () => {
  if (draftTimer !== null) {
    clearTimeout(draftTimer)
    draftTimer = null
  }
}

const removeLocalDrafts = async () => {
  const recordId = draftRecordId.value
  if (recordId === null) return
  const accountId = draftAccountId.value
  deleteSessionRecordNoteDraft(accountId, recordId)
  if (!accountId) return
  try {
    await deleteRecordNoteDraft(accountId, recordId)
  } catch (error) {
    console.warn('failed to remove local note draft', error)
  }
}

const persistLatestDraft = async (): Promise<boolean> => {
  if (persistRun) return persistRun
  cancelDraftTimer()

  const contextRevision = draftContextRevision
  persistRun = (async () => {
    for (;;) {
      if (contextRevision !== draftContextRevision) return true
      const draft = draftSnapshot()
      if (!draft) return true
      if (draft.accountId !== draftAccountId.value || currentAccountId() !== draft.accountId) {
        return false
      }
      if (
        draft.text === draft.originalServerText &&
        !hasConflict.value &&
        !draftHasPhotoWork(draft)
      ) {
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
      const photoRevision = pendingPhotoRevision.value
      persistState.value = 'saving'
      try {
        await saveRecordNoteDraft(draft)
        if (contextRevision !== draftContextRevision) return true
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
          // Best effort.
        }
        const current = draftSnapshot()
        if (
          current &&
          (current.text !== savedText.value || hasConflict.value || draftHasPhotoWork(current))
        ) {
          continue
        }
        return true
      }

      const current = draftSnapshot()
      if (!current) return true
      if (
        current.text === draft.text &&
        current.originalServerText === draft.originalServerText &&
        pendingPhotoRevision.value === photoRevision
      ) {
        deleteSessionRecordNoteDraft(draft.accountId, draft.recordId)
        if (current.text === savedText.value && !hasConflict.value && !draftHasPhotoWork(current)) {
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
  if (
    !isDirty.value &&
    !hasConflict.value &&
    !hasPendingPhotoWork.value &&
    !hasRecoverablePhotos.value
  ) {
    draftGeneration += 1
    await removeLocalDrafts()
    persistState.value = 'idle'
    return true
  }
  return persistLatestDraft()
}

const loadPhotosForRecord = async (recordId?: number): Promise<API.RecordPhotoList | null> => {
  const target = recordId ?? props.record?.id
  if (!target) return null

  const requestId = ++photosRequestId
  const preserveOrder = hasOrderChanges.value
  photosLoading.value = true
  photosError.value = ''
  try {
    const list = await records.listRecordPhotos(target)
    if (requestId !== photosRequestId || props.record?.id !== target) return null
    photos.value = list.items
    maxCount.value = list.max_count
    maxSizeBytes.value = list.max_size_bytes
    if (preserveOrder) {
      syncPhotoOrder()
    } else {
      syncPhotoOrder(undefined, true)
      if (!hasPendingDeletions.value) {
        photoBaselineIds.value = list.items.map((photo) => photo.id)
      }
    }
    return list
  } catch (error) {
    if (requestId === photosRequestId && props.record?.id === target) {
      photosError.value = apiErrorText(error, '照片列表加载失败，请重试。')
      if (photos.value.length === 0 && maxCount.value === null) {
        photos.value = []
        maxCount.value = null
        maxSizeBytes.value = null
      }
    }
    return null
  } finally {
    if (requestId === photosRequestId && props.record?.id === target) {
      photosLoading.value = false
    }
  }
}

const refreshPhotosFromServer = async (recordId: number): Promise<API.RecordPhotoList | null> => {
  const preserveOrder = hasOrderChanges.value
  try {
    const list = await records.listRecordPhotos(recordId)
    if (props.record?.id === recordId) {
      photos.value = list.items
      maxCount.value = list.max_count
      maxSizeBytes.value = list.max_size_bytes
      photosError.value = ''
      if (preserveOrder) syncPhotoOrder()
      else syncPhotoOrder(undefined, true)
    }
    return list
  } catch (error) {
    if (props.record?.id === recordId) {
      photosError.value = apiErrorText(error, '照片列表刷新失败，请重试。')
    }
    return null
  }
}

const newClientId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`

const photoValidationError = (file: File): string => {
  const name = file.name || '截图'
  if (file.size === 0) return `${name}：文件为空。`
  if (!fileContentType(file)) return `${name}：仅支持 JPEG、PNG、WebP。`
  if (maxSizeBytes.value !== null && file.size > maxSizeBytes.value) {
    return `${name}：超过单张 ${formatBytes(maxSizeBytes.value)} 的上限。`
  }
  return ''
}

const ensurePhotoBaseline = () => {
  if (photoBaselineIds.value.length === 0) {
    photoBaselineIds.value = photos.value.map((photo) => photo.id)
  }
}

const addFiles = (files: File[]) => {
  if (saving.value || draftLoading.value) return

  const errors: string[] = []
  if (maxCount.value === null || maxSizeBytes.value === null) {
    photoErrors.value = ['照片上限尚未加载，请稍后重试。']
    return
  }

  let remaining = maxCount.value - totalPhotoCount.value
  const additions: PendingPhoto[] = []

  for (const file of files) {
    const error = photoValidationError(file)
    if (error) {
      errors.push(error)
      continue
    }
    if (remaining <= 0) {
      errors.push(`${file.name || '截图'}：照片数量已达上限 ${maxCount.value} 张。`)
      continue
    }

    additions.push({
      clientId: newClientId(),
      file,
      previewUrl: URL.createObjectURL(file),
      status: 'pending',
      uncertain: false,
      baselinePhotoIds: []
    })
    remaining -= 1
  }

  if (additions.length > 0) {
    ensurePhotoBaseline()
    pendingPhotos.value = [...pendingPhotos.value, ...additions]
    photoOrder.value = [
      ...photoOrder.value,
      ...additions.map(
        (photo): PhotoOrderIdentity => ({ kind: 'pending', clientId: photo.clientId })
      )
    ]
    syncPhotoOrder()
    message.success(`已添加 ${additions.length} 张照片`)
  }

  photoErrors.value = errors
  if (errors.length > 0 && additions.length === 0) {
    message.warning('部分照片未添加，请查看照片区域的提示。')
  }
}

const openFilePicker = () => {
  if (maxCount.value !== null && totalPhotoCount.value >= maxCount.value) {
    message.warning(`照片数量已达上限 ${maxCount.value} 张`)
    return
  }
  fileInput.value?.click()
}

const handleFileInputChange = (event: Event) => {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''
  if (files.length) addFiles(files)
}

const handlePaste = (event: ClipboardEvent) => {
  const items = event.clipboardData?.items
  if (!items) return

  const files: File[] = []
  for (const item of Array.from(items)) {
    if (item.kind !== 'file' || !item.type.startsWith('image/')) continue
    const file = item.getAsFile()
    if (file) files.push(file)
  }
  if (files.length === 0) return

  event.preventDefault()
  event.stopPropagation()
  addFiles(files)
}

const handleDrop = (event: DragEvent) => {
  isDragging.value = false
  const files = Array.from(event.dataTransfer?.files ?? [])
  if (files.length) addFiles(files)
}

const photoIdFromKey = (key: string): number | null => {
  if (!key.startsWith('photo:')) return null
  const id = Number(key.slice('photo:'.length))
  return Number.isInteger(id) && id > 0 ? id : null
}

const clientIdFromKey = (key: string): string | null => {
  if (!key.startsWith('pending:')) return null
  return key.slice('pending:'.length) || null
}

const deletePhotoByKey = (key: string) => {
  if (saving.value || draftLoading.value) return
  const photoId = photoIdFromKey(key)
  if (photoId === null) return
  if (pendingDeletions.value.some((deletion) => deletion.photoId === photoId)) return
  const index = photoOrder.value.findIndex((identity) => photoIdentityKey(identity) === key)
  if (index < 0) return

  photoOrder.value = photoOrder.value.filter((identity) => photoIdentityKey(identity) !== key)
  pendingDeletions.value = [
    ...pendingDeletions.value,
    {
      photoId,
      index,
      status: 'pending',
      uncertain: false
    }
  ]
  photoErrors.value = []
  ensurePhotoBaseline()
  message.info('已标记为待删除，保存后才会从服务器删除')
}

const undoDeleteByKey = (key: string) => {
  if (saving.value || draftLoading.value) return
  const photoId = photoIdFromKey(key)
  if (photoId === null) return
  const deletion = pendingDeletions.value.find((item) => item.photoId === photoId)
  if (!deletion) return

  pendingDeletions.value = pendingDeletions.value.filter((item) => item.photoId !== photoId)
  const identity: PhotoOrderIdentity = { kind: 'photo', photoId }
  const identityKey = photoIdentityKey(identity)
  if (!photoOrder.value.some((item) => photoIdentityKey(item) === identityKey)) {
    const index = Math.min(Math.max(deletion.index, 0), photoOrder.value.length)
    const next = photoOrder.value.slice()
    next.splice(index, 0, identity)
    photoOrder.value = next
  }
}

const removePendingByKey = (key: string) => {
  if (saving.value || draftLoading.value) return
  const clientId = clientIdFromKey(key)
  if (!clientId) return
  const photo = pendingPhotos.value.find((item) => item.clientId === clientId)
  if (!photo || photo.status === 'uploading' || photo.status === 'uploaded') return
  if (photo.previewUrl.startsWith('blob:')) URL.revokeObjectURL(photo.previewUrl)
  pendingPhotos.value = pendingPhotos.value.filter((item) => item.clientId !== clientId)
  photoOrder.value = photoOrder.value.filter((identity) => photoIdentityKey(identity) !== key)
}

const moveGalleryItem = (request: PhotoMoveRequest) => {
  if (saving.value || draftLoading.value) return
  photoOrder.value = movePhotoIdentity(
    photoOrder.value,
    request.fromKey,
    request.toKey,
    request.position
  )
  ensurePhotoBaseline()
}

const moveGalleryStep = (key: string, delta: number) => {
  if (saving.value || draftLoading.value) return
  photoOrder.value = movePhotoByStep(photoOrder.value, key, delta)
  ensurePhotoBaseline()
}

const recoverLegacyPhotos = () => {
  if (saving.value || draftLoading.value || recoverablePhotos.value.length === 0) return
  ensurePhotoBaseline()
  const additions: PendingPhoto[] = recoverablePhotos.value.map((photo) => ({
    clientId: photo.clientId,
    file: photo.file,
    previewUrl: photo.previewUrl,
    status: 'pending',
    uncertain: false,
    baselinePhotoIds: []
  }))
  pendingPhotos.value = [...pendingPhotos.value, ...additions]
  photoOrder.value = [
    ...photoOrder.value,
    ...additions.map((photo): PhotoOrderIdentity => ({ kind: 'pending', clientId: photo.clientId }))
  ]
  recoverablePhotos.value = []
  syncPhotoOrder()
  message.success(`已将 ${additions.length} 张旧照片恢复为待上传照片`)
}

const discardLegacyPhotos = () => {
  if (saving.value || draftLoading.value) return
  for (const photo of recoverablePhotos.value) {
    if (photo.previewUrl.startsWith('blob:')) URL.revokeObjectURL(photo.previewUrl)
  }
  recoverablePhotos.value = []
  message.info('已丢弃旧版替换图片')
}

const markPhotoUploaded = (photo: PendingPhoto, uploaded: API.RecordPhoto) => {
  const pendingKey = `pending:${photo.clientId}`
  if (photo.previewUrl.startsWith('blob:')) URL.revokeObjectURL(photo.previewUrl)
  pendingPhotos.value = pendingPhotos.value.filter((item) => item.clientId !== photo.clientId)

  const identity: PhotoOrderIdentity = { kind: 'photo', photoId: uploaded.id }
  const index = photoOrder.value.findIndex((item) => photoIdentityKey(item) === pendingKey)
  if (index >= 0) {
    const next = photoOrder.value.slice()
    next[index] = identity
    photoOrder.value = next
  } else if (
    !photoOrder.value.some((item) => photoIdentityKey(item) === photoIdentityKey(identity))
  ) {
    photoOrder.value = [...photoOrder.value, identity]
  }
}

const reconcileUncertainPhotos = async (
  recordId: number,
  knownList?: API.RecordPhotoList
): Promise<{ ok: boolean; uploaded: number }> => {
  const uncertain = pendingPhotos.value.filter(
    (photo) => photo.status !== 'uploaded' && photo.uncertain
  )
  if (uncertain.length === 0) return { ok: true, uploaded: 0 }

  let list: API.RecordPhotoList
  if (knownList) {
    list = knownList
  } else {
    try {
      list = await records.listRecordPhotos(recordId)
    } catch {
      for (const photo of uncertain) {
        photo.status = 'failed'
        photo.error = '无法核对上次上传状态，请稍后重试。'
      }
      await flushDraft()
      return { ok: false, uploaded: 0 }
    }
  }

  if (props.record?.id === recordId) {
    photos.value = list.items
    maxCount.value = list.max_count
    maxSizeBytes.value = list.max_size_bytes
  }

  const claimed = new Set<number>()
  let uploaded = 0
  for (const photo of uncertain) {
    const candidate = list.items.find(
      (item) => !photo.baselinePhotoIds.includes(item.id) && !claimed.has(item.id)
    )
    if (candidate) {
      claimed.add(candidate.id)
      markPhotoUploaded(photo, candidate)
      uploaded += 1
      continue
    }

    photo.status = 'pending'
    photo.uncertain = false
    photo.error = undefined
  }

  syncPhotoOrder()
  await flushDraft()
  if (uploaded > 0) {
    await records.reloadRecord(recordId).catch(() => {})
  }
  return { ok: true, uploaded }
}

const uploadPendingPhotos = async (
  recordId: number,
  shouldContinue?: () => boolean
): Promise<{ uploaded: number; failed: number; stopped: boolean }> => {
  let uploaded = 0
  let failed = 0

  for (const photo of [...pendingPhotos.value]) {
    if (shouldContinue && !shouldContinue()) {
      return { uploaded, failed, stopped: true }
    }
    if (photo.status === 'uploaded') continue
    if (photo.status === 'failed' && photo.uncertain) {
      photo.error = photo.error ?? '上次上传状态未知，请稍后重试。'
      failed += 1
      return { uploaded, failed, stopped: true }
    }

    photo.status = 'uploading'
    photo.uncertain = true
    photo.error = undefined
    photo.baselinePhotoIds = photos.value.map((item) => item.id)
    await flushDraft()

    try {
      const uploadedPhoto = await records.appendRecordPhoto(recordId, photo.file)
      photos.value = [...photos.value, uploadedPhoto]
      markPhotoUploaded(photo, uploadedPhoto)
      syncPhotoOrder()
      uploaded += 1
      await flushDraft()
    } catch (error) {
      const uncertain = isUncertainRequestError(error)
      photo.status = 'failed'
      photo.uncertain = uncertain
      photo.error = uncertain
        ? '上传状态未知，将在重试前先核对服务器照片。'
        : apiErrorText(error) || '照片上传失败。'
      failed += 1
      await flushDraft()
      return { uploaded, failed, stopped: true }
    }
  }

  return { uploaded, failed, stopped: false }
}

const migrateLegacyPhotoEdits = (legacy?: PersistedLegacyPhotoEdit[]): boolean => {
  if (!legacy?.length) return false
  let changed = false
  for (const edit of legacy) {
    if (edit.kind === 'remove') {
      if (pendingDeletions.value.some((item) => item.photoId === edit.photoId)) continue
      pendingDeletions.value = [
        ...pendingDeletions.value,
        {
          photoId: edit.photoId,
          index: Math.max(0, edit.originalPosition - 1),
          status: edit.uncertain || edit.error ? 'failed' : 'pending',
          error: edit.uncertain ? '上次删除状态未知，保存时会先核对服务器照片。' : edit.error,
          uncertain: edit.uncertain ?? false
        }
      ]
      changed = true
      continue
    }

    if (edit.kind !== 'replace' || !edit.data) continue
    const file = new File([edit.data], edit.name || '照片', {
      type: edit.type,
      lastModified: edit.lastModified
    })
    recoverablePhotos.value = [
      ...recoverablePhotos.value,
      {
        clientId: newClientId(),
        file,
        previewUrl: URL.createObjectURL(file)
      }
    ]
    changed = true
  }
  return changed
}

const initialize = async () => {
  const record = props.record
  if (!record) return

  const accountId = currentAccountId()
  const requestId = ++openRequestId
  draftContextRevision += 1
  draftRecordId.value = record.id
  draftAccountId.value = accountId
  draftLoading.value = true
  suppressDraftWatch = true
  conflictServerText.value = null
  persistState.value = 'idle'
  cancelDraftTimer()
  clearPendingWork()

  photos.value = []
  photoBaselineIds.value = []
  maxCount.value = null
  maxSizeBytes.value = null
  photosError.value = ''
  photoErrors.value = []
  const loadedPhotoList = await loadPhotosForRecord(record.id)

  const initialServerText = record.worker_desc ?? ''
  savedText.value = initialServerText
  draftOriginalServerText.value = initialServerText
  editorText.value = initialServerText
  editorInitialText.value = initialServerText
  let migratedDraft = false

  try {
    const sessionDraft = getSessionRecordNoteDraft(accountId, record.id)
    let draft: LoadedDraft | null = sessionDraft ?? null
    let storageError = !accountId

    if (!draft && accountId) {
      try {
        draft = await loadRecordNoteDraft(accountId, record.id)
      } catch (error) {
        storageError = true
        console.warn('failed to load local note draft', error)
      }
    }

    if (draft && draft.text === draft.originalServerText && !draftHasPhotoWork(draft)) {
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

    if (
      requestId !== openRequestId ||
      !props.show ||
      props.record?.id !== record.id ||
      currentAccountId() !== accountId
    ) {
      return
    }

    const currentServerText = props.record?.worker_desc ?? initialServerText
    savedText.value = currentServerText

    if (draft && draft.text === currentServerText && !draftHasPhotoWork(draft)) {
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
      restorePendingPhotos([])
      restoreRecoverablePhotos([])
      restorePendingDeletions([])
      restorePhotoOrder([])
      syncPhotoOrder()
    } else {
      editorText.value = draft.text
      draftOriginalServerText.value = draft.originalServerText
      restorePendingPhotos(draft.pendingPhotos)
      restoreRecoverablePhotos(draft.recoverablePhotos)
      restorePendingDeletions(draft.pendingDeletions)
      restorePhotoOrder(draft.photoOrder)
      migratedDraft = migrateLegacyPhotoEdits(draft.pendingEdits)
      syncPhotoOrder()
      if (draft.originalServerText === currentServerText) {
        conflictServerText.value = null
        message.info('已恢复本地草稿')
      } else {
        conflictServerText.value = currentServerText
      }
      persistState.value = sessionDraft ? 'saving' : 'saved'
    }

    if (draft?.photoBaselineIds && draft.photoBaselineIds.length > 0) {
      photoBaselineIds.value = [...draft.photoBaselineIds]
    } else {
      photoBaselineIds.value =
        loadedPhotoList?.items.map((photo) => photo.id) ?? photos.value.map((photo) => photo.id)
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
      const sessionDraft = getSessionRecordNoteDraft(accountId, record.id)
      if (
        sessionDraft &&
        (sessionDraft.text !== sessionDraft.originalServerText || draftHasPhotoWork(sessionDraft))
      ) {
        void persistLatestDraft()
      } else if (sessionDraft) {
        deleteSessionRecordNoteDraft(accountId, record.id)
      }
      if (migratedDraft) {
        void persistLatestDraft()
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
      if (hasPendingPhotoWork.value || hasRecoverablePhotos.value) {
        const draft = draftSnapshot()
        if (draft) {
          setSessionRecordNoteDraft(draft)
          persistState.value = 'saving'
          scheduleDraftPersist()
        }
      } else {
        draftGeneration += 1
        cancelDraftTimer()
        void removeLocalDrafts()
        persistState.value = 'idle'
      }
      return
    }
    conflictServerText.value = value
  }
)

watch(editorText, (text) => {
  if (suppressDraftWatch || draftLoading.value) return
  if (draftRecordId.value === null) return

  if (
    text === savedText.value &&
    !hasConflict.value &&
    !hasPendingPhotoWork.value &&
    !hasRecoverablePhotos.value
  ) {
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

watch(
  [pendingPhotos, pendingDeletions, recoverablePhotos, photoOrder],
  () => {
    pendingPhotoRevision.value += 1
    if (suppressDraftWatch || draftLoading.value) return

    if (
      hasPendingPhotoWork.value ||
      hasRecoverablePhotos.value ||
      isDirty.value ||
      hasConflict.value
    ) {
      const draft = draftSnapshot()
      if (draft) {
        setSessionRecordNoteDraft(draft)
        persistState.value = 'saving'
        scheduleDraftPersist()
      }
      return
    }

    draftGeneration += 1
    cancelDraftTimer()
    void removeLocalDrafts()
    persistState.value = 'idle'
  },
  { deep: true }
)

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
  // Do not require the ready event here. If the user saves immediately after
  // opening the dialog, getMarkdown() may already work while the ready event is
  // still pending; requiring it would drop the last edit from the save request.
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
  if (disposed) return
  let attempts = 0
  const tryFocus = () => {
    if (disposed || !props.show) return
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

const saveTextDraft = async (recordId: number): Promise<boolean> => {
  const textToSave = editorText.value
  try {
    const updated = await records.updateWorkerDesc(recordId, textToSave)
    draftGeneration += 1
    cancelDraftTimer()

    const serverText = updated.worker_desc ?? ''
    syncEditorText()
    const hasNewerEdits = editorText.value !== textToSave
    savedText.value = serverText
    draftOriginalServerText.value = serverText
    conflictServerText.value = null

    if (!hasNewerEdits) {
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
    } else {
      editorInitialText.value = editorText.value
      editorBaseline.value = editorText.value
      editorReady.value = true
    }
    return true
  } catch (error) {
    const text = apiErrorText(error) || '正文保存失败，请重试'
    liveAnnouncement.value = text
    message.error(text)
    return false
  }
}

const performSave = async (closeAfter: boolean) => {
  const record = props.record
  const recordId = draftRecordId.value
  const accountId = draftAccountId.value
  if (
    !record ||
    recordId === null ||
    props.record?.id !== recordId ||
    currentAccountId() !== accountId ||
    saving.value ||
    draftLoading.value ||
    hasConflict.value
  ) {
    return
  }
  syncEditorText()

  let textChanged = isDirty.value
  const photoWorkRequested = hasPendingPhotoWork.value
  const orderWorkRequested = hasOrderChanges.value
  const deletionWorkRequested = pendingDeletions.value.length > 0
  if (!textChanged && !photoWorkRequested) return

  const isCurrentContext = () => {
    return (
      !disposed &&
      props.show &&
      draftRecordId.value === recordId &&
      props.record?.id === recordId &&
      currentAccountId() === accountId
    )
  }

  photoErrors.value = []
  liveAnnouncement.value = '正在保存更改'
  saving.value = true
  savingAction.value = closeAfter ? 'save-close' : 'save'

  let textSaved = !textChanged
  let deleted = 0
  let uploaded = 0
  let orderSaved = false
  let stopped = false
  let reconciliationFailed = false
  let finalRefreshOk = true

  const removeDeletion = (photoId: number) => {
    pendingDeletions.value = pendingDeletions.value.filter(
      (deletion) => deletion.photoId !== photoId
    )
  }

  try {
    // 1. Read the latest note and the authoritative photo list before touching
    // anything. Positions are recomputed from this list by stable photo id.
    let latestRecord: API.Record
    try {
      latestRecord = await records.reloadRecord(recordId)
    } catch (error) {
      const text = apiErrorText(error, '无法读取服务器最新状态，请重试。')
      liveAnnouncement.value = text
      message.error(text)
      await flushDraft()
      return
    }

    let latestList: API.RecordPhotoList | null = null
    try {
      latestList = await records.listRecordPhotos(recordId)
    } catch (error) {
      // A text-only save does not depend on the photo list. Photo work does, so
      // stop before mutating anything when positions cannot be verified.
      if (photoWorkRequested) {
        const text = apiErrorText(error, '无法读取服务器照片列表，请重试。')
        liveAnnouncement.value = text
        message.error(text)
        await flushDraft()
        return
      }
    }

    if (!isCurrentContext()) return

    if (latestList) {
      photos.value = latestList.items
      maxCount.value = latestList.max_count
      maxSizeBytes.value = latestList.max_size_bytes
      photosError.value = ''
      if (orderWorkRequested) syncPhotoOrder()
      else syncPhotoOrder(undefined, true)
    }

    // 2a. Detect note changes made while this dialog was open.
    const latestText = latestRecord.worker_desc ?? ''
    if (latestText !== savedText.value) {
      if (!textChanged) {
        // The note was not edited here, so accept the newer server text instead
        // of turning a photo-only save into a text conflict.
        savedText.value = latestText
        draftOriginalServerText.value = latestText
        if (editorText.value !== latestText) {
          suppressDraftWatch = true
          editorText.value = latestText
          editorInitialText.value = latestText
          editorBaseline.value = ''
          editorReady.value = false
          editorRevision.value += 1
          await nextTick()
          suppressDraftWatch = false
        }
      } else if (latestText === editorText.value) {
        // The server already has the text this editor would submit.
        savedText.value = latestText
        draftOriginalServerText.value = latestText
        textChanged = false
        textSaved = true
      } else {
        savedText.value = latestText
        conflictServerText.value = latestText
        liveAnnouncement.value = '保存暂停：服务器上的处理记录已变化，请先处理冲突。'
        message.warning('服务器上的处理记录已变化，请先处理冲突。')
        await flushDraft()
        return
      }
    }

    // 2b. Detect photo-list changes since the draft order/deletions were
    // created. The comparison ignores photos staged for deletion.
    const latestIds =
      latestList?.items.map((photo) => photo.id) ?? photos.value.map((photo) => photo.id)
    const latestIdSet = new Set(latestIds)
    const deletionIds = new Set(pendingDeletions.value.map((deletion) => deletion.photoId))
    if (
      (orderWorkRequested || deletionWorkRequested) &&
      photoBaselineIds.value.length > 0 &&
      !isPhotoSequenceUnchanged(photoBaselineIds.value, latestIds, deletionIds)
    ) {
      photoBaselineIds.value = latestIds
      photoErrors.value = [
        '照片列表已在服务器上变化，已刷新。请确认照片顺序和待删除照片后再次保存。'
      ]
      liveAnnouncement.value = '保存暂停：照片列表已在服务器上变化，请确认后重试。'
      await flushDraft()
      message.warning('照片列表已变化，请确认后重试')
      return
    }
    photoBaselineIds.value = latestIds

    for (const deletion of [...pendingDeletions.value]) {
      if (!latestIdSet.has(deletion.photoId)) {
        removeDeletion(deletion.photoId)
        deleted += 1
      }
    }
    syncPhotoOrder()

    // Reconcile additions whose previous upload ended without a definitive
    // response. This must happen before new mutations so their baseline is real.
    if (!stopped && photoWorkRequested) {
      const reconciliation = await reconcileUncertainPhotos(recordId, latestList ?? undefined)
      uploaded += reconciliation.uploaded
      if (!reconciliation.ok) {
        reconciliationFailed = true
        stopped = true
      }
      syncPhotoOrder()
    }

    // 3. Save changed note text. Photo failures never discard a successful text
    // save; a text failure stops the coordinator before photo mutations begin.
    if (textChanged) {
      const saved = await saveTextDraft(recordId)
      if (!saved) {
        await flushDraft()
        return
      }
      textSaved = true
    }

    // 4. Apply deletions from the highest position down. This keeps every
    // lower position stable for the rest of the deletions.
    if (!stopped) {
      const deletions = orderDeletions(pendingDeletions.value, photos.value)
      for (const deletion of deletions) {
        if (!isCurrentContext()) return
        const photo = photos.value.find((item) => item.id === deletion.photoId)
        if (!photo) {
          removeDeletion(deletion.photoId)
          deleted += 1
          continue
        }

        deletion.status = 'deleting'
        deletion.error = undefined
        await flushDraft()

        try {
          await records.deleteRecordPhoto(recordId, photo.position)
          removeDeletion(deletion.photoId)
          deleted += 1
          photos.value = photos.value.filter((item) => item.id !== deletion.photoId)
          await flushDraft()
        } catch (error) {
          const uncertain = isUncertainRequestError(error)
          deletion.status = 'failed'
          deletion.uncertain = uncertain
          deletion.error = uncertain
            ? '删除状态未知，重试前会先核对服务器照片。'
            : apiErrorText(error) || '照片删除失败。'
          stopped = true
          await flushDraft()
          break
        }
      }
    }

    // 5. Upload additions after deletions have freed any limit slots.
    if (!stopped) {
      if (!isCurrentContext()) return
      const result = await uploadPendingPhotos(recordId, isCurrentContext)
      uploaded += result.uploaded
      if (result.stopped) stopped = true
      syncPhotoOrder()
    }

    // 6/7. Resolve the final order and submit one reorder request. Expected ids
    // are the order this client believes the server currently has; the backend
    // returns 409 if another user changed it.
    let reorderedList: API.RecordPhotoList | null = null
    if (
      !stopped &&
      pendingPhotos.value.length === 0 &&
      pendingDeletions.value.length === 0 &&
      isCurrentContext()
    ) {
      const expectedIds = photos.value.map((photo) => photo.id)
      const desiredIds = resolveDesiredPhotoOrder(photoOrder.value, expectedIds)
      if (!isSamePhotoSequence(expectedIds, desiredIds)) {
        try {
          reorderedList = await records.reorderRecordPhotos(recordId, expectedIds, desiredIds)
          photos.value = reorderedList.items
          maxCount.value = reorderedList.max_count
          maxSizeBytes.value = reorderedList.max_size_bytes
          photoOrder.value = desiredIds.map(
            (photoId): PhotoOrderIdentity => ({ kind: 'photo', photoId })
          )
          for (const photo of reorderedList.items) {
            records.bumpPhotoVersion(recordId, photo.id)
          }
          photoBaselineIds.value = reorderedList.items.map((photo) => photo.id)
          orderSaved = true
          await flushDraft()
        } catch (error) {
          const status = responseStatus(error)
          const uncertain = isUncertainRequestError(error)
          stopped = true
          photoErrors.value = [
            status === 409 || status === 400
              ? '照片顺序冲突：服务器上的照片列表已变化，请重试。'
              : uncertain
                ? '照片顺序保存结果未知，请重试以重新核对。'
                : apiErrorText(error) || '照片顺序保存失败。'
          ]
          await flushDraft()
        }
      }
    }

    // 8. Refresh the record and gallery. A successful reorder response is
    // already authoritative, so only fetch again when ordering was not saved.
    if (reorderedList) {
      await records.reloadRecord(recordId).catch(() => {})
    } else if (photoWorkRequested || deleted > 0 || uploaded > 0 || stopped) {
      const finalList = await refreshPhotosFromServer(recordId)
      if (!finalList) {
        finalRefreshOk = false
      } else {
        finalRefreshOk = true
        const finalIds = new Set(finalList.items.map((photo) => photo.id))
        for (const deletion of [...pendingDeletions.value]) {
          if (!finalIds.has(deletion.photoId)) {
            removeDeletion(deletion.photoId)
            deleted += 1
          }
        }
        syncPhotoOrder()
        photoBaselineIds.value = finalList.items.map((photo) => photo.id)
      }
      await records.reloadRecord(recordId).catch(() => {})
    }

    if (!isCurrentContext()) return
    const allSucceeded =
      textSaved &&
      !isDirty.value &&
      !hasConflict.value &&
      pendingPhotos.value.length === 0 &&
      pendingDeletions.value.length === 0 &&
      !hasOrderChanges.value &&
      finalRefreshOk &&
      !reconciliationFailed

    if (allSucceeded) {
      clearPendingWork(true)
      syncPhotoOrder()
      if (hasRecoverablePhotos.value) {
        await flushDraft()
      } else {
        await removeLocalDrafts()
        persistState.value = 'idle'
      }
    } else {
      await flushDraft()
    }

    const failedAdditions = pendingPhotos.value.filter((photo) => photo.status === 'failed').length
    const failedDeletions = pendingDeletions.value.filter(
      (deletion) => deletion.status === 'failed'
    ).length
    const pendingAdditions = pendingPhotos.value.filter(
      (photo) => photo.status === 'pending' || photo.status === 'uploading'
    ).length
    const orderPending = hasOrderChanges.value
    const parts: string[] = []
    if (textChanged && textSaved) parts.push('正文已保存')
    if (isDirty.value) parts.push('正文有新的修改')
    if (deleted > 0) parts.push(`${deleted} 张照片已删除`)
    if (uploaded > 0) parts.push(`${uploaded} 张照片已上传`)
    if (orderSaved) parts.push('照片顺序已保存')
    if (failedAdditions > 0) parts.push(`${failedAdditions} 张上传失败`)
    if (failedDeletions > 0) parts.push(`${failedDeletions} 张删除失败`)
    if (pendingAdditions > 0) parts.push(`${pendingAdditions} 张待上传`)
    if (orderPending) parts.push('照片顺序待保存')
    if (!finalRefreshOk) parts.push('照片列表刷新失败')

    const summary = parts.length ? parts.join('，') : ''
    if (allSucceeded) {
      liveAnnouncement.value = summary ? `保存成功：${summary}` : '保存成功'
      message.success(summary || '保存成功')
      if (closeAfter) emit('update:show', false)
    } else {
      liveAnnouncement.value = summary ? `保存未完成：${summary}` : '保存未完成，请重试'
      message.warning(summary || '保存未完成，请重试')
    }
  } catch (error) {
    const text = apiErrorText(error) || '保存失败，请重试'
    liveAnnouncement.value = text
    message.error(text)
  } finally {
    saving.value = false
    savingAction.value = null
  }
}

const save = async (closeAfter: boolean) => {
  await performSave(closeAfter)
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
  if (hasPendingPhotoWork.value || hasRecoverablePhotos.value) {
    await flushDraft()
  } else {
    await removeLocalDrafts()
    persistState.value = 'idle'
  }
  await nextTick()
  suppressDraftWatch = false
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
  disposed = false
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  disposed = true
  openRequestId += 1
  photosRequestId += 1
  window.removeEventListener('keydown', handleKeydown)
  cancelDraftTimer()
  void persistLatestDraft()
  revokePhotoPreviews()
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
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

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

.note-photo-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 16px;
  margin-top: 8px;
  border-top: 1px solid var(--n-border-color, #eee);
}

.photo-count {
  font-size: 12px;
}

.photo-alert {
  margin: 0;
}

.photo-add {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  border: 1px dashed var(--n-border-color, #ccc);
  border-radius: 6px;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease;
}

.photo-add.dragging {
  border-color: var(--n-color-target, #18a058);
  background: var(--n-color-embedded, #f5f5f5);
}

.photo-hint {
  font-size: 12px;
}

.hidden-file-input {
  display: none;
}
</style>
