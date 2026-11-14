import {auth} from '@/auth';
import {db} from './db';
import {redirect} from 'next/navigation';
export async function requireUser(admin=false){const session=await auth();if(!session?.user?.id)redirect('/login');const user=await db.user.findUnique({where:{id:session.user.id}});if(!user||user.status!=='APPROVED'||(user.role==='PARTICIPANT'&&!user.activatedAt)||user.sessionVersion!==(session as unknown as {version:number}).version)redirect('/login');if(admin&&user.role!=='SUPER_ADMIN')throw new Error('Administrator access required');return user;}
