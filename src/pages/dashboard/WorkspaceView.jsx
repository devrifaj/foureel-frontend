import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getBatches, updateVideo, deleteVideo, addVideo, createBatch } from '../../api';

const FASE_MAP = {
  tentative:       { label:'Tentative',             cls:'ws-ef-tentative',   group:'intern' },
  spotting:        { label:'Spotting Footage',       cls:'ws-ef-spotting',    group:'intern' },
  inprogress:      { label:'In Progress',            cls:'ws-ef-inprogress',  group:'intern' },
  ready:           { label:'Ready to Edit',          cls:'ws-ef-ready',       group:'intern' },
  intern_review:   { label:'Intern Review',          cls:'ws-ef-waitreview',  group:'intern' },
  intern_approved: { label:'Intern Goedgekeurd ✓',  cls:'ws-ef-uploaddrive', group:'intern' },
  waitreview:      { label:'Stuur naar klant →',    cls:'ws-ef-waitreview',  group:'client' },
  client_review:   { label:'In review bij klant',   cls:'ws-ef-feedbackrdy', group:'client' },
  client_revision: { label:'Revisie aangevraagd',   cls:'ws-ef-spotting',    group:'client' },
  client_approved: { label:'Goedgekeurd door klant ✓', cls:'ws-ef-finished', group:'client' },
  uploaddrive:     { label:'Upload to Drive',        cls:'ws-ef-uploaddrive', group:'done' },
  finished:        { label:'Finished ✓',             cls:'ws-ef-finished',    group:'done' },
};

const GROUPS = [{ key:'intern', label:'── Intern ──' }, { key:'client', label:'── Klant ──' }, { key:'done', label:'── Afronden ──' }];

function FaseSelect({ value, onChange }) {
  return (
    <select value={value} onChange={e=>onChange(e.target.value)}
      style={{fontSize:'10px',fontWeight:'700',width:'100%',border:'1.5px solid var(--border)',borderRadius:'6px',padding:'3px 8px',cursor:'pointer',fontFamily:'DM Sans,sans-serif',background:'var(--bg-alt)'}}>
      {GROUPS.map(g => (
        <optgroup key={g.key} label={g.label}>
          {Object.entries(FASE_MAP).filter(([,m])=>m.group===g.key).map(([k,m])=>(
            <option key={k} value={k}>{m.label}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

export default function WorkspaceView() {
  const [batchId, setBatchId] = useState(null);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [newBatch, setNewBatch] = useState({ name: '', client: '', editor: '', deadline: '', emoji: '🎬' });
  const [scriptVideo, setScriptVideo] = useState(null);
  const [scriptDraft, setScriptDraft] = useState('');
  const [shotVideo, setShotVideo] = useState(null);
  const [shotDraft, setShotDraft] = useState('');
  const [shootMode, setShootMode] = useState(false);
  const [sopVideo, setSopVideo] = useState(null);
  const [sopDraft, setSopDraft] = useState(null);
  const shotOverlayRef = useRef(null);
  const qc = useQueryClient();

  const { data: batches = [] } = useQuery({ queryKey:['batches'], queryFn: getBatches });
  const updateMut = useMutation({ mutationFn: ({bId,vId,...d}) => updateVideo(bId,vId,d), onSuccess: ()=>qc.invalidateQueries(['batches']) });
  const createBatchMut = useMutation({
    mutationFn: createBatch,
    onSuccess: (created) => {
      qc.invalidateQueries(['batches']);
      if (created?._id) setBatchId(created._id);
    },
  });

  const batch = batches.find(b => b._id === batchId);
  const scriptWords = useMemo(
    () => (scriptDraft.trim() ? scriptDraft.trim().split(/\s+/).length : 0),
    [scriptDraft],
  );

  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement) setShootMode(false);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const openScript = (video) => {
    setScriptVideo(video);
    setScriptDraft(video.script || '');
  };
  const saveScript = () => {
    if (!batch || !scriptVideo) return;
    updateMut.mutate({ bId: batch._id, vId: scriptVideo._id, script: scriptDraft });
    setScriptVideo(null);
  };

  const openShotlist = (video) => {
    setShotVideo(video);
    setShotDraft('');
    setShootMode(false);
  };
  const saveShotlist = (nextShotlist) => {
    if (!batch || !shotVideo) return;
    updateMut.mutate({ bId: batch._id, vId: shotVideo._id, shotlist: nextShotlist });
  };
  const toggleShot = (idx) => {
    if (!shotVideo) return;
    const list = (shotVideo.shotlist || []).map((s, i) => (i === idx ? { ...s, done: !s.done } : s));
    setShotVideo({ ...shotVideo, shotlist: list });
    saveShotlist(list);
  };
  const addShot = () => {
    if (!shotVideo || !shotDraft.trim()) return;
    const list = [...(shotVideo.shotlist || []), { text: shotDraft.trim(), done: false }];
    setShotVideo({ ...shotVideo, shotlist: list });
    saveShotlist(list);
    setShotDraft('');
  };
  const removeShot = (idx) => {
    if (!shotVideo) return;
    const list = (shotVideo.shotlist || []).filter((_, i) => i !== idx);
    setShotVideo({ ...shotVideo, shotlist: list });
    saveShotlist(list);
  };
  const resetShots = () => {
    if (!shotVideo) return;
    const list = (shotVideo.shotlist || []).map((s) => ({ ...s, done: false }));
    setShotVideo({ ...shotVideo, shotlist: list });
    saveShotlist(list);
  };
  const toggleShootMode = async () => {
    if (!shotOverlayRef.current) return;
    if (!shootMode) {
      try {
        if (!document.fullscreenElement) await shotOverlayRef.current.requestFullscreen();
      } catch (_) {}
      setShootMode(true);
    } else {
      if (document.fullscreenElement) await document.exitFullscreen();
      setShootMode(false);
    }
  };

  const openSop = (video) => {
    setSopVideo(video);
    setSopDraft({
      format: video.sop?.format || '',
      muziek: video.sop?.muziek || '',
      kleurprofiel: video.sop?.kleurprofiel || '',
      extraNotes: video.sop?.extraNotes || '',
      ratioTags: video.sop?.ratioTags || [],
      stijlTags: video.sop?.stijlTags || [],
    });
  };
  const saveSop = () => {
    if (!batch || !sopVideo || !sopDraft) return;
    updateMut.mutate({ bId: batch._id, vId: sopVideo._id, sop: sopDraft });
    setSopVideo(null);
  };

  const ratioOptions = ['9:16', '16:9', '1:1', '4:5'];
  const styleOptions = ['Cinematic', 'Fast Cuts', 'Minimal', 'Bold', 'Story'];
  const toggleTag = (key, value) => {
    if (!sopDraft) return;
    const arr = sopDraft[key] || [];
    const next = arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value];
    setSopDraft({ ...sopDraft, [key]: next });
  };

  const createNewBatch = () => {
    if (!newBatch.name.trim()) return;
    createBatchMut.mutate(
      {
        name: newBatch.name.trim(),
        emoji: newBatch.emoji || '🎬',
        client: newBatch.client.trim(),
        editor: newBatch.editor.trim(),
        deadline: newBatch.deadline,
        videos: [],
      },
      {
        onSuccess: () => {
          setShowBatchModal(false);
          setNewBatch({ name: '', client: '', editor: '', deadline: '', emoji: '🎬' });
        },
      },
    );
  };

  if (batch) {
    const done = batch.videos.filter(v=>v.editFase==='finished').length;
    const total = batch.videos.length;
    return (
      <section className="view active">
        <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'28px'}}>
          <button className="btn btn-ghost btn-sm" onClick={()=>setBatchId(null)}>← Alle batches</button>
          <div style={{fontSize:'28px'}}>{batch.emoji}</div>
          <div style={{flex:1}}>
            <div style={{fontFamily:'Montserrat',fontSize:'22px',fontWeight:'500'}}>{batch.name}</div>
            <div style={{fontSize:'13px',color:'var(--text-3)'}}>{batch.client} · Editor: {batch.editor} · Deadline: {batch.deadline}</div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={async()=>{const name=prompt('Naam filmpje:');if(name)await addVideo(batch._id,{name,editFase:'tentative'});qc.invalidateQueries(['batches']);}}>+ Filmpje</button>
        </div>
        <div style={{background:'var(--card)',borderRadius:'var(--radius)',boxShadow:'var(--shadow)',overflow:'hidden'}}>
          <div style={{padding:'14px 20px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div style={{fontFamily:'Montserrat',fontSize:'12px',fontWeight:'700',letterSpacing:'.1em',textTransform:'uppercase',color:'var(--text-3)'}}>Filmpjes in batch ({total})</div>
            <div style={{fontSize:'12px',color:'var(--text-3)'}}>{done}/{total} klaar · {Math.round(done/Math.max(total,1)*100)}%</div>
          </div>
          <div style={{overflowX:'auto'}}>
            <table className="ws-table">
              <thead>
                <tr>
                  {['#','Bestandsnaam','Edit Fase','Assets Drive','Export Frame.io','📝 Script','📁 Brand Assets','🎬 Shotlist','📋 SOP','Notities',''].map(h=>(
                    <th key={h} className="ws-th">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {batch.videos.map((v,i) => {
                  const shots = v.shotlist||[];
                  const done = shots.filter(s=>s.done).length;
                  const ef = FASE_MAP[v.editFase];
                  return (
                    <tr key={v._id} className="ws-tr ws-vid-row">
                      <td className="ws-td"><div className="ws-td-inner" style={{color:'var(--text-3)',fontSize:'11px',fontWeight:'600'}}>{i+1}</div></td>
                      <td className="ws-td"><div className="ws-td-inner" style={{gap:'8px'}}>
                        <span style={{fontSize:'12px'}}>📄</span>
                        <span style={{fontSize:'12px',fontWeight:'500'}}>{v.name}</span>
                      </div></td>
                      <td className="ws-td" style={{padding:0}}>
                        <div style={{padding:'4px 8px'}}>
                          {ef && <span className={`ws-pill ${ef.cls}`}>{ef.label}</span>}
                          <FaseSelect value={v.editFase} onChange={val=>updateMut.mutate({bId:batch._id,vId:v._id,editFase:val})} />
                        </div>
                      </td>
                      <EditCell value={v.assets} placeholder="+ Drive link" onSave={val=>updateMut.mutate({bId:batch._id,vId:v._id,assets:val})} isLink />
                      <EditCell value={v.export} placeholder="+ Frame.io link" onSave={val=>updateMut.mutate({bId:batch._id,vId:v._id,export:val})} isLink />
                      <td className="ws-td" onClick={()=>openScript(v)}>
                        <div className="ws-td-inner">
                          {v.script
                            ? <span style={{fontSize:'12px',color:'var(--text-2)'}}>Open script</span>
                            : <span style={{fontSize:'11px',color:'var(--text-3)',fontStyle:'italic'}}>Script toevoegen…</span>}
                        </div>
                      </td>
                      <EditCell value={v.driveLink} placeholder="Drive link…" onSave={val=>updateMut.mutate({bId:batch._id,vId:v._id,driveLink:val})} isLink />
                      <td className="ws-td" onClick={()=>openShotlist(v)}>
                        <div className="ws-td-inner" style={{flexDirection:'column',gap:'3px'}}>
                          {shots.length > 0 ? (
                            <>
                              <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
                                <div style={{flex:1,height:'5px',background:'var(--border)',borderRadius:'3px',overflow:'hidden'}}>
                                  <div style={{height:'100%',background:'var(--sage)',width:`${Math.round(done/shots.length*100)}%`}}/>
                                </div>
                                <span style={{fontSize:'11px',fontWeight:'700',color:'var(--sage)',whiteSpace:'nowrap'}}>{done}/{shots.length}</span>
                              </div>
                            </>
                          ) : <span style={{fontSize:'11px',color:'var(--text-3)',fontStyle:'italic'}}>Shotlist aanmaken…</span>}
                        </div>
                      </td>
                      <td className="ws-td" onClick={()=>openSop(v)}>
                        <div className="ws-td-inner">
                          {(v.sop?.ratioTags||[]).slice(0,1).map(t=>(
                            <span key={t} style={{fontSize:'9px',fontWeight:'700',padding:'2px 6px',borderRadius:'10px',background:'var(--accent-pale)',color:'var(--accent)'}}>{t}</span>
                          ))}
                          {!(v.sop?.ratioTags?.length) && <span style={{fontSize:'11px',color:'var(--text-3)',fontStyle:'italic'}}>SOP invullen…</span>}
                        </div>
                      </td>
                      <EditCell value={v.notes} placeholder="Notitie…" onSave={val=>updateMut.mutate({bId:batch._id,vId:v._id,notes:val})} />
                      <td className="ws-td">
                        <div style={{display:'flex',alignItems:'center',gap:'4px'}}>
                          {v.editFase==='client_approved'
                            ? <span style={{fontSize:'10px',color:'var(--sage)',fontWeight:'700',whiteSpace:'nowrap'}}>✓ Klant akkoord</span>
                            : v.editFase==='waitreview'||v.editFase==='client_review'||v.editFase==='client_revision'
                            ? <span style={{fontSize:'10px',color:'var(--blue)',fontWeight:'700',whiteSpace:'nowrap'}}>👁 Bij klant</span>
                            : v.editFase==='intern_approved'
                            ? <button style={{background:'var(--blue)',border:'none',borderRadius:'6px',cursor:'pointer',color:'white',fontSize:'10px',fontWeight:'700',padding:'3px 7px',whiteSpace:'nowrap',fontFamily:'inherit'}}
                                onClick={()=>updateMut.mutate({bId:batch._id,vId:v._id,editFase:'waitreview'})}>→ Stuur naar klant</button>
                            : <button style={{background:'none',border:'1px solid var(--border)',borderRadius:'6px',cursor:'pointer',color:'var(--text-3)',fontSize:'10px',fontWeight:'700',padding:'3px 7px',whiteSpace:'nowrap',fontFamily:'inherit'}}
                                onClick={()=>updateMut.mutate({bId:batch._id,vId:v._id,editFase:'waitreview'})}>→ Portaal</button>
                          }
                          <button style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-3)',fontSize:'13px',padding:'3px'}}
                            onClick={async()=>{if(confirm('Video verwijderen?')){await deleteVideo(batch._id,v._id);qc.invalidateQueries(['batches']);}}}>✕</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="view active">
        <div className="page-header">
          <div><div className="page-title">Workspace</div><div className="page-subtitle">{batches.length} actieve projecten</div></div>
          <button className="btn btn-primary" onClick={()=>setShowBatchModal(true)}>+ Nieuwe batch</button>
        </div>
        <div>
          {batches.map(b => {
            const tot = b.videos?.length||0;
            const done = (b.videos||[]).filter(v=>v.editFase==='finished').length;
            return (
              <div key={b._id} className="ws-batch-row" onClick={()=>setBatchId(b._id)}>
                <div style={{fontSize:'28px',flexShrink:0}}>{b.emoji}</div>
                <div style={{flex:1}}>
                  <div className="ws-batch-name">{b.name}</div>
                  <div className="ws-batch-meta">{b.client} · {b.editor} · Deadline: {b.deadline}</div>
                </div>
                <div style={{textAlign:'right',flexShrink:0}}>
                  <div style={{fontSize:'13px',fontWeight:'500',marginBottom:'5px'}}>{done}/{tot} video's</div>
                  <div style={{width:'100px',height:'4px',background:'var(--border)',borderRadius:'2px',overflow:'hidden'}}>
                    <div style={{height:'100%',background:'var(--sage)',width:`${Math.round(done/Math.max(tot,1)*100)}%`}}/>
                  </div>
                </div>
                <div style={{color:'var(--text-3)',fontSize:'18px',marginLeft:'8px'}}>›</div>
              </div>
            );
          })}
        </div>
      </section>

      {scriptVideo && (
        <div id="script-overlay" className="open" onMouseDown={()=>setScriptVideo(null)}>
          <div id="script-box" onMouseDown={(e)=>e.stopPropagation()}>
            <div id="script-head">
              <div id="script-head-title">Script — {scriptVideo.name}</div>
              <button className="modal-close" onClick={()=>setScriptVideo(null)}>✕</button>
            </div>
            <textarea id="script-textarea" value={scriptDraft} onChange={(e)=>setScriptDraft(e.target.value)} />
            <div id="script-foot">
              <div id="script-char-count">{scriptWords} woorden · {scriptDraft.length} tekens</div>
              <button className="btn btn-primary btn-sm" onClick={saveScript}>Opslaan</button>
            </div>
          </div>
        </div>
      )}

      {shotVideo && (
        <div id="sl-overlay" ref={shotOverlayRef} className={`open${shootMode ? ' shootmode' : ''}`} onMouseDown={()=>setShotVideo(null)}>
          <div id="sl-box" onMouseDown={(e)=>e.stopPropagation()}>
            <div id="sl-head">
              <div id="sl-head-title">Shotlist — {shotVideo.name}</div>
              <button className="modal-close" onClick={()=>setShotVideo(null)}>✕</button>
            </div>
            <div id="sl-progress-wrap">
              <div id="sl-progress-bar">
                <div
                  id="sl-progress-fill"
                  style={{
                    width: `${Math.round(((shotVideo.shotlist||[]).filter((s)=>s.done).length / Math.max((shotVideo.shotlist||[]).length,1))*100)}%`,
                  }}
                />
              </div>
              <div id="sl-progress-txt">
                {(shotVideo.shotlist||[]).filter((s)=>s.done).length}/{(shotVideo.shotlist||[]).length} voltooid
              </div>
            </div>
            <div id="sl-content">
              <div id="sl-list-side">
                <div id="sl-list-wrap">
                  {(shotVideo.shotlist || []).map((s, i) => (
                    <div key={`${s.text}-${i}`} className={`sl-item${s.done?' done':''}`} onClick={()=>toggleShot(i)}>
                      <div className="sl-cb">{s.done ? '✓' : ''}</div>
                      <div className="sl-num">{String(i+1).padStart(2,'0')}</div>
                      <div className="sl-text">{s.text}</div>
                      <button className="sl-del" onClick={(e)=>{e.stopPropagation();removeShot(i);}}>✕</button>
                    </div>
                  ))}
                </div>
                <div id="sl-add-row">
                  <input
                    id="sl-add-inp"
                    value={shotDraft}
                    onChange={(e)=>setShotDraft(e.target.value)}
                    placeholder="Nieuwe shot toevoegen..."
                    onKeyDown={(e)=>{if(e.key==='Enter'){e.preventDefault();addShot();}}}
                  />
                  <button id="sl-add-btn" onClick={addShot}>Toevoegen</button>
                </div>
              </div>
              <div id="sl-script-side">
                <div style={{padding:'14px 18px',borderBottom:'1px solid var(--border)',fontWeight:700,fontSize:'12px',letterSpacing:'.08em',textTransform:'uppercase',color:'var(--text-3)'}}>Script</div>
                <div id="sl-script-panel">{shotVideo.script || 'Geen script toegevoegd voor deze video.'}</div>
              </div>
            </div>
            <div id="sl-foot">
              <button className={`sl-shootbtn${shootMode ? ' on':''}`} onClick={toggleShootMode}>🎬 Shoot Mode</button>
              <button className="sl-reset-btn" onClick={resetShots}>Reset checks</button>
            </div>
          </div>
        </div>
      )}

      {sopVideo && sopDraft && (
        <div id="sop-overlay" className="open" onMouseDown={()=>setSopVideo(null)}>
          <div id="sop-box" onMouseDown={(e)=>e.stopPropagation()}>
            <div id="sop-head">
              <div id="sop-head-title">SOP — {sopVideo.name}</div>
              <button className="modal-close" onClick={()=>setSopVideo(null)}>✕</button>
            </div>
            <div id="sop-body">
              <div className="sop-card">
                <div className="sop-card-title">Format & Stijl</div>
                <label className="sop-lbl">Ratio tags</label>
                <div className="sop-tags">
                  {ratioOptions.map((tag)=>(
                    <button key={tag} className={`sop-tag${(sopDraft.ratioTags||[]).includes(tag) ? ' on' : ''}`} onClick={()=>toggleTag('ratioTags', tag)}>{tag}</button>
                  ))}
                </div>
                <label className="sop-lbl">Stijl tags</label>
                <div className="sop-tags">
                  {styleOptions.map((tag)=>(
                    <button key={tag} className={`sop-tag${(sopDraft.stijlTags||[]).includes(tag) ? ' on' : ''}`} onClick={()=>toggleTag('stijlTags', tag)}>{tag}</button>
                  ))}
                </div>
                <label className="sop-lbl">Kleurprofiel</label>
                <input className="sop-inp" value={sopDraft.kleurprofiel} onChange={(e)=>setSopDraft({...sopDraft,kleurprofiel:e.target.value})} />
              </div>
              <div className="sop-card">
                <div className="sop-card-title">Instructies</div>
                <label className="sop-lbl">Muziek</label>
                <input className="sop-inp" value={sopDraft.muziek} onChange={(e)=>setSopDraft({...sopDraft,muziek:e.target.value})} />
                <label className="sop-lbl">Extra editor notes</label>
                <textarea className="sop-ta" value={sopDraft.extraNotes} onChange={(e)=>setSopDraft({...sopDraft,extraNotes:e.target.value})} />
                <label className="sop-lbl">Format notitie</label>
                <textarea className="sop-ta" value={sopDraft.format} onChange={(e)=>setSopDraft({...sopDraft,format:e.target.value})} />
              </div>
            </div>
            <div id="sop-foot">
              <span style={{fontSize:'12px',color:'var(--text-3)'}}>SOP wordt opgeslagen per video.</span>
              <button className="btn btn-primary btn-sm" onClick={saveSop}>Opslaan</button>
            </div>
          </div>
        </div>
      )}

      {showBatchModal && (
        <div className="modal-overlay open" onMouseDown={()=>setShowBatchModal(false)}>
          <div className="modal" onMouseDown={(e)=>e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Nieuwe batch</div>
              <button className="modal-close" onClick={()=>setShowBatchModal(false)}>✕</button>
            </div>
            <div className="form-group">
              <label className="form-label">Naam</label>
              <input className="form-input" value={newBatch.name} onChange={(e)=>setNewBatch({...newBatch,name:e.target.value})} placeholder="Bijv. Kalea Clinic - Mei Shoot" />
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
              <div className="form-group">
                <label className="form-label">Klant</label>
                <input className="form-input" value={newBatch.client} onChange={(e)=>setNewBatch({...newBatch,client:e.target.value})} placeholder="Client naam" />
              </div>
              <div className="form-group">
                <label className="form-label">Editor</label>
                <input className="form-input" value={newBatch.editor} onChange={(e)=>setNewBatch({...newBatch,editor:e.target.value})} placeholder="Paolo / Lex" />
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'120px 1fr',gap:'12px'}}>
              <div className="form-group">
                <label className="form-label">Emoji</label>
                <input className="form-input" value={newBatch.emoji} onChange={(e)=>setNewBatch({...newBatch,emoji:e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Deadline</label>
                <input type="date" className="form-input" value={newBatch.deadline} onChange={(e)=>setNewBatch({...newBatch,deadline:e.target.value})} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={()=>setShowBatchModal(false)}>Annuleren</button>
              <button className="btn btn-primary" disabled={!newBatch.name.trim() || createBatchMut.isPending} onClick={createNewBatch}>Aanmaken</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function EditCell({ value, placeholder, onSave, isLink, multiline, preview }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value||'');
  if (editing) {
    return (
      <td className="ws-td">
        {multiline
          ? <textarea autoFocus value={val} onChange={e=>setVal(e.target.value)}
              onBlur={()=>{onSave(val);setEditing(false);}}
              style={{width:'100%',minHeight:'60px',border:'1.5px solid var(--accent)',borderRadius:'5px',padding:'5px 8px',fontSize:'12px',fontFamily:'inherit',resize:'vertical',boxSizing:'border-box'}} />
          : <input autoFocus value={val} onChange={e=>setVal(e.target.value)}
              onBlur={()=>{onSave(val);setEditing(false);}}
              onKeyDown={e=>{if(e.key==='Enter'){onSave(val);setEditing(false);}if(e.key==='Escape'){setVal(value||'');setEditing(false);}}}
              style={{width:'100%',border:'1.5px solid var(--accent)',borderRadius:'5px',padding:'5px 8px',fontSize:'12px',fontFamily:'inherit',boxSizing:'border-box'}} />
        }
      </td>
    );
  }
  const display = value ? (preview ? value.slice(0,preview)+(value.length>preview?'…':'') : value) : null;
  return (
    <td className="ws-td" onClick={()=>setEditing(true)}>
      <div className="ws-td-inner" style={{cursor:'pointer'}}>
        {display
          ? (isLink ? <a href={`https://${value}`} target="_blank" rel="noopener" style={{fontSize:'11px',color:'var(--blue)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',display:'block',maxWidth:'130px'}} onClick={e=>e.stopPropagation()}>🔗 {display}</a>
                    : <span style={{fontSize:'12px',color:'var(--text-2)'}}>{display}</span>)
          : <span style={{fontSize:'11px',color:'var(--text-3)',fontStyle:'italic'}}>{placeholder}</span>
        }
      </div>
    </td>
  );
}
