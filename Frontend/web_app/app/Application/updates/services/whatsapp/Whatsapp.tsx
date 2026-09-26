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

// This is the EXACT shape Fastify's GET /whatsapp/status sends back
// (see Node/Baileys/BaileysTypes.ts -> SessionStatus). The field is called "state",
// and its real values are "not_started" | "connecting" | "qr" | "open" | "closed" —
// there is no value called "connected". The old code here read "status" (wrong field
// name) and compared against "connected" (a value the backend never sends), so the
// status pill and the polling speed were both silently broken from day one.
type StatusData = { state?: string; whatsappNumber?: string | null };

// Turns the backend's internal word into something a person reads on screen.
const STATUS_LABELS: Record<string, string> = {
  checking: "Checking…",
  not_started: "Not connected",
  connecting: "Connecting…",
  qr: "Scan the QR code",
  open: "Connected",
  closed: "Disconnected",
};

function friendlyError(err: unknown, fallback: string): string {
  if (err instanceof TypeError && /network|fetch/i.test(err.message)) {
    return "Cannot reach the server.";
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return fallback;
}

export default function Whatsapp() {
  const [whatsappNumber, setWhatsappNumber] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [status, setStatus] = useState("checking");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const qrTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The polling effect below fills this in. Calling it re-checks status RIGHT NOW
  // instead of waiting for the next scheduled tick — used right after logout.
  const forceRefreshRef = useRef<() => void>(() => {});

  const fetchStatus = useCallback(async (): Promise<StatusData> => {
    const res = await fetch(`${API}/whatsapp/status`, { credentials: "include" });
    if (!res.ok) throw new Error(`status ${res.status}`);
    return res.json();
  }, []);

  const fetchQr = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    if (!silent) setErrorMessage(null);
    try {
      const res = await fetch(`${API}/whatsapp/qr`, { credentials: "include" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? `QR request failed (${res.status})`);
      }
      const data = await res.json();

      if (data.status === "qr" && data.qr) {
        setQr(data.qr);
        if (qrTimerRef.current) clearTimeout(qrTimerRef.current);
        qrTimerRef.current = setTimeout(() => setQr(null), QR_TTL);
      } else {
        setQr(null);
        // Backend responded but no QR available (e.g. already connected / timed out).
        if (!silent && data.message) {
          setErrorMessage(data.message);
        }
      }
    } catch (err) {
      console.error("Failed to get QR:", err);
      if (!silent) setErrorMessage(friendlyError(err, "Could not load QR"));
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  /* ---------- log out, clear the screen right away, then let the next status check confirm it ---------- */
  const handleLogout = useCallback(async () => {
    setLoggingOut(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`${API}/whatsapp/logout`, { method: "DELETE", credentials: "include" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? `Logout failed (${res.status})`);
      }

      // Don't sit and wait for the next scheduled poll (could be up to POLL_CONNECTED = 30s
      // away) to notice we logged out — clear the screen immediately...
      if (qrTimerRef.current) clearTimeout(qrTimerRef.current);
      setQr(null);
      setWhatsappNumber(null);
      setStatus("not_started");

      // ...then ask the backend to confirm right now. The server stays the source of truth;
      // this optimistic update is only there so the button doesn't feel like it did nothing.
      forceRefreshRef.current();
    } catch (err) {
      console.error("Failed to log out:", err);
      setErrorMessage(friendlyError(err, "Could not log out"));
    } finally {
      setLoggingOut(false);
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
        lastStatus = data.state ?? "checking";
        setStatus(lastStatus);
        setWhatsappNumber(data.whatsappNumber ?? null);
      } catch (err) {
        if (!cancelled) console.error("status poll failed:", err);
      }
      if (cancelled) return;

      const base =
        lastStatus === "open" ? POLL_CONNECTED
        : lastStatus === "qr" ? POLL_QR
        : POLL_IDLE;

      schedule(document.hidden ? Math.max(base, POLL_HIDDEN) : base);
    };

    forceRefreshRef.current = () => {
      if (timer) clearTimeout(timer);
      void run();
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
    if (status === "open") setQr(null);
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

  const isConnected = status === "open";
  const statusLabel = STATUS_LABELS[status] ?? status;

  // Generate QR only when not connected; Logout only when connected (or mid-connect).
  const canGenerateQr = !isConnected && status !== "checking";
  const canLogout = isConnected || status === "connecting" || status === "qr";

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

        <div className={style.actions}>
          <span className={`${style.status} ${isConnected ? style.statusOpen : style.statusClosed}`}>
            {statusLabel}
          </span>

          <span className={style.numberBadge}>{whatsappNumber ?? "No number linked"}</span>

          <button
            className={`${style.button} ${style.buttonPrimary}`}
            onClick={() => void fetchQr()}
            disabled={loading || !canGenerateQr}
            title={!canGenerateQr ? "Already connected — log out first to generate a new QR" : undefined}
          >
            {loading ? "Loading..." : "Generate QR"}
          </button>

          <button
            className={`${style.button} ${style.buttonDanger}`}
            onClick={() => void handleLogout()}
            disabled={loggingOut || !canLogout}
            title={!canLogout ? "Nothing to log out of" : undefined}
          >
            {loggingOut ? "Logging out..." : "Logout"}
          </button>
        </div>
      </header>

      {errorMessage && <p className={style.errorText}>{errorMessage}</p>}

      {qr && (
        <div className={style.qrCard}>
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