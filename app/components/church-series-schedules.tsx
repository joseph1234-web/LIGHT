'use client';
import {countdownSeason} from '../../lib/church/countdown';
import {CalendarDays,Gift,Church} from 'lucide-react';
import {dateLabel} from '../../lib/church/model';
export default function ChurchSeriesSchedules({data,disabled,onSchedule}:{data:any;disabled:boolean;onSchedule:(choice:any)=>void}){
 return <div className="church-series-schedules">{(data.seriesDates||[]).map((row:any)=>{
  const service=row.series==='service',post=(data.posts||[]).find((p:any)=>p.id===row.postId),title=service?'Saturday invitation':countdownSeason(row.date).title,Icon=service?Church:Gift;
  return <section className="panel" key={row.series}><h3><Icon size={18}/>{title}</h3><strong>{dateLabel(row.date)}</strong>{row.sundayDate&&<p>Invitation for {dateLabel(row.sundayDate)}.</p>}<p>{row.status==='removed'?'Previously removed — a new schedule is available.':row.status==='missing'?'No schedule saved yet.':post?.automaticImageCheck?'Schedule saved. Canva is checking its PNG automatically.':'Current status: '+row.status+'.'}</p>{row.reason&&<small>{row.reason}</small>}{!row.enabled&&<small>Enable this series in the posting planner before saving.</small>}<div className="church-post-actions">{row.canSchedule&&<button className="btn secondary small-btn" disabled={disabled||!row.enabled} onClick={()=>onSchedule({series:row.series,date:row.date,time:row.time,...(post?{post}: {})})}><CalendarDays size={14}/>{row.status==='removed'?'Create new schedule':post?'Change time':'Schedule '+(service?'invitation':'countdown')}</button>}</div></section>;
 })}</div>;
}
