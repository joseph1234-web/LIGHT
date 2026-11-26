'use client';
import {useEffect,useRef,useState} from 'react';
import {CalendarDays,Check,ImageIcon,Loader2,Upload} from 'lucide-react';
import {countdownSeason} from '../../lib/church/countdown';
import {christmasPackImage} from '../../lib/church/christmas-pack';
type ImageRecord={id:string;date:string;occasion:string;revision:string;url:string};
export default function CountdownImagesPanel({date,disabled,notify,onSaved}:{date:string;disabled:boolean;notify:(message:string)=>void;onSaved:()=>Promise<any>}){
 const [selected,setSelected]=useState(date),[images,setImages]=useState<ImageRecord[]>([]),[file,setFile]=useState<File|null>(null),[preview,setPreview]=useState(''),[decoded,setDecoded]=useState(false),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState('');const input=useRef<HTMLInputElement>(null);
 const season=countdownSeason(selected),current=images.find(i=>i.date===selected),bundled=season.occasion==='christmas'?christmasPackImage(selected):null;
 async function load(){setLoading(true);try{const response=await fetch('/api/church/countdown-images?year='+season.year,{cache:'no-store'});const data:any=await response.json();if(!response.ok)throw new Error(data.error||'Images could not load.');setImages(data.images);setError('');}catch(e){setError((e as Error).message);}finally{setLoading(false);}}
 useEffect(()=>{setSelected(date);setFile(null);},[date]);
 useEffect(()=>{void load();},[season.year]);
 useEffect(()=>{setDecoded(false);if(!file){setPreview('');return;}const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url);},[file]);
 async function save(){if(!file||!decoded||busy)return;setBusy(true);setError('');try{
  const bitmap=await createImageBitmap(file);let png:Blob;
  try{if(bitmap.width<32||bitmap.height<32||bitmap.width>4096||bitmap.height>4096)throw new Error('Use an image from 32 to 4096 pixels on each side.');const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;canvas.getContext('2d')!.drawImage(bitmap,0,0);png=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('This image could not be opened.')),'image/png'));}finally{bitmap.close();}
  if(png.size>10*1024*1024)throw new Error('Use a smaller image, up to 10 MB.');
  const form=new FormData();form.set('date',selected);form.set('expectedRevision',current?.revision||'');form.set('png',new File([png],'countdown.png',{type:'image/png'}));
  const response=await fetch('/api/church/countdown-images',{method:'POST',body:form});const data:any=await response.json();if(!response.ok)throw new Error(data.error||'Image could not be saved.');await load();await onSaved();setFile(null);notify('Countdown image saved.');
 }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 const locked=disabled||busy||loading;
 return <section className="panel countdown-images-panel" aria-label="Countdown images"><div className="countdown-images-header"><div><h2><ImageIcon size={19}/>Countdown images</h2><p>Choose a date to add or replace its image.</p></div><button className="btn secondary small-btn" disabled={locked} onClick={()=>input.current?.click()}><Upload size={15}/>{current?'Change image':'Upload image'}</button></div>
 <input ref={input} type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" hidden disabled={locked} onChange={e=>{const f=e.target.files?.[0];e.target.value='';if(!f)return;if(!['image/png','image/jpeg'].includes(f.type)||f.size>10*1024*1024){setError('Choose a PNG or JPG up to 10 MB.');return;}setError('');setFile(f);}}/>
 <div className="countdown-images-body"><div><label className="field">Image date<input type="date" value={selected} disabled={busy} onChange={e=>{if(e.target.value){setSelected(e.target.value);setFile(null);setError('');}}}/></label><span className="countdown-day-label"><CalendarDays size={15}/>{season.daysRemaining===0?(season.occasion==='christmas'?'Christmas Day':'New Year’s Day'):`${season.daysRemaining} ${season.daysRemaining===1?'day':'days'} until ${season.occasion==='christmas'?'Christmas':'New Year'}`}</span><small>PNG or JPG · up to 10 MB</small>{file&&<><p>{file.name}</p><small>Updates unposted schedules for this date.</small><button className="btn primary" disabled={locked||!decoded} onClick={save}>{busy?<Loader2 size={15} className="spin"/>:<Check size={15}/>}Save image</button></>}</div><div className="countdown-upload-preview">{preview?<img src={preview} alt="Image to upload" onLoad={()=>setDecoded(true)} onError={()=>{setDecoded(false);setError('This image could not be opened.');}}/>:current?<img src={current.url} alt={'Saved countdown image for '+selected}/>:bundled?.available?<img src={bundled.path!} alt={'Countdown image for '+selected}/>:<span><ImageIcon size={27}/>No image for this date</span>}</div></div>
 {error&&<p className="connection-form-error" role="alert">{error}<button className="text-link" disabled={busy} onClick={load}>Refresh images</button></p>}
 {!!images.filter(i=>i.occasion===season.occasion).length&&<details className="countdown-image-dates"><summary>Saved images ({images.filter(i=>i.occasion===season.occasion).length})</summary><div>{images.filter(i=>i.occasion===season.occasion).map(image=><button key={image.id} className="btn secondary small-btn" disabled={busy} onClick={()=>{setSelected(image.date);setFile(null);}}>{image.date}</button>)}</div></details>}
 </section>;
}
