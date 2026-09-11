"use client";

import App_Header from "../components/App_Header";
import Profile from "./components/Profile/profile";
import Services from "./components/Services/Services";

export default function ApplicationPage() {
  return (
    <main className="app-page">
      <App_Header />
      <Profile />
      <Services />
    </main>
  );
}
