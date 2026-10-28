<template>
  <div v-if="items.length || deletedItems.length" class="record-photo-groups">
    <n-image-group v-if="items.length" show-toolbar-tooltip>
      <div class="record-photo-gallery">
        <div
          v-for="item in items"
          :key="item.key"
          :data-photo-key="item.key"
          class="record-photo-item"
          :class="{
            dragging: draggingKey === item.key,
            'drop-before': dragOverKey === item.key && dropPosition === 'before',
            'drop-after': dragOverKey === item.key && dropPosition === 'after'
          }"
          @dragover="handleDragOver($event, item)"
          @drop="handleDrop($event, item)"
        >
          <div class="record-photo-preview" @dragstart.prevent>
            <n-image
              :src="item.src"
              :alt="item.alt"
              :width="96"
              :height="96"
              object-fit="cover"
              class="record-photo-thumb"
            />
          </div>

          <div v-if="editable" class="record-photo-actions">
            <button
              v-if="sortable"
              type="button"
              class="photo-drag-handle"
              :draggable="!disabled"
              :disabled="disabled"
              aria-label="拖动排序，聚焦后可用左右方向键移动"
              title="拖动排序；聚焦后可用左右方向键移动"
              @dragstart="handleDragStart($event, item.key)"
              @dragend="clearDrag"
              @keydown.left.prevent="emit('move-step', item.key, -1)"
              @keydown.right.prevent="emit('move-step', item.key, 1)"
            >
              ⋮⋮
            </button>

            <n-button
              v-if="item.kind === 'photo'"
              text
              size="tiny"
              type="error"
              :disabled="disabled"
              @click="emit('delete', item.key)"
            >
              删除
            </n-button>
            <n-button
              v-else
              text
              size="tiny"
              type="error"
              :disabled="disabled || item.status === 'uploading' || item.status === 'uploaded'"
              @click="emit('remove-pending', item.key)"
            >
              移除
            </n-button>
          </div>

          <div v-if="item.status || item.statusLabel" class="photo-state">
            <n-tag
              v-if="item.statusLabel"
              size="tiny"
              :type="statusType(item.status)"
              :bordered="false"
            >
              {{ item.statusLabel }}
            </n-tag>
          </div>

          <n-text v-if="item.error" type="error" class="photo-tile-error">
            {{ item.error }}
          </n-text>
        </div>
      </div>
    </n-image-group>

    <section v-if="deletedItems.length" class="deleted-photo-section">
      <n-text depth="3" class="deleted-photo-heading">待删除</n-text>
      <n-image-group show-toolbar-tooltip>
        <div class="record-photo-gallery">
          <div
            v-for="item in deletedItems"
            :key="item.key"
            :data-photo-key="item.key"
            class="record-photo-item is-deleted"
          >
            <div class="record-photo-preview">
              <n-image
                :src="item.src"
                :alt="item.alt"
                :width="96"
                :height="96"
                object-fit="cover"
                class="record-photo-thumb"
              />
            </div>
            <div v-if="editable" class="record-photo-actions">
              <n-tag size="tiny" type="error" :bordered="false">待删除</n-tag>
              <n-button
                text
                size="tiny"
                :disabled="disabled"
                @click="emit('undo-delete', item.key)"
              >
                撤销
              </n-button>
            </div>
            <n-text v-if="item.error" type="error" class="photo-tile-error">
              {{ item.error }}
            </n-text>
          </div>
        </div>
      </n-image-group>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { PhotoGalleryItem, PhotoMoveRequest } from '@/utils/RecordPhotoEdits'
import { ref } from 'vue'

const props = withDefaults(
  defineProps<{
    items: PhotoGalleryItem[]
    deletedItems?: PhotoGalleryItem[]
    editable?: boolean
    sortable?: boolean
    disabled?: boolean
  }>(),
  {
    deletedItems: () => [],
    editable: false,
    sortable: false,
    disabled: false
  }
)

const emit = defineEmits<{
  (e: 'delete', key: string): void
  (e: 'undo-delete', key: string): void
  (e: 'remove-pending', key: string): void
  (e: 'move', request: PhotoMoveRequest): void
  (e: 'move-step', key: string, delta: number): void
}>()

const draggingKey = ref<string | null>(null)
const dragOverKey = ref<string | null>(null)
const dropPosition = ref<'before' | 'after'>('before')

const clearDrag = () => {
  draggingKey.value = null
  dragOverKey.value = null
}

const handleDragStart = (event: DragEvent, key: string) => {
  if (!props.sortable || props.disabled) {
    event.preventDefault()
    return
  }
  draggingKey.value = key
  dragOverKey.value = null
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('application/x-record-photo-key', key)
    event.dataTransfer.setData('text/plain', key)
    const handle = event.currentTarget as HTMLElement | null
    const tile = handle?.closest('.record-photo-item') as HTMLElement | null
    if (tile) event.dataTransfer.setDragImage(tile, 48, 48)
  }
}

const handleDragOver = (event: DragEvent, item: PhotoGalleryItem) => {
  if (!draggingKey.value || props.disabled) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  if (draggingKey.value === item.key) {
    dragOverKey.value = null
    return
  }
  const tile = event.currentTarget as HTMLElement
  const rect = tile.getBoundingClientRect()
  dragOverKey.value = item.key
  dropPosition.value = event.clientX < rect.left + rect.width / 2 ? 'before' : 'after'
}

const handleDrop = (event: DragEvent, item: PhotoGalleryItem) => {
  if (!draggingKey.value || props.disabled) return
  event.preventDefault()
  if (draggingKey.value !== item.key) {
    emit('move', {
      fromKey: draggingKey.value,
      toKey: item.key,
      position: dropPosition.value
    })
  }
  clearDrag()
}

const statusType = (status?: PhotoGalleryItem['status']) => {
  if (status === 'failed') return 'error'
  if (status === 'uploading' || status === 'deleting') return 'info'
  if (status === 'uploaded') return 'success'
  return 'default'
}
</script>

<style scoped>
.record-photo-groups {
  margin-top: 10px;
}

.record-photo-gallery {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.record-photo-item {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 118px;
}

.record-photo-item.dragging {
  opacity: 0.45;
}

.record-photo-item.drop-before::before,
.record-photo-item.drop-after::after {
  content: '';
  position: absolute;
  top: -4px;
  bottom: -4px;
  width: 3px;
  border-radius: 2px;
  background: var(--n-color-target, #18a058);
  pointer-events: none;
}

.record-photo-item.drop-before::before {
  left: -8px;
}

.record-photo-item.drop-after::after {
  right: -8px;
}

.record-photo-preview {
  width: 96px;
  height: 96px;
}

.record-photo-thumb {
  overflow: hidden;
  border-radius: 6px;
  border: 1px solid var(--n-border-color, #eee);
}

.record-photo-item.is-deleted .record-photo-thumb {
  opacity: 0.45;
}

.record-photo-actions,
.photo-state {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  min-height: 20px;
}

.photo-drag-handle {
  padding: 0 2px;
  border: none;
  background: transparent;
  color: var(--n-text-color-3, #999);
  font-size: 14px;
  line-height: 1;
  cursor: grab;
}

.photo-drag-handle:active {
  cursor: grabbing;
}

.photo-drag-handle:disabled {
  cursor: default;
  opacity: 0.4;
}

.photo-tile-error {
  font-size: 12px;
  line-height: 1.4;
}

.deleted-photo-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 10px;
  margin-top: 12px;
  border-top: 1px dashed var(--n-border-color, #eee);
}

.deleted-photo-heading {
  font-size: 12px;
}
</style>
