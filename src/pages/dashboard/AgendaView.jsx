import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getEvents, getClients, createEvent } from '../../api';

const MONTHS = ['Januari','Februari','Maart','April','Mei','Juni','Juli','Augustus','September','Oktober','November','December'];
const TYPE_CLS = { Shoot:'chip-shoot', Edit:'chip-edit', Deadline:'chip-deadline', Call:'chip-call', Delivery:'chip-delivery' };
const TYPE_COLOR = { Shoot:'var(--sage)', Edit:'var(--amber)', Deadline:'var(--orange)', Call:'var(--blue)', Delivery:'var(--purple)' };
const TYPES = ['Shoot','Edit','Deadline','Call','Delivery'];

function dStr(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }

export default function AgendaView() {
  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [dayModal, setDayModal] = useState(null);
  const [addModal, setAddModal] = useState(false);
  const [form, setForm] = useState({ name:'', type:'Shoot', date:'', client:'', notes:'' });
  const [isFs, setIsFs] = useState(false);
  const qc = useQueryClient();

  const { data: events = [] }  = useQuery({ queryKey:['events'],  queryFn: getEvents });
  const { data: clients = [] } = useQuery({ queryKey:['clients'], queryFn: getClients });

  const createMut = useMutation({
    mutationFn: createEvent,
    onSuccess: () => { qc.invalidateQueries(['events']); setAddModal(false); setForm({ name:'', type:'Shoot', date:'', client:'', notes:'' }); }
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
          <button className="btn btn-primary" onClick={() => setAddModal(true)}>+ Event</button>
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
            const dayEvs = events.filter(e => e.date === ds);
            const isT = ds === todayStr;
            return (
              <div key={day}
                onClick={() => setDayModal({ date: ds, events: dayEvs })}
                className={`cal-cell${isT ? ' today' : ''}`}
              >
                <div className="cal-day-num">{day}</div>
                <div style={{display:'flex',flexDirection:'column',gap:'2px'}}>
                  {dayEvs.slice(0,3).map(e => (
                    <div key={e._id} className={`chip ${TYPE_CLS[e.type]||'chip-shoot'}`} style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{e.name}</div>
                  ))}
                  {dayEvs.length>3 && <div className="chip" style={{background:'var(--bg-alt)',color:'var(--text-3)'}}>+{dayEvs.length-3}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Day Modal */}
      {dayModal && (
        <div className="modal-overlay open" onClick={() => setDayModal(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{dayModal.date}</div>
              <button className="modal-close" onClick={() => setDayModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              {dayModal.events.length === 0
                ? <p style={{fontSize:'13px',color:'var(--text-3)',fontStyle:'italic'}}>Geen events op deze dag.</p>
                : dayModal.events.map(e => (
                    <div key={e._id} style={{display:'flex',gap:'12px',padding:'12px 0',borderBottom:'1px solid var(--border)'}}>
                      <div style={{width:'8px',height:'8px',borderRadius:'50%',background:TYPE_COLOR[e.type],flexShrink:0,marginTop:'5px'}}/>
                      <div>
                        <div style={{fontSize:'14px',fontWeight:'500'}}>{e.name}</div>
                        <div style={{fontSize:'12px',color:'var(--text-3)'}}>{e.type}{e.client ? ` · ${e.client}` : ''}</div>
                        {e.notes && <div style={{fontSize:'12px',color:'var(--text-2)',marginTop:'4px'}}>{e.notes}</div>}
                      </div>
                    </div>
                  ))
              }
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setDayModal(null)}>Sluiten</button>
              <button className="btn btn-primary" onClick={() => { setDayModal(null); setForm(f => ({...f, date: dayModal.date})); setAddModal(true); }}>+ Event toevoegen</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Event Modal */}
      {addModal && (
        <div className="modal-overlay open" onClick={() => setAddModal(false)}>
          <div className="modal" style={{maxWidth:'460px'}} onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Nieuw event toevoegen</div>
              <button className="modal-close" onClick={() => setAddModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Naam</label>
                <input className="form-input" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Event naam…" />
              </div>
              <div style={{display:'flex',gap:'8px',flexWrap:'wrap',marginBottom:'16px'}}>
                {TYPES.map(type => (
                  <button key={type} onClick={() => setForm(f=>({...f,type}))}
                    className={`type-btn${form.type===type?` active-${type.toLowerCase()}`:''}`}>{type}</button>
                ))}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
                <div className="form-group">
                  <label className="form-label">Datum</label>
                  <input type="date" className="form-input" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Klant</label>
                  <select className="form-input" value={form.client} onChange={e=>setForm(f=>({...f,client:e.target.value}))}>
                    <option value="">— Kies klant —</option>
                    {clients.map(c => <option key={c._id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Notities</label>
                <input className="form-input" value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Optioneel…" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setAddModal(false)}>Annuleren</button>
              <button className="btn btn-primary" onClick={() => createMut.mutate(form)} disabled={!form.name||!form.date}>Event opslaan</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
