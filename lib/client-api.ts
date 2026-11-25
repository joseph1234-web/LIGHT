export class StudioApiError extends Error{
 constructor(message:string,public reauthenticate=false,public status=0){super(message);this.name='StudioApiError';}
}

/** Decode API responses without exposing HTML or replaying an uncertain action. */
export async function readStudioJson(response:Response):Promise<any>{
 const type=(response.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
 const isJson=type==='application/json'||/^application\/[a-z0-9.+-]+\+json$/.test(type);
 if(response.status===401){await response.body?.cancel();throw new StudioApiError('Your ekklo. sign-in needs to be renewed. Sign in again, then check the current status before repeating an action.',true,401);}
 if(!isJson){
  await response.body?.cancel();
  if(response.status>=500)throw new StudioApiError('ekklo. is temporarily unavailable. Refresh its status before repeating the action.',false,response.status);
  throw new StudioApiError('ekklo. returned a webpage instead of data. Open the site in its own tab and sign in again. Check the current status before repeating an action.',true,response.status);
 }
 let data:any;try{data=await response.json()}catch{throw new StudioApiError('ekklo. returned an incomplete response. Refresh its status before repeating the action.',false,response.status);}
 if(!response.ok)throw new StudioApiError(typeof data?.error==='string'?data.error.slice(0,500):'The request could not be completed. Check the current status before trying again.',false,response.status);
 if(!data||typeof data!=='object'||Array.isArray(data))throw new StudioApiError('ekklo. returned an unexpected response. Refresh its status before repeating the action.',false,response.status);
 return data;
}
