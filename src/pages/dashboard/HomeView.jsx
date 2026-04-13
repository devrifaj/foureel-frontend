import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useLang } from '../../context/LangContext';
import { useAuth } from '../../context/AuthContext';
import { getClients, getTasks, getEvents, getActivity, createEvent } from '../../api';
import { useState, useMemo } from 'react';
import HomeDayModal from './HomeDayModal';
import HomeAddEventModal from './HomeAddEventModal';

const MONTHS = ['Januari','Februari','Maart','April','Mei','Juni','Juli','Augustus','September','Oktober','November','December'];
const DS_NL  = ['Zo','Ma','Di','Wo','Do','Vr','Za'];
const DL_NL  = ['Zondag','Maandag','Dinsdag','Woensdag','Donderdag','Vrijdag','Zaterdag'];
const TYPE_CLS = { Shoot:'chip-shoot', Edit:'chip-edit', Deadline:'chip-deadline', Call:'chip-call', Delivery:'chip-delivery' };
function getMon(d) {
  const r = new Date(d); const dw = r.getDay();
  r.setDate(r.getDate() + (dw===0 ? -6 : 1 - dw)); return r;
}
function dStr(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function sameD(a,b) { return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }

function WeekGrid({ start, events, onDayClick }) {
  const TODAY = new Date(); TODAY.setHours(0,0,0,0);
  return (
    <div className="week-grid">
      {Array.from({length:7}, (_,i) => {
        const d = new Date(start); d.setDate(start.getDate()+i);
        const ds = dStr(d);
        const isT = sameD(d, TODAY);
        const isP = d < TODAY;
        const dayEvs = events.filter(e => e.date === ds);
        return (
          <div
            key={ds}
            role={isP ? undefined : 'button'}
            tabIndex={isP ? undefined : 0}
            className={`day-cell${isT?' today':''}${isP?' past':''}`}
            onClick={() => { if (!isP) onDayClick(ds); }}
            onKeyDown={(e) => {
              if (isP) return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onDayClick(ds);
              }
            }}
          >
            <div className="day-header">
              <div className="day-name">{DS_NL[d.getDay()]}</div>
              <div className="day-num">{d.getDate()}</div>
            </div>
            <div className="event-chips">
              {dayEvs.slice(0,3).map(e => (
                <div key={e._id} className={`chip ${TYPE_CLS[e.type]||'chip-shoot'}`} title={e.name}>{e.name}</div>
              ))}
              {dayEvs.length > 3 && <div className="chip" style={{background:'var(--bg-alt)',color:'var(--text-3)'}}>+{dayEvs.length-3}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function HomeView() {
  const navigate = useNavigate();
  const { t } = useLang();
  const { user } = useAuth();
  const isTeam = user?.role === 'team';
  const qc = useQueryClient();
  const [dayModalDate, setDayModalDate] = useState(null);
  const [addModal, setAddModal] = useState(false);
  const [form, setForm] = useState({ name:'', type:'Shoot', date:'', client:'', notes:'' });
  const TODAY = new Date(); TODAY.setHours(0,0,0,0);

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: getClients,
    enabled: isTeam,
  });
  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: getTasks,
    enabled: isTeam,
  });
  const { data: events = [] } = useQuery({
    queryKey: ['events'],
    queryFn: getEvents,
    enabled: isTeam,
  });
  const { data: activity = [] } = useQuery({
    queryKey: ['activity'],
    queryFn: getActivity,
    enabled: isTeam,
  });

  const createMut = useMutation({
    mutationFn: (body) => {
      if (!isTeam) return Promise.reject(new Error(t('eventCreateForbidden')));
      return createEvent(body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events'] });
      qc.invalidateQueries({ queryKey: ['activity'] });
      setAddModal(false);
      setDayModalDate(null);
      setForm({ name:'', type:'Shoot', date:'', client:'', notes:'' });
    },
  });

  const dayModalEvents = useMemo(
    () => (dayModalDate ? events.filter((e) => e.date === dayModalDate) : []),
    [events, dayModalDate],
  );

  const openDayFlow = (ds) => {
    if (!isTeam) return;
    const d = new Date(`${ds}T12:00:00`);
    const t0 = new Date();
    t0.setHours(0, 0, 0, 0);
    if (d < t0) return;
    setDayModalDate(ds);
  };

  const mon  = getMon(TODAY);
  const nmon = new Date(mon); nmon.setDate(nmon.getDate()+7);

  const weekday = DL_NL[TODAY.getDay()];
  const dateEm = `${TODAY.getDate()} ${MONTHS[TODAY.getMonth()]} ${TODAY.getFullYear()}`;

  const openTasks = tasks.filter(t => t.column !== 'klaar').length;
  const urgent    = clients.filter(c => c.urgent).length;
  const shoots    = events.filter(e => { const d=new Date(e.date); return e.type==='Shoot'&&d.getMonth()===TODAY.getMonth()&&d.getFullYear()===TODAY.getFullYear(); }).length;

  return (
    <section className="view active" id="view-home">
      <div className="page-header">
        <div>
          <div className="page-title" id="home-date-title">
            {weekday}, <em>{dateEm}</em>
          </div>
          <div className="page-subtitle">{t('homeStudioSubtitle')}</div>
        </div>
      </div>

      <div className="kpi-grid">
        {[
          { cls:'kpi-0', lbl:t('activeClients'), val:clients.length, desc:t('kpiDescOngoingProjects'), click:()=>navigate('/klanten'), id:'kpi-clients' },
          { cls:'kpi-1', lbl:t('shootsMonth'), val:shoots, desc:t('kpiDescScheduled'), click:()=>navigate('/agenda'), id:'kpi-shoots' },
          { cls:'kpi-2', lbl:t('kpiTasksInProgress'), val:openTasks, desc:t('kpiDescAcrossProjects'), click:()=>navigate('/taken'), id:'kpi-tasks' },
          { cls:'kpi-3', lbl:t('kpiUrgentClients'), val:urgent, desc:t('kpiDescRequiresAttention'), click:()=>navigate('/klanten'), id:'kpi-urgent' },
        ].map(k => (
          <div key={k.cls} className={`kpi-card ${k.cls}`} onClick={k.click}>
            <div className="kpi-label">{k.lbl}</div>
            <div className="kpi-number" id={k.id}>{k.val}</div>
            <div className="kpi-desc">{k.desc}</div>
          </div>
        ))}
      </div>

      <div className="home-body">
        <div className="home-main">
          <div className="week-section">
            <div className="week-label" id="week-label-current">{t('thisWeek')}</div>
            <div id="week-current">
              <WeekGrid start={mon} events={events} onDayClick={openDayFlow} />
            </div>
          </div>
          <div className="week-section">
            <div className="week-label" id="week-label-next">{t('nextWeek')}</div>
            <div id="week-next">
              <WeekGrid start={nmon} events={events} onDayClick={openDayFlow} />
            </div>
          </div>
        </div>

        <div className="home-side">
          <div className="activity-card">
            <div className="section-title" id="activity-section-title">{t('activity')}</div>
            <div id="activity-feed">
              {activity.slice(0,8).map(a => (
                <div key={a._id} className="activity-item">
                  <div className="activity-dot" style={{ background: a.color || 'var(--accent)' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="activity-text" dangerouslySetInnerHTML={{__html: a.text}} />
                    <div className="activity-time">{new Date(a.createdAt).toLocaleDateString('nl-NL')}</div>
                  </div>
                  <div className="activity-arrow">→</div>
                </div>
              ))}
              {activity.length === 0 && <div className="activity-empty">Nog geen activiteit</div>}
            </div>
          </div>
        </div>
      </div>

      <HomeDayModal
        date={dayModalDate}
        events={dayModalEvents}
        onClose={() => setDayModalDate(null)}
        onAddEvent={(d) => {
          setForm((f) => ({ ...f, date: d }));
          setDayModalDate(null);
          setAddModal(true);
        }}
      />

      <HomeAddEventModal
        open={addModal}
        onClose={() => setAddModal(false)}
        form={form}
        setForm={setForm}
        clients={clients}
        createMut={createMut}
        isTeam={isTeam}
      />
    </section>
  );
}
