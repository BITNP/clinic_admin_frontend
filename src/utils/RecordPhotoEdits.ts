import type API from '@/store/api'

export type PhotoOrderIdentity =
  | { kind: 'photo'; photoId: number }
  | { kind: 'pending'; clientId: string }

export type PendingDeletionStatus = 'pending' | 'deleting' | 'failed'

// A staged deletion of an existing server photo. The stable photo id is the
// identity; the index records where to put the photo back if the user undoes
// the deletion before saving.
export interface PendingPhotoDeletion {
  photoId: number
  index: number
  status: PendingDeletionStatus
  error?: string
  uncertain: boolean
}

export type PhotoGalleryItemStatus = 'pending' | 'uploading' | 'uploaded' | 'failed' | 'deleting'

export interface PhotoGalleryItem {
  key: string
  kind: 'photo' | 'pending'
  photoId?: number
  clientId?: string
  src: string
  alt: string
  status?: PhotoGalleryItemStatus
  statusLabel?: string
  error?: string
}

export interface PhotoMoveRequest {
  fromKey: string
  toKey: string
  position: 'before' | 'after'
}

export const photoIdentityKey = (identity: PhotoOrderIdentity): string => {
  return identity.kind === 'photo' ? `photo:${identity.photoId}` : `pending:${identity.clientId}`
}

export const isSameKeySequence = (left: string[], right: string[]): boolean => {
  return left.length === right.length && left.every((key, index) => key === right[index])
}

export const isSamePhotoSequence = (left: number[], right: number[]): boolean => {
  return left.length === right.length && left.every((id, index) => id === right[index])
}

// Compare the server photo list against the list that was current when the
// draft was created. Deletions are ignored because whether their target still
// exists is exactly what the deletion is about to change.
export const isPhotoSequenceUnchanged = (
  expected: number[],
  actual: number[],
  ignoredIds: ReadonlySet<number>
): boolean => {
  return isSamePhotoSequence(
    expected.filter((id) => !ignoredIds.has(id)),
    actual.filter((id) => !ignoredIds.has(id))
  )
}

// Keep valid draft identities in their saved order, drop identities whose
// photo/pending file no longer exists, and append anything new at the end.
export const reconcilePhotoOrder = (
  order: PhotoOrderIdentity[] | undefined,
  photos: API.RecordPhoto[],
  pendingPhotos: { clientId: string }[],
  deletedPhotoIds: ReadonlySet<number>
): PhotoOrderIdentity[] => {
  const valid = new Map<string, PhotoOrderIdentity>()
  for (const photo of photos) {
    if (deletedPhotoIds.has(photo.id)) continue
    const identity: PhotoOrderIdentity = { kind: 'photo', photoId: photo.id }
    valid.set(photoIdentityKey(identity), identity)
  }
  for (const pending of pendingPhotos) {
    const identity: PhotoOrderIdentity = { kind: 'pending', clientId: pending.clientId }
    valid.set(photoIdentityKey(identity), identity)
  }

  const result: PhotoOrderIdentity[] = []
  const seen = new Set<string>()
  for (const identity of order ?? []) {
    const key = photoIdentityKey(identity)
    const normalized = valid.get(key)
    if (!normalized || seen.has(key)) continue
    result.push(normalized)
    seen.add(key)
  }
  for (const photo of photos) {
    if (deletedPhotoIds.has(photo.id)) continue
    const key = `photo:${photo.id}`
    if (seen.has(key)) continue
    result.push({ kind: 'photo', photoId: photo.id })
    seen.add(key)
  }
  for (const pending of pendingPhotos) {
    const key = `pending:${pending.clientId}`
    if (seen.has(key)) continue
    result.push({ kind: 'pending', clientId: pending.clientId })
    seen.add(key)
  }
  return result
}

export const movePhotoIdentity = (
  order: PhotoOrderIdentity[],
  fromKey: string,
  toKey: string,
  position: 'before' | 'after'
): PhotoOrderIdentity[] => {
  if (fromKey === toKey) return order.slice()
  const fromIndex = order.findIndex((identity) => photoIdentityKey(identity) === fromKey)
  if (fromIndex < 0) return order.slice()

  const next = order.slice()
  const [moved] = next.splice(fromIndex, 1)
  let targetIndex = next.findIndex((identity) => photoIdentityKey(identity) === toKey)
  if (targetIndex < 0) return order.slice()
  if (position === 'after') targetIndex += 1
  next.splice(targetIndex, 0, moved)
  return next
}

export const movePhotoByStep = (
  order: PhotoOrderIdentity[],
  key: string,
  delta: number
): PhotoOrderIdentity[] => {
  const index = order.findIndex((identity) => photoIdentityKey(identity) === key)
  if (index < 0) return order.slice()
  const target = index + delta
  if (target < 0 || target >= order.length) return order.slice()
  const next = order.slice()
  const [moved] = next.splice(index, 1)
  next.splice(target, 0, moved)
  return next
}

// Deleting from the highest position first keeps every earlier position stable,
// so multiple removals cannot make a later request target the wrong photo.
export const orderDeletions = (
  deletions: PendingPhotoDeletion[],
  photos: API.RecordPhoto[]
): PendingPhotoDeletion[] => {
  const byId = new Map(photos.map((photo) => [photo.id, photo]))
  return deletions
    .filter((deletion) => byId.has(deletion.photoId))
    .sort((left, right) => {
      return byId.get(right.photoId)!.position - byId.get(left.photoId)!.position
    })
}
