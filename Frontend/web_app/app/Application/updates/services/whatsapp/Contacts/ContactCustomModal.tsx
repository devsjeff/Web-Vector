"use client";

import { useEffect, useState } from "react";
import styles from "./ContactCustomModal.module.css";

import { detectRelationship } from "./ContactManager";

interface ContactCustomModalProps {
  whatsappNumber: string;
  initialContactName?: string;
  onClose: () => void;
  onSaved: () => void;
}

interface PgMemory {
  id: number;
  memoryText: string;
  createdAt?: string;
}

const TONES = [
  { id: "sarcastic", icon: "🎭", title: "Sarcastic", desc: "Dry humor, witty banter, and playful sarcasm" },
  { id: "roast", icon: "🔥", title: "Playful Roast", desc: "Friendly roasts, comebacks, and heavy teasing" },
  { id: "witty", icon: "⚡", title: "Witty", desc: "Quick-witted smart banter and clever remarks" },
  { id: "boss", icon: "👔", title: "Boss / Executive", desc: "Utmost respect, prompt, structured executive updates" },
  { id: "love", icon: "❤️", title: "Loved One", desc: "Deeply affectionate, warm, caring and gentle tone" },
  { id: "friendly", icon: "🤝", title: "Friendly", desc: "Warm, casual, kind and helpful friend" },
  { id: "cool", icon: "😎", title: "Cool", desc: "Relaxed, casual, short confident answers" },
  { id: "formal", icon: "💼", title: "Professional", desc: "Polite, structured, corporate style" },
];

export default function ContactCustomModal({
  whatsappNumber,
  initialContactName = "",
  onClose,
  onSaved,
}: ContactCustomModalProps) {
  const [activeTab, setActiveTab] = useState<"persona" | "memory">("persona");
  const [enabled, setEnabled] = useState(true);
  const [contactName, setContactName] = useState(initialContactName);
  const [toneStyle, setToneStyle] = useState("sarcastic");
  const [task, setTask] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  // Memory states
  const [memories, setMemories] = useState<PgMemory[]>([]);
  const [newMemoryText, setNewMemoryText] = useState("");
  const [memSearchQuery, setMemSearchQuery] = useState("");
  const [memBusy, setMemBusy] = useState(false);

  // Load existing contact settings
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch(`http://localhost:8000/App/contact_config?number=${encodeURIComponent(whatsappNumber)}`, {
      credentials: "include",
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data?.config) {
          setEnabled(data.config.enabled ?? true);
          if (data.config.contactName) setContactName(data.config.contactName);
          if (data.config.toneStyle) setToneStyle(data.config.toneStyle);
          if (data.config.task) setTask(data.config.task);
          if (data.config.notes) setNotes(data.config.notes);
        } else {
          // If no custom config, default enabled=false to indicate inheritance
          setEnabled(false);
        }
      })
      .catch((e) => console.error("Error loading contact config:", e))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [whatsappNumber]);

  // Load PgVector memories for this number
  const loadMemories = async (query = "") => {
    try {
      setMemBusy(true);
      const url = query.trim()
        ? `http://localhost:8000/App/memories?number=${encodeURIComponent(whatsappNumber)}&query=${encodeURIComponent(query.trim())}`
        : `http://localhost:8000/App/memories?number=${encodeURIComponent(whatsappNumber)}`;
      const res = await fetch(url, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setMemories(data.memories || []);
      }
    } catch (e) {
      console.error("Error fetching memories:", e);
    } finally {
      setMemBusy(false);
    }
  };

  useEffect(() => {
    if (activeTab === "memory") {
      void loadMemories();
    }
  }, [activeTab, whatsappNumber]);

  const handleSave = async () => {
    setSaving(true);
    setStatusMsg("");

    try {
      const res = await fetch("http://localhost:8000/App/contact_config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          whatsappNumber,
          contactName: contactName.trim(),
          enabled,
          toneStyle,
          task: task.trim(),
          notes: notes.trim(),
        }),
      });

      if (!res.ok) throw new Error("Failed to save contact settings");

      setStatusMsg("Settings saved successfully!");
      onSaved();
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      alert(err.message || "Could not save custom settings");
    } finally {
      setSaving(false);
    }
  };

  const handleRevertGlobal = async () => {
    if (!confirm("Revert this contact back to your global assistant settings?")) return;
    try {
      setSaving(true);
      await fetch(`http://localhost:8000/App/contact_config?number=${encodeURIComponent(whatsappNumber)}`, {
        method: "DELETE",
        credentials: "include",
      });
      onSaved();
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleAddMemory = async () => {
    if (!newMemoryText.trim()) return;
    try {
      setMemBusy(true);
      const res = await fetch("http://localhost:8000/App/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          whatsappNumber,
          memoryText: newMemoryText.trim(),
        }),
      });
      if (res.ok) {
        setNewMemoryText("");
        await loadMemories(memSearchQuery);
      }
    } catch (e) {
      console.error("Error adding memory:", e);
    } finally {
      setMemBusy(false);
    }
  };

  const handleDeleteMemory = async (id: number) => {
    try {
      const res = await fetch(`http://localhost:8000/App/memories/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        setMemories((prev) => prev.filter((m) => m.id !== id));
      }
    } catch (e) {
      console.error("Error deleting memory:", e);
    }
  };

  return (
    <div className={styles.backdrop} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} role="dialog" aria-modal="true">
        <div className={styles.header}>
          <div className={styles.headerInfo}>
            <h2>
              <span>{contactName || "Contact Persona"}</span>
              <span className={styles.numberTag}>{whatsappNumber}</span>
            </h2>
            <p className={styles.subTitle}>
              Customize conversational tone, sarcasm, task instructions, and pgvector memory
            </p>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tab} ${activeTab === "persona" ? styles.activeTab : ""}`}
            onClick={() => setActiveTab("persona")}
          >
            ✦ Persona & Style
          </button>
          <button
            type="button"
            className={`${styles.tab} ${activeTab === "memory" ? styles.activeTab : ""}`}
            onClick={() => setActiveTab("memory")}
          >
            ◌ PgVector Memories ({memories.length})
          </button>
        </div>

        <div className={styles.body}>
          {activeTab === "persona" ? (
            <>
              <div className={styles.toggleCard}>
                <div className={styles.toggleInfo}>
                  <strong>Apply Custom Settings for this Contact</strong>
                  <p>
                    {enabled
                      ? "Custom persona is active. Unique tone and rules will override global settings."
                      : "Inheriting global settings. Toggle on to apply unique tone (e.g. sarcasm) for this number."}
                  </p>
                </div>
                <label className={styles.switch}>
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                  />
                  <span className={styles.slider} />
                </label>
              </div>

              {enabled && (
                <>
                  <div className={styles.field}>
                    <label className={styles.label}>Contact Name (Used for Intelligent Relationship Sensing)</label>
                    <input
                      type="text"
                      className={styles.input}
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="e.g. Rahul Friend, Boss Sharma, My Love ❤️, Client Alex"
                    />
                    {contactName.trim() && (() => {
                      const rel = detectRelationship(contactName);
                      return (
                        <div style={{
                          marginTop: "8px",
                          padding: "10px 14px",
                          borderRadius: "10px",
                          background: "rgba(0, 0, 0, 0.35)",
                          border: "1px solid rgba(255, 255, 255, 0.1)",
                          display: "flex",
                          flexDirection: "column",
                          gap: "4px"
                        }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, color: "#e8ddcf", fontSize: "0.85rem" }}>
                              <span>{rel.icon}</span>
                              <span>Auto-Detected: {rel.label}</span>
                            </div>
                            {rel.category !== "normal" && toneStyle !== rel.category && (
                              <button
                                type="button"
                                style={{
                                  background: "rgba(232, 221, 207, 0.15)",
                                  border: "1px solid rgba(232, 221, 207, 0.3)",
                                  color: "#e8ddcf",
                                  padding: "3px 8px",
                                  borderRadius: "6px",
                                  fontSize: "0.72rem",
                                  cursor: "pointer"
                                }}
                                onClick={() => setToneStyle(rel.category === "friend" ? "sarcastic" : rel.category)}
                              >
                                Match Persona Tone
                              </button>
                            )}
                          </div>
                          <p style={{ margin: 0, fontSize: "0.78rem", color: "#94a3b8", lineHeight: 1.45 }}>
                            {rel.desc}
                          </p>
                          {rel.category === "friend" && (
                            <p style={{ margin: "4px 0 0", fontSize: "0.76rem", color: "#86efac" }}>
                              ✨ <strong>Dynamic Sarcasm:</strong> If your friend starts teasing or sending sarcastic banter, the assistant will automatically match their vibe and roast them back!
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label}>Speaking Style & Tone (Sarcasm, Banter, etc.)</label>
                    <div className={styles.toneGrid}>
                      {TONES.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          className={`${styles.toneOption} ${toneStyle === t.id ? styles.toneOptionSelected : ""}`}
                          onClick={() => setToneStyle(t.id)}
                        >
                          <span className={styles.icon}>{t.icon}</span>
                          <span className={styles.title}>{t.title}</span>
                          <span className={styles.desc}>{t.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label}>Custom Task / Prompt for this Number</label>
                    <textarea
                      className={styles.textarea}
                      value={task}
                      onChange={(e) => setTask(e.target.value)}
                      placeholder="e.g. Act sarcastic and tease him playfully about cricket, but answer his questions accurately."
                      rows={2}
                    />
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label}>Private Notes & Facts (Injected to LLM Context)</label>
                    <textarea
                      className={styles.textarea}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="e.g. High school friend, likes spicy food, works at Google."
                      rows={2}
                    />
                  </div>
                </>
              )}
            </>
          ) : (
            /* PgVector Memory Tab */
            <div className={styles.memoryPanel}>
              <div className={styles.field}>
                <label className={styles.label}>Semantic Search Memory (PgVector)</label>
                <div className={styles.addMemBox}>
                  <input
                    type="text"
                    className={styles.input}
                    value={memSearchQuery}
                    onChange={(e) => setMemSearchQuery(e.target.value)}
                    placeholder="Search past conversations or facts..."
                    onKeyDown={(e) => e.key === "Enter" && void loadMemories(memSearchQuery)}
                  />
                  <button
                    type="button"
                    className={styles.btnPrimary}
                    onClick={() => void loadMemories(memSearchQuery)}
                  >
                    Search
                  </button>
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Remember a New Fact (Saved with 768-dim Vector)</label>
                <div className={styles.addMemBox}>
                  <input
                    type="text"
                    className={styles.input}
                    value={newMemoryText}
                    onChange={(e) => setNewMemoryText(e.target.value)}
                    placeholder="e.g. Prefers morning appointments; favorite color is blue."
                    onKeyDown={(e) => e.key === "Enter" && void handleAddMemory()}
                  />
                  <button
                    type="button"
                    className={styles.btnPrimary}
                    onClick={handleAddMemory}
                    disabled={memBusy || !newMemoryText.trim()}
                  >
                    Save Memory
                  </button>
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Stored Memories ({memories.length})</label>
                {memories.length === 0 ? (
                  <p style={{ color: "#7f8d93", fontSize: "0.84rem", margin: "10px 0" }}>
                    No memories stored for this number yet. As you chat, conversation turns and key facts will automatically be indexed in PgVector.
                  </p>
                ) : (
                  <div className={styles.memoryList}>
                    {memories.map((m) => (
                      <div key={m.id} className={styles.memoryCard}>
                        <div>
                          <p className={styles.memoryText}>{m.memoryText}</p>
                          {m.createdAt && (
                            <span className={styles.memoryMeta}>
                              Indexed: {new Date(m.createdAt).toLocaleString()}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          className={styles.delMemBtn}
                          onClick={() => handleDeleteMemory(m.id)}
                          title="Delete memory"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <div>
            {enabled && (
              <button
                type="button"
                className={styles.btnDanger}
                onClick={handleRevertGlobal}
                disabled={saving}
              >
                Revert to Global
              </button>
            )}
            {statusMsg && <span className={styles.statusMsg}>{statusMsg}</span>}
          </div>

          <button
            type="button"
            className={styles.btnPrimary}
            onClick={handleSave}
            disabled={saving || loading}
          >
            {saving ? "Saving…" : "Save Custom Persona"}
          </button>
        </div>
      </div>
    </div>
  );
}
