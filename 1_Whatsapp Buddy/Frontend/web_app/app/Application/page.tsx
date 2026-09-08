"use client";

import AppHeader from "../components/App_Header";
import Profile from "./components/Profile/profile";
import Services from "./components/Services/Services";

export default function ApplicationPage() {
  return (
    <main className="app-page">
      <AppHeader />
      <Profile />
      <Services />
    </main>
  );
}
