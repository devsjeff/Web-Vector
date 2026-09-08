"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

import style from "./ForgotPassword.module.css";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [otpLoading, setOtpLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  /*
   * SEND OTP
   */

  async function handleSendOTP() {
    setError("");
    setSuccess("");

    if (!email) {
      setError("Please enter your email.");
      return;
    }

    setOtpLoading(true);

    try {
      const response = await fetch(
        "http://localhost:8000/auth/forgot-password",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            email,
          }),
        }
      );

      if (response.status >= 500) {
        setError(
          "Our server is having a problem. Please try again."
        );
        return;
      }

      if (!response.ok) {
        setError(
          "Unable to send OTP. Please try again."
        );
        return;
      }

      setSuccess(
        "OTP sent to your email."
      );

    } catch (error) {
      console.error(
        "Send OTP error:",
        error
      );

      setError(
        "Unable to connect to the server. Please try again."
      );
    } finally {
      setOtpLoading(false);
    }
  }

  /*
   * RESET PASSWORD
   */

  async function handleResetPassword(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!email) {
      setError("Please enter your email.");
      return;
    }

    if (!otp) {
      setError("Please enter the OTP.");
      return;
    }

    if (otp.length !== 6) {
      setError("OTP must be 6 digits.");
      return;
    }

    if (!password || !confirmPassword) {
      setError(
        "Please enter and confirm your new password."
      );
      return;
    }

    if (password.length < 8) {
      setError(
        "Password must be at least 8 characters."
      );
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setResetLoading(true);

    try {
      const response = await fetch(
        "http://localhost:8000/auth/reset-password",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            email,
            otp,
            password,
          }),
        }
      );

      /*
       * WRONG OTP
       */

      if (response.status === 400) {
        setError(
          "Wrong or expired OTP. Please try again."
        );
        return;
      }

      /*
       * SERVER ERROR
       */

      if (response.status >= 500) {
        setError(
          "Our server is having a problem. Please try again."
        );
        return;
      }

      /*
       * OTHER ERROR
       */

      if (!response.ok) {
        setError(
          "Unable to reset your password. Please try again."
        );
        return;
      }

      /*
       * SUCCESS
       */

      setSuccess(
        "Password reset successfully! You can now sign in."
      );

      setOtp("");
      setPassword("");
      setConfirmPassword("");

    } catch (error) {
      console.error(
        "Reset password error:",
        error
      );

      setError(
        "Unable to connect to the server. Please try again."
      );
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <main className={style.forgotPage}>

      <div className={style.forgotCard}>

        {/* LOGO */}

        <div className={style.logo}>
          WEB VECTOR
        </div>

        {/* TITLE */}

        <h1>Reset password</h1>

        <p className={style.subtitle}>
          Enter your email, verify your OTP,
          and create a new password.
        </p>

        {/* ERROR */}

        {error && (
          <div className={style.error}>
            {error}
          </div>
        )}

        {/* SUCCESS */}

        {success && (
          <div className={style.success}>
            {success}
          </div>
        )}

        <form onSubmit={handleResetPassword}>

          {/* EMAIL */}

          <div className={style.field}>

            <label htmlFor="email">
              Email
            </label>

            <div className={style.emailRow}>

              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                disabled={resetLoading}
                autoComplete="email"
              />

              <button
                type="button"
                className={style.otpButton}
                onClick={handleSendOTP}
                disabled={otpLoading || resetLoading}
              >
                {otpLoading
                  ? "Sending..."
                  : "Send OTP"}
              </button>

            </div>

          </div>

          {/* OTP */}

          <div className={style.field}>

            <label htmlFor="otp">
              Verification code
            </label>

            <input
              id="otp"
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="Enter 6-digit OTP"
              value={otp}
              onChange={(event) =>
                setOtp(
                  event.target.value.replace(
                    /\D/g,
                    ""
                  )
                )
              }
              disabled={resetLoading}
            />

          </div>

          {/* NEW PASSWORD */}

          <div className={style.field}>

            <label htmlFor="password">
              New password
            </label>

            <input
              id="password"
              type="password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              disabled={resetLoading}
              autoComplete="new-password"
            />

          </div>

          {/* CONFIRM PASSWORD */}

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
                setConfirmPassword(
                  event.target.value
                )
              }
              disabled={resetLoading}
              autoComplete="new-password"
            />

          </div>

          {/* RESET */}

          <button
            type="submit"
            className={style.resetButton}
            disabled={resetLoading}
          >
            {resetLoading
              ? "Resetting password..."
              : "Reset password →"}
          </button>

        </form>

        {/* LOGIN */}

        <div className={style.login}>

          <span>
            Remember your password?
          </span>

          <Link href="/Auth/Login">
            Sign in
          </Link>

        </div>

      </div>

    </main>
  );
}