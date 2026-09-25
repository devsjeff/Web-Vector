import { jwtVerify } from "jose"
import {env } from "../CommonENV"

const JWT_SECRET = new TextEncoder().encode(env.JWT_SECRET)

export default async function  Verify_JWT_Token(token:string) {
    try{
    const Token = await jwtVerify(token , JWT_SECRET )
    return {result:true,email:token.sub , }
    }catch{
        return {result:false}
    }
    
}
