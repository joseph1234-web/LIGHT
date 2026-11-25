export type StandaloneConfig={appUrl:string;apiBase:string;supabaseUrl:string;publishableKey:string};
declare global {var __EKKLO_STANDALONE__:StandaloneConfig|undefined;}
export function workspacePath(search=''){
 const config=globalThis.__EKKLO_STANDALONE__;
 if(!config)return '/'+search;
 const url=new URL(config.appUrl);return url.pathname+search;
}
export function publicApiUrl(path:string){const base=globalThis.__EKKLO_STANDALONE__?.apiBase;return base?base.replace(/\/$/,'')+'/'+path.replace(/^\//,''):(typeof location!=='undefined'?location.origin:'')+'/api/'+path.replace(/^\//,'');}
