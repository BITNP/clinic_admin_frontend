/* eslint-env node */
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { test } = require('node:test')
const vm = require('node:vm')
const ts = require('typescript')

const source = ts.transpileModule(
  readFileSync(`${__dirname}/../src/utils/RecordPhotoEdits.ts`, 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
).outputText

const load = () => {
  const exports = {}
  vm.runInNewContext(source, { exports, URLSearchParams })
  return exports
}

const photo = (id, position = id) => ({ id, position })
const deletion = (photoId, index = 0) => ({
  photoId,
  index,
  status: 'pending',
  uncertain: false
})
const photoKey = (photoId) => ({ kind: 'photo', photoId })
const pendingKey = (clientId) => ({ kind: 'pending', clientId })

test('deletions are ordered by the latest position, descending', () => {
  const { orderDeletions } = load()
  const ordered = orderDeletions(
    [deletion(1), deletion(2), deletion(3)],
    [photo(1, 1), photo(2, 2), photo(3, 3)]
  )
  assert.deepEqual(
    ordered.map((item) => item.photoId),
    [3, 2, 1]
  )
})

test('deletions use refreshed positions for stable ids', () => {
  const { orderDeletions } = load()
  const ordered = orderDeletions(
    [deletion(1), deletion(3)],
    [photo(4, 1), photo(3, 2), photo(1, 3)]
  )
  assert.deepEqual(
    ordered.map((item) => item.photoId),
    [1, 3]
  )
})

test('deletions without a current photo are not applied by position', () => {
  const { orderDeletions } = load()
  assert.deepEqual(orderDeletions([deletion(9)], [photo(1), photo(2)]), [])
})

test('move-to-position handles first-to-last and last-to-first', () => {
  const { movePhotoIdentity, photoIdentityKey } = load()
  const order = [photoKey(1), photoKey(2), photoKey(3), photoKey(4)]
  const last = movePhotoIdentity(order, 'photo:1', 'photo:4', 'after')
  assert.deepEqual(last.map(photoIdentityKey), ['photo:2', 'photo:3', 'photo:4', 'photo:1'])

  const first = movePhotoIdentity(order, 'photo:4', 'photo:1', 'before')
  assert.deepEqual(first.map(photoIdentityKey), ['photo:4', 'photo:1', 'photo:2', 'photo:3'])
})

test('move-to-position inserts before and after the target', () => {
  const { movePhotoIdentity, photoIdentityKey } = load()
  const order = [photoKey(1), photoKey(2), photoKey(3), photoKey(4)]
  const before = movePhotoIdentity(order, 'photo:4', 'photo:2', 'before')
  assert.deepEqual(before.map(photoIdentityKey), ['photo:1', 'photo:4', 'photo:2', 'photo:3'])
  const after = movePhotoIdentity(order, 'photo:1', 'photo:2', 'after')
  assert.deepEqual(after.map(photoIdentityKey), ['photo:2', 'photo:1', 'photo:3', 'photo:4'])
})

test('keyboard moves swap adjacent mixed server and pending identities', () => {
  const { movePhotoByStep, photoIdentityKey } = load()
  const order = [photoKey(1), pendingKey('p1'), photoKey(2)]
  assert.deepEqual(movePhotoByStep(order, 'pending:p1', -1).map(photoIdentityKey), [
    'pending:p1',
    'photo:1',
    'photo:2'
  ])
  assert.deepEqual(movePhotoByStep(order, 'pending:p1', 1).map(photoIdentityKey), [
    'photo:1',
    'photo:2',
    'pending:p1'
  ])
  assert.deepEqual(movePhotoByStep(order, 'photo:1', -1), order)
})

test('reconcile keeps draft order and drops deleted or missing identities', () => {
  const { reconcilePhotoOrder, photoIdentityKey } = load()
  const result = reconcilePhotoOrder(
    [photoKey(3), pendingKey('p1'), photoKey(1)],
    [photo(1, 1), photo(2, 2), photo(3, 3)],
    [{ clientId: 'p1' }],
    new Set([2])
  )
  assert.deepEqual(Array.from(result, photoIdentityKey), ['photo:3', 'pending:p1', 'photo:1'])
})

test('reconcile appends new photos and pending uploads in natural order', () => {
  const { reconcilePhotoOrder, photoIdentityKey } = load()
  const result = reconcilePhotoOrder(
    [photoKey(2)],
    [photo(1, 1), photo(2, 2), photo(3, 3)],
    [{ clientId: 'p1' }],
    new Set()
  )
  assert.deepEqual(Array.from(result, photoIdentityKey), [
    'photo:2',
    'photo:1',
    'photo:3',
    'pending:p1'
  ])
})

test('desired server order ignores pending identities and appends missing ids', () => {
  const { resolveDesiredPhotoOrder } = load()
  const order = [photoKey(3), pendingKey('p1'), photoKey(1)]
  assert.deepEqual(Array.from(resolveDesiredPhotoOrder(order, [1, 2, 3])), [3, 1, 2])
  assert.deepEqual(Array.from(resolveDesiredPhotoOrder([pendingKey('p1')], [1, 2])), [1, 2])
})

test('photo sequence conflict ignores staged deletion targets', () => {
  const { isPhotoSequenceUnchanged } = load()
  const baseline = [1, 2, 3, 4]
  assert.equal(isPhotoSequenceUnchanged(baseline, [1, 2, 3, 4, 9], new Set([2])), false)
  assert.equal(isPhotoSequenceUnchanged(baseline, [1, 2, 4], new Set([3])), true)
  assert.equal(isPhotoSequenceUnchanged(baseline, [1, 4], new Set([2, 3])), true)
  assert.equal(isPhotoSequenceUnchanged(baseline, [1, 4], new Set([2])), false)
})
