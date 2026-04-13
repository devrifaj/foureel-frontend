import { useEffect, useState } from 'react';
import { useLang } from '../../context/LangContext';

const TYPES = ['Shoot', 'Edit', 'Deadline', 'Call', 'Delivery'];

const errBorder = { borderColor: 'var(--accent)', boxShadow: '0 0 0 1px var(--accent)' };

/**
 * Create-event form for home week view; submits via parent mutation.
 */
export default function HomeAddEventModal({
  open,
  onClose,
  form,
  setForm,
  clients,
  createMut,
  isTeam,
}) {
  const { t } = useLang();
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    if (!open) return;
    setFieldErrors({});
    createMut.reset();
  }, [open]);

  const clearError = (key) =>
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });

  const handleSave = () => {
    const next = {};
    if (!form.name?.trim()) next.name = t('eventValidationNameRequired');
    if (!form.date?.trim()) next.date = t('eventValidationDateRequired');
    if (!form.client?.trim()) next.client = t('eventValidationClientRequired');
    setFieldErrors(next);
    if (Object.keys(next).length) return;

    const clientRow = clients.find((c) => c.name === form.client);
    createMut.mutate({
      name: form.name.trim(),
      type: form.type,
      date: form.date,
      client: form.client,
      ...(clientRow?._id && { clientId: clientRow._id }),
      notes: form.notes?.trim() || '',
    });
  };

  if (!open) return null;

  return (
    <div className="modal-overlay open" onClick={onClose}>
      <div className="modal" style={{ maxWidth: '460px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{t('eventFormTitle')}</div>
          <button type="button" className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">{t('eventNameLabel')}</label>
            <input
              className="form-input"
              value={form.name}
              onChange={(e) => {
                clearError('name');
                setForm((f) => ({ ...f, name: e.target.value }));
              }}
              placeholder={t('eventNamePlaceholder')}
              style={fieldErrors.name ? errBorder : undefined}
              aria-invalid={!!fieldErrors.name}
              aria-describedby={fieldErrors.name ? 'event-name-err' : undefined}
            />
            {fieldErrors.name && (
              <div id="event-name-err" role="alert" style={{ fontSize: '12px', color: 'var(--accent)', marginTop: '6px' }}>
                {fieldErrors.name}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
            {TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setForm((f) => ({ ...f, type }))}
                className={`type-btn${form.type === type ? ` active-${type.toLowerCase()}` : ''}`}
              >
                {type}
              </button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">{t('eventDateLabel')}</label>
              <input
                type="date"
                className="form-input"
                value={form.date}
                onChange={(e) => {
                  clearError('date');
                  setForm((f) => ({ ...f, date: e.target.value }));
                }}
                style={fieldErrors.date ? errBorder : undefined}
                aria-invalid={!!fieldErrors.date}
                aria-describedby={fieldErrors.date ? 'event-date-err' : undefined}
              />
              {fieldErrors.date && (
                <div id="event-date-err" role="alert" style={{ fontSize: '12px', color: 'var(--accent)', marginTop: '6px' }}>
                  {fieldErrors.date}
                </div>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">{t('eventClientLabel')}</label>
              <select
                className="form-input"
                value={form.client}
                onChange={(e) => {
                  clearError('client');
                  setForm((f) => ({ ...f, client: e.target.value }));
                }}
                style={fieldErrors.client ? errBorder : undefined}
                aria-invalid={!!fieldErrors.client}
                aria-describedby={fieldErrors.client ? 'event-client-err' : undefined}
              >
                <option value="">{t('eventClientPlaceholder')}</option>
                {clients.map((c) => (
                  <option key={c._id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
              {fieldErrors.client && (
                <div id="event-client-err" role="alert" style={{ fontSize: '12px', color: 'var(--accent)', marginTop: '6px' }}>
                  {fieldErrors.client}
                </div>
              )}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">{t('notes')}</label>
            <input
              className="form-input"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder={t('eventNotesPlaceholder')}
            />
          </div>
        </div>
        {createMut.isError && (
          <div
            role="alert"
            style={{
              padding: '0 20px 12px',
              fontSize: '13px',
              color: 'var(--accent)',
            }}
          >
            {createMut.error?.message || t('eventSaveFailed')}
          </div>
        )}
        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t('cancel')}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSave}
            disabled={!isTeam || createMut.isPending}
          >
            {createMut.isPending ? '…' : t('save')}
          </button>
        </div>
      </div>
    </div>
  );
}
