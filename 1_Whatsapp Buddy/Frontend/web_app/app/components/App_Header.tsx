"use client";

import Image from "next/image";
import Logo from "../icon.png";
import { Fira_Sans } from "next/font/google";

const firaSans = Fira_Sans({
  weight: "700",
  subsets: ["latin"],
});

export default function AppHeader() {
  return (
    <header className="app-header">
      <a href="/Application" className="app-brand" aria-label="Web Vector home">
        <Image src={Logo} alt="Web Vector logo" width={36} height={36} priority className="app-brand-logo" />
        <span className={firaSans.className}>WEB VECTOR</span>
      </a>

      <div className="app-header-title">
        <span>Application</span>
      </div>
    </header>
  );
}
