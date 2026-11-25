import {AsyncLocalStorage} from 'node:async_hooks';
const contexts=new AsyncLocalStorage<Record<string,any>>();
export const env=new Proxy({} as Record<string,any>,{get(_target,key:string){return contexts.getStore()?.[key];}});
export function withEnvironment<T>(context:Record<string,any>,run:()=>T){return contexts.run(context,run);}
