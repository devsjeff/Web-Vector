"use client";

import style from "./Whatsapp.module.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

import ConfigCard, { WhatsappBotConfig } from "./Settings/settings";

const API = "http://localhost:3001";

const POLL_QR = 2_000;
const POLL_IDLE = 5_000;
const POLL_CONNECTED = 30_000;
const POLL_HIDDEN = 60_000;
const QR_TTL = 16_000;

/*
 * The backend (Fastify + Baileys) sends `state` on GET /whatsapp/status.
 * Real values: "not_started" | "connecting" | "qr" | "open" | "closed".
 * Anything else is treated as "closed" so the UI always ends up in a known state.
 */
type SessionState =
  | "checking"
  | "not_started"
  | "connecting"
  | "qr"
  | "open"
  | "closed";

type StatusData = { state?: string; whatsappNumber?: string | null };

const STATUS_LABELS: Record<SessionState, string> = {
  checking: "Checking…",
  not_started: "Not connected",
  connecting: "Connecting…",
  qr: "Scan the QR code",
  open: "Connected",
  closed: "Disconnected",
};

const KNOWN_STATES: readonly SessionState[] = [
  "not_started",
  "connecting",
  "qr",
  "open",
  "closed",
];

function normalizeState(raw: string | undefined): SessionState {
  return KNOWN_STATES.includes(raw as SessionState)
    ? (raw as SessionState)
    : "closed";
}

function friendlyError(err: unknown, fallback: string): string {
  if (err instanceof TypeError && /network|fetch/i.test(err.message)) {
    return "Cannot reach the server.";
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

async function readErrorMessage(res: Response, fallback: string) {
  const body = await res.json().catch(() => null);
  return body?.message ?? fallback;
}

export default function Whatsapp() {
  const [status, setStatus] = useState<SessionState>("checking");
  const [whatsappNumber, setWhatsappNumber] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [qrBusy, setQrBusy] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Renamed from settingscard/setstngcard — same idea (is the settings panel
  // open or not), just spelled properly so it doesn't look like a typo later.
  const [showSettings, setShowSettings] = useState(false);

  // Lets the logout handler kick the poll loop without waiting for the next tick.
  const forceRefreshRef = useRef<() => void>(() => {});

  // Used inside the silent QR refresh to decide whether a failure is worth showing.
  const qrRef = useRef<string | null>(null);
  useEffect(() => {
    qrRef.current = qr;
  }, [qr]);

  /* ------------------------------------------------------------------ API -- */

  const fetchStatus = useCallback(async (): Promise<StatusData> => {
    const res = await fetch(`${API}/whatsapp/status`, {
      credentials: "include",
    });
    if (!res.ok) throw new Error(`Status check failed (${res.status})`);
    return res.json();
  }, []);

  const fetchQr = useCallback(async (silent = false) => {
    if (!silent) {
      setQrBusy(true);
      setActionError(null);
    }
    try {
      const res = await fetch(`${API}/whatsapp/qr`, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(
          await readErrorMessage(res, `QR request failed (${res.status})`),
        );
      }
      const data = await res.json();

      if (data?.status === "qr" && data.qr) {
        setQr(data.qr);
      } else {
        setQr(null);
        if (!silent && data?.message) setActionError(data.message);
      }
    } catch (err) {
      console.error("Failed to get QR:", err);
      // A silent background refresh may fail quietly — but if there is no QR
      // on screen yet, the user needs to know something is wrong.
      if (!silent || !qrRef.current) {
        setActionError(friendlyError(err, "Could not load the QR code"));
      }
    } finally {
      if (!silent) setQrBusy(false);
    }
  }, []);

  const handleLogout = useCallback(async () => {
    setLoggingOut(true);
    setActionError(null);
    try {
      const res = await fetch(`${API}/whatsapp/logout`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(
          await readErrorMessage(res, `Logout failed (${res.status})`),
        );
      }

      // Clear the screen straight away so the click feels instant; the server
      // remains the source of truth and we ask it to confirm right after.
      setQr(null);
      setWhatsappNumber(null);
      setStatus("not_started");
      forceRefreshRef.current();
    } catch (err) {
      console.error("Failed to log out:", err);
      setActionError(friendlyError(err, "Could not log out"));
    } finally {
      setLoggingOut(false);
    }
  }, []);

  // NEW: this is what was missing before — Update button on the config card
  // used to just close the panel and throw the data away. Now it actually
  // posts to the backend, following the exact same fetch/error pattern as
  // the rest of this file (credentials include, readErrorMessage, friendlyError).
  const handleConfigUpdate = useCallback(async (config: WhatsappBotConfig) => {
    setActionError(null);
    try {
      const res = await fetch(`${API}/whatsapp/config`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) {
        throw new Error(
          await readErrorMessage(res, `Saving settings failed (${res.status})`),
        );
      }
      setShowSettings(false);
    } catch (err) {
      console.error("Failed to save settings:", err);
      setActionError(friendlyError(err, "Could not save settings"));
    }
  }, []);

  /* --------------------------------------------------- status polling loop -- */

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastState: SessionState = "checking";

    const schedule = (ms: number) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(run, ms);
    };

    const run = async () => {
      try {
        const data = await fetchStatus();
        if (cancelled) return;

        lastState = normalizeState(data.state);
        setStatus(lastState);
        setWhatsappNumber(data.whatsappNumber ?? null);
        setConnectionError(null);
      } catch (err) {
        if (cancelled) return;
        console.error("Status poll failed:", err);
        setConnectionError(
          friendlyError(err, "Lost connection to the server."),
        );
      }
      if (cancelled) return;

      const base =
        lastState === "open"
          ? POLL_CONNECTED
          : lastState === "qr"
            ? POLL_QR
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
        void run();
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

  /* -------------------------------------------------- keep the QR up to date */

  // While the backend is showing a QR, refresh it every QR_TTL ms. WhatsApp QR
  // codes are short-lived; leaving a stale one on screen is worse than none.
  // Self-scheduling so a failed fetch is retried on the next tick.
  useEffect(() => {
    if (status !== "qr") return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      await fetchQr(true);
      if (cancelled) return;
      timer = setTimeout(tick, QR_TTL);
    };

    void tick();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [status, fetchQr]);

  // Drop the QR as soon as we are no longer waiting for a scan.
  useEffect(() => {
    if (status !== "qr" && status !== "connecting") setQr(null);
  }, [status]);

  /* ------------------------------------------------------------- derived --- */

  const isConnected = status === "open";
  const canConnect = status === "not_started" || status === "closed";
  const canCancel = status === "connecting" || status === "qr";
  const statusLabel = STATUS_LABELS[status] ?? status;
  const showQrCard = Boolean(qr) || status === "qr";

  /* -------------------------------------------------------------- render --- */

  return (
    <section className={style.container}>
      <header className={style.header}>
        <div>
          <p className={style.eyebrow}>Connected service</p>
          <h1 className={style.title}>WhatsApp</h1>
          <p className={style.description}>
            Link a WhatsApp account and manage the automation that runs through
            this service.
          </p>
        </div>

        <div className={style.actions}>
          <span
            className={`${style.status} ${
              isConnected ? style.statusOpen : style.statusClosed
            }`}
          >
            {statusLabel}
          </span>

          {isConnected && whatsappNumber && (
            <span className={style.numberBadge}>{whatsappNumber}</span>
          )}

          {canConnect && (
            <button
              type="button"
              className={`${style.button} ${style.buttonPrimary}`}
              onClick={() => void fetchQr(false)}
              disabled={qrBusy}
            >
              {qrBusy ? "Starting…" : "Connect WhatsApp"}
            </button>
          )}

          {status === "qr" && (
            <button
              type="button"
              className={`${style.button} ${style.buttonPrimary}`}
              onClick={() => void fetchQr(false)}
              disabled={qrBusy}
            >
              {qrBusy ? "Refreshing…" : "Refresh QR"}
            </button>
          )}

          {(isConnected || canCancel) && (
            <button
              type="button"
              className={`${style.button} ${style.buttonDanger}`}
              onClick={() => void handleLogout()}
              disabled={loggingOut}
              title={
                isConnected
                  ? "Log out of WhatsApp"
                  : "Cancel this connection attempt"
              }
            >
              {loggingOut
                ? isConnected
                  ? "Logging out…"
                  : "Cancelling…"
                : isConnected
                  ? "Logout"
                  : "Cancel"}
            </button>
          )}
        </div>
      </header>

      {connectionError && (
        <p className={style.errorText} role="alert">
          {connectionError}
        </p>
      )}

      {actionError && (
        <p className={style.errorText} role="alert">
          {actionError}
        </p>
      )}

      {showQrCard && (
        <div className={style.qrCard}>
          {qr ? (
            <QRCodeSVG value={qr} size={300} level="M" marginSize={4} />
          ) : (
            <p className={style.cardMuted}>Loading QR code…</p>
          )}
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

          {/* There used to be two identical buttons here (copy-paste leftover)
              — only one does anything useful, so the duplicate is gone. */}
          <button
            type="button"
            className={style.g3hr8hehf}
            onClick={() => setShowSettings(true)}
          >
            <p className={style.cardValue}>Automation settings</p>
            <p className={style.cardMuted}>
              This is where your future WhatsApp controls can live.
            </p>
          </button>
        </article>
      </div>

      {/* Settings overlay — only exists in the DOM while showSettings is true.
          Before, this whole block (including the close button) was always
          rendered, sitting at the bottom of the page even when "closed". */}
      {showSettings && (
        <div className={style.settingCard}>
          <div className={style.settingCardPanel}>
            <button
              type="button"
              className={style.settingCardClose}
              onClick={() => setShowSettings(false)}
            >
              Close
            </button>
            <ConfigCard onUpdate={handleConfigUpdate} />
          </div>
        </div>
      )}
    </section>
  );
}