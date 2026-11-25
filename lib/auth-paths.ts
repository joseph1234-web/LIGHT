const signInPath='/signin-with-chatgpt';
const signOutPath='/signout-with-chatgpt';

function safeRelativeReturnPath(value:string):string{
 if(!value.startsWith('/')||value.startsWith('//'))return '/';
 let url:URL;try{url=new URL(value,'https://app.local')}catch{return '/';}
 if(url.origin!=='https://app.local'||[signInPath,signOutPath,'/callback'].includes(url.pathname))return '/';
 return `${url.pathname}${url.search}${url.hash}`;
}
export function chatGPTSignInPath(returnTo:string){return `${signInPath}?return_to=${encodeURIComponent(safeRelativeReturnPath(returnTo))}`;}
export function chatGPTSignOutPath(returnTo='/'){return `${signOutPath}?return_to=${encodeURIComponent(safeRelativeReturnPath(returnTo))}`;}
