"use client";

import { useEffect, useState, useMemo } from "react";
import styles from "./ContactManager.module.css";
import ContactCustomModal from "./ContactCustomModal";

export interface ContactSummary {
  whatsappNumber: string;
  contactName?: string;
  chatCount: number;
  memoryCount: number;
  hasCustomConfig: boolean;
  toneStyle: string;
  lastMessage?: string;
  updatedAt?: string;
}

export default function ContactManager() {
  const [contacts, setContacts] = useState<ContactSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchNumber, setSearchNumber] = useState("");
  const [selectedContact, setSelectedContact] = useState<ContactSummary | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newNumberInput, setNewNumberInput] = useState("");
  const [newNameInput, setNewNameInput] = useState("");

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const res = await fetch("http://localhost:8000/App/contacts", {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setContacts(data.contacts || []);
      }
    } catch (e) {
      console.error("Error loading contacts:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchContacts();
  }, []);

  // Filter contacts by searched phone number or name
  const filteredContacts = useMemo(() => {
    const q = searchNumber.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (c) =>
        c.whatsappNumber.toLowerCase().includes(q) ||
        (c.contactName && c.contactName.toLowerCase().includes(q))
    );
  }, [contacts, searchNumber]);

  const handleAddNewNumber = () => {
    const cleanNum = newNumberInput.replace(/[^\d+]/g, "").trim();
    if (!cleanNum) return;

    const newContact: ContactSummary = {
      whatsappNumber: cleanNum,
      contactName: newNameInput.trim() || undefined,
      chatCount: 0,
      memoryCount: 0,
      hasCustomConfig: false,
      toneStyle: "sarcastic",
    };

    setShowAddModal(false);
    setNewNumberInput("");
    setNewNameInput("");
    setSelectedContact(newContact);
  };

  return (
    <div className={styles.container}>
      {/* Top Search & Actions */}
      <div className={styles.topBar}>
        <div className={styles.searchBox}>
          <span className={styles.searchIcon}>⌕</span>
          <input
            type="text"
            className={styles.searchInput}
            value={searchNumber}
            onChange={(e) => setSearchNumber(e.target.value)}
            placeholder="Search phone number or contact name..."
          />
        </div>

        <button
          type="button"
          className={styles.addBtn}
          onClick={() => setShowAddModal(true)}
        >
          <span>+</span>
          <span>Add / Customize Number</span>
        </button>
      </div>

      {/* Contacts List with Number of Chats */}
      {loading ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>⏳</div>
          <h4>Loading Contacts...</h4>
          <p>Retrieving phone numbers, chat statistics, and custom configurations.</p>
        </div>
      ) : filteredContacts.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📱</div>
          <h4>
            {searchNumber ? `No contact matching "${searchNumber}"` : "No Contacts Found"}
          </h4>
          <p>
            {searchNumber
              ? "You can click '+ Add / Customize Number' above to apply a custom sarcastic or friendly persona to this phone number directly."
              : "Contacts and chat counts will appear as messages arrive on your WhatsApp account, or you can register a number to pre-configure unique tone and memories."}
          </p>
        </div>
      ) : (
        <div className={styles.contactGrid}>
          {filteredContacts.map((contact) => (
            <button
              key={contact.whatsappNumber}
              type="button"
              className={`${styles.contactCard} ${contact.hasCustomConfig ? styles.contactCardCustom : ""}`}
              onClick={() => setSelectedContact(contact)}
            >
              <div>
                <div className={styles.cardHeader}>
                  <div className={styles.contactInfo}>
                    <h3>{contact.contactName || "Contact"}</h3>
                    <span className={styles.numberText}>{contact.whatsappNumber}</span>
                  </div>

                  <span
                    className={`${styles.toneBadge} ${contact.hasCustomConfig ? styles.toneBadgeCustom : ""}`}
                  >
                    {contact.hasCustomConfig
                      ? `🎭 ${contact.toneStyle}`
                      : "🌐 Global"}
                  </span>
                </div>

                {/* Number of Chats & Memory Stats */}
                <div className={styles.cardStats}>
                  <div className={styles.statItem}>
                    <span>💬</span>
                    <span>
                      <strong className={styles.statNumber}>{contact.chatCount}</strong> chats
                    </span>
                  </div>

                  <div className={styles.statItem}>
                    <span>🧠</span>
                    <span>
                      <strong className={styles.statNumber}>{contact.memoryCount}</strong> vector memories
                    </span>
                  </div>
                </div>
              </div>

              <div className={styles.cardFooter}>
                <span>
                  {contact.lastMessage
                    ? `Last: "${contact.lastMessage.slice(0, 32)}..."`
                    : "Ready for custom persona"}
                </span>
                <span className={styles.cardAction}>Edit Persona →</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Add / Choose Number Dialog */}
      {showAddModal && (
        <div
          className={styles.addModalBackdrop}
          onClick={(e) => e.target === e.currentTarget && setShowAddModal(false)}
        >
          <div className={styles.addModal}>
            <h3>Pre-Configure WhatsApp Number</h3>
            <p>
              Enter a phone number to assign a custom speaking tone (e.g. sarcasm, playful roast) and seed long-term PgVector memories.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <input
                type="text"
                className={styles.searchInput}
                value={newNumberInput}
                onChange={(e) => setNewNumberInput(e.target.value)}
                placeholder="Phone number e.g. 919876543210 or +1..."
                autoFocus
              />
              <input
                type="text"
                className={styles.searchInput}
                value={newNameInput}
                onChange={(e) => setNewNameInput(e.target.value)}
                placeholder="Contact Name (optional e.g. Rahul)"
              />
            </div>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.addBtn}
                style={{ background: "transparent", borderColor: "rgba(255,255,255,0.15)" }}
                onClick={() => setShowAddModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.addBtn}
                onClick={handleAddNewNumber}
                disabled={!newNumberInput.trim()}
              >
                Configure Persona →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contact Custom Settings & PgVector Memory Modal */}
      {selectedContact && (
        <ContactCustomModal
          whatsappNumber={selectedContact.whatsappNumber}
          initialContactName={selectedContact.contactName}
          onClose={() => setSelectedContact(null)}
          onSaved={() => {
            void fetchContacts();
          }}
        />
      )}
    </div>
  );
}
