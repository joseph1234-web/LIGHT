'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowUpRight,Check,Loader2,PenLine,X} from 'lucide-react';
import {readStudioJson} from '../../lib/client-api';

export default function ChurchPostReview({post,timezone,autoPublish,onClose,onSaved,notify}:{post:any;timezone:string;autoPublish:boolean;onClose:()=>void;onSaved:()=>Promise<unknown>;notify:(message:string)=>void}){
 const [caption,setCaption]=useState(post.caption),[busy,setBusy]=useState(false),[opening,setOpening]=useState(false),[error,setError]=useState(''),[link,setLink]=useState(''),[returnUrl,setReturnUrl]=useState('');
 const close=useRef<HTMLButtonElement>(null);
 const canEditCaption=!['published','uploading','processing','cancelled','needs_review'].includes(post.status);
 useEffect(()=>{const before=document.activeElement as HTMLElement|null;close.current?.focus();const escape=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();};document.addEventListener('keydown',escape);return()=>{document.removeEventListener('keydown',escape);before?.focus();};},[]);
 async function editInCanva(){
  // Open during the click so a slow provider response does not trigger popup blocking.
  const editor=window.open('about:blank','_blank');if(editor)editor.opener=null;
  setOpening(true);setError('');
  try{const result=await fetch('/api/canva/review',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({postId:post.id,renderId:post.renderId})}).then(readStudioJson);setLink(result.editUrl);setReturnUrl(result.returnUrl);if(editor)editor.location.replace(result.editUrl);await onSaved();}
  catch(e){editor?.close();setError(e instanceof Error?e.message:'Could not open this Canva post.');}
  finally{setOpening(false);}
 }
 async function saveCaption(){setBusy(true);setError('');try{await fetch('/api/church/post',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({id:post.id,action:'edit',caption})}).then(readStudioJson);await onSaved();notify('Caption saved. The posting time is unchanged.');}catch(e){setError(e instanceof Error?e.message:'Could not save the caption.');}finally{setBusy(false)}}
 const editing=post.canvaEdit,phase=editing?.phase;
 return <div className="modal-overlay" onClick={onClose}><div className="modal church-post-review" role="dialog" aria-modal="true" aria-labelledby="church-review-title" onClick={e=>e.stopPropagation()}>
  <button ref={close} className="modal-close icon-btn" aria-label="Close post review" onClick={onClose}><X size={19}/></button>
  <span className="eyebrow">OPTIONAL REVIEW</span><h2 id="church-review-title">Review post</h2><p>{post.title} · {new Intl.DateTimeFormat('en-PH',{timeZone:timezone,month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(post.scheduled))}</p>
  <div className="church-review-grid"><div className="church-review-image"><img src={post.imageUrl} alt={post.title+' scheduled image'}/></div><div className="church-review-copy">
   {error&&<p className="connection-form-error" role="alert">{error}</p>}
   <label className="field">Post caption<textarea rows={10} maxLength={5000} value={caption} readOnly={!canEditCaption} onChange={e=>setCaption(e.target.value)}/></label>
   {canEditCaption&&<button className="btn secondary" disabled={busy||caption===post.caption} onClick={saveCaption}>{busy?<Loader2 className="spin" size={15}/>:<Check size={15}/>}Save caption</button>}
   {post.canReviewCanva&&<div className="church-review-canva"><button className="btn primary" disabled={opening} onClick={editInCanva}>{opening?<Loader2 className="spin" size={15}/>:<PenLine size={15}/>}Edit image in Canva <ArrowUpRight size={14}/></button><p>Opens this post’s generated copy, page {post.canvaPage||1}. Canva saves your edits automatically. Return here when finished; ekklo. checks and refreshes the PNG.</p>{link&&<a className="text-link" href={link} target="_blank" rel="noopener noreferrer">Open Canva editor <ArrowUpRight size={13}/></a>}</div>}
   {editing&&<p className="church-review-sync" role="status">{(editing.error||phase==='export_started')?'An image update needs attention. The last ready image remains scheduled.':phase==='export_pending'?'Exporting your saved Canva edits…':editing.syncedAt?'Canva image synced · '+new Intl.DateTimeFormat('en-PH',{timeZone:timezone,hour:'numeric',minute:'2-digit'}).format(new Date(editing.syncedAt)):'Watching for saved Canva edits. The image updates after Canva finishes saving.'}</p>}
   {post.series==='service'&&post.canReviewCanva&&<p className="church-review-tip">For this invitation, keep the date and time boxes wide enough for “Nov. 8, 2026” and “8:30 AM”. Move the message below them so the text does not overlap.</p>}
   {post.series==='daily'&&post.canReviewCanva&&<p className="church-review-tip">To center the verse, select its text box in Canva and choose Position → Center and Middle. Keep the verse and reference together.</p>}
  </div></div>
  <p className="church-review-delivery">{autoPublish?'Review is optional. If you make no edits, the ready image posts at the saved time when ekklo. checks the queue.':'Review does not change your saved publishing settings.'} While edits are syncing, the last confirmed image stays scheduled.</p>
  {returnUrl&&<details className="church-review-return"><summary>Show a Return to ekklo. button in Canva</summary><p>In the Canva Developer Portal, open this app’s Outside Canva → Configuration. Enable Return navigation and set its Return URL to:</p><code>{returnUrl}</code><p>Then reopen the editor from Review post. You can also return to this ekklo. tab at any time.</p></details>}
 </div></div>;
}
