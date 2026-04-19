import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../context/LangContext';
import { getEvents, getClients, getTeamMembers, createEvent, updateEvent } from '../../api';
import EventDayModal from './EventDayModal';
import EventFormModal from '../../components/EventFormModal';
import { sortEventsBySchedule, formatEventTime } from '../../utils/dateTimeFormat';
import { getAssigneeInitials, getAssigneeMonogramStyle } from '../../utils/eventAssignee';
import { emptyEventForm, eventToFormState, joinDateAndTimeForLocalInput } from '../../utils/eventFormState';

const MONTHS = ['Januari','Februari','Maart','April','Mei','Juni','Juli','Augustus','September','Oktober','November','December'];
const TYPE_CLS = { Shoot:'chip-shoot', Edit:'chip-edit', Deadline:'chip-deadline', Call:'chip-call', Delivery:'chip-delivery' };

function dStr(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }

export default function AgendaView() {
  const { user } = useAuth();
  const { t, lang } = useLang();
  const isTeam = user?.role === 'team';
  const locale = lang === 'en' ? 'en-GB' : 'nl-NL';
  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [dayModal, setDayModal] = useState(null);
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState(null);
  const [form, setForm] = useState(emptyEventForm);
  const [isFs, setIsFs] = useState(false);
  const qc = useQueryClient();

  const { data: events = [] } = useQuery({ queryKey: ['events'], queryFn: getEvents, enabled: isTeam });
  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: getClients, enabled: isTeam });
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team'],
    queryFn: getTeamMembers,
    enabled: isTeam,
  });

  const saveEventMut = useMutation({
    mutationFn: (body) => {
      if (!isTeam) return Promise.reject(new Error(t('eventCreateForbidden')));
      if (editingEventId) return updateEvent(editingEventId, body);
      return createEvent(body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events'] });
      setEventModalOpen(false);
      setEditingEventId(null);
      setDayModal(null);
      setForm(emptyEventForm());
    },
  });

  useEffect(() => {
    const handleFullscreenChange = () => {
      const active = Boolean(document.fullscreenElement);
      setIsFs(active);
      document.body.classList.toggle('agenda-fs', active);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    handleFullscreenChange();

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.body.classList.remove('agenda-fs');
    };
  }, []);

  const prev = () => { if(calMonth===0){setCalYear(y=>y-1);setCalMonth(11);}else setCalMonth(m=>m-1); };
  const next = () => { if(calMonth===11){setCalYear(y=>y+1);setCalMonth(0);}else setCalMonth(m=>m+1); };
  const toggleFs = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  };

  const first = new Date(calYear, calMonth, 1);
  let dow = first.getDay(); if(dow===0) dow=7;
  const blanks = dow - 1;
  const dim = new Date(calYear, calMonth+1, 0).getDate();
  const todayStr = dStr(today);

  const monthLabel = `${MONTHS[calMonth]} ${calYear}`;
  const fsTodayLabel = today.toLocaleDateString('nl-NL', { weekday: 'short', day: '2-digit', month: 'short' });

  const openDayModal = (ds, dayEvs) => {
    setDayModal({ date: ds, events: sortEventsBySchedule(dayEvs) });
  };

  const openCreateFromDay = (ds) => {
    setEditingEventId(null);
    setForm({ ...emptyEventForm(), dateTime: joinDateAndTimeForLocalInput(ds, '12:00') });
    setDayModal(null);
    setEventModalOpen(true);
  };

  const openEditEvent = (e) => {
    if (!isTeam) return;
    setEditingEventId(e._id);
    setForm(eventToFormState(e));
    setDayModal(null);
    setEventModalOpen(true);
  };

  const closeEventModal = () => {
    setEventModalOpen(false);
    setEditingEventId(null);
    setForm(emptyEventForm());
  };

  return (
    <section className="view active" id="view-agenda">
      <div id="fs-topbar">
        <div className="fs-brand">
          <div style={{width:'32px',height:'32px',background:'var(--accent)',borderRadius:'8px',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="white"><path d="M3 3h5v5H3zm7 0h5v5h-5zm0 7h5v5h-5zM3 13l2.5-2.5L8 13l-2.5 2.5z"/></svg>
          </div>
          <div>
            <div className="fs-brand-name">4REEL</div>
            <div className="fs-date-pill">{fsTodayLabel}</div>
          </div>
        </div>
        <div className="fs-month">{monthLabel}</div>
        <div className="fs-nav">
          <button className="fs-nav-btn" onClick={prev} title="Vorige maand">←</button>
          <button className="fs-nav-btn" onClick={next} title="Volgende maand">→</button>
          <button className="fs-exit-btn" onClick={toggleFs}>
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M1 1l12 12M13 1L1 13"/></svg>
            Sluiten
          </button>
        </div>
      </div>

      <div id="fs-legend">
        <span style={{fontSize:'11px',color:'var(--text-3)',fontWeight:'600',letterSpacing:'0.08em',textTransform:'uppercase',marginRight:'4px'}}>Legenda</span>
        <div className="legend-pill"><div className="legend-dot" style={{background:'var(--sage)'}}/>Shoot</div>
        <div className="legend-pill"><div className="legend-dot" style={{background:'var(--amber)'}}/>Edit</div>
        <div className="legend-pill"><div className="legend-dot" style={{background:'var(--orange)'}}/>Deadline</div>
        <div className="legend-pill"><div className="legend-dot" style={{background:'var(--blue)'}}/>Call</div>
        <div className="legend-pill"><div className="legend-dot" style={{background:'var(--purple)'}}/>Delivery</div>
      </div>

      <div className="page-header">
        <div>
          <div className="page-title">Agenda <em>— Studio planning</em></div>
          <div className="page-subtitle">Shoots, edits, deadlines & calls</div>
        </div>
        <div className="agenda-header-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setEditingEventId(null);
              const d = new Date();
              const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
              setForm({ ...emptyEventForm(), dateTime: joinDateAndTimeForLocalInput(ds, '12:00') });
              setEventModalOpen(true);
            }}
          >
            + Event
          </button>
          <button className="fs-btn" onClick={toggleFs} title="Presentatiemodus">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 6V1h5M10 1h5v5M15 10v5h-5M6 15H1v-5"/>
            </svg>
            <span>{isFs ? 'Sluiten' : 'Presentatie'}</span>
          </button>
        </div>
      </div>

      <div className="agenda-controls">
        <button className="btn btn-ghost btn-sm" onClick={prev}>← Vorige</button>
        <div className="month-display">{monthLabel}</div>
        <button className="btn btn-ghost btn-sm" onClick={next}>Volgende →</button>
      </div>

      <div className="calendar-grid">
        <div className="cal-header">
          {['Maandag','Dinsdag','Woensdag','Donderdag','Vrijdag','Zaterdag','Zondag'].map(d => (
            <div key={d} className="cal-header-cell">{d}</div>
          ))}
        </div>
        <div className="cal-body">
          {Array.from({length:blanks}).map((_,i) => (
            <div key={`b${i}`} className="cal-cell empty" />
          ))}
          {Array.from({length:dim},(_,i)=>i+1).map(day => {
            const ds = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
            const dayEvs = sortEventsBySchedule(events.filter(e => e.date === ds));
            const isT = ds === todayStr;
            return (
              <div key={day}
                onClick={() => openDayModal(ds, dayEvs)}
                className={`cal-cell${isT ? ' today' : ''}`}
              >
                <div className="cal-day-num">{day}</div>
                <div className="cal-cell-chips">
                  {dayEvs.slice(0,3).map(e => {
                    const initials = getAssigneeInitials(e, { maxLength: 2 });
                    const monoStyle = getAssigneeMonogramStyle(e);
                    const assigneeName = e.assigneeId && typeof e.assigneeId === 'object' ? e.assigneeId.name : '';
                    const timeDisp = formatEventTime(e.time, locale, { hour12: true });
                    return (
                      <div
                        key={e._id}
                        role={isTeam ? 'button' : undefined}
                        tabIndex={isTeam ? 0 : undefined}
                        className={`chip event-chip-row ${TYPE_CLS[e.type]||'chip-shoot'}`}
                        style={{ overflow: 'hidden' }}
                        title={e.name}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          if (isTeam) openDayModal(ds, dayEvs);
                        }}
                        onKeyDown={(ev) => {
                          if (!isTeam) return;
                          if (ev.key === 'Enter' || ev.key === ' ') {
                            ev.preventDefault();
                            ev.stopPropagation();
                            openDayModal(ds, dayEvs);
                          }
                        }}
                      >
                        <span className="event-chip-name">{e.name}</span>
                        {initials ? (
                          <span className="event-chip-ini" style={monoStyle} title={assigneeName || undefined}>
                            {initials}
                          </span>
                        ) : null}
                        {timeDisp ? <span className="event-chip-time">{timeDisp}</span> : null}
                      </div>
                    );
                  })}
                  {dayEvs.length>3 && <div className="chip" style={{background:'var(--bg-alt)',color:'var(--text-3)'}}>+{dayEvs.length-3}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <EventDayModal
        date={dayModal?.date ?? null}
        events={dayModal?.events ?? []}
        onClose={() => setDayModal(null)}
        onAddEvent={openCreateFromDay}
        onEventClick={openEditEvent}
      />

      <EventFormModal
        open={eventModalOpen}
        onClose={closeEventModal}
        mode={editingEventId ? 'edit' : 'create'}
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
