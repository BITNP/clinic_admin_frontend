import ui from './ui'
import rooms from './rooms'
import records from './records'
import schedule from './schedule'
import staff from './staff'
import announcements from './announcements'
import workSchedules from './work-schedules'

// Domain modules that own reloadable data. `ui` is deliberately excluded.
const registry = {
  rooms,
  records,
  schedule,
  staff,
  announcements,
  workSchedules,
}

export type StorePart = keyof typeof registry

/**
 * Refresh one or more parts of the store, each independently of the others.
 *
 *   refresh()                       // everything
 *   refresh('records')              // only the ticket list
 *   refresh('schedule', 'rooms')    // just these two
 *
 * Each part implements the same `refresh()` contract, so callers don't need to
 * know what a domain actually fetches.
 */
export async function refresh(...parts: StorePart[]): Promise<void> {
  const targets = parts.length ? parts : (Object.keys(registry) as StorePart[])
  await Promise.all(targets.map((part) => registry[part].refresh()))
}

export { ui, rooms, records, schedule, staff, announcements, workSchedules }
