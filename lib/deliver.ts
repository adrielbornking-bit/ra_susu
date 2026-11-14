import nodemailer from 'nodemailer';
import {createHash} from 'node:crypto';
type Job={channel:string;message:string;dedupeKey:string;user:{email:string|null;phone:string}};
export async function deliver(job:Job){
 if(job.channel==='email'&&process.env.SMTP_HOST){
 if(!job.user.email)return 'SKIPPED';
 const transport=nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||587),secure:process.env.SMTP_PORT==='465',requireTLS:true,disableFileAccess:true,disableUrlAccess:true,auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD},connectionTimeout:10000,socketTimeout:15000});
 await transport.sendMail({from:process.env.EMAIL_FROM,to:job.user.email,subject:'R&A SUSU LTD notification',text:job.message,messageId:'<'+createHash('sha256').update(job.dedupeKey).digest('hex')+'@ransusu.com>'});return 'SENT';
 }
 const url=process.env.NOTIFICATION_WEBHOOK_URL;if(!url)return 'UNCONFIGURED';if(!url.startsWith('https://'))throw new Error('Delivery adapter requires HTTPS');if(job.channel==='email'&&!job.user.email)return 'SKIPPED';
 const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+(process.env.NOTIFICATION_WEBHOOK_SECRET||''),'Idempotency-Key':job.dedupeKey},body:JSON.stringify({channel:job.channel,to:job.channel==='email'?job.user.email:job.user.phone,message:job.message}),signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Error('Delivery rejected');return 'SENT';
}
