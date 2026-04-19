import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { DASHBOARD_BASE } from '../../paths';
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../context/LangContext';
import { getPulse, getClients, getTeamMembers, createEvent } from '../../api';
import EventFormModal from '../../components/EventFormModal';
import { emptyEventForm, joinDateAndTimeForLocalInput } from '../../utils/eventFormState';

function todayISODate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const AVATAR_FALLBACK_PALETTE = [
  'var(--accent)',
  'var(--sage)',
  'var(--blue)',
  'var(--amber)',
  'var(--purple)',
  'var(--text-3)',
];

function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h << 5) - h + s.charCodeAt(i);
  return Math.abs(h);
}

function getAvatarColor(member, displayName) {
  const custom = typeof member?.color === 'string' && member.color.trim();
  if (custom) return member.color.trim();
  const key = displayName || '?';
  return AVATAR_FALLBACK_PALETTE[hashString(key) % AVATAR_FALLBACK_PALETTE.length];
}

function getAvatarInitial(member, displayName) {
  const ini = typeof member?.initials === 'string' && member.initials.trim();
  if (ini) return ini.slice(0, 3).toUpperCase();
  const parts = (displayName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (displayName || '?')[0]?.toUpperCase() || '?';
}

/** Merge team users with any batch `editor` names not in the team list (case-insensitive). */
function buildPulseTeamRows(teamMembers = [], editorLoad = {}) {
  const loadByLower = new Map();
  for (const [k, v] of Object.entries(editorLoad)) {
    if (!k || typeof k !== 'string') continue;
    loadByLower.set(k.trim().toLowerCase(), { active: v?.active || 0, reviewing: v?.reviewing || 0 });
  }
  const consumedLower = new Set();
  const rows = [];
  const sortedMembers = [...teamMembers].sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
  for (const m of sortedMembers) {
    const L = (m.name || '').trim().toLowerCase();
    const load = L && loadByLower.has(L) ? loadByLower.get(L) : { active: 0, reviewing: 0 };
    if (L && loadByLower.has(L)) consumedLower.add(L);
    rows.push({ member: m, name: m.name || '—', load });
  }
  for (const [k, v] of Object.entries(editorLoad)) {
    const L = k.trim().toLowerCase();
    if (!L || consumedLower.has(L)) continue;
    rows.push({ member: null, name: k.trim(), load: { active: v?.active || 0, reviewing: v?.reviewing || 0 } });
  }
  rows.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  return rows;
}

function kpiCard(reactKey, icon, label, value, sub, color) {
  return (
    <div className="pulse-card" key={reactKey}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-3)' }}>
          {label}
        </div>
        <div style={{ fontSize: 20 }}>{icon}</div>
      </div>
      <div style={{ fontFamily: 'Montserrat', fontSize: 32, fontWeight: 700, color }}>{value}</div>
      {sub ? <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>{sub}</div> : null}
    </div>
  );
}

function capacityMeter(pct, t) {
  const color = pct > 85 ? '#E05050' : pct > 60 ? 'var(--amber)' : pct < 30 ? 'var(--blue)' : 'var(--sage)';
  const label =
    pct > 85
      ? t('pulseCapacityAlmostFull')
      : pct > 60
        ? t('pulseCapacityGood')
        : pct < 30
          ? t('pulseCapacityRoom')
          : t('pulseCapacityHealthy');
  const r = 40;
  const circumference = Math.PI * r;
  const offset = circumference * (1 - pct / 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 8 }}>
      <svg width="120" height="70" viewBox="0 0 120 70">
        <path d="M 20 60 A 40 40 0 0 1 100 60" fill="none" stroke="var(--border)" strokeWidth="10" strokeLinecap="round" />
        <path
          d="M 20 60 A 40 40 0 0 1 100 60"
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset .6s ease' }}
        />
        <text x="60" y="56" textAnchor="middle" fontFamily="Montserrat, sans-serif" fontSize="18" fontWeight="700" fill={color}>
          {pct}%
        </text>
      </svg>
      <div style={{ fontSize: 12, fontWeight: 600, color, marginTop: -4 }}>{label}</div>
    </div>
  );
}

export default function PulseView() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLang();
  const isTeam = user?.role === 'team';
  const qc = useQueryClient();
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [form, setForm] = useState(emptyEventForm);

  const {
    data: pulse,
    isLoading,
    refetch,
    isError,
    error: pulseError,
  } = useQuery({
    queryKey: ['pulse'],
    queryFn: getPulse,
    refetchInterval: 30000,
    enabled: isTeam,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: getClients,
    enabled: isTeam,
  });
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team'],
    queryFn: getTeamMembers,
    enabled: isTeam,
  });

  const saveEventMut = useMutation({
    mutationFn: (body) => {
      if (!isTeam) return Promise.reject(new Error(t('eventCreateForbidden')));
      return createEvent(body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events'] });
      qc.invalidateQueries({ queryKey: ['pulse'] });
      qc.invalidateQueries({ queryKey: ['activity'] });
      setEventModalOpen(false);
      setForm(emptyEventForm());
    },
  });

  const openEventModal = () => {
    setForm({ ...emptyEventForm(), dateTime: joinDateAndTimeForLocalInput(todayISODate(), '12:00') });
    setEventModalOpen(true);
  };

  const closeEventModal = () => {
    setEventModalOpen(false);
    setForm(emptyEventForm());
  };

  if (!isTeam) {
    return (
      <section className="view active">
        <div style={{ padding: '40px', color: 'var(--text-3)' }}>{t('pulseTeamOnly')}</div>
      </section>
    );
  }
  if (isLoading) {
    return (
      <section className="view active">
        <div style={{ padding: '40px', color: 'var(--text-3)' }}>{t('teamLoading')}</div>
      </section>
    );
  }
  if (isError || !pulse) {
    return (
      <section className="view active">
        <div style={{ padding: '40px', color: 'var(--text-3)' }}>
          {pulseError?.message || t('pulseLoadError')}
        </div>
      </section>
    );
  }

  const deliveredSubBase = t('pulseKpiDeliveredSubMonth', { delivered: pulse.deliveredMonth || 0 });
  const deliveredSub =
    typeof pulse.openTasks === 'number'
      ? deliveredSubBase + t('pulseKpiDeliveredSubTasksSuffix', { openTasks: pulse.openTasks })
      : deliveredSubBase;

  const kpis = [
    {
      id: 'batches',
      icon: '🎬',
      label: t('pulseKpiBatchesActive'),
      value: pulse.batchesActive || 0,
      sub:
        typeof pulse.totalClients === 'number'
          ? t(pulse.totalClients === 1 ? 'pulseKpiClientsSubOne' : 'pulseKpiClientsSubMany', {
              n: pulse.totalClients,
            })
          : '',
      color: 'var(--accent)',
    },
    {
      id: 'videos',
      icon: '📹',
      label: t('pulseKpiVideosPipeline'),
      value: pulse.totalVideos || 0,
      sub: t('pulseKpiNotStartedSub', { n: pulse.notStarted || 0 }),
      color: 'var(--blue)',
    },
    {
      id: 'shoots',
      icon: '📅',
      label: t('pulseKpiShootsPlanned'),
      value: pulse.shootsPlanned || 0,
      sub: t('pulseKpiThisMonthSub', { n: pulse.shootsThisMonth || 0 }),
      color: 'var(--sage)',
    },
    {
      id: 'delivered',
      icon: '📦',
      label: t('pulseKpiDeliveredEver'),
      value: pulse.finished || 0,
      sub: deliveredSub,
      color: 'var(--purple)',
    },
  ];

  const pipelineStages = [
    { id: 'notStarted', label: t('pulseStageNotStarted'), value: pulse.notStarted || 0, color: 'var(--border)' },
    { id: 'inEdit', label: t('pulseStageInEdit'), value: pulse.inEdit || 0, color: 'var(--amber)' },
    { id: 'inReview', label: t('pulseStageInReview'), value: pulse.inReview || 0, color: 'var(--blue)' },
    { id: 'delivered', label: t('pulseStageDelivered'), value: pulse.finished || 0, color: 'var(--sage)' },
  ];
  const maxStage = Math.max(1, ...pipelineStages.map((s) => s.value));

  const editorLoad = pulse.editorLoad || {};
  const teamRows = buildPulseTeamRows(teamMembers, editorLoad);
  const totalActive = Object.values(editorLoad).reduce((sum, load) => sum + (load?.reviewing || 0), 0);
  const headcount = Math.max(teamRows.length, 1);
  const maxCapacity = headcount * 3;
  const workloadPct = Math.min(100, Math.round((totalActive / Math.max(maxCapacity, 1)) * 100));
  const maxReviewingOnTeam = Math.max(1, ...teamRows.map((r) => r.load?.reviewing || 0), 5);

  const smartAlerts = [];
  (pulse.urgentDeadlines || []).forEach((d) => {
    const title =
      d.days === 0
        ? t('pulseAlertDeadlineToday', { name: d.name })
        : d.days === 1
          ? t('pulseAlertDeadlineOneDay', { name: d.name })
          : t('pulseAlertDeadlineDays', { days: d.days, name: d.name });
    const desc = t(d.open > 1 ? 'pulseAlertDeadlineVideosMany' : 'pulseAlertDeadlineVideosOne', {
      open: d.open,
      client: d.client || t('pulseThisClient'),
    });
    smartAlerts.push({
      type: d.days <= 2 ? 'red' : 'orange',
      icon: '⏰',
      title,
      desc,
      action: t('pulseAlertDeadlineAction', { target: d.client || d.name }),
    });
  });

  if (workloadPct < 30) {
    smartAlerts.push({
      type: 'blue',
      icon: '📈',
      title: t('pulseAlertLowWorkloadTitle'),
      desc: t('pulseAlertLowWorkloadDesc', { pct: workloadPct }),
      action: t('pulseAlertLowWorkloadAction', {
        n: Math.max(0, Math.floor((maxCapacity - totalActive) / 3)),
      }),
    });
  } else if (workloadPct > 85) {
    smartAlerts.push({
      type: 'red',
      icon: '🔥',
      title: t('pulseAlertHighWorkloadTitle', { pct: workloadPct }),
      desc: t('pulseAlertHighWorkloadDesc'),
      action: t('pulseAlertHighWorkloadAction'),
    });
  }

  if ((pulse.inReview || 0) > 3) {
    smartAlerts.push({
      type: 'orange',
      icon: '👁',
      title: t('pulseAlertReviewTitle', { n: pulse.inReview }),
      desc: t('pulseAlertReviewDesc'),
      action: t('pulseAlertReviewAction'),
    });
  }

  if ((pulse.shootsPlanned || 0) < 2) {
    smartAlerts.push({
      type: 'blue',
      icon: '📷',
      title: t('pulseAlertShootsLowTitle', { n: pulse.shootsPlanned || 0 }),
      desc: t('pulseAlertShootsLowDesc'),
      action: t('pulseAlertShootsLowAction'),
    });
  }

  const clientHealth = (pulse.clients || []).map((c) => ({
    ...c,
    videos: c.videoCount || 0,
  }));
  const idleClientNames = clientHealth.filter((c) => c.videos === 0 && !c.urgent).map((c) => c.name);
  if (idleClientNames.length > 0) {
    smartAlerts.push({
      type: 'orange',
      icon: '💤',
      title:
        idleClientNames.length === 1
          ? t('pulseAlertIdleClientsOne')
          : t('pulseAlertIdleClientsMany', { n: idleClientNames.length }),
      desc: `${idleClientNames.slice(0, 3).join(', ')}${idleClientNames.length > 3 ? ', …' : ''}`,
      action: t('pulseAlertIdleClientsAction'),
    });
  }

  if (smartAlerts.length === 0) {
    smartAlerts.push({
      type: 'green',
      icon: '✅',
      title: t('pulseAlertAllGoodTitle'),
      desc: t('pulseAlertAllGoodDesc'),
      action: '',
    });
  }

  const monthlyDelivered = pulse.monthlyDelivered || {};
  const months = Object.keys(monthlyDelivered);
  const values = months.map((m) => monthlyDelivered[m]);
  const maxVal = Math.max(1, ...values, 0);

  return (
    <section className="view active pulse-view">
      <div className="page-header pulse-header">
        <div>
          <div className="page-title">
            {t('pulsePageTitle')} <em>{t('pulsePageTitleEm')}</em>
          </div>
          <div className="page-subtitle">{t('pulseSubtitle')}</div>
        </div>
        <div className="pulse-header-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {isTeam ? (
            <button type="button" className="btn btn-primary" onClick={openEventModal}>
              {t('addEvent')}
            </button>
          ) : null}
          <button type="button" className="btn btn-ghost" onClick={() => refetch()}>
            ↺ {t('pulseRefresh')}
          </button>
        </div>
      </div>

      <div className="pulse-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {kpis.map((k) => kpiCard(k.id, k.icon, k.label, k.value, k.sub, k.color))}
      </div>

      <div className="pulse-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="pulse-card">
          <div className="pulse-card-title">{t('pulseCardPipeline')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            {pipelineStages.map((stage) => {
              const width = Math.max(4, Math.round((stage.value / maxStage) * 100));
              return (
                <div key={stage.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 110, fontSize: 12, color: 'var(--text-2)', textAlign: 'right', flexShrink: 0 }}>
                    {stage.label}
                  </div>
                  <div style={{ flex: 1, height: 24, background: 'var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${width}%`, background: stage.color, borderRadius: 6, transition: 'width .4s', display: 'flex', alignItems: 'center', padding: '0 8px', boxSizing: 'border-box' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'white', whiteSpace: 'nowrap' }}>{stage.value}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="pulse-card">
          <div className="pulse-card-title">{t('pulseTeamCapacity')}</div>
          {capacityMeter(workloadPct, t)}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 16 }}>
            {teamRows.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{t('pulseTeamEmpty')}</div>
            ) : (
              teamRows.map((row) => {
                const { member, name, load } = row;
                const reviewing = load?.reviewing || 0;
                const pct = Math.min(100, Math.round((reviewing / maxReviewingOnTeam) * 100));
                const barColor = pct > 80 ? 'var(--accent)' : pct > 50 ? 'var(--amber)' : 'var(--sage)';
                const avatarColor = getAvatarColor(member, name);
                const initial = getAvatarInitial(member, name);
                const subtitle = member?.teamRole ? ` · ${member.teamRole}` : '';

                return (
                  <div key={`${name}-${member?._id || ''}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        background: avatarColor,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 8,
                        fontWeight: 700,
                        color: 'white',
                        flexShrink: 0,
                      }}
                      title={name + subtitle}
                    >
                      {initial}
                    </div>
                    <div style={{ minWidth: 0, flex: '0 0 88px', fontSize: 12, color: 'var(--text-2)' }} title={name + subtitle}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                    </div>
                    <div style={{ flex: 1, height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 4, transition: 'width .4s' }} />
                    </div>
                    <div
                      style={{ width: 52, fontSize: 11, color: 'var(--text-3)', textAlign: 'right', flexShrink: 0 }}
                      title={t('pulseTeamLoadTooltip')}
                    >
                      {reviewing}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="pulse-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="pulse-card">
          <div className="pulse-card-title">{t('pulseCardReminders')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            {smartAlerts.map((a, i) => {
              const borderColor = a.type === 'red' ? '#E05050' : a.type === 'orange' ? 'var(--orange)' : a.type === 'green' ? 'var(--sage)' : 'var(--blue)';
              const bg = a.type === 'red' ? '#FEF2F2' : a.type === 'orange' ? 'var(--amber-light)' : a.type === 'green' ? '#F0FAF0' : 'var(--blue-light)';
              return (
                <div key={`${a.title}-${i}`} style={{ borderLeft: `3px solid ${borderColor}`, background: bg, borderRadius: '0 8px 8px 0', padding: '10px 12px' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{a.icon} {a.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{a.desc}</div>
                  {a.action ? <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>→ {a.action}</div> : null}
                </div>
              );
            })}
          </div>
        </div>

        <div className="pulse-card">
          <div className="pulse-card-title">{t('pulseCardGrowth')}</div>
          {months.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 24, textAlign: 'center' }}>
              {t('pulseGrowthEmpty')}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120, marginTop: 16, padding: '0 4px' }}>
              {months.map((month, idx) => {
                const val = values[idx];
                const h = Math.max(4, Math.round((val / maxVal) * 100));
                const isNow = idx === months.length - 1;
                const col = isNow ? 'var(--accent)' : 'var(--border)';
                const tcol = isNow ? 'var(--accent)' : 'var(--text-3)';
                return (
                  <div key={month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%' }}>
                    <div style={{ marginTop: 'auto', width: '100%', background: col, borderRadius: '4px 4px 0 0', height: `${h}%`, minHeight: 4, position: 'relative' }}>
                      {val > 0 ? <div style={{ position: 'absolute', top: -18, left: '50%', transform: 'translateX(-50%)', fontSize: 11, fontWeight: 700, color: 'var(--text)' }}>{val}</div> : null}
                    </div>
                    <div style={{ fontSize: 10, color: tcol, textAlign: 'center', whiteSpace: 'nowrap' }}>{month.split(' ')[0]}</div>
                  </div>
                );
              })}
            </div>
          )}
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8, textAlign: 'center' }}>{t('pulseGrowthFootnote')}</div>
        </div>
      </div>

        <div className="pulse-card pulse-client-health" style={{ marginBottom: 16 }}>
        <div className="pulse-card-title">{t('pulseCardClientHealth')}</div>
        <div className="pulse-client-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 10, marginTop: 12 }}>
          {clientHealth.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-3)', gridColumn: '1 / -1' }}>{t('pulseClientsEmpty')}</div>
          ) : null}
          {clientHealth.map((c) => {
            const score = c.videos > 5 ? 'high' : c.videos > 0 ? 'mid' : 'low';
            const scoreCol = score === 'high' ? 'var(--sage)' : score === 'mid' ? 'var(--amber)' : '#E05050';
            const batchCount = c.batchCount || 0;
            const mongoId = c._id || c.id;
            const goClient = () => {
              if (mongoId) navigate(`${DASHBOARD_BASE}/klanten/${String(mongoId)}`);
            };
            return (
              <div
                key={c.id || c._id || c.name}
                role={mongoId ? 'button' : undefined}
                tabIndex={mongoId ? 0 : undefined}
                onClick={mongoId ? goClient : undefined}
                onKeyDown={
                  mongoId
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          goClient();
                        }
                      }
                    : undefined
                }
                style={{
                  background: 'var(--bg-alt)',
                  borderRadius: 9,
                  padding: '12px 14px',
                  border: '1.5px solid var(--border)',
                  cursor: mongoId ? 'pointer' : 'default',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110 }} title={c.name}>
                    {c.name}
                  </div>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: scoreCol, flexShrink: 0 }} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                  {batchCount}{' '}
                  {t(batchCount === 1 ? 'pulseClientBatchOne' : 'pulseClientBatchMany')}
                  {' · '}
                  {c.videos} {t(c.videos === 1 ? 'pulseClientVideoOne' : 'pulseClientVideoMany')}
                </div>
                {c.urgent ? (
                  <div style={{ marginTop: 6, fontSize: 10, fontWeight: 600, color: 'var(--orange)', background: 'var(--orange-light)', padding: '2px 7px', borderRadius: 4, display: 'inline-block' }}>
                    ⚠ {t('pulseClientUrgent')}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {workloadPct < 50 ? (
        <div className="pulse-capacity-banner" style={{ background: 'linear-gradient(135deg,var(--sidebar),#3D2E26)', borderRadius: 'var(--radius)', padding: '20px 28px', display: 'flex', alignItems: 'center', gap: 20, marginBottom: 8 }}>
          <div style={{ fontSize: 36 }}>🚀</div>
          <div>
            <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 18, fontWeight: 700, color: '#FAF7F2', marginBottom: 4 }}>
              {t('pulseBannerTitle')}
            </div>
            <div style={{ fontSize: 13, color: 'rgba(250,247,242,.7)' }}>
              {t('pulseBannerBody', { n: Math.max(0, Math.floor((maxCapacity - totalActive) / 2)) })}
            </div>
          </div>
          <button
            className="btn pulse-capacity-btn"
            style={{ marginLeft: 'auto', background: 'var(--accent)', color: 'white', border: 'none', flexShrink: 0, whiteSpace: 'nowrap' }}
            onClick={() => navigate(`${DASHBOARD_BASE}/klanten`)}
          >
            {t('pulseBannerCta')}
          </button>
        </div>
      ) : null}

      <EventFormModal
        open={eventModalOpen}
        onClose={closeEventModal}
        mode="create"
        form={form}
        setForm={setForm}
        clients={clients}
        teamMembers={teamMembers}
        saveMut={saveEventMut}
        isTeam={isTeam}
      />
    </section>
  );
}
