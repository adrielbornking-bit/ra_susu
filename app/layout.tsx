import type {Metadata} from 'next';import './globals.css';import {Providers} from '@/components/providers';
export const metadata:Metadata={title:{default:'R&A SUSU LTD — Grow together',template:'%s | R&A SUSU LTD'},description:'A clearer way to manage your daily Susu contributions. Ghanaian community savings, transparent records and mobile money.'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en" suppressHydrationWarning><body><Providers>{children}</Providers></body></html>}
