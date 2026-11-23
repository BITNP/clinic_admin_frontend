/* eslint-env node */
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { test } = require('node:test')
const vm = require('node:vm')
const ts = require('typescript')

const source = ts.transpileModule(readFileSync(`${__dirname}/../src/utils/Sync.ts`, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText

function setup() {
  const requests = []
  const exports = {}

  vm.runInNewContext(source, {
    exports,
    console,
    localStorage: {
      getItem: () => null,
      setItem: () => {}
    },
    document: {
      querySelector: () => null,
      activeElement: null
    },
    require(name) {
      if (name === 'vue') return require('vue')
      if (name === './Auth' || name === '@/utils/Auth') {
        return { default: { isLogin: { value: true } } }
      }
      if (name === '@/store') return { refreshLoaded: async () => {} }
      if (name === './Api' || name === '@/utils/Api') {
        return {
          default: {
            get(url) {
              return new Promise((resolve, reject) => {
                requests.push({ url, resolve, reject })
              })
            }
          }
        }
      }
      throw new Error(`Unexpected import: ${name}`)
    }
  })

  return { sync: exports.default, requests }
}

const settle = () => new Promise((resolve) => setImmediate(resolve))

test('sync connection status reflects backend polling outcomes', async () => {
  const { sync, requests } = setup()
  assert.equal(sync.isConnected.value, false)

  const connecting = sync.fetch()
  await settle()
  assert.equal(requests.at(-1).url, '/api/admin/sync')
  requests.at(-1).resolve({ data: { record: 1 } })
  await connecting
  assert.equal(sync.isConnected.value, true)

  const disconnecting = sync.fetch()
  await settle()
  requests.at(-1).reject(new Error('backend unavailable'))
  await assert.rejects(disconnecting, /backend unavailable/)
  assert.equal(sync.isConnected.value, false)

  const reconnecting = sync.fetch()
  await settle()
  requests.at(-1).resolve({ data: { record: 1 } })
  await reconnecting
  assert.equal(sync.isConnected.value, true)

  sync.stop()
  assert.equal(sync.isConnected.value, false)
})
