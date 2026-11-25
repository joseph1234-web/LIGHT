/* Authenticated API/media transport for the GitHub Pages client. Never caches
 * private data. Only the access token is retained; refresh stays with the page.
 */
const scope=new URL(self.registration.scope), databaseName='ekklo-transport:'+scope.pathname;
let configuration;
async function config(){return configuration||(configuration=fetch(new URL('ekklo-config.json',scope),{cache:'no-store'}).then(async r=>{if(!r.ok)throw new Error('Configuration unavailable.');const c=await r.json();if(!/^https:\/\/[a-z0-9]+\.supabase\.co\/functions\/v1\/ekklo-api\/api$/.test(c.apiBase))throw new Error('Invalid API address.');return c;}));}
function storeAccess(value){return new Promise((resolve,reject)=>{const open=indexedDB.open(databaseName,1);open.onupgradeneeded=()=>open.result.createObjectStore('access');open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,tx=db.transaction('access',value===undefined?'readonly':'readwrite'),store=tx.objectStore('access');const request=value===undefined?store.get('current'):store.put(value,'current');request.onerror=()=>reject(request.error);tx.oncomplete=()=>{const result=request.result;db.close();resolve(result);};tx.onerror=()=>{db.close();reject(tx.error);};};});}
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('message',event=>{if(event.data?.type!=='EKKLO_ACCESS')return;event.waitUntil((async()=>{const client=event.source?.id?await self.clients.get(event.source.id):null;if(!client)return;const url=new URL(client.url);if(url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;const token=event.data.access;if(token!==null&&(!token||typeof token.token!=='string'||token.token.length>15000||!Number.isFinite(token.expiresAt)))return;await storeAccess(token);event.ports[0]?.postMessage({ok:true});})());});
async function api(request,url){
 const c=await config(),access=await storeAccess();
 if(!access||access.expiresAt*1000<=Date.now())return Response.json({error:'Sign in to ekklo. again to continue.'},{status:401});
 const headers=new Headers(request.headers);for(const name of [...headers.keys()])if(name.toLowerCase().startsWith('oai-')||['cookie','authorization','apikey'].includes(name.toLowerCase()))headers.delete(name);
 headers.set('Authorization','Bearer '+access.token);headers.set('apikey',c.publishableKey);if(request.mode==='navigate')headers.set('X-Ekklo-Navigation','1');
 const pathname=url.pathname.startsWith(scope.pathname+'api/')?url.pathname.slice(scope.pathname.length+4):url.pathname.slice(5);
 try{const response=await fetch(c.apiBase+'/'+pathname+url.search,{method:request.method,headers,body:['GET','HEAD'].includes(request.method)?undefined:await request.arrayBuffer(),credentials:'omit',redirect:'follow',cache:'no-store'});if(request.mode==='navigate'&&(response.headers.get('content-type')||'').includes('application/json')){const data=await response.clone().json();if(data.navigateTo){const target=new URL(data.navigateTo);if(target.protocol!=='https:')throw new Error('Invalid navigation.');return Response.redirect(target.toString(),302);}}return response;}
 catch{return Response.json({error:'ekklo. could not reach the server. Check your connection before trying again.'},{status:503});}
}
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(url.origin!==scope.origin)return;
 if(url.pathname.startsWith('/api/')||url.pathname.startsWith(scope.pathname+'api/')){event.respondWith(api(event.request,url));return;}
 if(event.request.mode!=='navigate'&&!url.pathname.startsWith(scope.pathname)&&!url.pathname.startsWith('/api/'))event.respondWith(fetch(new URL(scope.pathname+url.pathname.slice(1)+url.search,url.origin),{credentials:'omit'}));
});
