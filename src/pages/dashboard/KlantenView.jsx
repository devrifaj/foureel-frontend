// KlantenView.jsx - Client management (Info, Portaal, Retainer, …) — MERN API
import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getClients,
  getClient,
  createClient,
  updateClient,
  deleteClient,
  sendPortalNote,
  getPortalNotes,
  getPortalVideos,
  getBatches,
} from '../../api';
import { useLang } from '../../context/LangContext';

const PHASE_OPTIONS = [
  { value: 'Pre-prod', label: 'Pre-productie' },
  { value: 'Shoot', label: 'Shoot' },
  { value: 'Productie', label: 'Productie' },
  { value: 'Edit', label: 'Edit' },
  { value: 'Nabewerking', label: 'Nabewerking' },
  { value: 'Post', label: 'Post' },
  { value: 'Review', label: 'Review' },
  { value: 'Delivery', label: 'Delivery' },
];

const ACCENT_COLORS = ['#C4522A', '#3A6EA8', '#7A9E7E', '#7A5EA8', '#C8953A', '#5E8A6E', '#E07830'];

function pickColor(seed) {
  const s = String(seed || '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h + s.charCodeAt(i) * (i + 1)) % ACCENT_COLORS.length;
  return ACCENT_COLORS[h];
}

function fmtDate(ds) {
  if (!ds) return '—';
  try {
    const p = ds.split('-');
    return `${parseInt(p[2], 10)} ${['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'][parseInt(p[1], 10) - 1]} ${p[0]}`;
  } catch {
    return ds;
  }
}

const TABS = [
  { id: 'info', label: '👤 Info' },
  { id: 'portaal', label: '🌐 Portaal' },
  { id: 'documenten', label: '📄 Documenten' },
  { id: 'contacten', label: '👥 Contacten' },
  { id: 'retainer', label: '💼 Retainer' },
  { id: 'vragenlijst', label: '📋 Vragenlijst' },
];

function RetainerTab({ client, onSave }) {
  const [r, setR] = useState(client.retainer || {});
  useEffect(() => {
    setR(client.retainer || {});
  }, [client._id, client.retainer]);

  const save = (key, val) => {
    const updated = { ...r, [key]: val };
    setR(updated);
    onSave({ retainer: updated });
  };

  const statuses = ['actief', 'gepauzeerd', 'opgezegd', 'concept'];
  const status = r.status || '';

  const bannerBg =
    status === 'actief' ? 'var(--sage-light)' : status ? 'var(--amber-light)' : 'var(--bg-alt)';
  const bannerBorder =
    status === 'actief' ? 'var(--sage)' : status ? 'var(--amber)' : 'var(--border)';
  const statusIcon =
    status === 'actief' ? '✅' : status === 'gepauzeerd' ? '⏸️' : status === 'opgezegd' ? '❌' : '📋';

  const field = (key, label, ph) => (
    <div key={key}>
      <label
        style={{
          fontSize: '10px',
          fontWeight: '700',
          letterSpacing: '.08em',
          textTransform: 'uppercase',
          color: 'var(--text-3)',
          display: 'block',
          marginBottom: '4px',
        }}
      >
        {label}
      </label>
      <input
        key={`${client._id}-${key}`}
        defaultValue={r[key] || ''}
        placeholder={ph}
        onBlur={(e) => save(key, e.target.value)}
        style={{
          width: '100%',
          padding: '9px 12px',
          border: '1.5px solid var(--border)',
          borderRadius: '8px',
          fontFamily: 'DM Sans,sans-serif',
          fontSize: '13px',
          color: 'var(--text)',
          background: 'var(--bg-alt)',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
    </div>
  );

  return (
    <div>
      <div
        className="retainer-status-banner"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '14px 18px',
          borderRadius: '10px',
          marginBottom: '20px',
          background: bannerBg,
          border: `1.5px solid ${bannerBorder}`,
        }}
      >
        <span style={{ fontSize: '20px' }}>{statusIcon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'Montserrat', fontSize: '14px', fontWeight: '600' }}>
            {r.pakket || 'Geen retainer ingesteld'}
          </div>
          {r.prijs && (
            <div style={{ fontSize: '13px', color: 'var(--text-2)', marginTop: '2px' }}>
              {r.prijs} · {r.periode}
            </div>
          )}
        </div>
        <select
          className="retainer-status-select"
          value={r.status || 'concept'}
          onChange={(e) => save('status', e.target.value)}
          style={{
            padding: '6px 10px',
            border: '1.5px solid var(--border)',
            borderRadius: '7px',
            fontFamily: 'inherit',
            fontSize: '12px',
            fontWeight: '700',
            outline: 'none',
          }}
        >
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '16px',
          marginBottom: '16px',
        }}
      >
        {field('pakket', '📦 Pakketnaam', 'bijv. Social Media Retainer M')}
        {field('prijs', '💰 Prijs', 'bijv. € 1.450')}
        {field('periode', '🔁 Betalingsperiode', 'bijv. Maandelijks')}
        {field('betaalmethode', '💳 Betaalmethode', 'bijv. Automatische incasso')}
        {field('startdatum', '📅 Startdatum', 'JJJJ-MM-DD')}
        {field('einddatum', '📅 Einddatum', 'Leeg = doorlopend')}
        {field('looptijd', '⏱ Looptijd', 'bijv. 12 maanden')}
      </div>
      <div
        style={{
          background: 'var(--bg-alt)',
          borderRadius: '10px',
          padding: '16px 18px',
          marginBottom: '16px',
          border: '1.5px solid var(--border)',
        }}
      >
        <div
          style={{
            fontSize: '10px',
            fontWeight: '700',
            letterSpacing: '.08em',
            textTransform: 'uppercase',
            color: 'var(--text-3)',
            marginBottom: '12px',
          }}
        >
          🎬 Deliverables
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
          {field('shoots', '📷 Shoots', 'bijv. 2 shoots/maand')}
          {field('videos', '🎬 Videos', 'bijv. 8 reels/maand')}
        </div>
        <div style={{ marginTop: '10px' }}>{field('extras', '➕ Extra deliverables', 'bijv. Stories, BTS')}</div>
      </div>
      <div style={{ marginBottom: '8px' }}>
        <label
          style={{
            fontSize: '10px',
            fontWeight: '700',
            letterSpacing: '.08em',
            textTransform: 'uppercase',
            color: 'var(--text-3)',
            display: 'block',
            marginBottom: '6px',
          }}
        >
          📝 Interne notities
        </label>
        <textarea
          key={`ret-notes-${client._id}`}
          defaultValue={r.notities || ''}
          placeholder="Contractnotities, afspraken, verlengingen..."
          onBlur={(e) => save('notities', e.target.value)}
          style={{
            width: '100%',
            minHeight: '72px',
            padding: '10px 12px',
            border: '1.5px solid var(--border)',
            borderRadius: '8px',
            fontFamily: "'DM Sans',sans-serif",
            fontSize: '13px',
            color: 'var(--text)',
            background: 'var(--bg-alt)',
            outline: 'none',
            resize: 'vertical',
            lineHeight: 1.6,
            boxSizing: 'border-box',
          }}
        />
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 16px',
          background: 'var(--bg-alt)',
          borderRadius: '8px',
          border: '1px solid var(--border)',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: '16px' }}>🌐</span>
        <div style={{ flex: 1, fontSize: '13px', color: 'var(--text-2)' }}>
          Retainergegevens zichtbaar in klantportaal
        </div>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '500',
          }}
        >
          <input
            type="checkbox"
            checked={!!r.zichtbaarInPortaal}
            onChange={(e) => save('zichtbaarInPortaal', e.target.checked)}
            style={{ width: '16px', height: '16px', accentColor: 'var(--accent)' }}
          />
          Toon in portaal
        </label>
      </div>
    </div>
  );
}

function countDeliveredForClient(batches, clientId) {
  const id = String(clientId);
  return batches
    .filter((b) => String(b.clientId) === id)
    .flatMap((b) => b.videos || [])
    .filter((v) => v.approved).length;
}

function PortaalTab({ client }) {
  const [reply, setReply] = useState('');
  const qc = useQueryClient();
  const { data: notes = [] } = useQuery({
    queryKey: ['portalNotes', client._id],
    queryFn: () => getPortalNotes(client._id),
    refetchInterval: 8000,
  });
  const { data: reviewVideos = [] } = useQuery({
    queryKey: ['portalVideos', client._id],
    queryFn: () => getPortalVideos(client._id),
    refetchInterval: 8000,
  });
  const { data: batches = [] } = useQuery({ queryKey: ['batches'], queryFn: getBatches });

  const clientMsgs = notes.filter((n) => n.from === 'client');
  const delivered = useMemo(() => countDeliveredForClient(batches, client._id), [batches, client._id]);

  const sendMut = useMutation({
    mutationFn: () => sendPortalNote(client._id, reply),
    onSuccess: () => {
      setReply('');
      qc.invalidateQueries({ queryKey: ['portalNotes', client._id] });
    },
  });

  const submitReply = () => {
    if (reply.trim()) sendMut.mutate();
  };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        {[
          [clientMsgs.length, 'Berichten van klant', 'var(--accent)'],
          [reviewVideos.length, 'In review', 'var(--blue)'],
          [delivered, "Video's opgeleverd", 'var(--sage)'],
        ].map(([n, l, c]) => (
          <div
            key={l}
            style={{
              background: 'var(--bg-alt)',
              borderRadius: '9px',
              padding: '14px 16px',
              textAlign: 'center',
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ fontFamily: 'Montserrat', fontSize: '26px', fontWeight: '700', color: c }}>{n}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '3px' }}>{l}</div>
          </div>
        ))}
      </div>
      {client.portalEmail ? (
        <div
          style={{
            background: 'var(--bg-alt)',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '20px',
            border: '1px dashed var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: '18px' }}>🔑</span>
          <div style={{ fontSize: '13px', color: 'var(--text-2)', flex: 1, minWidth: '200px' }}>
            Portaal login: <strong>{client.portalEmail}</strong>
            <span style={{ color: 'var(--text-3)', marginLeft: '8px' }}>(wachtwoord beveiligd opgeslagen)</span>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => window.open('/portaal', '_blank')}
            style={{ background: 'var(--sidebar)', color: 'white', borderColor: 'var(--sidebar)' }}
          >
            🌐 Portaal bekijken
          </button>
        </div>
      ) : (
        <div
          style={{
            background: 'var(--bg-alt)',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '20px',
            border: '1px dashed var(--border)',
            fontSize: '13px',
            color: 'var(--text-3)',
          }}
        >
          Geen portaalaccount gekoppeld aan deze klant.
        </div>
      )}
      {reviewVideos.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <div
            style={{
              fontSize: '10px',
              fontWeight: '700',
              letterSpacing: '.08em',
              textTransform: 'uppercase',
              color: 'var(--text-3)',
              marginBottom: '10px',
            }}
          >
            🎬 Video&apos;s ter beoordeling door klant
          </div>
            {reviewVideos.map((v) => {
            const statusColor = v.revision ? 'var(--amber)' : 'var(--blue)';
            const statusLabel = v.revision ? '✏️ Revisie aangevraagd' : '⏳ Wacht op reactie';
            const vid = v._id || v.id;
            return (
              <div
                key={vid ? String(vid) : `${v.batchId}-${v.name}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: 'var(--bg-alt)',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  marginBottom: '6px',
                  gap: '8px',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: '500' }}>{v.name}</div>
                  {v.revisionNote && (
                    <div style={{ fontSize: '11px', color: 'var(--amber)', marginTop: '3px' }}>💬 {v.revisionNote}</div>
                  )}
                </div>
                <span style={{ fontSize: '11px', fontWeight: '700', color: statusColor, whiteSpace: 'nowrap', marginLeft: '12px' }}>
                  {statusLabel}
                </span>
              </div>
            );
          })}
        </div>
      )}
      <div style={{ marginBottom: '16px' }}>
        <div
          style={{
            fontSize: '10px',
            fontWeight: '700',
            letterSpacing: '.08em',
            textTransform: 'uppercase',
            color: 'var(--text-3)',
            marginBottom: '12px',
          }}
        >
          💬 Berichten & notities
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            maxHeight: '320px',
            overflowY: 'auto',
            marginBottom: '12px',
            paddingRight: '4px',
          }}
        >
          {notes.length === 0 ? (
            <div style={{ fontSize: '13px', color: 'var(--text-3)', fontStyle: 'italic', padding: '8px 0' }}>
              Nog geen berichten uitgewisseld.
            </div>
          ) : (
            notes.map((n) => (
              <div key={n._id} style={{ display: 'flex', justifyContent: n.from === 'client' ? 'flex-start' : 'flex-end', gap: '8px' }}>
                {n.from === 'client' && (
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      background: client.color || 'var(--accent)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: 'Montserrat,sans-serif',
                      fontSize: '10px',
                      fontWeight: '700',
                      color: 'white',
                      flexShrink: 0,
                      marginTop: '2px',
                    }}
                  >
                    {client.name
                      .split(' ')
                      .map((w) => w[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                )}
                <div
                  style={{
                    maxWidth: '75%',
                    background: n.from === 'client' ? 'white' : '#EFF4FF',
                    border: `1px solid ${n.from === 'client' ? 'var(--border)' : '#C8D8FF'}`,
                    borderRadius: n.from === 'client' ? '4px 12px 12px 12px' : '12px 4px 12px 12px',
                    padding: '10px 14px',
                  }}
                >
                  <div
                    style={{
                      fontSize: '10px',
                      fontWeight: '700',
                      color: n.from === 'client' ? 'var(--accent)' : 'var(--blue)',
                      marginBottom: '4px',
                    }}
                  >
                    {n.author} · {new Date(n.createdAt).toLocaleDateString('nl-NL')}
                  </div>
                  <div style={{ fontSize: '13px', lineHeight: 1.5 }}>{n.text}</div>
                </div>
              </div>
            ))
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submitReply();
              }
            }}
            placeholder={`Antwoord sturen naar ${client.name}…`}
            rows={2}
            style={{
              flex: 1,
              padding: '10px 12px',
              border: '1.5px solid var(--border)',
              borderRadius: '9px',
              fontFamily: 'DM Sans,sans-serif',
              fontSize: '13px',
              resize: 'none',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <button
            type="button"
            className="btn btn-primary"
            onClick={submitReply}
            disabled={!reply.trim() || sendMut.isPending}
          >
            Stuur
          </button>
        </div>
      </div>
    </div>
  );
}

const fieldErrStyle = { fontSize: '12px', color: '#c04040', marginTop: '6px', marginBottom: 0, lineHeight: 1.4 };

function AddClientModal({ open, onClose, onSave, saving, lang, serverError, onClearServerError }) {
  const [name, setName] = useState('');
  const [sector, setSector] = useState('');
  const [phase, setPhase] = useState('Pre-prod');
  const [contact, setContact] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [since, setSince] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [urgentReason, setUrgentReason] = useState('');
  const [portalEmail, setPortalEmail] = useState('');
  const [portalPassword, setPortalPassword] = useState('');
  const [nameError, setNameError] = useState('');

  useEffect(() => {
    if (open) {
      setName('');
      setSector('');
      setPhase('Pre-prod');
      setContact('');
      setEmail('');
      setPhone('');
      setSince('');
      setUrgent(false);
      setUrgentReason('');
      setPortalEmail('');
      setPortalPassword('');
      setNameError('');
    }
  }, [open]);

  if (!open) return null;

  const title = lang === 'en' ? 'Add new client' : 'Nieuwe klant toevoegen';

  const clearServerError = () => {
    if (serverError) onClearServerError?.();
  };

  const handleSave = () => {
    if (!name.trim()) {
      setNameError(lang === 'en' ? 'Enter a company name.' : 'Vul een bedrijfsnaam in.');
      return;
    }
    setNameError('');
    onSave({
      name: name.trim(),
      sector: sector.trim() || undefined,
      phase,
      contact: contact.trim() || undefined,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      since: since || undefined,
      urgent,
      urgentReason: urgent ? urgentReason.trim() || undefined : undefined,
      color: pickColor(name),
      portalEmail: portalEmail.trim().toLowerCase() || undefined,
      portalPassword: portalPassword.trim() || undefined,
    });
  };

  return (
    <div className="modal-overlay open" role="dialog" aria-modal="true" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{title}</div>
          <button type="button" className="modal-close" onClick={onClose} aria-label={lang === 'en' ? 'Close' : 'Sluiten'}>
            ✕
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">{lang === 'en' ? 'Company name' : 'Bedrijfsnaam'}</label>
            <input
              className="form-input"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError('');
                clearServerError();
              }}
              placeholder={lang === 'en' ? 'Company name…' : 'Naam van het bedrijf…'}
              aria-invalid={!!nameError}
              aria-describedby={nameError ? 'add-client-name-err' : undefined}
              style={nameError ? { borderColor: '#c04040' } : undefined}
            />
            {nameError && (
              <p id="add-client-name-err" role="alert" style={fieldErrStyle}>
                {nameError}
              </p>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">{lang === 'en' ? 'Sector' : 'Sector'}</label>
            <input
              className="form-input"
              value={sector}
              onChange={(e) => {
                setSector(e.target.value);
                clearServerError();
              }}
              placeholder="bijv. Fitness & Wellness"
            />
          </div>
          <div className="form-group">
            <label className="form-label">{lang === 'en' ? 'Current phase' : 'Huidige fase'}</label>
            <select
              className="form-select"
              value={phase}
              onChange={(e) => {
                setPhase(e.target.value);
                clearServerError();
              }}
            >
              {PHASE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">{lang === 'en' ? 'Contact person' : 'Contactpersoon'}</label>
            <input
              className="form-input"
              value={contact}
              onChange={(e) => {
                setContact(e.target.value);
                clearServerError();
              }}
              placeholder={lang === 'en' ? 'Name' : 'Naam contactpersoon'}
            />
          </div>
          <div className="form-group">
            <label className="form-label">E-mail</label>
            <input
              className="form-input"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                clearServerError();
              }}
              placeholder="email@bedrijf.nl"
            />
          </div>
          <div className="form-group">
            <label className="form-label">{lang === 'en' ? 'Phone' : 'Telefoon'}</label>
            <input
              className="form-input"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                clearServerError();
              }}
              placeholder="06-12345678"
            />
          </div>
          <div className="form-group">
            <label className="form-label">{lang === 'en' ? 'Client since' : 'Klant since'}</label>
            <input
              className="form-input"
              type="date"
              value={since}
              onChange={(e) => {
                setSince(e.target.value);
                clearServerError();
              }}
            />
          </div>
          <div className="form-group">
            <label className="form-label">{lang === 'en' ? 'Portal login email' : 'Portaal login e-mail'}</label>
            <input
              className="form-input"
              type="email"
              value={portalEmail}
              onChange={(e) => {
                setPortalEmail(e.target.value);
                clearServerError();
              }}
              placeholder="client@bedrijf.nl"
            />
          </div>
          <div className="form-group">
            <label className="form-label">{lang === 'en' ? 'Portal login password' : 'Portaal login wachtwoord'}</label>
            <input
              className="form-input"
              type="password"
              value={portalPassword}
              onChange={(e) => {
                setPortalPassword(e.target.value);
                clearServerError();
              }}
              placeholder={lang === 'en' ? 'Set initial password' : 'Stel initieel wachtwoord in'}
            />
          </div>
        </div>
        <hr className="form-divider" />
        <div className="toggle-row">
          <span className="toggle-label">{lang === 'en' ? 'Urgent — requires immediate attention' : 'Urgent — vereist directe aandacht'}</span>
          <label className="toggle-switch" style={{ position: 'relative' }}>
            {/* Global CSS uses display:none on .toggle-switch input — that breaks label clicks in some cases; overlay an invisible clickable input */}
            <input
              type="checkbox"
              checked={urgent}
              onChange={(e) => {
                setUrgent(e.target.checked);
                clearServerError();
              }}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                margin: 0,
                opacity: 0,
                cursor: 'pointer',
                zIndex: 3,
                display: 'block',
              }}
              aria-label={lang === 'en' ? 'Mark client as urgent' : 'Klant als urgent markeren'}
            />
            <div className="toggle-track" style={{ pointerEvents: 'none' }} />
            <div className="toggle-thumb" style={{ pointerEvents: 'none' }} />
          </label>
        </div>
        <div className="form-group" style={{ marginBottom: urgent ? undefined : 0 }}>
          <label className="form-label">{lang === 'en' ? 'Reason' : 'Reden urgentie'}</label>
          <input
            className="form-input"
            value={urgentReason}
            onChange={(e) => {
              setUrgentReason(e.target.value);
              clearServerError();
            }}
            placeholder={lang === 'en' ? 'e.g. Missed deadline' : 'bijv. Deadline overschreden'}
            disabled={!urgent}
            style={!urgent ? { opacity: 0.55, cursor: 'not-allowed' } : undefined}
          />
          {!urgent && (
            <p style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '8px', marginBottom: 0 }}>
              {lang === 'en'
                ? 'Turn on “Urgent” above to enter a reason.'
                : 'Zet hierboven “Urgent” aan om een reden in te vullen.'}
            </p>
          )}
        </div>
        {serverError && (
          <p
            role="alert"
            style={{
              ...fieldErrStyle,
              marginTop: '12px',
              padding: '10px 12px',
              background: '#FDF2F2',
              borderRadius: '8px',
              border: '1px solid #e8c8c8',
            }}
          >
            {serverError}
          </p>
        )}
        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {lang === 'en' ? 'Cancel' : 'Annuleer'}
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {lang === 'en' ? 'Save client' : 'Klant opslaan'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteClientModal({ open, onClose, onConfirm, deleting, lang, clientName }) {
  if (!open) return null;

  return (
    <div className="modal-overlay open" role="dialog" aria-modal="true" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{lang === 'en' ? 'Delete client' : 'Klant verwijderen'}</div>
          <button type="button" className="modal-close" onClick={onClose} aria-label={lang === 'en' ? 'Close' : 'Sluiten'}>
            ✕
          </button>
        </div>
        <p style={{ fontSize: '14px', color: 'var(--text-2)', marginTop: 0 }}>
          {lang === 'en'
            ? `Permanently delete "${clientName}"? This cannot be undone.`
            : `"${clientName}" permanent verwijderen? Dit kan niet ongedaan worden gemaakt.`}
        </p>
        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={deleting}>
            {lang === 'en' ? 'Cancel' : 'Annuleer'}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onConfirm}
            disabled={deleting}
            style={{ background: '#c04040', borderColor: '#c04040' }}
          >
            {deleting ? (lang === 'en' ? 'Deleting…' : 'Verwijderen…') : lang === 'en' ? 'Delete permanently' : 'Permanent verwijderen'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PortalAccessModal({ open, onClose, onSave, saving, lang, currentEmail, serverError, onClearServerError }) {
  const [portalEmail, setPortalEmail] = useState('');
  const [portalPassword, setPortalPassword] = useState('');

  useEffect(() => {
    if (!open) return;
    setPortalEmail(currentEmail || '');
    setPortalPassword('');
  }, [open, currentEmail]);

  if (!open) return null;

  const save = () => {
    onSave({
      portalEmail: portalEmail.trim().toLowerCase() || undefined,
      portalPassword: portalPassword.trim() || undefined,
    });
  };

  return (
    <div className="modal-overlay open" role="dialog" aria-modal="true" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{lang === 'en' ? 'Portal access' : 'Portaaltoegang'}</div>
          <button type="button" className="modal-close" onClick={onClose} aria-label={lang === 'en' ? 'Close' : 'Sluiten'}>
            ✕
          </button>
        </div>
        <div className="form-group">
          <label className="form-label">{lang === 'en' ? 'Portal login email' : 'Portaal login e-mail'}</label>
          <input
            className="form-input"
            type="email"
            value={portalEmail}
            onChange={(e) => {
              setPortalEmail(e.target.value);
              onClearServerError?.();
            }}
            placeholder="client@bedrijf.nl"
          />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">{lang === 'en' ? 'New password (optional)' : 'Nieuw wachtwoord (optioneel)'}</label>
          <input
            className="form-input"
            type="password"
            value={portalPassword}
            onChange={(e) => {
              setPortalPassword(e.target.value);
              onClearServerError?.();
            }}
            placeholder={lang === 'en' ? 'Only fill to set/reset password' : 'Alleen invullen om wachtwoord te zetten/resetten'}
          />
        </div>
        {serverError && (
          <p role="alert" style={{ ...fieldErrStyle, marginTop: '10px' }}>
            {serverError}
          </p>
        )}
        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {lang === 'en' ? 'Cancel' : 'Annuleer'}
          </button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? (lang === 'en' ? 'Saving…' : 'Opslaan…') : lang === 'en' ? 'Save access' : 'Toegang opslaan'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function KlantenView() {
  const { t, lang } = useLang();
  const [selectedId, setSelectedId] = useState(null);
  const [tab, setTab] = useState('info');
  const [addOpen, setAddOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [portalAccessOpen, setPortalAccessOpen] = useState(false);
  const [addSaveError, setAddSaveError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [portalAccessError, setPortalAccessError] = useState('');
  const qc = useQueryClient();

  const { data: clients = [], isLoading: isClientsLoading } = useQuery({ queryKey: ['clients'], queryFn: getClients });
  const { data: selectedFresh } = useQuery({
    queryKey: ['client', selectedId],
    queryFn: () => getClient(selectedId),
    enabled: !!selectedId,
  });

  const selected = selectedFresh || clients.find((c) => c._id === selectedId) || null;

  const updateMut = useMutation({
    mutationFn: ({ id, ...d }) => updateClient(id, d),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      qc.invalidateQueries({ queryKey: ['client', data._id] });
    },
  });

  const createMut = useMutation({
    mutationFn: createClient,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      setAddSaveError('');
      setAddOpen(false);
    },
    onError: (e) =>
      setAddSaveError(e.message || (lang === 'en' ? 'Could not save client.' : 'Klant kon niet worden opgeslagen.')),
  });

  const deleteMut = useMutation({
    mutationFn: deleteClient,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      setDeleteError('');
      setDeleteOpen(false);
      setSelectedId(null);
    },
    onError: (e) =>
      setDeleteError(e.message || (lang === 'en' ? 'Could not delete client.' : 'Klant kon niet worden verwijderd.')),
  });

  const portalAccessMut = useMutation({
    mutationFn: ({ id, ...d }) => updateClient(id, d),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      qc.invalidateQueries({ queryKey: ['client', data._id] });
      setPortalAccessError('');
      setPortalAccessOpen(false);
    },
    onError: (e) =>
      setPortalAccessError(
        e.message || (lang === 'en' ? 'Could not save portal access.' : 'Portaaltoegang kon niet worden opgeslagen.'),
      ),
  });

  const subtitle =
    lang === 'en'
      ? `${clients.length} active client relationship${clients.length === 1 ? '' : 's'}`
      : `${clients.length} actieve klantrelatie${clients.length === 1 ? '' : 's'}`;

  const openDetail = (c) => {
    setSelectedId(c._id);
    setTab('info');
  };

  const backToList = () => {
    setDeleteError('');
    setDeleteOpen(false);
    setPortalAccessError('');
    setPortalAccessOpen(false);
    setSelectedId(null);
  };

  const saveClient = (data) => {
    if (!selected) return;
    updateMut.mutate({ id: selected._id, ...data });
  };

  const deleteCurrent = () => {
    if (!selected) return;
    setDeleteError('');
    setDeleteOpen(true);
  };

  const confirmDeleteCurrent = () => {
    if (!selected) return;
    deleteMut.mutate(selected._id);
  };

  const openPortalAccess = () => {
    setPortalAccessError('');
    setPortalAccessOpen(true);
  };

  const addModal = (
    <AddClientModal
      open={addOpen}
      onClose={() => {
        setAddSaveError('');
        setAddOpen(false);
      }}
      onSave={(payload) => createMut.mutate(payload)}
      saving={createMut.isPending}
      lang={lang}
      serverError={addSaveError}
      onClearServerError={() => setAddSaveError('')}
    />
  );

  if (selected) {
    const c = selected;
    const initials = c.name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

    return (
      <>
        <section className="view active" id="view-klanten">
        <div className="client-detail active">
          <div
            className="klanten-detail-toolbar"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: deleteError ? '10px' : '20px',
              gap: '10px',
              flexWrap: 'wrap',
            }}
          >
            <button type="button" className="btn btn-ghost btn-sm" onClick={backToList}>
              ← {lang === 'en' ? 'Back to overview' : 'Terug naar overzicht'}
            </button>
            <div className="klanten-detail-toolbar-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={openPortalAccess}
                style={{ borderColor: 'var(--border)' }}
              >
                🔐 {c.portalEmail ? (lang === 'en' ? 'Portal access' : 'Portaaltoegang') : (lang === 'en' ? 'Set portal access' : 'Portaaltoegang instellen')}
              </button>
              {c.portalEmail ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => window.open('/portaal', '_blank')}
                  style={{ background: 'var(--sidebar)', color: 'white', borderColor: 'var(--sidebar)' }}
                >
                  🌐 {lang === 'en' ? 'View portal' : 'Portaal bekijken'}
                </button>
              ) : null}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={deleteCurrent}
                style={{ color: '#c04040', borderColor: '#e8c8c8' }}
              >
                {t('delete')}
              </button>
            </div>
          </div>
          {deleteError && (
            <p role="alert" style={{ ...fieldErrStyle, marginBottom: '16px' }}>
              {deleteError}
            </p>
          )}
          <div className="detail-card">
            <div className="detail-header">
              <div className="detail-logo" style={{ background: c.color || 'var(--accent)' }}>
                {initials}
              </div>
              <div style={{ flex: 1 }}>
                <div className="detail-title">{c.name}</div>
                <div className="detail-sector">{c.sector || '—'}</div>
                {c.urgent && (
                  <div className="urgent-badge" style={{ marginTop: '8px', display: 'inline-flex' }}>
                    ⚠ {c.urgentReason || (lang === 'en' ? 'Urgent' : 'Urgent')}
                  </div>
                )}
              </div>
            </div>
            <div className="tabs klanten-tabs" style={{ marginBottom: '24px' }}>
              {TABS.map((tb) => (
                <button
                  key={tb.id}
                  type="button"
                  className={`tab-btn${tab === tb.id ? ' active' : ''}`}
                  onClick={() => setTab(tb.id)}
                >
                  {tb.id === 'portaal' ? <PortaalTabLabel clientId={c._id} baseLabel={tb.label} /> : tb.label}
                </button>
              ))}
            </div>
            {tab === 'info' && (
              <div>
                <div className="detail-grid">
                  {[
                    [t('contact'), c.contact],
                    ['E-mail', c.portalEmail || c.email],
                    [t('phone'), c.phone],
                    [t('clientSince'), fmtDate(c.since)],
                    [t('phase'), c.phase],
                    [
                      t('statusLabel'),
                      <span key="st" style={{ color: c.urgent ? 'var(--orange)' : 'var(--sage)' }}>
                        {c.urgent ? t('urgentStatus') : t('active')}
                      </span>,
                    ],
                  ].map(([l, v]) => (
                    <div key={l} className="detail-field">
                      <label>{l}</label>
                      <p>{v ?? '—'}</p>
                    </div>
                  ))}
                </div>
                <div className="detail-notes">
                  <strong
                    style={{
                      display: 'block',
                      marginBottom: '6px',
                      fontSize: '11px',
                      letterSpacing: '.08em',
                      textTransform: 'uppercase',
                      color: 'var(--text-3)',
                    }}
                  >
                    {t('notes')}
                  </strong>
                  <p style={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.6 }}>
                    {typeof c.notes === 'string' && c.notes.trim() ? c.notes : lang === 'en' ? 'No notes yet.' : 'Geen notities beschikbaar.'}
                  </p>
                </div>
              </div>
            )}
            {tab === 'portaal' && <PortaalTab client={c} />}
            {tab === 'retainer' && <RetainerTab client={c} onSave={saveClient} />}
            {tab === 'contacten' && (
              <div style={{ padding: '12px 0' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    padding: '14px 0',
                    borderBottom: '1px solid var(--border)',
                    flexWrap: 'wrap',
                  }}
                >
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: c.color || 'var(--accent)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: 'Montserrat',
                      fontSize: '14px',
                      fontWeight: '700',
                      color: 'white',
                    }}
                  >
                    {(c.contact && c.contact[0]) || '?'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: '500' }}>
                      {c.contact || '—'}{' '}
                      <span
                        style={{
                          background: 'var(--accent-pale)',
                          color: 'var(--accent)',
                          fontSize: '10px',
                          fontWeight: '700',
                          padding: '2px 7px',
                          borderRadius: '10px',
                        }}
                      >
                        Primair
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '3px' }}>
                      📧 {c.email || '—'} · 📱 {c.phone || '—'}
                    </div>
                  </div>
                  {c.email && (
                    <a href={`mailto:${c.email}`} className="btn btn-ghost btn-sm">
                      E-mail
                    </a>
                  )}
                </div>
              </div>
            )}
            {(tab === 'documenten' || tab === 'vragenlijst') && (
              <div style={{ fontSize: '13px', color: 'var(--text-3)', fontStyle: 'italic', padding: '12px 0' }}>
                {tab === 'documenten'
                  ? lang === 'en'
                    ? 'Documents will appear here once added.'
                    : 'Documenten worden hier getoond zodra ze worden toegevoegd.'
                  : lang === 'en'
                    ? 'Not filled in for this client yet.'
                    : 'Nog niet ingevuld voor deze klant.'}
              </div>
            )}
          </div>
        </div>
        </section>
        {addModal}
        <DeleteClientModal
          open={deleteOpen}
          onClose={() => setDeleteOpen(false)}
          onConfirm={confirmDeleteCurrent}
          deleting={deleteMut.isPending}
          lang={lang}
          clientName={selected?.name || ''}
        />
        <PortalAccessModal
          open={portalAccessOpen}
          onClose={() => setPortalAccessOpen(false)}
          onSave={(payload) => portalAccessMut.mutate({ id: selected?._id, ...payload })}
          saving={portalAccessMut.isPending}
          lang={lang}
          currentEmail={selected?.portalEmail || ''}
          serverError={portalAccessError}
          onClearServerError={() => setPortalAccessError('')}
        />
      </>
    );
  }

  return (
    <>
    <section className="view active" id="view-klanten">
      <div className="page-header">
        <div>
          <div className="page-title">
            {lang === 'en' ? (
              <>
                Clients <em>— Overview</em>
              </>
            ) : (
              <>
                Klanten <em>— Overzicht</em>
              </>
            )}
          </div>
          <div className="page-subtitle">{subtitle}</div>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setAddSaveError('');
            setAddOpen(true);
          }}
        >
          + {lang === 'en' ? 'Add client' : 'Klant toevoegen'}
        </button>
      </div>
      <div className="client-list-wrap">
        <div className="client-list">
          {isClientsLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div
                key={`client-skeleton-${i}`}
                className="client-row"
                aria-hidden="true"
                style={{
                  pointerEvents: 'none',
                  opacity: 0.9,
                }}
              >
                <div
                  className="client-num"
                  style={{
                    width: '24px',
                    height: '12px',
                    borderRadius: '6px',
                    background: 'linear-gradient(90deg, #eef2f7 25%, #f7f9fc 37%, #eef2f7 63%)',
                    backgroundSize: '400% 100%',
                    animation: 'clientSkeletonShimmer 1.4s ease infinite',
                    color: 'transparent',
                  }}
                >
                  00
                </div>
                <div
                  className="client-name"
                  style={{
                    width: `${40 + (i % 3) * 18}%`,
                    minWidth: '140px',
                    height: '14px',
                    borderRadius: '7px',
                    background: 'linear-gradient(90deg, #eef2f7 25%, #f7f9fc 37%, #eef2f7 63%)',
                    backgroundSize: '400% 100%',
                    animation: 'clientSkeletonShimmer 1.4s ease infinite',
                    color: 'transparent',
                  }}
                >
                  loading
                </div>
              </div>
            ))
          ) : clients.length === 0 ? (
            <div style={{ padding: '28px', textAlign: 'center', color: 'var(--text-3)', fontStyle: 'italic' }}>
              {lang === 'en' ? 'No clients yet. Add one to get started.' : 'Nog geen klanten. Voeg er een toe om te beginnen.'}
            </div>
          ) : (
            clients.map((c, i) => (
              <div key={c._id} className="client-row" onClick={() => openDetail(c)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && openDetail(c)}>
                <div className="client-num">{String(i + 1).padStart(2, '0')}</div>
                <div className="client-name">{c.name}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
    <style>{`
      @keyframes clientSkeletonShimmer {
        0% {
          background-position: 100% 50%;
        }
        100% {
          background-position: 0 50%;
        }
      }
    `}</style>
    {addModal}
    </>
  );
}

function PortaalTabLabel({ clientId, baseLabel }) {
  const { data: notes = [] } = useQuery({
    queryKey: ['portalNotes', clientId],
    queryFn: () => getPortalNotes(clientId),
    refetchInterval: 10000,
  });
  const count = notes.filter((n) => n.from === 'client').length;
  return (
    <>
      {baseLabel}
      {count > 0 && (
        <span
          style={{
            background: 'var(--accent)',
            color: 'white',
            fontSize: '9px',
            fontWeight: '700',
            padding: '1px 6px',
            borderRadius: '10px',
            marginLeft: '4px',
          }}
        >
          {count}
        </span>
      )}
    </>
  );
}

