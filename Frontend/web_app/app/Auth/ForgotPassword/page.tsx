"use client";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import Link from "next/link";
import style from "./ForgotPassword.module.css";
import {Backend_urls , Frontend_Links} from "../../configurations" ;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSendOTP() {
    setError("");
    setSuccess("");

    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }

    setOtpLoading(true);

    try {
      const response = await fetch(Backend_urls.Forgot_password_Otp, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
      });

      if (response.status === 429) {
        setError("Too many requests. Please wait and try again.");
        return;
      }

      if (response.status >= 500) {
        setError("Our server is having a problem. Please try again.");
        return;
      }

      if (!response.ok) {
        setError("Unable to send OTP. Please try again.");
        return;
      }

      setOtpSent(true);
      setOtp("");
      setSuccess("OTP sent to your email.");
    } catch (error) {
      console.error("Send OTP error:", error);
      setError("Unable to connect to the server. Please try again.");
    } finally {
      setOtpLoading(false);
    }
  }

  async function handleResetPassword(event: FormEvent<HTMLFormElement>) {

    

    event.preventDefault();
    setError("");
    setSuccess("");

    if (!otpSent) {
      setError("Please send the OTP first.");
      return;
    }

    if (!/^\d{6}$/.test(otp)) {
      setError("OTP must be exactly 6 digits.");
      return;
    }

    if (!password || !confirmPassword) {
      setError("Please enter and confirm your new password.");
      return;
    }

    // 8+ chars, uppercase, lowercase, number and special character
    const strongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

    if (!strongPassword.test(password)) {
      setError("Password must have 8+ characters, uppercase, lowercase, number, and special character.");
      return;
    }

    // Reject obvious repeated characters: 11111111, aaaaaaaa, !!!!!!!!
    if (/^(.)\1+$/.test(password)) {
      setError("Please choose a stronger password.");
      return;
    }

    // Reject simple numeric sequences: 12345678, 87654321, etc.
    const sequence = "0123456789";
    const reverseSequence = "9876543210";

    if (sequence.includes(password) || reverseSequence.includes(password)) {
      setError("Please choose a stronger password.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setResetLoading(true);

    try {
      const response = await fetch(Backend_urls.Forget_pass_Reset, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, otp, password }),
      });

      if (response.status === 400) {
        setError("Wrong or expired OTP. Please try again.");
        return;
      }

      if (response.status >= 500) {
        setError("Our server is having a problem. Please try again.");
        return;
      }

      if (!response.ok) {
        setError("Unable to reset your password. Please try again.");
        return;
      }
      setSuccess("Password reset successfully! You can now sign in or just go to Application to use .");
      setTimeout(() => {
        router.push(Frontend_Links.Application)}, 2000);


      setOtp("");
      setPassword("");
      setConfirmPassword("");
      setOtpSent(false);
    } catch (error) {
      console.error("Reset password error:", error);
      setError("Unable to connect to the server. Please try again.");
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <main className={style.forgotPage}>
      <div className={style.forgotCard}>
        {/* LOGO */}
        <div className={style.logo}>WEB VECTOR</div>

        {/* TITLE */}
        <h1>Reset password</h1>
        <p className={style.subtitle}>Enter your email, verify your OTP, and create a new password.</p>

        {/* ERROR */}
        {error && <div className={style.error}>{error}</div>}

        {/* SUCCESS */}
        {success && <div className={style.success}>{success}</div>}

        <form onSubmit={handleResetPassword}>
          {/* EMAIL */}
          <div className={style.field}>
            <label htmlFor="email">Email</label>
            <div className={style.emailRow}>
              <input id="email" type="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} disabled={otpLoading || resetLoading} autoComplete="email" />
              <button type="button" className={style.otpButton} onClick={handleSendOTP} disabled={otpLoading || resetLoading}>
                {otpLoading ? "Sending..." : otpSent ? "Resend OTP" : "Send OTP"}
              </button>
            </div>
          </div>

          {/* OTP */}
          <div className={style.field}>
            <label htmlFor="otp">Verification code</label>
            <input id="otp" type="text" inputMode="numeric" maxLength={6} placeholder={otpSent ? "Enter 6-digit OTP" : "Send OTP first"} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} disabled={!otpSent || resetLoading} autoComplete="one-time-code" />
          </div>

          {/* NEW PASSWORD */}
          <div className={style.field}>
            <label htmlFor="password">New password</label>
            <input id="password" type="password" placeholder="Create a strong password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={!otpSent || resetLoading} autoComplete="new-password" />
          </div>

          {/* CONFIRM PASSWORD */}
          <div className={style.field}>
            <label htmlFor="confirmPassword">Confirm password</label>
            <input id="confirmPassword" type="password" placeholder="Enter password again" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} disabled={!otpSent || resetLoading} autoComplete="new-password" />
          </div>

          {/* RESET */}
          <button type="submit" className={style.resetButton} disabled={!otpSent || resetLoading}>
            {resetLoading ? "Resetting password..." : "Reset password →"}
          </button>
        </form>

        {/* LOGIN */}
        <div className={style.login}>
          <span>Remember your password?</span>
        <Link href={Frontend_Links.Login_Page}>Sign in</Link>
        </div>
      </div>
    </main>
  );
}