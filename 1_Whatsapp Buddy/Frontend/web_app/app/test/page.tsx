"use client"
import {useEffect} from "react"

export default function Page() {
    useEffect(()=>{localStorage.setItem("Login" , "true")}


    ,[]) 
    return(

        <div>
            checking login 
        </div>
    )
}