/* eslint-env node */
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { test } = require('node:test')
const vm = require('node:vm')
const ts = require('typescript')

const source = ts.transpileModule(readFileSync(`${__dirname}/../src/utils/Journal.ts`, 'utf8'), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022
  }
}).outputText

const journal = {}
vm.runInNewContext(source, {
  exports: journal,
  URLSearchParams,
  Intl,
  Date
})

test('journal filters round-trip through URL query values', () => {
  const parsed = journal.journalFiltersFromRouteQuery({
    entity_type: ' record ',
    entity_id: ['123'],
    actor_type: 'staff',
    actor_id: '42',
    action: 'record.confirmed',
    from: '2026-11-01T00:00:00+08:00',
    to: 'not-a-time'
  })

  assert.equal(parsed.entityType, 'record')
  assert.equal(parsed.entityId, '123')
  assert.equal(parsed.actorType, 'staff')
  assert.equal(parsed.actorId, '42')
  assert.equal(parsed.from, '2026-10-31T16:00:00.000Z')
  assert.equal(parsed.to, '')

  assert.deepEqual(JSON.parse(JSON.stringify(journal.journalFiltersToRouteQuery(parsed))), {
    entity_type: 'record',
    entity_id: '123',
    actor_type: 'staff',
    actor_id: '42',
    action: 'record.confirmed',
    from: '2026-10-31T16:00:00.000Z'
  })
})

test('journal request URL includes every active filter and cursor', () => {
  const url = new URL(
    journal.journalRequestURL(
      {
        entityType: 'record',
        entityId: '123',
        actorType: 'system',
        actorId: 'dingtalk_reminder_worker',
        action: 'notification.failed',
        from: '2026-11-01T00:00:00.000Z',
        to: '2026-11-23T23:59:59.999Z'
      },
      91
    ),
    'https://clinic.example'
  )

  assert.equal(url.pathname, '/api/admin/journal')
  assert.equal(url.searchParams.get('entity_type'), 'record')
  assert.equal(url.searchParams.get('entity_id'), '123')
  assert.equal(url.searchParams.get('actor_type'), 'system')
  assert.equal(url.searchParams.get('actor_id'), 'dingtalk_reminder_worker')
  assert.equal(url.searchParams.get('action'), 'notification.failed')
  assert.equal(url.searchParams.get('from'), '2026-11-01T00:00:00.000Z')
  assert.equal(url.searchParams.get('to'), '2026-11-23T23:59:59.999Z')
  assert.equal(url.searchParams.get('cursor'), '91')
  assert.equal(url.searchParams.get('limit'), '20')
})

test('journal page normalization accepts legacy Go field names', () => {
  const page = journal.normalizeJournalPage({
    Items: [
      {
        ID: 1002,
        OccurredAt: '2026-11-22T02:05:00Z',
        RecordedAt: '2026-11-22T02:05:00.012Z',
        ActorType: 'staff',
        ActorID: '42',
        Action: 'record.confirmed',
        EntityType: 'record',
        EntityID: '123',
        OperationID: 'op_5f5f0ac1d4924c9f9d2d0e1b195f4c42',
        CausedByEventID: null,
        Details: { version: 1, changes: {} }
      }
    ],
    NextCursor: 1002
  })

  assert.equal(page.items[0].id, 1002)
  assert.equal(page.items[0].occurred_at, '2026-11-22T02:05:00Z')
  assert.equal(page.items[0].actor_type, 'staff')
  assert.equal(page.items[0].entity_type, 'record')
  assert.equal(page.items[0].operation_id, 'op_5f5f0ac1d4924c9f9d2d0e1b195f4c42')
  assert.equal(page.next_cursor, 1002)
})

test('journal entity kind normalization validates and deduplicates options', () => {
  const kinds = journal.normalizeJournalEntityKinds({
    items: [
      {
        entity_type: 'record',
        actions: ['record.updated', ' record.confirmed ', 'record.updated']
      },
      {
        entity_type: 'service_date',
        actions: ['notification.requested']
      }
    ]
  })

  assert.deepEqual(JSON.parse(JSON.stringify(kinds)), [
    {
      entity_type: 'record',
      actions: ['record.updated', 'record.confirmed']
    },
    {
      entity_type: 'service_date',
      actions: ['notification.requested']
    }
  ])
  assert.throws(
    () => journal.normalizeJournalEntityKinds({ items: [{ entity_type: 'record', actions: [1] }] }),
    /action is invalid/
  )
})

test('journal date ranges include the whole local end day', () => {
  const range = [new Date(2026, 10, 1).getTime(), new Date(2026, 10, 23).getTime()]
  const filters = journal.withJournalDateRange(journal.emptyJournalFilters(), range)

  const from = new Date(filters.from)
  const to = new Date(filters.to)
  assert.equal(from.getFullYear(), 2026)
  assert.equal(from.getMonth(), 10)
  assert.equal(from.getDate(), 1)
  assert.equal(from.getHours(), 0)
  assert.equal(to.getFullYear(), 2026)
  assert.equal(to.getMonth(), 10)
  assert.equal(to.getDate(), 23)
  assert.equal(to.getHours(), 23)
  assert.equal(to.getMinutes(), 59)
  assert.equal(to.getSeconds(), 59)

  const pickerRange = journal.journalDateRange(filters)
  assert.equal(new Date(pickerRange[0]).getDate(), 1)
  assert.equal(new Date(pickerRange[1]).getDate(), 23)
})

test('journal change rows expose before, after, redaction, and other details', () => {
  const details = {
    version: 1,
    name: 'MESSAGE_GATEWAY_URL',
    changes: {
      value: { changed: true, redacted: true },
      status: { before: 'pending', after: 'confirmed' }
    }
  }

  assert.deepEqual(JSON.parse(JSON.stringify(journal.journalChangeRows(details))), [
    { field: 'value', label: '配置值', redacted: true },
    {
      field: 'status',
      label: '状态',
      before: 'pending',
      after: 'confirmed',
      redacted: false
    }
  ])
  assert.deepEqual(JSON.parse(JSON.stringify(journal.journalOtherDetails(details))), [
    ['name', 'MESSAGE_GATEWAY_URL']
  ])
  assert.equal(journal.journalActionLabel('record.confirmed'), '确认预约')
  assert.equal(journal.journalActionLabel('future.action'), 'future.action')
})
