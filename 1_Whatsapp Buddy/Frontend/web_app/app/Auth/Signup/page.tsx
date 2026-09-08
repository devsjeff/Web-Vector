"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import style from "./signup.module.css";

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

export default function SignupPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /*
   * GOOGLE SIGNUP
   */
  useEffect(() => {
    const clientId =
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

    if (!clientId) {
      console.error("Google Client ID is missing");
      return;
    }

    const script = document.createElement("script");

    script.src =
      "https://accounts.google.com/gsi/client";

    script.async = true;
    script.defer = true;

    script.onload = () => {
      const button =
        document.getElementById("google-signup");

      if (!button || !window.google) {
        console.error(
          "Google signup could not be loaded"
        );

        return;
      }

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleGoogleSignup,
      });

      window.google.accounts.id.renderButton(
        button,
        {
          theme: "outline",
          size: "large",
          width: 420,
          text: "continue_with",
          shape: "rectangular",
        }
      );
    };

    script.onerror = () => {
      console.error(
        "Google script failed to load"
      );
    };

    document.body.appendChild(script);

    return () => {
      script.remove();
    };
  }, []);

  /*
   * EMAIL SIGNUP
   */
  async function handleSignup(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");

    /*
     * BASIC VALIDATION
     */

    if (
      !firstName ||
      !lastName ||
      !email ||
      !password ||
      !confirmPassword
    ) {
      setError("Please fill in all fields.");
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

    setLoading(true);

    try {
      const response = await fetch(
        "http://localhost:8000/auth/signup",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            first_name: firstName,
            last_name: lastName,
            email,
            password,
          }),
        }
      );

      /*
       * EMAIL ALREADY EXISTS
       */
      if (response.status === 409) {
        setError(
          "An account with this email already exists."
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
          "Unable to create your account. Please try again."
        );

        return;
      }

      /*
       * SUCCESS
       */
      const data = await response.json();

      console.log(
        "Signup successful:",
        data
      );

      // Later:
      // router.push("/Auth/Login");

    } catch (error) {
      console.error(
        "Signup error:",
        error
      );

      setError(
        "Unable to connect to the server. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   * GOOGLE SIGNUP
   */
  async function handleGoogleSignup(
    response: GoogleResponse
  ) {
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

      if (result.status >= 500) {
        setError(
          "Our server is having a problem. Please try again."
        );

        return;
      }

      if (!result.ok) {
        setError(
          "Google signup failed. Please try again."
        );

        return;
      }

      const data = await result.json();

      console.log(
        "Google signup successful:",
        data
      );

      // Later:
      // router.push("/dashboard");

    } catch (error) {
      console.error(
        "Google signup error:",
        error
      );

      setError(
        "Unable to connect to the server. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={style.signupPage}>

      <div className={style.signupCard}>

        {/* LOGO */}

        <div className={style.logo}>
          WEB VECTOR
        </div>

        <h1>Create an account</h1>

        <p className={style.subtitle}>
          Get started with Web Vector
        </p>

        {/* GOOGLE */}

        <div
          id="google-signup"
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

        {/* FORM */}

        <form onSubmit={handleSignup}>

          {/* NAME */}

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
                  setFirstName(
                    event.target.value
                  )
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
                  setLastName(
                    event.target.value
                  )
                }
                disabled={loading}
                autoComplete="family-name"
              />

            </div>

          </div>

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
                setEmail(
                  event.target.value
                )
              }
              disabled={loading}
              autoComplete="email"
            />

          </div>

          {/* PASSWORD */}

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
                setPassword(
                  event.target.value
                )
              }
              disabled={loading}
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
              placeholder="Enter your password again"
              value={confirmPassword}
              onChange={(event) =>
                setConfirmPassword(
                  event.target.value
                )
              }
              disabled={loading}
              autoComplete="new-password"
            />

          </div>

          {/* BUTTON */}

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

        {/* LOGIN */}

        <div className={style.login}>

          <span>
            Already have an account?
          </span>

          <Link href="/Auth/Login">
            Sign in
          </Link>

        </div>

        {/* TERMS */}

        <p className={style.terms}>
          By creating an account, you agree to
          our Terms and Privacy Policy.
        </p>

      </div>

    </main>
  );
}