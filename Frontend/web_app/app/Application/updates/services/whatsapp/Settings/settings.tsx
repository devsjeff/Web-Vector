"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./ConfigCard.module.css";

export interface FieldState {
  mode: string;
  customText: string;
}

export interface WhatsappBotConfig {
  language: FieldState;
  roleIdentity: FieldState;
  memoryContext: FieldState;
  rulesInstructions: FieldState;
  responseStyle: FieldState;
  task: string;
}

interface Option {
  value: string;
  label: string;
}

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type FieldKey =
  | "language"
  | "roleIdentity"
  | "memoryContext"
  | "rulesInstructions"
  | "responseStyle";

type ConfigKey = FieldKey | "task";

type FieldErrors = Partial<Record<ConfigKey, string>>;

interface SubmitError {
  status?: number;
  message: string;
  fieldErrors?: FieldErrors;
}

interface ConfigFieldProps {
  label: string;
  options: Option[];
  value: FieldState;
  onChange: (next: FieldState) => void;
  placeholder?: string;
  error?: string;
}

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const API_URL = "http://localhost:8000/App/whatsapp_config";
const REQUEST_TIMEOUT_MS = 15_000;

const LANGUAGE_OPTIONS: Option[] = [
  { value: "english", label: "English" },
  { value: "hinglish", label: "Hinglish" },
  { value: "hindi", label: "Hindi" },
  { value: "as_per_sender", label: "As per sender (flexible)" },
  { value: "custom", label: "Custom..." },
];

const ROLE_OPTIONS: Option[] = [
  { value: "personal", label: "Personal assistant" },
  { value: "doctor_booking", label: "Doctor booking assistant" },
  { value: "real_estate", label: "Real estate assistant" },
  { value: "custom", label: "Custom..." },
];

const MEMORY_OPTIONS: Option[] = [
  { value: "default", label: "Default (auto memory)" },
  { value: "custom", label: "Custom..." },
];

const RULES_OPTIONS: Option[] = [
  { value: "default", label: "Default" },
  { value: "custom", label: "Custom..." },
];

const STYLE_OPTIONS: Option[] = [
  { value: "default", label: "Default" },
  { value: "friendly", label: "Nice / friendly" },
  { value: "sarcastic", label: "Sarcastic" },
  { value: "neutral", label: "Neutral / mid" },
  { value: "cool", label: "Cool" },
  { value: "custom", label: "Custom..." },
];

const emptyField = (mode: string): FieldState => ({ mode, customText: "" });

const DEFAULT_CONFIG: WhatsappBotConfig = {
  language: emptyField("english"),
  roleIdentity: emptyField("personal"),
  memoryContext: emptyField("default"),
  rulesInstructions: emptyField("default"),
  responseStyle: emptyField("default"),
  task: "",
};

const FIELD_KEYS: FieldKey[] = [
  "language",
  "roleIdentity",
  "memoryContext",
  "rulesInstructions",
  "responseStyle",
];

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Maps whatever the backend calls a field to our internal key. */
const FIELD_ALIASES: Record<string, ConfigKey> = {
  language: "language",
  lang: "language",
  role: "roleIdentity",
  role_identity: "roleIdentity",
  roleidentity: "roleIdentity",
  identity: "roleIdentity",
  memory: "memoryContext",
  memory_context: "memoryContext",
  memorycontext: "memoryContext",
  rules: "rulesInstructions",
  rules_instructions: "rulesInstructions",
  rulesinstructions: "rulesInstructions",
  instructions: "rulesInstructions",
  style: "responseStyle",
  response_style: "responseStyle",
  responsestyle: "responseStyle",
  task: "task",
  main_task: "task",
  maintask: "task",
};

/** Server data -> a complete config (any missing / broken field falls back to the default). */
function mergeConfig(saved: Partial<Record<ConfigKey, unknown>>): WhatsappBotConfig {
  const field = (key: FieldKey): FieldState => {
    const value = saved[key] as Partial<FieldState> | undefined;
    if (!value || typeof value.mode !== "string") return DEFAULT_CONFIG[key];
    return { mode: value.mode, customText: typeof value.customText === "string" ? value.customText : "" };
  };

  return {
    language: field("language"),
    roleIdentity: field("roleIdentity"),
    memoryContext: field("memoryContext"),
    rulesInstructions: field("rulesInstructions"),
    responseStyle: field("responseStyle"),
    task: typeof saved.task === "string" ? saved.task : "",
  };
}

function buildPayload(config: WhatsappBotConfig) {
  return {
    language: config.language,
    roleIdentity: config.roleIdentity,
    memoryContext: config.memoryContext,
    rulesInstructions: config.rulesInstructions,
    responseStyle: config.responseStyle,
    task: config.task.trim(),
  };
}

/** Cheap client-side check so we don't waste a round-trip. */
function validate(config: WhatsappBotConfig): FieldErrors {
  const errors: FieldErrors = {};

  for (const key of FIELD_KEYS) {
    const field = config[key];
    if (field.mode === "custom" && !field.customText.trim()) {
      errors[key] = "Please describe your custom option.";
    }
  }

  if (!config.task.trim()) {
    errors.task = "Please describe the assistant's main task.";
  }

  return errors;
}

/** Pulls `{ errors: { field: ["msg"] } }` / `{ fieldErrors: {...} }` out of a body. */
function extractFieldErrors(payload: unknown): FieldErrors | undefined {
  if (!payload || typeof payload !== "object") return undefined;

  const record = payload as Record<string, unknown>;
  const source = (record.errors ?? record.fieldErrors ?? record.field_errors) as
    | Record<string, unknown>
    | undefined;

  if (!source || typeof source !== "object") return undefined;

  const out: FieldErrors = {};

  for (const [rawKey, rawValue] of Object.entries(source)) {
    // Supports "language", "language.mode", "role_identity", ...
    const normalized = rawKey.toLowerCase().split(".")[0];
    const field = FIELD_ALIASES[normalized];
    if (!field) continue;

    const message = Array.isArray(rawValue)
      ? String(rawValue[0])
      : typeof rawValue === "string"
        ? rawValue
        : undefined;

    if (message && !out[field]) out[field] = message;
  }

  return Object.keys(out).length ? out : undefined;
}

const STATUS_FALLBACK: Record<number, string> = {
  400: "Some of the details we sent were invalid.",
  401: "Your session has expired. Please sign in again.",
  403: "You don't have permission to change these settings.",
  404: "The configuration endpoint could not be found.",
  405: "This action isn't allowed on the server.",
  408: "The server took too long to respond. Please try again.",
  409: "These settings were changed elsewhere. Reload and try again.",
  413: "The configuration is too large to save.",
  422: "Some fields need your attention.",
  429: "Too many requests. Please wait a moment and try again.",
};

/** Turns a non-2xx response into a message + optional per-field errors. */
async function describeError(
  response: Response,
): Promise<{ message: string; fieldErrors?: FieldErrors }> {
  let payload: unknown = null;

  const raw = await response.text().catch(() => "");
  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = raw; // plain-text error body
    }
  }

  const fieldErrors = extractFieldErrors(payload);

  let serverMessage = "";
  if (typeof payload === "string") {
    serverMessage = payload.trim();
  } else if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const candidate = record.message ?? record.error ?? record.detail ?? record.msg;
    if (typeof candidate === "string") serverMessage = candidate.trim();
  }

  // Don't show raw HTML error pages.
  if (serverMessage.startsWith("<")) serverMessage = "";

  let message = serverMessage;

  if (!message && response.status === 422 && fieldErrors) {
    message = STATUS_FALLBACK[422];
  }

  if (!message) {
    if (response.status >= 500) {
      message =
        response.status === 503
          ? "The service is temporarily unavailable. Please try again shortly."
          : "The server ran into a problem. Please try again in a moment.";
    } else {
      message =
        STATUS_FALLBACK[response.status] ??
        `Request failed (HTTP ${response.status}).`;
    }
  }

  return { message, fieldErrors };
}

/* ------------------------------------------------------------------ */
/* Field                                                               */
/* ------------------------------------------------------------------ */

function ConfigField({
  label,
  options,
  value,
  onChange,
  placeholder,
  error,
}: ConfigFieldProps) {
  const isCustom = value.mode === "custom";
  const errorId = `field-error-${label.replace(/\W+/g, "-").toLowerCase()}`;

  return (
    <div className={styles.field}>
      <label className={styles.label}>{label}</label>

      <select
        className={`${styles.select} ${error ? styles.inputError : ""}`}
        value={value.mode}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) =>
          onChange({
            ...value,
            mode: event.target.value,
          })
        }
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {isCustom && (
        <input
          className={`${styles.textarea} ${error ? styles.inputError : ""}`}
          type="text"
          value={value.customText}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) =>
            onChange({
              ...value,
              customText: event.target.value,
            })
          }
          placeholder={placeholder}
        />
      )}

      {error && (
        <p id={errorId} className={styles.fieldError} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */

export default function ConfigCard({
  onClose,
  onUpdate,
  onUnauthorized,
}: {
  onClose: () => void;
  onUpdate: (config: WhatsappBotConfig) => void;
  /** Optional: called on 401 so the parent can redirect to login. */
  onUnauthorized?: () => void;
}) {
  const [config, setConfig] = useState<WhatsappBotConfig>(DEFAULT_CONFIG);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<SubmitError | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const savedTimerRef = useRef<number | null>(null);

  const [loading, setLoading] = useState(true);

  // Load the settings this user saved before, so the card does not start from the defaults every time.
  useEffect(() => {
    const controller = new AbortController();

    fetch(API_URL, { credentials: "include", signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.configured && data.config) setConfig(mergeConfig(data.config));
      })
      .catch(() => {}) // no saved settings / server down -> just keep the defaults
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, []);

  // Abort any in-flight request on unmount + clear timers.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (savedTimerRef.current) window.clearTimeout(savedTimerRef.current);
    };
  }, []);

  const clearFieldError = (field: ConfigKey) => {
    setError((prev) => {
      if (!prev?.fieldErrors?.[field]) return prev;
      const nextFieldErrors = { ...prev.fieldErrors };
      delete nextFieldErrors[field];
      return { ...prev, fieldErrors: nextFieldErrors };
    });
  };

  const updateField = (field: FieldKey) => (next: FieldState) => {
    setConfig((prev) => ({ ...prev, [field]: next }));
    clearFieldError(field);
  };

  const handleUpdate = async () => {
    if (status === "saving" || loading) return;

    // 1. Client-side validation
    const clientErrors = validate(config);
    if (Object.keys(clientErrors).length > 0) {
      setError({
        message: "Please fix the highlighted fields before updating.",
        fieldErrors: clientErrors,
      });
      return;
    }

    // 2. Fire the request
    setStatus("saving");
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    let timedOut = false;
    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include", // send session cookies; drop if you use a bearer token
        body: JSON.stringify(buildPayload(config)),
        signal: controller.signal,
      });

      if (!response.ok) {
        const { message, fieldErrors } = await describeError(response);

        if (response.status === 401) {
          onUnauthorized?.();
        }

        setError({ status: response.status, message, fieldErrors });
        setStatus("idle");
        return;
      }

      // Success — 200 / 201 / 204 all fine.
      onUpdate(config);
      setStatus("saved");

      if (savedTimerRef.current) window.clearTimeout(savedTimerRef.current);
      savedTimerRef.current = window.setTimeout(() => setStatus("idle"), 2000);
    } catch (err) {
      // Superseded by a newer request — stay quiet.
      if (!timedOut && (err as { name?: string })?.name === "AbortError") {
        return;
      }

      if (timedOut) {
        setError({
          message: "The request timed out. Please check your connection and try again.",
        });
      } else {
        setError({
          message:
            "Couldn't reach the server. Check your connection (or that the FastAPI server is running on localhost:8000) and try again.",
        });
      }

      setStatus("idle");
    } finally {
      window.clearTimeout(timeoutId);
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  const fieldErrors = error?.fieldErrors;

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div>
          <div className={styles.titleRow}>
            <span className={styles.headerIcon}>✦</span>
            <h3 className={styles.title}>Assistant behavior</h3>
          </div>
          <p className={styles.subtitle}>
            Configure how your WhatsApp assistant talks, remembers and acts.
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close settings"
          className={styles.closeButton}
        >
          X
        </button>
      </div>

      <div className={styles.body}>
        <ConfigField
          label="Language"
          options={LANGUAGE_OPTIONS}
          value={config.language}
          onChange={updateField("language")}
          placeholder="e.g. Reply in Marathi mixed with English"
          error={fieldErrors?.language}
        />
        <ConfigField
          label="Role / Identity"
          options={ROLE_OPTIONS}
          value={config.roleIdentity}
          onChange={updateField("roleIdentity")}
          placeholder="e.g. Booking assistant for Glow Salon"
          error={fieldErrors?.roleIdentity}
        />
        <ConfigField
          label="Memory context"
          options={MEMORY_OPTIONS}
          value={config.memoryContext}
          onChange={updateField("memoryContext")}
          placeholder="Describe what should be remembered per contact"
          error={fieldErrors?.memoryContext}
        />
        <ConfigField
          label="Rules & instructions"
          options={RULES_OPTIONS}
          value={config.rulesInstructions}
          onChange={updateField("rulesInstructions")}
          placeholder="e.g. Never share personal details"
          error={fieldErrors?.rulesInstructions}
        />
        <ConfigField
          label="Response style"
          options={STYLE_OPTIONS}
          value={config.responseStyle}
          onChange={updateField("responseStyle")}
          placeholder="e.g. Short, friendly and uses emojis"
          error={fieldErrors?.responseStyle}
        />

        <div className={`${styles.field} ${styles.fieldFull}`}>
          <label className={styles.label}>Main task</label>
          <textarea
            className={`${styles.textarea} ${fieldErrors?.task ? styles.inputError : ""}`}
            rows={3}
            placeholder="What should this assistant actually do? e.g. Book doctor appointments and answer FAQs"
            value={config.task}
            aria-invalid={Boolean(fieldErrors?.task)}
            aria-describedby={fieldErrors?.task ? "field-error-main-task" : undefined}
            onChange={(event) => {
              setConfig((prev) => ({ ...prev, task: event.target.value }));
              clearFieldError("task");
            }}
          />
          {fieldErrors?.task && (
            <p id="field-error-main-task" className={styles.fieldError} role="alert">
              {fieldErrors.task}
            </p>
          )}
        </div>
      </div>

      {/* Global error banner (401 / 403 / 422 / 5xx / network) */}
      {error && (
        <div
          className={`${styles.banner} ${
            error.status === 401 || error.status === 403
              ? styles.bannerAuth
              : error.status && error.status >= 500
                ? styles.bannerServer
                : styles.bannerWarning
          }`}
          role="alert"
          aria-live="assertive"
        >
          <span className={styles.bannerIcon}>
            {error.status === 401 || error.status === 403
              ? "🔒"
              : error.status && error.status >= 500
                ? "⚠️"
                : "!"}
          </span>
          <span className={styles.bannerText}>
            {error.message}
            {error.status ? (
              <span className={styles.bannerStatus}> (HTTP {error.status})</span>
            ) : null}
          </span>
          <button
            type="button"
            className={styles.bannerClose}
            onClick={() => setError(null)}
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      <div className={styles.footer}>
        <span className={styles.footerHint}>
          Changes apply when you update the configuration.
        </span>

        {status !== "idle" && (
          <span className={styles.status}>
            {status === "saving" ? "Saving…" : "Saved"}
          </span>
        )}

        <button
          type="button"
          className={styles.button}
          onClick={handleUpdate}
          disabled={status === "saving" || loading}
        >
          {status === "saving" ? "Updating…" : loading ? "Loading…" : "Update settings"}
        </button>
      </div>
    </div>
  );
}