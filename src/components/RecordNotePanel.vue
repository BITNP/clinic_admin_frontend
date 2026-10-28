<template>
  <template v-if="record">
    <section v-if="visible" class="record-note-panel">
      <n-space align="center" justify="space-between" :wrap="false">
        <n-h3 prefix="bar" style="margin: 0">处理记录</n-h3>
        <n-button v-if="canEdit" ref="editButtonRef" size="small" @click="editorOpen = true">
          {{ hasNote ? '编辑处理记录' : '添加处理记录' }}
        </n-button>
      </n-space>

      <div v-if="hasNote" class="note-preview">
        <RecordNoteMarkdownView :markdown="record.worker_desc" />
      </div>
      <n-text v-else depth="3">暂无处理记录</n-text>

      <RecordPhotoGallery v-if="photoItems.length" :items="photoItems" />
      <n-space v-if="photosError" align="center" :size="8">
        <n-text type="error" class="photo-load-error">{{ photosError }}</n-text>
        <n-button text type="primary" size="tiny" @click="loadPhotos()">重试</n-button>
      </n-space>
    </section>

    <RecordNoteEditorDialog
      v-model:show="editorOpen"
      :record="record"
      @after-leave="handleEditorClosed"
    />
  </template>
</template>

<script setup lang="ts">
import type API from '@/store/api'
import { clearRecordNoteDrafts, hasUnsavedRecordNoteDrafts } from '@/utils/RecordNoteDrafts'
import RecordNoteEditorDialog from '@/components/RecordNoteEditorDialog.vue'
import RecordNoteMarkdownView from '@/components/RecordNoteMarkdownView.vue'
import RecordPhotoGallery from '@/components/RecordPhotoGallery.vue'
import { records } from '@/store'
import type { PhotoGalleryItem } from '@/utils/RecordPhotoEdits'
import Auth from '@/utils/Auth'
import Sync from '@/utils/Sync'
import { apiErrorText, responseStatus } from '@/utils/ApiError'
import { useDialog, useMessage } from 'naive-ui'
import { computed, nextTick, onUnmounted, ref, watch, type ComponentPublicInstance } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'

const props = defineProps<{
  record: API.Record | null
}>()

const dialog = useDialog()
const message = useMessage()
const editorOpen = ref(false)
const editButtonRef = ref<ComponentPublicInstance | null>(null)
const photos = ref<API.RecordPhoto[]>([])
const photosError = ref('')
let leavePromptOpen = false
let photosRequestId = 0
let loadedPhotoRecordId: number | null = null
let disposed = false

const currentAccountId = () => Auth.user.value?.account_id ?? ''

const canEdit = computed(() => {
  return props.record?.status === 'in_progress' || props.record?.status === 'completed'
})

const hasNote = computed(() => (props.record?.worker_desc ?? '').trim().length > 0)
const visible = computed(
  () => !!props.record && (canEdit.value || hasNote.value || (props.record.photo_count ?? 0) > 0)
)

const photoItems = computed<PhotoGalleryItem[]>(() => {
  const record = props.record
  if (!record) return []
  return photos.value.map((photo) => ({
    key: `photo:${photo.id}`,
    kind: 'photo',
    photoId: photo.id,
    src: records.photoSrc(record.id, photo),
    alt: `处理照片 ${photo.position}`
  }))
})

const loadPhotos = async () => {
  const record = props.record
  if (!record || (record.photo_count ?? 0) <= 0) {
    photos.value = []
    photosError.value = ''
    loadedPhotoRecordId = record?.id ?? null
    return
  }
  if (loadedPhotoRecordId !== record.id) {
    photos.value = []
    loadedPhotoRecordId = record.id
  }
  const requestId = ++photosRequestId
  photosError.value = ''
  try {
    const list = await records.listRecordPhotos(record.id)
    if (requestId === photosRequestId && props.record?.id === record.id) {
      photos.value = list.items
      loadedPhotoRecordId = record.id
    }
  } catch (error) {
    if (requestId === photosRequestId && props.record?.id === record.id) {
      photosError.value = apiErrorText(error, '照片加载失败。')
      if (responseStatus(error) === 404) photos.value = []
    }
  }
}

watch(
  () => [
    props.record?.id,
    props.record?.photo_count,
    records.state.revision,
    records.state.photoVersions[props.record?.id ?? 0]
  ],
  () => {
    void loadPhotos()
  },
  { immediate: true }
)

const restoreEditFocus = () => {
  nextTick(() => {
    const element = editButtonRef.value?.$el as HTMLElement | undefined
    if (element?.isConnected) element.focus()
  })
}

const handleEditorClosed = async () => {
  if (disposed) return
  restoreEditFocus()
  await Sync.flushNow()
  if (disposed) return

  const record = props.record
  if (!record) return
  try {
    await records.reloadRecord(record.id)
  } catch (error) {
    photosError.value = apiErrorText(error, '记录加载失败。')
    if (responseStatus(error) === 404) photos.value = []
    message.error(photosError.value)
    return
  }
  await loadPhotos()
}

onUnmounted(() => {
  disposed = true
  photosRequestId += 1
})

onBeforeRouteLeave(async () => {
  const accountId = currentAccountId()
  if (!hasUnsavedRecordNoteDrafts(accountId)) return true
  if (leavePromptOpen) return false

  leavePromptOpen = true
  return await new Promise<boolean>((resolve) => {
    const finish = (leave: boolean) => {
      leavePromptOpen = false
      if (leave) clearRecordNoteDrafts(accountId)
      resolve(leave)
    }

    dialog.warning({
      title: '未保存的处理记录',
      content: '离开后尚未保存的处理记录会丢失。确定离开吗？',
      positiveText: '离开',
      negativeText: '留下',
      onPositiveClick: () => finish(true),
      onNegativeClick: () => finish(false),
      onClose: () => finish(false),
      onEsc: () => finish(false),
      onMaskClick: () => finish(false)
    })
  })
})
</script>

<style scoped>
.record-note-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 20px;
}

.photo-load-error {
  font-size: 12px;
}

.note-preview {
  max-height: 9.5em;
  overflow: hidden;
  line-height: 1.6;
  color: var(--n-text-color-2, #666);
  mask-image: linear-gradient(to bottom, black 75%, transparent 100%);
}
</style>
