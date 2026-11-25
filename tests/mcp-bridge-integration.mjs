import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {Miniflare} from 'miniflare';

const target='https://fixture-project.supabase.co/functions/v1/ekklo-api/mcp';
const bridgeSecret='fixture-bridge-secret-for-local-tests-only';
const bundle=await build({stdin:{contents:"import {POST} from './app/mcp/route'; export default {async fetch(request){try{return await POST(request);}catch(error){return Response.json({error:error.message},{status:500});}}};",resolveDir:process.cwd(),loader:'ts'},write:false,bundle:true,platform:'neutral',format:'esm',target:'es2022',external:['node:*'],logLevel:'silent',plugins:[{name:'bridge-environment',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const env='+JSON.stringify({EKKLO_BACKEND_BRIDGE_URL:target,EKKLO_BACKEND_BRIDGE_SECRET:bridgeSecret})+';',loader:'js'}));}}]});
let calls=0,redirect=false;
const body={jsonrpc:'2.0',id:'local-bridge-check',method:'tools/call',params:{name:'studio_status',arguments:{}}};
const mf=new Miniflare({modules:true,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],script:bundle.outputFiles[0].text,outboundService:async request=>{
 calls++;
 assert.equal(request.url,target);
 assert.equal(request.method,'POST');
 assert.equal(request.headers.get('x-ekklo-bridge-secret'),bridgeSecret);
 assert.equal(request.headers.get('x-ekklo-owner'),'fixture-owner');
 assert.equal(request.headers.get('x-ekklo-email'),'church@example.test');
 assert.equal(request.headers.get('cookie'),null);
 assert.equal(request.headers.get('authorization'),null);
 assert.deepEqual(await request.json(),body);
 return redirect?new Response(null,{status:302,headers:{Location:'https://untrusted.example.test/'}}):Response.json({jsonrpc:'2.0',id:body.id,result:{content:[{type:'text',text:'verified'}]}});
}});
async function call(authenticated=true){return mf.dispatchFetch('https://site.example.test/mcp',{method:'POST',headers:{'Content-Type':'application/json',...(authenticated?{'oai-authenticated-user-id':'fixture-owner','oai-authenticated-user-email':'church@example.test'}:{}),cookie:'fixture-private-cookie',Authorization:'Bearer fixture-private-token'},body:JSON.stringify(body)});}
try {
 let response=await call();
 assert.equal(response.status,200,'The deployed Workers runtime must forward the authenticated tool request.');
 assert.equal((await response.json()).result.content[0].text,'verified');
 assert.equal(calls,1);
 redirect=true;
 response=await call();
 assert.equal(response.status,500);
 assert.match((await response.json()).error,/unexpected redirect/);
 assert.equal(calls,2,'A redirect must never replay the authenticated request or disclose the bridge secret.');
 response=await call(false);
 assert.equal(response.status,500);
 assert.equal(calls,2,'An unauthenticated caller must never reach the backend.');
 console.log('Workers MCP forwarding, identity preservation, private header isolation, and redirect rejection passed.');
} finally {await mf.dispose();}
