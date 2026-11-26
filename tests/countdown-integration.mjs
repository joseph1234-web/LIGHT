import {build} from 'esbuild';
import {DatabaseSync} from 'node:sqlite';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {traceDatabase} from './sql-transcript.mjs';
const sourceSql=new DatabaseSync(':memory:');
for(const f of (await readdir('drizzle')).filter(x=>x.endsWith('.sql')).sort())sourceSql.exec(await readFile(join('drizzle',f),'utf8'));
const transcript=[],sql=process.env.EKKLO_SQL_TRANSCRIPT?traceDatabase(sourceSql,transcript):sourceSql;
function prepared(query,args=[]){return {bind(...values){return prepared(query,values)},async first(){return sql.prepare(query).get(...args)||null},async all(){return {results:sql.prepare(query).all(...args)}},async run(){return {meta:{changes:Number(sql.prepare(query).run(...args).changes)}}}};}
const objects=new Map();globalThis.__testEnv={DB:{prepare:q=>prepared(q),async batch(statements){sql.exec('BEGIN');try{const result=[];for(const s of statements)result.push(await s.run());sql.exec('COMMIT');return result;}catch(e){sql.exec('ROLLBACK');throw e;}}},BUCKET:{async put(key,value){objects.set(key,new Uint8Array(value));},async get(key){const value=objects.get(key);return value?{body:new Blob([value]).stream(),arrayBuffer:async()=>value.buffer.slice(value.byteOffset,value.byteOffset+value.byteLength),size:value.length}:null;},async delete(key){objects.delete(key);}}};
await mkdir('.sites-runtime/countdown-tests',{recursive:true});
await build({entryPoints:['app/api/[...path]/route.ts','lib/church/model.ts','lib/church/server.ts'],outdir:'.sites-runtime/countdown-tests',outbase:'.',bundle:true,platform:'node',format:'esm',logLevel:'silent',plugins:[{name:'env',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const env=globalThis.__testEnv;',loader:'js'}));}}]});
const model=await import('../.sites-runtime/countdown-tests/lib/church/model.js'),church=await import('../.sites-runtime/countdown-tests/lib/church/server.js'),route=await import('../.sites-runtime/countdown-tests/app/api/[...path]/route.js');
const config={...model.churchDefaults,canvaSetupVersion:1,imageTextVersion:model.CHURCH_IMAGE_TEXT_VERSION,captionVersionPolicy:1,canvaSources:{},christmasImageSource:'uploaded_pack',dailyEnabled:false,serviceEnabled:false,christmasStartDays:50};
assert.equal(model.makeChurchContent(config,'christmas','2026-12-25').title,'Christmas Day');
const after=model.makeChurchContent(config,'christmas','2026-12-26');assert.ok(after,'December 26 must prepare New Year content');assert.equal(after.title,'6 days until New Year');assert.equal(after.spec.occasion,'newyear');assert.equal(after.christmasImage,undefined);assert.match(after.caption,/NEW YEAR/);assert.doesNotMatch(after.caption,/Christmas/);
assert.equal(model.makeChurchContent(config,'christmas','2026-12-31').title,'1 day until New Year');assert.equal(model.makeChurchContent(config,'christmas','2027-01-01').title,'New Year’s Day');assert.equal(model.makeChurchContent(config,'christmas','2027-01-02'),null);
assert.equal(model.dateInZone(new Date('2026-12-25T15:59:59Z'),'Asia/Manila'),'2026-12-25');assert.equal(model.dateInZone(new Date('2026-12-25T16:00:00Z'),'Asia/Manila'),'2026-12-26');
console.log('PASS Christmas, Philippine midnight, New Year and year rollover');
for(const owner of ['alice','bob'])sql.prepare('INSERT INTO church_settings (owner,payload,updated) VALUES (?,?,?)').run(owner,JSON.stringify(config),new Date().toISOString());
async function call(path,owner='alice',body){const req=new Request('https://studio.test/api/church/'+path,{method:body?'POST':'GET',headers:{'oai-authenticated-user-id':owner,...(body?{Origin:'https://studio.test'}:{})},...(body?{body}:{})});const res=await route[body?'POST':'GET'](req);return {status:res.status,data:await res.json()};}
// A real static PNG with 32 × 32 pixels.
const {deflateSync}=await import('node:zlib');const {Buffer}=await import('node:buffer');
function crc(bytes){let c=0xffffffff;for(const x of bytes){c^=x;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
function chunk(type,data){const t=Buffer.from(type),out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);t.copy(out,4);data.copy(out,8);out.writeUInt32BE(crc(Buffer.concat([t,data])),data.length+8);return out;}
const header=Buffer.alloc(13);header.writeUInt32BE(32);header.writeUInt32BE(32,4);header[8]=8;header[9]=2;const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(Buffer.alloc(32*(32*3+1)))),chunk('IEND',Buffer.alloc(0))]);
function upload(date,revision='',bytes=png){const form=new FormData();form.set('date',date);form.set('expectedRevision',revision);form.set('png',new File([bytes],'countdown.png',{type:'image/png'}));return form;}
const year=Number(model.dateInZone(new Date(),'Asia/Manila').slice(0,4))+1,date=year+'-12-24';
let result=await call('countdown-images','alice',upload(date));assert.equal(result.status,200,JSON.stringify(result.data));assert.equal(result.data.saved,true);const first=result.data.image;
assert.equal((await call('countdown-images?year='+year,'bob')).data.images.length,0);
assert.equal((await call('countdown-images?year='+year,'alice')).data.images.length,1);
assert.equal((await call('countdown-images','alice',upload(date))).status,409,'stale upload cannot overwrite an image');
assert.equal((await call('countdown-images','bob',upload(date,first.revision))).status,409,'another account cannot use its revision');
assert.equal((await call('countdown-images','alice',upload(year+'-05-10'))).status,400);
assert.equal((await call('countdown-images','alice',upload(year+'-12-23','',new Uint8Array([1,2,3])))).status,400);
await church.prepareChurchPosts('alice',7,new Date(year+'-12-23T00:00:00+08:00'));
let post=sql.prepare("SELECT * FROM church_posts WHERE owner='alice' AND local_date=?").get(date);assert.ok(post);assert.ok(JSON.parse(post.payload).countdownImage);assert.equal(JSON.parse(post.payload).christmasImage,undefined);const id=post.id;
const replacement=await call('countdown-images','alice',upload(date,first.revision));assert.equal(replacement.status,200,JSON.stringify(replacement.data));post=sql.prepare('SELECT * FROM church_posts WHERE id=?').get(id);assert.equal(post.image_key,JSON.parse(post.payload).countdownImage.key);const pendingImage=post.image_key;
sql.prepare("UPDATE church_posts SET status='published',remote_id='confirmed-photo' WHERE id=?").run(id);
assert.equal((await call('countdown-images','alice',upload(date,replacement.data.image.revision))).status,200);post=sql.prepare('SELECT * FROM church_posts WHERE id=?').get(id);assert.equal(post.image_key,pendingImage,'published post keeps its approved image');assert.equal(post.status,'published');assert.equal(post.remote_id,'confirmed-photo');
assert.equal((await call('countdown-images','alice',upload(year+'-12-26'))).status,200);
assert.ok((await call('countdown-images?year='+(year+1),'alice')).data.images.some(x=>x.date===year+'-12-26'),'New Year images use their celebration year');
console.log('PASS persistent uploads, replacement, invalid files, account isolation and published history');

if(process.env.EKKLO_SQL_TRANSCRIPT)await writeFile(process.env.EKKLO_SQL_TRANSCRIPT,JSON.stringify(transcript));
