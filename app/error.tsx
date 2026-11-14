"use client";
import Link from 'next/link';export default function ErrorPage({reset}:{reset:()=>void}){return <main className="error-page"><h1>Something needs attention.</h1><p>We couldn’t complete that request. Please retry or contact your admin.</p><button className="btn btn-primary" onClick={reset}>Try again</button><Link href="/" className="btn btn-outline">Back home</Link></main>}
