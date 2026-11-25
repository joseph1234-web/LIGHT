import type { Metadata } from 'next';
import './globals.css';
import './ekklo.css';
export const metadata: Metadata = {
 title:'ekklo. — One Church. Every Platform.',
 description:'Plan Bible verses, Sunday invitations, and church events. Create, schedule, and publish from one church workspace.',
 icons:{icon:'/ekklo-mark.png'}
};
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="en"><body>{children}</body></html>}
