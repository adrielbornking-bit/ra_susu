import {z} from 'zod';
export const phoneSchema=z.string().transform(v=>v.replace(/[\s()-]/g,'').replace(/^0/,'+233').replace(/^233/,'+233')).pipe(z.string().regex(/^\+233[235]\d{8}$/, 'Enter a valid Ghana mobile number'));
export const passwordSchema=z.string().min(12,'Use at least 12 characters').max(128);
export const registrationSchema=z.object({name:z.string().trim().min(3).max(100),phone:phoneSchema,password:passwordSchema,confirmPassword:z.string(),location:z.string().trim().min(2).max(150),nextOfKin:z.string().trim().min(2).max(100),nextOfKinPhone:phoneSchema}).refine(v=>v.password===v.confirmPassword,{message:'Passwords do not match',path:['confirmPassword']});
export const paymentSchema=z.object({amount:z.coerce.number().finite().min(22).max(110).multipleOf(0.01),network:z.enum(['MTN','TELECEL','AT']),reference:z.string().trim().min(3).max(80),transactionId:z.string().trim().min(5).max(100).regex(/^[a-zA-Z0-9_-]+$/)});
export const day=(d=new Date())=>new Date(d.toISOString().slice(0,10)+'T00:00:00.000Z'); // Accra is UTC, no DST
export const money=(pesewas:number)=>new Intl.NumberFormat('en-GH',{style:'currency',currency:'GHS'}).format(pesewas/100);
export function contribution(slots:number,paid:number,pending=0){const required=slots*2200;return {required,paid,pending,remaining:Math.max(0,required-paid),status:required>0&&paid>=required?'PAID':pending>0?'PENDING':'UNPAID'};}
export function allocateSlots<T extends {userId:string|null;slotNumber:number}>(slots:T[],paid:Map<string,number>,pending:Set<string>){const used=new Map<string,number>();return [...slots].sort((a,b)=>a.slotNumber-b.slotNumber).map(s=>{if(!s.userId)return {...s,status:'EMPTY'};const i=used.get(s.userId)||0;used.set(s.userId,i+1);return {...s,status:(paid.get(s.userId)||0)>=(i+1)*2200?'PAID':pending.has(s.userId)?'PENDING':'UNPAID'};});}
export function csvCell(value:unknown){let s=String(value??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}

// Preserve code characters while accepting formatting introduced by copied messages.
export const normalizeCode=(value:string)=>value.replace(/[\s\u200B-\u200D\uFEFF]/g,'').replace(/[\u2010-\u2015\u2212]/g,'-').toUpperCase();
