<template>
  <div class="record-note-toolbar" role="toolbar" aria-label="处理记录格式">
    <n-button-group>
      <n-dropdown
        trigger="click"
        :disabled="loading"
        :options="headingOptions"
        @select="applyHeading"
      >
        <n-button quaternary size="small" title="标题" aria-label="标题">
          <template #icon>
            <n-icon><TitleOutlined /></n-icon>
          </template>
        </n-button>
      </n-dropdown>
      <n-button
        quaternary
        size="small"
        title="加粗"
        aria-label="加粗"
        :disabled="loading"
        @click="run(toggleStrongCommand)"
      >
        <template #icon>
          <n-icon><FormatBoldOutlined /></n-icon>
        </template>
      </n-button>
      <n-button
        quaternary
        size="small"
        title="无序列表"
        aria-label="无序列表"
        :disabled="loading"
        @click="run(wrapInBulletListCommand)"
      >
        <template #icon>
          <n-icon><FormatListBulletedOutlined /></n-icon>
        </template>
      </n-button>
      <n-button
        quaternary
        size="small"
        title="有序列表"
        aria-label="有序列表"
        :disabled="loading"
        @click="run(wrapInOrderedListCommand)"
      >
        <template #icon>
          <n-icon><FormatListNumberedOutlined /></n-icon>
        </template>
      </n-button>
    </n-button-group>

    <n-divider vertical />

    <n-button-group>
      <n-button
        quaternary
        size="small"
        title="撤销"
        aria-label="撤销"
        :disabled="loading"
        @click="run(undoCommand)"
      >
        <template #icon>
          <n-icon><UndoOutlined /></n-icon>
        </template>
      </n-button>
      <n-button
        quaternary
        size="small"
        title="重做"
        aria-label="重做"
        :disabled="loading"
        @click="run(redoCommand)"
      >
        <template #icon>
          <n-icon><RedoOutlined /></n-icon>
        </template>
      </n-button>
    </n-button-group>

    <n-divider vertical />

    <n-dropdown
      trigger="click"
      :disabled="loading"
      :options="sectionOptions"
      @select="insertSection"
    >
      <n-button quaternary size="small" :disabled="loading">插入小节</n-button>
    </n-dropdown>
  </div>
</template>

<script setup lang="ts">
import { commandsCtx, editorViewCtx, serializerCtx } from '@milkdown/kit/core'
import { undoCommand, redoCommand } from '@milkdown/kit/plugin/history'
import {
  toggleStrongCommand,
  turnIntoTextCommand,
  wrapInBulletListCommand,
  wrapInHeadingCommand,
  wrapInOrderedListCommand
} from '@milkdown/kit/preset/commonmark'
import { Fragment } from '@milkdown/kit/prose/model'
import { TextSelection } from '@milkdown/kit/prose/state'
import type { $Command } from '@milkdown/kit/utils'
import { useInstance } from '@milkdown/vue'
import FormatBoldOutlined from '@vicons/material/FormatBoldOutlined'
import FormatListBulletedOutlined from '@vicons/material/FormatListBulletedOutlined'
import FormatListNumberedOutlined from '@vicons/material/FormatListNumberedOutlined'
import RedoOutlined from '@vicons/material/RedoOutlined'
import TitleOutlined from '@vicons/material/TitleOutlined'
import UndoOutlined from '@vicons/material/UndoOutlined'

const [loading, getEditor] = useInstance()

const headingOptions = [
  { label: '正文', key: '0' },
  { label: '标题 1', key: '1' },
  { label: '标题 2', key: '2' },
  { label: '标题 3', key: '3' }
]

const sectionOptions = ['问题与排查', '处理过程', '验证结果'].map((title) => ({
  label: title,
  key: title
}))

const run = <T,>(command: $Command<T>, payload?: T) => {
  const editor = getEditor()
  if (!editor) return
  editor.action((ctx) => {
    ctx.get(commandsCtx).call(command.key, payload)
    ctx.get(editorViewCtx).focus()
  })
}

const applyHeading = (key: string) => {
  const level = Number(key)
  if (level === 0) {
    run(turnIntoTextCommand)
    return
  }
  run(wrapInHeadingCommand, level)
}

const getMarkdown = (): string | undefined => {
  const editor = getEditor()
  if (!editor) return undefined
  try {
    return editor.action((ctx) => ctx.get(serializerCtx)(ctx.get(editorViewCtx).state.doc))
  } catch {
    return undefined
  }
}

defineExpose({ getMarkdown })

const insertSection = (title: string) => {
  const editor = getEditor()
  if (!editor) return

  editor.action((ctx) => {
    const view = ctx.get(editorViewCtx)
    const { state } = view
    const headingType = state.schema.nodes.heading
    const paragraphType = state.schema.nodes.paragraph
    if (!headingType || !paragraphType) return

    const { $from } = state.selection
    const insertPos = $from.depth > 0 ? $from.after(1) : state.doc.content.size
    const heading = headingType.create({ level: 2 }, state.schema.text(title))
    const paragraph = paragraphType.create()
    const transaction = state.tr.insert(insertPos, Fragment.fromArray([heading, paragraph]))
    const cursor = insertPos + heading.nodeSize + 1
    transaction.setSelection(TextSelection.near(transaction.doc.resolve(cursor)))
    view.dispatch(transaction.scrollIntoView())
    view.focus()
  })
}
</script>

<style scoped>
.record-note-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--n-border-color, #eee);
  margin-bottom: 10px;
}

.record-note-toolbar :deep(.n-divider) {
  margin: 0 2px;
}
</style>
