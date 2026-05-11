import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../context/LangContext';
import { getPortalMe, sendClientNote, saveQuestionnaire, approveVideo, requestRevision } from '../../api';
import LoadingSpinner from '../../components/LoadingSpinner';

const MONTHS_NL = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
function fmtDate(ds, lang) {
  if (!ds) return '—';
  const str = String(ds).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
  if (m) {
    const y = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10) - 1;
    const d = parseInt(m[3], 10);
    const dt = new Date(y, mo, d);
    if (!Number.isNaN(dt.getTime())) {
      if (lang === 'en')
        return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      return `${d} ${MONTHS_NL[mo]} ${y}`;
    }
  }
  try {
    const dt = new Date(str);
    if (!Number.isNaN(dt.getTime()))
      return dt.toLocaleDateString(lang === 'en' ? 'en-US' : 'nl-NL', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
  } catch (e) { /* noop */ }
  return str;
}

function workspaceStageTKey(stage) {
  const map = {
    development: 'wsStage_development',
    preproduction: 'wsStage_preproduction',
    shooting: 'wsStage_shooting',
    'post-production': 'wsStage_postproduction',
    completed: 'wsStage_completed',
  };
  return map[stage] || 'wsStage_preproduction';
}

function portalShootBadgeLabel(status, t) {
  if (status === "wrapped") return t("portalShootBadgeWrapped");
  if (status === "soon") return t("portalShootBadgeSoon");
  return t("portalShootBadgePlanned");
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

const Q_TOPICS_EN = [
  { num: 1, title: "Company introduction", fields: [
    { key: "intro_beschrijving", label: "Describe your company in one clear paragraph", type: "textarea", ph: "Our vision is…" },
    { key: "intro_diensten", label: "What are your services / products?", type: "textarea", ph: "We sell / deliver…" },
    { key: "intro_usps", label: "What are your USPs compared to competitors?", type: "textarea", ph: "We stand out because…" },
    { key: "intro_positionering", label: "Positioning", type: "radio", options: ["Premium", "Mid-range", "Budget"] },
  ]},
  { num: 2, title: "Audience analysis", fields: [
    { key: "dg_resultaten", label: "What outcomes do your customers want to achieve?", type: "textarea", ph: "Our customers want to…" },
    { key: "dg_frustraties", label: "What are the biggest frustrations of your ideal customer?", type: "textarea", ph: "Before they came to us they had…" },
    { key: "dg_minder_focus", label: "Which type of customers do you want to focus on less?", type: "textarea", ph: "We want to focus less on…" },
    { key: "dg_ideaal", label: "Who is your ideal audience?", type: "textarea", ph: "Our ideal customer is…", hint: "Age, interests, location, behaviour" },
    { key: "dg_doel", label: "What is the main goal with these videos?", type: "textarea", ph: "e.g. reach, authority, product sales…" },
  ]},
  { num: 3, title: "Content strategy", fields: [
    { key: "cs_strategie", label: "Do you already have a content strategy?", type: "radio", options: ["No", "Partially", "We're not sure", "Other:"] },
    { key: "cs_onderwerpen", label: "Which topics should definitely appear?", type: "textarea", ph: "e.g. workouts, nutrition, community…" },
    { key: "cs_boodschap", label: "What is the core message you want to convey?", type: "textarea", ph: "e.g. inspire, inform, entertain or persuade…" },
    { key: "cs_inspiratie", label: "Do you have existing content or inspiration accounts?", type: "textarea", ph: "e.g. https://instagram.com/…", hint: "Add links if you like" },
    { key: "cs_type", label: "What type of content are you thinking of?", type: "checkbox", options: ["Organic content (explainer, entertaining, Q&A)", "Product showcase (location/product edit)", "Meta Ads (Instagram / Facebook ads)", "Other:"] },
    { key: "cs_stijl", label: "What video style do you prefer?", type: "checkbox", options: ["Informal and personal, entertaining (personal brand)", "Hype-led and dynamic (trends, influencer style)", "Professional and informative (explain/product)", "Sales-focused (conversion / Meta ads)", "Other:"] },
    { key: "cs_transformaties", label: "Do you have customer transformations or success stories?", type: "textarea", ph: "Yes / No — describe if relevant…" },
    { key: "cs_vermijden", label: "Are there topics we should avoid?", type: "textarea", ph: "e.g. no naming competitors, no politics…" },
    { key: "cs_ads", label: "Do you plan to run ads at some point?", type: "radio", options: ["No", "Not sure yet", "Yes, in the future", "Yes, and I want to work on that now!"] },
    { key: "cs_verkopen", label: "Which services / products do you want to sell more of?", type: "textarea", ph: "e.g. personal training, group classes…" },
    { key: "cs_pijnpunten", label: "What is the main reason trial members don't convert?", type: "textarea", ph: "e.g. price, doubt, no urgency…" },
  ]},
  { num: 4, title: "Practical matters", fields: [
    { key: "pr_opnames", label: "On which days is it best to schedule filming?", type: "textarea", ph: "e.g. Mon–Wed, mornings before 10:00…" },
    { key: "pr_filmen_ok", label: "Are members / customers OK with filming on location?", type: "radio", options: ["Yes", "No", "Other:"] },
    { key: "pr_camera", label: "Who is available to appear on camera?", type: "textarea", ph: "Name + role + whether they feel comfortable…" },
    { key: "pr_start", label: "When are you available to get started?", type: "radio", options: ["As soon as possible", "Within 2 weeks", "Within 1 month", "Other:"] },
  ]},
  { num: 5, title: "Closing", fields: [
    { key: "af_brandbook", label: "Do you have a brand book / visual identity?", type: "radio", options: ["Yes, keep the same style (send to paolo@4reelagency.nl)", "Yes, but it's outdated (send to paolo@4reelagency.nl)", "No, we'll leave it to you"] },
    { key: "af_meta", label: "Do you have an active Meta (Facebook) ad account?", type: "radio", options: ["Yes (send access to info@4reelagency.nl)", "Yes, but the current one doesn't work yet", "No, still needs to be created"] },
    { key: "af_email", label: "Which email address can we use to contact you?", type: "email", ph: "you@email.com" },
    { key: "af_extra", label: "Any other relevant information?", type: "textarea", ph: "Free text — anything else we should know…" },
  ]},
];

const Q_FIELDS = Q_TOPICS.flatMap((topic) => topic.fields);
const REQUIRED_Q_KEYS = Q_FIELDS.map((field) => field.key);

function isQuestionnaireValueFilled(value, type) {
  if (type === 'checkbox') return Array.isArray(value) && value.length > 0;
  if (typeof value === 'string') return value.trim().length > 0;
  return false;
}

function getQuestionnaireMissingKeys(answers = {}) {
  return Q_FIELDS.filter((field) => !isQuestionnaireValueFilled(answers[field.key], field.type)).map((field) => field.key);
}

function Questionnaire({ clientName, onSubmit, t, lang }) {
  const topics = lang === "en" ? Q_TOPICS_EN : Q_TOPICS;
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const saveMut = useMutation({ mutationFn: ({a,s})=>saveQuestionnaire(a,s) });

  const set = (key, val) => {
    const next = {...answers,[key]:val};
    setAnswers(next);
    saveMut.mutate({a:next,s:false});
  };

  const missingKeys = getQuestionnaireMissingKeys(answers);
  const remainingCount = missingKeys.length;
  const totalRequired = REQUIRED_Q_KEYS.length;
  const filled = totalRequired - remainingCount;
  const pct = Math.min(100, Math.round((filled / totalRequired) * 100));
  const canSubmit = remainingCount === 0;

  if (submitted) return (
    <div className="portal-questionnaire-success" style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'100vh',background:'var(--bg)',padding:'40px'}}>
      <div style={{fontSize:'64px',marginBottom:'20px'}}>🎉</div>
      <div style={{fontFamily:'Montserrat',fontSize:'28px',fontWeight:'700',marginBottom:'12px'}}>{t('portalQ_successTitle')}</div>
      <div style={{fontSize:'15px',color:'var(--text-3)',textAlign:'center',maxWidth:'440px',marginBottom:'32px',lineHeight:'1.6'}}>{t('portalQ_successBody')}</div>
      <button type="button" onClick={onSubmit} style={{background:'var(--accent)',color:'white',border:'none',borderRadius:'10px',padding:'14px 32px',fontFamily:'Montserrat',fontSize:'15px',fontWeight:'700',cursor:'pointer'}}>{t('portalQ_successBtn')}</button>
    </div>
  );

  return (
    <div className="portal-questionnaire" style={{minHeight:'100vh',background:'var(--bg)'}}>
      {/* Header */}
      <div className="portal-questionnaire-header" style={{background:'var(--sidebar)',padding:'20px 32px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div>
          <div style={{fontFamily:'Montserrat',fontSize:'20px',fontWeight:'700',color:'white',letterSpacing:'.12em'}}>{t('portalQ_headerBrand')}</div>
          <div style={{fontSize:'12px',color:'rgba(255,255,255,.5)',marginTop:'2px'}}>{clientName}</div>
        </div>
        <div className="portal-questionnaire-progress" style={{textAlign:'right'}}>
          <div style={{fontSize:'12px',color:'rgba(255,255,255,.6)',marginBottom:'4px'}}>{pct}%</div>
          <div className="portal-questionnaire-progress-bar" style={{width:'180px',height:'4px',background:'rgba(255,255,255,.15)',borderRadius:'2px'}}>
            <div style={{height:'100%',background:'var(--accent)',borderRadius:'2px',width:`${pct}%`,transition:'width .4s'}}/>
          </div>
        </div>
      </div>

      <div className="portal-questionnaire-content" style={{maxWidth:'720px',margin:'0 auto',padding:'40px 24px 100px'}}>
        {/* Banner */}
        <div className="portal-questionnaire-banner" style={{background:'linear-gradient(135deg,var(--accent),#E07830)',borderRadius:'14px',padding:'20px 24px',marginBottom:'28px',display:'flex',gap:'16px',alignItems:'center'}}>
          <div style={{fontSize:'28px',flexShrink:0}}>👋</div>
          <div>
            <div style={{fontFamily:'Montserrat',fontSize:'15px',fontWeight:'700',color:'white',marginBottom:'3px'}}>{t('portalQ_bannerTitle')}</div>
            <div style={{fontSize:'12px',color:'rgba(255,255,255,.8)'}}>{t('portalQ_bannerBody')}</div>
          </div>
        </div>

        {topics.map(topic => (
          <div key={topic.num} style={{background:'var(--card)',borderRadius:'16px',boxShadow:'0 2px 16px rgba(28,20,16,.07)',marginBottom:'28px',overflow:'hidden'}}>
            <div className="portal-questionnaire-topic-head" style={{background:'var(--sidebar)',padding:'20px 28px',display:'flex',alignItems:'center',gap:'14px'}}>
              <div style={{width:'36px',height:'36px',borderRadius:'50%',background:'var(--accent)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Montserrat',fontSize:'16px',fontWeight:'700',color:'white',flexShrink:0}}>{topic.num}</div>
              <div style={{fontFamily:'Montserrat',fontSize:'16px',fontWeight:'600',color:'white'}}>{topic.title}</div>
            </div>
            <div className="portal-questionnaire-topic-body" style={{padding:'24px 28px',display:'flex',flexDirection:'column',gap:'22px'}}>
              {topic.fields.map(field => {
                const isInvalid = submitAttempted && missingKeys.includes(field.key);
                return (
                <div key={field.key}>
                  <div style={{fontSize:'13px',fontWeight:'600',color:'var(--text)',marginBottom:'8px',lineHeight:'1.5'}}>
                    {field.label}
                    {field.hint && <span style={{color:'var(--accent)',fontSize:'11px',fontWeight:'700',background:'var(--accent-pale)',padding:'1px 6px',borderRadius:'10px',marginLeft:'6px'}}>{field.hint}</span>}
                  </div>
                  {(field.type==='textarea') && (
                    <textarea style={{width:'100%',minHeight:'90px',padding:'11px 14px',border:`1.5px solid ${isInvalid ? '#B94A48' : 'var(--border)'}`,borderRadius:'9px',fontFamily:'DM Sans,sans-serif',fontSize:'13px',color:'var(--text)',background:'var(--bg-alt)',outline:'none',resize:'vertical',lineHeight:'1.6',boxSizing:'border-box',transition:'border-color .15s'}}
                      placeholder={field.ph} value={answers[field.key]||''}
                      onChange={e=>set(field.key,e.target.value)}
                      onFocus={e=>{e.target.style.borderColor='var(--accent)';e.target.style.background='white';}}
                      onBlur={e=>{e.target.style.borderColor=isInvalid?'#B94A48':'var(--border)';e.target.style.background='var(--bg-alt)';}} />
                  )}
                  {(field.type==='email') && (
                    <input type="email" style={{width:'100%',padding:'11px 14px',border:`1.5px solid ${isInvalid ? '#B94A48' : 'var(--border)'}`,borderRadius:'9px',fontFamily:'DM Sans,sans-serif',fontSize:'13px',outline:'none',background:'var(--bg-alt)',boxSizing:'border-box'}}
                      placeholder={field.ph} value={answers[field.key]||''} onChange={e=>set(field.key,e.target.value)} />
                  )}
                  {field.type==='radio' && (
                    <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                      {field.options.map(opt => {
                        const sel = answers[field.key]===opt;
                        return (
                          <label key={opt} onClick={()=>set(field.key,opt)}
                            style={{display:'flex',alignItems:'flex-start',gap:'10px',padding:'10px 14px',border:`1.5px solid ${sel?'var(--accent)':(isInvalid?'#B94A48':'var(--border)')}`,borderRadius:'9px',cursor:'pointer',background:sel?'var(--accent-pale)':'var(--bg-alt)',transition:'all .15s'}}>
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
                            style={{display:'flex',alignItems:'flex-start',gap:'10px',padding:'10px 14px',border:`1.5px solid ${checked?'var(--accent)':(isInvalid?'#B94A48':'var(--border)')}`,borderRadius:'9px',cursor:'pointer',background:checked?'var(--accent-pale)':'var(--bg-alt)',transition:'all .15s'}}>
                            <input type="checkbox" checked={checked} onChange={()=>{}} style={{flexShrink:0,marginTop:'2px',accentColor:'var(--accent)',width:'16px',height:'16px',cursor:'pointer'}} />
                            <span style={{fontSize:'13px',color:'var(--text)',lineHeight:'1.4'}}>{opt}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                  {isInvalid && (
                    <div style={{marginTop:'7px',fontSize:'12px',color:'#B94A48',fontWeight:'600'}}>
                      {t('portalQ_fieldRequired')}
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="portal-questionnaire-footer" style={{position:'fixed',bottom:0,left:0,right:0,background:'white',borderTop:'2px solid var(--border)',padding:'16px 32px',display:'flex',alignItems:'center',justifyContent:'space-between',zIndex:100,boxShadow:'0 -4px 20px rgba(28,20,16,.08)'}}>
        <div style={{fontSize:'12px',color:'var(--sage)',fontWeight:'600'}}>{t('portalQ_footerSaved')}</div>
        <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:'8px'}}>
          {!canSubmit && submitAttempted && (
            <div style={{fontSize:'12px',color:'#B94A48',fontWeight:'600'}}>
              {t('portalQ_footerIncomplete', { n: remainingCount })}
            </div>
          )}
          <button
            type="button"
            className="portal-questionnaire-submit-btn"
            onClick={async()=>{
              setSubmitAttempted(true);
              if (!canSubmit) return;
              await saveMut.mutateAsync({a:answers,s:true});
              setSubmitted(true);
            }}
            disabled={saveMut.isPending || !canSubmit}
            style={{background:(saveMut.isPending || !canSubmit)?'var(--border)':'var(--accent)',color:'white',border:'none',borderRadius:'10px',padding:'14px 32px',fontFamily:'Montserrat',fontSize:'15px',fontWeight:'700',cursor:(saveMut.isPending || !canSubmit)?'not-allowed':'pointer',display:'inline-flex',alignItems:'center',gap:'8px'}}>
            {saveMut.isPending ? <LoadingSpinner size={18} /> : null}
            <span>{t('portalQ_submit')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── PORTAL MAIN ───────────────────────────────────────────────
export default function PortalClientView() {
  const { user, logout } = useAuth();
  const { t, lang, setLang } = useLang();
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [note, setNote] = useState('');
  const [showQuestionnaire, setShowQuestionnaire] = useState(false);
  const [selectedArchiveWorkspaceId, setSelectedArchiveWorkspaceId] = useState(null);
  const [processingVideoId, setProcessingVideoId] = useState(null);
  const [revisionModalVideo, setRevisionModalVideo] = useState(null);
  const [revisionModalNote, setRevisionModalNote] = useState('');
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey:['portalMe'],
    queryFn: getPortalMe,
    refetchInterval: showQuestionnaire ? false : 8000,
  });
  const noteMut     = useMutation({ mutationFn: sendClientNote, onSuccess: ()=>{ setNote(''); qc.invalidateQueries({ queryKey: ['portalMe'] }); }});
  const approveMut = useMutation({
    mutationFn: approveVideo,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portalMe'] });
    },
    onSettled: () => {
      setProcessingVideoId(null);
    },
  });
  const revisionMut = useMutation({
    mutationFn: ({ videoId, note: revisionNote }) => requestRevision(videoId, revisionNote),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portalMe'] });
    },
    onSettled: () => {
      setProcessingVideoId(null);
    },
  });

  const openRevisionModal = (video) => {
    setRevisionModalVideo(video);
    setRevisionModalNote('');
  };

  const closeRevisionModal = () => {
    if (revisionMut.isPending) return;
    setRevisionModalVideo(null);
    setRevisionModalNote('');
  };

  useEffect(() => {
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;

    // Global layout locks body scrolling for dashboard; unlock it for portal page.
    document.documentElement.style.overflow = 'auto';
    document.body.style.overflow = 'auto';

    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
    };
  }, []);

  useEffect(() => {
    if (data && !data.questionnaire?.submitted && !localStorage.getItem(`q_opened_${user?.clientId}`)) {
      localStorage.setItem(`q_opened_${user?.clientId}`, '1');
      setShowQuestionnaire(true);
    }
  }, [data]);

  useEffect(() => {
    const firstWorkspaceId = data?.workspaceArchive?.[0]?._id || null;
    if (!firstWorkspaceId) {
      setSelectedArchiveWorkspaceId(null);
      return;
    }
    const hasCurrentSelection = (data?.workspaceArchive ?? []).some(
      (workspace) => workspace._id === selectedArchiveWorkspaceId,
    );
    if (!hasCurrentSelection) {
      setSelectedArchiveWorkspaceId(firstWorkspaceId);
    }
  }, [data?.workspaceArchive, selectedArchiveWorkspaceId]);

  const reviewVideosGrouped = useMemo(() => {
    const OTHER = "__other__";
    const list = data?.reviewVideos ?? [];
    const m = new Map();
    for (const v of list) {
      const key = v.workspaceName || v.batchName || OTHER;
      if (!m.has(key)) m.set(key, []);
      m.get(key).push(v);
    }
    return Array.from(m.entries());
  }, [data?.reviewVideos]);

  if (isLoading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'var(--bg)'}}><div style={{fontFamily:'Montserrat',fontSize:'24px',fontWeight:'600',color:'var(--accent)'}}>{t('portalLoadingBrand')}</div></div>;

  if (showQuestionnaire) {
    return (
      <>
        <div className="floating-lang-toggle" role="group" aria-label={t('portalQLangAria')}>
          <button
            type="button"
            className={`floating-lang-btn${lang === 'nl' ? ' active' : ''}`}
            onClick={() => setLang('nl')}
          >
            NL
          </button>
          <button
            type="button"
            className={`floating-lang-btn${lang === 'en' ? ' active' : ''}`}
            onClick={() => setLang('en')}
          >
            EN
          </button>
        </div>
        <Questionnaire clientName={data?.client?.name} onSubmit={()=>{ setShowQuestionnaire(false); qc.invalidateQueries({ queryKey: ['portalMe'] }); }} t={t} lang={lang} />
      </>
    );
  }

  const { client={}, notes=[], workspaceCurrent=[], workspaceArchive=[], nextShoot=null, retainer } = data||{};
  const reviewVideos = data?.reviewVideos ?? [];
  const initials = (client.name||'').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  const selectedArchiveWorkspace =
    workspaceArchive.find((workspace) => workspace._id === selectedArchiveWorkspaceId) ||
    workspaceArchive[0] ||
    null;
  const shoot = nextShoot;

  return (
    <div style={{minHeight:'100vh',background:'var(--bg)'}}>
      {/* Header */}
      <header className="portal-header">
        <div className="portal-header-logo"><span>4REEL</span> {t('portalHeaderAfterBrand')}</div>
        <div className="portal-header-client">
          <div className="portal-header-avatar" style={{background:client.color||'var(--accent)'}}>{initials}</div>
          <span className="portal-header-client-name">{client.name}</span>
          <div className="floating-lang-toggle portal-lang-toggle" role="group" aria-label={t('portalQLangAria')}>
            <button
              type="button"
              className={`floating-lang-btn${lang === 'nl' ? ' active' : ''}`}
              onClick={() => setLang('nl')}
            >
              NL
            </button>
            <button
              type="button"
              className={`floating-lang-btn${lang === 'en' ? ' active' : ''}`}
              onClick={() => setLang('en')}
            >
              EN
            </button>
          </div>
          {!data?.questionnaire?.submitted && (
            <button type="button" onClick={()=>setShowQuestionnaire(true)}
              style={{background:'var(--accent)',color:'white',border:'none',borderRadius:'7px',padding:'6px 12px',fontSize:'12px',fontWeight:'700',cursor:'pointer',fontFamily:'inherit'}}>
              {t('portalQuestionnaireBtn')}
            </button>
          )}
          <button type="button" className="portal-logout" onClick={() => setLogoutModalOpen(true)}>
            {t('logout')}
          </button>
        </div>
      </header>

      <main className="portal-main">
        {/* Welcome */}
        <div className="welcome-card">
          <div className="welcome-emoji">👋</div>
          <div className="welcome-text">
            <h2>{t('portalWelcomeHi', { name: client.name?.split(' ')[0] || '—' })}</h2>
            <p>{client.welcomeMessage || t('portalWelcomeDefaultSub')}</p>
          </div>
        </div>

        {/* Shoot info */}
        <div className="portal-section">
          <div className="section-header">
            <div className="section-title">{t('portalNextShootTitle')}</div>
            {!!shoot && (
              <div><span className={`shoot-badge badge-${shoot.status||'planned'}`}>{portalShootBadgeLabel(shoot.status, t)}</span></div>
            )}
          </div>
          <div className="section-body">
            {!shoot ? (
              <div className="empty-state"><div className="emoji">📷</div><p>{t('portalShootEmpty')}</p></div>
            ) : (
              <div className="shoot-info">
                <div>
                  <div className="shoot-name">{shoot.name}</div>
                  {shoot.date && <div className="shoot-detail"><span className="shoot-detail-icon">📅</span><strong>{t('portalShootDateLabel')}</strong>&nbsp;{fmtDate(shoot.date, lang)}</div>}
                  {shoot.shootTime && <div className="shoot-detail"><span className="shoot-detail-icon">🕐</span><strong>{t('portalShootTimeLabel')}</strong>&nbsp;{shoot.shootTime}</div>}
                  {shoot.location && <div className="shoot-detail"><span className="shoot-detail-icon">📍</span><strong>{t('portalShootLocationLabel')}</strong>&nbsp;{shoot.location}</div>}
                  {shoot.info && <div className="shoot-detail"><span className="shoot-detail-icon">ℹ️</span><span>{shoot.info}</span></div>}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Videos for review */}
        <div className="portal-section" id="section-review">
          <div className="section-header">
            <div className="section-title">{t('portalReviewTitle')}</div>
            {reviewVideos.length > 0 && (
              <div style={{fontSize:'12px',color:'var(--text-3)'}}>
                {reviewVideos.length === 1 ? t('portalReviewWaitingOne') : t('portalReviewWaitingMany', { n: reviewVideos.length })}
              </div>
            )}
          </div>
          <div className="section-body">
            {reviewVideos.length > 0 && (
              <div style={{marginBottom:'12px',fontSize:'12px',color:'var(--text-2)',padding:'10px 12px',background:'var(--bg-alt)',border:'1px solid var(--border)',borderRadius:'8px'}}>
                {t('portalReviewHint')}
              </div>
            )}
            {reviewVideos.length === 0
              ? <div className="empty-state"><div className="emoji">✂️</div><p>{t('portalReviewEmpty')}</p></div>
              : reviewVideosGrouped.map(([groupKey, videos]) => {
                  const label = groupKey === '__other__' ? t('portalReviewGroupOther') : groupKey;
                  return (
                    <div key={groupKey} style={{ marginBottom: '22px' }}>
                      <div style={{ fontFamily: 'Montserrat', fontSize: '14px', fontWeight: 700, marginBottom: '12px', color: 'var(--text)', letterSpacing: '.02em' }}>{label}</div>
                      {videos.map((v) => (
                  <div key={v._id} className={`video-card${v.revision?' revision':''}`}>
                    <div className="video-card-top">
                      <div style={{flex:1}}>
                        <div className="video-name">📄 {v.name}</div>
                        {v.revisionNote && (
                          <div style={{marginTop:'8px',fontSize:'12px',color:'var(--text-2)',padding:'9px 12px',background:'rgba(212,168,75,.12)',borderRadius:'7px',borderLeft:'3px solid var(--amber)'}}>
                            <strong>{t('portalReviewRevisionLabel')}</strong> {v.revisionNote}
                          </div>
                        )}
                      </div>
                      <span className="video-status" style={{color:v.revision?'var(--amber)':'var(--text-3)'}}>
                        {v.revision ? t('portalReviewStatusRevision') : t('portalReviewStatusWaiting')}
                      </span>
                    </div>
                    <div className="video-actions" style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
                      {v.frameUrl ? (
                        <a className="btn-watch" href={v.frameUrl} target="_blank" rel="noopener noreferrer">{t('portalReviewFrameBtn')}</a>
                      ) : (
                        <span style={{fontSize:'11px',color:'var(--text-3)',fontStyle:'italic'}}>{t('portalReviewFrameMissing')}</span>
                      )}
                      <button
                        type="button"
                        className="btn-watch"
                        onClick={() => {
                          setProcessingVideoId(v._id);
                          approveMut.mutate(v._id);
                        }}
                        disabled={processingVideoId === v._id}
                        style={{opacity: processingVideoId === v._id ? 0.6 : 1}}
                      >
                        {processingVideoId === v._id && approveMut.isPending ? t('portalReviewBusy') : t('portalReviewApprove')}
                      </button>
                      <button
                        type="button"
                        className="btn-watch"
                        onClick={() => {
                          openRevisionModal(v);
                        }}
                        disabled={processingVideoId === v._id}
                        style={{opacity: processingVideoId === v._id ? 0.6 : 1}}
                      >
                        {processingVideoId === v._id && revisionMut.isPending ? t('portalReviewBusy') : t('portalReviewRevise')}
                      </button>
                    </div>
                  </div>
                      ))}
                    </div>
                  );
                })}
          </div>
        </div>

        {/* Current projects */}
        <div className="portal-section" id="section-current-projects">
          <div className="section-header">
            <div className="section-title">{t('portalCurrentProjectsTitle')}</div>
          </div>
          <div className="section-body">
            {workspaceCurrent.length === 0 ? (
              <div className="empty-state"><div className="emoji">🎬</div><p>{t('portalCurrentProjectsEmpty')}</p></div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {workspaceCurrent.map((ws) => (
                  <div
                    key={ws._id}
                    style={{
                      background: 'var(--card)',
                      border: '1px solid var(--border)',
                      borderRadius: '12px',
                      padding: '16px 18px',
                      boxShadow: '0 2px 12px rgba(28,20,16,.06)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '22px' }}>{ws.emoji || '📁'}</span>
                      <div style={{ fontFamily: 'Montserrat', fontSize: '16px', fontWeight: 700 }}>{ws.name}</div>
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.6 }}>
                      <div><strong>{t('portalCurrentProjectsStage')}</strong> {t(workspaceStageTKey(ws.projectStage))}</div>
                      {ws.shootDate && (
                        <div><strong>{t('portalCurrentProjectsShoot')}</strong> {fmtDate(ws.shootDate, lang)}{ws.shootTime ? ` · ${ws.shootTime}` : ''}</div>
                      )}
                      {ws.deadline && (
                        <div><strong>{t('portalCurrentProjectsDeadline')}</strong> {fmtDate(ws.deadline, lang)}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Workspace archive */}
        <div className="portal-section">
          <div className="section-header">
            <div className="section-title">{t('portalArchiveTitle')}</div>
          </div>
          <div className="section-body">
            {workspaceArchive.length === 0 ? (
              <div className="empty-state">
                <div className="emoji">📁</div>
                <p>{t('portalArchiveEmpty')}</p>
              </div>
            ) : (
              <div className="portal-archive-layout">
                <div className="portal-archive-workspaces">
                  {workspaceArchive.map((workspace) => {
                    const isActive = selectedArchiveWorkspace?._id === workspace._id;
                    const videoCount = workspace.videos?.length || 0;
                    return (
                      <button
                        key={workspace._id}
                        type="button"
                        className={`portal-archive-workspace-btn${isActive ? ' active' : ''}`}
                        onClick={() => setSelectedArchiveWorkspaceId(workspace._id)}
                      >
                        <div className="portal-archive-workspace-top">
                          <span>{workspace.emoji || '📁'}</span>
                          <span>{workspace.name}</span>
                        </div>
                        <div className="portal-archive-workspace-meta">
                          {videoCount === 1
                            ? t('portalArchiveVideoCount', { n: videoCount })
                            : t('portalArchiveVideoCountPlural', { n: videoCount })}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="portal-archive-videos">
                  <div className="portal-archive-videos-header">
                    {selectedArchiveWorkspace?.emoji || '📁'} {selectedArchiveWorkspace?.name || 'Workspace'}
                  </div>
                  {selectedArchiveWorkspace?.videos?.length ? (
                    selectedArchiveWorkspace.videos.map((video) => (
                      <div key={video._id} className="portal-archive-video-row">
                        <div>
                          <div className="portal-archive-video-name">{video.name || t('portalArchiveVideoUnknown')}</div>
                          <div className="portal-archive-video-meta">
                            {t('portalArchiveBatch')} {video.batchName || '—'}
                          </div>
                        </div>
                        <div className="portal-archive-video-actions">
                          {video.frameUrl ? (
                            <a href={video.frameUrl} target="_blank" rel="noopener noreferrer">{t('portalArchiveViewFrame')}</a>
                          ) : (
                            <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>{t('portalArchiveNoLinks')}</span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="empty-state" style={{ marginTop: '10px' }}>
                      <div className="emoji">🎬</div>
                      <p>{t('portalArchiveVideosEmpty')}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Retainer */}
        {retainer && (
          <div className="portal-section">
            <div className="section-header"><div className="section-title">{t('portalRetainerTitle')}</div></div>
            <div className="section-body">
              <div style={{display:'flex',alignItems:'center',gap:'12px',padding:'14px 18px',borderRadius:'10px',marginBottom:'16px',background:'var(--sage-light)',border:'1.5px solid var(--sage)'}}>
                <div style={{flex:1}}>
                  <div style={{fontFamily:'Montserrat',fontSize:'15px',fontWeight:'700'}}>{retainer.pakket}</div>
                  {retainer.prijs && <div style={{fontSize:'13px',color:'var(--text-2)',marginTop:'2px'}}>{retainer.prijs}{retainer.periode?` · ${retainer.periode}`:''}</div>}
                </div>
                <span style={{fontSize:'11px',fontWeight:'700',padding:'4px 10px',borderRadius:'20px',background:'var(--sage)',color:'white'}}>{t('portalRetainerActive')}</span>
              </div>
              <div style={{background:'var(--bg-alt)',borderRadius:'10px',padding:'14px 18px',border:'1.5px solid var(--border)'}}>
                <div style={{fontSize:'11px',fontWeight:'700',color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:'10px'}}>{t('portalRetainerIncluded')}</div>
                {retainer.shoots && <div style={{fontSize:'13px',marginBottom:'5px'}}>📷 {retainer.shoots}</div>}
                {retainer.videos && <div style={{fontSize:'13px',marginBottom:'5px'}}>🎬 {retainer.videos}</div>}
                {retainer.extras && <div style={{fontSize:'13px'}}>➕ {retainer.extras}</div>}
              </div>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="portal-section">
          <div className="section-header"><div className="section-title">{t('portalMessagesTitle')}</div></div>
          <div className="section-body">
            <div className="notes-list">
              {notes.map(n => (
                <div key={n._id} style={{display:'flex',justifyContent:n.from === 'client' ? 'flex-start' : 'flex-end'}}>
                  <div className={`note-bubble ${n.from === 'client' ? 'client' : 'studio'}`}>
                    <div className="note-meta">{n.author} · {new Date(n.createdAt).toLocaleDateString(lang === 'en' ? 'en-US' : 'nl-NL')}</div>
                    {n.text}
                  </div>
                </div>
              ))}
              {notes.length===0 && <div style={{fontSize:'13px',color:'var(--text-3)',fontStyle:'italic',padding:'8px 0'}}>{t('portalMessagesEmpty')}</div>}
            </div>
            <div className="note-input-row">
              <textarea className="note-input" value={note} onChange={e=>setNote(e.target.value)} placeholder={t('portalNotePlaceholder')} rows={2}
                onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();if(note.trim())noteMut.mutate(note);}}} />
              <button
                className="note-send"
                onClick={()=>{if(note.trim())noteMut.mutate(note);}}
                disabled={!note.trim() || noteMut.isPending}
                style={noteMut.isPending ? { display: 'inline-flex', alignItems: 'center', gap: '8px' } : undefined}
              >
                {noteMut.isPending ? (
                  <>
                    <LoadingSpinner size={16} />
                    <span>{t('portalSend')}</span>
                  </>
                ) : (
                  t('portalSend')
                )}
              </button>
            </div>
          </div>
        </div>
      </main>

      {logoutModalOpen && (
        <div className="modal-overlay open" onClick={() => setLogoutModalOpen(false)}>
          <div className="modal" style={{ maxWidth: '460px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{t('logoutConfirmTitle')}</div>
              <button type="button" className="modal-close" onClick={() => setLogoutModalOpen(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '14px', color: 'var(--text-2)', margin: 0, lineHeight: 1.5 }}>
                {t('logoutConfirmBody')}
              </p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setLogoutModalOpen(false)}>
                {t('cancel')}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setLogoutModalOpen(false);
                  logout();
                }}
              >
                {t('logout')}
              </button>
            </div>
          </div>
        </div>
      )}

      {revisionModalVideo && (
        <div className="modal-overlay open" onClick={closeRevisionModal}>
          <div className="modal" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{t('portalRevisionModalTitle')}</div>
              <button type="button" className="modal-close" onClick={closeRevisionModal} disabled={revisionMut.isPending}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '14px', color: 'var(--text-2)', marginTop: 0, marginBottom: '10px', lineHeight: 1.5 }}>
                {t('portalRevisionModalBody')}
              </p>
              <textarea
                value={revisionModalNote}
                onChange={(e) => setRevisionModalNote(e.target.value)}
                rows={4}
                placeholder={t('portalRevisionPlaceholder')}
                style={{ width: '100%', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 12px', fontFamily: 'inherit', fontSize: '14px', resize: 'vertical', boxSizing: 'border-box' }}
              />
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={closeRevisionModal} disabled={revisionMut.isPending}>
                {t('portalRevisionCancel')}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setProcessingVideoId(revisionModalVideo._id);
                  revisionMut.mutate(
                    { videoId: revisionModalVideo._id, note: revisionModalNote },
                    { onSuccess: closeRevisionModal },
                  );
                }}
                disabled={revisionMut.isPending}
                style={revisionMut.isPending ? { display: 'inline-flex', alignItems: 'center', gap: '8px' } : undefined}
              >
                {revisionMut.isPending ? (
                  <>
                    <LoadingSpinner size={16} />
                    <span>{t('portalRevisionProcessing')}</span>
                  </>
                ) : (
                  t('portalRevisionSubmit')
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
