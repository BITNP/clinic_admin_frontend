// In-memory fallback for drafts that could not be written to IndexedDB. An
// entry here means the latest text is not durably stored, so refresh/tab close
// and SPA navigation must warn before discarding it.

import type { PersistedPendingPhoto } from '@/utils/RecordNoteDraftDB'

export interface SessionRecordNoteDraft {
  accountId: string
  recordId: number
  text: string
  originalServerText: string
  updatedAt: number
  pendingPhotos?: PersistedPendingPhoto[]
}

const drafts = new Map<string, SessionRecordNoteDraft>()

const draftKey = (accountId: string, recordId: number) => `${accountId}:${recordId}`

export const getSessionRecordNoteDraft = (
  accountId: string,
  recordId: number
): SessionRecordNoteDraft | undefined => {
  return drafts.get(draftKey(accountId, recordId))
}

export const setSessionRecordNoteDraft = (draft: SessionRecordNoteDraft) => {
  drafts.set(draftKey(draft.accountId, draft.recordId), draft)
}

export const deleteSessionRecordNoteDraft = (accountId: string, recordId: number) => {
  drafts.delete(draftKey(accountId, recordId))
}

export const hasUnsavedRecordNoteDrafts = (): boolean => drafts.size > 0

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
