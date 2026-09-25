import Fastify , { FastifyError }from "fastify" ;
import helmet from "@fastify/helmet"
import cors from "@fastify/cors"
import ratelimit from "@fastify/rate-limit"
import sensible from "@fastify/sensible"
import { tr } from "zod/v4/locales/index.js";

import {env} from "../CommonENV"
import {WhatsappRoutes} from "./Routes/Whatsapp/whatsappRoutes"

const app = Fastify({logger:true , trustProxy:true , bodyLimit:1_048_576})


async function main (){
    await app.register(helmet, {global:true}) ;

    await app.register(cors,{origin:env.FASTIFY_CORS_HOST_ORIGIN?.split(',') ?? false,credentials:true}) ;

    await app.register(ratelimit , {global:true , max:5 , timeWindow:"1 minute"} ) ;

    await app.register(sensible);

    await app.register(WhatsappRoutes)

    app.get('/health', async () => ({ ok: true }));

    app.setErrorHandler((err: FastifyError, req, reply) => {
    req.log.error(err);
    const status = err.statusCode ?? 500;
    reply.status(status).send({
    error: status >= 500 ? 'Internal Server Error' : err.message,
        }); 
            });
   
  await app.listen({port: Number(env.FASTIFY_PORT),host: env.FASTIFY_CORS_HOST_ORIGIN,});


}

main().catch((err) => {
  app.log.error(err);
  process.exit(1);
});