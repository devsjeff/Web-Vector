"use client";

import { useEffect, useState, useMemo } from "react";
import styles from "./ContactManager.module.css";
import ContactCustomModal from "./ContactCustomModal";

export interface ContactSummary {
  whatsappNumber: string;
  contactName?: string;
  relationship?: "boss" | "love" | "friend" | "normal" | string;
  relationshipLabel?: string;
  chatCount: number;
  memoryCount: number;
  hasCustomConfig: boolean;
  toneStyle: string;
  lastMessage?: string;
  updatedAt?: string;
}

export function detectRelationship(name?: string) {
  const clean = (name || "").trim();
  if (!clean) {
    return {
      category: "normal",
      label: "Standard Contact",
      icon: "👤",
      desc: "Standard polite and helpful conversation.",
    };
  }

  const lower = clean.toLowerCase();

  // Boss
  if (/\b(boss|sir|manager|director|supervisor|lead|tl|ceo|cto|cfo|cmo|founder|client|head|prof|professor)\b/i.test(lower)) {
    return {
      category: "boss",
      label: "Boss / Executive",
      icon: "👔",
      desc: "Deals like an executive: utmost respect, crisp structured updates, direct and professional.",
    };
  }

  // Love / Romantic
  if (/\b(love|my\s*love|sweetheart|darling|honey|babe|baby|jaan|shona|wife|wifey|husband|hubby|fiance|fiancee|sweetie|cutie|soulmate|jaaneman)\b/i.test(lower) || /[❤️💕💖💓💗💞💘]/.test(lower)) {
    return {
      category: "love",
      label: "Loved One / Partner",
      icon: "❤️",
      desc: "Deals with love: sweet, deeply affectionate, warm, caring, gentle and loving tone.",
    };
  }

  // Friend
  if (/\b(friend|frnd|frnds|yaar|dost|bro|brother|buddy|pal|bestie|bff|homie|dude|mate|gang|chaddi\s*buddy)\b/i.test(lower)) {
    return {
      category: "friend",
      label: "Friend / Buddy",
      icon: "🤝",
      desc: "Speaks like a friend. Dynamically adapts: if chat gets naughty, sarcastic, or teasing, mirrors banter & sarcasm!",
    };
  }

  return {
    category: "normal",
    label: "Standard Contact",
    icon: "👤",
    desc: "Polite, friendly, and helpful standard persona.",
  };
}

export default function ContactManager() {
  const [contacts, setContacts] = useState<ContactSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchNumber, setSearchNumber] = useState("");
  const [selectedContact, setSelectedContact] = useState<ContactSummary | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newNumberInput, setNewNumberInput] = useState("");
  const [newNameInput, setNewNameInput] = useState("");
  
  // Sync name modal state
  const [syncingContact, setSyncingContact] = useState<ContactSummary | null>(null);
  const [syncNameInput, setSyncNameInput] = useState("");
  const [syncLoading, setSyncLoading] = useState(false);

  const [viewFilter, setViewFilter] = useState<"all" | "custom_only" | "global_only" | "boss" | "love" | "friend">("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState(false);

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

  const customContactsCount = useMemo(() => {
    return contacts.filter((c) => c.hasCustomConfig).length;
  }, [contacts]);

  // Filter contacts by search query AND view filter
  const displayedContacts = useMemo(() => {
    let list = contacts;

    if (viewFilter === "custom_only") {
      list = list.filter((c) => c.hasCustomConfig);
    } else if (viewFilter === "global_only") {
      list = list.filter((c) => !c.hasCustomConfig);
    } else if (viewFilter === "boss") {
      list = list.filter((c) => (c.relationship || detectRelationship(c.contactName).category) === "boss");
    } else if (viewFilter === "love") {
      list = list.filter((c) => (c.relationship || detectRelationship(c.contactName).category) === "love");
    } else if (viewFilter === "friend") {
      list = list.filter((c) => (c.relationship || detectRelationship(c.contactName).category) === "friend");
    }

    const q = searchNumber.trim().toLowerCase();
    if (!q) return list;

    return list.filter(
      (c) =>
        c.whatsappNumber.toLowerCase().includes(q) ||
        (c.contactName && c.contactName.toLowerCase().includes(q))
    );
  }, [contacts, searchNumber, viewFilter]);

  const handleAddNewNumber = () => {
    const cleanNum = newNumberInput.replace(/[^\d+]/g, "").trim();
    if (!cleanNum) return;

    const rel = detectRelationship(newNameInput);

    const newContact: ContactSummary = {
      whatsappNumber: cleanNum,
      contactName: newNameInput.trim() || undefined,
      relationship: rel.category,
      relationshipLabel: rel.label,
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

  // Open Name Sync Modal
  const openSyncModal = (contact: ContactSummary, e: React.MouseEvent) => {
    e.stopPropagation();
    setSyncingContact(contact);
    setSyncNameInput(contact.contactName || "");
  };

  // Submit Contact Name Sync
  const handleSaveContactName = async () => {
    if (!syncingContact) return;
    try {
      setSyncLoading(true);
      const res = await fetch("http://localhost:8000/App/contact_name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          whatsappNumber: syncingContact.whatsappNumber,
          contactName: syncNameInput.trim(),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setActionNotice(`Synced contact name for ${syncingContact.whatsappNumber} as "${syncNameInput.trim()}" (${data.relationshipLabel})`);
        setTimeout(() => setActionNotice(null), 4000);
        setSyncingContact(null);
        await fetchContacts();
      }
    } catch (err) {
      console.error("Error syncing contact name:", err);
    } finally {
      setSyncLoading(false);
    }
  };

  // Delete custom setting for a single contact
  const handleQuickRevert = async (number: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Revert ${number} back to global assistant settings? Custom tone and prompt overrides will be deleted.`)) return;

    try {
      setBusyAction(true);
      const res = await fetch(`http://localhost:8000/App/contact_config?number=${encodeURIComponent(number)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        setActionNotice(`Reverted ${number} to global settings.`);
        setTimeout(() => setActionNotice(null), 4000);
        await fetchContacts();
      }
    } catch (err) {
      console.error("Error reverting contact:", err);
    } finally {
      setBusyAction(false);
    }
  };

  // Delete all custom settings across all users
  const handleDeleteAllCustom = async () => {
    if (customContactsCount === 0) return;
    const confirmed = confirm(
      `Are you sure you want to delete custom settings for all ${customContactsCount} contacts?\n\nEvery contact will revert to your global assistant settings.`
    );
    if (!confirmed) return;

    try {
      setBusyAction(true);
      const res = await fetch("http://localhost:8000/App/contact_configs/all", {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setActionNotice(data.message || `Deleted custom settings for all contacts.`);
        setTimeout(() => setActionNotice(null), 5000);
        await fetchContacts();
      }
    } catch (err) {
      console.error("Error deleting all custom settings:", err);
    } finally {
      setBusyAction(false);
    }
  };

  const getRelationshipClass = (category?: string) => {
    switch (category) {
      case "boss": return styles.relBoss;
      case "love": return styles.relLove;
      case "friend": return styles.relFriend;
      default: return styles.relNormal;
    }
  };

  return (
    <div className={styles.container}>
      {/* Top Search, View Toggles & Add Action */}
      <div className={styles.topBar}>
        <div className={styles.searchBox}>
          <span className={styles.searchIcon}>⌕</span>
          <input
            type="text"
            className={styles.searchInput}
            value={searchNumber}
            onChange={(e) => setSearchNumber(e.target.value)}
            placeholder="Search phone number (e.g. 9198...) or contact name..."
          />
        </div>

        <div className={styles.topActions}>
          {/* Grid vs Scrollable List Toggle */}
          <div className={styles.viewToggle}>
            <button
              type="button"
              className={`${styles.viewBtn} ${viewMode === "grid" ? styles.viewBtnActive : ""}`}
              onClick={() => setViewMode("grid")}
              title="Card Grid View"
            >
              ⊞ Grid
            </button>
            <button
              type="button"
              className={`${styles.viewBtn} ${viewMode === "list" ? styles.viewBtnActive : ""}`}
              onClick={() => setViewMode("list")}
              title="Dense Scrollable Table View"
            >
              ☰ Scroll List
            </button>
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
      </div>

      {/* Filter Bar & Delete All Controls */}
      <div className={styles.filterBar}>
        <div className={styles.filterTabs}>
          <button
            type="button"
            className={`${styles.filterTab} ${viewFilter === "all" ? styles.filterTabActive : ""}`}
            onClick={() => setViewFilter("all")}
          >
            All Contacts ({contacts.length})
          </button>
          <button
            type="button"
            className={`${styles.filterTab} ${viewFilter === "custom_only" ? styles.filterTabActive : ""}`}
            onClick={() => setViewFilter("custom_only")}
          >
            ⚡ Custom Only ({customContactsCount})
          </button>
          <button
            type="button"
            className={`${styles.filterTab} ${viewFilter === "global_only" ? styles.filterTabActive : ""}`}
            onClick={() => setViewFilter("global_only")}
          >
            🌐 Global Defaults ({contacts.length - customContactsCount})
          </button>
          <button
            type="button"
            className={`${styles.filterTab} ${viewFilter === "boss" ? styles.filterTabActive : ""}`}
            onClick={() => setViewFilter("boss")}
          >
            👔 Boss
          </button>
          <button
            type="button"
            className={`${styles.filterTab} ${viewFilter === "love" ? styles.filterTabActive : ""}`}
            onClick={() => setViewFilter("love")}
          >
            ❤️ Loved One
          </button>
          <button
            type="button"
            className={`${styles.filterTab} ${viewFilter === "friend" ? styles.filterTabActive : ""}`}
            onClick={() => setViewFilter("friend")}
          >
            🤝 Friends (Sarcastic Mirror)
          </button>
        </div>

        {customContactsCount > 0 && (
          <button
            type="button"
            className={styles.btnDangerOutline}
            onClick={handleDeleteAllCustom}
            disabled={busyAction}
            title="Delete all custom personas and revert all contacts to global defaults"
          >
            <span>🗑️</span>
            <span>{busyAction ? "Deleting…" : `Delete All Custom Settings (${customContactsCount})`}</span>
          </button>
        )}
      </div>

      {/* Notice Banner */}
      {actionNotice && (
        <div style={{
          padding: "10px 16px",
          borderRadius: "8px",
          background: "rgba(46, 102, 81, 0.25)",
          border: "1px solid rgba(74, 222, 128, 0.3)",
          color: "#86efac",
          fontSize: "0.85rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <span>✓ {actionNotice}</span>
          <button
            type="button"
            style={{ background: "transparent", border: "none", color: "#86efac", cursor: "pointer", fontSize: "1rem" }}
            onClick={() => setActionNotice(null)}
          >
            ✕
          </button>
        </div>
      )}

      {/* Loading & Empty States */}
      {loading ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>⏳</div>
          <h4>Loading Contacts & Personas...</h4>
          <p>Retrieving WhatsApp numbers, chat statistics, relationship tags, and configurations.</p>
        </div>
      ) : displayedContacts.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📱</div>
          <h4>
            {viewFilter === "custom_only"
              ? "No Custom Personas Configured"
              : searchNumber
                ? `No contact matching "${searchNumber}"`
                : "No Contacts Found"}
          </h4>
          <p>
            {viewFilter === "custom_only"
              ? "None of your contacts currently have custom persona overrides. All contacts are inheriting your global assistant settings."
              : searchNumber
                ? "You can click '+ Add / Customize Number' above to configure a specific tone (sarcasm, boss, love, roast) for this phone number."
                : "Contacts will automatically appear here as WhatsApp chats take place, or you can register a number to configure custom memory and style."}
          </p>
        </div>
      ) : viewMode === "grid" ? (
        /* Card Grid View */
        <div className={styles.contactGrid}>
          {displayedContacts.map((contact) => {
            const rel = detectRelationship(contact.contactName);
            const activeRelCat = contact.relationship || rel.category;
            const activeRelLabel = contact.relationshipLabel || rel.label;

            return (
              <div
                key={contact.whatsappNumber}
                className={`${styles.contactCard} ${contact.hasCustomConfig ? styles.contactCardCustom : ""}`}
                onClick={() => setSelectedContact(contact)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && setSelectedContact(contact)}
              >
                <div>
                  <div className={styles.cardHeader}>
                    <div className={styles.contactInfo}>
                      <div className={styles.nameRow}>
                        <h3>{contact.contactName || "Unnamed Contact"}</h3>
                        <button
                          type="button"
                          className={styles.syncNameBtn}
                          onClick={(e) => openSyncModal(contact, e)}
                          title="Sync or Rename Contact"
                        >
                          ✏️ Sync Name
                        </button>
                      </div>
                      <span className={styles.numberText}>📞 {contact.whatsappNumber}</span>
                    </div>

                    <div className={styles.badgeStack}>
                      {/* Setting Status: Global vs Custom */}
                      <span
                        className={`${styles.statusPill} ${
                          contact.hasCustomConfig ? styles.pillCustom : styles.pillGlobal
                        }`}
                        title={contact.hasCustomConfig ? "Custom speaking persona active" : "Inherits global assistant settings"}
                      >
                        {contact.hasCustomConfig
                          ? `⚡ Custom: ${contact.toneStyle}`
                          : "🌐 Global Settings"}
                      </span>

                      {/* Smart Relationship Tag */}
                      <span className={`${styles.relationshipBadge} ${getRelationshipClass(activeRelCat)}`}>
                        {activeRelCat === "boss" && "👔 Boss"}
                        {activeRelCat === "love" && "❤️ Loved One"}
                        {activeRelCat === "friend" && "🤝 Friend"}
                        {activeRelCat === "normal" && "👤 Standard"}
                      </span>
                    </div>
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

                    {contact.hasCustomConfig && (
                      <button
                        type="button"
                        className={styles.quickRevertBtn}
                        onClick={(e) => handleQuickRevert(contact.whatsappNumber, e)}
                        title="Delete custom setting and revert to global"
                        style={{ marginLeft: "auto" }}
                      >
                        Revert to Global
                      </button>
                    )}
                  </div>
                </div>

                <div className={styles.cardFooter}>
                  <span>
                    {contact.lastMessage
                      ? `Last: "${contact.lastMessage.slice(0, 26)}..."`
                      : activeRelCat === "friend"
                        ? "Friend detected: Dynamic sarcasm enabled"
                        : activeRelCat === "boss"
                          ? "Boss detected: Executive tone active"
                          : activeRelCat === "love"
                            ? "Love detected: Affectionate tone active"
                            : "Ready for conversation"}
                  </span>
                  <span className={styles.cardAction}>
                    {contact.hasCustomConfig ? "Edit Persona →" : "Customize Persona →"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Dense Scrollable Table / List View */
        <div className={styles.tableContainer}>
          <table className={styles.contactTable}>
            <thead>
              <tr>
                <th>Phone Number</th>
                <th>Contact Name</th>
                <th>Relationship</th>
                <th>Configuration Status</th>
                <th>Chats Count</th>
                <th>PgVector Memories</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayedContacts.map((contact) => {
                const rel = detectRelationship(contact.contactName);
                const activeRelCat = contact.relationship || rel.category;

                return (
                  <tr
                    key={contact.whatsappNumber}
                    className={`${styles.tableRow} ${contact.hasCustomConfig ? styles.tableRowCustom : ""}`}
                    onClick={() => setSelectedContact(contact)}
                  >
                    <td>
                      <strong style={{ fontFamily: "monospace", color: "#e8ddcf" }}>
                        📞 {contact.whatsappNumber}
                      </strong>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span>{contact.contactName || "—"}</span>
                        <button
                          type="button"
                          className={styles.syncNameBtn}
                          onClick={(e) => openSyncModal(contact, e)}
                          title="Sync Contact Name"
                        >
                          ✏️ Sync
                        </button>
                      </div>
                    </td>
                    <td>
                      <span className={`${styles.relationshipBadge} ${getRelationshipClass(activeRelCat)}`}>
                        {activeRelCat === "boss" && "👔 Boss"}
                        {activeRelCat === "love" && "❤️ Loved One"}
                        {activeRelCat === "friend" && "🤝 Friend (Sarcasm)"}
                        {activeRelCat === "normal" && "👤 Standard"}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`${styles.statusPill} ${
                          contact.hasCustomConfig ? styles.pillCustom : styles.pillGlobal
                        }`}
                      >
                        {contact.hasCustomConfig ? `⚡ Custom: ${contact.toneStyle}` : "🌐 Global Settings Active"}
                      </span>
                    </td>
                    <td>
                      <strong>💬 {contact.chatCount}</strong> chats
                    </td>
                    <td>
                      <strong>🧠 {contact.memoryCount}</strong> memories
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <button
                          type="button"
                          className={styles.addBtn}
                          style={{ padding: "5px 10px", fontSize: "0.75rem" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedContact(contact);
                          }}
                        >
                          {contact.hasCustomConfig ? "Edit" : "Customize"}
                        </button>

                        {contact.hasCustomConfig && (
                          <button
                            type="button"
                            className={styles.quickRevertBtn}
                            onClick={(e) => handleQuickRevert(contact.whatsappNumber, e)}
                            title="Revert to global"
                          >
                            Revert
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Sync / Rename Contact Modal */}
      {syncingContact && (
        <div
          className={styles.addModalBackdrop}
          onClick={(e) => e.target === e.currentTarget && setSyncingContact(null)}
        >
          <div className={styles.addModal}>
            <h3>Sync Contact Name</h3>
            <p>
              Set or sync the display name for <strong>{syncingContact.whatsappNumber}</strong>. The AI uses this name to intelligently detect relationships and adapt tone in real-time.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <input
                type="text"
                className={styles.searchInput}
                value={syncNameInput}
                onChange={(e) => setSyncNameInput(e.target.value)}
                placeholder="e.g. Rahul Friend, Mr. Sharma (Boss), My Love ❤️"
                autoFocus
              />

              {/* Dynamic Relationship Preview */}
              {(() => {
                const previewRel = detectRelationship(syncNameInput);
                return (
                  <div className={styles.previewBox}>
                    <div className={styles.previewHeader}>
                      <span>{previewRel.icon}</span>
                      <span>Detected Relationship: {previewRel.label}</span>
                    </div>
                    <div className={styles.previewDesc}>{previewRel.desc}</div>
                  </div>
                );
              })()}
            </div>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.addBtn}
                style={{ background: "transparent", borderColor: "rgba(255,255,255,0.15)" }}
                onClick={() => setSyncingContact(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.addBtn}
                onClick={handleSaveContactName}
                disabled={syncLoading}
              >
                {syncLoading ? "Syncing…" : "Save & Sync Name"}
              </button>
            </div>
          </div>
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
              Enter a phone number to assign a custom speaking tone (e.g. sarcasm, boss mode, love mode) and seed long-term PgVector memories.
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
                placeholder="Contact Name (e.g. Rahul Friend, Boss, Love)"
              />

              {newNameInput.trim() && (() => {
                const previewRel = detectRelationship(newNameInput);
                return (
                  <div className={styles.previewBox}>
                    <div className={styles.previewHeader}>
                      <span>{previewRel.icon}</span>
                      <span>Detected Role: {previewRel.label}</span>
                    </div>
                    <div className={styles.previewDesc}>{previewRel.desc}</div>
                  </div>
                );
              })()}
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
