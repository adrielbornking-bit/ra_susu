import {deliver} from '@/lib/deliver';
import {db} from '@/lib/db';
import {day} from '@/lib/rules';
import {notify} from '@/lib/notify';
import {secretEqual} from '@/lib/security';
export async function POST(req:Request){
 const expected=process.env.CRON_SECRET;if(!expected||!secretEqual(req.headers.get('authorization')||'','Bearer '+expected))return new Response('Unauthorized',{status:401});
 const now=new Date(),minute=now.getUTCHours()*60+now.getUTCMinutes();const date=day(now);let count=0;
 if(await db.setting.findUnique({where:{key:'remindersEnabled'}}).then(s=>s?.value!=='false')){
 for(const time of [1080,1110,1130].filter(t=>minute>=t&&minute<t+10)){
 const members=await db.user.findMany({where:{status:'APPROVED',role:'PARTICIPANT',slots:{some:{active:true}}},include:{slots:{where:{active:true}},payments:{where:{contributionDate:date,status:'PAID'}}}});
 for(const u of members){const remaining=u.slots.length*2200-u.payments.reduce((a,p)=>a+p.amount,0);if(remaining<=0)continue;const key=`reminder:${u.id}:${date.toISOString()}:${time}`;try{await db.$transaction(tx=>notify(tx,u.id,`Your GH₵${(remaining/100).toFixed(2)} contribution is due before 7 PM.`,key));count++;}catch(e){if((e as {code?:string}).code!=='P2002')throw e;}}
 }}
 // Claim each delivery atomically. The adapter MUST deduplicate using Idempotency-Key.
 if(process.env.NOTIFICATION_WEBHOOK_URL||process.env.SMTP_HOST){
 await db.delivery.updateMany({where:{status:'SENDING',lockedAt:{lt:new Date(Date.now()-300000)}},data:{status:'QUEUED'}});
 const jobs=await db.delivery.findMany({where:{status:'QUEUED',attempts:{lt:5}},include:{user:{select:{phone:true,email:true}}},take:10});
 for(const job of jobs){
 if(job.channel!=='email'&&!process.env.NOTIFICATION_WEBHOOK_URL)continue;
 const claim=await db.delivery.updateMany({where:{id:job.id,status:'QUEUED'},data:{status:'SENDING',lockedAt:new Date(),attempts:{increment:1}}});if(!claim.count)continue;
 try{const status=await deliver(job);await db.delivery.update({where:{id:job.id},data:{status:status==='UNCONFIGURED'?'QUEUED':status,lockedAt:null}});}catch{await db.delivery.update({where:{id:job.id},data:{status:job.attempts>=4?'FAILED':'QUEUED',lockedAt:null}});}
 }}
 await db.rateLimit.deleteMany({where:{expiresAt:{lt:new Date(Date.now()-86400000)}}});return Response.json({remindersCreated:count});
}
