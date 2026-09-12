"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Backend_urls, Frontend_Links } from "../../configurations";
import style from "./signup.module.css";
import { useRouter } from "next/navigation";

type Step = "email" | "otp" | "details";

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
    // No timer needed
    if (otpCooldown <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setOtpCooldown((time) => time - 1);
    }, 1000);

    // VERY IMPORTANT:
    // Stop the timer when component disappears
    // or before a new timer is created.
    return () => clearInterval(timer);
  }, [otpCooldown]);

  /* ================= SEND OTP ================= */

  async function handleSendOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!email) {
      setError("Please enter your email.");
      return;
    }

    // Frontend protection
    if (otpCooldown > 0) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(Backend_urls.Signup_OTP, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
        }),
      });

      if (response.status === 409) {
        setError("An account with this email already exists. Please login.");
        return;
      }

      if (response.status === 429) {
        setError("Too many requests. Please try again later.");
        return;
      }

      if (!response.ok) {
        setError("Unable to send OTP.");
        return;
      }

      // OTP successfully sent
      setOtp("");
      setOtpCooldown(30);
      setStep("otp");

    } catch (error) {
      console.error(error);
      setError("Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  }

  /* ================= VERIFY OTP ================= */

  async function handleVerifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (otp.length !== 6) {
      setError("Please enter the 6-digit OTP.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(Backend_urls.Signup_OTP, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          otp,
        }),
      });

      if (response.status === 400) {
        setError("Wrong or expired OTP.");
        return;
      }

      if (response.status === 429) {
        setError("Too many attempts. Please try again later.");
        return;
      }

      if (!response.ok) {
        setError("Unable to verify OTP.");
        return;
      }

      setStep("details");

    } catch (error) {
      console.error(error);
      setError("Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  }

  /* ================= CREATE ACCOUNT ================= */

  async function handleCreateAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

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
      const response = await fetch(Backend_urls.Signup_Auth, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          email,
          first_name: firstName,
          last_name: lastName,
          password,
        }),
      });

      if (response.status === 400) {
        setError("Signup session expired. Please start again.");
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

    } catch (error) {
      console.error(error);
      setError("Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  }

  /* ================= BACK ================= */

  function handleBack() {
    setError("");

    if (step === "otp") {
      setStep("email");
      setOtp("");
      return;
    }

    if (step === "details") {
      setStep("otp");
      return;
    }
  }

  return (
    <main className={style.signupPage}>
      <div className={style.signupCard}>

        <div className={style.logo}>WEB VECTOR</div>

        {/* ================= EMAIL ================= */}

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

        {/* ================= OTP ================= */}

        {step === "otp" && (
          <>
            <button
              type="button"
              className={style.backButton}
              onClick={handleBack}
              disabled={loading}
            >
              ← Back
            </button>

            <h1>Verify email</h1>

            <p className={style.subtitle}>
              Enter the 6-digit code sent to
            </p>

            <p className={style.emailText}>
              {email}
            </p>

            {error && <div className={style.error}>{error}</div>}

            <form onSubmit={handleVerifyOtp}>
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

              <button
                type="submit"
                className={style.signupButton}
                disabled={loading}
              >
                {loading ? "Verifying..." : "Verify OTP →"}
              </button>
            </form>

            <p className={style.smallText}>
              Did not receive it?
            </p>

            <button
              type="button"
              className={style.backButton}
              disabled={otpCooldown > 0 || loading}
              onClick={() => {
                // Reuse the same email request logic
                const fakeEvent = {
                  preventDefault: () => {},
                } as FormEvent<HTMLFormElement>;

                handleSendOtp(fakeEvent);
              }}
            >
              {otpCooldown > 0
                ? `Resend OTP in ${otpCooldown}s`
                : "Resend OTP"}
            </button>
          </>
        )}

        {/* ================= DETAILS ================= */}

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
              Create your Web Vector account
            </p>

            {error && <div className={style.error}>{error}</div>}

            <form onSubmit={handleCreateAccount}>

              <div className={style.nameRow}>
                <div className={style.field}>
                  <label htmlFor="firstName">
                    First name
                  </label>

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
                  <label htmlFor="lastName">
                    Last name
                  </label>

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
                <label>Email</label>

                <input
                  type="email"
                  value={email}
                  disabled
                />
              </div>

              <div className={style.field}>
                <label htmlFor="password">
                  Password
                </label>

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
                {loading
                  ? "Creating account..."
                  : "Create account →"}
              </button>

            </form>
          </>
        )}

        {/* ================= LOGIN ================= */}

        <div className={style.login}>
          <span>Already have an account?</span>

          <Link href={Frontend_Links.Login_Page}>
            Sign in
          </Link>
        </div>

        <p className={style.terms}>
          By creating an account, you agree to our Terms and Privacy Policy.
        </p>

      </div>
    </main>
  );
}