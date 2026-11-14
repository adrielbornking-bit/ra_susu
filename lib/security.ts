import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import {db} from './db';
export const hashToken=(s:string)=>createHash('sha256').update(s).digest('hex');
export const newCode=(prefix:string)=>prefix+'-'+randomBytes(10).toString('hex').toUpperCase();
export function secretEqual(a:string,b:string){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
export async function rateLimit(key:string,max=10,minutes=15){
 const now=new Date();const row=await db.rateLimit.upsert({where:{key:hashToken(key)},create:{key:hashToken(key),count:1,expiresAt:new Date(+now+minutes*60000)},update:{count:{increment:1}}});
 if(row.expiresAt<now){await db.rateLimit.update({where:{key:row.key},data:{count:1,expiresAt:new Date(+now+minutes*60000)}});return;}
 if(row.count>max)throw new Error('Too many attempts. Please try again later.');
}
