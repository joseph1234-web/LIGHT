import {db,one,uid,now,HttpError} from '../server';

type Source={sourceUrl:string;designId:string;pageCount:number;sourceUpdated:number;accountId:string};
/** Reserve once inside a D1 transaction; a refresh cannot consume another page. */
export async function reserveCanvaPage(owner:string,row:any,source:Source){
 const c=JSON.parse(row.payload).canva;
 if(row.owner!==owner||!['draft','scheduled','waiting_connection','paused'].includes(row.status)||row.claimed||row.remote_id||Date.parse(row.scheduled)<Date.now()-75*60000||!c?.claimToken||c.state!=='rendering'||c.sourceUrl!==source.sourceUrl||!Number.isInteger(source.pageCount)||source.pageCount<1)throw new HttpError(409,'Use the current claimed render and checked Canva source.');
 if(c.page!==undefined){if(c.pageMode!=='rotate'||c.sourceDesignId!==source.designId||!Number.isInteger(c.page)||c.page<1||c.page>source.pageCount)throw new HttpError(409,'This render already has a different page assignment. Review its saved job.');return c.page as number;}
 const reservation=uid(),updated=now(),eventId=row.event_id||'',key=[owner,row.series,eventId,source.sourceUrl];
 const statements=[
  db().prepare(`INSERT INTO canva_page_rotations (owner,series,event_id,source_url,design_id,page_count,next_page,updated) VALUES (?,?,?,?,?,?,1,?) ON CONFLICT(owner,series,event_id,source_url) DO UPDATE SET next_page=CASE WHEN canva_page_rotations.design_id<>excluded.design_id OR canva_page_rotations.next_page>excluded.page_count THEN 1 ELSE canva_page_rotations.next_page END,design_id=excluded.design_id,page_count=excluded.page_count,updated=excluded.updated`).bind(...key,source.designId,source.pageCount,updated),
  db().prepare(`UPDATE church_posts SET payload=json_set(payload,'$.canva.page',(SELECT next_page FROM canva_page_rotations WHERE owner=? AND series=? AND event_id=? AND source_url=?),'$.canva.pageMode','rotate','$.canva.pageReservation',?,'$.canva.sourceDesignId',?,'$.canva.pageCount',?,'$.canva.sourceUpdated',?,'$.canva.canvaAccountId',?,'$.canva.method','direct_api','$.canva.phase','page_assigned'),updated=? WHERE owner=? AND id=? AND json_extract(payload,'$.canva.renderId')=? AND json_extract(payload,'$.canva.claimToken')=? AND json_extract(payload,'$.canva.state')='rendering' AND json_extract(payload,'$.canva.page') IS NULL AND image_key IS NULL AND remote_id IS NULL AND claimed IS NULL AND scheduled>=? AND status IN ('draft','scheduled','waiting_connection','paused')`).bind(...key,reservation,source.designId,source.pageCount,source.sourceUpdated,source.accountId,updated,owner,row.id,c.renderId,c.claimToken,new Date(Date.now()-75*60000).toISOString()),
  db().prepare(`UPDATE canva_page_rotations SET next_page=CASE WHEN next_page>=page_count THEN 1 ELSE next_page+1 END,updated=? WHERE owner=? AND series=? AND event_id=? AND source_url=? AND EXISTS(SELECT 1 FROM church_posts WHERE owner=? AND id=? AND json_extract(payload,'$.canva.renderId')=? AND json_extract(payload,'$.canva.claimToken')=? AND json_extract(payload,'$.canva.pageReservation')=?)`).bind(updated,...key,owner,row.id,c.renderId,c.claimToken,reservation)
 ];
 await db().batch(statements);
 const fresh=await one('SELECT payload FROM church_posts WHERE owner=? AND id=?',owner,row.id),saved=fresh?JSON.parse(fresh.payload).canva:null;
 if(!saved||saved.renderId!==c.renderId||saved.claimToken!==c.claimToken||saved.sourceDesignId!==source.designId||saved.pageMode!=='rotate'||!Number.isInteger(saved.page)||saved.page<1||saved.page>source.pageCount)throw new HttpError(409,'The post changed before its Canva page could be assigned.');
 return saved.page as number;
}
