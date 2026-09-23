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

// isEditing reports whether the user is in the middle of entering data: a form
// field has focus, the rich-text editor is active, or an edit modal is open.
// Refreshing then would unmount children and discard unsaved input.
const isEditing = (): boolean => {
  // Naive UI keeps .n-modal-container mounted after the first open, but the
  // .n-modal element only exists while a modal is actually shown.
  if (document.querySelector('.n-modal-container .n-modal')) return true

  const el = document.activeElement as HTMLElement | null
  if (!el) return false
  if (el.isContentEditable) return true

  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true

  const role = el.getAttribute('role')
  if (role === 'combobox' || role === 'textbox' || role === 'listbox' || role === 'spinbutton') {
    return true
  }
  return el.closest('.n-input, .n-base-selection, .n-date-picker, .n-input-number') !== null
}

/**
 * Polls /api/admin/sync and refreshes the parts of the store whose counter
 * changed. Counters are cached in localStorage so the comparison survives
 * reloads. Polling only runs while logged in and while the tab is visible.
 *
 * Refreshes are deferred while the user is editing (focused field, rich-text
 * editor, or open modal) so a background refresh cannot discard unsaved input;
 * deferred changes are queued and applied once editing stops.
 */
class SyncBase {
  // Last counters known to this browser.
  counters = ref<Counters>({})

  private timer: ReturnType<typeof setTimeout> | null = null
  private flushTimer: ReturnType<typeof setTimeout> | null = null
  private running = false
  private listening = false
  private inFlight = false
  // Parts that changed while editing was in progress and still need refreshing.
  private pendingParts = new Set<StorePart>()

  // start begins polling. Safe to call more than once.
  async start() {
    if (this.running) return
    this.running = true

    if (!this.listening) {
      this.listening = true
      document.addEventListener('visibilitychange', this.handleVisibility)
      document.addEventListener('focusout', this.handleFocusOut)
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
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }
    if (this.listening) {
      this.listening = false
      document.removeEventListener('visibilitychange', this.handleVisibility)
      document.removeEventListener('focusout', this.handleFocusOut)
    }
    this.pendingParts.clear()
  }

  private schedule() {
    if (!this.running) return
    this.timer = setTimeout(() => this.tick(), SYNC_INTERVAL_MS)
  }

  private handleVisibility = () => {
    // Catch up right away when the tab becomes visible again.
    if (!document.hidden) this.tick()
  }

  // When focus leaves a field, flush any refresh deferred while editing. The
  // timeout lets activeElement settle on its new target first.
  private handleFocusOut = () => {
    if (this.flushTimer !== null) clearTimeout(this.flushTimer)
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null
      void this.flushPending()
    }, 0)
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

  // fetch reads the counters and queues the changed groups. The new counters
  // are stored before refreshing so a change that lands during the refresh is
  // detected on the next tick instead of being dropped.
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
    if (hasBaseline && changed.length) {
      for (const group of changed) {
        const part = GROUP_TO_PART[group]
        if (part) this.pendingParts.add(part)
      }
    }

    // Defer while the user is editing so a refresh cannot discard unsaved input.
    if (isEditing()) return
    await this.flushPending()
  }

  // flushPending refreshes the queued parts unless the user is still editing.
  private async flushPending() {
    if (isEditing() || this.pendingParts.size === 0) return

    const parts = Array.from(this.pendingParts)
    this.pendingParts.clear()
    try {
      await refreshLoaded(...parts)
    } catch (e) {
      // Keep the parts queued so a failed refresh is retried.
      parts.forEach((part) => this.pendingParts.add(part))
      console.debug('sync: refresh failed', e)
    }
  }
}

const Sync = new SyncBase()
export default Sync
