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

      <RecordPhotoGallery v-if="photos.length" :photos="photos" />
    </section>

    <RecordNoteEditorDialog
      v-model:show="editorOpen"
      :record="record"
      @after-leave="restoreEditFocus"
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
import { useDialog } from 'naive-ui'
import { computed, nextTick, ref, watch, type ComponentPublicInstance } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'

const props = defineProps<{
  record: API.Record | null
}>()

const dialog = useDialog()
const editorOpen = ref(false)
const editButtonRef = ref<ComponentPublicInstance | null>(null)
const photos = ref<API.RecordPhoto[]>([])
let leavePromptOpen = false
let photosRequestId = 0

const canEdit = computed(() => {
  return props.record?.status === 'in_progress' || props.record?.status === 'completed'
})

const hasNote = computed(() => (props.record?.worker_desc ?? '').trim().length > 0)
const visible = computed(
  () => !!props.record && (canEdit.value || hasNote.value || (props.record.photo_count ?? 0) > 0)
)

const loadPhotos = async () => {
  const record = props.record
  if (!record || (record.photo_count ?? 0) <= 0) {
    photos.value = []
    return
  }
  const requestId = ++photosRequestId
  photos.value = []
  try {
    const list = await records.listRecordPhotos(record.id)
    if (requestId === photosRequestId && props.record?.id === record.id) {
      photos.value = list.items
    }
  } catch {
    if (requestId === photosRequestId && props.record?.id === record.id) {
      photos.value = []
    }
  }
}

watch(
  () => [props.record?.id, props.record?.photo_count],
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

onBeforeRouteLeave(async () => {
  if (!hasUnsavedRecordNoteDrafts()) return true
  if (leavePromptOpen) return false

  leavePromptOpen = true
  return await new Promise<boolean>((resolve) => {
    const finish = (leave: boolean) => {
      leavePromptOpen = false
      if (leave) clearRecordNoteDrafts()
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

.note-preview {
  max-height: 9.5em;
  overflow: hidden;
  line-height: 1.6;
  color: var(--n-text-color-2, #666);
  mask-image: linear-gradient(to bottom, black 75%, transparent 100%);
}
</style>
