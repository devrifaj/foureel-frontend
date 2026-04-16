import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getPulse } from '../../api';

const PEOPLE = ['Paolo', 'Lex', 'Rick', 'Ray', 'Boy'];

function getAvatarColor(name) {
  if (name === 'Paolo') return 'var(--accent)';
  if (name === 'Lex') return 'var(--sage)';
  if (name === 'Rick') return 'var(--blue)';
  if (name === 'Ray') return 'var(--amber)';
  return 'var(--text-3)';
}

function getAvatarInitial(name) {
  if (name === 'Ray') return 'Ra';
  return name?.[0] || '?';
}

function kpiCard(icon, label, value, sub, color) {
  return (
    <div className="pulse-card" key={label}>
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

function capacityMeter(pct) {
  const color = pct > 85 ? '#E05050' : pct > 60 ? 'var(--amber)' : pct < 30 ? 'var(--blue)' : 'var(--sage)';
  const label = pct > 85 ? 'Bijna vol' : pct > 60 ? 'Goed bezet' : pct < 30 ? 'Ruimte beschikbaar' : 'Gezond';
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
  const { data: pulse, isLoading, refetch } = useQuery({
    queryKey: ['pulse'],
    queryFn: getPulse,
    refetchInterval: 30000,
  });

  if (isLoading) return <section className="view active"><div style={{padding:'40px',color:'var(--text-3)'}}>Laden…</div></section>;
  if (!pulse) return null;

  const kpis = [
    { icon: '🎬', label: 'Batches actief', value: pulse.batchesActive || 0, sub: '', color: 'var(--accent)' },
    { icon: '📹', label: "Videos in pipeline", value: pulse.totalVideos || 0, sub: `${pulse.notStarted || 0} nog te starten`, color: 'var(--blue)' },
    { icon: '📅', label: 'Shoots gepland', value: pulse.shootsPlanned || 0, sub: `${pulse.shootsThisMonth || 0} deze maand`, color: 'var(--sage)' },
    { icon: '📦', label: 'Opgeleverd ooit', value: pulse.finished || 0, sub: `${pulse.deliveredMonth || 0} deze maand`, color: 'var(--purple)' },
  ];

  const pipelineStages = [
    { label: 'Nog te starten', value: pulse.notStarted || 0, color: 'var(--border)' },
    { label: 'In bewerking', value: pulse.inEdit || 0, color: 'var(--amber)' },
    { label: 'In review', value: pulse.inReview || 0, color: 'var(--blue)' },
    { label: 'Opgeleverd', value: pulse.finished || 0, color: 'var(--sage)' },
  ];
  const maxStage = Math.max(1, ...pipelineStages.map((s) => s.value));

  const editorLoad = pulse.editorLoad || {};
  const totalActive = PEOPLE.reduce((sum, p) => sum + (editorLoad[p]?.reviewing || 0), 0);
  const maxCapacity = PEOPLE.length * 3;
  const workloadPct = Math.min(100, Math.round((totalActive / Math.max(maxCapacity, 1)) * 100));

  const smartAlerts = [];
  (pulse.urgentDeadlines || []).forEach((d) => {
    smartAlerts.push({
      type: d.days <= 2 ? 'red' : 'orange',
      icon: '⏰',
      title: d.days === 0 ? `Deadline VANDAAG: ${d.name}` : `Deadline over ${d.days} dag${d.days > 1 ? 'en' : ''}: ${d.name}`,
      desc: `${d.open} video${d.open > 1 ? 's' : ''} nog niet klaar voor ${d.client || 'deze klant'}`,
      action: `Ga naar Workspace → ${d.client || d.name}`,
    });
  });

  if (workloadPct < 30) {
    smartAlerts.push({
      type: 'blue',
      icon: '📈',
      title: 'Lage workload — ruimte voor nieuwe klanten',
      desc: `Team zit op ${workloadPct}% capaciteit. Goed moment voor acquisitie.`,
      action: `Overweeg ${Math.max(0, Math.floor((maxCapacity - totalActive) / 3))} nieuwe projecten aan te nemen`,
    });
  } else if (workloadPct > 85) {
    smartAlerts.push({
      type: 'red',
      icon: '🔥',
      title: `Team bijna vol — ${workloadPct}% bezet`,
      desc: 'Wees voorzichtig met het aannemen van nieuwe opdrachten.',
      action: 'Bespreek capaciteitsplanning met Boy',
    });
  }

  if ((pulse.inReview || 0) > 3) {
    smartAlerts.push({
      type: 'orange',
      icon: '👁',
      title: `${pulse.inReview} videos wachten op review/feedback`,
      desc: 'Follow-up bij klanten versnelt de pipeline.',
      action: 'Controleer: Workspace → Export links verzonden?',
    });
  }

  if ((pulse.shootsPlanned || 0) < 2) {
    smartAlerts.push({
      type: 'blue',
      icon: '📷',
      title: `Weinig shoots ingepland (${pulse.shootsPlanned || 0})`,
      desc: 'Minder dan 2 shoots gepland voor de komende periode.',
      action: 'Plan nieuwe shootdagen in via de Agenda',
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
      title: `${idleClientNames.length} klant${idleClientNames.length > 1 ? 'en' : ''} zonder actieve videos`,
      desc: `${idleClientNames.slice(0, 3).join(', ')}${idleClientNames.length > 3 ? ', …' : ''}`,
      action: 'Stuur een check-in of plan nieuwe shoot in',
    });
  }

  if (smartAlerts.length === 0) {
    smartAlerts.push({
      type: 'green',
      icon: '✅',
      title: 'Alles ziet er goed uit!',
      desc: 'Geen urgente aandachtspunten gevonden. Goed bezig!',
      action: '',
    });
  }

  const monthlyDelivered = pulse.monthlyDelivered || {};
  const months = Object.keys(monthlyDelivered);
  const values = months.map((m) => monthlyDelivered[m]);
  const maxVal = Math.max(1, ...values);

  return (
    <section className="view active pulse-view">
      <div className="page-header pulse-header">
        <div>
          <div className="page-title">Studio Pulse <em>— Bedrijfsgezondheid</em></div>
          <div className="page-subtitle">Live inzicht in workload, pipeline en groei</div>
        </div>
        <button className="btn btn-ghost" onClick={refetch}>↺ Vernieuwen</button>
      </div>

      <div className="pulse-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {kpis.map((k) => kpiCard(k.icon, k.label, k.value, k.sub, k.color))}
      </div>

      <div className="pulse-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="pulse-card">
          <div className="pulse-card-title">Video Pipeline</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            {pipelineStages.map((stage) => {
              const width = Math.max(4, Math.round((stage.value / maxStage) * 100));
              return (
                <div key={stage.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
          <div className="pulse-card-title">Team Capaciteit</div>
          {capacityMeter(workloadPct)}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 16 }}>
            {PEOPLE.map((name) => {
              const load = editorLoad[name] || { reviewing: 0 };
              const pct = Math.min(100, Math.round((load.reviewing / 5) * 100));
              const barColor = pct > 80 ? 'var(--accent)' : pct > 50 ? 'var(--amber)' : 'var(--sage)';
              const avatarColor = getAvatarColor(name);
              const initial = getAvatarInitial(name);

              return (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: 'white', flexShrink: 0 }}>
                    {initial}
                  </div>
                  <div style={{ width: 60, fontSize: 12, color: 'var(--text-2)', flexShrink: 0 }}>{name}</div>
                  <div style={{ flex: 1, height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 4, transition: 'width .4s' }} />
                  </div>
                  <div style={{ width: 36, fontSize: 11, color: 'var(--text-3)', textAlign: 'right' }}>{pct}%</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="pulse-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="pulse-card">
          <div className="pulse-card-title">🔔 Slimme reminders</div>
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
          <div className="pulse-card-title">📈 Groei — opgeleverde projecten</div>
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
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8, textAlign: 'center' }}>
            Laatste 6 maanden · gearchiveerde taken + opgeleverde workspace videos
          </div>
        </div>
      </div>

        <div className="pulse-card pulse-client-health" style={{ marginBottom: 16 }}>
        <div className="pulse-card-title">🏢 Klantgezondheid</div>
        <div className="pulse-client-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 10, marginTop: 12 }}>
          {clientHealth.map((c) => {
            const score = c.videos > 5 ? 'high' : c.videos > 0 ? 'mid' : 'low';
            const scoreCol = score === 'high' ? 'var(--sage)' : score === 'mid' ? 'var(--amber)' : '#E05050';
            const batchCount = c.batchCount || 0;
            return (
              <div key={c.id || c._id || c.name} style={{ background: 'var(--bg-alt)', borderRadius: 9, padding: '12px 14px', border: '1.5px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110 }} title={c.name}>
                    {c.name}
                  </div>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: scoreCol, flexShrink: 0 }} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                  {batchCount} batch{batchCount !== 1 ? 'es' : ''} · {c.videos} video{c.videos !== 1 ? 's' : ''}
                </div>
                {c.urgent ? (
                  <div style={{ marginTop: 6, fontSize: 10, fontWeight: 600, color: 'var(--orange)', background: 'var(--orange-light)', padding: '2px 7px', borderRadius: 4, display: 'inline-block' }}>
                    ⚠ Urgent
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
              Capaciteitsruimte beschikbaar
            </div>
            <div style={{ fontSize: 13, color: 'rgba(250,247,242,.7)' }}>
              Het team kan nog ca. {Math.max(0, Math.floor((maxCapacity - totalActive) / 2))} nieuwe projecten aan. Nu is het moment voor acquisitie.
            </div>
          </div>
          <button
            className="btn pulse-capacity-btn"
            style={{ marginLeft: 'auto', background: 'var(--accent)', color: 'white', border: 'none', flexShrink: 0, whiteSpace: 'nowrap' }}
            onClick={() => navigate('/klanten')}
          >
            → Naar klanten
          </button>
        </div>
      ) : null}
    </section>
  );
}
