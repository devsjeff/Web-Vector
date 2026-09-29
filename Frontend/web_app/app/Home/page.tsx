"use client";

import Image from "next/image";
import Home_background from "../components/utilities/home/background_img.jpg";
import Header from "../components/Home_Header";
import Footer from "../components/Home_Footer";
import { Fira_Sans } from "next/font/google";
import Link from "next/link";

const firaSans = Fira_Sans({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

const automationPillars = [
  {
    number: "01",
    badge: "SEMANTIC MEMORY",
    title: "PgVector Semantic Recall",
    text: "Every conversation turn is transformed into a 768-dimensional vector embedding in PostgreSQL. When contacts message again, vector cosine similarity retrieves pertinent past facts instantly.",
    icon: "🧠",
  },
  {
    number: "02",
    badge: "ADAPTIVE PERSONAS",
    title: "Per-Contact Tone & Sarcasm",
    text: "Assign unique speaking personalities per phone number. Talk with playful sarcasm and banter to friends, formal precision to clients, and fall back to global settings when unspecified.",
    icon: "🎭",
  },
  {
    number: "03",
    badge: "CHAT INTELLIGENCE",
    title: "Search Numbers & Chat Counts",
    text: "Inspect contact volume in real time. Search by phone number, review message frequencies, and customize per-chat automation rules with one click.",
    icon: "📱",
  },
  {
    number: "04",
    badge: "EVENT BUS",
    title: "Kafka Event-Driven Bridge",
    text: "Decoupled asynchronous architecture. Node.js handles real-time socket connections, Kafka queues incoming events with rate-limiting, and Python LLM workers execute reasoning.",
    icon: "⚡",
  },
  {
    number: "05",
    badge: "ORCHESTRATION",
    title: "Multi-Step Workflow Automations",
    text: "Trigger actions based on conversation intent: book calendar slots, sync CRM leads, dispatch webhooks, and execute database operations autonomously.",
    icon: "⚙️",
  },
  {
    number: "06",
    badge: "GUARDRAILS",
    title: "Owner-Defined Boundaries",
    text: "Strict layered safety rules. Base boundaries guarantee the AI never leaks private keys, refuses prompt injections, and keeps memory strictly isolated per contact.",
    icon: "🛡️",
  },
];

const personasPreview = [
  {
    name: "Vikram (College Friend)",
    number: "+91 98765 43210",
    chats: "48 chats",
    tone: "🎭 Sarcastic Banter",
    sample: '"Oh look who finally decided to message back! Let me guess, you need the notes again?"',
  },
  {
    name: "Dr. Alistair (Medical Clinic)",
    number: "+1 415 800 2311",
    chats: "19 chats",
    tone: "💼 Professional & Courteous",
    sample: '"Good morning. We have two consultation openings this Thursday at 10:00 AM and 2:30 PM."',
  },
  {
    name: "Glow Salon Client",
    number: "+91 99999 88888",
    chats: "6 chats",
    tone: "✨ Friendly Hinglish",
    sample: '"Hey! Haircut and styling slot book ho gaya for Saturday 4 PM. See you then!"',
  },
];

const workflowSteps = [
  {
    step: "01",
    title: "Inbound Message & Anti-Spam",
    text: "A message arrives via WhatsApp or Webhook. The system debounces rapid-fire messages and enforces rate-limiting.",
  },
  {
    step: "02",
    title: "PgVector Semantic Search",
    text: "A 768-dim embedding is generated to query Postgres for relevant historical memories and contact notes.",
  },
  {
    step: "03",
    title: "Per-Contact Persona Routing",
    text: "The worker checks if this phone number has a custom tone (e.g. sarcastic, witty) or inherits global workspace defaults.",
  },
  {
    step: "04",
    title: "Reasoning & Auto-Reply",
    text: "The LLM synthesizes memory and tone to reply helpfully, and commits new knowledge into the PgVector store.",
  },
];

export default function Home_page() {
  return (
    <main className={firaSans.className}>
      <Header />

      {/* HERO SECTION */}
      <section className="hero" id="top">
        <Image
          src={Home_background}
          alt="Web Vector Background"
          fill
          priority
          className="hero-background"
          sizes="100vw"
        />

        <div className="hero-overlay" />

        <div className="container hero-content">
          <div className="eyebrow">
            <span className="eyebrow-dot" />
            AUTONOMOUS AI AUTOMATION PLATFORM
          </div>

          <h1>
            Automate Everything.
            <br />
            <span>Remember Everyone.</span>
          </h1>

          <p className="hero-description">
            Web-Vector is an event-driven automation platform powered by <strong>PgVector semantic memory</strong>,
            customizable <strong>per-contact tones (like playful sarcasm)</strong>, and high-throughput
            multi-channel workflow execution.
          </p>

          <div className="hero-actions">
            <Link href="/Application" className="button button-primary">
              Open Automation Studio
              <span>→</span>
            </Link>

            <a href="#how-it-works" className="button button-secondary">
              See How It Works
            </a>
          </div>

          <div className="hero-trust">
            <span>PgVector Memory</span>
            <i />
            <span>Dynamic Personas</span>
            <i />
            <span>WhatsApp Engine</span>
            <i />
            <span>Kafka Pipelines</span>
            <i />
            <span>Event Automations</span>
          </div>
        </div>

        <div className="hero-bottom-glow" />
      </section>

      {/* AUTOMATION VALUE PROP */}
      <section className="section section-intro">
        <div className="container two-column">
          <div>
            <div className="section-kicker">AUTONOMOUS WORKFLOW CORE</div>
            <h2>
              Not just a chat box.
              <br />
              <span>An intelligent automation engine.</span>
            </h2>
          </div>

          <div className="intro-copy">
            <p>
              Traditional chatbots lack persistent recall and talk to everyone with the exact same robotic voice.
              Web-Vector transforms your communication channels into an automated operating system.
            </p>
            <p>
              With <strong>PgVector 768-dim embeddings</strong>, every conversation builds long-term context.
              With <strong>per-contact personas</strong>, you can configure sharp playful sarcasm for close friends,
              flawless professionalism for clients, or specific tasks for team members — with zero amnesia.
            </p>
          </div>
        </div>
      </section>

      {/* CAPABILITIES / PILLARS */}
      <section className="section section-dark" id="capabilities">
        <div className="container">
          <div className="section-heading">
            <div>
              <div className="section-kicker">CORE PLATFORM ARCHITECTURE</div>
              <h2>
                Six pillars behind
                <span> the automation engine.</span>
              </h2>
            </div>
            <p>
              Engineered from the ground up for high reliability, semantic retrieval, and deep channel automation.
            </p>
          </div>

          <div className="capability-grid">
            {automationPillars.map((item) => (
              <article className="capability-card" key={item.number}>
                <div className="card-topline">
                  <span className="card-number">{item.badge}</span>
                  <span className="card-icon">{item.icon}</span>
                </div>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* PER-CONTACT PERSONAS SHOWCASE */}
      <section className="section section-soft" id="personas">
        <div className="container">
          <div className="section-heading">
            <div>
              <div className="section-kicker">DYNAMIC STYLE & TONE ENGINE</div>
              <h2>
                Unique tone per contact.
                <br />
                <span>Sarcasm, banter, or business.</span>
              </h2>
            </div>
            <p>
              Search by phone number, view total chat counts, and assign tailored personas.
              If no contact override is set, it seamlessly adopts your global workspace defaults.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px" }}>
            {personasPreview.map((p) => (
              <div
                key={p.number}
                style={{
                  padding: "24px",
                  borderRadius: "16px",
                  border: "1px solid rgba(255, 255, 255, 0.09)",
                  background: "linear-gradient(145deg, rgba(255,255,255,0.035), rgba(255,255,255,0.01))",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                  <div>
                    <h3 style={{ margin: "0 0 4px", color: "#f4eee8", fontSize: "1.05rem" }}>{p.name}</h3>
                    <code style={{ fontSize: "0.82rem", color: "#9aa6ac" }}>{p.number}</code>
                  </div>
                  <span style={{ fontSize: "0.75rem", padding: "3px 10px", borderRadius: "999px", background: "rgba(232, 221, 207, 0.12)", color: "#e8ddcf", fontWeight: 700 }}>
                    {p.tone}
                  </span>
                </div>

                <div style={{ display: "flex", gap: "12px", margin: "14px 0", fontSize: "0.8rem", color: "#8a979d" }}>
                  <span>💬 {p.chats}</span>
                  <span>🧠 PgVector Active</span>
                </div>

                <blockquote style={{ margin: 0, padding: "12px 14px", borderRadius: "8px", background: "rgba(0,0,0,0.3)", color: "#d5dee2", fontSize: "0.88rem", fontStyle: "italic", borderLeft: "3px solid #e8ddcf" }}>
                  {p.sample}
                </blockquote>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHATSAPP AUTOMATION SECTION */}
      <section className="section" id="whatsapp-hub">
        <div className="container split-panel">
          <div>
            <div className="section-kicker">CONNECTED CHANNEL</div>
            <h2>
              Full-featured
              <br />
              <span>WhatsApp automation hub.</span>
            </h2>
            <p className="panel-copy">
              Connect your WhatsApp in seconds with QR device pairing. Powered by Baileys,
              MongoDB auth persistence, and Kafka event queues. Built-in debounce ensures
              multiple rapid messages are grouped into a single coherent AI response.
            </p>

            <div style={{ marginTop: "24px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <div style={{ padding: "8px 14px", borderRadius: "8px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", fontSize: "0.82rem", color: "#d8c7b8" }}>
                ✓ Instant QR Link
              </div>
              <div style={{ padding: "8px 14px", borderRadius: "8px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", fontSize: "0.82rem", color: "#d8c7b8" }}>
                ✓ Anti-Spam Rate Limit
              </div>
              <div style={{ padding: "8px 14px", borderRadius: "8px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", fontSize: "0.82rem", color: "#d8c7b8" }}>
                ✓ 2-Second Debounce Buffer
              </div>
            </div>
          </div>

          <div className="permission-panel">
            <div className="permission-row">
              <span>WhatsApp Web Session</span>
              <strong className="status-on">LIVE (PORT 3001)</strong>
            </div>
            <div className="permission-row">
              <span>Kafka Incoming Bus</span>
              <strong className="status-on">CONNECTED (PORT 9092)</strong>
            </div>
            <div className="permission-row">
              <span>PgVector Memory Store</span>
              <strong className="status-on">ACTIVE (768-DIM)</strong>
            </div>
            <div className="permission-row">
              <span>Per-Contact Sarcasm / Tone</span>
              <strong className="status-on">ENABLED</strong>
            </div>
            <div className="permission-row">
              <span>Global Fallback Engine</span>
              <strong className="status-on">READY</strong>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS / FLOW */}
      <section className="section section-dark" id="how-it-works">
        <div className="container">
          <div className="section-heading compact">
            <div>
              <div className="section-kicker">EVENT-DRIVEN FLOW</div>
              <h2>
                How an event
                <span> travels through the system.</span>
              </h2>
            </div>
            <p>
              Sub-second message lifecycle: from raw socket packet to semantic vector retrieval,
              persona blending, and outbound reply.
            </p>
          </div>

          <div className="flow">
            {workflowSteps.map((item, index) => (
              <div className="flow-step" key={item.step}>
                <div className="flow-number">{item.step}</div>
                <div className="flow-line">
                  <span />
                  {index < workflowSteps.length - 1 && <i />}
                </div>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="architecture">
            <div className="architecture-main">
              <span className="architecture-label">Channel</span>
              <strong>WhatsApp / Ingest</strong>
              <small>Node.js & Baileys</small>
            </div>

            <div className="architecture-arrow">→</div>

            <div className="architecture-main">
              <span className="architecture-label">Event Broker</span>
              <strong>Kafka Bus</strong>
              <small>Partitioned Queue</small>
            </div>

            <div className="architecture-arrow">→</div>

            <div className="architecture-main">
              <span className="architecture-label">Vector Memory</span>
              <strong>PgVector</strong>
              <small>Cosine Search (768d)</small>
            </div>

            <div className="architecture-arrow">→</div>

            <div className="architecture-main">
              <span className="architecture-label">AI Agent</span>
              <strong>Tone & Sarcasm LLM</strong>
              <small>Dynamic Personas</small>
            </div>
          </div>
        </div>
      </section>

      {/* CALL TO ACTION */}
      <section className="section section-cta" id="get-started">
        <div className="container cta-card">
          <div className="cta-glow" />
          <div className="section-kicker">EXPERIENCE WEB VECTOR</div>
          <h2>
            Unleash the full power of
            <span> AI automation.</span>
          </h2>
          <p>
            Connect your channels, index memories in PgVector, and let your assistant talk with the
            exact tone, personality, and intelligence you want.
          </p>

          <Link href="/Application" className="button button-primary">
            Open Application Workspace →
          </Link>
        </div>
      </section>

      <Footer />
    </main>
  );
}