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

    <div class="note-editor-body" @paste.capture="handlePaste">
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
          <n-button text type="primary" size="small" @click="loadPhotosForRecord()">
            重试
          </n-button>
        </n-alert>

        <RecordPhotoGallery v-if="photos.length" :photos="photos" />

        <div v-if="pendingPhotos.length" class="pending-photo-list">
          <div v-for="item in pendingPhotos" :key="item.clientId" class="pending-photo">
            <n-image
              :src="item.previewUrl"
              :alt="item.file.name || '照片'"
              :width="96"
              :height="96"
              object-fit="cover"
              class="pending-photo-image"
            />
            <n-space vertical :size="2" class="pending-photo-meta">
              <n-text depth="3" class="photo-name">{{ item.file.name || '截图' }}</n-text>
              <n-tag size="tiny" :type="photoStatusType(item.status)" :bordered="false">
                {{ photoStatusLabel(item.status) }}
              </n-tag>
              <n-button
                v-if="item.status !== 'uploaded' && item.status !== 'uploading'"
                text
                type="error"
                size="tiny"
                :disabled="saving"
                @click="removePending(item.clientId)"
              >
                移除
              </n-button>
            </n-space>
            <n-text v-if="item.error" type="error" class="photo-error">
              {{ item.error }}
            </n-text>
          </div>
        </div>

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
import RecordPhotoGallery from '@/components/RecordPhotoGallery.vue'
import Auth from '@/utils/Auth'
import {
  deleteSessionRecordNoteDraft,
  getSessionRecordNoteDraft,
  setSessionRecordNoteDraft
} from '@/utils/RecordNoteDrafts'
import {
  deleteRecordNoteDraft,
  loadRecordNoteDraft,
  saveRecordNoteDraft,
  type PersistedPendingPhoto
} from '@/utils/RecordNoteDraftDB'
import { useDialog, useMessage } from 'naive-ui'
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

interface LoadedDraft {
  text: string
  originalServerText: string
  pendingPhotos?: PersistedPendingPhoto[]
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

const photos = ref<API.RecordPhoto[]>([])
const pendingPhotos = ref<PendingPhoto[]>([])
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

const isDirty = computed(() => editorText.value !== savedText.value)
const hasConflict = computed(() => conflictServerText.value !== null)
const pendingCount = computed(
  () => pendingPhotos.value.filter((photo) => photo.status !== 'uploaded').length
)
const hasPendingPhotos = computed(() => pendingCount.value > 0)
const hasLocalDraft = computed(() => isDirty.value || hasConflict.value || hasPendingPhotos.value)
const hasFailedPhotos = computed(() =>
  pendingPhotos.value.some((photo) => photo.status === 'failed')
)
const totalPhotoCount = computed(() => photos.value.length + pendingCount.value)
const canSave = computed(() => {
  return (
    !saving.value &&
    !draftLoading.value &&
    !hasConflict.value &&
    (isDirty.value || hasPendingPhotos.value)
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

const errorText = (error: unknown) => {
  const response = (
    error as { response?: { status?: number; data?: { error?: string; msg?: string } } }
  )?.response
  if (response?.status === 401 || response?.status === 403) {
    return '身份验证失败，请重新登录后重试。'
  }
  return response?.data?.error || response?.data?.msg || ''
}

const isUncertainUploadError = (error: unknown) => {
  const status = (error as { response?: { status?: number } })?.response?.status
  if (status === undefined) return true
  return status === 408 || status >= 500
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

const photoStatusType = (status: PendingPhotoStatus) => {
  switch (status) {
    case 'pending':
      return 'default'
    case 'uploading':
      return 'info'
    case 'uploaded':
      return 'success'
    case 'failed':
      return 'error'
  }
}

const persistablePendingPhotos = (): PersistedPendingPhoto[] => {
  return pendingPhotos.value
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
      baselinePhotoIds: photo.baselinePhotoIds
    }))
}

const draftSnapshot = () => {
  const record = props.record
  if (!record) return null
  return {
    accountId: currentAccountId(),
    recordId: record.id,
    text: editorText.value,
    originalServerText: draftOriginalServerText.value,
    updatedAt: Date.now(),
    pendingPhotos: persistablePendingPhotos()
  }
}

const revokePendingPreviews = () => {
  for (const photo of pendingPhotos.value) {
    if (photo.previewUrl.startsWith('blob:')) URL.revokeObjectURL(photo.previewUrl)
  }
}

const restorePendingPhotos = (stored?: PersistedPendingPhoto[]) => {
  revokePendingPreviews()
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

const clearPendingPhotos = () => {
  revokePendingPreviews()
  pendingPhotos.value = []
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
      if (
        draft.text === draft.originalServerText &&
        !hasConflict.value &&
        draft.pendingPhotos.length === 0
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
          (current.text !== savedText.value ||
            hasConflict.value ||
            current.pendingPhotos.length > 0)
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
        if (
          current.text === savedText.value &&
          !hasConflict.value &&
          current.pendingPhotos.length === 0
        ) {
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
  if (!isDirty.value && !hasConflict.value && !hasPendingPhotos.value) {
    draftGeneration += 1
    await removeLocalDrafts()
    persistState.value = 'idle'
    return true
  }
  return persistLatestDraft()
}

const loadPhotosForRecord = async (recordId?: number) => {
  const target = recordId ?? props.record?.id
  if (!target) return

  const requestId = ++photosRequestId
  photosLoading.value = true
  photosError.value = ''
  try {
    const list = await records.listRecordPhotos(target)
    if (requestId !== photosRequestId || props.record?.id !== target) return
    photos.value = list.items
    maxCount.value = list.max_count
    maxSizeBytes.value = list.max_size_bytes
  } catch {
    if (requestId === photosRequestId && props.record?.id === target) {
      photosError.value = '照片列表加载失败，请重试。'
      if (photos.value.length === 0 && maxCount.value === null) {
        photos.value = []
        maxCount.value = null
        maxSizeBytes.value = null
      }
    }
  } finally {
    if (requestId === photosRequestId && props.record?.id === target) {
      photosLoading.value = false
    }
  }
}

const addFiles = (files: File[]) => {
  if (saving.value || draftLoading.value) return

  const errors: string[] = []
  if (maxCount.value === null || maxSizeBytes.value === null) {
    photoErrors.value = ['照片上限尚未加载，请稍后重试。']
    return
  }

  let remaining = maxCount.value - photos.value.length - pendingCount.value
  const additions: PendingPhoto[] = []

  for (const file of files) {
    const name = file.name || '截图'
    const contentType = fileContentType(file)
    if (file.size === 0) {
      errors.push(`${name}：文件为空。`)
      continue
    }
    if (!contentType) {
      errors.push(`${name}：仅支持 JPEG、PNG、WebP。`)
      continue
    }
    if (file.size > maxSizeBytes.value) {
      errors.push(`${name}：超过单张 ${formatBytes(maxSizeBytes.value)} 的上限。`)
      continue
    }
    if (remaining <= 0) {
      errors.push(`${name}：照片数量已达上限 ${maxCount.value} 张。`)
      continue
    }

    additions.push({
      clientId:
        globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      status: 'pending',
      uncertain: false,
      baselinePhotoIds: []
    })
    remaining -= 1
  }

  if (additions.length > 0) {
    pendingPhotos.value = [...pendingPhotos.value, ...additions]
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

const removePending = (clientId: string) => {
  if (saving.value) return
  const photo = pendingPhotos.value.find((item) => item.clientId === clientId)
  if (!photo || photo.status === 'uploading' || photo.status === 'uploaded') return
  if (photo.previewUrl.startsWith('blob:')) URL.revokeObjectURL(photo.previewUrl)
  pendingPhotos.value = pendingPhotos.value.filter((item) => item.clientId !== clientId)
}

const markPhotoUploaded = (photo: PendingPhoto, uploaded: API.RecordPhoto) => {
  photo.status = 'uploaded'
  photo.uncertain = false
  photo.error = undefined
  if (photo.previewUrl.startsWith('blob:')) URL.revokeObjectURL(photo.previewUrl)
  photo.previewUrl = uploaded.url
}

const reconcileUncertainPhotos = async (
  recordId: number
): Promise<{ ok: boolean; uploaded: number }> => {
  const uncertain = pendingPhotos.value.filter(
    (photo) => photo.status !== 'uploaded' && photo.uncertain
  )
  if (uncertain.length === 0) return { ok: true, uploaded: 0 }

  let list: API.RecordPhotoList
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

  await flushDraft()
  if (uploaded > 0) {
    await records.reloadRecord(recordId).catch(() => {})
  }
  return { ok: true, uploaded }
}

const uploadPendingPhotos = async (
  recordId: number
): Promise<{ uploaded: number; failed: number; stopped: boolean }> => {
  let uploaded = 0
  let failed = 0

  for (const photo of pendingPhotos.value) {
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
      markPhotoUploaded(photo, uploadedPhoto)
      photos.value = [...photos.value, uploadedPhoto]
      uploaded += 1
      await flushDraft()
    } catch (error) {
      const uncertain = isUncertainUploadError(error)
      photo.status = 'failed'
      photo.uncertain = uncertain
      photo.error = uncertain
        ? '上传状态未知，将在重试前先核对服务器照片。'
        : errorText(error) || '照片上传失败。'
      failed += 1
      await flushDraft()
      return { uploaded, failed, stopped: true }
    }
  }

  return { uploaded, failed, stopped: false }
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
  clearPendingPhotos()

  photos.value = []
  maxCount.value = null
  maxSizeBytes.value = null
  photosError.value = ''
  photoErrors.value = []
  void loadPhotosForRecord(record.id)

  const initialServerText = record.worker_desc ?? ''
  savedText.value = initialServerText
  draftOriginalServerText.value = initialServerText
  editorText.value = initialServerText
  editorInitialText.value = initialServerText

  try {
    const accountId = currentAccountId()
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

    if (
      draft &&
      draft.text === draft.originalServerText &&
      (draft.pendingPhotos?.length ?? 0) === 0
    ) {
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

    if (draft && draft.text === currentServerText && (draft.pendingPhotos?.length ?? 0) === 0) {
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
    } else {
      editorText.value = draft.text
      draftOriginalServerText.value = draft.originalServerText
      restorePendingPhotos(draft.pendingPhotos)
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
      if (
        sessionDraft &&
        (sessionDraft.text !== sessionDraft.originalServerText ||
          (sessionDraft.pendingPhotos?.length ?? 0) > 0)
      ) {
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
      if (hasPendingPhotos.value) {
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
  const record = props.record
  if (!record) return

  if (text === savedText.value && !hasConflict.value && !hasPendingPhotos.value) {
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
  pendingPhotos,
  () => {
    pendingPhotoRevision.value += 1
    if (suppressDraftWatch || draftLoading.value) return

    if (hasPendingPhotos.value || isDirty.value || hasConflict.value) {
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
    message.error(errorText(error) || '正文保存失败，请重试')
    return false
  }
}

const save = async (closeAfter: boolean) => {
  if (!props.record || saving.value || draftLoading.value || hasConflict.value) return
  syncEditorText()

  const textChanged = isDirty.value
  const unfinishedPhotos = pendingPhotos.value.some((photo) => photo.status !== 'uploaded')
  if (!textChanged && !unfinishedPhotos) return

  const recordId = props.record.id
  photoErrors.value = []
  saving.value = true
  savingAction.value = closeAfter ? 'save-close' : 'save'

  let textSaved = !textChanged
  let uploaded = 0
  let photoStopped = false
  let reconciliationFailed = false

  try {
    const reconciliation = await reconcileUncertainPhotos(recordId)
    uploaded += reconciliation.uploaded
    if (!reconciliation.ok) {
      reconciliationFailed = true
      photoStopped = true
    }

    if (textChanged) {
      const saved = await saveTextDraft(recordId)
      if (!saved) {
        await flushDraft()
        return
      }
      textSaved = true
    }

    if (!photoStopped) {
      const result = await uploadPendingPhotos(recordId)
      uploaded += result.uploaded
      if (result.stopped) photoStopped = true
    }

    if (uploaded > 0) {
      await loadPhotosForRecord(recordId)
      await records.reloadRecord(recordId).catch(() => {})
    }

    const remainingPhotos = pendingPhotos.value.filter((photo) => photo.status !== 'uploaded')
    const allSucceeded = textSaved && remainingPhotos.length === 0 && !reconciliationFailed

    if (allSucceeded) {
      clearPendingPhotos()
      await removeLocalDrafts()
      persistState.value = 'idle'
    } else {
      await flushDraft()
    }

    const failed = pendingPhotos.value.filter((photo) => photo.status === 'failed').length
    const pending = pendingPhotos.value.filter((photo) => photo.status === 'pending').length
    const parts: string[] = []
    if (textChanged && textSaved) parts.push('正文已保存')
    if (isDirty.value) parts.push('正文有新的修改')
    if (uploaded > 0) parts.push(`${uploaded} 张照片已上传`)
    if (failed > 0) parts.push(`${failed} 张失败`)
    if (pending > 0) parts.push(`${pending} 张待上传`)

    if (allSucceeded) {
      message.success(parts.length ? parts.join('，') : '保存成功')
      if (closeAfter) emit('update:show', false)
    } else {
      message.warning(parts.length ? parts.join('，') : '保存未完成，请重试')
    }
  } catch (error) {
    message.error(errorText(error) || '保存失败，请重试')
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
  if (hasPendingPhotos.value) {
    await flushDraft()
  } else {
    await removeLocalDrafts()
    persistState.value = 'idle'
  }
  await nextTick()
  suppressDraftWatch = false
}

const discardDraft = async () => {
  if (!props.record) return

  const serverText = props.record.worker_desc ?? savedText.value
  draftGeneration += 1
  cancelDraftTimer()
  suppressDraftWatch = true
  clearPendingPhotos()
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
    content: '本地草稿和待上传照片会被删除，服务器上的处理记录不会改变。',
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
  revokePendingPreviews()
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

.pending-photo-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.pending-photo {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 112px;
}

.pending-photo-image {
  overflow: hidden;
  border-radius: 6px;
  border: 1px solid var(--n-border-color, #eee);
}

.pending-photo-meta {
  min-height: 52px;
}

.photo-name {
  max-width: 112px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}

.photo-error {
  font-size: 12px;
  line-height: 1.4;
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
