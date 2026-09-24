"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import style from "./login.module.css";
import {Backend_urls ,Frontend_Links} from "../../configurations"
import { useRouter } from "next/navigation";

export default function LoginPage() {
const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch( Backend_urls.Login, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        let detail = "";
        try {
          const body = await response.json();
          detail = body?.detail || "";
        } catch {
          /* ignore parse errors */
        }
        if (response.status === 401) {
          setError(detail || "Invalid email or password.");
        } else if (response.status === 429) {
          setError("Too many attempts. Please wait and try again.");
        } else if (response.status >= 500) {
          setError(detail || "Server having problem. Please try again.");
        } else {
          setError(detail || "Login failed. Please try again.");
        }
        return;
      }

      const data = await response.json();
      console.log("Login successful:", data);
      localStorage.setItem("Login","true");

        setTimeout(() => {
        router.push(Frontend_Links.Application)}, 1000);

    } catch (error) {
      console.error("Login error:", error);
      setError("Unable to connect to the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={style.loginPage}>
      <div className={style.loginCard}>
        {/* LOGO */}
        <div className={style.logo}>WEB VECTOR</div>

        <h1>Welcome back</h1>
        <p className={style.subtitle}>Sign in to continue to Web Vector</p>

        {/* ERROR */}
        {error && <div className={style.error}>{error}</div>}

        {/* LOGIN FORM */}
        <form onSubmit={handleLogin}>
          {/* EMAIL */}
          <div className={style.field}>
            <label htmlFor="email">Email</label>
            <input id="email" type="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} disabled={loading} autoComplete="email" />
          </div>

          {/* PASSWORD */}
          <div className={style.field}>
            <div className={style.passwordHeader}>
              <label htmlFor="password">Password</label>
              <Link href={Frontend_Links.Forgot_password}>Forgot password?</Link>
            </div>
            <input id="password" type="password" placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={loading} autoComplete="current-password" />
          </div>

          {/* SUBMIT */}
          <button type="submit" className={style.loginButton} disabled={loading}>
            {loading ? "Signing in..." : "Sign in →"}
          </button>
        </form>

        {/* SIGNUP */}
        <div className={style.signup}>
          <span>Not having an account?</span>
          <Link href={Frontend_Links.Signup_Page}>Sign up</Link>
        </div>

        {/* TERMS */}
        <p className={style.terms}>By continuing, you agree to our Terms and Privacy Policy.</p>
      </div>
    </main>
  );
}