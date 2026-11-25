// Keep the permission families separate: Facebook Page publishing, Page-linked
// Instagram, and direct Instagram Login are different authorizations.
export const facebookPublishPermissions=['pages_show_list','pages_read_engagement','pages_manage_posts'];
export const instagramFacebookPublishPermissions=['pages_show_list','pages_read_engagement','instagram_basic','instagram_content_publish'];
export const instagramDirectPublishPermissions=['instagram_business_basic','instagram_business_content_publish'];
export function facebookPermissions(target:string){return target==='instagram'?instagramFacebookPublishPermissions:facebookPublishPermissions;}
export function hasPermissions(granted:unknown,required:string[]){return Array.isArray(granted)&&required.every(p=>granted.includes(p));}
