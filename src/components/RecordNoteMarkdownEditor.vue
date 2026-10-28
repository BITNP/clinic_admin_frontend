<template>
  <MilkdownProvider>
    <div class="record-note-markdown-editor">
      <RecordNoteMarkdownToolbar ref="toolbar" />
      <RecordNoteMarkdownSurface :initial-value="initialValue" @update="emit('update', $event)" />
    </div>
  </MilkdownProvider>
</template>

<script setup lang="ts">
import RecordNoteMarkdownSurface from '@/components/RecordNoteMarkdownSurface.vue'
import RecordNoteMarkdownToolbar from '@/components/RecordNoteMarkdownToolbar.vue'
import { MilkdownProvider } from '@milkdown/vue'
import { ref } from 'vue'

defineProps<{
  initialValue: string
}>()

const emit = defineEmits<{
  update: [value: string]
  ready: [markdown: string | undefined]
}>()

const toolbar = ref<InstanceType<typeof RecordNoteMarkdownToolbar> | null>(null)

const getMarkdown = (): string | undefined => toolbar.value?.getMarkdown()

defineExpose({ getMarkdown })
</script>

<style scoped>
.record-note-markdown-editor {
  min-height: 320px;
}

.record-note-markdown-editor :deep(.milkdown) {
  padding: 0;
}

.record-note-markdown-editor :deep(.milkdown > .editor) {
  min-height: 280px;
  outline: none;
  white-space: pre-wrap;
}

.record-note-markdown-editor :deep(.milkdown .editor p) {
  margin: 0.35rem 0;
  line-height: 1.7;
}

.record-note-markdown-editor :deep(.milkdown .editor strong),
.record-note-markdown-editor :deep(.milkdown .editor b) {
  font-weight: 700 !important;
}

.record-note-markdown-editor :deep(.milkdown .editor h1),
.record-note-markdown-editor :deep(.milkdown .editor h2),
.record-note-markdown-editor :deep(.milkdown .editor h3) {
  line-height: 1.35;
  font-weight: 700;
}

.record-note-markdown-editor :deep(.milkdown .editor blockquote) {
  margin: 0.5rem 0;
  padding: 0.2rem 0.8rem;
  border-left: 3px solid var(--n-border-color, #ddd);
  color: var(--n-text-color-2, #666);
}

.record-note-markdown-editor :deep(.milkdown .editor ul),
.record-note-markdown-editor :deep(.milkdown .editor ol) {
  padding-left: 1.5rem;
}

.record-note-markdown-editor :deep(.milkdown .editor a) {
  color: var(--n-color-target, #18a058);
}

@media (max-height: 720px) {
  .record-note-markdown-editor {
    min-height: 220px;
  }

  .record-note-markdown-editor :deep(.milkdown > .editor) {
    min-height: 180px;
  }
}
</style>
