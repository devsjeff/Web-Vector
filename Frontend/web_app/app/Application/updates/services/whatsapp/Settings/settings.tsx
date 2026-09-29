"use client";

import { useState } from "react";
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

interface ConfigFieldProps {
  label: string;
  options: Option[];
  value: FieldState;
  onChange: (next: FieldState) => void;
  placeholder?: string;
}

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

function ConfigField({ label, options, value, onChange, placeholder }: ConfigFieldProps) {
  const isCustom = value.mode === "custom";

  return (
    <div className={styles.field}>
      <label className={styles.label}>{label}</label>

      <select
        className={styles.select}
        value={value.mode}
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
          className={styles.textarea}
          type="text"
          value={value.customText}
          onChange={(event) =>
            onChange({
              ...value,
              customText: event.target.value,
            })
          }
          placeholder={placeholder}
        />
      )}
    </div>
  );
}

export default function ConfigCard({
  onClose,
  onUpdate,
}: {
  onClose: () => void;
  onUpdate: (config: WhatsappBotConfig) => void;
}) {
  const [config, setConfig] = useState<WhatsappBotConfig>(DEFAULT_CONFIG);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");

  const updateField = (field: keyof Omit<WhatsappBotConfig, "task">) => (next: FieldState) => {
    setConfig((prev) => ({ ...prev, [field]: next }));
  };

  const handleUpdate = () => {
    setStatus("saving");
    onUpdate(config);
    setTimeout(() => setStatus("saved"), 150);
  };

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
        />
        <ConfigField
          label="Role / Identity"
          options={ROLE_OPTIONS}
          value={config.roleIdentity}
          onChange={updateField("roleIdentity")}
          placeholder="e.g. Booking assistant for Glow Salon"
        />
        <ConfigField
          label="Memory context"
          options={MEMORY_OPTIONS}
          value={config.memoryContext}
          onChange={updateField("memoryContext")}
          placeholder="Describe what should be remembered per contact"
        />
        <ConfigField
          label="Rules & instructions"
          options={RULES_OPTIONS}
          value={config.rulesInstructions}
          onChange={updateField("rulesInstructions")}
          placeholder="e.g. Never share personal details"
        />
        <ConfigField
          label="Response style"
          options={STYLE_OPTIONS}
          value={config.responseStyle}
          onChange={updateField("responseStyle")}
          placeholder="e.g. Short, friendly and uses emojis"
        />

        <div className={`${styles.field} ${styles.fieldFull}`}>
          <label className={styles.label}>Main task</label>
          <textarea
            className={styles.textarea}
            rows={3}
            placeholder="What should this assistant actually do? e.g. Book doctor appointments and answer FAQs"
            value={config.task}
            onChange={(event) =>
              setConfig((prev) => ({ ...prev, task: event.target.value }))
            }
          />
        </div>
      </div>

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
          disabled={status === "saving"}
        >
          {status === "saving" ? "Updating…" : "Update settings"}
        </button>
      </div>
    </div>
  );
}
