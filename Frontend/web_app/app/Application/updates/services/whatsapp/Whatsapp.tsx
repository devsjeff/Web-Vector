"use client";

import style from "./Whatsapp.module.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

const API = "http://localhost:3001";

const POLL_QR = 2_000;
const POLL_IDLE = 5_000;
const POLL_CONNECTED = 30_000;
const POLL_HIDDEN = 60_000;
const QR_TTL = 16_000;

type StatusData = { status?: string; whatsappNumber?: string | null };

export default function Whatsapp() {
  const [whatsappNumber, setWhatsappNumber] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("checking");

  const qrTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchStatus = useCallback(async (): Promise<StatusData> => {
    const res = await fetch(`${API}/whatsapp/status`, { credentials: "include" });
    if (!res.ok) throw new Error(`status ${res.status}`);
    return res.json();
  }, []);

  const fetchQr = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`${API}/whatsapp/qr`, { credentials: "include" });
      if (!res.ok) throw new Error(`QR request failed (${res.status})`);
      const data = await res.json();

      if (data.status === "qr" && data.qr) {
        setQr(data.qr);
        if (qrTimerRef.current) clearTimeout(qrTimerRef.current);
        qrTimerRef.current = setTimeout(() => setQr(null), QR_TTL);
      } else {
        setQr(null);
      }
    } catch (err) {
      console.error("Failed to get QR:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  /* ---------- adaptive status polling ---------- */
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastStatus = "checking";

    const schedule = (ms: number) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(run, ms);
    };

    const run = async () => {
      try {
        const data = await fetchStatus();
        if (cancelled) return;
        lastStatus = data.status ?? "checking";
        setStatus(lastStatus);
        setWhatsappNumber(data.whatsappNumber ?? null);
      } catch (err) {
        if (!cancelled) console.error("status poll failed:", err);
      }
      if (cancelled) return;

      const base =
        lastStatus === "connected" ? POLL_CONNECTED
        : lastStatus === "qr" ? POLL_QR
        : POLL_IDLE;

      schedule(document.hidden ? Math.max(base, POLL_HIDDEN) : base);
    };

    const onVisibility = () => {
      if (!document.hidden) {
        if (timer) clearTimeout(timer);
        void run(); // refresh immediately when the user comes back
      }
    };

    void run();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [fetchStatus]);

  /* ---------- clear the QR the moment we're connected ---------- */
  useEffect(() => {
    if (status === "connected") setQr(null);
  }, [status]);

  /* ---------- keep a fresh QR on screen while waiting for a scan ---------- */
  useEffect(() => {
    if (status !== "qr" || qr) return;
    void fetchQr(true); // silent: don't flash the button
  }, [status, qr, fetchQr]);

  /* ---------- unmount cleanup ---------- */
  useEffect(() => () => {
    if (qrTimerRef.current) clearTimeout(qrTimerRef.current);
  }, []);

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

        <span className={style.status}>{status}</span>
        <span>{whatsappNumber ?? "—"}</span>

        <button
          style={{ color: "blue" }}
          onClick={() => void fetchQr()}
          disabled={loading}
        >
          {loading ? "Loading..." : "Generate QR"}
        </button>

        <button
          onClick={async () => {
            await fetch(`${API}/whatsapp/logout`, { credentials: "include" });
          }}
        >
          Logout
        </button>
      </header>

      {qr && (
        <div>
          <QRCodeSVG value={qr} size={300} level="M" marginSize={4} />
        </div>
      )}

      <div className={style.grid}>
        <article className={style.card}>
          <span className={style.cardLabel}>Account</span>
          <p className={style.cardValue}>
            {whatsappNumber
              ? `Connected: ${whatsappNumber}`
              : "No WhatsApp account connected"}
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