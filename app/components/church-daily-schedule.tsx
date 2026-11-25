'use client';
import {useEffect,useState} from 'react';
import {CalendarDays,BookOpen,Loader2,X} from 'lucide-react';
import {addDays,dateInZone,isDate,isTime,suggestedPostingTime,type ChurchConfig} from '../../lib/church/model';
import {readStudioJson} from '../../lib/client-api';

type Initial={date?:string;time?:string;expectedAccount?:string;singleDate?:boolean};
function shortDate(date:string){return new Intl.DateTimeFormat('en-PH',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));}
const statusNames:any={missing:'Not scheduled',removed:'Removed · new schedule available',draft:'Draft saved',scheduled:'Schedule saved',cancelled:'Cancelled',needs_review:'Needs review',published:'Published',uploading:'Uploading',processing:'Confirming delivery',skipped:'Window passed',paused:'Paused',outdated:'Settings changed',waiting_connection:'Waiting for Facebook'};

export default function ChurchDailySchedule({data,disabled,onCanvaSetup,onSaved,initial,onInitialUsed}:{data:any;disabled:boolean;onCanvaSetup:()=>void;onSaved:()=>Promise<void>;initial?:Initial|null;onInitialUsed:()=>void}){
 const [editing,setEditing]=useState<Initial|null>(initial||null),[canva,setCanva]=useState<any>(null);
 useEffect(()=>{let active=true;fetch('/api/canva/state',{cache:'no-store'}).then(readStudioJson).then(v=>{if(active)setCanva(v)}).catch(()=>{});return()=>{active=false};},[]);
 useEffect(()=>{if(initial){setEditing(initial);onInitialUsed();}},[initial]);
 const config:ChurchConfig=data.config,rows=data.dailyDates||[],dailyTemplate=canva?.templates?.find((t:any)=>t.series==='daily');
 const imageNote=!canva?'Canva image readiness is checked separately from the saved schedule.':!canva.connected?'Canva is not connected in this account.':!canva.enabled?'Automatic Canva generation is paused in this account.':!dailyTemplate?.binding?'Check the saved daily template and its text labels in Canva setup.':'The daily template is checked. Saving a schedule starts Canva preparation; finished PNGs pass automatic checks without an approval click.';
 return <section className="church-daily-planner">
  <div className="church-daily-heading"><div><h3><BookOpen size={17}/>Daily Bible verse</h3><p>{data.signedInEmail||'Sign in to your account'} · {config.timezone}</p></div><button className="btn primary small-btn" disabled={disabled} onClick={()=>setEditing({})}><CalendarDays size={14}/>Schedule today & tomorrow</button></div>
  <div className="church-daily-dates">{rows.map((row:any)=><div key={row.date}><strong>{shortDate(row.date)}</strong><span>{statusNames[row.status]||row.status}{row.scheduled?' · '+new Intl.DateTimeFormat('en-PH',{timeZone:config.timezone,hour:'numeric',minute:'2-digit'}).format(new Date(row.scheduled)):''}</span>{row.reason&&<small>{row.reason}</small>}{row.canSchedule&&<button className="text-link" disabled={disabled} onClick={()=>setEditing({date:row.date,time:config.dailyTime,singleDate:true})}><CalendarDays size={13}/>{row.status==='missing'||row.status==='removed'?'Schedule this date':'Change this time'}</button>}</div>)}</div>
  {!config.dailyEnabled&&<p className="church-daily-note">Daily verse preparation is off. You can enable it when saving the two dates.</p>}
  <p className="church-daily-note">{imageNote} <button className="text-link" onClick={onCanvaSetup}>Check Canva setup</button></p>
  <p className="church-daily-note">“Needs Canva image” means the PNG is missing. A saved date and time alone cannot publish an image post.</p>
  {editing&&<DailyScheduleEditor key={JSON.stringify(editing)} data={data} initial={editing} onClose={()=>setEditing(null)} onSaved={onSaved}/>}
 </section>;
}

function DailyScheduleEditor({data,initial,onClose,onSaved}:{data:any;initial:Initial;onClose:()=>void;onSaved:()=>Promise<void>}){
 const config:ChurchConfig=data.config,today=dateInZone(new Date(),config.timezone);
 const [date,setDate]=useState(initial.date||today),[time,setTime]=useState(suggestedPostingTime(initial.date||today,initial.time||config.dailyTime,config.timezone)),[tomorrow,setTomorrow]=useState(!initial.singleDate),[enable,setEnable]=useState(!config.dailyEnabled),[recurring,setRecurring]=useState(false),[replace,setReplace]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState<any>(null);
 const expected=initial.expectedAccount||data.signedInEmail||'',mismatch=!expected||expected.toLowerCase()!==(data.signedInEmail||'').toLowerCase(),dates=isDate(date)?(tomorrow?[date,addDays(date,1)]:[date]):[];
 const overview=dates.map(d=>{
  const saved=(data.dailyDates||[]).find((r:any)=>r.date===d);if(saved)return saved;
  const active=(data.posts||[]).find((p:any)=>p.series==='daily'&&p.date===d),history=(data.removedPosts||[]).filter((p:any)=>p.series==='daily'&&p.date===d),allowed=history.every((p:any)=>p.replacementAllowed);
  return {date:d,canSchedule:active?active.canSchedule:allowed,canReplaceRemoved:!active&&history.length>0&&allowed,reason:active?.scheduleBlock||(!allowed?'A Facebook upload already started for this date. Check the original delivery.':'')};
 }),removed=overview.some((r:any)=>r.canReplaceRemoved),blocks=overview.filter((r:any)=>!r.canSchedule),allBlocked=blocks.length===overview.length;
 return <div className="modal-overlay" onClick={()=>{if(!busy)onClose()}}><form className="modal church-daily-modal" role="dialog" aria-modal="true" aria-labelledby="daily-schedule-title" onClick={e=>e.stopPropagation()} onSubmit={async e=>{
  e.preventDefault();setBusy(true);setError('');
  try{const response=await fetch('/api/church/daily-schedule',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({expectedAccountEmail:expected,dates,time,enableSeries:enable,useRecurringTime:recurring,restoreCancelled:true,replaceRemoved:replace})});const saved=await readStudioJson(response);setResult(saved);await onSaved();}
  catch(e){setError((e as Error).message);}finally{setBusy(false)}
 }}>
  <button type="button" className="modal-close icon-btn" aria-label="Close daily schedules" disabled={busy} onClick={onClose}><X size={19}/></button>
  <span className="eyebrow">DAILY BIBLE VERSE</span><h2 id="daily-schedule-title">Save your daily verse dates.</h2>
  <p>Account: <strong>{expected||'Sign-in required'}</strong><br/>Timezone: <strong>{config.timezone}</strong></p>
  <div className="field-grid"><label className="field">First posting date<input type="date" required min={today} value={date} disabled={busy||!!result} onChange={e=>setDate(e.target.value)}/></label><label className="field">Daily posting time<input type="time" required step={60} value={time} disabled={busy||!!result} onChange={e=>setTime(e.target.value)}/></label></div>
  <label className="check-label"><input type="checkbox" checked={tomorrow} disabled={busy||!!result} onChange={e=>setTomorrow(e.target.checked)}/>Also schedule the following day</label>
  <div className="church-daily-review">{dates.map(d=><span key={d}>{shortDate(d)} · {time}</span>)}</div>
  {!config.dailyEnabled&&<label className="check-label"><input type="checkbox" checked={enable} disabled={busy||!!result} onChange={e=>setEnable(e.target.checked)}/>Enable daily Bible verse preparation</label>}
  <label className="check-label"><input type="checkbox" checked={recurring} disabled={busy||!!result} onChange={e=>setRecurring(e.target.checked)}/>Use this as the recurring daily posting time</label>
  <p className="church-daily-note">Saving also restores safe cancelled drafts for these dates. Existing uploads and expired posting windows cannot be restarted.</p>
  {removed&&<label className="check-label church-daily-replacement"><input type="checkbox" checked={replace} disabled={busy||!!result} onChange={e=>setReplace(e.target.checked)}/>Create new schedules for removed dates. Keep the previous Canva renders stopped in history. A verified PNG is required before delivery.</label>}
  <div className="inline-note"><CalendarDays size={17}/><span>The date and caption are saved first. Canva prepares and checks the PNG automatically when generation is enabled. Publishing needs only the saved Facebook Page and an active queue check. Exact-minute delivery is unavailable.</span></div>
  {mismatch&&<p className="connection-form-error" role="alert">Open this Site as {expected||'the intended account'} before saving. Currently signed in as {data.signedInEmail||'an unverified account'}.</p>}
  {blocks.map((block:any)=><p className="connection-form-error" role="alert" key={block.date}>{shortDate(block.date)}: {block.reason} {allBlocked?'':'The other eligible date can still be saved.'}</p>)}
  {error&&<p className="connection-form-error" role="alert">{error}</p>}
  {result&&<div className="church-daily-result" role="status">{result.results.map((r:any)=><p key={r.date}><strong>{shortDate(r.date)}</strong>: {r.ok?`Saved at ${result.time}${r.manualImageRequired?' · attach a verified Canva PNG':!r.imageReady?' · Canva image pending':''}`:r.error}</p>)}</div>}
  {!result?<button className="btn primary full" disabled={busy||!isDate(date)||!isTime(time)||mismatch||allBlocked||!config.dailyEnabled&&!enable||removed&&!replace}>{busy?<Loader2 size={16} className="spin"/>:<CalendarDays size={16}/>}Save {dates.length} daily {dates.length===1?'schedule':'schedules'}</button>:<button type="button" className="btn primary full" onClick={onClose}>Done</button>}
 </form></div>;
}
