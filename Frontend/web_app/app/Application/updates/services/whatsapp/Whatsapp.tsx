"use client";

import style from "./Whatsapp.module.css";
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";

export default function Whatsapp() {
  const [qr, setQr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function getQR() {
    try {
      setLoading(true);

      const response = await fetch("http://localhost:3000/whatsapp/qr", {
        credentials: "include",
      });

      const data = await response.json();

      if (data.status === "qr") {
        setQr(data.qr);
      } else {
        setQr(null);
      }
    } catch (error) {
      console.error("Failed to get QR:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className={style.container}>
      <header className={style.header}>
        <div>
          <p className={style.eyebrow}>Connected service</p>

          <h1 className={style.title}>WhatsApp</h1>

          <p className={style.description}>
            Configure WhatsApp accounts and the automation that will run
            through this service.
          </p>
        </div>

        <span className={style.status}>
          {qr ? "QR Ready" : "Not connected"}
        </span>

        <button onClick={getQR} disabled={loading}>
          {loading ? "Loading..." : "Generate QR"}
        </button>
      </header>

      {qr && (
        <div>
          <QRCodeSVG value={qr} size={300} />
        </div>
      )}

      <div className={style.grid}>
        <article className={style.card}>
          <span className={style.cardLabel}>Account</span>

          <p className={style.cardValue}>
            No WhatsApp account connected
          </p>

          <p className={style.cardMuted}>
            Your account list can be added here later.
          </p>
        </article>

        <article className={style.card}>
          <span className={style.cardLabel}>Settings</span>

          <p className={style.cardValue}>Automation settings</p>

          <p className={style.cardMuted}>
            This is where your future WhatsApp controls can live.
          </p>
        </article>
      </div>
    </section>
  );
}