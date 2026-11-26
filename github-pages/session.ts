import type {StandaloneConfig} from '../lib/public-paths';
export type Session={access_token:string;refresh_token:string;expires_at:number;user?:{id:string;email?:string}};
class AccountError extends Error {
 constructor(message:string,readonly status:number,readonly code:string){super(message);}
}
const endedSessionCodes=new Set(['refresh_token_not_found','refresh_token_already_used','session_not_found','session_expired','user_banned']);
export class AccountSession {
 readonly storageKey:string;
 private refreshing:Promise<Session|null>|null=null;
 constructor(readonly config:StandaloneConfig,readonly storage:Storage=localStorage,readonly request:typeof fetch=globalThis.fetch.bind(globalThis)){this.storageKey='ekklo:session:'+new URL(config.supabaseUrl).hostname;}
 read():Session|null{try{const s=JSON.parse(this.storage.getItem(this.storageKey)||'null');return s&&typeof s.access_token==='string'&&typeof s.refresh_token==='string'&&Number.isFinite(s.expires_at)?s:null;}catch{return null;}}
 save(data:any):Session|null{
  if(typeof data?.access_token!=='string'||typeof data?.refresh_token!=='string')return null;
  const session:Session={access_token:data.access_token,refresh_token:data.refresh_token,expires_at:Number(data.expires_at)||Math.floor(Date.now()/1000)+Number(data.expires_in||3600),user:data.user};
  this.storage.setItem(this.storageKey,JSON.stringify(session));return session;
 }
 async call(path:string,body:any,method='POST',token?:string){
  const headers:Record<string,string>={apikey:this.config.publishableKey,'Content-Type':'application/json'};if(token)headers.Authorization='Bearer '+token;
  const response=await this.request(this.config.supabaseUrl+'/auth/v1/'+path,{method,headers,body:JSON.stringify(body),credentials:'omit'});
  let data:any;try{data=await response.json();}catch{throw new Error('Account sign-in is temporarily unavailable. Please try again.');}
  if(!response.ok)throw new AccountError(data.msg||data.error_description||data.message||'Your account could not be verified.',response.status,data.code||data.error_code||'');return data;
 }
 async signIn(email:string,password:string){return this.save(await this.call('token?grant_type=password',{email,password}));}
 async signUp(email:string,password:string){const data=await this.call('signup?redirect_to='+encodeURIComponent(this.config.appUrl),{email,password});return this.save(data);}
 async recover(email:string){await this.call('recover?redirect_to='+encodeURIComponent(this.config.appUrl),{email});}
 async changePassword(password:string){const session=await this.current();if(!session)throw new Error('Open your password reset link again.');await this.call('user',{password},'PUT',session.access_token);}
 async current():Promise<Session|null>{
  const existing=this.read();if(!existing)return null;if(existing.expires_at>Date.now()/1000+90)return existing;
  if(this.refreshing)return this.refreshing;
  this.refreshing=(async()=>{
   const refresh=async()=>{
    const latest=this.read();if(!latest)return null;if(latest.expires_at>Date.now()/1000+90)return latest;
    try{
     const data=await this.call('token?grant_type=refresh_token',{refresh_token:latest.refresh_token});
     const current=this.read();
     // A response from an older tab/account must never undo sign-out or a new login.
     if(!current||current.refresh_token!==latest.refresh_token||current.access_token!==latest.access_token)return current;
     if(!data?.access_token||!data?.refresh_token)throw new Error('Your session could not be renewed. Please try again.');
     return this.save(data);
    }catch(error){
     const current=this.read();
     if(!current||current.refresh_token!==latest.refresh_token||current.access_token!==latest.access_token)return current;
     if(error instanceof AccountError&&[400,401,403].includes(error.status)&&endedSessionCodes.has(error.code)){this.storage.removeItem(this.storageKey);return null;}
     // Offline status is only a hint. Network errors, rate limits, and server
     // failures must keep the refresh token so returning tabs can recover.
     throw error;
    }
   };
   return typeof navigator!=='undefined'&&navigator.locks? navigator.locks.request(this.storageKey,refresh):refresh();
  })();try{return await this.refreshing;}finally{this.refreshing=null;}
 }
 async signOut(){const current=this.read();this.storage.removeItem(this.storageKey);if(current)try{await this.call('logout',{},'POST',current.access_token);}catch{/* Local sign-out is complete even if the connection is offline. */}}
}
