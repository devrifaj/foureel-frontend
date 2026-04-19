/**
 * Build value for <input type="datetime-local" /> from API `date` + optional `time`.
 * @param {string} dateStr YYYY-MM-DD
 * @param {string} [timeStr] HH:mm
 */
export function joinDateAndTimeForLocalInput(dateStr, timeStr) {
  if (!dateStr?.trim()) return '';
  const date = dateStr.trim();
  const m = (timeStr || '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (m) {
    const hh = String(Math.min(23, Math.max(0, parseInt(m[1], 10)))).padStart(2, '0');
    const mm = String(Math.min(59, Math.max(0, parseInt(m[2], 10)))).padStart(2, '0');
    return `${date}T${hh}:${mm}`;
  }
  return `${date}T12:00`;
}

/**
 * Parse datetime-local value into API fields.
 * @param {string} dateTimeStr
 * @returns {{ date: string, time: string }}
 */
export function splitDateTimeLocal(dateTimeStr) {
  const raw = (dateTimeStr || '').trim();
  if (!raw) return { date: '', time: '' };
  const [d, tRaw] = raw.split('T');
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return { date: '', time: '' };
  const tPart = (tRaw || '12:00').slice(0, 5);
  const m = tPart.match(/^(\d{2}):(\d{2})$/);
  const time = m ? `${m[1]}:${m[2]}` : '12:00';
  return { date: d, time };
}

export function emptyEventForm() {
  return {
    name: '',
    type: 'Shoot',
    dateTime: '',
    client: '',
    assigneeId: '',
    notes: '',
  };
}

/**
 * @param {object | null | undefined} e API event (assigneeId may be populated)
 */
export function eventToFormState(e) {
  if (!e) return emptyEventForm();
  const aid =
    e.assigneeId && typeof e.assigneeId === 'object' && e.assigneeId._id != null
      ? String(e.assigneeId._id)
      : e.assigneeId
        ? String(e.assigneeId)
        : '';
  return {
    name: e.name || '',
    type: e.type || 'Shoot',
    dateTime: joinDateAndTimeForLocalInput(e.date || '', e.time || ''),
    client: e.client || '',
    assigneeId: aid,
    notes: e.notes || '',
  };
}
