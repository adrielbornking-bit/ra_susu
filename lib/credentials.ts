import {compare} from 'bcryptjs';
import {db} from './db';
import {phoneSchema,normalizeCode} from './rules';
import {hashToken,rateLimit} from './security';

export async function authorizeCredentials(c:Partial<Record<string,unknown>>,request:Request){
 if(String(c.password||'').length>128||String(c.phone||'').length>100||String(c.token||'').length>100)return rejected('INPUT_TOO_LONG');
 const raw=String(c.phone||'').trim();const p=phoneSchema.safeParse(raw);
 const identity=p.success?p.data:raw.toLowerCase();
 await rateLimit('login-ip:'+(request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim()||'unknown'),50);
 await rateLimit('login:'+identity,10);
 const snapshot=await db.user.findFirst({where:{OR:[{phone:identity},{username:identity},{email:identity}]}});
 const dummy='$2b$12$Pt0MYwHrMj0XvIpq.QvOYuLx.RCIy0NMRQbybIFqNzgYn8ldc6.pK';
 const passwordMatches=await compare(String(c.password||''),snapshot?.passwordHash||dummy);
 if(!snapshot||!passwordMatches)return rejected('PHONE_OR_PASSWORD_INCORRECT');
 if(snapshot.status!=='APPROVED')return rejected('ACCOUNT_NOT_APPROVED');
 // Serialize activation with token reissue, rejection and password/session changes.
 const user=await db.$transaction(async tx=>{
  await tx.$executeRaw`SELECT id FROM "User" WHERE id=${snapshot.id} FOR UPDATE`;
  const u=await tx.user.findUnique({where:{id:snapshot.id}});
  if(!u||u.status!=='APPROVED'||u.passwordHash!==snapshot.passwordHash||u.sessionVersion!==snapshot.sessionVersion)return rejected('ACCOUNT_CHANGED_DURING_LOGIN');
  if(u.role==='PARTICIPANT'&&!u.activatedAt){
   const token=normalizeCode(String(c.token||''));
   if(!token)return rejected('FIRST_LOGIN_TOKEN_REQUIRED');
   const valid=await tx.verificationToken.findFirst({where:{userId:u.id,tokenHash:hashToken(token),revokedAt:null,usedAt:null,expiresAt:{gt:new Date()}}});
   if(!valid)return rejected('TOKEN_INVALID_EXPIRED_OR_REVOKED');
   const now=new Date();
   await tx.verificationToken.update({where:{id:valid.id},data:{usedAt:now}});
   return tx.user.update({where:{id:u.id},data:{activatedAt:now}});
  }
  return u;
 });
 return user?{id:user.id,name:user.name,email:user.email,role:user.role,version:user.sessionVersion}:null;
}

function rejected(reason:'INPUT_TOO_LONG'|'PHONE_OR_PASSWORD_INCORRECT'|'ACCOUNT_NOT_APPROVED'|'ACCOUNT_CHANGED_DURING_LOGIN'|'FIRST_LOGIN_TOKEN_REQUIRED'|'TOKEN_INVALID_EXPIRED_OR_REVOKED'){
 // Private operational logs only: never log phone numbers, passwords or raw tokens.
 console.warn('[ra-susu][login-rejected]',reason);return null;
}
