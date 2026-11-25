import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
await mkdir('dist/edge',{recursive:true});
await build({entryPoints:['backend/index.ts'],outfile:'dist/edge/index.ts',bundle:true,platform:'neutral',format:'esm',target:'es2022',logLevel:'info',external:['node:async_hooks'],plugins:[{name:'supabase-runtime',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:new URL('../backend/environment.ts',import.meta.url).pathname}));b.onResolve({filter:/^postgres$/},()=>({path:'npm:postgres@4.1.1',external:true}));}}]});
await writeFile('dist/edge/deno.json',JSON.stringify({compilerOptions:{lib:['deno.ns','deno.unstable','dom','esnext']}}));
