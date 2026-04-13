import { useQuery } from '@tanstack/react-query';
import { getPulse } from '../../api';

export default function PulseView() {
  const { data: pulse, isLoading, refetch } = useQuery({ queryKey:['pulse'], queryFn: getPulse });

  if (isLoading) return <section className="view active"><div style={{padding:'40px',color:'var(--text-3)'}}>Laden…</div></section>;
  if (!pulse) return null;

  const kpis = [
    { icon:'👥', label:'Actieve klanten',       value: pulse.totalClients,   color:'var(--blue)' },
    { icon:'🎬', label:"Video's in productie",  value: pulse.totalVideos,    color:'var(--accent)' },
    { icon:'⏳', label:'In review bij klant',   value: pulse.inReview,       color:'var(--amber)' },
    { icon:'📷', label:'Shoots gepland',         value: pulse.shootsPlanned,  color:'var(--sage)' },
    { icon:'⚠️', label:'Urgent klanten',         value: pulse.urgentClients,  color:'var(--orange)' },
    { icon:'✅', label:"Video's afgerond",       value: pulse.finished,       color:'var(--sage)' },
  ];

  const pipeline = [
    { l:'In Progress', c: pulse.pipelineCounts?.inprogress||0, col:'var(--blue)' },
    { l:'Ready',       c: pulse.pipelineCounts?.ready||0,       col:'var(--amber)' },
    { l:'In Review',   c: pulse.inReview,                       col:'var(--accent)' },
    { l:'Finished',    c: pulse.finished,                       col:'var(--sage)' },
  ];

  const editors = Object.entries(pulse.editorLoad||{});
  const capacityBase = Math.max(pulse.totalVideos || 0, 1);
  const capacityPct = Math.min(100, Math.round(((pulse.inProgress || 0) + (pulse.inReview || 0)) / capacityBase * 100));
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const dashoffset = circumference - (capacityPct / 100) * circumference;

  return (
    <section className="view active">
      <div className="page-header">
        <div><div className="page-title">Studio Pulse</div><div className="page-subtitle">Live bedrijfsgezondheid</div></div>
        <button className="btn btn-ghost" onClick={refetch}>↺ Vernieuwen</button>
      </div>

      {/* KPI grid */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'20px',marginBottom:'28px'}}>
        {kpis.map(k => (
          <div key={k.label} style={{background:'var(--card)',borderRadius:'var(--radius)',padding:'24px 22px',boxShadow:'var(--shadow)'}}>
            <div style={{fontSize:'22px',marginBottom:'10px'}}>{k.icon}</div>
            <div style={{fontFamily:'Montserrat',fontSize:'42px',fontWeight:'400',lineHeight:'1',color:k.color,marginBottom:'4px'}}>{k.value}</div>
            <div style={{fontSize:'12px',color:'var(--text-3)'}}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Editor workload */}
      {editors.length > 0 && (
        <div style={{background:'var(--card)',borderRadius:'var(--radius)',padding:'24px',boxShadow:'var(--shadow)',marginBottom:'20px'}}>
          <div style={{fontFamily:'Montserrat',fontSize:'18px',fontWeight:'500',marginBottom:'18px'}}>Editor workload</div>
          {editors.map(([name,load]) => {
            const total = load.active + load.reviewing;
            const pct = Math.min(100, Math.round(total/6*100));
            const barColor = pct>80?'var(--accent)':pct>50?'var(--amber)':'var(--sage)';
            const color = name==='Paolo'?'var(--accent)':name==='Lex'?'var(--sage)':'var(--blue)';
            const ini = name==='Ray'?'Ra':name[0];
            return (
              <div key={name} style={{display:'flex',alignItems:'center',gap:'14px',marginBottom:'14px'}}>
                <div style={{width:'36px',height:'36px',borderRadius:'9px',background:color,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Montserrat',fontSize:'12px',fontWeight:'600',color:'white',flexShrink:0}}>{ini}</div>
                <div style={{flex:1}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:'5px'}}>
                    <div style={{fontSize:'13px',fontWeight:'500'}}>{name}</div>
                    <div style={{fontSize:'12px',color:'var(--text-3)'}}>{total} video's</div>
                  </div>
                  <div style={{height:'6px',background:'var(--border)',borderRadius:'3px',overflow:'hidden'}}>
                    <div style={{height:'100%',background:barColor,width:`${pct}%`,borderRadius:'3px'}}/>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pipeline */}
      <div style={{background:'var(--card)',borderRadius:'var(--radius)',padding:'24px',boxShadow:'var(--shadow)'}}>
        <div style={{fontFamily:'Montserrat',fontSize:'18px',fontWeight:'500',marginBottom:'18px'}}>Video pipeline</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'14px'}}>
          {pipeline.map(p => (
            <div key={p.l} style={{textAlign:'center',padding:'18px',background:'var(--bg-alt)',borderRadius:'var(--radius-sm)',border:'1px solid var(--border)'}}>
              <div style={{fontFamily:'Montserrat',fontSize:'32px',fontWeight:'400',color:p.col,lineHeight:'1'}}>{p.c}</div>
              <div style={{fontSize:'11px',color:'var(--text-3)',marginTop:'4px'}}>{p.l}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{background:'var(--card)',borderRadius:'var(--radius)',padding:'24px',boxShadow:'var(--shadow)',marginTop:'20px',display:'flex',alignItems:'center',gap:'24px'}}>
        <div style={{position:'relative',width:'140px',height:'140px',flexShrink:0}}>
          <svg width="140" height="140" viewBox="0 0 140 140">
            <circle cx="70" cy="70" r={radius} fill="none" stroke="var(--border)" strokeWidth="12" />
            <circle
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashoffset}
              transform="rotate(-90 70 70)"
            />
          </svg>
          <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column'}}>
            <div style={{fontFamily:'Montserrat',fontSize:'28px',fontWeight:'700',lineHeight:'1'}}>{capacityPct}%</div>
            <div style={{fontSize:'11px',color:'var(--text-3)'}}>Capaciteit</div>
          </div>
        </div>
        <div>
          <div style={{fontFamily:'Montserrat',fontSize:'18px',fontWeight:'500',marginBottom:'6px'}}>Studio capaciteit meter</div>
          <div style={{fontSize:'13px',color:'var(--text-2)',lineHeight:'1.6'}}>
            Gebaseerd op actieve productie + in-review videos versus totale videoload.
          </div>
          <div style={{marginTop:'10px',fontSize:'12px',color:'var(--text-3)'}}>
            In productie: <strong>{pulse.inProgress || 0}</strong> · In review: <strong>{pulse.inReview || 0}</strong> · Totaal: <strong>{pulse.totalVideos || 0}</strong>
          </div>
        </div>
      </div>
    </section>
  );
}
