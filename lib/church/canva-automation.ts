import {checkpointRetiredCanva} from './canva-history';
import {E,one,rows,run,uid,now,HttpError,seal,unseal,apiEndpoint} from '../server';
import {churchConfig,prepareChurchPosts} from './server';
import {churchCanvaRender,downloadCanvaPng} from './canva';
import {canvaValues,checkCanvaFields,requiredCanvaFields,optionalCanvaFields,canvaFieldHelp} from './canva-fields';
import {CHURCH_IMAGE_TEXT_VERSION,type ChurchConfig,type ChurchSpec} from './model';
import {reserveCanvaPage} from './canva-pages';

type Kind=ChurchSpec['kind'];
type Binding={sourceUrl:string;designId:string;page:number;pageMode?:'single'|'rotate';title:string;pageCount:number;sourceUpdated:number;dataset:Record<string,{type:string}>;checkedAt:string;imageTextVersion?:number};
function bindingCurrent(series:Kind,binding?:Binding){return !!binding&&(series==='event'||binding.imageTextVersion===CHURCH_IMAGE_TEXT_VERSION);}
type AuthorizationStage='state_validation'|'app_validation'|'token_exchange'|'account_verification'|'save_connection';
type AuthorizationResult={created:string;status:'started'|'connected'|'error';stage:AuthorizationStage;code:string;message:string;httpStatus?:number;providerCode?:string;errorType?:string};
type Config={enabled:boolean;bindings:Partial<Record<Kind,Binding>>;lastAuthorizationResult?:AuthorizationResult};
const scopes=['design:meta:read','design:content:read','design:content:write'];
const authorizationEndpoint='https://www.canva.com/api/oauth/authorize';
const codeChallengeMethod='S256';
const kinds:Kind[]=['daily','service','christmas','event'];
const mutable=['draft','scheduled','waiting_connection','paused'];
const b64=(b:Uint8Array)=>btoa(String.fromCharCode(...b)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
async function digest(s:string){return b64(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))));}
async function app(owner:string){const r=await one("SELECT secret FROM provider_apps WHERE owner=? AND provider='canva'",owner);return r?await unseal(r.secret):{clientId:E().CANVA_CLIENT_ID||'',clientSecret:E().CANVA_CLIENT_SECRET||''};}
async function config(owner:string):Promise<Config>{const r=await one('SELECT payload FROM canva_settings WHERE owner=?',owner);return r?{enabled:false,bindings:{},...JSON.parse(r.payload)}:{enabled:false,bindings:{}};}
async function save(owner:string,c:Config){await run('INSERT INTO canva_settings (owner,payload,updated) VALUES (?,?,?) ON CONFLICT(owner) DO UPDATE SET payload=excluded.payload,updated=excluded.updated',owner,JSON.stringify(c),now());}
function kind(value:unknown):Kind{if(!kinds.includes(value as Kind))throw new HttpError(400,'Choose a saved church series.');return value as Kind;}
function active(c:ChurchConfig,row:any){return row.series==='daily'?c.dailyEnabled:row.series==='service'?c.serviceEnabled:row.series==='christmas'?c.christmasEnabled:c.events.some(e=>e.id===row.event_id&&e.enabled);}
function safeCode(data:any){const code=data?.code??data?.error;return typeof code==='string'&&/^[a-z_]{1,80}$/.test(code)?code:'request_failed';}
class CanvaRequestError extends HttpError{
 constructor(public code:string,message:string,public httpStatus?:number,public providerCode?:string){super(502,message);}
}
async function canvaJson(path:string,init:RequestInit,label:string){
 let r:Response;try{r=await fetch('https://api.canva.com/rest/v1'+path,{...init,redirect:'manual',signal:AbortSignal.timeout(20000)});}
 catch(e){const timeout=e instanceof Error&&['TimeoutError','AbortError'].includes(e.name);throw new CanvaRequestError(timeout?'canva_timeout':'canva_unreachable',`${label} ${timeout?'timed out':'could not reach Canva'}. This request was not automatically retried.`);}
 const contentType=r.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase();
 if(r.status>=300&&r.status<400){await r.body?.cancel();throw new CanvaRequestError('unexpected_redirect',`${label} received an unexpected redirect from Canva (HTTP ${r.status}). No credentials were forwarded to the redirect.`,r.status);}
 if(contentType!=='application/json'&&!contentType?.endsWith('+json')){await r.body?.cancel();throw new CanvaRequestError('unexpected_response',`${label} received a webpage or other unexpected response from Canva (HTTP ${r.status}). This request was not automatically retried.`,r.status);}
 let d:any;try{d=await r.json();}catch{throw new CanvaRequestError('invalid_json',`${label} received an incomplete response from Canva (HTTP ${r.status}). This request was not automatically retried.`,r.status);}
 if(!d||typeof d!=='object'||Array.isArray(d))throw new CanvaRequestError('invalid_json',`${label} received an invalid response from Canva (HTTP ${r.status}).`,r.status);
 if(!r.ok){const code=safeCode(d),credentials=path==='/oauth/token'&&(code==='invalid_client'||(r.status===401&&code==='invalid_access_token'));
  throw new CanvaRequestError('provider_rejected',credentials?'Canva rejected the app credentials. In Canva app settings, save the matching Client ID and Client secret from the same Canva developer app, then start a new connection.':`${label} was rejected by Canva (${code}; HTTP ${r.status}). Check the connection details before starting a new request.`,r.status,code);}
 return d;
}
async function tokenRequest(a:any,body:URLSearchParams){
 const d=await canvaJson('/oauth/token',{method:'POST',headers:{Authorization:'Basic '+btoa(a.clientId+':'+a.clientSecret),Accept:'application/json','Content-Type':'application/x-www-form-urlencoded'},body:body.toString()},body.get('grant_type')==='refresh_token'?'The Canva token refresh':'The Canva sign-in token exchange');
 if(typeof d.access_token!=='string'||!d.access_token||typeof d.refresh_token!=='string'||!d.refresh_token||!Number.isFinite(d.expires_in)||d.expires_in<1)throw new CanvaRequestError('incomplete_token','Canva did not return complete sign-in credentials. Start a new connection; the previous code will not be retried.');
 if(d.scope!==undefined&&(typeof d.scope!=='string'||scopes.some(s=>!d.scope.split(/\s+/).includes(s))))throw new CanvaRequestError('missing_permissions','Canva did not grant all three required design permissions. Enable them in your Canva developer app and reconnect.');
 return {...d,expiresAt:new Date(Date.now()+d.expires_in*1000).toISOString()};
}
export async function canvaApi(token:string,path:string,body?:any,label='The Canva request'){
 return canvaJson(path,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+token,Accept:'application/json',...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})},label);
}
const api=canvaApi;
async function authorizationResult(owner:string,result:AuthorizationResult){
 // Update just this field so callback diagnostics cannot overwrite planner switches or bindings.
 const payload=JSON.stringify(result),created=now();
 try{await run("INSERT INTO canva_settings (owner,payload,updated) VALUES (?,?,?) ON CONFLICT(owner) DO UPDATE SET payload=json_set(canva_settings.payload,'$.lastAuthorizationResult',json(?)),updated=?",owner,JSON.stringify({enabled:false,bindings:{},lastAuthorizationResult:result}),created,payload,created);}
 catch{console.error('Canva authorization diagnostic could not be saved.');}
}
export async function canvaAccess(owner:string){
 const row=await one('SELECT * FROM canva_accounts WHERE owner=?',owner);if(!row)throw new HttpError(409,'Connect Canva to ekklo. first.');
 if(row.refresh_claim)throw new HttpError(409,'Canva authorization needs reconnection. An interrupted token refresh will not be repeated.');
 const old=await unseal(row.secret);if(Date.parse(row.expires)>Date.now()+60000)return {token:old.access_token,accountId:row.account_id};
 const claim=uid(),got=await run('UPDATE canva_accounts SET refresh_claim=? WHERE owner=? AND secret=? AND refresh_claim IS NULL',claim,owner,row.secret);if(!got.meta.changes)throw new HttpError(409,'Another Canva connection check is running.');
 // Rotating refresh tokens are never replayed after an uncertain response.
 const tokens=await tokenRequest(await app(owner),new URLSearchParams({grant_type:'refresh_token',refresh_token:old.refresh_token}));
 const r=await run('UPDATE canva_accounts SET secret=?,expires=?,refresh_claim=NULL,updated=? WHERE owner=? AND secret=? AND refresh_claim=?',await seal(tokens),tokens.expiresAt,now(),owner,row.secret,claim);
 if(!r.meta.changes)throw new HttpError(409,'The Canva connection changed during authorization. Reconnect it.');return {token:tokens.access_token,accountId:row.account_id};
}
export async function canvaAutomationState(owner:string){
 const [a,c,account,church,pending]=await Promise.all([app(owner),config(owner),one('SELECT account_id,expires,refresh_claim FROM canva_accounts WHERE owner=?',owner),churchConfig(owner),one("SELECT created,verifier FROM oauth_states WHERE owner=? AND provider='canva' AND created>=? ORDER BY created DESC LIMIT 1",owner,new Date(Date.now()-600000).toISOString())]);
 const snapshot=pending?(await unseal(pending.verifier)).authorization:null;
 const rotations=await rows('SELECT series,event_id,source_url,design_id,next_page FROM canva_page_rotations WHERE owner=?',owner);
 // Only public request metadata leaves the server. State, PKCE verifier, hashes and secrets stay private.
 const lastAuthorization=snapshot?{created:pending.created,clientId:snapshot.clientId,redirectUri:snapshot.redirectUri,endpoint:authorizationEndpoint,codeChallengeMethod:snapshot.codeChallengeMethod,scopes:[...scopes]}:null;
 return {setupReady:!!(a.clientId&&a.clientSecret&&E().TOKEN_ENCRYPTION_KEY),clientId:a.clientId||'',hasSecret:!!a.clientSecret,connected:!!account&&!account.refresh_claim,reconnectRequired:!!account?.refresh_claim,enabled:c.enabled,lastImageCheck:(church as any).lastImageCheck||null,backgroundBound:!!(church as any).backgroundIdentityEmail,scopes,authorization:{endpoint:authorizationEndpoint,codeChallengeMethod},lastAuthorization,lastAuthorizationResult:c.lastAuthorizationResult||null,fieldHelp:canvaFieldHelp,
 templates:kinds.filter(k=>church.canvaSources[k]).map(series=>{const b=c.bindings[series],matched=b?.sourceUrl===church.canvaSources[series]&&bindingCurrent(series,b),rotation=rotations.find(r=>r.series===series&&!r.event_id&&r.source_url===b?.sourceUrl&&r.design_id===b?.designId);return {series,sourceUrl:church.canvaSources[series],requiredFields:requiredCanvaFields[series],optionalFields:optionalCanvaFields[series],binding:matched?{...b,pageMode:b?.pageMode||'single',nextPage:rotation?.next_page||1}:null};})};
}
export async function saveCanvaApp(owner:string,input:any){
 const old=await app(owner),clientId=typeof input.clientId==='string'?input.clientId.trim():old.clientId,clientSecret=typeof input.clientSecret==='string'&&input.clientSecret.trim()?input.clientSecret.trim():old.clientSecret;
 if(!/^[A-Za-z0-9_-]{5,160}$/.test(clientId||'')||!/^[\x21-\x7e]{16,512}$/.test(clientSecret||'')||clientSecret.includes(':'))throw new HttpError(400,'Enter the Canva developer app Client ID and Client secret.');
 if(clientId!==old.clientId&&old.clientId&&!input.clientSecret?.trim())throw new HttpError(400,'Enter the matching secret when changing the Canva Client ID.');
 const encrypted=await seal({clientId,clientSecret});
 if(clientId!==old.clientId||clientSecret!==old.clientSecret){await disconnectCanva(owner);const c=await config(owner);c.bindings={};await save(owner,c);}
 await run("INSERT INTO provider_apps (id,owner,provider,secret,updated) VALUES (?,?,'canva',?,?) ON CONFLICT(owner,provider) DO UPDATE SET secret=excluded.secret,updated=excluded.updated",uid(),owner,encrypted,now());
 return canvaAutomationState(owner);
}
export async function connectCanva(owner:string,request:Request){
 const a=await app(owner);if(!a.clientId||!a.clientSecret||!E().TOKEN_ENCRYPTION_KEY)throw new HttpError(409,'Save your Canva developer app keys first.');
 const state=uid()+uid(),verifier=b64(crypto.getRandomValues(new Uint8Array(48))),redirectUri=apiEndpoint(request,'canva/callback');
 const authorization={clientId:a.clientId,redirectUri,codeChallengeMethod};
 await run("DELETE FROM oauth_states WHERE owner=? AND provider='canva'",owner);
 await run("INSERT INTO oauth_states (id,owner,provider,created,verifier) VALUES (?,?,'canva',?,?)",state,owner,now(),await seal({verifier,redirectUri,appHash:await digest(a.clientId+':'+a.clientSecret),authorization}));
 await authorizationResult(owner,{created:now(),status:'started',stage:'state_validation',code:'started',message:'Waiting for Canva authorization.'});
 const u=new URL(authorizationEndpoint);for(const [k,v] of Object.entries({client_id:a.clientId,response_type:'code',code_challenge_method:codeChallengeMethod,code_challenge:await digest(verifier),redirect_uri:redirectUri,state,scope:scopes.join(' ')}))u.searchParams.set(k,v);
 return {authorizationUrl:u.toString()};
}
export async function canvaCallback(owner:string,request:Request){
 let stage:AuthorizationStage='state_validation',claimed=false;
 try{
 const u=new URL(request.url),state=u.searchParams.get('state'),row=await one("SELECT * FROM oauth_states WHERE id=? AND owner=? AND provider='canva' AND created>=?",state||'',owner,new Date(Date.now()-600000).toISOString());
 if(!row)throw new HttpError(400,'This Canva sign-in expired or does not belong to you. Start a new connection.');
 const consumed=await run("DELETE FROM oauth_states WHERE id=? AND owner=? AND provider='canva'",state,owner);if(!consumed.meta.changes)throw new HttpError(409,'This Canva sign-in was already used.');
 claimed=true;
 if(u.searchParams.has('error'))throw new HttpError(400,'Canva connection was not approved.');const code=u.searchParams.get('code');if(!code||code.length>5000)throw new HttpError(400,'Canva did not return an authorization code.');
 stage='app_validation';const a=await app(owner),v=await unseal(row.verifier);if(v.appHash!==await digest(a.clientId+':'+a.clientSecret))throw new HttpError(409,'Canva app keys changed. Start a new connection.');
 stage='token_exchange';
 const tokens=await tokenRequest(a,new URLSearchParams({grant_type:'authorization_code',code,code_verifier:v.verifier,redirect_uri:v.redirectUri}));
 stage='account_verification';const me=await api(tokens.access_token,'/users/me',undefined,'Canva account verification'),identity=me.team_user;if(typeof identity?.user_id!=='string'||!identity.user_id||typeof identity?.team_id!=='string'||!identity.team_id)throw new CanvaRequestError('missing_identity','Canva did not confirm the connected user and team. Start a new connection; the previous code will not be retried.');
 stage='save_connection';
 const accountId=identity.team_id+':'+identity.user_id,prior=await one('SELECT account_id FROM canva_accounts WHERE owner=?',owner);
 if(prior&&prior.account_id!==accountId){const c=await config(owner);c.enabled=false;c.bindings={};await save(owner,c);}
 await run('INSERT INTO canva_accounts (owner,account_id,secret,expires,updated) VALUES (?,?,?,?,?) ON CONFLICT(owner) DO UPDATE SET account_id=excluded.account_id,secret=excluded.secret,expires=excluded.expires,refresh_claim=NULL,updated=excluded.updated',owner,accountId,await seal(tokens),tokens.expiresAt,now());
 await authorizationResult(owner,{created:now(),status:'connected',stage,code:'connected',message:'Canva connected to ekklo..'});
 return {connected:true};
 }catch(e){
  const message=e instanceof HttpError?e.message:`Canva sign-in failed during ${stage.replaceAll('_',' ')}. Check Connection details for the saved failure; start a new connection after the cause is resolved.`;
  if(claimed){const result:AuthorizationResult={created:now(),status:'error',stage,code:e instanceof CanvaRequestError?e.code:'callback_failed',message,...(e instanceof CanvaRequestError?{httpStatus:e.httpStatus,providerCode:e.providerCode}:{}),errorType:e instanceof SyntaxError?'SyntaxError':e instanceof TypeError?'TypeError':e instanceof HttpError?'HttpError':'Error'};console.error('Canva authorization failed',JSON.stringify(result));await authorizationResult(owner,result);}
  throw e instanceof HttpError?e:new HttpError(502,message);
 }
}
export async function disconnectCanva(owner:string){
 const c=await config(owner);c.enabled=false;delete c.lastAuthorizationResult;await save(owner,c);await run('DELETE FROM canva_accounts WHERE owner=?',owner);await run("DELETE FROM oauth_states WHERE owner=? AND provider='canva'",owner);return {disconnected:true};
}
export async function resolveCanvaSource(source:string){
 let u=new URL(source);for(let n=0;n<4;n++){
 if(u.protocol!=='https:'||u.username||u.password||!['canva.link','www.canva.com','canva.com'].includes(u.hostname))throw new HttpError(400,'Use the exact saved Canva design link.');
 if(u.hostname!=='canva.link'){const id=u.pathname.match(/^\/design\/([A-Za-z0-9_-]{5,120})(?:\/|$)/)?.[1];if(id)return id;if(!/^\/d\/[A-Za-z0-9_-]{5,200}\/?$/.test(u.pathname))throw new HttpError(400,'This Canva link does not identify an existing design.');}
 const r=await fetch(u,{redirect:'manual',signal:AbortSignal.timeout(15000)});await r.body?.cancel();const target=r.headers.get('location');if(![301,302,303,307,308].includes(r.status)||!target)throw new HttpError(409,'The saved Canva shortlink could not be resolved. Keep the image pending and check sharing access.');u=new URL(target,u);
 }throw new HttpError(409,'Canva returned too many link redirects.');
}
async function inspect(token:string,sourceUrl:string,page:number,series:Kind){
 const designId=await resolveCanvaSource(sourceUrl),meta=(await api(token,'/designs/'+encodeURIComponent(designId))).design,dataset=(await api(token,'/designs/'+encodeURIComponent(designId)+'/dataset')).dataset||{};
 if(meta?.id!==designId||!Number.isInteger(meta.page_count)||!Number.isInteger(meta.updated_at)||page<1||page>meta.page_count)throw new HttpError(400,'Choose one existing page in the saved Canva design.');
 const result=checkCanvaFields(series,dataset);return {...result,binding:{sourceUrl,designId,page,title:String(meta.title||'Canva design').slice(0,200),pageCount:meta.page_count,sourceUpdated:meta.updated_at,dataset,checkedAt:now(),imageTextVersion:CHURCH_IMAGE_TEXT_VERSION} as Binding};
}
export async function checkCanvaTemplate(owner:string,input:any){
 const series=kind(input.series),church=await churchConfig(owner),sourceUrl=church.canvaSources[series];if(!sourceUrl||input.sourceUrl!==sourceUrl)throw new HttpError(409,'Save this template in the church planner before checking it.');
 const pageMode=input.pageMode??'single';if(!['single','rotate'].includes(pageMode))throw new HttpError(400,'Choose one page or rotate all Canva pages.');
 const page=pageMode==='rotate'?1:Number(input.page);if(!Number.isInteger(page)||page<1||page>1000)throw new HttpError(400,'Choose a single Canva page number.');
 const access=await canvaAccess(owner),result=await inspect(access.token,sourceUrl,page,series);result.binding.pageMode=pageMode;const fresh=await churchConfig(owner);if(fresh.canvaSources[series]!==sourceUrl)throw new HttpError(409,'The saved template changed during the check.');
 const c=await config(owner);if(result.ready)c.bindings[series]=result.binding;else delete c.bindings[series];await save(owner,c);
 return {...result,requiredFields:requiredCanvaFields[series],optionalFields:optionalCanvaFields[series]};
}
export async function enableCanvaAutomation(owner:string,input:any){
 const c=await config(owner);if(input.enabled===true){await canvaAccess(owner);const church=await churchConfig(owner);if(!kinds.some(k=>c.bindings[k]?.sourceUrl===church.canvaSources[k]&&bindingCurrent(k,c.bindings[k])))throw new HttpError(409,'Check at least one saved template with all its required text fields first.');}
 c.enabled=input.enabled===true;await save(owner,c);return canvaAutomationState(owner);
}
async function taskPatch(owner:string,row:any,values:Record<string,unknown>,expectedPhase?:string){
 const content=JSON.parse(row.payload),c=content.canva;if(!c?.claimToken)return false;
 const entries=Object.entries(values),set=entries.flatMap(([k,v])=>['$.canva.'+k,typeof v==='object'?JSON.stringify(v):v]);
 const r=await run(`UPDATE church_posts SET payload=json_set(payload,${entries.map(()=> '?,?').join(',')}),updated=? WHERE owner=? AND id=? AND json_extract(payload,'$.canva.renderId')=? AND json_extract(payload,'$.canva.claimToken')=? AND json_extract(payload,'$.canva.state')='rendering' AND image_key IS NULL AND remote_id IS NULL AND claimed IS NULL AND scheduled>=? AND status IN ('draft','scheduled','waiting_connection','paused')${expectedPhase?" AND json_extract(payload,'$.canva.phase')=?":''}`,...set,now(),owner,row.id,c.renderId,c.claimToken,new Date(Date.now()-75*60000).toISOString(),...(expectedPhase?[expectedPhase]:[]));
 if(!r.meta.changes){
 // Preserve late confirmations from a request already sent before removal.
 // Returning false still stops the caller before it can start another request.
 const evidence=entries.filter(([k])=>['autofillJobId','designId','exportJobId','exportUrl','exportedAt'].includes(k));
 if(evidence.length)await checkpointRetiredCanva(owner,row.id,c.renderId,c.claimToken,Object.fromEntries(evidence));
 if(evidence.length)await run(`UPDATE church_posts SET payload=json_set(payload,${evidence.map(()=> '?,?').join(',')}),updated=? WHERE owner=? AND id=? AND status IN ('removed','needs_review') AND json_extract(payload,'$.canva.renderId')=? AND json_extract(payload,'$.canva.claimToken')=?${evidence.filter(([k])=>k.endsWith('Id')).map(([k])=>` AND (json_extract(payload,'$.canva.${k}') IS NULL OR json_extract(payload,'$.canva.${k}')=?)`).join('')}`,...evidence.flatMap(([k,v])=>['$.canva.'+k,v]),now(),owner,row.id,c.renderId,c.claimToken,...evidence.filter(([k])=>k.endsWith('Id')).map(([,v])=>v));
 }
 return !!r.meta.changes;
}
function autofillData(content:any,binding:Binding,church:ChurchConfig){
 const values=canvaValues(content,church);
 return Object.fromEntries(Object.entries(binding.dataset).filter(([k,v])=>v.type==='text'&&Object.hasOwn(values,k)).sort(([a],[b])=>a.localeCompare(b)).map(([k])=>[k,{type:'text',text:values[k]}]));
}
async function inputHash(content:any,binding:Binding,church:ChurchConfig,page:number,accountId:string){
 return digest(JSON.stringify({sourceUrl:binding.sourceUrl,designId:binding.designId,sourceUpdated:binding.sourceUpdated,page,accountId,data:autofillData(content,binding,church)}));
}
/** Validate provider receipts and the saved inputs; no owner approval click is needed. */
async function finishAutomatic(owner:string,row:any,access:{token:string;accountId:string},binding:Binding,church:ChurchConfig){
 const content=JSON.parse(row.payload),c=content.canva;
 async function hold(message:string){await taskPatch(owner,row,{phase:'needs_review',error:message});return 'needs_review';}
 if(!c.autofillJobId||!c.designId||!c.exportJobId||!c.exportUrl||c.designId===c.sourceDesignId)return hold('The original Canva job is not fully confirmed. No replacement will be created.');
 const hash=await inputHash(content,binding,church,c.page,access.accountId);
 if(c.inputHash&&c.inputHash!==hash)return hold('The saved image text changed after Canva generation started. The existing render is held.');
 // Older confirmed direct-API jobs predate input hashes. Their captured source and field list must still match.
 const fields=Object.entries(binding.dataset).filter(([,v])=>v.type==='text').map(([k])=>k).sort().join(',');
 if(!c.inputHash&&(typeof c.textFields!=='string'||c.textFields.split(',').sort().join(',')!==fields))return hold('The earlier Canva job has no matching saved input record. Its existing design is held.');
 const source=await inspect(access.token,c.sourceUrl,c.page,row.series);
 if(!source.ready||source.binding.designId!==c.sourceDesignId||source.binding.sourceUpdated!==c.sourceUpdated||JSON.stringify(source.binding.dataset)!==JSON.stringify(binding.dataset))return hold('The saved Canva template changed. Its existing render is held.');
 const job=(await api(access.token,'/autofills/'+encodeURIComponent(c.autofillJobId))).job;
 if(job?.id!==c.autofillJobId||job.status!=='success'||job.result?.type!=='create_design'||job.result.design?.id!==c.designId)return hold('Canva did not confirm the saved autofill job and output design together.');
 const output=(await api(access.token,'/designs/'+encodeURIComponent(c.designId))).design;
 if(output?.id!==c.designId||!Number.isInteger(output.page_count)||c.page>output.page_count||!Number.isInteger(job.result.design.updated_at)||output.updated_at!==job.result.design.updated_at)return hold('The generated Canva design changed or its selected page could not be confirmed.');
 if(!await taskPatch(owner,row,{verifiedInputHash:hash,automaticVerification:'canva_autofill_v1',outputUpdated:output.updated_at,verifiedAt:now(),error:''},'awaiting_verification'))return 'changed';
 await churchCanvaRender(owner,{action:'complete',postId:row.id,renderId:c.renderId,claimToken:c.claimToken,designId:c.designId,sourceUrl:c.sourceUrl,exportUrl:c.exportUrl,contentVerified:true},{automatic:true});
 return 'ready';
}
async function pendingNotice(owner:string,row:any,error:string){
 await run("UPDATE church_posts SET payload=json_set(payload,'$.canva.error',?),updated=? WHERE owner=? AND id=? AND payload=? AND image_key IS NULL AND claimed IS NULL AND remote_id IS NULL AND json_extract(payload,'$.canva.state')='pending' AND status IN ('draft','scheduled','waiting_connection','paused')",error,now(),owner,row.id,row.payload);
}
async function step(owner:string,row:any,access:{token:string;accountId:string},binding:Binding,church:ChurchConfig){
 let content=JSON.parse(row.payload),c=content.canva;
 if(c.state==='pending'){
 if(!(await config(owner)).enabled)return 'paused';
 const checked=await inspect(access.token,binding.sourceUrl,binding.page,row.series);
 if(!checked.ready||checked.binding.designId!==binding.designId){await pendingNotice(owner,row,!checked.ready?'The saved Canva template needs its required text labels: '+checked.missing.join(', ')+'. Check any unsupported labels before generating.':'The saved Canva link now resolves to a different design. Check the exact template before generating.');return 'template_setup_required';}
 if(!bindingCurrent(row.series,binding)||checked.binding.sourceUpdated!==binding.sourceUpdated||JSON.stringify(checked.binding.dataset)!==JSON.stringify(binding.dataset)){
  const snapshot=await one('SELECT payload FROM canva_settings WHERE owner=?',owner),fresh=JSON.parse(snapshot?.payload||'{}'),prior=fresh.bindings?.[row.series];
  if(!fresh.enabled||prior?.sourceUrl!==binding.sourceUrl||prior?.designId!==binding.designId)return 'changed';
  const refreshed={...checked.binding,pageMode:binding.pageMode||'single'},saved=await run("UPDATE canva_settings SET payload=json_set(payload,?,json(?)),updated=? WHERE owner=? AND payload=?",'$.bindings.'+row.series,JSON.stringify(refreshed),now(),owner,snapshot.payload);
  if(!saved.meta.changes)return 'changed';Object.assign(binding,refreshed);
 }
 const latest=await churchConfig(owner);if(latest.canvaSources[row.series as Kind]!==binding.sourceUrl||!active(latest,row)||!(await config(owner)).enabled)return 'paused';
 await churchCanvaRender(owner,{action:'claim',postId:row.id,renderId:c.renderId});row=await one('SELECT * FROM church_posts WHERE owner=? AND id=?',owner,row.id);content=JSON.parse(row.payload);c=content.canva;
 const page=binding.pageMode==='rotate'?await reserveCanvaPage(owner,row,{...binding,accountId:access.accountId}):binding.page;
 if(!await taskPatch(owner,row,{method:'direct_api',phase:'create_started',error:'',inputHash:await inputHash(content,binding,church,page,access.accountId),textFields:Object.entries(binding.dataset).filter(([,v])=>v.type==='text').map(([k])=>k).join(','),canvaAccountId:access.accountId,sourceDesignId:binding.designId,page,pageMode:binding.pageMode||'single',pageCount:binding.pageCount,sourceUpdated:binding.sourceUpdated},binding.pageMode==='rotate'?'page_assigned':undefined))return 'changed';
 const data=autofillData(content,binding,church);
 // Claim and durable start marker precede this one-time create. Uncertain results are never replayed.
 const created=await api(access.token,'/autofills',{type:'create_from_design',design_id:binding.designId,title:content.title+' · '+content.date,data});
 if(!created.job?.id)throw new HttpError(502,'Canva did not confirm an autofill job ID. Leave this render for review.');
 if(!await taskPatch(owner,row,{autofillJobId:created.job.id,phase:'autofill_pending'},'create_started'))return 'changed';
 }
 for(let n=0;n<3;n++){
 row=await one('SELECT * FROM church_posts WHERE owner=? AND id=?',owner,row.id);if(!row||!mutable.includes(row.status)||row.image_key||row.remote_id||row.claimed)return 'changed';c=JSON.parse(row.payload).canva;
 const latest=await churchConfig(owner);if(!active(latest,row)||latest.canvaSources[row.series as Kind]!==c.sourceUrl||Date.parse(row.scheduled)<Date.now()-75*60000||!(await config(owner)).enabled)return 'paused';
 if(c.method!=='direct_api')return 'external_render';if(c.canvaAccountId!==access.accountId)return 'account_changed';
 if(c.sourceDesignId!==binding.designId||!Number.isInteger(c.page)||c.page<1||c.page>binding.pageCount||c.sourceUpdated!==binding.sourceUpdated)return 'template_changed';
 if(c.phase==='page_assigned'){await taskPatch(owner,row,{phase:'needs_review',error:'Preparation stopped after assigning this page. Review the render before any new Canva create request.'});return 'needs_review';}
 if(c.phase==='create_started'&&c.autofillJobId){if(!await taskPatch(owner,row,{phase:'autofill_pending'},'create_started'))return 'changed';continue;}
 if(c.phase==='export_started'&&c.designId&&c.exportJobId){if(!await taskPatch(owner,row,{phase:'export_pending'},'export_started'))return 'changed';continue;}
 if(c.phase==='create_started'||c.phase==='export_started')return 'needs_review';
 if(c.phase==='autofill_pending'){
 if(!c.autofillJobId)return 'needs_review';const job=(await api(access.token,'/autofills/'+encodeURIComponent(c.autofillJobId))).job;
 if(job?.status==='failed'){await taskPatch(owner,row,{phase:'needs_review',error:'Canva autofill failed. Review the confirmed job; no replacement was created.'});return 'needs_review';}if(job?.status!=='success'){await taskPatch(owner,row,{lastCheckedAt:now(),providerStatus:job?.status||'unconfirmed'});return 'generating';}
 const id=job.result?.type==='create_design'?job.result.design?.id:null;if(!id||id===c.sourceDesignId)throw new HttpError(502,'Canva did not confirm a separate output design.');
 await churchCanvaRender(owner,{action:'checkpoint',postId:row.id,renderId:c.renderId,claimToken:c.claimToken,designId:id});
 if(!await taskPatch(owner,row,{phase:'design_ready'},'autofill_pending'))return 'changed';continue;
 }
 if(c.phase==='design_ready'){
 if(!c.designId||!await taskPatch(owner,row,{phase:'export_started'},'design_ready'))return 'changed';
 const exported=await api(access.token,'/exports',{design_id:c.designId,format:{type:'png',pages:[c.page],lossless:true,transparent_background:false}});
 if(!exported.job?.id)throw new HttpError(502,'Canva did not confirm an export job ID. Leave this render for review.');
 await churchCanvaRender(owner,{action:'checkpoint',postId:row.id,renderId:c.renderId,claimToken:c.claimToken,designId:c.designId,exportJobId:exported.job.id});
 if(!await taskPatch(owner,row,{phase:'export_pending'},'export_started'))return 'changed';continue;
 }
 if(c.phase==='export_pending'||c.phase==='awaiting_verification'){
 if(!c.exportJobId||!c.designId)return 'needs_review';
 if(c.phase==='awaiting_verification'&&Date.parse(c.exportedAt)>Date.now()-20*3600000)return finishAutomatic(owner,row,access,binding,latest);
 const job=(await api(access.token,'/exports/'+encodeURIComponent(c.exportJobId))).job;
 if(job?.status==='failed'){await taskPatch(owner,row,{phase:'needs_review',error:'Canva export failed. Review the confirmed job; no replacement was created.'});return 'needs_review';}if(job?.status!=='success'){await taskPatch(owner,row,{lastCheckedAt:now(),providerStatus:job?.status||'unconfirmed'});return 'exporting';}
 if(job.id!==c.exportJobId||!Array.isArray(job.urls)||job.urls.length!==1)throw new HttpError(502,'Canva must confirm the saved export job and exactly one PNG page.');
 if(!await taskPatch(owner,row,{phase:'awaiting_verification',exportUrl:job.urls[0],exportedAt:now(),lastCheckedAt:now(),providerStatus:'success',error:''}))return 'changed';
 return finishAutomatic(owner,await one('SELECT * FROM church_posts WHERE owner=? AND id=?',owner,row.id),access,binding,latest);
 }
 return 'needs_review';
 }return 'generating';
}
export async function runAutomaticCanva(owner:string,maxJobs=2,options:{postIds?:string[];prepare?:boolean}={}){
 const c=await config(owner);if(!c.enabled)return {state:'paused',advanced:0};
 if(!await one('SELECT owner FROM canva_accounts WHERE owner=?',owner))return {state:'waiting_connection',advanced:0};
 if(options.prepare!==false)await prepareChurchPosts(owner);const church=await churchConfig(owner);let access;try{access=await canvaAccess(owner)}catch{return {state:'waiting_connection',advanced:0};}
 const ids=options.postIds?.slice(0,2);if(ids&&!ids.length)return {state:'enabled',advanced:0,results:[]};
 const list=await rows("SELECT * FROM church_posts WHERE owner=? AND scheduled>=? AND image_key IS NULL AND remote_id IS NULL AND claimed IS NULL AND status IN ('draft','scheduled','waiting_connection','paused')"+(ids?' AND id IN ('+ids.map(()=>'?').join(',')+')':'')+" ORDER BY scheduled ASC LIMIT 100",owner,new Date(Date.now()-75*60000).toISOString(),...(ids||[]));
 const results=[],blockedSeries=new Set<string>();for(const row of list){const content=JSON.parse(row.payload),binding=c.bindings[row.series as Kind];if(blockedSeries.has(row.series)||!content.canva||content.canva.requiresManualReview||!binding||binding.sourceUrl!==content.canva.sourceUrl||binding.sourceUrl!==church.canvaSources[row.series as Kind]||!active(church,row)||content.canva.state==='ready')continue;
 // Agent-created renders are only resumed by their confirmed native workflow.
 if(content.canva.state==='rendering'&&content.canva.method!=='direct_api')continue;
 if(content.canva.method==='direct_api'&&(content.canva.phase==='needs_review'||content.canva.phase==='create_started'&&!content.canva.autofillJobId||content.canva.phase==='export_started'&&!content.canva.exportJobId))continue;
 try{const state=await step(owner,row,access,binding,church);results.push({postId:row.id,state});if(['template_setup_required','template_changed'].includes(state))blockedSeries.add(row.series);}catch(e){const fresh=await one('SELECT * FROM church_posts WHERE owner=? AND id=?',owner,row.id),render=fresh?JSON.parse(fresh.payload).canva:null;if(render?.method==='direct_api')await taskPatch(owner,fresh,{error:e instanceof HttpError?e.message:'Canva preparation was interrupted. Resume only confirmed job IDs.'});else if(render?.state==='pending'){await pendingNotice(owner,fresh,e instanceof HttpError?e.message:'The saved Canva template could not be checked. No design was created.');blockedSeries.add(row.series);}results.push({postId:row.id,state:render?.state==='pending'?'template_setup_required':'pending_review'});}
 if(results.length>=Math.min(4,Math.max(1,maxJobs)))break;
 }
 // Editing is optional. A ready PNG remains publishable throughout an edit sync.
 const {syncCanvaEdits}=await import('./canva-review');
 const edits=options.prepare===false?[]:await syncCanvaEdits(owner,access,Math.min(2,maxJobs));
 return {state:'enabled',advanced:results.length+edits.length,results:[...results,...edits]};
}
export async function generatedCanvaPreview(owner:string,postId:string,renderId:string){
 const row=await one('SELECT * FROM church_posts WHERE owner=? AND id=?',owner,postId),c=row?JSON.parse(row.payload).canva:null;
 if(!c||c.renderId!==renderId||c.phase!=='awaiting_verification'||!c.designId||!c.exportJobId)throw new HttpError(409,'There is no confirmed Canva PNG ready for inspection.');
 return downloadCanvaPng(c.exportUrl);
}
export async function approveGeneratedCanva(owner:string,input:any){
 const row=await one('SELECT * FROM church_posts WHERE owner=? AND id=?',owner,input.postId),c=row?JSON.parse(row.payload).canva:null;
 if(!c||c.renderId!==input.renderId||c.phase!=='awaiting_verification'||input.contentVerified!==true)throw new HttpError(400,'Inspect the generated PNG and verify its exact template and text first.');
 return churchCanvaRender(owner,{action:'complete',postId:row.id,renderId:c.renderId,claimToken:c.claimToken,designId:c.designId,exportUrl:c.exportUrl,sourceUrl:c.sourceUrl,contentVerified:true});
}
