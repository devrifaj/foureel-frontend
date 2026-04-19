/**
 * @param {{ assigneeId?: unknown }} event
 * @param {{ maxLength?: number }} [opts] default maxLength 4; use 2 on week/calendar chips
 * @returns {string} Short initials (may be empty)
 */
export function getAssigneeInitials(event, opts = {}) {
  const maxLength = opts.maxLength ?? 4;
  const u = event?.assigneeId;
  if (!u || typeof u !== 'object') return '';
  const raw = (u.initials || '').trim();
  let result = '';
  if (raw) {
    result = raw.toUpperCase().replace(/\s+/g, '');
  } else {
    const parts = (u.name || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const a = parts[0][0] || '';
      const b = parts[parts.length - 1][0] || '';
      result = (a + b).toUpperCase();
    } else if (parts.length === 1 && parts[0].length >= 2) {
      result = parts[0].slice(0, 2).toUpperCase();
    } else {
      result = (parts[0]?.[0] || '').toUpperCase();
    }
  }
  return result.slice(0, Math.max(1, maxLength));
}

/**
 * Inline styles when assignee has a hex profile colour (chips / day list).
 * @param {{ assigneeId?: unknown }} event
 * @returns {import('react').CSSProperties | undefined}
 */
export function getAssigneeMonogramStyle(event) {
  const u = event?.assigneeId;
  if (!u || typeof u !== 'object') return undefined;
  const hex = typeof u.color === 'string' ? u.color.trim() : '';
  if (!/^#[0-9A-Fa-f]{6}$/i.test(hex) && !/^#[0-9A-Fa-f]{8}$/i.test(hex)) return undefined;
  return {
    backgroundColor: hex.slice(0, 7),
    color: '#faf7f2',
    border: 'none',
    boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.14)',
  };
}
