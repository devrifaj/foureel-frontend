import { useLang } from '../../context/LangContext';

const TYPE_COLOR = {
  Shoot: 'var(--sage)',
  Edit: 'var(--amber)',
  Deadline: 'var(--orange)',
  Call: 'var(--blue)',
  Delivery: 'var(--purple)',
};

/**
 * Lists events for a single calendar day; parent opens add-event flow via onAddEvent(date).
 */
export default function HomeDayModal({ date, events, onClose, onAddEvent }) {
  const { t } = useLang();
  if (!date) return null;

  return (
    <div className="modal-overlay open" onClick={onClose}>
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
            events.map((e) => (
              <div key={e._id} className="day-event-item">
                <div className="event-dot" style={{ background: TYPE_COLOR[e.type] || 'var(--accent)' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 500 }}>{e.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>
                    {e.type}
                    {e.client ? ` · ${e.client}` : ''}
                  </div>
                  {e.notes && (
                    <div style={{ fontSize: '12px', color: 'var(--text-2)', marginTop: '4px' }}>{e.notes}</div>
                  )}
                </div>
                <span className="event-arrow">→</span>
              </div>
            ))
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
    </div>
  );
}
