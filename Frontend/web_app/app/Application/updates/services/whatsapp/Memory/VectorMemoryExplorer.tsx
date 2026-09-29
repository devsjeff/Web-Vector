"use client";

import { useEffect, useState } from "react";
import styles from "./VectorMemoryExplorer.module.css";

interface MemoryItem {
  id: number;
  email: string;
  whatsappNumber: string;
  senderText?: string;
  contactText?: string;
  memoryText: string;
  createdAt?: string;
}

export default function VectorMemoryExplorer() {
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterNumber, setFilterNumber] = useState("");
  const [newNumber, setNewNumber] = useState("");
  const [newMemory, setNewMemory] = useState("");
  const [busy, setBusy] = useState(false);

  const fetchMemories = async (query = "", number = "") => {
    try {
      setLoading(true);
      let url = "http://localhost:8000/App/memories?limit=50";
      if (number.trim()) url += `&number=${encodeURIComponent(number.trim())}`;
      if (query.trim()) url += `&query=${encodeURIComponent(query.trim())}`;

      const res = await fetch(url, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setMemories(data.memories || []);
      }
    } catch (e) {
      console.error("Failed to load memories:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchMemories();
  }, []);

  const handleAddMemory = async () => {
    if (!newNumber.trim() || !newMemory.trim()) return;
    try {
      setBusy(true);
      const res = await fetch("http://localhost:8000/App/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          whatsappNumber: newNumber.trim(),
          memoryText: newMemory.trim(),
        }),
      });
      if (res.ok) {
        setNewMemory("");
        await fetchMemories(searchQuery, filterNumber);
      }
    } catch (e) {
      console.error("Failed to add memory:", e);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`http://localhost:8000/App/memories/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        setMemories((prev) => prev.filter((m) => m.id !== id));
      }
    } catch (e) {
      console.error("Failed to delete memory:", e);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.headerCard}>
        <div>
          <h3>PgVector Long-Term Semantic Memory Engine</h3>
          <p>
            Every conversation turn and custom note is embedded as a 768-dimensional vector in Postgres.
            Incoming messages trigger cosine similarity vector queries to retrieve pertinent past facts.
          </p>
        </div>

        <div className={styles.statsPill}>
          <span>Dimension: <strong>768</strong></span>
          <span>Index: <strong>HNSW / Cosine</strong></span>
          <span>Entries: <strong>{memories.length}</strong></span>
        </div>
      </div>

      {/* Semantic Search & Filters */}
      <div className={styles.searchBar}>
        <input
          type="text"
          className={styles.input}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Semantic vector search e.g. 'preferred appointment time', 'pizza toppings'..."
          onKeyDown={(e) => e.key === "Enter" && void fetchMemories(searchQuery, filterNumber)}
        />
        <input
          type="text"
          className={styles.input}
          style={{ maxWidth: "200px" }}
          value={filterNumber}
          onChange={(e) => setFilterNumber(e.target.value)}
          placeholder="Filter by phone number..."
          onKeyDown={(e) => e.key === "Enter" && void fetchMemories(searchQuery, filterNumber)}
        />
        <button
          type="button"
          className={styles.btn}
          onClick={() => void fetchMemories(searchQuery, filterNumber)}
        >
          Vector Search
        </button>
      </div>

      {/* Manual Memory Indexing */}
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
        <input
          type="text"
          className={styles.input}
          style={{ maxWidth: "180px" }}
          value={newNumber}
          onChange={(e) => setNewNumber(e.target.value)}
          placeholder="Phone number"
        />
        <input
          type="text"
          className={styles.input}
          value={newMemory}
          onChange={(e) => setNewMemory(e.target.value)}
          placeholder="New memory text to embed & store in pgvector..."
          onKeyDown={(e) => e.key === "Enter" && void handleAddMemory()}
        />
        <button
          type="button"
          className={styles.btn}
          onClick={handleAddMemory}
          disabled={busy || !newNumber.trim() || !newMemory.trim()}
        >
          {busy ? "Embedding…" : "Embed & Save"}
        </button>
      </div>

      {/* Memories List */}
      {loading ? (
        <div className={styles.empty}>Loading PgVector memory bank...</div>
      ) : memories.length === 0 ? (
        <div className={styles.empty}>
          <h4>No vector memories found</h4>
          <p>Memories are automatically stored as conversations occur or when added manually above.</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {memories.map((m) => (
            <div key={m.id} className={styles.memCard}>
              <div className={styles.memContent}>
                <p className={styles.memText}>{m.memoryText}</p>
                <div className={styles.memMeta}>
                  <span>Number: {m.whatsappNumber || "Global"}</span>
                  {m.createdAt && (
                    <small>Stored: {new Date(m.createdAt).toLocaleString()}</small>
                  )}
                </div>
              </div>

              <button
                type="button"
                className={styles.delBtn}
                onClick={() => handleDelete(m.id)}
                title="Delete vector memory"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
