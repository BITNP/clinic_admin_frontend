<template>
  <div ref="root" class="record-note-markdown-view">
    <MilkdownProvider :key="markdown">
      <RecordNoteMarkdownSurface :initial-value="markdown" readonly @ready="sanitize" />
    </MilkdownProvider>
  </div>
</template>

<script setup lang="ts">
import RecordNoteMarkdownSurface from '@/components/RecordNoteMarkdownSurface.vue'
import { sanitizeMarkdownElement } from '@/utils/markdownSafety'
import { MilkdownProvider } from '@milkdown/vue'
import { nextTick, ref } from 'vue'

defineProps<{
  markdown: string
}>()

const root = ref<HTMLElement | null>(null)

const sanitize = async () => {
  await nextTick()
  let attempts = 0
  const run = () => {
    const content = root.value?.querySelector('.milkdown .editor')
    if (content) {
      sanitizeMarkdownElement(content)
      return
    }
    attempts += 1
    if (attempts < 20) setTimeout(run, 50)
  }
  run()
}
</script>

<style scoped>
.record-note-markdown-view :deep(.milkdown) {
  padding: 0;
}

.record-note-markdown-view :deep(.milkdown > .editor) {
  outline: none;
  white-space: pre-wrap;
}

.record-note-markdown-view :deep(.milkdown .editor p) {
  margin: 0.25rem 0;
  line-height: 1.65;
}

.record-note-markdown-view :deep(.milkdown .editor strong),
.record-note-markdown-view :deep(.milkdown .editor b) {
  font-weight: 700 !important;
}

.record-note-markdown-view :deep(.milkdown .editor h1),
.record-note-markdown-view :deep(.milkdown .editor h2),
.record-note-markdown-view :deep(.milkdown .editor h3) {
  font-weight: 700;
  line-height: 1.35;
}

.record-note-markdown-view :deep(.milkdown .editor blockquote) {
  margin: 0.4rem 0;
  padding: 0.1rem 0.7rem;
  border-left: 3px solid var(--n-border-color, #ddd);
  color: var(--n-text-color-2, #666);
}

.record-note-markdown-view :deep(.milkdown .editor ul),
.record-note-markdown-view :deep(.milkdown .editor ol) {
  padding-left: 1.4rem;
}
</style>
