import {one,run,now,HttpError} from '../server';
/** A late response may add IDs to history; it cannot restart that render. */
export async function checkpointRetiredCanva(owner:string,id:string,renderId:string,claimToken:string,values:Record<string,unknown>){
 const row=await one('SELECT payload FROM church_posts WHERE owner=? AND id=?',owner,id);if(!row)return false;
 const payload=JSON.parse(row.payload),history=[{path:'$.retiredCanva',value:payload.retiredCanva},...(payload.retiredCanvaHistory||[]).map((value:any,i:number)=>({path:`$.retiredCanvaHistory[${i}]`,value}))];
 const found=history.find(h=>h.value?.renderId===renderId&&h.value?.claimToken===claimToken);if(!found||!claimToken)return false;
 const entries=Object.entries(values).filter(([k,v])=>['designId','autofillJobId','exportJobId','exportUrl','exportedAt'].includes(k)&&v!==undefined&&v!==null);
 if(!entries.length)return false;
 for(const [key,value] of entries){
  if(typeof value!=='string'||value.length>2000)throw new HttpError(400,'Use only confirmed Canva response values.');
  if(key==='designId'&&!/^[A-Za-z0-9_-]{5,120}$/.test(value))throw new HttpError(400,'Use the design ID confirmed by Canva.');
  if(key.endsWith('JobId')&&(!value||value.length>160))throw new HttpError(400,'Use the job ID confirmed by Canva.');
  if(key.endsWith('Id')&&(found.value[key]&&found.value[key]!==value||value===found.value.sourceDesignId))throw new HttpError(409,'Keep the existing confirmed Canva history IDs.');
 }
 const ids=entries.filter(([key])=>key.endsWith('Id'));
 const changed=await run(`UPDATE church_posts SET payload=json_set(payload,${entries.map(()=> '?,?').join(',')}),updated=? WHERE owner=? AND id=? AND json_extract(payload,?)=? AND json_extract(payload,?)=?${ids.map(()=> ' AND (json_extract(payload,?) IS NULL OR json_extract(payload,?)=?)').join('')}`,...entries.flatMap(([key,value])=>[found.path+'.'+key,value]),now(),owner,id,found.path+'.renderId',renderId,found.path+'.claimToken',claimToken,...ids.flatMap(([key,value])=>[found.path+'.'+key,found.path+'.'+key,value]));
 return !!changed.meta.changes;
}
