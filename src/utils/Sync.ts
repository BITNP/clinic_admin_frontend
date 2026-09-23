import { ref } from 'vue'
import Api from './Api'
import Auth from './Auth'
import { refreshLoaded, type StorePart } from '@/store'

// How often the backend counters are polled, in milliseconds.
const SYNC_INTERVAL_MS = 10_000

// localStorage key holding the counters this browser last saw.
const CACHE_KEY = 'clinic.sync.counters'

// Maps a backend sync group to the store section it refreshes.
const GROUP_TO_PART: Record<string, StorePart> = {
  record: 'records',
  room: 'rooms',
  work_schedule: 'workSchedules',
  service_date: 'schedule',
  staff: 'staff',
  announcement: 'announcements',
}

type Counters = Record<string, number>

const loadCache = (): Counters => {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as Counters) : {}
  } catch {
    return {}
  }
}

const saveCache = (counters: Counters) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(counters))
  } catch {
    // Ignore quota/private-mode failures: the cache is an optimisation only.
  }
}

/**
 * Polls /api/admin/sync and refreshes the parts of the store whose counter
 * changed. Counters are cached in localStorage so the comparison survives
 * reloads. Polling only runs while logged in and while the tab is visible.
 */
class SyncBase {
  // Last counters known to this browser.
  counters = ref<Counters>({})

  private timer: ReturnType<typeof setTimeout> | null = null
  private running = false
  private listening = false
  private inFlight = false

  // start begins polling. Safe to call more than once.
  async start() {
    if (this.running) return
    this.running = true

    if (!this.listening) {
      this.listening = true
      document.addEventListener('visibilitychange', this.handleVisibility)
    }

    // Use any cached counters until a real fetch succeeds.
    this.counters.value = loadCache()
    try {
      await this.fetch()
    } catch (e) {
      console.error('sync: initial fetch failed', e)
    }
    this.schedule()
  }

  stop() {
    this.running = false
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
    if (this.listening) {
      this.listening = false
      document.removeEventListener('visibilitychange', this.handleVisibility)
    }
  }

  private schedule() {
    if (!this.running) return
    this.timer = setTimeout(() => this.tick(), SYNC_INTERVAL_MS)
  }

  private handleVisibility = () => {
    // Catch up right away when the tab becomes visible again.
    if (!document.hidden) this.tick()
  }

  private async tick() {
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
    if (!this.running || this.inFlight) return

    if (Auth.isLogin.value && !document.hidden) {
      this.inFlight = true
      try {
        await this.fetch()
      } catch (e) {
        // Keep the previous baseline and retry on the next tick.
        console.debug('sync: poll failed', e)
      } finally {
        this.inFlight = false
      }
    }
    this.schedule()
  }

  // fetch reads the counters, stores them, then refreshes the changed groups.
  // The new counters are stored before refreshing so a change that lands during
  // the refresh is detected on the next tick instead of being dropped.
  private async fetch() {
    const res = await Api.get<Counters>('/api/admin/sync')
    const next = res.data
    const prev = this.counters.value
    const hasBaseline = Object.keys(prev).length > 0
    const changed = Object.keys(next).filter((group) => prev[group] !== next[group])

    this.counters.value = next
    saveCache(next)

    // On the first run there is no baseline, so every counter looks "changed";
    // skip refreshing because the views are loading fresh data anyway.
    if (!hasBaseline || !changed.length) return

    const parts = Array.from(
      new Set(changed.map((group) => GROUP_TO_PART[group]).filter(Boolean))
    )
    if (!parts.length) return
    await refreshLoaded(...parts)
  }
}

const Sync = new SyncBase()
export default Sync
