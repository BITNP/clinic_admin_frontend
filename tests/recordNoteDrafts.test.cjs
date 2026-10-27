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

test('drafts are scoped per record and clear when they match saved text', () => {
  const { drafts } = setup()

  assert.equal(drafts.hasUnsavedRecordNoteDrafts(), false)
  drafts.setRecordNoteDraft(1, 'record one draft', 'record one saved')
  drafts.setRecordNoteDraft(2, 'record two draft', 'record two saved')

  assert.equal(drafts.getRecordNoteDraft(1).text, 'record one draft')
  assert.equal(drafts.getRecordNoteDraft(2).text, 'record two draft')
  assert.equal(drafts.hasUnsavedRecordNoteDrafts(), true)

  drafts.setRecordNoteDraft(1, 'record one saved', 'record one saved')
  assert.equal(drafts.getRecordNoteDraft(1), undefined)
  assert.equal(drafts.hasUnsavedRecordNoteDrafts(), true)

  drafts.clearRecordNoteDrafts()
  assert.equal(drafts.getRecordNoteDraft(2), undefined)
  assert.equal(drafts.hasUnsavedRecordNoteDrafts(), false)
})

test('beforeunload warns only when a dirty draft exists', () => {
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

  drafts.setRecordNoteDraft(5, 'dirty', 'saved')
  listeners[0](event)
  assert.equal(event.prevented, true)
})
