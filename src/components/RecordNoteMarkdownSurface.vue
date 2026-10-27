<template>
  <Milkdown class="record-note-markdown-surface" />
</template>

<script setup lang="ts">
import { isSafeMarkdownLink, sanitizePastedHTML } from '@/utils/markdownSafety'
import {
  defaultValueCtx,
  editorViewCtx,
  editorViewOptionsCtx,
  Editor,
  rootCtx,
  serializerCtx
} from '@milkdown/kit/core'
import { history } from '@milkdown/kit/plugin/history'
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener'
import { commonmark } from '@milkdown/kit/preset/commonmark'
import { gfm } from '@milkdown/kit/preset/gfm'
import { Plugin, PluginKey, type Transaction } from '@milkdown/kit/prose/state'
import { $prose } from '@milkdown/kit/utils'
import { Milkdown, useEditor } from '@milkdown/vue'
import { watch } from 'vue'

const props = defineProps<{
  initialValue: string
  readonly?: boolean
}>()

const emit = defineEmits<{
  update: [value: string]
  ready: [markdown: string | undefined]
}>()

const safeLinkPlugin = $prose(
  () =>
    new Plugin({
      key: new PluginKey('record-note-safe-links'),
      appendTransaction: (transactions, _oldState, newState) => {
        if (!transactions.some((transaction) => transaction.docChanged)) return null

        let transaction: Transaction | null = null
        newState.doc.descendants((node, pos) => {
          if (!node.isText) return
          const link = node.marks.find((mark) => mark.type.name === 'link')
          if (!link) return
          if (isSafeMarkdownLink(String(link.attrs.href ?? ''))) return

          transaction = transaction ?? newState.tr
          transaction.removeMark(pos, pos + node.nodeSize, link.type)
        })
        return transaction
      }
    })
)

const openLink = (href: string) => {
  if (!isSafeMarkdownLink(href)) return
  if (href.startsWith('mailto:')) {
    window.location.href = href
    return
  }
  window.open(href, '_blank', 'noopener,noreferrer')
}

const { loading, get } = useEditor((root) => {
  const editor = Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, root)
      ctx.set(defaultValueCtx, props.initialValue)
      ctx.set(
        editorViewOptionsCtx,
        props.readonly
          ? {
              editable: () => false,
              attributes: {
                class: 'record-note-markdown-content',
                'aria-label': '处理记录'
              }
            }
          : {
              editable: () => true,
              attributes: {
                class: 'record-note-markdown-content',
                'aria-label': '处理记录编辑器'
              },
              transformPastedHTML: sanitizePastedHTML,
              handleClick: (_view, _pos, event) => {
                const target = event.target
                if (!(target instanceof HTMLElement)) return false
                const anchor = target.closest('a')
                if (!anchor) return false

                event.preventDefault()
                openLink(anchor.getAttribute('href') ?? '')
                return true
              }
            }
      )
    })
    .use(commonmark)
    .use(gfm)
    .use(safeLinkPlugin)

  if (props.readonly) return editor
  return editor
    .config((ctx) => {
      const manager = ctx.get(listenerCtx)
      manager.markdownUpdated((_ctx, markdown, previousMarkdown) => {
        if (markdown !== previousMarkdown) emit('update', markdown)
      })
    })
    .use(history)
    .use(listener)
})

watch(
  loading,
  (value) => {
    if (value) return
    const markdown = get()?.action((ctx) =>
      ctx.get(serializerCtx)(ctx.get(editorViewCtx).state.doc)
    )
    emit('ready', markdown)
  },
  { flush: 'post' }
)
</script>
