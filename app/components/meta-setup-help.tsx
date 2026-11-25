import {facebookPermissions,instagramDirectPublishPermissions} from '../../lib/meta-permissions';

export default function MetaSetupHelp({target='facebook',direct=false,expanded=false}:{target?:string;direct?:boolean;expanded?:boolean}){
 const permissions=direct?instagramDirectPublishPermissions:facebookPermissions(target);
 return <details className="meta-permission-help" open={expanded||undefined}>
 <summary>Fix Meta’s “Invalid Scopes” error</summary>
 <p>Meta is rejecting the permissions for the developer app being used. Saving an App ID and secret does not enable publishing permissions in Meta.</p>
 <ol><li>Open your app in <a href="https://developers.facebook.com/apps/" target="_blank" rel="noopener noreferrer">Meta for Developers</a>. In its use cases or products, configure {direct?'Instagram API with Instagram Login':target==='instagram'?'Instagram API with Facebook Login and Page access':'Facebook Page management and content publishing'}. Use the app setup for that login product. Basic Facebook sign-in alone does not enable publishing.</li>
 <li>In the matching use case’s permissions or App Review → Permissions and Features, enable the permissions listed below for testing. If they are unavailable, that app’s current use case or login product does not support this flow.</li>
 <li>{direct?'While testing, give the test account the required app role and access to the Instagram professional account.':'While testing, use a Facebook account with an accepted app role (admin, developer, or tester) and access to the Page.'} For other users, complete Meta’s required reviews and verification.</li>
 {!direct&&<li>If your app uses Facebook Login for Business, open its Configurations and create a configuration for a <strong>user access token</strong>, the Pages you manage, and these permissions. Copy its Configuration ID into ekklo.’s Facebook Connection setup. The configuration controls Meta’s permission screen; ekklo. still checks what was granted.</li>}
 </ol>
 <p><strong>Required for this connection</strong></p><ul className="meta-permission-list">{permissions.map(p=><li key={p}><code>{p}</code></li>)}</ul>
 <p>{direct?'These instagram_business_* permissions belong to direct Instagram Login. Do not replace them with the Facebook Login permission names.':target==='instagram'?'Your Instagram account must be professional and linked to the selected Page. Configure those Instagram permissions only for this linked-account flow.':'Connect Facebook first. Instagram permissions are requested separately when you connect Instagram.'}</p>
 <p>Then save the setup and start a new connection from ekklo.. Reopening the old failed login URL will use the old request.</p>
 </details>
}
