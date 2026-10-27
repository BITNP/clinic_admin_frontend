/* eslint-env node */
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { test } = require('node:test')
const vm = require('node:vm')
const ts = require('typescript')

const source = ts.transpileModule(
  readFileSync(`${__dirname}/../src/utils/markdownSafety.ts`, 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
).outputText

const api = {}
vm.runInNewContext(source, { exports: api, URL })

test('safe markdown links allow web, mail, and relative targets', () => {
  for (const href of [
    'https://example.com',
    'http://example.com/path?q=1',
    'mailto:help@example.com',
    '/records/1',
    '#section',
    '?page=2'
  ]) {
    assert.equal(api.isSafeMarkdownLink(href), true, href)
  }
})

test('safe markdown links reject script and data URLs', () => {
  for (const href of [
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    ''
  ]) {
    assert.equal(api.isSafeMarkdownLink(href), false, href)
  }
})
