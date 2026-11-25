import {bindChurchIdentity,advanceChurchAutomation,adoptChristmasPack,prepareScheduledCanva} from '../../../lib/church/automation-worker';
import {scheduleDailyPosts} from '../../../lib/church/daily';
import {restartChurchSchedule} from '../../../lib/church/restart';
import { body, csrf, user, json, HttpError, db, E, rows, one, run, uid, now, settings, saveSettings, studioState, saveDraft, getDraft, queueDraft, publicAppConfiguration, saveProviderApp, oauthStart, oauthCallback, choosePage, chooseYoutube, disconnectConnection, connectionReturn, publicSettings, log } from '../../../lib/server';
import {uploadMedia} from '../../../lib/media';
import {uploadChurchImage} from '../../../lib/church/uploads';
import { discover } from '../../../lib/discovery';
import {saveUploadedTemplate,getTemplatePreview} from '../../../lib/church/templates';
import { runQueue } from '../../../lib/publisher';
import {churchConfig,churchState,saveChurchConfig,prepareChurchPosts,previewChurchImage,getChurchImage,updateChurchPost,scheduleChurchPost} from '../../../lib/church/server';
import {canvaAutomationState,saveCanvaApp,connectCanva,canvaCallback,disconnectCanva,checkCanvaTemplate,enableCanvaAutomation,generatedCanvaPreview,approveGeneratedCanva} from '../../../lib/church/canva-automation';
import {chatGPTSignInPath} from '../../../lib/auth-paths';
import {clearChurchPending,undoChurchClear,resumeChurchPreparation,removeChurchPost,restoreRemovedChurchPost} from '../../../lib/church/queue';
import {reviewCanvaPost,returnFromCanva} from '../../../lib/church/canva-review';
import {churchDashboard} from '../../../lib/church/dashboard';
export const dynamic='force-dynamic';
function navigationRedirect(url:string){return new Response(null,{status:302,headers:{Location:url,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}
async function handle(request:Request){try{
 csrf(request);const url=new URL(request.url),path=url.pathname.replace(/^\/api\//,''),method=request.method;
 // A browser navigation lets the Site's sign-in screen finish at the top level.
 if(path==='canva/start'&&method==='GET'){
  const returnTo='/?view=church&churchTab=templates';
  if(!request.headers.get('oai-authenticated-user-id'))return navigationRedirect(new URL(chatGPTSignInPath(returnTo),url).toString());
  try{const result=await connectCanva(user(request),request);return navigationRedirect(result.authorizationUrl);}
  catch(error){const target=new URL(returnTo,url);target.searchParams.set('canvaNotice',error instanceof HttpError?error.message:'Canva sign-in could not start. Refresh the current connection status before trying again.');return navigationRedirect(target.toString());}
 }
 if(path==='canva/return'&&method==='GET'&&!request.headers.get('oai-authenticated-user-id'))return navigationRedirect(new URL(chatGPTSignInPath(url.pathname+url.search),url).toString());
 const owner=user(request);
 if(path.startsWith('church/')||path.startsWith('canva/'))await bindChurchIdentity(owner,request.headers.get('oai-authenticated-user-email')||'');
 if(path==='canva/state'&&method==='GET')return json({...await canvaAutomationState(owner),signedInEmail:request.headers.get('oai-authenticated-user-email')||''});
 if(path==='canva/setup'&&method==='POST')return json(await saveCanvaApp(owner,await body(request)));
 if(path==='canva/connect'&&method==='POST')return json(await connectCanva(owner,request));
 if(path==='canva/disconnect'&&method==='POST')return json(await disconnectCanva(owner));
 if(path==='canva/template'&&method==='POST')return json(await checkCanvaTemplate(owner,await body(request)));
 if(path==='canva/automation'&&method==='POST')return json(await enableCanvaAutomation(owner,await body(request)));
 if(path==='canva/review'&&method==='POST')return json(await reviewCanvaPost(owner,await body(request),url.origin));
 if(path==='canva/return'&&method==='GET'){
  const target=new URL('/?view=church&churchTab=posts',url);
  try{const result=await returnFromCanva(owner,url.searchParams.get('correlation_jwt')||'');target.searchParams.set('reviewPost',result.postId);target.searchParams.set('canvaReviewNotice','Your saved Canva edits are syncing. The last ready image stays scheduled.');}
  catch(e){target.searchParams.set('canvaReviewNotice',e instanceof HttpError?e.message:'Canva return could not be checked. Open Review post to see the saved image.');}
  return navigationRedirect(target.toString());
 }
 if(path==='canva/approve'&&method==='POST')return json(await approveGeneratedCanva(owner,await body(request)));
 if(path==='canva/run'&&method==='POST')return json(await advanceChurchAutomation(owner));
 if(path==='canva/advance'&&method==='POST'){const input=await body(request);return json(await advanceChurchAutomation(owner,{publishVerified:input.publishReady===true}));}
 if(path.startsWith('canva/preview/')&&method==='GET')return new Response(await generatedCanvaPreview(owner,path.split('/')[2],url.searchParams.get('renderId')||'') as BodyInit,{headers:{'Content-Type':'image/png','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 if(path==='canva/callback'&&method==='GET'){const target=new URL('/?view=church&churchTab=templates',url);try{await canvaCallback(owner,request);target.searchParams.set('canvaNotice','connected');}catch(e){target.searchParams.set('canvaNotice',e instanceof HttpError?e.message:'Canva sign-in could not finish. Check Connection details before starting a new connection.');}return navigationRedirect(target.toString());}
 if(path==='church/template'&&method==='POST'){await churchConfig(owner);return json(await saveUploadedTemplate(owner,request));}
 if(path.startsWith('church/template/')&&method==='GET'){await churchConfig(owner);return new Response(await getTemplatePreview(owner,path.split('/')[2]),{headers:{'Content-Type':'image/png','Cache-Control':'private, max-age=300','X-Content-Type-Options':'nosniff'}});}
 if(path==='church/use-christmas-pack'&&method==='POST')return json(await adoptChristmasPack(owner));
 if(path==='church/state'&&method==='GET')return json({...await churchState(owner),signedInEmail:request.headers.get('oai-authenticated-user-email')||''});
 if(path==='church/dashboard'&&method==='GET')return json(await churchDashboard(owner));
 if(path==='church/preparation'&&method==='POST'){
  const input=await body(request);if(typeof input.enabled!=='boolean')throw new HttpError(400,'Choose whether automatic preparation is enabled.');
  await churchConfig(owner);
  await run("UPDATE church_settings SET payload=json_set(payload,'$.manualQueue',json(?)),updated=? WHERE owner=?",input.enabled?'false':'true',now(),owner);
  if(input.enabled)await prepareChurchPosts(owner);
  return json({automaticPreparation:input.enabled});
 }
 if(path==='church/daily-schedule'&&method==='POST'){const input=await body(request),email=request.headers.get('oai-authenticated-user-email')||'';if(!email||typeof input.expectedAccountEmail!=='string'||email.toLowerCase()!==input.expectedAccountEmail.trim().toLowerCase())throw new HttpError(403,'Sign in to the intended account before saving these daily schedules.');const result=await scheduleDailyPosts(owner,input),generation=await prepareScheduledCanva(owner,result.results.filter(r=>r.ok).map(r=>r.id));return json({...result,results:result.results.map(r=>({...r,imageReady:r.imageReady||generation.results?.some(g=>g.postId===r.id&&g.state==='ready')||false})),generation});}
 if(path==='church/settings'&&method==='POST'){const result=await saveChurchConfig(owner,await body(request));await prepareChurchPosts(owner);return json(result);}
 if(path==='church/generate'&&method==='POST'){const input=await body(request);await resumeChurchPreparation(owner);return json(await prepareChurchPosts(owner,Math.min(7,Math.max(1,Number(input.days)||7))));}
 if(path==='church/clear-pending'&&method==='POST')return json(await clearChurchPending(owner));
 if(path==='church/restart'&&method==='POST'){const input=await body(request),email=request.headers.get('oai-authenticated-user-email')||'';if(!email||typeof input.expectedAccountEmail!=='string'||email.toLowerCase()!==input.expectedAccountEmail.trim().toLowerCase())throw new HttpError(403,'Sign in to the intended account before resetting its schedule.');return json(await restartChurchSchedule(owner,input));}
 if(path==='church/undo-clear'&&method==='POST')return json(await undoChurchClear(owner,await body(request)));
 if(path==='church/remove'&&method==='POST')return json(await removeChurchPost(owner,await body(request)));
 if(path==='church/restore-removed'&&method==='POST')return json(await restoreRemovedChurchPost(owner,await body(request)));
 if(path==='church/post-image'&&method==='POST')return json(await uploadChurchImage(owner,request));
 if(path==='church/post'&&method==='POST')return json(await updateChurchPost(owner,await body(request)));
 if(path==='church/schedule'&&method==='POST'){const result=await scheduleChurchPost(owner,await body(request)),generation=await prepareScheduledCanva(owner,[result.id]);return json({...result,imageReady:result.imageReady||generation.results?.some(r=>r.postId===result.id&&r.state==='ready')||false,generation});}
 if(path==='church/preview'&&method==='GET'){const result=await previewChurchImage(owner,url.searchParams.get('kind')||'daily',url.searchParams.get('date')||new Date().toISOString().slice(0,10),url.searchParams.get('event')||'');return new Response(result.png as BodyInit,{headers:{'Content-Type':'image/png','Cache-Control':'private, max-age=60','X-Content-Type-Options':'nosniff'}});}
 if(path.startsWith('church/image/')&&method==='GET'){const image=await getChurchImage(owner,path.split('/')[2]);return new Response(image.body as BodyInit,{headers:{'Content-Type':'image/png','Cache-Control':'private, max-age=300','X-Content-Type-Options':'nosniff',...(url.searchParams.get('download')?{'Content-Disposition':'attachment; filename="church-post.png"'}:{})}});}
 if(path==='state'&&method==='GET'){const s=await studioState(owner);s.settings=await publicSettings(owner);return json({...s,account:{email:request.headers.get('oai-authenticated-user-email')||''}});}
 if(path==='discovery'&&method==='GET')return json(await discover(url.searchParams.get('region')||'US',(url.searchParams.get('q')||'').slice(0,200)));
 if(path==='drafts'&&method==='POST')return json(await saveDraft(owner,await body(request)));
 if(path==='drafts/delete'&&method==='POST'){
 const b=await body(request);await getDraft(owner,b.id);if(await one("SELECT id FROM jobs WHERE owner=? AND draft_id=? AND status IN ('queued','processing','uploading')",owner,b.id))throw new HttpError(409,'Cancel active deliveries before deleting this draft.');
 await run('DELETE FROM drafts WHERE owner=? AND id=?',owner,b.id);return json({deleted:true});}
 if(path==='queue'&&method==='POST'){const b=await body(request);return json(await queueDraft(owner,b.id,b.scheduled));}
 if(path==='queue/cancel'&&method==='POST'){const b=await body(request);const r=await run("UPDATE jobs SET status='cancelled',message='Cancelled by you.',updated=? WHERE owner=? AND id=? AND status IN ('queued','needs_review','blocked')",now(),owner,b.id);if(!r.meta.changes)throw new HttpError(409,'This delivery has already started or is complete. Check the platform before making changes.');return json({cancelled:true});}
 if(path==='queue/manual'&&method==='POST'){const b=await body(request);const r=await run("UPDATE jobs SET status='manual',message='Reported as posted by you; not verified by the platform.',updated=? WHERE owner=? AND id=? AND platform='tiktok' AND status='needs_review'",now(),owner,b.id);if(!r.meta.changes)throw new HttpError(409,'This manual delivery is no longer pending.');return json({updated:true});}
 if(path==='run'&&method==='POST')return json(await runQueue(owner));
 if(path==='settings'&&method==='POST'){
 const b=await body(request),s=await settings(owner);const allowed=['brand','tone','language','niche','region','timezone','hashtags'];
 for(const k of allowed)if(typeof b[k]==='string')s[k]=b[k].slice(0,k==='hashtags'?300:120);
 try{new Intl.DateTimeFormat('en',{timeZone:s.timezone}).format(new Date())}catch{throw new HttpError(400,'Choose a valid timezone.');}
 if(Array.isArray(b.slots)){if(b.slots.some((x:any)=>typeof x!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(x)))throw new HttpError(400,'Choose posting times with valid hours and minutes.');s.slots=[...new Set(b.slots)].slice(0,4);}
 if(Array.isArray(b.autoPlatforms))s.autoPlatforms=b.autoPlatforms.filter((p:string)=>['facebook','instagram','youtube'].includes(p));
 if(typeof b.autoPictures==='boolean')s.autoPictures=b.autoPictures;if(typeof b.autoVideos==='boolean')s.autoVideos=b.autoVideos;
 if(typeof b.autopilot==='boolean')s.autopilot=b.autopilot;
 if(s.autopilot){
 if(!s.runnerVerifiedAt||Date.now()-new Date(s.runnerVerifiedAt).getTime()>86400000)throw new HttpError(400,'Activate and verify the background publishing runner before enabling Autopilot.');
 if(!s.autoPictures&&s.autoVideos===false)throw new HttpError(400,'Enable pictures, videos, or both.');
 if(!s.slots.length)throw new HttpError(400,'Add at least one posting time.');
 const connected=await rows('SELECT platform FROM connections WHERE owner=?',owner),eligible=s.autoPlatforms.filter((p:string)=>connected.some(c=>c.platform===p));
 if(s.autoPictures&&!eligible.some((p:string)=>p==='facebook'||p==='instagram'))throw new HttpError(400,'Connect and select Facebook or Instagram before automating pictures.');
 if(s.autoVideos!==false&&!eligible.length)throw new HttpError(400,'Connect and select a publishing channel before automating videos.');
 }
 await saveSettings(owner,s);
 if(!s.autopilot||b.autoPictures===false)await run("UPDATE jobs SET status='cancelled',message='Automatic picture posting paused by you.',updated=? WHERE owner=? AND status='queued' AND json_extract(payload,'$._autopilot')=1 AND json_extract(payload,'$.mediaType')='image'",now(),owner);
 if(!s.autopilot||b.autoVideos===false)await run("UPDATE jobs SET status='cancelled',message='Automatic video posting paused by you.',updated=? WHERE owner=? AND status='queued' AND json_extract(payload,'$._autopilot')=1 AND json_extract(payload,'$.mediaType')='video'",now(),owner);
 return json(await publicSettings(owner));
 }
 if(path==='upload'&&method==='POST')return json(await uploadMedia(request,owner));
 if(path.startsWith('media/')&&method==='GET'){
 const a=await one('SELECT * FROM assets WHERE id=? AND owner=?',path.split('/')[1],owner);if(!a)throw new HttpError(404,'Media not found.');
 const range=request.headers.get('range');let opts:any=undefined;if(range){const m=range.match(/^bytes=(\d+)-(\d*)$/);if(m){const start=Number(m[1]),end=m[2]?Math.min(Number(m[2]),a.size-1):a.size-1;if(start>=a.size||end<start)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${a.size}`}});opts={range:{offset:start,length:end-start+1}};}}
 const o=await E().BUCKET.get(a.key,opts);if(!o)throw new HttpError(404,'Media is unavailable.');const h:Record<string,string>={'Content-Type':a.mime,'Cache-Control':'private, max-age=300','Accept-Ranges':'bytes','X-Content-Type-Options':'nosniff'};
 if(opts){h['Content-Range']=`bytes ${opts.range.offset}-${opts.range.offset+opts.range.length-1}/${a.size}`;h['Content-Length']=String(opts.range.length)}else h['Content-Length']=String(a.size);
 if(url.searchParams.get('download'))h['Content-Disposition']="attachment; filename*=UTF-8''"+encodeURIComponent(a.filename);
 return new Response(o.body,{status:opts?206:200,headers:h});
 }
 if(path==='connections/setup'&&method==='GET')return json(await publicAppConfiguration(owner));
 if(path==='connections/setup'&&method==='POST')return json(await saveProviderApp(owner,await body(request)));
 if(path==='connections/disconnect'&&method==='POST')return json(await disconnectConnection(owner,(await body(request)).platform));
 if(path==='connections/disconnect-all'&&method==='POST'){for(const platform of ['facebook','instagram','youtube'])await disconnectConnection(owner,platform);return json({disconnected:true});}
 if(path==='connections/page'&&method==='POST'){const b=await body(request);return json(await choosePage(owner,b.id,b.includeInstagram===true));}
 if(path==='connections/youtube'&&method==='POST')return json(await chooseYoutube(owner,(await body(request)).id));
 if(path.startsWith('oauth/')){const [,provider,action]=path.split('/');try{if(method==='GET'&&action==='start')return await oauthStart(request,owner,provider);if(method==='GET'&&action==='callback')return await oauthCallback(request,owner,provider);}catch(e){return connectionReturn(request,provider,'error',(e as Error).message);}}
 throw new HttpError(404,'This action was not found.');
 }catch(error){const e=error as Error;console.error('Studio request:',e.message);return json({error:e instanceof HttpError?e.message:'The request could not be completed. Please try again.'},e instanceof HttpError?e.status:500);}}
export const GET=handle;export const POST=handle;
