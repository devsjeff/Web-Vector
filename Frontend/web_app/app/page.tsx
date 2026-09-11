"use client"

import {Backend_urls} from "./configurations"
import { useEffect } from "react"
import { useRouter } from "next/navigation"

async function checkLogin() {
    const response = await fetch(Backend_urls.HomeAuth)

    return response.ok
}

export default function Page() {

    const router = useRouter()

    useEffect(() => {

        async function check() {

            const Login = localStorage.getItem("Login")

            if (Login !== "true") {
                router.replace("/Auth/Login")
                return
            }

            const isLoggedIn = await checkLogin()

            if (isLoggedIn) {
                router.replace("/Application")
            } else {
                router.replace("/Auth/Login")
            }
        }

        check()

    }, [router])

    return null
}