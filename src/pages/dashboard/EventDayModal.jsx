import { createPortal } from 'react-dom';
import { useLang } from '../../context/LangContext';
import { formatEventTime } from '../../utils/dateTimeFormat';
import { getAssigneeInitials, getAssigneeMonogramStyle } from '../../utils/eventAssignee';

const TYPE_COLOR = {
  Shoot: 'var(--sage)',
  Edit: 'var(--amber)',
  Deadline: 'var(--orange)',
  Call: 'var(--blue)',
  Delivery: 'var(--purple)',
};

/**
 * Day summary: list events, add new, or open an event for editing.
 */
export default function EventDayModal({ date, events, onClose, onAddEvent, onEventClick }) {
  const { t, lang } = useLang();
  const locale = lang === 'en' ? 'en-GB' : 'nl-NL';
  if (!date) return null;

  return createPortal(
    <div className="modal-overlay modal-overlay--portal open" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{date}</div>
          <button type="button" className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          {events.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--text-3)', fontStyle: 'italic' }}>
              {t('dayModalNoEvents')}
            </p>
          ) : (
            events.map((e) => {
              const initials = getAssigneeInitials(e, { maxLength: 3 });
              const monoStyle = getAssigneeMonogramStyle(e);
              const timeDisp = formatEventTime(e.time, locale);
              return (
                <button
                  key={e._id}
                  type="button"
                  className="day-event-item"
                  onClick={() => onEventClick?.(e)}
                >
                  <div className="event-dot" style={{ background: TYPE_COLOR[e.type] || 'var(--accent)' }} />
                  <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                    <div className="day-event-title-row">
                      <span className="day-event-name">{e.name}</span>
                      {initials ? (
                        <span
                          className="day-event-initials"
                          style={monoStyle}
                          title={e.assigneeId?.name || ''}
                        >
                          {initials}
                        </span>
                      ) : null}
                      {timeDisp ? <span className="day-event-time">{timeDisp}</span> : null}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>
                      {e.type}
                      {e.client ? ` · ${e.client}` : ''}
                    </div>
                    {e.notes && (
                      <div style={{ fontSize: '12px', color: 'var(--text-2)', marginTop: '4px' }}>{e.notes}</div>
                    )}
                  </div>
                  <span className="event-arrow">→</span>
                </button>
              );
            })
          )}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t('close')}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => onAddEvent(date)}>
            {t('addEventToDay')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
