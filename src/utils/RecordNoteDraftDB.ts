// Durable drafts for record worker notes. IndexedDB is used (rather than
// localStorage) so Stage 3 can add photo files without changing the storage
// layer. A per-record key includes the signed-in account identity.

export const RECORD_NOTE_DRAFT_VERSION = 2

const DB_NAME = 'clinic-record-note-drafts'
const DB_VERSION = 1
const STORE_NAME = 'drafts'

export interface PersistedPendingPhoto {
  clientId: string
  name: string
  type: string
  size: number
  lastModified: number
  data: Blob
  error?: string
  uncertain?: boolean
  baselinePhotoIds?: number[]
}

// Stage 4 stored replace/remove operations together. Replacement was removed;
// this shape is retained only so version 1 drafts can be migrated.
export interface PersistedLegacyPhotoEdit {
  clientId: string
  kind: 'replace' | 'remove'
  photoId: number
  originalPosition: number
  name?: string
  type?: string
  size?: number
  lastModified?: number
  data?: Blob
  error?: string
  uncertain?: boolean
}

export interface PersistedPhotoDeletion {
  photoId: number
  index: number
  error?: string
  uncertain?: boolean
}

export interface PersistedPhotoOrderEntry {
  kind: 'photo' | 'pending'
  photoId?: number
  clientId?: string
}

export interface RecordNoteDraftRecord {
  key: string
  accountId: string
  recordId: number
  text: string
  originalServerText: string
  updatedAt: number
  version: number
  pendingPhotos?: PersistedPendingPhoto[]
  pendingDeletions?: PersistedPhotoDeletion[]
  recoverablePhotos?: PersistedPendingPhoto[]
  photoOrder?: PersistedPhotoOrderEntry[]
  photoBaselineIds?: number[]
  /** Version 1 only. Migrated into pendingDeletions/recoverablePhotos. */
  pendingEdits?: PersistedLegacyPhotoEdit[]
}

const draftKey = (accountId: string, recordId: number) => `${accountId}:${recordId}`

let databasePromise: Promise<IDBDatabase> | null = null

const openDatabase = (): Promise<IDBDatabase> => {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is not available'))
  }
  if (databasePromise) return databasePromise

  databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'key' })
      }
    }
    request.onsuccess = () => {
      const database = request.result
      database.onversionchange = () => {
        database.close()
        databasePromise = null
      }
      resolve(database)
    }
    request.onerror = () => {
      databasePromise = null
      reject(request.error ?? new Error('failed to open draft database'))
    }
    request.onblocked = () => {
      databasePromise = null
      reject(new Error('draft database upgrade blocked by another tab'))
    }
  })
  return databasePromise
}

const transactionDone = (transaction: IDBTransaction): Promise<void> => {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('draft transaction failed'))
    transaction.onabort = () => reject(transaction.error ?? new Error('draft transaction aborted'))
  })
}

export const loadRecordNoteDraft = async (
  accountId: string,
  recordId: number
): Promise<RecordNoteDraftRecord | null> => {
  const database = await openDatabase()
  const transaction = database.transaction(STORE_NAME, 'readonly')
  const request = transaction.objectStore(STORE_NAME).get(draftKey(accountId, recordId))

  const value = await new Promise<RecordNoteDraftRecord | undefined>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result as RecordNoteDraftRecord | undefined)
    request.onerror = () => reject(request.error ?? new Error('failed to read draft'))
  })

  if (!value || (value.version !== 1 && value.version !== RECORD_NOTE_DRAFT_VERSION)) {
    return null
  }
  return value
}

export const saveRecordNoteDraft = async (
  draft: Omit<RecordNoteDraftRecord, 'key' | 'version'>
): Promise<void> => {
  const database = await openDatabase()
  const transaction = database.transaction(STORE_NAME, 'readwrite')
  transaction.objectStore(STORE_NAME).put({
    ...draft,
    key: draftKey(draft.accountId, draft.recordId),
    version: RECORD_NOTE_DRAFT_VERSION
  })
  await transactionDone(transaction)
}

export const deleteRecordNoteDraft = async (accountId: string, recordId: number): Promise<void> => {
  const database = await openDatabase()
  const transaction = database.transaction(STORE_NAME, 'readwrite')
  transaction.objectStore(STORE_NAME).delete(draftKey(accountId, recordId))
  await transactionDone(transaction)
}
