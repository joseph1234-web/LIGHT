import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {translateSql} from '../backend/postgres-d1.mjs';
const pg=new PGlite();
await pg.exec('CREATE ROLE anon; CREATE ROLE authenticated;');
for(const f of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort())await pg.exec(await readFile('supabase/migrations/'+f,'utf8'));
const transcript=JSON.parse(await readFile('.sites-runtime/sql-transcript.json','utf8'));
const canonical=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);
const encodedJson=new Map();
function normalize(value){
 if(typeof value==='bigint')return Number(value);
 if(typeof value==='string'&&/^[\[{]/.test(value)){try{return JSON.parse(canonical(JSON.parse(value)))}catch{}}
 if(Array.isArray(value))return value.map(normalize);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,normalize(item)]));
 return value;
}
function remember(actual,expected){
 if(typeof expected==='string'&&typeof actual==='string'&&/^[\[{]/.test(expected)){try{if(canonical(JSON.parse(actual))===canonical(JSON.parse(expected)))encodedJson.set(canonical(JSON.parse(expected)),actual);}catch{}}
 else if(Array.isArray(expected)&&Array.isArray(actual))for(let n=0;n<expected.length;n++)remember(actual[n],expected[n]);
 else if(expected&&actual&&typeof expected==='object'&&typeof actual==='object')for(const key of Object.keys(expected))remember(actual[key],expected[key]);
}
function rebound(value){if(typeof value!=='string'||!/^[\[{]/.test(value))return value;try{return encodedJson.get(canonical(JSON.parse(value)))??value;}catch{return value;}}
let checked=0;
for(const item of transcript){
 const args=(item.args||[]).map(rebound);
 let result,error;
 try{
  if(item.method==='exec'){await pg.exec(item.query);checked++;continue;}
  const translated=translateSql(item.query,args);
  result=await pg.query(translated.sql,translated.values);
 }catch(e){error=e;}
 if(item.error){assert.ok(error,`Expected constraint failure: ${item.query}`);checked++;continue;}
 if(error){console.error('QUERY',item.query,'ARGS',JSON.stringify(args));throw error;}
 let actual=item.method==='get'?result.rows[0]:item.method==='all'?result.rows:{changes:result.affectedRows};
 const expected=item.method==='run'?{changes:item.result.changes}:item.alternatives?.find(candidate=>canonical(normalize(candidate))===canonical(normalize(actual)))??item.result;
 remember(actual,expected);
 actual=normalize(actual);
 let normalizedExpected=normalize(expected);
 if(item.method==='all'){
  const order=/\bORDER BY\s+([A-Za-z_]+)(?:\s+(?:ASC|DESC))?/i.exec(item.query)?.[1];
  if(order&&actual.every(row=>order in row)&&normalizedExpected.every(row=>order in row))assert.deepEqual(actual.map(row=>row[order]),normalizedExpected.map(row=>row[order]),'Declared ordering is preserved. Equal sort keys may use either physical row order.');
  actual.sort((a,b)=>canonical(a).localeCompare(canonical(b)));normalizedExpected.sort((a,b)=>canonical(a).localeCompare(canonical(b)));
 }
 try{assert.deepEqual(actual,normalizedExpected);}catch(e){console.error('MISMATCH',item.query,'ARGS',JSON.stringify(args));throw e;}
 checked++;
}
await pg.close();
console.log(`${checked} database operations matched the independent SQLite integration transcript.`);
