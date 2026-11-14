import {PrismaClient} from '@prisma/client';import {hash} from 'bcryptjs';import {randomBytes} from 'node:crypto';
const db=new PrismaClient();const pw=randomBytes(24).toString('base64url');
try{await db.user.update({where:{username:'superadmin'},data:{passwordHash:await hash(pw,12),mustChangePassword:true,sessionVersion:{increment:1}}});console.log('ONE-TIME ADMIN PASSWORD: '+pw);}finally{await db.$disconnect();}
