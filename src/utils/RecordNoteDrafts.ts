// In-memory drafts for worker notes. Drafts are intentionally scoped to the
// browser session: closing the editor or moving between records keeps them, but
// a refresh or tab close discards them (with a beforeunload warning).

export interface RecordNoteDraft {
  text: string
  savedText: string
}

const drafts = new Map<number, RecordNoteDraft>()

export const getRecordNoteDraft = (recordId: number): RecordNoteDraft | undefined => {
  return drafts.get(recordId)
}

export const setRecordNoteDraft = (recordId: number, text: string, savedText: string) => {
  if (text === savedText) {
    drafts.delete(recordId)
    return
  }
  drafts.set(recordId, { text, savedText })
}

export const discardRecordNoteDraft = (recordId: number) => {
  drafts.delete(recordId)
}

export const hasUnsavedRecordNoteDrafts = (): boolean => {
  for (const draft of drafts.values()) {
    if (draft.text !== draft.savedText) return true
  }
  return false
}

export const clearRecordNoteDrafts = () => {
  drafts.clear()
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', (event) => {
    if (!hasUnsavedRecordNoteDrafts()) return
    event.preventDefault()
    // Older browsers still require returnValue to be set.
    event.returnValue = ''
  })
}
