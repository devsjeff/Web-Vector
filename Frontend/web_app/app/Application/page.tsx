"use client";
import { useRouter } from "next/navigation"
import {useEffect} from "react"

import App_Header from "../components/App_Header";
import Profile from "./components/Profile/profile";
import Services from "./components/Services/Services";

export default function ApplicationPage() {
const router = useRouter()

    useEffect(() => {

        async function check_Login() {

            const Login = localStorage.getItem("Login")

            if (Login !== "true") {
                router.replace("/Home")
                return
            }
        }

        check_Login()

    }, [router])

  return (
    <main className="app-page">
      <App_Header />
      <Profile />
      <Services />
    </main>
  );
}
