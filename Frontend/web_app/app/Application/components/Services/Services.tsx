"use client";

import { useState } from "react";
import style from "./Services.module.css";
import { services, type ServiceId } from "../../config/services";
import Whatsapp from "../../updates/services/whatsapp/Whatsapp";
import WorkflowAutomations from "../../updates/services/workflows/WorkflowAutomations";
import VectorMemoryExplorer from "../../updates/services/whatsapp/Memory/VectorMemoryExplorer";

function GenericChannelWorkspace({ name, description }: { name: string; description: string }) {
  return (
    <section style={{ padding: "36px", display: "flex", flexDirection: "column", gap: "24px" }}>
      <div>
        <p style={{ margin: "0 0 8px", color: "var(--app-accent)", fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase" }}>
          Automation Channel
        </p>
        <h1 style={{ margin: "0 0 10px", color: "var(--app-text)", fontSize: "clamp(1.8rem, 4vw, 2.5rem)", letterSpacing: "-0.04em" }}>
          {name}
        </h1>
        <p style={{ maxWidth: "640px", margin: 0, color: "var(--app-muted)", lineHeight: 1.7, fontSize: "0.92rem" }}>
          {description}
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" }}>
        <div style={{ padding: "20px", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", background: "rgba(255,255,255,0.02)" }}>
          <strong style={{ display: "block", marginBottom: "6px", color: "#f4eee8" }}>Webhook Ingest URL</strong>
          <code style={{ fontSize: "0.8rem", color: "#e8ddcf", background: "rgba(0,0,0,0.3)", padding: "4px 8px", borderRadius: "6px", display: "block" }}>
            https://api.webvector.io/v1/webhook/{name.toLowerCase().replace(/\s+/g, "")}
          </code>
        </div>

        <div style={{ padding: "20px", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", background: "rgba(255,255,255,0.02)" }}>
          <strong style={{ display: "block", marginBottom: "6px", color: "#f4eee8" }}>Memory Attachment</strong>
          <span style={{ fontSize: "0.84rem", color: "#86efac" }}>✓ Linked to PgVector (768-dim)</span>
        </div>
      </div>
    </section>
  );
}

function ServiceContent({ serviceId }: { serviceId: ServiceId }) {
  const service = services.find((item) => item.id === serviceId);
  if (!service) return null;

  if (serviceId === "whatsapp") {
    return <Whatsapp />;
  }

  if (serviceId === "workflows") {
    return <WorkflowAutomations />;
  }

  if (serviceId === "vector_memory") {
    return (
      <section style={{ padding: "36px" }}>
        <VectorMemoryExplorer />
      </section>
    );
  }

  return <GenericChannelWorkspace name={service.name} description={service.description} />;
}

export default function Services() {
  const [selectedService, setSelectedService] = useState<ServiceId>("whatsapp");
  const selected = services.find((service) => service.id === selectedService) || services[0];

  return (
    <div className={style.wrapper}>
      <div className={style.layout}>
        <aside className={style.sidebar} aria-label="Services">
          <div className={style.sidebarHeader}>
            <h2 className={style.sidebarTitle}>Automation Suites</h2>
            <p className={style.sidebarSubTitle}>Select a pipeline or channel</p>
          </div>

          <div className={style.serviceList}>
            {services.map((service) => (
              <button
                key={service.id}
                type="button"
                className={`${style.serviceButton} ${selectedService === service.id ? style.serviceButtonActive : ""}`}
                onClick={() => setSelectedService(service.id)}
                aria-pressed={selectedService === service.id}
              >
                <span className={style.serviceIcon}>{service.shortName}</span>
                <span className={style.serviceName}>{service.name}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className={style.workspace} aria-live="polite">
          <ServiceContent serviceId={selected.id} />
        </section>
      </div>
    </div>
  );
}
