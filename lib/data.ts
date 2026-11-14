import {db} from './db';
import {day,allocateSlots,contribution} from './rules';
export async function dashboardData(userId:string,admin:boolean){
 const today=day();const [users,slots,payments,notifications,resets,tokens,settings,audit]=await Promise.all([
 admin?db.user.findMany({where:{role:'PARTICIPANT'},select:{id:true,name:true,phone:true,location:true,nextOfKin:true,nextOfKinPhone:true,mustChangePassword:true,status:true,createdAt:true},orderBy:{createdAt:'desc'}}):Promise.resolve([]),
 db.slot.findMany({where:{active:true},select:{id:true,slotNumber:true,userId:true,user:{select:{name:true}}},orderBy:{slotNumber:'asc'}}),
 db.payment.findMany({where:admin?{}:{OR:[{userId},{contributionDate:today}]},include:{user:{select:{name:true}}},orderBy:{createdAt:'desc'}}),
 db.notification.findMany({where:{userId},orderBy:{createdAt:'desc'},take:100}),
 admin?db.passwordReset.findMany({where:{usedAt:null},select:{id:true,userId:true,createdAt:true,expiresAt:true,user:{select:{name:true}}},orderBy:{createdAt:'desc'}}):Promise.resolve([]),
 admin?db.verificationToken.findMany({select:{id:true,userId:true,createdAt:true,expiresAt:true,revokedAt:true,usedAt:true,user:{select:{name:true}}},orderBy:{createdAt:'desc'},take:100}):Promise.resolve([]),
 db.setting.findMany(),admin?db.auditLog.findMany({orderBy:{createdAt:'desc'},take:50}):Promise.resolve([])]);
 const paid=new Map<string,number>();const pending=new Set<string>();for(const p of payments.filter(p=>+p.contributionDate===+today)){if(p.status==='PAID')paid.set(p.userId,(paid.get(p.userId)||0)+p.amount);if(p.status==='PENDING')pending.add(p.userId);}
 const grid=allocateSlots(slots,paid,pending);const mine=slots.filter(s=>s.userId===userId);const me=contribution(mine.length,paid.get(userId)||0,payments.filter(p=>p.userId===userId&&+p.contributionDate===+today&&p.status==='PENDING').reduce((a,p)=>a+p.amount,0));
 const own=admin?payments:payments.filter(p=>p.userId===userId);
 const week=new Date(today);week.setUTCDate(week.getUTCDate()-((week.getUTCDay()+6)%7));const month=new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth(),1));
 const sum=(start:Date)=>payments.filter(p=>p.status==='PAID'&&p.contributionDate>=start).reduce((a,p)=>a+p.amount,0);
 return JSON.parse(JSON.stringify({users,slots:grid,payments:own.map(p=>({...p,user:p.user.name})),notifications,resets,tokens,settings,audit,me,metrics:{today:sum(today),week:sum(week),month:sum(month),active:users.filter(u=>u.status==='APPROVED').length,approvals:users.filter(u=>u.status==='PENDING').length,pending:payments.filter(p=>p.status==='PENDING').length,failed:payments.filter(p=>p.status==='REJECTED').length,occupied:slots.filter(s=>s.userId).length,expected:slots.filter(s=>s.userId).length*2200,groupPaid:[...paid.values()].reduce((a,b)=>a+b,0)}}));
}
export type DashboardData=Awaited<ReturnType<typeof dashboardData>>;
