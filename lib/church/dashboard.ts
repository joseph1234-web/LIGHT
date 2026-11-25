import {E,one,rows} from '../server';
import {churchState} from './server';
import {runnerHealth} from './runner-health';

export async function churchDashboard(owner:string) {
 const data=await churchState(owner),config:any=data.config;
 const [canvaSettings,canvaAccount,activity]=await Promise.all([
  one('SELECT payload FROM canva_settings WHERE owner=?',owner),
  one('SELECT owner,refresh_claim FROM canva_accounts WHERE owner=?',owner),
  rows('SELECT id,message,kind,created FROM activity WHERE owner=? ORDER BY created DESC LIMIT 6',owner)
 ]);
 const canva=JSON.parse(canvaSettings?.payload||'{}');
 const configured=E().CHURCH_SCHEDULER_ENABLED==='true'&&!!config.backgroundIdentityEmail&&config.backgroundIdentityEmail.toLowerCase()===String(E().CHURCH_SCHEDULER_ACCOUNT_EMAIL||'').toLowerCase();
 const posts=data.posts.map(p=>({id:p.id,title:p.title,caption:p.caption,series:p.series,date:p.date,scheduled:p.scheduled,status:p.status,imageReady:p.imageReady,imageUrl:p.imageUrl,reference:p.reference,message:p.message,canvaError:p.canvaError,windowExpired:p.windowExpired}));
 const pending=posts.filter(p=>!['published','removed','cancelled','skipped','outdated'].includes(p.status)&&!p.windowExpired);
 const pageReady=!!data.connection&&data.connection.account_id===config.autoPageId&&data.setupReady;
 const usesCanva=['daily','service','christmas'].some(k=>config[k==='daily'?'dailyEnabled':k==='service'?'serviceEnabled':'christmasEnabled']&&config.canvaSources[k]);
 return {churchName:config.churchName,timezone:config.timezone,today:data.today,autoPublish:config.autoPublish,automaticPreparation:!config.manualQueue,
  background:runnerHealth(config.lastCloudRun,configured),connection:data.connection?{label:data.connection.label,ready:pageReady}:null,
  canva:{required:usesCanva,connected:!!canvaAccount&&!canvaAccount.refresh_claim,enabled:!!canva.enabled},
  metrics:{scheduled:pending.length,ready:pending.filter(p=>p.status==='scheduled'&&p.imageReady).length,needsAttention:pending.filter(p=>!p.imageReady||['needs_review','waiting_connection'].includes(p.status)).length,published:posts.filter(p=>p.status==='published').length},
  series:[{id:'daily',name:'Daily Bible verse',enabled:config.dailyEnabled,time:config.dailyTime,frequency:'Every day'},{id:'service',name:'Sunday invitation',enabled:config.serviceEnabled,time:config.saturdayTime,frequency:'Every Saturday'},{id:'christmas',name:'Christmas countdown',enabled:config.christmasEnabled,time:config.christmasTime,frequency:'During your countdown'}],
  posts,activity,
  requirements:[...(!config.autoPublish?[{code:'publishing',title:'Automatic publishing is paused',detail:'Enable church publishing in your planner when you are ready.',view:'church',tab:'planner'}]:[]),...(!pageReady?[{code:'facebook',title:'Check your Facebook Page',detail:'Connect and select the intended church Page before delivery.',view:'connections'}]:[]),...(config.manualQueue?[{code:'preparation',title:'Automatic queue filling is paused',detail:'Resume it to prepare the next seven days without opening the website.',view:'church',tab:'posts'}]:[]),...(usesCanva&&(!canvaAccount||canvaAccount.refresh_claim||!canva.enabled)?[{code:'canva',title:'Canva images need setup',detail:'Connect Canva and enable image generation, or attach finished PNGs. Saved template links alone cannot post.',view:'church',tab:'templates'}]:[])]};
}
