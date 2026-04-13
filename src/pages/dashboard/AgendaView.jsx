import { useState } from 'react';
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

  const prev = () => { if(calMonth===0){setCalYear(y=>y-1);setCalMonth(11);}else setCalMonth(m=>m-1); };
  const next = () => { if(calMonth===11){setCalYear(y=>y+1);setCalMonth(0);}else setCalMonth(m=>m+1); };
  const toggleFs = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
      setIsFs(true);
    } else {
      await document.exitFullscreen();
      setIsFs(false);
    }
  };

  const first = new Date(calYear, calMonth, 1);
  let dow = first.getDay(); if(dow===0) dow=7;
  const blanks = dow - 1;
  const dim = new Date(calYear, calMonth+1, 0).getDate();
  const todayStr = dStr(today);

  return (
    <section className="view active">
      <div className="page-header">
        <div>
          <div className="page-title">Agenda</div>
          <div className="page-subtitle">{events.length} events gepland</div>
        </div>
        <div style={{display:'flex',gap:'8px'}}>
          <button className="btn btn-ghost" onClick={toggleFs}>{isFs ? '⤢ Verlaat fullscreen' : '⤢ Fullscreen'}</button>
          <button className="btn btn-primary" onClick={() => setAddModal(true)}>+ Nieuw event</button>
        </div>
      </div>

      {/* Month nav */}
      <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'28px'}}>
        <button className="btn btn-ghost btn-sm" onClick={prev}>← Vorige</button>
        <div className="page-title" style={{fontSize:'28px',minWidth:'220px'}}>{MONTHS[calMonth]} {calYear}</div>
        <button className="btn btn-ghost btn-sm" onClick={next}>Volgende →</button>
      </div>

      {/* Calendar grid */}
      <div style={{background:'var(--card)',borderRadius:'var(--radius)',boxShadow:'var(--shadow)',overflow:'hidden'}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',background:'var(--bg-alt)',borderBottom:'1px solid var(--border)'}}>
          {['Ma','Di','Wo','Do','Vr','Za','Zo'].map(d => (
            <div key={d} style={{padding:'12px 0',textAlign:'center',fontSize:'10px',letterSpacing:'.1em',textTransform:'uppercase',color:'var(--text-3)',fontWeight:'500'}}>{d}</div>
          ))}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)'}}>
          {Array.from({length:blanks}).map((_,i) => (
            <div key={`b${i}`} style={{borderRight:'1px solid var(--border)',borderBottom:'1px solid var(--border)',minHeight:'110px',background:'var(--bg)',opacity:.5}} />
          ))}
          {Array.from({length:dim},(_,i)=>i+1).map(day => {
            const ds = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
            const dayEvs = events.filter(e => e.date === ds);
            const isT = ds === todayStr;
            const col = (blanks+day-1)%7;
            return (
              <div key={day}
                onClick={() => setDayModal({ date: ds, events: dayEvs })}
                style={{
                  borderRight: col===6 ? 'none' : '1px solid var(--border)',
                  borderBottom: '1px solid var(--border)',
                  minHeight: '110px',
                  padding: '8px',
                  cursor: 'pointer',
                  background: isT ? 'var(--accent-pale)' : 'white',
                  transition: 'background var(--transition)',
                }}
                onMouseEnter={e => { if(!isT) e.currentTarget.style.background='var(--bg-alt)'; }}
                onMouseLeave={e => { if(!isT) e.currentTarget.style.background='white'; }}
              >
                <div style={{
                  fontFamily:'Montserrat', fontSize:'16px', fontWeight:'500', marginBottom:'4px',
                  ...(isT ? {background:'var(--accent)',color:'white',width:'26px',height:'26px',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'14px',fontWeight:'600'} : {color:'var(--text)'})
                }}>{day}</div>
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
