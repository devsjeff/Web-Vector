import Image from "next/image";
import Home_background from "../components/utilities/home/background_img.jpg"
import Header from "../components/Home_Header";
import Footer from "../components/Home_Footer";
import { Fira_Sans } from "next/font/google";

const firaSans = Fira_Sans({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

const capabilities = [
  {
    number: "01",
    title: "Context-aware replies",
    text: "The assistant can use the current conversation, recent messages, owner instructions, and business information before it responds.",
    icon: "↯",
  },
  {
    number: "02",
    title: "Memory for each user",
    text: "Keep useful long-term information such as preferences, previous interactions, and important customer context.",
    icon: "◌",
  },
  {
    number: "03",
    title: "Web access when needed",
    text: "Search for current information when a question needs more than the knowledge already configured by the owner.",
    icon: "⌕",
  },
  {
    number: "04",
    title: "Calendar actions",
    text: "Check availability and support appointment workflows such as booking, confirmation, rescheduling, and cancellation.",
    icon: "□",
  },
  {
    number: "05",
    title: "Tool-based actions",
    text: "Connect the assistant to calendars, databases, booking systems, WhatsApp, and external APIs instead of limiting it to text generation.",
    icon: "◇",
  },
  {
    number: "06",
    title: "Owner-controlled permissions",
    text: "Decide which tools and actions are enabled. The assistant should not have unlimited access to your systems.",
    icon: "✓",
  },
];

const useCases = [
  {
    title: "Clinics",
    text: "Answer common questions and help patients find and manage appointment slots.",
  },
  {
    title: "Hotels",
    text: "Handle room questions, booking conversations, cancellation requests, and check-in information.",
  },
  {
    title: "Restaurants",
    text: "Answer menu questions and support reservations, orders, and order-status conversations.",
  },
  {
    title: "Schools",
    text: "Handle recurring parent and student questions, schedules, events, and notifications.",
  },
  {
    title: "Businesses",
    text: "Automate customer support, qualify leads, manage appointments, and connect business systems.",
  },
  {
    title: "Individuals",
    text: "Turn WhatsApp into a personal assistant for reminders, calendar tasks, research, and useful personal context.",
  },
];

const steps = [
  {
    step: "01",
    title: "A message arrives",
    text: "A person sends a normal WhatsApp message.",
  },
  {
    step: "02",
    title: "Context is collected",
    text: "The assistant considers conversation history, memory, owner instructions, and business context.",
  },
  {
    step: "03",
    title: "The agent decides",
    text: "It can answer directly, ask for missing information, or use an allowed tool such as web search or a calendar.",
  },
  {
    step: "04",
    title: "The action happens",
    text: "The assistant performs the allowed action and communicates the result back through WhatsApp.",
  },
];

export default function Home_page() {
  return (
    <main className={firaSans.className}>
      <Header />

      {/* HERO */}
      <section className="hero" id="top">
        <Image
          src={Home_background}
          alt=""
          fill
          priority
          className="hero-background"
          sizes="100vw"
        />

        <div className="hero-overlay" />

        <div className="container hero-content">
          <div className="eyebrow">
            <span className="eyebrow-dot" />
            WhatsApp AI Assistant
          </div>

          <h1>
            Give your WhatsApp
            <span>&nbsp;a role.</span>
          </h1>

          <p className="hero-description">
            An AI assistant that can understand conversations, remember useful
            context, access information, and perform real actions for a person
            or business.
          </p>

          <div className="hero-actions">
            <a href="#capabilities" className="button button-primary">
              About the assistant
              <span>→</span>
            </a>

            <a href="#how-it-works" className="button button-secondary">
              See how it works
            </a>
          </div>

          <div className="hero-trust">
            <span>Context</span>
            <i />
            <span>Memory</span>
            <i />
            <span>Tools</span>
            <i />
            <span>Actions</span>
          </div>
        </div>

        <div className="hero-bottom-glow" />
      </section>

      {/* INTRO */}
      <section className="section section-intro">
        <div className="container two-column">
          <div>
            <div className="section-kicker">More than a chatbot</div>

            <h2>
              From answering messages
              <span> to getting work done.</span>
            </h2>
          </div>

          <div className="intro-copy">
            <p>
              The idea is simple: instead of giving a business another chat
              window, give it an AI-powered role inside the place customers
              already use.
            </p>

            <p>
              The assistant can be configured with the owner&apos;s
              instructions, business information, preferences, tools, and
              permissions so its behavior is useful and controlled.
            </p>
          </div>
        </div>
      </section>

      {/* CAPABILITIES */}
      <section className="section section-dark" id="capabilities">
        <div className="container">
          <div className="section-heading">
            <div>
              <div className="section-kicker">What it can do</div>

              <h2>
                Six building blocks
                <span> behind the assistant.</span>
              </h2>
            </div>

            <p>
              The long-term goal is not just better text generation. It is an
              assistant that can understand context and safely use the right
              tool for the job.
            </p>
          </div>

          <div className="capability-grid">
            {capabilities.map((item) => (
              <article className="capability-card" key={item.number}>
                <div className="card-topline">
                  <span className="card-number">{item.number}</span>
                  <span className="card-icon">{item.icon}</span>
                </div>

                <h3>{item.title}</h3>

                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="section" id="how-it-works">
        <div className="container">
          <div className="section-heading compact">
            <div>
              <div className="section-kicker">How a request flows</div>

              <h2>
                WhatsApp in.
                <span> Useful action out.</span>
              </h2>
            </div>

            <p>
              A simple mental model for the system: communication comes
              through WhatsApp, while the backend, AI agent, memory, and tools
              work together behind the scenes.
            </p>
          </div>

          <div className="flow">
            {steps.map((item, index) => (
              <div className="flow-step" key={item.step}>
                <div className="flow-number">{item.step}</div>

                <div className="flow-line">
                  <span />

                  {index < steps.length - 1 && <i />}
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
              <span className="architecture-label">User</span>
              <strong>WhatsApp</strong>
              <small>Conversation layer</small>
            </div>

            <div className="architecture-arrow">→</div>

            <div className="architecture-main">
              <span className="architecture-label">System</span>
              <strong>AI Agent</strong>
              <small>Reasoning + context</small>
            </div>

            <div className="architecture-arrow">→</div>

            <div className="architecture-tools">
              <span>Memory</span>
              <span>Web</span>
              <span>Calendar</span>
              <span>APIs</span>
            </div>
          </div>
        </div>
      </section>

      {/* USE CASES */}
      <section className="section section-soft">
        <div className="container">
          <div className="section-heading compact">
            <div>
              <div className="section-kicker">Built for different roles</div>

              <h2>
                One assistant.
                <span> Many real-world jobs.</span>
              </h2>
            </div>

            <p>
              The platform is designed so the owner can configure the
              assistant for a specific organization or personal workflow.
            </p>
          </div>

          <div className="use-case-grid">
            {useCases.map((item) => (
              <article className="use-case-card" key={item.title}>
                <div className="use-case-mark">+</div>

                <div>
                  <h3>{item.title}</h3>

                  <p>{item.text}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* PERMISSIONS */}
      <section className="section">
        <div className="container split-panel">
          <div>
            <div className="section-kicker">Owner control</div>

            <h2>
              AI that works
              <span> inside boundaries.</span>
            </h2>

            <p className="panel-copy">
              The assistant is designed around permissions. Owners can choose
              which tools are available instead of allowing the AI to access
              everything.
            </p>
          </div>

          <div className="permission-panel">
            <div className="permission-row">
              <span>Web Search</span>
              <strong className="status-on">ON</strong>
            </div>

            <div className="permission-row">
              <span>Calendar</span>
              <strong className="status-on">ON</strong>
            </div>

            <div className="permission-row">
              <span>Create Booking</span>
              <strong className="status-on">ON</strong>
            </div>

            <div className="permission-row">
              <span>Cancel Booking</span>
              <strong className="status-off">OFF</strong>
            </div>

            <div className="permission-row">
              <span>Payment Action</span>
              <strong className="status-off">OFF</strong>
            </div>
          </div>
        </div>
      </section>

      {/* DASHBOARD */}
      <section className="section section-dark">
        <div className="container dashboard-section">
          <div>
            <div className="section-kicker">Web dashboard</div>

            <h2>
              Control the assistant
              <span> from one place.</span>
            </h2>

            <p className="panel-copy">
              The dashboard is planned as the control center for the owner:
              configure behavior, manage conversations, control tools, review
              activity, and shape how the assistant behaves.
            </p>

            <div className="dashboard-points">
              <span>Configure instructions</span>
              <span>Manage business context</span>
              <span>View conversations</span>
              <span>Manage memory</span>
              <span>Configure tools</span>
              <span>Review activity</span>
            </div>
          </div>

          <div className="dashboard-preview">
            <div className="preview-header">
              <span className="preview-dot" />

              <span>Assistant dashboard</span>

              <span className="preview-live">LIVE</span>
            </div>

            <div className="preview-body">
              <div className="preview-sidebar">
                <span className="active">Overview</span>
                <span>Conversations</span>
                <span>Memory</span>
                <span>Tools</span>
                <span>Settings</span>
              </div>

              <div className="preview-content">
                <small>Current assistant status</small>

                <strong>Ready to respond</strong>

                <div className="preview-stats">
                  <div>
                    <b>Context</b>
                    <span>Connected</span>
                  </div>

                  <div>
                    <b>Tools</b>
                    <span>4 enabled</span>
                  </div>

                  <div>
                    <b>Memory</b>
                    <span>Active</span>
                  </div>
                </div>

                <div className="preview-bar">
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section section-cta" id="get-started">
        <div className="container cta-card">
          <div className="cta-glow" />

          <div className="section-kicker">The bigger idea</div>

          <h2>
            Don&apos;t just put AI
            <span> in your chat.</span>
          </h2>

          <p>
            Give it context. Give it memory. Give it the right tools. Then
            give it a real role.
          </p>

          <a href="#top" className="button button-primary">
            <span>↑</span>
          </a>
        </div>
      </section>

      <Footer />
    </main>
  );
}