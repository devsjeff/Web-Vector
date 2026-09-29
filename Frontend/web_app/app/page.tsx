"use client";


import App_Header from "./components/App_Header";
import Profile from "./Application/components/Profile/profile";
import Services from "./Application/components/Services/Services";

export default function ApplicationPage() {

  return (
    <main className="app-page">
      <App_Header />
      <Profile />
      <Services />
    </main>
  );
}
