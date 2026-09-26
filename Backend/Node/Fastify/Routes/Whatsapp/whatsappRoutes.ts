import type { FastifyPluginAsync } from "fastify";
import "@fastify/cookie";
import VerifyJwt from "../../../Auth/JwtGeneral.ts"
import {getQrForUser ,getStatusForUser ,disconnectUser} from "../../../Baileys/BaileysApi.ts"

type WhatsappEmail = {email:string}


export const WhatsappRoutes : FastifyPluginAsync = async(app)=>{



  app.get("/whatsapp/qr", async (request, reply) => {

    const token = request.cookies.access_token;

    if (!token) {
      return reply.unauthorized("Not logged in");
    }

    const auth = await VerifyJwt(token);

    if (!auth.result) {
      return reply.unauthorized("Invalid token");
    }

    const email = (auth as { email?: string | (() => string) }).email;
    const resolvedEmail = typeof email === "function" ? email() : email;

    if (!resolvedEmail) {
      return reply.unauthorized("Invalid token");
    }

    return getQrForUser(resolvedEmail);
  });




  app.get("/whatsapp/status", async (request , reply)=>{
    const token = request.cookies.access_token;
    if(!token){
      return reply.unauthorized("Not logged in");
    }
    const auth = await VerifyJwt(token);
    if (!auth.result){
      return reply.unauthorized("Invalid token dude")
    }

    const email = auth.email;
    if (!email){
      return reply.unauthorized("Invalid token")
    }
    return getStatusForUser(email)
  })



  app.get("/whatsapp/logout", async (request , reply)=>{
    const token = request.cookies.access_token;
    if(!token){
      return reply.unauthorized("Not logged in");
    }
    const auth = await VerifyJwt(token);
    if (!auth.result){
      return reply.unauthorized("Invalid token dude")
    }

    const email = auth.email;
    if (!email){
      return reply.unauthorized("Invalid token")
    }
    return disconnectUser(email)
  })

};























