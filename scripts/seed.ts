import {PrismaClient} from '@prisma/client';
import {hash} from 'bcryptjs';
import {randomBytes} from 'node:crypto';
import {readFileSync} from 'node:fs';
const db=new PrismaClient();
async function main(){
 const phone=process.env.ADMIN_PHONE;if(!phone||!/^\+233[235]\d{8}$/.test(phone))throw new Error('Set ADMIN_PHONE in +233 format before setup');
 const existing=await db.user.findUnique({where:{username:'superadmin'}});
 if(!existing){const password=randomBytes(24).toString('base64url');await db.user.create({data:{name:'Super Admin',username:'superadmin',email:process.env.ADMIN_EMAIL||'admin@ransusu.com',phone,passwordHash:await hash(password,12),location:'Ghana',nextOfKin:'',role:'SUPER_ADMIN',status:'APPROVED',mustChangePassword:true}});console.log('ONE-TIME ADMIN PASSWORD (store securely, change immediately): '+password);}
 for(let n=1;n<=20;n++)await db.slot.upsert({where:{slotNumber:n},create:{slotNumber:n},update:{}});
 // Explicit initial slot numbers: advance sequence for future unlimited slots.
 await db.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"Slot"','slotNumber'), GREATEST((SELECT COALESCE(MAX("slotNumber"),20) FROM "Slot"),20))`);
 if(process.argv.includes('--participants')){const rows=JSON.parse(readFileSync('prisma/seed-data.json','utf8'));let imported=0;for(const row of rows){if(await db.user.findUnique({where:{phone:row.phone}}))continue;await db.user.create({data:{...row,passwordHash:await hash(randomBytes(32).toString('hex'),12),mustChangePassword:true}});imported++;}console.log('Imported pending participants: '+imported);}
}
main().finally(()=>db.$disconnect());
