"use client";

import style from "./Whatsapp.module.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import ConfigCard from "./Settings/settings";

const API = "http://localhost:3001";
const CONFIG_API = "http://localhost:8000/App/whatsapp_config";

const POLL_QR = 2_000;
const POLL_IDLE = 5_000;
const POLL_CONNECTED = 30_000;
const POLL_HIDDEN = 60_000;
const QR_TTL = 16_000;

type SessionState =
  | "checking"
  | "not_started"
  | "connecting"
  | "qr"
  | "open"
  | "closed";

type StatusData = { state?: string; whatsappNumber?: string | null };
type AssistantSetup = "checking" | "defaults" | "ready" | "unavailable";

const STATUS_LABELS: Record<SessionState, string> = {
  checking: "Checking",
  not_started: "Not connected",
  connecting: "Connecting",
  qr: "Scan QR code",
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

function StatusDot({ state }: { state: SessionState }) {
  return <span className={`${style.dot} ${style[`dot_${state}`]}`} />;
}

export default function Whatsapp() {
  const [status, setStatus] = useState<SessionState>("checking");
  const [whatsappNumber, setWhatsappNumber] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [qrBusy, setQrBusy] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [settingscard, setstngcard] = useState(false);
  const [assistantSetup, setAssistantSetup] = useState<AssistantSetup>("checking");

  const forceRefreshRef = useRef<() => void>(() => {});
  const qrRef = useRef<string | null>(null);

  useEffect(() => {
    qrRef.current = qr;
  }, [qr]);

  useEffect(() => {
    if (!settingscard) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [settingscard]);

  useEffect(() => {
    let cancelled = false;

    fetch(CONFIG_API, { credentials: "include" })
      .then((response) => {
        if (!response.ok) throw new Error(`Configuration check failed (${response.status})`);
        return response.json();
      })
      .then((data) => {
        if (cancelled) return;
        setAssistantSetup(data?.configured && data.config ? "ready" : "defaults");
      })
      .catch(() => {
        if (!cancelled) setAssistantSetup("unavailable");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const fetchStatus = useCallback(async (): Promise<StatusData> => {
    const res = await fetch(`${API}/whatsapp/status`, {
      credentials: "include",
    });
    if (res.status === 401) throw new Error("You are logged out. Please sign in again.");
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
        if (lastState === "open") {
          setQr(null);
          setActionError(null);
        }
      } catch (err) {
        if (cancelled) return;
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

  const isConnected = status === "open";
  const canConnect = status === "not_started" || status === "closed";
  const canCancel = status === "connecting" || status === "qr";
  const statusLabel = STATUS_LABELS[status];
  // Once connected there is nothing to scan: never show the QR card (and never keep an old QR around).
  const showQrCard = !isConnected && (Boolean(qr) || status === "qr");

  return (
    <section className={style.container}>
      <div className={style.topGlow} />

      <header className={style.header}>
        <div className={style.heading}>
          <div className={style.iconBox} aria-hidden="true">
            <span>◔</span>
          </div>
          <div>
            <div className={style.eyebrow}>CHANNEL</div>
            <h1 className={style.title}>WhatsApp</h1>
            <p className={style.description}>
              Connect your WhatsApp account and control how your assistant
              communicates with customers.
            </p>
          </div>
        </div>

        <div className={style.headerActions}>
          <div className={style.statusPill}>
            <StatusDot state={status} />
            <span>{statusLabel}</span>
          </div>

          {isConnected && whatsappNumber && (
            <span className={style.numberPill}>{whatsappNumber}</span>
          )}

          {canConnect && (
            <button
              type="button"
              className={`${style.button} ${style.buttonPrimary}`}
              onClick={() => void fetchQr(false)}
              disabled={qrBusy}
            >
              <span>{qrBusy ? "Starting…" : "Connect WhatsApp"}</span>
              {!qrBusy && <span className={style.buttonArrow}>↗</span>}
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

      {(connectionError || actionError) && (
        <div className={style.alert} role="alert">
          <span className={style.alertIcon}>!</span>
          <span>{connectionError || actionError}</span>
        </div>
      )}

      {showQrCard ? (
        <section className={style.connectPanel}>
          <div className={style.qrSide}>
            <div className={style.qrFrame}>
              {qr ? (
                <QRCodeSVG
                  value={qr}
                  size={270}
                  level="M"
                  marginSize={3}
                  bgColor="transparent"
                  fgColor="currentColor"
                />
              ) : (
                <div className={style.qrLoading}>
                  <span className={style.spinner} />
                  <span>Preparing QR…</span>
                </div>
              )}
            </div>
          </div>

          <div className={style.connectCopy}>
            <span className={style.sectionKicker}>SECURE CONNECTION</span>
            <h2>Link your WhatsApp</h2>
            <p>
              Open WhatsApp on your phone, go to <strong>Linked devices</strong>
              , then scan this QR code.
            </p>

            <div className={style.steps}>
              <div className={style.step}>
                <span>01</span>
                <p>Open WhatsApp on your phone.</p>
              </div>
              <div className={style.step}>
                <span>02</span>
                <p>Choose Linked devices → Link a device.</p>
              </div>
              <div className={style.step}>
                <span>03</span>
                <p>Scan the QR shown here.</p>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className={style.heroCard}>
          <div>
            <span className={style.sectionKicker}>WHATSAPP CHANNEL</span>
            <h2>
              {!isConnected
                ? "Ready to connect."
                : assistantSetup === "ready"
                  ? "Your assistant is live."
                  : assistantSetup === "defaults"
                    ? "Your assistant is live with default settings."
                    : assistantSetup === "checking"
                      ? "Checking assistant setup."
                      : "WhatsApp is connected."}
            </h2>
            <p>
              {!isConnected
                ? "Connect a WhatsApp account to start using your assistant."
                : assistantSetup === "ready"
                  ? "Your WhatsApp session is active and ready to reply to messages."
                  : assistantSetup === "defaults"
                    ? "Replies use a cautious default behavior until you customize the assistant."
                    : assistantSetup === "unavailable"
                      ? "WhatsApp is linked, but assistant setup could not be checked. Open settings to verify it."
                      : "WhatsApp is linked. Checking whether assistant behavior has been saved."}
            </p>
            {isConnected && (assistantSetup === "defaults" || assistantSetup === "unavailable") && (
              <button
                type="button"
                className={`${style.button} ${style.buttonPrimary} ${style.setupButton}`}
                onClick={() => setstngcard(true)}
              >
                Customize assistant
              </button>
            )}
          </div>

          <div className={`${style.bigStatus} ${isConnected ? style.bigStatusLive : ""}`}>
            <StatusDot state={status} />
            <div>
              <strong>{isConnected ? "Live" : statusLabel}</strong>
              <span>{whatsappNumber || "No account linked"}</span>
            </div>
          </div>
        </section>
      )}

      <div className={style.sectionHeader}>
        <div>
          <span className={style.sectionKicker}>WORKSPACE</span>
          <h2>Manage your assistant</h2>
        </div>
        <span className={style.sectionHint}>2 controls available</span>
      </div>

      <div className={style.grid}>
        <button
          type="button"
          className={`${style.card} ${style.cardInteractive}`}
          onClick={() => setstngcard(true)}
        >
          <div className={`${style.cardIcon} ${style.cardIconAccent}`}>✦</div>
          <div className={style.cardContent}>
            <div className={style.cardTop}>
              <span className={style.cardLabel}>AUTOMATION</span>
              <span className={style.cardChevron}>↗</span>
            </div>
            <h3>Assistant behavior</h3>
            <p>
              Set language, role, memory, rules, response style and the main
              task for your WhatsApp assistant.
            </p>
          </div>
        </button>

        <button type="button" className={`${style.card} ${style.cardInteractive}`}>
          <div className={style.cardIcon}>⌁</div>
          <div className={style.cardContent}>
            <div className={style.cardTop}>
              <span className={style.cardLabel}>Tools</span>
              <span className={style.cardChevron}>↗</span>
            </div>
            <p>
              A space for future controls such as calender , limits, schedules
              and other WhatsApp automations.
            </p>
          </div>
        </button>
      </div>

      <div className={style.footerNote}>
        <span className={style.footerDot} />
        <span>Session status updates automatically</span>
      </div>

      {settingscard && (
        <div
          className={style.modalBackdrop}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setstngcard(false);
          }}
        >
          <div
            className={style.modal}
            role="dialog"
            aria-modal="true"
            aria-label="Automation settings"
          >
            <ConfigCard
              onUpdate={() => {
                setAssistantSetup("ready");
                setstngcard(false);
              }}
              onClose={() => setstngcard(false)}
            />
          </div>
        </div>
      )}
    </section>
  );
}
