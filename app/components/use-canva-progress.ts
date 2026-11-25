'use client';
import {useEffect,useRef,useState} from 'react';
import {readStudioJson} from '../../lib/client-api';

export function useCanvaProgress(onProgress:()=>Promise<unknown>){
 const callback=useRef(onProgress);callback.current=onProgress;
 const [progress,setProgress]=useState<{state:string;checkedAt?:string;error?:string}>({state:'checking'});
 useEffect(()=>{
  let stopped=false,inFlight=false,timer:ReturnType<typeof setTimeout>|undefined;
  async function tick(){
   if(stopped||inFlight)return;
   if(document.visibilityState!=='visible'){timer=setTimeout(tick,15000);return;}
   inFlight=true;let delay=15000;
   try{
     const result=await fetch('/api/canva/advance',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({publishReady:true})}).then(readStudioJson);
     if(!stopped){setProgress({state:result.state,checkedAt:result.checkedAt});await callback.current();}
   }catch(e){if(!stopped)setProgress({state:'error',error:e instanceof Error?e.message:'Could not check Canva progress.'});delay=45000;}
   finally{inFlight=false;if(!stopped)timer=setTimeout(tick,delay);}
  }
  function wake(){if(inFlight||stopped)return;if(timer)clearTimeout(timer);void tick();}
  window.addEventListener('focus',wake);document.addEventListener('visibilitychange',wake);
  void tick();return()=>{stopped=true;if(timer)clearTimeout(timer);window.removeEventListener('focus',wake);document.removeEventListener('visibilitychange',wake)};
 },[]);
 return progress;
}
