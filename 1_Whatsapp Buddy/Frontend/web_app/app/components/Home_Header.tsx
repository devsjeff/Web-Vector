"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import Image from "next/image";
import Logo from "../icon.png";
import { Fira_Sans } from "next/font/google";

const firaSans = Fira_Sans({
  weight: "700",
  subsets: ["latin"],
});

export default function Header() {
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  // Stop page scrolling while checking authentication
  useEffect(() => {
    document.body.style.overflow = loading ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [loading]);

  async function handleUse() {
    setLoading(true);

    try {
      const login = localStorage.getItem("Login") 
      
      if (!login) {
      router.push("/Auth/Login");
      return;}

      const response = await fetch("http://localhost:8000/auth", {
        credentials: "include",
      })

      if (response.ok) {
        router.push("/Application");
      } else {
        router.push("/Auth/Login");
      }
    
    } catch (error) {
      console.error(error);
      router.push("/Auth/Login");
    }
  }

  return (
    <>
      {/* Blur + block interaction with everything behind Header */}
      {loading && <div className="blur-layer"></div>}

      <header className="site-header">
        <a href="#top" className="brand">
          <Image
            src={Logo}
            alt="Web Vector logo"
            width={38}
            height={38}
            priority
            className="brand-logo"
          />

          <span className={firaSans.className}>WEB VECTOR</span>
        </a>

        <nav className="site-nav" aria-label="Main navigation">
          <a href="#capabilities">Capabilities</a>
          <a href="#how-it-works">How it works</a>
          <a href="#get-started">Overview</a>
        </nav>

        <button
          onClick={handleUse}
          className="header-button"
          disabled={loading}
        >
          {loading ? "Redirecting..." : "Use"}
          <span>→</span>
        </button>
      </header>
    </>
  );
}