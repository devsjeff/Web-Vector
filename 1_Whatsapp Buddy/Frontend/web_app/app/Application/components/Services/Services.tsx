"use client";

import { useState } from "react";
import style from "./Services.module.css";
import { services, type ServiceId } from "../../config/services";
import Whatsapp from "../../updates/services/whatsapp/Whatsapp";

function PlaceholderService({ name, description }: { name: string; description: string }) {
  return (
    <section style={{ padding: "36px" }}>
      <p style={{ margin: "0 0 8px", color: "var(--app-accent)", fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase" }}>
        Service workspace
      </p>
      <h1 style={{ margin: "0 0 10px", color: "var(--app-text)", fontSize: "clamp(1.8rem, 4vw, 3rem)", letterSpacing: "-0.04em" }}>
        {name}
      </h1>
      <p style={{ maxWidth: "620px", margin: 0, color: "var(--app-muted)", lineHeight: 1.7 }}>
        {description} This screen is intentionally ready for your future {name} component.
      </p>
    </section>
  );
}

function ServiceContent({ serviceId }: { serviceId: ServiceId }) {
  const service = services.find((item) => item.id === serviceId);
  if (!service) return null;

  if (serviceId === "whatsapp") {
    return <Whatsapp />;
  }

  return <PlaceholderService name={service.name} description={service.description} />;
}

export default function Services() {
  const [selectedService, setSelectedService] = useState<ServiceId | null>(null);
  const selected = services.find((service) => service.id === selectedService);

  return (
    <div className={style.wrapper}>
      <div className={style.layout}>
        <aside className={style.sidebar} aria-label="Services">
          <div className={style.sidebarHeader}>
            <h2 className={style.sidebarTitle}>Services</h2>
            <p className={style.sidebarSubTitle}>Choose a service to open its workspace</p>
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
          {selected ? (
            <ServiceContent serviceId={selected.id} />
          ) : (
            <div className={style.emptyState}>
              <div className={style.emptyStateInner}>
                <div className={style.emptyIcon}>WV</div>
                <h1>Select a service</h1>
                <p>
                  Pick a service from the left. Its component will open here, so every service follows the same layout instead of creating separate popups.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
