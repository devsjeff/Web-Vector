"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import style from "./login.module.css";

type GoogleResponse = {
  credential: string;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: GoogleResponse) => void;
          }) => void;

          renderButton: (
            element: HTMLElement,
            options: {
              theme: "outline";
              size: "large";
              width: number;
              text: "continue_with";
              shape: "rectangular";
            }
          ) => void;
        };
      };
    };
  }
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /*
   * GOOGLE LOGIN
   */
  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

    if (!clientId) {
      console.error("Google Client ID is missing");
      return;
    }

    const script = document.createElement("script");

    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;

    script.onload = () => {
      const button = document.getElementById("google-login");

      if (!button || !window.google) {
        console.error("Google login could not be loaded");
        return;
      }

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleGoogleLogin,
      });

      window.google.accounts.id.renderButton(button, {
        theme: "outline",
        size: "large",
        width: 420,
        text: "continue_with",
        shape: "rectangular",
      });
    };

    script.onerror = () => {
      console.error("Google script failed to load");
    };

    document.body.appendChild(script);

    return () => {
      script.remove();
    };
  }, []);

  /*
   * EMAIL + PASSWORD LOGIN
   */
  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");

    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        "http://localhost:8000/auth/login",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            email,
            password,
          }),
        }
      );

      /*
       * API responded with an error
       */
      if (!response.ok) {
        if (response.status === 401) {
          setError("Invalid email or password.");
        } else if (response.status >= 500) {
          setError(
            "Our server is having a problem. Please try again."
          );
        } else {
          setError("Login failed. Please try again.");
        }

        return;
      }

      /*
       * Login successful
       */
      const data = await response.json();

      console.log("Login successful:", data);

      // Later:
      // save session/cookie
      // router.push("/dashboard");

    } catch (error) {
      /*
       * API completely unreachable
       */
      console.error("Login error:", error);

      setError(
        "Unable to connect to the server. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   * GOOGLE LOGIN
   */
  async function handleGoogleLogin(response: GoogleResponse) {
    setError("");
    setLoading(true);

    try {
      const result = await fetch(
        "http://localhost:8000/auth/google",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            credential: response.credential,
          }),
        }
      );

      if (!result.ok) {
        setError("Google login failed. Please try again.");
        return;
      }

      const data = await result.json();

      console.log("Google login successful:", data);

      // Later:
      // router.push("/dashboard");

    } catch (error) {
      console.error("Google login error:", error);

      setError(
        "Unable to connect to the server. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={style.loginPage}>
      <div className={style.loginCard}>

        {/* LOGO */}
        <div className={style.logo}>
          WEB VECTOR
        </div>

        <h1>Welcome back</h1>

        <p className={style.subtitle}>
          Sign in to continue to Web Vector
        </p>

        {/* GOOGLE */}
        <div
          id="google-login"
          className={style.googleButton}
        />

        {/* DIVIDER */}
        <div className={style.divider}>
          <span />
          <p>OR</p>
          <span />
        </div>

        {/* ERROR */}
        {error && (
          <div className={style.error}>
            {error}
          </div>
        )}

        {/* LOGIN FORM */}
        <form onSubmit={handleLogin}>

          {/* EMAIL */}
          <div className={style.field}>
            <label htmlFor="email">
              Email
            </label>

            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              disabled={loading}
              autoComplete="email"
            />
          </div>

          {/* PASSWORD */}
          <div className={style.field}>

            <div className={style.passwordHeader}>
              <label htmlFor="password">
                Password
              </label>

              <Link href="/forgot-password">
                Forgot password?
              </Link>
            </div>

            <input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              disabled={loading}
              autoComplete="current-password"
            />

          </div>

          {/* SUBMIT */}
          <button
            type="submit"
            className={style.loginButton}
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign in →"}
          </button>

        </form>

        {/* SIGNUP */}
        <div className={style.signup}>
          <span>Don't have an account?</span>

          <Link href="/signup">
            Sign up
          </Link>
        </div>

        {/* TERMS */}
        <p className={style.terms}>
          By continuing, you agree to our Terms
          and Privacy Policy.
        </p>

      </div>
    </main>
  );
}