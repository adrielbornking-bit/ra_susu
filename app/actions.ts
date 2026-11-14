"use server";
import {db} from '@/lib/db';
import {requireUser} from '@/lib/access';
import {registrationSchema,paymentSchema,passwordSchema,phoneSchema,day,normalizeCode} from '@/lib/rules';
import {hash,compare} from 'bcryptjs';
import {hashToken,newCode,rateLimit} from '@/lib/security';
import {notify} from '@/lib/notify';
import {signIn,signOut} from '@/auth';
import {AuthError} from 'next-auth';
import {revalidatePath} from 'next/cache';
import {headers} from 'next/headers';
import {z} from 'zod';
import {Prisma} from '@prisma/client';
export type ActionState={ok:boolean;message:string;secret?:string};
const id=z.string().cuid();
const text=(f:FormData,k:string)=>String(f.get(k)||'').trim();
async function publicLimit(scope:string,f:FormData){const h=await headers();await rateLimit(scope+':'+(h.get('x-forwarded-for')?.split(',').at(-1)?.trim()||'unknown'),30);await rateLimit(scope+':'+text(f,'phone'),5);}
export async function login(_:ActionState,f:FormData):Promise<ActionState>{try{await signIn('credentials',{phone:text(f,'phone'),password:String(f.get('password')||''),token:text(f,'token'),redirectTo:'/dashboard'});}catch(e){if(e instanceof AuthError)return {ok:false,message:'Unable to sign in. Check your phone and password. First login also needs approval and your latest verification token. Imported members must set a password using Forgot password.'};throw e;}return {ok:true,message:''};}
export async function logout(){await signOut({redirectTo:'/'});}
export async function register(_:ActionState,f:FormData):Promise<ActionState>{try{
 await publicLimit('register',f);const v=registrationSchema.parse(Object.fromEntries(f));
 await db.$transaction(async tx=>{const u=await tx.user.create({data:{name:v.name,phone:v.phone,passwordHash:await hash(v.password,12),location:v.location,nextOfKin:v.nextOfKin,nextOfKinPhone:v.nextOfKinPhone}});const admins=await tx.user.findMany({where:{role:'SUPER_ADMIN'}});for(const a of admins)await notify(tx,a.id,'New participant registration pending approval.');await notify(tx,u.id,'Your registration is awaiting admin approval.');});
 return {ok:true,message:'Registration received. Contact your admin for approval and a verification token.'};
 }catch(e){if(e instanceof Prisma.PrismaClientKnownRequestError&&e.code==='P2002')return {ok:false,message:'This mobile number already has an account. Use Forgot password and ask your admin for a reset code. Registering again does not change an existing password.'};return failure(e,'Unable to register. Please try again.');}}
export async function requestReset(_:ActionState,f:FormData):Promise<ActionState>{try{await publicLimit('reset-request',f);const phone=phoneSchema.parse(text(f,'phone'));const u=await db.user.findUnique({where:{phone}});if(u)await db.$transaction(async tx=>{const pending=await tx.passwordReset.findFirst({where:{userId:u.id,usedAt:null,createdAt:{gt:new Date(Date.now()-3600000)}}});if(!pending){await tx.passwordReset.create({data:{userId:u.id}});for(const a of await tx.user.findMany({where:{role:'SUPER_ADMIN'}}))await notify(tx,a.id,'A participant requested a password reset. Review Password requests.');}});return {ok:true,message:'If an account exists, your admin has been notified. Contact them for a reset code.'};}catch(e){return failure(e);}}
export async function resetPassword(_:ActionState,f:FormData):Promise<ActionState>{try{await publicLimit('reset',f);const phone=phoneSchema.parse(text(f,'phone'));const pw=passwordSchema.parse(f.get('password'));if(pw!==f.get('confirmPassword'))throw new Error('Passwords do not match');const code=hashToken(normalizeCode(text(f,'code')));const passwordHash=await hash(pw,12);
 await db.$transaction(async tx=>{const r=await tx.passwordReset.findFirst({where:{codeHash:code,usedAt:null,expiresAt:{gt:new Date()},user:{phone}}});if(!r)throw new Error('Invalid or expired reset code');const consumed=await tx.passwordReset.updateMany({where:{id:r.id,usedAt:null},data:{usedAt:new Date()}});if(consumed.count!==1)throw new Error('Reset code already used');await tx.user.update({where:{id:r.userId},data:{passwordHash,mustChangePassword:false,sessionVersion:{increment:1}}});await tx.passwordReset.updateMany({where:{userId:r.userId,usedAt:null},data:{usedAt:new Date()}});});return {ok:true,message:'Password updated. Sign in with your phone and new password. Include your token only if your account has not been activated.'};}catch(e){return failure(e);}}
export async function mutate(_:ActionState,f:FormData):Promise<ActionState>{
 const u=await requireUser();const action=text(f,'action');if(u.mustChangePassword&&!['changePassword','profile'].includes(action))return {ok:false,message:'Change your temporary password first in Account settings.'};
 try{let secret:string|undefined;
 if(action==='payment'){
 const v=paymentSchema.parse(Object.fromEntries(f));const amount=Math.round(v.amount*100);const date=day();
 await db.$transaction(async tx=>{await tx.$executeRaw`SELECT id FROM "User" WHERE id=${u.id} FOR UPDATE`;const slots=await tx.slot.count({where:{userId:u.id,active:true}});if(!slots)throw new Error('Ask your admin to assign a slot first.');const sums=await tx.payment.aggregate({where:{userId:u.id,contributionDate:date,status:{in:['PAID','PENDING']}},_sum:{amount:true}});if((sums._sum.amount||0)+amount>11000)throw new Error('Daily contributions cannot exceed GH₵110, including pending payments.');await tx.payment.create({data:{userId:u.id,amount,network:v.network,reference:v.reference,transactionId:v.transactionId.toUpperCase(),contributionDate:date}});for(const a of await tx.user.findMany({where:{role:'SUPER_ADMIN'}}))await notify(tx,a.id,'New payment awaiting verification.');});
 }else if(action==='read'){await db.notification.updateMany({where:{userId:u.id,read:false},data:{read:true}});
 }else if(action==='profile'){
 const location=z.string().min(2).max(150).parse(text(f,'location'));const nextOfKin=z.string().min(2).max(100).parse(text(f,'nextOfKin'));const nextOfKinPhone=phoneSchema.parse(text(f,'nextOfKinPhone'));const email=text(f,'email')?z.string().email().parse(text(f,'email')):null;
 await db.user.update({where:{id:u.id},data:{location,nextOfKin,nextOfKinPhone,email}});
 }else if(action==='changePassword'){
 if(!await compare(String(f.get('currentPassword')||''),u.passwordHash))throw new Error('Current password is incorrect');const pw=passwordSchema.parse(f.get('password'));if(pw!==f.get('confirmPassword'))throw new Error('Passwords do not match');await db.user.update({where:{id:u.id},data:{passwordHash:await hash(pw,12),mustChangePassword:false,sessionVersion:{increment:1}}});return {ok:true,message:'Password changed. Please sign out and sign in again.'};
 }else{
 if(u.role!=='SUPER_ADMIN')throw new Error('Administrator access required');const target=text(f,'id');
 await db.$transaction(async tx=>{
 if(['approve','reject'].includes(action)){id.parse(target);const member=await tx.user.findUniqueOrThrow({where:{id:target}});if(member.role==='SUPER_ADMIN')throw new Error('Cannot modify the super admin');if(action==='approve'&&(!member.location||!member.nextOfKin||!member.nextOfKinPhone))throw new Error('Complete participant details before approval.');await tx.user.update({where:{id:target},data:{status:action==='approve'?'APPROVED':'REJECTED',...(action==='reject'?{activatedAt:null}:{}),sessionVersion:{increment:1}}});if(action==='reject'){await tx.slot.updateMany({where:{userId:target},data:{userId:null}});await tx.verificationToken.updateMany({where:{userId:target,revokedAt:null},data:{revokedAt:new Date()}});}await notify(tx,target,action==='approve'?'Your account is approved. Ask your admin for your verification token.':'Your registration was rejected. Contact the admin.');
 }else if(action==='editMember'){id.parse(target);await tx.user.update({where:{id:target,role:'PARTICIPANT'},data:{location:z.string().min(2).max(150).parse(text(f,'location')),nextOfKin:z.string().min(2).max(100).parse(text(f,'nextOfKin')),nextOfKinPhone:phoneSchema.parse(text(f,'nextOfKinPhone'))}});
 }else if(action==='token'){id.parse(target);const member=await tx.user.findUniqueOrThrow({where:{id:target}});if(member.status!=='APPROVED'||member.role!=='PARTICIPANT')throw new Error('Approve a participant first');secret=newCode('RAS');await tx.verificationToken.updateMany({where:{userId:target,revokedAt:null},data:{revokedAt:new Date()}});await tx.verificationToken.create({data:{userId:target,tokenHash:hashToken(secret),expiresAt:new Date(Date.now()+90*86400000)}});await tx.user.update({where:{id:target},data:{activatedAt:null,sessionVersion:{increment:1}}});
 }else if(action==='revokeToken'){id.parse(target);const token=await tx.verificationToken.update({where:{id:target},data:{revokedAt:new Date()}});await tx.user.update({where:{id:token.userId},data:{activatedAt:null,sessionVersion:{increment:1}}});
 }else if(action==='resetCode'){id.parse(target);const member=await tx.user.findUniqueOrThrow({where:{id:target}});if(member.role==='SUPER_ADMIN')throw new Error('Use the local admin recovery command');secret=newCode('RST');await tx.passwordReset.updateMany({where:{userId:target,usedAt:null},data:{usedAt:new Date()}});await tx.passwordReset.create({data:{userId:target,codeHash:hashToken(secret),expiresAt:new Date(Date.now()+30*60000)}});
 }else if(action==='createSlot'){await tx.slot.create({data:{}});
 }else if(action==='deleteSlot'){id.parse(target);const deleted=await tx.slot.deleteMany({where:{id:target,userId:null}});if(!deleted.count)throw new Error('Only empty slots can be deleted');
 }else if(action==='assignSlot'){const slotId=id.parse(text(f,'slotId'));const userId=text(f,'userId')||null;const sourceId=text(f,'sourceId');
 await tx.$executeRaw`SELECT id FROM "Slot" ORDER BY id FOR UPDATE`;
 const slot=await tx.slot.findUniqueOrThrow({where:{id:slotId}});if(slot.userId&&slot.userId!==userId)throw new Error('Destination slot is occupied. Choose an empty slot.');
 if(userId){const member=await tx.user.findUniqueOrThrow({where:{id:userId}});if(member.status!=='APPROVED'||member.role!=='PARTICIPANT')throw new Error('Select an approved participant');}
 if(sourceId){const from=await tx.slot.findUniqueOrThrow({where:{id:id.parse(sourceId)}});if(from.userId!==userId||from.id===slotId)throw new Error('Slot changed. Refresh and try again.');await tx.slot.update({where:{id:from.id},data:{userId:null}});}
 await tx.slot.update({where:{id:slotId},data:{userId}});
 }else if(['confirmPayment','rejectPayment'].includes(action)){id.parse(target);const changed=await tx.payment.updateMany({where:{id:target,status:'PENDING'},data:{status:action==='confirmPayment'?'PAID':'REJECTED',reviewedAt:new Date(),reviewedBy:u.id,reviewNote:text(f,'note').slice(0,300)}});if(!changed.count)throw new Error('This payment has already been reviewed');const payment=await tx.payment.findUniqueOrThrow({where:{id:target}});await notify(tx,payment.userId,action==='confirmPayment'?'Your payment has been verified.':'Your payment was rejected. Contact the admin for details.');
 }else if(action==='reminders'){await tx.setting.upsert({where:{key:'remindersEnabled'},create:{key:'remindersEnabled',value:text(f,'enabled')==='true'?'true':'false'},update:{value:text(f,'enabled')==='true'?'true':'false'}});
 }else throw new Error('Unknown action');
 await tx.auditLog.create({data:{actorId:u.id,action,targetId:target||text(f,'slotId')||'settings'}});
 },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
 }
 revalidatePath('/dashboard','layout');return {ok:true,message:secret?'Code generated. Copy it now and share privately; it is shown only once.':'Saved successfully.',secret};
 }catch(e){return failure(e);}
}
function failure(e:unknown,fallback='Unable to save. Please try again.'):ActionState{if(e instanceof z.ZodError)return {ok:false,message:e.issues.map(i=>i.message).join('. ')};if(e instanceof Prisma.PrismaClientKnownRequestError){if(e.code==='P2002')return {ok:false,message:'This account or transaction already exists.'};if(e.code==='P2034')return {ok:false,message:'Another update occurred. Refresh and try again.'};console.error('Database action failed:',e.code);return {ok:false,message:fallback};}return {ok:false,message:e instanceof Error?e.message:fallback};}
