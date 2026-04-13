import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { getPortalMe, sendClientNote, approveVideo, requestRevision, saveQuestionnaire } from '../../api';

const MONTHS_NL = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
function fmtDate(ds) {
  if(!ds) return '—';
  try { const p=ds.split('-'); return `${parseInt(p[2])} ${MONTHS_NL[parseInt(p[1])-1]} ${p[0]}`; }
  catch(e){ return ds; }
}

// ── QUESTIONNAIRE ─────────────────────────────────────────────
const Q_TOPICS = [
  { num:1, title:'Introductie bedrijf', fields:[
    { key:'intro_beschrijving', label:'Beschrijf jullie bedrijf in één duidelijke alinea', type:'textarea', ph:'Onze visie is…' },
    { key:'intro_diensten', label:'Wat zijn jullie diensten / producten?', type:'textarea', ph:'Wij verkopen / leveren…' },
    { key:'intro_usps', label:"Wat zijn jullie USP's vergeleken met de concurrenten?", type:'textarea', ph:'Wij onderscheiden ons doordat…' },
    { key:'intro_positionering', label:'Positionering', type:'radio', options:['Premium','Mid-range','Budget'] },
  ]},
  { num:2, title:'Doelgroep Analyse', fields:[
    { key:'dg_resultaten', label:'Welke resultaten willen jullie klanten bereiken?', type:'textarea', ph:'Onze klanten willen…' },
    { key:'dg_frustraties', label:'Wat zijn de grootste frustraties van jullie ideale klant?', type:'textarea', ph:'Voor ze bij ons kwamen hadden ze…' },
    { key:'dg_minder_focus', label:'Op welk type klanten willen jullie minder focussen?', type:'textarea', ph:'Wij willen minder focussen op…' },
    { key:'dg_ideaal', label:'Wie is jullie ideale doelgroep?', type:'textarea', ph:'Onze ideale klant is…', hint:'Leeftijd, interesses, locatie, gedrag' },
    { key:'dg_doel', label:"Wat is het voornaamste doel met deze video's?", type:'textarea', ph:'bijv. meer bereik, merkautoriteit, productverkoop…' },
  ]},
  { num:3, title:'Content Strategie', fields:[
    { key:'cs_strategie', label:'Hebben jullie al een bestaande contentstrategie?', type:'radio', options:['Nee','Gedeeltelijk','We weten het niet zeker','Anders:'] },
    { key:'cs_onderwerpen', label:'Welke onderwerpen moeten sowieso terugkomen?', type:'textarea', ph:'bijv. workouts, voeding, community…' },
    { key:'cs_boodschap', label:'Wat is de kernboodschap die jullie willen overbrengen?', type:'textarea', ph:'bijv. inspireren, informeren, amuseren of overtuigen…' },
    { key:'cs_inspiratie', label:'Hebben jullie bestaande content of inspiratie-accounts?', type:'textarea', ph:'bijv. https://instagram.com/…', hint:'Voeg eventueel links toe' },
    { key:'cs_type', label:'Welk type content hebben jullie in gedachte?', type:'checkbox', options:['Organische content (uitleg, amuserend, Q&A)','Product showcase (montage locatie/producten)','Meta Ads (Instagram / Facebook advertenties)','Anders:'] },
    { key:'cs_stijl', label:'Wat is jullie gewenste videostijl?', type:'checkbox', options:['Informeel en persoonlijk, amuserend (personal branding)','Hypegericht en dynamisch (trends, influencer-stijl)','Professioneel en informatief (uitleg/product)','Verkoopgericht (conversie / meta ads)','Anders:'] },
    { key:'cs_transformaties', label:'Hebben jullie klanttransformaties of succesverhalen?', type:'textarea', ph:'Ja / Nee — omschrijf eventueel…' },
    { key:'cs_vermijden', label:'Zijn er onderwerpen die we moeten vermijden?', type:'textarea', ph:'bijv. geen concurrentie noemen, geen politiek…' },
    { key:'cs_ads', label:'Zijn jullie van plan om ooit ook ads te draaien?', type:'radio', options:['Nee','Weet ik nog niet','Ja, in de toekomst','Ja, hier wil ik ook gelijk aan werken!'] },
    { key:'cs_verkopen', label:'Welke diensten / producten willen jullie meer verkopen?', type:'textarea', ph:'bijv. personal training, groepslessen…' },
    { key:'cs_pijnpunten', label:'Wat is de grootste reden dat proefleden niet converteren?', type:'textarea', ph:'bijv. prijs, twijfel, geen urgentie…' },
  ]},
  { num:4, title:'Praktische Zaken', fields:[
    { key:'pr_opnames', label:'Op welke dagen kunnen we het beste opnames plannen?', type:'textarea', ph:'bijv. maandag t/m woensdag, ochtend voor 10:00…' },
    { key:'pr_filmen_ok', label:'Zijn leden / klanten ok met filmen op locatie?', type:'radio', options:['Ja','Nee','Anders:'] },
    { key:'pr_camera', label:'Wie is beschikbaar om voor de camera te verschijnen?', type:'textarea', ph:'Naam + functie + of diegene zich comfortabel voelt…' },
    { key:'pr_start', label:'Wanneer zijn jullie beschikbaar om te starten?', type:'radio', options:['Zo snel mogelijk','Binnen 2 weken','Binnen 1 maand','Anders:'] },
  ]},
  { num:5, title:'Afsluiting', fields:[
    { key:'af_brandbook', label:'Hebben jullie een brandbook / huisstijl?', type:'radio', options:['Ja, ik wil dezelfde stijl behouden (stuur naar paolo@4reelagency.nl)','Ja, maar is verouderd (stuur naar paolo@4reelagency.nl)','Nee, laat ik aan jullie'] },
    { key:'af_meta', label:'Beschikken jullie over een actief Meta-account?', type:'radio', options:['Ja (stuur toegang naar info@4reelagency.nl)','Ja, maar de huidige werkt nog niet','Nee, dit moet nog aangemaakt worden'] },
    { key:'af_email', label:'Op welk e-mailadres kunnen wij jullie contacteren?', type:'email', ph:'jouw@email.nl' },
    { key:'af_extra', label:'Is er nog andere relevante informatie?', type:'textarea', ph:'Vrij invulveld — alles wat je kwijt wilt…' },
  ]},
];

function Questionnaire({ clientName, onSubmit }) {
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const saveMut = useMutation({ mutationFn: ({a,s})=>saveQuestionnaire(a,s) });

  const set = (key, val) => {
    const next = {...answers,[key]:val};
    setAnswers(next);
    saveMut.mutate({a:next,s:false});
  };

  const filled = Object.keys(answers).filter(k=>answers[k]&&(Array.isArray(answers[k])?answers[k].length>0:answers[k].trim())).length;
  const pct = Math.min(100, Math.round(filled/15*100));

  if (submitted) return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'100vh',background:'var(--bg)',padding:'40px'}}>
      <div style={{fontSize:'64px',marginBottom:'20px'}}>🎉</div>
      <div style={{fontFamily:'Montserrat',fontSize:'28px',fontWeight:'700',marginBottom:'12px'}}>Vragenlijst ontvangen!</div>
      <div style={{fontSize:'15px',color:'var(--text-3)',textAlign:'center',maxWidth:'440px',marginBottom:'32px',lineHeight:'1.6'}}>Bedankt voor het invullen. Het 4REEL team gaat hiermee aan de slag en neemt snel contact met je op.</div>
      <button onClick={onSubmit} style={{background:'var(--accent)',color:'white',border:'none',borderRadius:'10px',padding:'14px 32px',fontFamily:'Montserrat',fontSize:'15px',fontWeight:'700',cursor:'pointer'}}>Naar mijn portaal →</button>
    </div>
  );

  return (
    <div style={{minHeight:'100vh',background:'var(--bg)'}}>
      {/* Header */}
      <div style={{background:'var(--sidebar)',padding:'20px 32px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div>
          <div style={{fontFamily:'Montserrat',fontSize:'20px',fontWeight:'700',color:'white',letterSpacing:'.12em'}}>4REEL — Onboarding</div>
          <div style={{fontSize:'12px',color:'rgba(255,255,255,.5)',marginTop:'2px'}}>{clientName}</div>
        </div>
        <div style={{textAlign:'right'}}>
          <div style={{fontSize:'12px',color:'rgba(255,255,255,.6)',marginBottom:'4px'}}>{pct}%</div>
          <div style={{width:'180px',height:'4px',background:'rgba(255,255,255,.15)',borderRadius:'2px'}}>
            <div style={{height:'100%',background:'var(--accent)',borderRadius:'2px',width:`${pct}%`,transition:'width .4s'}}/>
          </div>
        </div>
      </div>

      <div style={{maxWidth:'720px',margin:'0 auto',padding:'40px 24px 100px'}}>
        {/* Banner */}
        <div style={{background:'linear-gradient(135deg,var(--accent),#E07830)',borderRadius:'14px',padding:'20px 24px',marginBottom:'28px',display:'flex',gap:'16px',alignItems:'center'}}>
          <div style={{fontSize:'28px',flexShrink:0}}>👋</div>
          <div>
            <div style={{fontFamily:'Montserrat',fontSize:'15px',fontWeight:'700',color:'white',marginBottom:'3px'}}>Welkom bij 4REEL! Vul de onboarding in</div>
            <div style={{fontSize:'12px',color:'rgba(255,255,255,.8)'}}>We hebben een paar vragen nodig om jouw contentstrategie perfect af te stemmen. Duurt ca. 10-15 minuten. Alles wordt automatisch opgeslagen.</div>
          </div>
        </div>

        {Q_TOPICS.map(topic => (
          <div key={topic.num} style={{background:'var(--card)',borderRadius:'16px',boxShadow:'0 2px 16px rgba(28,20,16,.07)',marginBottom:'28px',overflow:'hidden'}}>
            <div style={{background:'var(--sidebar)',padding:'20px 28px',display:'flex',alignItems:'center',gap:'14px'}}>
              <div style={{width:'36px',height:'36px',borderRadius:'50%',background:'var(--accent)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Montserrat',fontSize:'16px',fontWeight:'700',color:'white',flexShrink:0}}>{topic.num}</div>
              <div style={{fontFamily:'Montserrat',fontSize:'16px',fontWeight:'600',color:'white'}}>{topic.title}</div>
            </div>
            <div style={{padding:'24px 28px',display:'flex',flexDirection:'column',gap:'22px'}}>
              {topic.fields.map(field => (
                <div key={field.key}>
                  <div style={{fontSize:'13px',fontWeight:'600',color:'var(--text)',marginBottom:'8px',lineHeight:'1.5'}}>
                    {field.label}
                    {field.hint && <span style={{color:'var(--accent)',fontSize:'11px',fontWeight:'700',background:'var(--accent-pale)',padding:'1px 6px',borderRadius:'10px',marginLeft:'6px'}}>{field.hint}</span>}
                  </div>
                  {(field.type==='textarea') && (
                    <textarea style={{width:'100%',minHeight:'90px',padding:'11px 14px',border:'1.5px solid var(--border)',borderRadius:'9px',fontFamily:'DM Sans,sans-serif',fontSize:'13px',color:'var(--text)',background:'var(--bg-alt)',outline:'none',resize:'vertical',lineHeight:'1.6',boxSizing:'border-box',transition:'border-color .15s'}}
                      placeholder={field.ph} value={answers[field.key]||''}
                      onChange={e=>set(field.key,e.target.value)}
                      onFocus={e=>{e.target.style.borderColor='var(--accent)';e.target.style.background='white';}}
                      onBlur={e=>{e.target.style.borderColor='var(--border)';e.target.style.background='var(--bg-alt)';}} />
                  )}
                  {(field.type==='email') && (
                    <input type="email" style={{width:'100%',padding:'11px 14px',border:'1.5px solid var(--border)',borderRadius:'9px',fontFamily:'DM Sans,sans-serif',fontSize:'13px',outline:'none',background:'var(--bg-alt)',boxSizing:'border-box'}}
                      placeholder={field.ph} value={answers[field.key]||''} onChange={e=>set(field.key,e.target.value)} />
                  )}
                  {field.type==='radio' && (
                    <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                      {field.options.map(opt => {
                        const sel = answers[field.key]===opt;
                        return (
                          <label key={opt} onClick={()=>set(field.key,opt)}
                            style={{display:'flex',alignItems:'flex-start',gap:'10px',padding:'10px 14px',border:`1.5px solid ${sel?'var(--accent)':'var(--border)'}`,borderRadius:'9px',cursor:'pointer',background:sel?'var(--accent-pale)':'var(--bg-alt)',transition:'all .15s'}}>
                            <input type="radio" name={field.key} checked={sel} onChange={()=>{}} style={{flexShrink:0,marginTop:'2px',accentColor:'var(--accent)',width:'16px',height:'16px',cursor:'pointer'}} />
                            <span style={{fontSize:'13px',color:'var(--text)',lineHeight:'1.4'}}>{opt}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                  {field.type==='checkbox' && (
                    <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                      {field.options.map(opt => {
                        const checked = (answers[field.key]||[]).includes(opt);
                        const toggle = () => {
                          const arr = answers[field.key]||[];
                          set(field.key, checked ? arr.filter(x=>x!==opt) : [...arr,opt]);
                        };
                        return (
                          <label key={opt} onClick={toggle}
                            style={{display:'flex',alignItems:'flex-start',gap:'10px',padding:'10px 14px',border:`1.5px solid ${checked?'var(--accent)':'var(--border)'}`,borderRadius:'9px',cursor:'pointer',background:checked?'var(--accent-pale)':'var(--bg-alt)',transition:'all .15s'}}>
                            <input type="checkbox" checked={checked} onChange={()=>{}} style={{flexShrink:0,marginTop:'2px',accentColor:'var(--accent)',width:'16px',height:'16px',cursor:'pointer'}} />
                            <span style={{fontSize:'13px',color:'var(--text)',lineHeight:'1.4'}}>{opt}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{position:'fixed',bottom:0,left:0,right:0,background:'white',borderTop:'2px solid var(--border)',padding:'16px 32px',display:'flex',alignItems:'center',justifyContent:'space-between',zIndex:100,boxShadow:'0 -4px 20px rgba(28,20,16,.08)'}}>
        <div style={{fontSize:'12px',color:'var(--sage)',fontWeight:'600'}}>✓ Automatisch opgeslagen</div>
        <button onClick={async()=>{await saveMut.mutateAsync({a:answers,s:true});setSubmitted(true);}}
          style={{background:'var(--accent)',color:'white',border:'none',borderRadius:'10px',padding:'14px 32px',fontFamily:'Montserrat',fontSize:'15px',fontWeight:'700',cursor:'pointer'}}>
          Vragenlijst versturen →
        </button>
      </div>
    </div>
  );
}

// ── PORTAL MAIN ───────────────────────────────────────────────
export default function PortalClientView() {
  const { user, logout } = useAuth();
  const [note, setNote] = useState('');
  const [revisionModal, setRevisionModal] = useState(null);
  const [revisionNote, setRevisionNote] = useState('');
  const [showQuestionnaire, setShowQuestionnaire] = useState(false);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey:['portalMe'], queryFn: getPortalMe, refetchInterval: 8000 });
  const noteMut     = useMutation({ mutationFn: sendClientNote, onSuccess: ()=>{ setNote(''); qc.invalidateQueries(['portalMe']); }});
  const approveMut  = useMutation({ mutationFn: approveVideo,   onSuccess: ()=>qc.invalidateQueries(['portalMe']) });
  const revisionMut = useMutation({ mutationFn: ({id,n})=>requestRevision(id,n), onSuccess: ()=>{ setRevisionModal(null); setRevisionNote(''); qc.invalidateQueries(['portalMe']); }});

  useEffect(() => {
    if (data && !data.questionnaire?.submitted && !localStorage.getItem(`q_opened_${user?.clientId}`)) {
      localStorage.setItem(`q_opened_${user?.clientId}`, '1');
      setShowQuestionnaire(true);
    }
  }, [data]);

  if (isLoading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'var(--bg)'}}><div style={{fontFamily:'Montserrat',fontSize:'24px',fontWeight:'600',color:'var(--accent)'}}>4REEL</div></div>;

  if (showQuestionnaire) {
    return <Questionnaire clientName={data?.client?.name} onSubmit={()=>{ setShowQuestionnaire(false); qc.invalidateQueries(['portalMe']); }} />;
  }

  const { client={}, notes=[], reviewVideos=[], deliveredBatches=[], retainer } = data||{};
  const initials = (client.name||'').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();

  return (
    <div style={{minHeight:'100vh',background:'var(--bg)'}}>
      {/* Header */}
      <header className="portal-header">
        <div className="portal-header-logo"><span>4REEL</span> Portaal</div>
        <div className="portal-header-client">
          <div className="portal-header-avatar" style={{background:client.color||'var(--accent)'}}>{initials}</div>
          <span>{client.name}</span>
          {!data?.questionnaire?.submitted && (
            <button onClick={()=>setShowQuestionnaire(true)}
              style={{background:'var(--accent)',color:'white',border:'none',borderRadius:'7px',padding:'6px 12px',fontSize:'12px',fontWeight:'700',cursor:'pointer',fontFamily:'inherit'}}>
              📋 Vragenlijst invullen
            </button>
          )}
          <button className="portal-logout" onClick={logout}>Uitloggen</button>
        </div>
      </header>

      <main className="portal-main">
        {/* Welcome */}
        <div className="welcome-card">
          <div className="welcome-emoji">👋</div>
          <div className="welcome-text">
            <h2>Welkom, {client.name?.split(' ')[0]}!</h2>
            <p>{client.welcomeMessage||'Hier vind je alles over je project bij 4REEL.'}</p>
          </div>
        </div>

        {/* Shoot info */}
        {client.shoot && (
          <div className="portal-section">
            <div className="section-header">
              <div className="section-title">📅 Volgende shoot</div>
              <div><span className={`shoot-badge badge-${client.shoot.status||'planned'}`}>{client.shoot.status==='wrapped'?'Afgerond':client.shoot.status==='soon'?'Bijna!':'Gepland'}</span></div>
            </div>
            <div className="section-body">
              <div className="shoot-info">
                <div>
                  <div className="shoot-name">{client.shoot.name}</div>
                  {client.shoot.date && <div className="shoot-detail"><span className="shoot-detail-icon">📅</span><strong>Datum:</strong>&nbsp;{fmtDate(client.shoot.date)}</div>}
                  {client.shoot.location && <div className="shoot-detail"><span className="shoot-detail-icon">📍</span><strong>Locatie:</strong>&nbsp;{client.shoot.location}</div>}
                  {client.shoot.info && <div className="shoot-detail"><span className="shoot-detail-icon">ℹ️</span><span>{client.shoot.info}</span></div>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Videos for review */}
        <div className="portal-section" id="section-review">
          <div className="section-header">
            <div className="section-title">🎬 Video's ter beoordeling</div>
            {reviewVideos.length > 0 && <div style={{fontSize:'12px',color:'var(--text-3)'}}>{reviewVideos.length} wacht{reviewVideos.length===1?'':'en'} op beoordeling</div>}
          </div>
          <div className="section-body">
            {reviewVideos.length === 0
              ? <div className="empty-state"><div className="emoji">✂️</div><p>Geen video's meer ter beoordeling. Kijk bij Opgeleverd voor de downloads!</p></div>
              : reviewVideos.map(v => (
                  <div key={v._id} className={`video-card${v.revision?' revision':''}`}>
                    <div className="video-card-top">
                      <div style={{flex:1}}>
                        <div className="video-name">📄 {v.name}</div>
                        {v.revisionNote && (
                          <div style={{marginTop:'8px',fontSize:'12px',color:'var(--text-2)',padding:'9px 12px',background:'rgba(212,168,75,.12)',borderRadius:'7px',borderLeft:'3px solid var(--amber)'}}>
                            <strong>Jouw revisienoot:</strong> {v.revisionNote}
                          </div>
                        )}
                        {/* Inline revision form */}
                        {revisionModal === v._id && (
                          <div style={{marginTop:'12px'}}>
                            <textarea value={revisionNote} onChange={e=>setRevisionNote(e.target.value)} placeholder="Beschrijf de gewenste aanpassing..." rows={3}
                              style={{width:'100%',padding:'10px 12px',border:'1.5px solid var(--amber)',borderRadius:'8px',fontFamily:'DM Sans,sans-serif',fontSize:'13px',resize:'none',outline:'none',boxSizing:'border-box'}} />
                            <div style={{display:'flex',gap:'8px',marginTop:'8px'}}>
                              <button onClick={()=>revisionMut.mutate({id:v._id,n:revisionNote})} disabled={!revisionNote.trim()}
                                style={{background:'var(--amber)',color:'white',border:'none',borderRadius:'7px',padding:'8px 14px',fontSize:'12px',fontWeight:'700',cursor:'pointer',fontFamily:'inherit'}}>Verstuur revisie</button>
                              <button onClick={()=>{setRevisionModal(null);setRevisionNote('');}}
                                style={{background:'none',border:'1px solid var(--border)',borderRadius:'7px',padding:'8px 14px',fontSize:'12px',cursor:'pointer',fontFamily:'inherit'}}>Annuleren</button>
                            </div>
                          </div>
                        )}
                      </div>
                      <span className="video-status" style={{color:v.revision?'var(--amber)':'var(--text-3)'}}>
                        {v.revision ? '✏️ Revisie gevraagd' : '⏳ Wacht op beoordeling'}
                      </span>
                    </div>
                    <div className="video-actions">
                      {v.frameUrl && <a className="btn-watch" href={v.frameUrl} target="_blank" rel="noopener">▶ Bekijk op Frame.io</a>}
                      <button className="btn-approve" onClick={()=>approveMut.mutate(v._id)}>✓ Goedkeuren</button>
                      <button className="btn-revision" onClick={()=>setRevisionModal(revisionModal===v._id?null:v._id)}>✏ Revisie aanvragen</button>
                    </div>
                  </div>
                ))
            }
          </div>
        </div>

        {/* Delivered */}
        {deliveredBatches.length > 0 && (
          <div className="portal-section" id="section-delivered">
            <div className="section-header">
              <div className="section-title">📦 Opgeleverd & goedgekeurd</div>
              <div style={{fontSize:'12px',color:'var(--sage)'}}>{deliveredBatches.reduce((s,b)=>s+b.videos.length,0)} video's</div>
            </div>
            <div className="section-body">
              {deliveredBatches.map((b,i) => (
                <div key={i} style={{marginBottom:'16px'}}>
                  <div style={{fontFamily:'Montserrat',fontSize:'13px',fontWeight:'600',marginBottom:'8px',color:'var(--text)'}}>{b.name}</div>
                  {b.videos.map((v,j) => (
                    <div key={j} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',background:'var(--bg-alt)',borderRadius:'8px',marginBottom:'6px',border:'1px solid var(--border)'}}>
                      <div style={{fontSize:'13px'}}>✅ {v.name}</div>
                      {v.driveUrl && <a href={v.driveUrl} target="_blank" rel="noopener" style={{fontSize:'12px',color:'var(--blue)',fontWeight:'500'}}>⬇ Download</a>}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Retainer */}
        {retainer && (
          <div className="portal-section">
            <div className="section-header"><div className="section-title">💼 Mijn pakket</div></div>
            <div className="section-body">
              <div style={{display:'flex',alignItems:'center',gap:'12px',padding:'14px 18px',borderRadius:'10px',marginBottom:'16px',background:'var(--sage-light)',border:'1.5px solid var(--sage)'}}>
                <div style={{flex:1}}>
                  <div style={{fontFamily:'Montserrat',fontSize:'15px',fontWeight:'700'}}>{retainer.pakket}</div>
                  {retainer.prijs && <div style={{fontSize:'13px',color:'var(--text-2)',marginTop:'2px'}}>{retainer.prijs}{retainer.periode?` · ${retainer.periode}`:''}</div>}
                </div>
                <span style={{fontSize:'11px',fontWeight:'700',padding:'4px 10px',borderRadius:'20px',background:'var(--sage)',color:'white'}}>Actief</span>
              </div>
              <div style={{background:'var(--bg-alt)',borderRadius:'10px',padding:'14px 18px',border:'1.5px solid var(--border)'}}>
                <div style={{fontSize:'11px',fontWeight:'700',color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:'10px'}}>Wat is inbegrepen</div>
                {retainer.shoots && <div style={{fontSize:'13px',marginBottom:'5px'}}>📷 {retainer.shoots}</div>}
                {retainer.videos && <div style={{fontSize:'13px',marginBottom:'5px'}}>🎬 {retainer.videos}</div>}
                {retainer.extras && <div style={{fontSize:'13px'}}>➕ {retainer.extras}</div>}
              </div>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="portal-section">
          <div className="section-header"><div className="section-title">💬 Berichten & notities</div></div>
          <div className="section-body">
            <div className="notes-list">
              {notes.map(n => (
                <div key={n._id} className={`note-item ${n.from}`}>
                  <div className="note-author">{n.author}</div>
                  <div className="note-text">{n.text}</div>
                  <div className="note-time">{new Date(n.createdAt).toLocaleDateString('nl-NL')}</div>
                </div>
              ))}
              {notes.length===0 && <div style={{fontSize:'13px',color:'var(--text-3)',fontStyle:'italic',padding:'8px 0'}}>Nog geen berichten</div>}
            </div>
            <div className="note-input-row">
              <textarea className="note-input" value={note} onChange={e=>setNote(e.target.value)} placeholder="Stel een vraag of laat een notitie achter…" rows={2}
                onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();if(note.trim())noteMut.mutate(note);}}} />
              <button className="note-send" onClick={()=>{if(note.trim())noteMut.mutate(note);}}>Stuur</button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
