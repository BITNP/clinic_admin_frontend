const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { test } = require('node:test')
const vm = require('node:vm')
const ts = require('typescript')

// Execute the real store with controlled network responses, without requiring
// a browser or adding a test framework to the application.
const source = ts.transpileModule(
  readFileSync(`${__dirname}/../src/store/records.ts`, 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
).outputText

function setup() {
  const requests = []
  const exports = {}
  vm.runInNewContext(source, {
    exports,
    require(name) {
      if (name === 'vue') return require('vue')
      if (name === '@/utils/Auth') return { default: { ready: async () => {} } }
      if (name === '@/utils/Api') return { default: {
        get(url) {
          return new Promise((resolve, reject) => {
            requests.push({
              url, reject,
              respond(ids) {
                resolve({ data: { items: ids.map(id => ({ id })) } })
              }
            })
          })
        }
      } }
      throw new Error(`Unexpected import: ${name}`)
    }
  })
  return { records: exports.default, requests }
}

const settle = () => new Promise(resolve => setImmediate(resolve))

test('refresh during load more fetches page one again and includes new tickets', async () => {
  const { records, requests } = setup()
  records.state.items = { 619: { id: 619 } }
  records.state.loadedPages = 1
  records.state.page = 2
  const more = records.loadMore()
  await settle()
  const refresh = records.refresh()
  let finished = false
  refresh.then(() => { finished = true })
  await settle()
  assert.equal(finished, false)
  assert.equal(requests.length, 1)
  assert.equal(requests[0].url, '/api/admin/records?page=2')
  requests[0].respond([599])
  await more
  await settle()
  assert.equal(records.state.loading, true)
  assert.equal(requests[1].url, '/api/admin/records?page=1')
  requests[1].respond([620, 619])
  await settle()
  assert.equal(records.state.items[620], undefined, 'swap waits for all pages')
  assert.equal(requests[2].url, '/api/admin/records?page=2')
  requests[2].respond([600, 599])
  await refresh
  assert.ok(records.state.items[620])
  assert.equal(records.state.loadedPages, 2)
  assert.equal(records.state.page, 3)
  assert.equal(records.state.loading, false)
})

test('sync can refresh during the initial load and reads a newer snapshot', async () => {
  const { records, requests } = setup()
  assert.equal(records.isLoaded(), false)
  const initial = records.refresh()
  await settle()
  assert.equal(records.isLoaded(), true, 'refreshLoaded must include this store')
  const next = records.refresh()
  requests[0].respond([619])
  await initial
  await settle()
  assert.equal(requests.length, 2)
  requests[1].respond([620, 619])
  await next
  assert.ok(records.state.items[620])
})

test('a failed load does not cancel a queued refresh', async () => {
  const { records, requests } = setup()
  const more = records.loadMore()
  const failed = assert.rejects(more, /network unavailable/)
  await settle()
  const refresh = records.refresh()
  requests[0].reject(new Error('network unavailable'))
  await failed
  await settle()
  requests[1].respond([620])
  await refresh
  assert.ok(records.state.items[620])
  assert.equal(records.state.loading, false)
})

test('failed refresh preserves the old list, rejects, and allows retry', async () => {
  const { records, requests } = setup()
  records.state.items = { 619: { id: 619 } }
  records.state.loadedPages = 2
  records.state.page = 3
  const refresh = records.refresh()
  const failed = assert.rejects(refresh, /network unavailable/)
  await settle()
  requests[0].respond([620])
  await settle()
  requests[1].reject(new Error('network unavailable'))
  await failed
  assert.ok(records.state.items[619])
  assert.equal(records.state.items[620], undefined)
  assert.equal(records.state.loading, false)
  const retry = records.refresh()
  await settle()
  requests[2].respond([620])
  await settle()
  requests[3].respond([600])
  await retry
  assert.ok(records.state.items[620])
  assert.equal(records.state.loading, false)
})
