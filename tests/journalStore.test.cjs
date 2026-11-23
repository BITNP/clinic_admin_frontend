/* eslint-env node */
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { test } = require('node:test')
const vm = require('node:vm')
const ts = require('typescript')

const transpile = (path) =>
  ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText

function setup() {
  const journal = {}
  vm.runInNewContext(transpile(`${__dirname}/../src/utils/Journal.ts`), {
    exports: journal,
    URLSearchParams,
    Intl,
    Date
  })

  const requests = []
  const exports = {}
  vm.runInNewContext(transpile(`${__dirname}/../src/store/journal.ts`), {
    exports,
    URLSearchParams,
    AbortController,
    require(name) {
      if (name === 'vue') return require('vue')
      if (name === '@/utils/Auth') return { default: { ready: async () => {} } }
      if (name === '@/utils/Journal') return journal
      if (name === '@/utils/Api')
        return {
          default: {
            get(url, config = {}) {
              return new Promise((resolve, reject) => {
                requests.push({
                  url,
                  config,
                  resolve(data) {
                    resolve({ data })
                  },
                  reject
                })
              })
            }
          }
        }
      throw new Error(`Unexpected import: ${name}`)
    }
  })
  return { store: exports.default, requests }
}

const settle = () => new Promise((resolve) => setImmediate(resolve))

const entityKinds = {
  items: [{ entity_type: 'record', actions: ['record.updated'] }]
}

const page = (ids, nextCursor = null) => ({
  items: ids.map((id) => ({
    id,
    occurred_at: '2026-11-22T02:05:00Z',
    recorded_at: '2026-11-22T02:05:00.012Z',
    actor_type: 'staff',
    actor_id: '42',
    action: 'record.updated',
    entity_type: 'record',
    entity_id: String(id),
    operation_id: `op-${id}`,
    caused_by_event_id: null,
    details: { version: 1 }
  })),
  next_cursor: nextCursor
})

test('journal store loads 100 items by default', async () => {
  const { store, requests } = setup()
  const load = store.ensureLoaded()
  await settle()

  const kindsRequest = requests.find((request) => request.url.endsWith('/entity-kinds'))
  const pageRequest = requests.find((request) => request.url.includes('/api/admin/journal?'))
  kindsRequest.resolve(entityKinds)
  pageRequest.resolve(page([12, 10], 10))
  await load

  const url = new URL(pageRequest.url, 'https://clinic.example')
  assert.equal(url.searchParams.get('limit'), '100')
  assert.deepEqual(
    store.state.events.map((event) => event.id),
    [12, 10]
  )
  assert.equal(store.state.selectedId, 12)
  assert.equal(store.isLoaded(), true)
})

test('journal refresh preserves loaded history and selection', async () => {
  const { store, requests } = setup()
  const load = store.ensureLoaded()
  await settle()
  requests.find((request) => request.url.endsWith('/entity-kinds')).resolve(entityKinds)
  requests
    .find((request) => request.url.includes('/api/admin/journal?'))
    .resolve(page([12, 10], 10))
  await load
  store.select(10)

  const refresh = store.refresh()
  await settle()
  const pageRequests = requests.filter(
    (request) => request.url.includes('/api/admin/journal?') && !request.url.includes('cursor=')
  )
  const first = pageRequests[pageRequests.length - 1]
  first.resolve(page([13, 12, 11], 11))
  await settle()

  const second = requests.find((request) => request.url.includes('cursor=11'))
  second.resolve(page([10, 9]))
  await settle()
  const kindsRequests = requests.filter((request) => request.url.endsWith('/entity-kinds'))
  kindsRequests[kindsRequests.length - 1].resolve(entityKinds)
  await refresh

  assert.deepEqual(
    JSON.parse(JSON.stringify(store.state.events.map((event) => event.id))),
    [13, 12, 11, 10, 9]
  )
  assert.equal(store.state.selectedId, 10)
  assert.equal(store.state.nextCursor, null)
  assert.equal(store.state.loading, false)
})
