/* eslint-env node */
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { test } = require('node:test')
const vm = require('node:vm')
const ts = require('typescript')

const source = ts.transpileModule(
  readFileSync(`${__dirname}/../src/utils/RecordNoteDrafts.ts`, 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
).outputText

function setup() {
  const listeners = []
  const exports = {}
  const window = {
    addEventListener(type, listener) {
      if (type === 'beforeunload') listeners.push(listener)
    }
  }
  vm.runInNewContext(source, { exports, window })
  return { drafts: exports, listeners }
}

const draft = (accountId, recordId, text, originalServerText) => ({
  accountId,
  recordId,
  text,
  originalServerText,
  updatedAt: 1
})

test('fallback drafts are scoped by account and record', () => {
  const { drafts } = setup()

  assert.equal(drafts.hasUnsavedRecordNoteDrafts(), false)
  drafts.setSessionRecordNoteDraft(draft('alice', 1, 'alice draft', 'server'))
  drafts.setSessionRecordNoteDraft(draft('bob', 1, 'bob draft', 'server'))
  drafts.setSessionRecordNoteDraft(draft('alice', 2, 'other record', 'server'))

  assert.equal(drafts.getSessionRecordNoteDraft('alice', 1).text, 'alice draft')
  assert.equal(drafts.getSessionRecordNoteDraft('bob', 1).text, 'bob draft')
  assert.equal(drafts.getSessionRecordNoteDraft('alice', 2).text, 'other record')
  assert.equal(drafts.getSessionRecordNoteDraft('alice', 3), undefined)
  assert.equal(drafts.hasUnsavedRecordNoteDrafts(), true)
  assert.equal(drafts.hasUnsavedRecordNoteDrafts('alice'), true)
  assert.equal(drafts.hasUnsavedRecordNoteDrafts('bob'), true)
  assert.equal(drafts.hasUnsavedRecordNoteDrafts('carol'), false)

  drafts.deleteSessionRecordNoteDraft('alice', 1)
  assert.equal(drafts.getSessionRecordNoteDraft('alice', 1), undefined)
  assert.equal(drafts.hasUnsavedRecordNoteDrafts('alice'), true)
  assert.equal(drafts.hasUnsavedRecordNoteDrafts(), true)

  drafts.clearRecordNoteDrafts('alice')
  assert.equal(drafts.getSessionRecordNoteDraft('alice', 2), undefined)
  assert.equal(drafts.getSessionRecordNoteDraft('bob', 1).text, 'bob draft')
  assert.equal(drafts.hasUnsavedRecordNoteDrafts('alice'), false)
  assert.equal(drafts.hasUnsavedRecordNoteDrafts('bob'), true)

  drafts.clearRecordNoteDrafts()
  assert.equal(drafts.getSessionRecordNoteDraft('bob', 1), undefined)
  assert.equal(drafts.hasUnsavedRecordNoteDrafts(), false)
})

test('beforeunload warns only while a fallback draft exists', () => {
  const { drafts, listeners } = setup()
  assert.equal(listeners.length, 1)

  const event = {
    prevented: false,
    preventDefault() {
      this.prevented = true
    },
    returnValue: ''
  }

  listeners[0](event)
  assert.equal(event.prevented, false)

  drafts.setSessionRecordNoteDraft(draft('alice', 5, 'dirty', 'saved'))
  listeners[0](event)
  assert.equal(event.prevented, true)
})
