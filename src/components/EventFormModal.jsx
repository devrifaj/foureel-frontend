import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLang } from '../context/LangContext';
import { splitDateTimeLocal } from '../utils/eventFormState';

const TYPES = ['Shoot', 'Edit', 'Deadline', 'Call', 'Delivery'];

const errBorder = { borderColor: 'var(--accent)', boxShadow: '0 0 0 1px var(--accent)' };

/**
 * Reusable create / edit event modal (team). Parent owns `form` state via setForm.
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {'create'|'edit'} props.mode
 * @param {object} props.form
 * @param {React.Dispatch<React.SetStateAction<object>>} props.setForm
 * @param {Array<{_id:string,name:string}>} props.clients
 * @param {Array<{_id:string,name:string,initials?:string,email?:string,teamRole?:string}>} props.teamMembers
 * @param {import('@tanstack/react-query').UseMutationResult} props.saveMut create or update mutation
 * @param {boolean} props.isTeam
 */
export default function EventFormModal({
  open,
  onClose,
  mode,
  form,
  setForm,
  clients,
  teamMembers,
  saveMut,
  isTeam,
}) {
  const { t } = useLang();
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    if (!open) return;
    setFieldErrors({});
    // Do not list saveMut in deps: in some RQ versions the mutation object identity churns and would retrigger this effect every render while open.
    saveMut.reset();
  }, [open, mode]);

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
    if (!form.dateTime?.trim()) next.dateTime = t('eventValidationDateTimeRequired');
    if (!form.assigneeId?.trim()) next.assigneeId = t('eventValidationAssigneeRequired');
    if (!form.client?.trim()) next.client = t('eventValidationClientRequired');
    setFieldErrors(next);
    if (Object.keys(next).length) return;

    const { date, time } = splitDateTimeLocal(form.dateTime);
    if (!date) {
      setFieldErrors((prev) => ({ ...prev, dateTime: t('eventValidationDateTimeRequired') }));
      return;
    }

    const clientRow = clients.find((c) => c.name === form.client);
    const body = {
      name: form.name.trim(),
      type: form.type,
      date,
      time: time || '12:00',
      notes: form.notes?.trim() || '',
      client: form.client,
      ...(clientRow?._id && { clientId: clientRow._id }),
      assigneeId: form.assigneeId.trim(),
    };
    saveMut.mutate(body);
  };

  if (!open) return null;

  const title = mode === 'edit' ? t('eventFormTitleEdit') : t('eventFormTitle');

  return createPortal(
    <div className="modal-overlay modal-overlay--portal open" onClick={onClose}>
      <div className="modal event-form-modal" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{title}</div>
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
            />
            {fieldErrors.name && (
              <div role="alert" style={{ fontSize: '12px', color: 'var(--accent)', marginTop: '6px' }}>
                {fieldErrors.name}
              </div>
            )}
          </div>
          <div className="event-type-row" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
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
          <div className="form-group">
            <label className="form-label">{t('eventDateTimeLabel')}</label>
            <input
              type="datetime-local"
              className="form-input"
              value={form.dateTime || ''}
              onChange={(e) => {
                clearError('dateTime');
                setForm((f) => ({ ...f, dateTime: e.target.value }));
              }}
              style={fieldErrors.dateTime ? errBorder : undefined}
              aria-invalid={!!fieldErrors.dateTime}
            />
            {fieldErrors.dateTime && (
              <div role="alert" style={{ fontSize: '12px', color: 'var(--accent)', marginTop: '6px' }}>
                {fieldErrors.dateTime}
              </div>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">{t('eventAssigneeLabel')}</label>
            <select
              className="form-input"
              value={form.assigneeId || ''}
              onChange={(e) => {
                clearError('assigneeId');
                setForm((f) => ({ ...f, assigneeId: e.target.value }));
              }}
              style={fieldErrors.assigneeId ? errBorder : undefined}
              aria-invalid={!!fieldErrors.assigneeId}
              required
            >
              <option value="">{t('eventAssigneePlaceholder')}</option>
              {teamMembers.map((m) => (
                <option key={m._id} value={m._id}>
                  {m.name}
                  {m.teamRole ? ` — ${m.teamRole}` : ''}
                </option>
              ))}
            </select>
            {fieldErrors.assigneeId && (
              <div role="alert" style={{ fontSize: '12px', color: 'var(--accent)', marginTop: '6px' }}>
                {fieldErrors.assigneeId}
              </div>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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
              >
                <option value="">{t('eventClientPlaceholder')}</option>
                {clients.map((c) => (
                  <option key={c._id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
              {fieldErrors.client && (
                <div role="alert" style={{ fontSize: '12px', color: 'var(--accent)', marginTop: '6px' }}>
                  {fieldErrors.client}
                </div>
              )}
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
        </div>
        {saveMut.isError && (
          <div role="alert" style={{ padding: '0 20px 12px', fontSize: '13px', color: 'var(--accent)' }}>
            {saveMut.error?.message || t('eventSaveFailed')}
          </div>
        )}
        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t('cancel')}
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={!isTeam || saveMut.isPending}>
            {saveMut.isPending ? '…' : t('save')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
