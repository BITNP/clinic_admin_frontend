// In-memory fallback for drafts that could not be written to IndexedDB. An
// entry here means the latest text is not durably stored, so refresh/tab close
// and SPA navigation must warn before discarding it.

import type {
  PersistedPendingPhoto,
  PersistedPhotoDeletion,
  PersistedPhotoOrderEntry
} from '@/utils/RecordNoteDraftDB'

export interface SessionRecordNoteDraft {
  accountId: string
  recordId: number
  text: string
  originalServerText: string
  updatedAt: number
  pendingPhotos?: PersistedPendingPhoto[]
  pendingDeletions?: PersistedPhotoDeletion[]
  recoverablePhotos?: PersistedPendingPhoto[]
  photoOrder?: PersistedPhotoOrderEntry[]
  photoBaselineIds?: number[]
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

const hasKeyForAccount = (key: string, accountId: string) => {
  return key.startsWith(`${accountId}:`)
}

export const hasUnsavedRecordNoteDrafts = (accountId?: string): boolean => {
  if (accountId === undefined) return drafts.size > 0
  for (const key of drafts.keys()) {
    if (hasKeyForAccount(key, accountId)) return true
  }
  return false
}

export const clearRecordNoteDrafts = (accountId?: string) => {
  if (accountId === undefined) {
    drafts.clear()
    return
  }
  for (const key of [...drafts.keys()]) {
    if (hasKeyForAccount(key, accountId)) drafts.delete(key)
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', (event) => {
    if (!hasUnsavedRecordNoteDrafts()) return
    event.preventDefault()
    // Older browsers still require returnValue to be set.
    event.returnValue = ''
  })
}
