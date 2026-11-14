import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import {authorizeCredentials} from '@/lib/credentials';
export const {handlers,auth,signIn,signOut}=NextAuth({
 session:{strategy:'jwt',maxAge:8*60*60},pages:{signIn:'/login'},
 providers:[Credentials({credentials:{phone:{},password:{},token:{}},authorize:authorizeCredentials})],
 callbacks:{async jwt({token,user}){if(user){token.uid=user.id;token.version=(user as unknown as {version:number}).version;}return token;},async session({session,token}){session.user.id=String(token.uid);(session as unknown as {version:number}).version=Number(token.version);return session;}}
});
