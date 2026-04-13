// ArchiefView.jsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getArchivedTasks, restoreTask } from '../../api';

export function ArchiefView() {
  const [folder, setFolder] = useState(null);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const qc = useQueryClient();

  const { data: tasks = [] } = useQuery({ queryKey:['archivedTasks'], queryFn: getArchivedTasks });
  const restoreMut = useMutation({ mutationFn: restoreTask, onSuccess: () => { qc.invalidateQueries(['archivedTasks']); qc.invalidateQueries(['tasks']); setModal(null); }});

  const clients = [...new Set(tasks.map(t=>t.client).filter(Boolean))];
  const filteredBase = folder ? tasks.filter(t=>t.client===folder) : tasks;
  const q = search.trim().toLowerCase();
  const filtered = q
    ? filteredBase.filter(
        (t) =>
          t.title?.toLowerCase().includes(q) ||
          t.client?.toLowerCase().includes(q) ||
          t.assignee?.toLowerCase().includes(q),
      )
    : filteredBase;

  return (
    <section className="view active">
      <div className="page-header">
        <div><div className="page-title">Archief</div><div className="page-subtitle">Gearchiveerde taken</div></div>
        <div style={{display:'flex',gap:'8px'}}>
          <input className="search-input" value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Zoek in archief..." />
          <button className="btn btn-ghost btn-sm" onClick={()=>{setFolder(null);setSearch('');}}>↺ Reset</button>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'220px 1fr',gap:'24px'}}>
        {/* Folder list */}
        <div style={{background:'var(--card)',borderRadius:'var(--radius)',boxShadow:'var(--shadow)',overflow:'hidden'}}>
          {[{name:'Alle taken',id:null},...clients.map(c=>({name:c,id:c}))].map(f => (
            <div key={f.name} onClick={()=>setFolder(f.id)}
              style={{display:'flex',alignItems:'center',gap:'10px',padding:'13px 16px',borderBottom:'1px solid var(--border)',cursor:'pointer',
                background:folder===f.id?'var(--accent-pale)':'white',color:folder===f.id?'var(--accent)':'var(--text-2)',fontWeight:folder===f.id?'500':'400',fontSize:'13px',transition:'all var(--transition)'}}>
              📁 {f.name}
              <span style={{marginLeft:'auto',fontSize:'11px',color:folder===f.id?'var(--accent)':'var(--text-3)'}}>{f.id?tasks.filter(t=>t.client===f.id).length:tasks.length}</span>
            </div>
          ))}
        </div>
        {/* Task list */}
        <div style={{background:'var(--card)',borderRadius:'var(--radius)',boxShadow:'var(--shadow)',overflow:'hidden'}}>
          <div style={{padding:'20px 24px',borderBottom:'1px solid var(--border)'}}>
            <h3 style={{fontFamily:'Montserrat',fontSize:'20px',fontWeight:'500'}}>{folder||'Alle taken'} ({filtered.length})</h3>
          </div>
          {filtered.length === 0
            ? <div style={{padding:'20px 24px',fontSize:'13px',color:'var(--text-3)',fontStyle:'italic'}}>Geen taken gevonden.</div>
            : filtered.map(t => (
                <div key={t._id} onClick={()=>setModal(t)}
                  style={{display:'flex',alignItems:'flex-start',gap:'14px',padding:'16px 24px',borderBottom:'1px solid var(--border)',cursor:'pointer',transition:'background var(--transition)'}}
                  onMouseEnter={e=>e.currentTarget.style.background='var(--bg-alt)'}
                  onMouseLeave={e=>e.currentTarget.style.background='white'}>
                  <div style={{color:'var(--sage)',fontSize:'16px',marginTop:'1px'}}>✓</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:'14px',fontWeight:'500',marginBottom:'4px'}}>{t.title}</div>
                    <div style={{fontSize:'12px',color:'var(--text-3)',display:'flex',gap:'12px'}}>
                      <span>{t.client||'—'}</span><span>{t.assignee}</span>
                      <span>{t.archivedAt ? new Date(t.archivedAt).toLocaleDateString('nl-NL') : ''}</span>
                    </div>
                  </div>
                  <span style={{fontSize:'10px',fontWeight:'700',padding:'2px 7px',borderRadius:'20px',background:t.archiveReason==='delivered'?'var(--sage-light)':'var(--blue-light)',color:t.archiveReason==='delivered'?'var(--sage)':'var(--blue)',whiteSpace:'nowrap'}}>
                    {t.archiveReason==='delivered'?'Opgeleverd':'Voltooid'}
                  </span>
                </div>
              ))
          }
        </div>
      </div>
      {modal && (
        <div className="modal-overlay open" onClick={()=>setModal(null)}>
          <div className="modal" style={{maxWidth:'480px'}} onClick={e=>e.stopPropagation()}>
            <div className="modal-header"><div className="modal-title">{modal.title}</div><button className="modal-close" onClick={()=>setModal(null)}>✕</button></div>
            <div className="modal-body">
              {[['Klant',modal.client||'—'],['Toegewezen',modal.assignee],['Gearchiveerd',modal.archivedAt?new Date(modal.archivedAt).toLocaleDateString('nl-NL'):'—'],['Reden',modal.archiveReason==='delivered'?'Opgeleverd':'Voltooid']].map(([l,v])=>(
                <div key={l} style={{background:'var(--bg-alt)',borderRadius:'8px',padding:'10px 12px',marginBottom:'10px'}}>
                  <div style={{fontSize:'10px',fontWeight:'700',letterSpacing:'.08em',textTransform:'uppercase',color:'var(--text-3)',marginBottom:'3px'}}>{l}</div>
                  <div style={{fontSize:'13px',fontWeight:'500'}}>{v}</div>
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost btn-sm" style={{color:'var(--accent)',marginRight:'auto'}} onClick={()=>restoreMut.mutate(modal._id)}>↩ Herstellen</button>
              <button className="btn btn-ghost" onClick={()=>setModal(null)}>Sluiten</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
export default ArchiefView;
