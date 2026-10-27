<template>
  <Milkdown class="announcement-milkdown" style="padding: 0 0 5rem 0; outline: unset !important" />
</template>

<script setup lang="ts">
import { defaultValueCtx, Editor, rootCtx } from '@milkdown/kit/core'
import { gfm } from '@milkdown/kit/preset/gfm'
import { Milkdown, useEditor } from '@milkdown/vue'
import { history } from '@milkdown/kit/plugin/history'
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener'
import { commonmark } from '@milkdown/kit/preset/commonmark'

const props = defineProps({
  ctx: {
    type: String,
    required: true
  }
})

const emits = defineEmits<{
  update: [value: string]
}>()

const txt = defineModel<string>('value')

useEditor((root) =>
  Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, root)
      ctx.set(defaultValueCtx, props.ctx ?? '')
    })
    .config((ctx) => {
      const listener = ctx.get(listenerCtx)

      listener.markdownUpdated((ctx, markdown, prevMarkdown) => {
        if (markdown !== prevMarkdown) {
          txt.value = markdown
          emits('update', markdown)
        }
      })
    })
    .use(listener)
    .use(commonmark)
    .use(gfm)
    .use(history)
)
</script>

<style>
.announcement-milkdown .milkdown > .editor {
  outline: none;
}
.announcement-milkdown .milkdown > .editor p {
  margin: 0.2rem;
}
.announcement-milkdown .milkdown > .editor blockquote {
  margin: 0.2rem;
  padding: 0.2rem;
  border-left: 4px solid #ddd;
  background-color: #f9f9f9;
}
.announcement-milkdown .milkdown > .editor strong {
  font-weight: bold !important;
}
</style>
