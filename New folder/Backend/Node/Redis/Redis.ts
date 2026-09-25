import {createClient} from "redis";
import {env} from "../CommonENV.ts"
import {setTimeout as sleep} from "node:timers/promises"

const RedisUrl = env.REDIS_URL
const rclient = createClient({url:RedisUrl})
rclient.on("error", (err) => console.error("Redis Error", err));
await rclient.connect()


export async function SetRedis(key:string,value:object): Promise<boolean>{
    try{
    await rclient.set("",JSON.stringify(value))
    return true}
    catch{
        throw Error 
    }
    
}




export async function GetRedis(key:string):Promise<object | Error>{
    try{
        const data = await rclient.get(key)
        const parse = JSON.parse(data ?? "{}");
        return parse}
    catch{
        throw Error
    }

}

