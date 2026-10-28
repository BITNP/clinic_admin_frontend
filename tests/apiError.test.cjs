/* eslint-env node */
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { test } = require('node:test')
const vm = require('node:vm')
const ts = require('typescript')

const source = ts.transpileModule(readFileSync(`${__dirname}/../src/utils/ApiError.ts`, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText

const load = () => {
  const exports = {}
  vm.runInNewContext(source, { exports })
  return exports
}

const httpError = (status, data) => ({ response: { status, data } })

test('apiErrorText explains expired sessions, permissions, missing records, and size limits', () => {
  const { apiErrorText } = load()
  assert.match(apiErrorText(httpError(401)), /登录已过期/)
  assert.match(apiErrorText(httpError(403)), /没有权限/)
  assert.match(apiErrorText(httpError(404)), /已不存在/)
  assert.match(apiErrorText(httpError(413)), /大小限制/)
})

test('apiErrorText uses the server message and fallback for other failures', () => {
  const { apiErrorText } = load()
  assert.equal(
    apiErrorText(httpError(409, { error: 'photo order changed' })),
    'photo order changed'
  )
  assert.equal(apiErrorText(httpError(500, { msg: 'storage unavailable' })), 'storage unavailable')
  assert.equal(apiErrorText(new Error('network'), '请重试'), '请重试')
})

test('isUncertainRequestError retries only timeouts, network errors, and 5xx', () => {
  const { isUncertainRequestError } = load()
  assert.equal(isUncertainRequestError(new Error('network')), true)
  assert.equal(isUncertainRequestError(httpError(408)), true)
  assert.equal(isUncertainRequestError(httpError(500)), true)
  assert.equal(isUncertainRequestError(httpError(400)), false)
  assert.equal(isUncertainRequestError(httpError(409)), false)
})
