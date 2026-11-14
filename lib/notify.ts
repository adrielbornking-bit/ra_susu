import {Prisma} from '@prisma/client';
export async function notify(tx:Prisma.TransactionClient,userId:string,message:string,key?:string){
 await tx.notification.create({data:{userId,message,dedupeKey:key}});
 for(const channel of ['email','sms','whatsapp'])await tx.delivery.create({data:{userId,message,channel,dedupeKey:(key||crypto.randomUUID())+':'+channel}});
}
