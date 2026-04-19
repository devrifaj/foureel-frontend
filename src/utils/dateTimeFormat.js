/**
 * Studio calendar: events store `date` as YYYY-MM-DD and optional `time` as HH:mm.
 */

const TIME_RE = /^(\d{1,2}):(\d{2})$/;

/**
 * @param {string | undefined | null} timeStr
 * @param {string} [locale='nl-NL']
 * @param {{ hour12?: boolean }} [opts]
 * @returns {string} e.g. "14:30" / "2:30 pm" or "" if missing/invalid
 */
export function formatEventTime(timeStr, locale = 'nl-NL', opts = {}) {
  const { hour12 = false } = opts;
  if (!timeStr || typeof timeStr !== 'string') return '';
  const m = timeStr.trim().match(TIME_RE);
  if (!m) return timeStr.trim();
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (Number.isNaN(h) || Number.isNaN(min)) return timeStr.trim();
  const d = new Date();
  d.setHours(h, min, 0, 0);
  return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12 });
}

/**
 * Sort key for one event (date + time) for stable list ordering.
 * @param {{ date?: string, time?: string, name?: string }} e
 */
export function compareEventsBySchedule(a, b) {
  const dc = (a.date || '').localeCompare(b.date || '');
  if (dc !== 0) return dc;
  const ta = a.time?.trim();
  const tb = b.time?.trim();
  if (ta && tb) {
    const c = ta.localeCompare(tb);
    if (c !== 0) return c;
  } else if (ta && !tb) return -1;
  else if (!ta && tb) return 1;
  return (a.name || '').localeCompare(b.name || '');
}

/**
 * @param {Array<{ date?: string, time?: string, name?: string }>} events
 */
export function sortEventsBySchedule(events) {
  return [...events].sort(compareEventsBySchedule);
}
