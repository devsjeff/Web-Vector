"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Backend_urls, Frontend_Links } from "../../configurations";
import style from "./signup.module.css";
import { useRouter } from "next/navigation";

type Step = "email" | "details";

export default function SignupPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>("email");

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 30-second OTP cooldown
  const [otpCooldown, setOtpCooldown] = useState(0);

  /* ================= OTP TIMER ================= */

  useEffect(() => {
    if (otpCooldown <= 0) return;

    const timer = setInterval(() => {
      setOtpCooldown((time) => time - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [otpCooldown]);

  /* ================= SEND OTP ================= */

  async function sendOtp(): Promise<boolean> {
    setError("");

    if (!email) {
      setError("Please enter your email.");
      return false;
    }

    if (otpCooldown > 0) return false;

    setLoading(true);

    try {
      const response = await fetch(Backend_urls.SignupSendOTP, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (response.status === 409) {
        setError("An account with this email already exists. Please login.");
        return false;
      }

      if (response.status === 429) {
        setError("Too many requests. Please try again later.");
        return false;
      }

      if (!response.ok) {
        setError("Unable to send OTP.");
        return false;
      }

      // OTP sent successfully
      setOtp("");
      setOtpCooldown(30);
      return true;
    } catch (err) {
      console.error(err);
      setError("Unable to connect to the server.");
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function handleSendOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const ok = await sendOtp();
    if (ok) setStep("details");
  }

  /* ================= CREATE ACCOUNT ================= */

  async function handleCreateAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (otp.length !== 6) {
      setError("Please enter the 6-digit OTP.");
      return;
    }

    if (!firstName || !lastName || !password || !confirmPassword) {
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
      const response = await fetch(Backend_urls.Verify_otp_Create_Acc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email,
          otp,
          first_name: firstName,
          last_name: lastName,
          password,
        }),
      });

      if (response.status === 400) {
        setError("Wrong or expired OTP.");
        return;
      }

      if (response.status === 409) {
        setError("Account already exists. Please login.");
        return;
      }

      if (!response.ok) {
        setError("Unable to create account.");
        return;
      }

      router.push(Frontend_Links.Application);
    } catch (err) {
      console.error(err);
      setError("Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  }

  /* ================= BACK ================= */

  function handleBack() {
    setError("");
    setStep("email");
    setOtp("");
  }

  return (
    <main className={style.signupPage}>
      <div className={style.signupCard}>

        <div className={style.logo}>WEB VECTOR</div>

        {/* ================= STEP 1: EMAIL ================= */}

        {step === "email" && (
          <>
            <h1>Create an account</h1>

            <p className={style.subtitle}>
              Enter your email to get started
            </p>

            {error && <div className={style.error}>{error}</div>}

            <form onSubmit={handleSendOtp}>
              <div className={style.field}>
                <label htmlFor="email">Email</label>

                <input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={loading}
                  autoComplete="email"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                className={style.signupButton}
                disabled={loading || otpCooldown > 0}
              >
                {loading
                  ? "Sending OTP..."
                  : otpCooldown > 0
                    ? `Try again in ${otpCooldown}s`
                    : "Send OTP →"}
              </button>
            </form>
          </>
        )}

        {/* ================= STEP 2: OTP + DETAILS ================= */}

        {step === "details" && (
          <>
            <button
              type="button"
              className={style.backButton}
              onClick={handleBack}
              disabled={loading}
            >
              ← Back
            </button>

            <h1>Finish signup</h1>

            <p className={style.subtitle}>
              Enter the 6-digit code sent to
            </p>

            <p className={style.emailText}>{email}</p>

            {error && <div className={style.error}>{error}</div>}

            <form onSubmit={handleCreateAccount}>

              <div className={style.field}>
                <label htmlFor="otp">OTP</label>

                <input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  value={otp}
                  onChange={(event) =>
                    setOtp(event.target.value.replace(/\D/g, ""))
                  }
                  disabled={loading}
                  autoComplete="one-time-code"
                  autoFocus
                />
              </div>

              <div className={style.nameRow}>
                <div className={style.field}>
                  <label htmlFor="firstName">First name</label>

                  <input
                    id="firstName"
                    type="text"
                    placeholder="First name"
                    value={firstName}
                    onChange={(event) =>
                      setFirstName(event.target.value)
                    }
                    disabled={loading}
                    autoComplete="given-name"
                  />
                </div>

                <div className={style.field}>
                  <label htmlFor="lastName">Last name</label>

                  <input
                    id="lastName"
                    type="text"
                    placeholder="Last name"
                    value={lastName}
                    onChange={(event) =>
                      setLastName(event.target.value)
                    }
                    disabled={loading}
                    autoComplete="family-name"
                  />
                </div>
              </div>

              <div className={style.field}>
                <label htmlFor="password">Password</label>

                <input
                  id="password"
                  type="password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  disabled={loading}
                  autoComplete="new-password"
                />
              </div>

              <div className={style.field}>
                <label htmlFor="confirmPassword">
                  Confirm password
                </label>

                <input
                  id="confirmPassword"
                  type="password"
                  placeholder="Enter password again"
                  value={confirmPassword}
                  onChange={(event) =>
                    setConfirmPassword(event.target.value)
                  }
                  disabled={loading}
                  autoComplete="new-password"
                />
              </div>

              <button
                type="submit"
                className={style.signupButton}
                disabled={loading}
              >
                {loading ? "Creating account..." : "Create account →"}
              </button>
            </form>

            <p className={style.smallText}>Did not receive it?</p>

            <button
              type="button"
              className={style.backButton}
              disabled={otpCooldown > 0 || loading}
              onClick={() => sendOtp()}
            >
              {otpCooldown > 0
                ? `Resend OTP in ${otpCooldown}s`
                : "Resend OTP"}
            </button>
          </>
        )}

        {/* ================= LOGIN ================= */}

        <div className={style.login}>
          <span>Already have an account?</span>

          <Link href={Frontend_Links.Login_Page}>Sign in</Link>
        </div>

        <p className={style.terms}>
          By creating an account, you agree to our Terms and Privacy Policy.
        </p>

      </div>
    </main>
  );
}