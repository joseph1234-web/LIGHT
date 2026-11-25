import { env } from 'cloudflare:workers';
import {churchPublishingItem} from './church/publishing-view';
import {facebookPermissions,instagramFacebookPublishPermissions,instagramDirectPublishPermissions,hasPermissions} from './meta-permissions';
import { defaultSettings, validateDraft, rightsIssues, platforms, type Draft, type Platform } from './model';
export const E=()=>env as unknown as Record<string,any>;
export const db=()=>{const d=E().DB as D1Database|undefined;if(!d)throw new Error('Storage is being prepared. Please try again shortly.');return d};
export const now=()=>new Date().toISOString();
export const uid=()=>crypto.randomUUID();
export function user(request:Request){const id=request.headers.get('oai-authenticated-user-id');if(!id)throw new HttpError(401,'Sign in with ChatGPT to use your private studio.');return id;}
export class HttpError extends Error{constructor(public status:number,message:string){super(message)}}
export function json(data:unknown,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}})}
export async function body(request:Request){if(Number(request.headers.get('content-length')||0)>150000)throw new HttpError(413,'This request is too large.');return request.json() as Promise<any>}
export function csrf(request:Request){if(!['GET','HEAD','OPTIONS'].includes(request.method)){const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)throw new HttpError(403,'Open this action from your studio.');}}
export async function rows(sql:string,...args:any[]){return (await db().prepare(sql).bind(...args).all()).results as any[]}
export async function one(sql:string,...args:any[]){return await db().prepare(sql).bind(...args).first() as any}
export async function run(sql:string,...args:any[]){return db().prepare(sql).bind(...args).run()}
export async function log(owner:string,message:string,kind='info'){await run('INSERT INTO activity (id,owner,message,kind,created) VALUES (?,?,?,?,?)',uid(),owner,message,kind,now())}
export async function settings(owner:string){const s=await one('SELECT payload FROM preferences WHERE owner=?',owner);return {...defaultSettings,...(s?JSON.parse(s.payload):{})}}
export async function saveSettings(owner:string,payload:any){await run('INSERT INTO preferences (owner,payload,updated) VALUES (?,?,?) ON CONFLICT(owner) DO UPDATE SET payload=excluded.payload,updated=excluded.updated',owner,JSON.stringify(payload),now());return payload;}
export async function getDraft(owner:string,id:string){const r=await one('SELECT * FROM drafts WHERE owner=? AND id=?',owner,id);if(!r)throw new HttpError(404,'Draft not found.');return {...JSON.parse(r.payload),id:r.id,created:r.created,updated:r.updated} as Draft;}
export async function saveDraft(owner:string,input:any){
 const d=validateDraft(input);if(!d.title.trim())throw new HttpError(400,'Give your post a title.');if(d.platforms.length===0)throw new HttpError(400,'Select at least one platform.');
 if(d.assetId&&!await one('SELECT id FROM assets WHERE owner=? AND id=?',owner,d.assetId))throw new HttpError(400,'Choose media from your own library.');
 let existing=null;if(d.id){existing=await one('SELECT id FROM drafts WHERE owner=? AND id=?',owner,d.id);if(!existing)throw new HttpError(404,'Draft not found.');
 if(await one("SELECT id FROM jobs WHERE owner=? AND draft_id=? AND status IN ('queued','processing','uploading')",owner,d.id))throw new HttpError(409,'Cancel the queued delivery before editing its draft.');}
 d.id=d.id||uid();const t=now();await run('INSERT INTO drafts (id,owner,payload,created,updated) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated=excluded.updated',d.id,owner,JSON.stringify(d),t,t);
 if(!existing)await log(owner,`Draft created: ${d.title}`);return d;
}
export const providerKeys={facebook:['META_APP_ID','META_APP_SECRET','META_GRAPH_VERSION','META_LOGIN_CONFIG_ID'],instagram:['INSTAGRAM_APP_ID','INSTAGRAM_APP_SECRET','INSTAGRAM_GRAPH_VERSION'],youtube:['GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET']} as const;
export async function appConfiguration(owner:string){const result:Record<string,string>={};for(const list of Object.values(providerKeys))for(const k of list)if(typeof E()[k]==='string')result[k]=E()[k];for(const row of await rows('SELECT provider,secret FROM provider_apps WHERE owner=?',owner)){if(!(row.provider in providerKeys))continue;const saved=await unseal(row.secret);for(const k of providerKeys[row.provider as keyof typeof providerKeys])if(typeof saved[k]==='string')result[k]=saved[k];}return result;}
export async function setup(owner:string){const e=await appConfiguration(owner),encryption=!!E().TOKEN_ENCRYPTION_KEY,facebook=!!(e.META_APP_ID&&e.META_APP_SECRET&&e.META_GRAPH_VERSION&&encryption),instagramDirect=!!(e.INSTAGRAM_APP_ID&&e.INSTAGRAM_APP_SECRET&&e.INSTAGRAM_GRAPH_VERSION&&encryption);return {encryption,youtube:!!(e.GOOGLE_CLIENT_ID&&e.GOOGLE_CLIENT_SECRET&&encryption),facebook,instagram:instagramDirect||facebook,instagramDirect,instagramViaFacebook:facebook,tiktok:false,discovery:!!E().YOUTUBE_API_KEY};}
export async function publicAppConfiguration(owner:string){const e=await appConfiguration(owner);return {setup:await setup(owner),apps:{facebook:{appId:e.META_APP_ID||'',version:e.META_GRAPH_VERSION||'',configId:e.META_LOGIN_CONFIG_ID||'',hasSecret:!!e.META_APP_SECRET},instagram:{appId:e.INSTAGRAM_APP_ID||'',version:e.INSTAGRAM_GRAPH_VERSION||'',hasSecret:!!e.INSTAGRAM_APP_SECRET},youtube:{appId:e.GOOGLE_CLIENT_ID||'',hasSecret:!!e.GOOGLE_CLIENT_SECRET}}};}
export async function saveProviderApp(owner:string,input:any){
 const p=input?.provider as keyof typeof providerKeys;if(!['facebook','instagram','youtube'].includes(p))throw new HttpError(400,'Choose Facebook, Instagram or YouTube.');
 const old=await appConfiguration(owner),keys=providerKeys[p],idKey=keys[0],secretKey=keys[1],next:Record<string,string>={};for(const k of keys)next[k]=old[k]||'';
 if(typeof input.appId==='string')next[idKey]=input.appId.trim();if(typeof input.appSecret==='string'&&input.appSecret.trim())next[secretKey]=input.appSecret.trim();
 if(p!=='youtube'){const key=p==='facebook'?'META_GRAPH_VERSION':'INSTAGRAM_GRAPH_VERSION';if(typeof input.version==='string')next[key]=input.version.trim();if(!/^v[0-9]{1,3}\.[0-9]{1,2}$/.test(next[key]))throw new HttpError(400,'Enter the supported Graph API version shown in your Meta app, including its leading v.');if(!/^[0-9]{5,120}$/.test(next[idKey]))throw new HttpError(400,'Enter the numeric App ID from Meta.');}
 else if(!/^[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(next[idKey])||next[idKey].length>250)throw new HttpError(400,'Enter the Web OAuth client ID from Google Cloud (ending in .apps.googleusercontent.com).');
 if(!/^[A-Za-z0-9_-]{16,256}$/.test(next[secretKey]))throw new HttpError(400,'Enter the app client secret from your developer dashboard.');
 if(old[idKey]&&old[idKey]!==next[idKey]&&!(typeof input.appSecret==='string'&&input.appSecret.trim()))throw new HttpError(400,'Enter the new app secret when changing the App ID.');
 if(p==='facebook'){if(typeof input.configId==='string')next.META_LOGIN_CONFIG_ID=input.configId.trim();if(next.META_LOGIN_CONFIG_ID&&!/^[0-9]{5,120}$/.test(next.META_LOGIN_CONFIG_ID))throw new HttpError(400,'Use the numeric Facebook Login configuration ID, or leave it blank.');}
 const credentialChanged=old[idKey]!==next[idKey]||old[secretKey]!==next[secretKey]||(p==='facebook'&&(old.META_LOGIN_CONFIG_ID||'')!==next.META_LOGIN_CONFIG_ID);
 // Validate and encrypt before modifying any current account or queue.
 const encrypted=await seal(next);
 if(credentialChanged){if(await one('SELECT id FROM connections WHERE owner=? AND platform=?',owner,p))await disconnectConnection(owner,p);if(p==='facebook'){const linked=await one("SELECT secret FROM connections WHERE owner=? AND platform='instagram'",owner);if(linked&&(await unseal(linked.secret)).provider!=='instagram')await disconnectConnection(owner,'instagram');}}
 await run('INSERT INTO provider_apps (id,owner,provider,secret,updated) VALUES (?,?,?,?,?) ON CONFLICT(owner,provider) DO UPDATE SET secret=excluded.secret,updated=excluded.updated',uid(),owner,p,encrypted,now());
 // An authorization started with older application settings must not finish with new ones.
 await run('DELETE FROM oauth_states WHERE owner=? AND provider=?',owner,p);
 const prefs=await settings(owner);if(p==='facebook'){delete prefs.pendingPages;delete prefs.pendingPagesExpires;delete prefs.pendingPagesTarget;}if(p==='youtube'){delete prefs.pendingYoutube;delete prefs.pendingYoutubeExpires;}await saveSettings(owner,prefs);
 await log(owner,`${p} application settings saved. Account authorization is a separate step.`,'connection');return publicAppConfiguration(owner);
}
export async function studioState(owner:string){
 const [d,a,j,c,ev,s,church]=await Promise.all([
 rows('SELECT * FROM drafts WHERE owner=? ORDER BY updated DESC LIMIT 250',owner),
 rows('SELECT id,filename,mime,size,duration,width,height,created FROM assets WHERE owner=? ORDER BY created DESC LIMIT 100',owner),
 rows('SELECT id,draft_id,platform,status,scheduled,remote_id,message,created,updated,payload FROM jobs WHERE owner=? ORDER BY scheduled DESC LIMIT 250',owner),
 rows('SELECT id,platform,label,account_id,expires FROM connections WHERE owner=?',owner),
 rows('SELECT * FROM activity WHERE owner=? ORDER BY created DESC LIMIT 20',owner),settings(owner),
 rows("SELECT * FROM church_posts WHERE owner=? AND status<>'removed' ORDER BY scheduled DESC LIMIT 150",owner)
 ]);
 return {drafts:d.map(r=>({...JSON.parse(r.payload),id:r.id,created:r.created,updated:r.updated})),assets:a,jobs:j.map(r=>({...r,title:JSON.parse(r.payload).title,mediaType:JSON.parse(r.payload).mediaType||'video',payload:undefined})),churchJobs:church.map(p=>churchPublishingItem(p)),connections:c,activity:ev,settings:s,setup:await setup(owner),serverTime:now()};
}
export async function queueDraft(owner:string,id:string,scheduled:string,automatic=false){
 const d=await getDraft(owner,id),issues=rightsIssues(d);
 const conns=await rows('SELECT platform,account_id FROM connections WHERE owner=?',owner),prefs=automatic?await settings(owner):null;
 const targets=d.platforms.filter(p=>p==='tiktok'?!automatic:conns.some(c=>c.platform===p)&&(!automatic||prefs!.autoPlatforms.includes(p)));
 if(!d.platforms.length)issues.push('Select at least one platform.');
 if(!targets.length)issues.push('Connect at least one selected publishing account before scheduling.');
 for(const p of targets)if(!d.captions[p]?.trim())issues.push(`Add a ${p} caption.`);
 if(d.mediaType!=='image'&&targets.includes('youtube')&&d.madeForKids===null)issues.push('Choose the YouTube audience setting.');
 if(issues.length)throw new HttpError(400,issues.join(' '));
 const asset=await one('SELECT * FROM assets WHERE id=? AND owner=?',d.assetId,owner);
 if(!asset)throw new HttpError(400,'Upload your picture or video before scheduling.');
 if(d.mediaType==='image'){if(!['image/png','image/jpeg'].includes(asset.mime))throw new HttpError(400,'Choose a PNG or JPG picture.');if(targets.includes('youtube'))throw new HttpError(400,'YouTube publishing in this studio supports videos. Choose Facebook or Instagram for pictures.');}
 else{if(asset.mime!=='video/mp4'||asset.duration<3||asset.duration>180||asset.height<asset.width)throw new HttpError(400,'Use a portrait or square MP4 between 3 and 180 seconds.');}
 const t=new Date(scheduled);if(!Number.isFinite(t.getTime())||t.getTime()<Date.now()-60000)throw new HttpError(400,'Choose a valid future publishing time.');
 if(targets.includes('instagram')){try{const u=new URL(d.publicVideoUrl);if(u.protocol!=='https:')throw 0;}catch{throw new HttpError(400,'Instagram needs a publicly accessible HTTPS URL for this exact picture or video.');}}
 for(const p of targets){const duplicate=await one("SELECT id FROM jobs WHERE owner=? AND platform=? AND draft_id<>? AND json_extract(payload,'$.assetId')=? AND status NOT IN ('cancelled','blocked')",owner,p,id,d.assetId);if(duplicate)throw new HttpError(409,`This media already has a delivery to ${p}. Review that delivery to avoid a duplicate post.`);}
 const existing=await rows('SELECT platform,status FROM jobs WHERE owner=? AND draft_id=?',owner,id);
 if(existing.some(j=>!['cancelled','blocked'].includes(j.status)))throw new HttpError(409,'This draft already has deliveries. Use the queue to review them.');
 const jobsToInsert=targets.map(p=>db().prepare('INSERT INTO jobs (id,owner,draft_id,platform,status,scheduled,payload,message,created,updated) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(owner,draft_id,platform) DO UPDATE SET status=excluded.status,scheduled=excluded.scheduled,payload=excluded.payload,message=excluded.message,remote_id=NULL,claimed=NULL,updated=excluded.updated').bind(uid(),owner,id,p,p==='tiktok'?'needs_review':'queued',t.toISOString(),JSON.stringify({...d,mediaType:d.mediaType||'video',_autopilot:automatic,_targetAccountId:conns.find(c=>c.platform===p)?.account_id||null}),p==='tiktok'?'Download your media and caption, then finish publishing in TikTok.':'',now(),now()));
 await db().batch(jobsToInsert);await log(owner,`Scheduled: ${d.title}`,'scheduled');return {scheduled:t.toISOString(),platforms:targets,skippedPlatforms:d.platforms.filter(p=>!targets.includes(p))};
}
export async function key(){const raw=E().TOKEN_ENCRYPTION_KEY;if(!raw)throw new HttpError(503,'Account connections need developer setup. Open Connections for the setup checklist.');const bytes=Uint8Array.from(atob(raw),(c:string)=>c.charCodeAt(0));if(bytes.length!==32)throw new Error('Account encryption is not configured correctly.');return crypto.subtle.importKey('raw',bytes,'AES-GCM',false,['encrypt','decrypt']);}
export async function seal(data:any){const iv=crypto.getRandomValues(new Uint8Array(12));const value=await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(),new TextEncoder().encode(JSON.stringify(data)));const enc=(x:ArrayBuffer|Uint8Array)=>btoa(String.fromCharCode(...new Uint8Array(x)));return enc(iv)+'.'+enc(value);}
export async function unseal(value:string){const [i,v]=value.split('.');const dec=(s:string)=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));const a=await crypto.subtle.decrypt({name:'AES-GCM',iv:dec(i)},await key(),dec(v));return JSON.parse(new TextDecoder().decode(a));}
export async function pausePlatform(owner:string,platform:string,message:string){
 await run("UPDATE jobs SET status='needs_review',message=?,updated=? WHERE owner=? AND platform=? AND status IN ('queued','uploading','processing')",message,now(),owner,platform);
 const prefs=await settings(owner);prefs.autopilot=false;await saveSettings(owner,prefs);
 if(platform==='facebook'){const stored=await one('SELECT payload FROM church_settings WHERE owner=?',owner);if(stored){const c=JSON.parse(stored.payload);c.autoPublish=false;await run('UPDATE church_settings SET payload=?,updated=? WHERE owner=?',JSON.stringify(c),now(),owner);}await run("UPDATE church_posts SET status='paused',message=?,updated=? WHERE owner=? AND status IN ('scheduled','waiting_connection')",message,now(),owner);await run("UPDATE church_posts SET status='needs_review',message='Account disconnected or changed during a photo upload. Review the original Page before any new delivery.',updated=? WHERE owner=? AND status IN ('uploading','processing')",now(),owner);}
}
export async function storeConnection(owner:string,platform:string,accountId:string,label:string,secret:any){const old=await one('SELECT account_id FROM connections WHERE owner=? AND platform=?',owner,platform);if(old&&old.account_id!==accountId)await pausePlatform(owner,platform,'Account changed. Review the original delivery and choose its intended account before rescheduling.');await run('INSERT INTO connections (id,owner,platform,account_id,label,secret,expires,created) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(owner,platform) DO UPDATE SET account_id=excluded.account_id,label=excluded.label,secret=excluded.secret,expires=excluded.expires',uid(),owner,platform,accountId,label,await seal(secret),secret.expiresAt||null,now());}
export async function disconnectConnection(owner:string,platform:string){if(!['facebook','instagram','youtube'].includes(platform))throw new HttpError(400,'Choose a supported account.');await pausePlatform(owner,platform,'Account disconnected. Review and reschedule after reconnecting.');await run('DELETE FROM connections WHERE owner=? AND platform=?',owner,platform);await run('DELETE FROM oauth_states WHERE owner=? AND provider=?',owner,platform);const prefs=await settings(owner);if(platform==='instagram'){await run("DELETE FROM oauth_states WHERE owner=? AND provider='facebook'",owner);if(prefs.pendingPagesTarget==='instagram'){delete prefs.pendingPages;delete prefs.pendingPagesExpires;delete prefs.pendingPagesTarget;}}if(platform==='facebook'){delete prefs.pendingPages;delete prefs.pendingPagesExpires;delete prefs.pendingPagesTarget;}if(platform==='youtube'){delete prefs.pendingYoutube;delete prefs.pendingYoutubeExpires;}await saveSettings(owner,prefs);await log(owner,`${platform} disconnected; affected automations paused.`,'connection');return {disconnected:true};}
export async function apiFetch(url:string,init:RequestInit={}){const res=await fetch(url,{...init,signal:AbortSignal.timeout(25000)});let data:any;try{data=await res.json()}catch{data={}}if(!res.ok||data.error){const msg=data.error?.message||data.error_description||`Platform request failed (${res.status}).`;throw new HttpError(502,String(msg).slice(0,300));}return data;}
export function connectionReturn(request:Request,provider:string,notice:string,message=''){const u=new URL('/?view=connections',request.url);u.searchParams.set('provider',provider);u.searchParams.set('connectionNotice',notice);if(message)u.searchParams.set('connectionMessage',message.slice(0,250));return Response.redirect(u.toString(),302);}
export async function oauthStart(request:Request,owner:string,provider:string){
 const e=await appConfiguration(owner);if(!['youtube','facebook','instagram'].includes(provider))throw new HttpError(400,'This connection is not available.');
 const ready=await setup(owner);if(!(provider==='instagram'?ready.instagramDirect:ready[provider as 'youtube'|'facebook']))return connectionReturn(request,provider,'setup_needed');
 if(provider==='facebook'){const prefs=await settings(owner);delete prefs.pendingPages;delete prefs.pendingPagesExpires;delete prefs.pendingPagesTarget;await saveSettings(owner,prefs);}
 const state=uid()+uid(),callback=new URL(`/api/oauth/${provider}/callback`,request.url).toString(),targetMode=new URL(request.url).searchParams.get('target')==='instagram'?'instagram':'facebook';
 await run('DELETE FROM oauth_states WHERE created<?',new Date(Date.now()-600000).toISOString());
 await run('INSERT INTO oauth_states (id,owner,provider,created,verifier) VALUES (?,?,?,?,?)',state,owner,provider,now(),JSON.stringify({target:targetMode}));
 let target:URL;
 if(provider==='youtube'){target=new URL('https://accounts.google.com/o/oauth2/v2/auth');Object.entries({client_id:e.GOOGLE_CLIENT_ID,redirect_uri:callback,response_type:'code',scope:'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly',access_type:'offline',prompt:'select_account consent',state}).forEach(([k,v])=>target.searchParams.set(k,String(v)));}
 else if(provider==='instagram'){target=new URL('https://www.instagram.com/oauth/authorize');Object.entries({client_id:e.INSTAGRAM_APP_ID,redirect_uri:callback,response_type:'code',scope:instagramDirectPublishPermissions.join(','),force_authentication:'1',enable_fb_login:'0',state}).forEach(([k,v])=>target.searchParams.set(k,String(v)));}
 else{target=new URL(`https://www.facebook.com/${e.META_GRAPH_VERSION}/dialog/oauth`);Object.entries({client_id:e.META_APP_ID,redirect_uri:callback,state,response_type:'code',auth_type:'rerequest',...(e.META_LOGIN_CONFIG_ID?{config_id:e.META_LOGIN_CONFIG_ID,override_default_response_type:'true'}:{scope:facebookPermissions(targetMode).join(',')})}).forEach(([k,v])=>target.searchParams.set(k,String(v)));}
 return Response.redirect(target.toString(),302);
}
export async function oauthCallback(request:Request,owner:string,provider:string){
 if(!['youtube','facebook','instagram'].includes(provider))throw new HttpError(400,'This connection is not available.');
 const url=new URL(request.url),state=url.searchParams.get('state'),code=url.searchParams.get('code');
 const s=state?await one('DELETE FROM oauth_states WHERE id=? AND owner=? AND provider=? AND created>? RETURNING *',state,owner,provider,new Date(Date.now()-600000).toISOString()):null;
 if(!s)throw new HttpError(400,'Connection expired. Start again from Connect.');
 if(url.searchParams.get('error')||!code)return connectionReturn(request,provider,'cancelled');
 const e=await appConfiguration(owner),callback=new URL(`/api/oauth/${provider}/callback`,request.url).toString();
 if(provider==='youtube'){
 const token=await apiFetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({code,client_id:e.GOOGLE_CLIENT_ID,client_secret:e.GOOGLE_CLIENT_SECRET,redirect_uri:callback,grant_type:'authorization_code'})});
 if(!token.refresh_token)throw new HttpError(400,'Offline access was not granted. Reconnect and approve the requested permissions.');
 const ch=await apiFetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',{headers:{Authorization:`Bearer ${token.access_token}`}});if(!ch.items?.length)throw new HttpError(400,'Create a YouTube channel for this Google account first.');
 const saved={...token,provider:'google',expiresAt:new Date(Date.now()+token.expires_in*1000).toISOString()};
 if(ch.items.length===1)await storeConnection(owner,'youtube',ch.items[0].id,ch.items[0].snippet.title,saved);
 else await saveSettings(owner,{...await settings(owner),pendingYoutube:await seal({token:saved,channels:ch.items.map((c:any)=>({id:c.id,name:c.snippet.title}))}),pendingYoutubeExpires:new Date(Date.now()+600000).toISOString()});
 }else if(provider==='instagram'){
 const form=new FormData();for(const [k,v] of Object.entries({client_id:e.INSTAGRAM_APP_ID,client_secret:e.INSTAGRAM_APP_SECRET,grant_type:'authorization_code',redirect_uri:callback,code}))form.set(k,String(v));
 const raw=await apiFetch('https://api.instagram.com/oauth/access_token',{method:'POST',body:form});const short=raw.data?.[0]||raw;if(!short.access_token)throw new HttpError(400,'Instagram authorization was not confirmed.');
 const token=await apiFetch('https://graph.instagram.com/access_token?'+new URLSearchParams({grant_type:'ig_exchange_token',client_secret:e.INSTAGRAM_APP_SECRET,access_token:short.access_token}));
 const profile=await apiFetch(`https://graph.instagram.com/${e.INSTAGRAM_GRAPH_VERSION}/me?fields=user_id,username`,{headers:{Authorization:`Bearer ${token.access_token}`}});
 const id=profile.user_id||profile.id||short.user_id;if(!id||!profile.username)throw new HttpError(400,'Instagram did not confirm a professional account.');
 await storeConnection(owner,'instagram',String(id),'@'+profile.username,{...token,provider:'instagram',expiresAt:new Date(Date.now()+token.expires_in*1000).toISOString()});
 }else{
 const graph=`https://graph.facebook.com/${e.META_GRAPH_VERSION}`;
 const short=await apiFetch(graph+'/oauth/access_token?'+new URLSearchParams({client_id:e.META_APP_ID,client_secret:e.META_APP_SECRET,redirect_uri:callback,code}));
 const token=await apiFetch(graph+'/oauth/access_token?'+new URLSearchParams({grant_type:'fb_exchange_token',client_id:e.META_APP_ID,client_secret:e.META_APP_SECRET,fb_exchange_token:short.access_token}));
 let target='facebook';try{target=JSON.parse(s.verifier||'{}').target==='instagram'?'instagram':'facebook'}catch{}
 const permissions=await apiFetch(graph+'/me/permissions',{headers:{Authorization:`Bearer ${token.access_token}`}});
 const granted=Array.isArray(permissions.data)?permissions.data.filter((p:any)=>p.status==='granted'&&typeof p.permission==='string').map((p:any)=>p.permission):[];
 const missing=facebookPermissions(target).filter(p=>!granted.includes(p));
 if(missing.length)throw new HttpError(403,`Meta did not grant ${missing.join(', ')}. Enable them in your Meta app's matching use case or Login for Business configuration, then connect again.`);
 const instagramAllowed=hasPermissions(granted,instagramFacebookPublishPermissions);
 const fields='id,name,access_token'+(instagramAllowed?',instagram_business_account':'');
 const pages=await apiFetch(graph+'/me/accounts?'+new URLSearchParams({fields,limit:'100'}),{headers:{Authorization:`Bearer ${token.access_token}`}});
 if(!pages.data?.length)throw new HttpError(400,'No eligible Pages were authorized. Allow access to a Page you manage.');
 await saveSettings(owner,{...await settings(owner),pendingPages:await seal(pages.data.filter((p:any)=>p.id&&p.name&&p.access_token).map((p:any)=>({id:p.id,name:p.name,access_token:p.access_token,ig:instagramAllowed?p.instagram_business_account?.id:undefined,permissions:granted}))),pendingPagesTarget:target,pendingPagesExpires:new Date(Date.now()+600000).toISOString()});
 }
 await log(owner,provider==='facebook'?'Facebook authorized. Choose the Page to connect.':`${provider} authorization completed.`,'connection');
 return connectionReturn(request,provider,'authorized');
}
export async function choosePage(owner:string,id:string,includeInstagram=false){
 let prefs=await settings(owner);if(!prefs.pendingPages||new Date(prefs.pendingPagesExpires||0).getTime()<Date.now())throw new HttpError(400,'Page selection expired. Connect Facebook again.');
 const list=await unseal(prefs.pendingPages),p=list.find((p:any)=>p.id===id);if(!p)throw new HttpError(400,'Select an authorized Page.');
 const target=prefs.pendingPagesTarget==='instagram'?'instagram':'facebook';
 if(!hasPermissions(p.permissions,facebookPermissions(target)))throw new HttpError(400,'Publishing permissions were not verified. Start a new connection and approve the required permissions.');
 if(includeInstagram&&!hasPermissions(p.permissions,instagramFacebookPublishPermissions))throw new HttpError(400,'Connect Instagram separately and approve its publishing permissions first.');
 if(target==='instagram'){if(!p.ig)throw new HttpError(400,'This Page does not have a linked professional Instagram account.');await storeConnection(owner,'instagram',p.ig,p.name+' · Instagram',{access_token:p.access_token,provider:'facebook',permissions:p.permissions});}
 else{await storeConnection(owner,'facebook',p.id,p.name,{access_token:p.access_token,provider:'facebook',permissions:p.permissions});if(includeInstagram&&p.ig)await storeConnection(owner,'instagram',p.ig,p.name+' · Instagram',{access_token:p.access_token,provider:'facebook',permissions:p.permissions});}
 prefs=await settings(owner);delete prefs.pendingPages;delete prefs.pendingPagesExpires;delete prefs.pendingPagesTarget;await saveSettings(owner,prefs);return {connected:true};
}
export async function chooseYoutube(owner:string,id:string){let prefs=await settings(owner);if(!prefs.pendingYoutube||new Date(prefs.pendingYoutubeExpires||0).getTime()<Date.now())throw new HttpError(400,'Channel selection expired. Connect YouTube again.');const pending=await unseal(prefs.pendingYoutube),channel=pending.channels.find((x:any)=>x.id===id);if(!channel)throw new HttpError(400,'Select an authorized YouTube channel.');await storeConnection(owner,'youtube',channel.id,channel.name,pending.token);prefs=await settings(owner);delete prefs.pendingYoutube;delete prefs.pendingYoutubeExpires;await saveSettings(owner,prefs);return {connected:true};}
export async function publicSettings(owner:string){const s=await settings(owner);const pages=s.pendingPages&&new Date(s.pendingPagesExpires||0).getTime()>Date.now()?await unseal(s.pendingPages):[];const youtube=s.pendingYoutube&&new Date(s.pendingYoutubeExpires||0).getTime()>Date.now()?await unseal(s.pendingYoutube):{channels:[]};delete s.pendingPages;delete s.pendingYoutube;return {...s,pendingPages:pages.map((p:any)=>({id:p.id,name:p.name,instagram:!!p.ig,instagramChecked:hasPermissions(p.permissions,instagramFacebookPublishPermissions),canPublishInstagram:!!p.ig&&hasPermissions(p.permissions,instagramFacebookPublishPermissions)})),pendingYoutubeChannels:youtube.channels};}
