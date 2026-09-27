"use client";

import { useState } from "react";
import styles from "./ConfigCard.module.css";

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------
// Har dropdown field ka ek hi shape hai: "kaunsa option chuna" (mode) +
// "agar Custom chuna to usme kya likha" (customText). Isliye ek hi type
// FieldState banaya, sab jagah reuse karenge — alag alag type nahi banane.

interface FieldState {
  mode: string;
  customText: string;
}

// Ye poora config object hai jo Update dabane par API ko jayega.
// export kiya hai taaki jis page me <ConfigCard /> use karo, wahan bhi
// isi type ka use karke onUpdate ka payload type-safe rahe.
export interface WhatsappBotConfig {
  language: FieldState;
  roleIdentity: FieldState;
  memoryContext: FieldState;
  rulesInstructions: FieldState;
  responseStyle: FieldState;
  task: string; // ye hamesha free text hai, dropdown nahi (sketch me bhi aisa hi tha)
}

interface Option {
  value: string;
  label: string;
}

// ---------------------------------------------------------------------------
// DROPDOWN OPTIONS — tumhare Excalidraw sketch se seedha liya hai
// ---------------------------------------------------------------------------

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

// Naya field banane ka helper — bas mode set karta hai, customText khaali.
const emptyField = (mode: string): FieldState => ({ mode, customText: "" });

// Card jab pehli baar khule (koi saved config na ho) to ye defaults dikhenge.
const DEFAULT_CONFIG: WhatsappBotConfig = {
  language: emptyField("english"),
  roleIdentity: emptyField("personal"),
  memoryContext: emptyField("default"),
  rulesInstructions: emptyField("default"),
  responseStyle: emptyField("default"),
  task: "",
};

// ---------------------------------------------------------------------------
// ConfigField — ek chhota reusable piece: label + dropdown + (agar "custom"
// chuna hai to) textarea. 5 fields me se har ek isi ko call karta hai, taaki
// same select/textarea code baar baar copy-paste na karna pade.
// ---------------------------------------------------------------------------

interface ConfigFieldProps {
  label: string;
  options: Option[];
  value: FieldState;
  onChange: (next: FieldState) => void;
  placeholder?: string;
}

function ConfigField({ label, options, value, onChange, placeholder }: ConfigFieldProps) {
  const isCustom = value.mode === "custom";

  return (
    <div className={styles.field}>
      <label className={styles.label}>{label}</label>

      <select className={styles.select} value={value.mode} onChange={(e) => onChange({ ...value, mode: e.target.value })}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>

      {/* Ye line hi wo "click on custom, textarea appear ho" wala kaam karti hai.
          Jab tak mode !== "custom", ye poora block DOM me render hi nahi hota. */}
      {isCustom && (
        <textarea
          className={styles.textarea}
          rows={3}
          placeholder={placeholder}
          value={value.customText}
          onChange={(e) => onChange({ ...value, customText: e.target.value })}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ConfigCard — main component
// ---------------------------------------------------------------------------

interface ConfigCardProps {
  // Agar pehle se saved config hai (DB se aayi), to yahan bhejo — card usse
  // pre-fill ho jayega. Naye contact ke liye ye prop mat do, DEFAULT_CONFIG use ho jayega.
  initialConfig?: WhatsappBotConfig;
  // Update button dabane par ye function call hoga, poore config ke saath.
  // API call yahan andar nahi hai — tum jahan <ConfigCard /> use karoge,
  // wahan apna fetch/axios call likh kar isko pass karo.
  onUpdate: (config: WhatsappBotConfig) => Promise<void> | void;
}

export default function ConfigCard({ initialConfig = DEFAULT_CONFIG, onUpdate }: ConfigCardProps) {
  const [config, setConfig] = useState<WhatsappBotConfig>(initialConfig);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");

  // Chhota trick: ek hi updater function, jo field ka naam (key) leke
  // uska apna onChange handler wapas deta hai. Isse 5 alag onChange
  // functions nahi likhne pade — ek hi jagah se sab handle ho gaya.
  const updateField = (key: keyof Omit<WhatsappBotConfig, "task">) => (next: FieldState) => {
    setConfig((prev) => ({ ...prev, [key]: next }));
  };

  const handleUpdate = async () => {
    setStatus("saving");
    await onUpdate(config);
    setStatus("saved");
    setTimeout(() => setStatus("idle"), 1500);
  };

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h3 className={styles.title}>Automation settings</h3>
        <p className={styles.subtitle}>Configure how this WhatsApp assistant talks and behaves.</p>
      </div>

      <div className={styles.body}>
        <ConfigField label="Language" options={LANGUAGE_OPTIONS} value={config.language} onChange={updateField("language")} placeholder="e.g. Reply in Marathi mixed with English" />
        <ConfigField label="Role / Identity" options={ROLE_OPTIONS} value={config.roleIdentity} onChange={updateField("roleIdentity")} placeholder="Describe who this assistant is, e.g. Booking assistant for Glow Salon" />
        <ConfigField label="Memory context" options={MEMORY_OPTIONS} value={config.memoryContext} onChange={updateField("memoryContext")} placeholder="Describe what should be remembered per contact" />
        <ConfigField label="Rules & instructions" options={RULES_OPTIONS} value={config.rulesInstructions} onChange={updateField("rulesInstructions")} placeholder="e.g. Never share personal details, always confirm before booking" />
        <ConfigField label="Response style" options={STYLE_OPTIONS} value={config.responseStyle} onChange={updateField("responseStyle")} placeholder="Describe the tone, e.g. Short, witty, uses emojis" />

        {/* Task hamesha free text hai — sketch me bhi iske aage koi dropdown nahi tha */}
        <div className={styles.field}>
          <label className={styles.label}>Task</label>
          <textarea
            className={styles.textarea}
            rows={3}
            placeholder="What should this assistant actually do? e.g. Book doctor appointments and answer FAQs"
            value={config.task}
            onChange={(e) => setConfig((prev) => ({ ...prev, task: e.target.value }))}
          />
        </div>
      </div>

      <div className={styles.footer}>
        <span className={styles.status}>{status === "saving" ? "Saving..." : status === "saved" ? "Saved" : ""}</span>
        <button type="button" className={styles.button} onClick={handleUpdate} disabled={status === "saving"}>
          {status === "saving" ? "Updating..." : "Update"}
        </button>
      </div>
    </div>
  );
}