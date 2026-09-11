"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Backend_urls, Frontend_Links } from "../../configurations";
import style from "./signup.module.css";
import { useRouter } from "next/navigation";

export default function SignupPage() {

  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      setError("Please fill in all fields.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(Backend_urls.Signup_Auth, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email,
          password,
        }),
      });

      if (response.status === 409) {
        setError("An account with this email already exists.");
        return;
      }

      if (response.status >= 500) {
        setError("Our server is having a problem. Please try again.");
        return;
      }

      if (!response.ok) {
        setError("Unable to create your account. Please try again.");
        return;
      }

      const data = await response.json();
      console.log("Signup successful:", data);

           setTimeout(() => {
        router.push(Frontend_Links.Application)}, 1000);

    } catch (error) {
      console.error("Signup error:", error);
      setError("Unable to connect to the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={style.signupPage}>
      <div className={style.signupCard}>
        {/* LOGO */}
        <div className={style.logo}>WEB VECTOR</div>

        <h1>Create an account</h1>
        <p className={style.subtitle}>Get started with Web Vector</p>

        {/* ERROR */}
        {error && <div className={style.error}>{error}</div>}

        {/* FORM */}
        <form onSubmit={handleSignup}>
          {/* NAME */}
          <div className={style.nameRow}>
            <div className={style.field}>
              <label htmlFor="firstName">First name</label>
              <input id="firstName" type="text" placeholder="First name" value={firstName} onChange={(event) => setFirstName(event.target.value)} disabled={loading} autoComplete="given-name" />
            </div>

            <div className={style.field}>
              <label htmlFor="lastName">Last name</label>
              <input id="lastName" type="text" placeholder="Last name" value={lastName} onChange={(event) => setLastName(event.target.value)} disabled={loading} autoComplete="family-name" />
            </div>
          </div>

          {/* EMAIL */}
          <div className={style.field}>
            <label htmlFor="email">Email</label>
            <input id="email" type="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} disabled={loading} autoComplete="email" />
          </div>

          {/* PASSWORD */}
          <div className={style.field}>
            <label htmlFor="password">Password</label>
            <input id="password" type="password" placeholder="At least 8 characters" value={password} onChange={(event) => setPassword(event.target.value)} disabled={loading} autoComplete="new-password" />
          </div>

          {/* CONFIRM PASSWORD */}
          <div className={style.field}>
            <label htmlFor="confirmPassword">Confirm password</label>
            <input id="confirmPassword" type="password" placeholder="Enter your password again" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} disabled={loading} autoComplete="new-password" />
          </div>

          {/* BUTTON */}
          <button type="submit" className={style.signupButton} disabled={loading}>
            {loading ? "Creating account..." : "Create account →"}
          </button>
        </form>

        {/* LOGIN */}
        <div className={style.login}>
          <span>Already have an account?</span>
          <Link href={Frontend_Links.Login_Page}>Sign in</Link>
        </div>

        {/* TERMS */}
        <p className={style.terms}>By creating an account, you agree to our Terms and Privacy Policy.</p>
      </div>
    </main>
  );
}
