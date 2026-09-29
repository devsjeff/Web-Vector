"use client";

import { useState } from "react";
import styles from "./WorkflowAutomations.module.css";

interface WorkflowItem {
  id: string;
  title: string;
  description: string;
  trigger: string;
  action: string;
  enabled: boolean;
  executions: number;
}

const INITIAL_WORKFLOWS: WorkflowItem[] = [
  {
    id: "wf-1",
    title: "Semantic Vector Recall & Context Augmentation",
    description: "Intercepts every incoming message, queries PgVector for historical contact context, and injects pertinent past facts before prompt construction.",
    trigger: "Inbound Message",
    action: "PgVector 768-dim Query -> LLM Context",
    enabled: true,
    executions: 142,
  },
  {
    id: "wf-2",
    title: "Per-Contact Persona & Sarcasm Dispatcher",
    description: "Evaluates contact phone number against custom persona registry. Applies unique sarcasm, playful roast, or formal styling with global fallback.",
    trigger: "Contact Number Match",
    action: "Dynamic Style Persona Injection",
    enabled: true,
    executions: 89,
  },
  {
    id: "wf-3",
    title: "Auto-Memory Extraction & Indexing",
    description: "Analyzes finished assistant turns for customer preferences, appointment requests, or key details and commits vector embeddings to Postgres.",
    trigger: "Turn Completed",
    action: "Generate Vector -> Store into PgVector",
    enabled: true,
    executions: 76,
  },
  {
    id: "wf-4",
    title: "Webhook Sync for CRM & Appointments",
    description: "Dispatches HTTP POST webhooks to external endpoints when the AI identifies a booking request or lead qualification.",
    trigger: "Intent: Booking / Action",
    action: "HTTP POST /webhook/sync",
    enabled: false,
    executions: 12,
  },
];

export default function WorkflowAutomations() {
  const [workflows, setWorkflows] = useState<WorkflowItem[]>(INITIAL_WORKFLOWS);

  const toggleWorkflow = (id: string) => {
    setWorkflows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, enabled: !w.enabled } : w))
    );
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.eyebrow}>AUTOMATION CORE</div>
        <h1 className={styles.title}>Event & Workflow Automations</h1>
        <p className={styles.description}>
          Orchestrate multi-step AI triggers, semantic memory extraction, external webhooks,
          and automated actions across all connected channels.
        </p>
      </header>

      {/* Stats Overview */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <small>Active Pipelines</small>
          <strong>{workflows.filter((w) => w.enabled).length} of {workflows.length}</strong>
        </div>
        <div className={styles.statCard}>
          <small>Total Automated Actions</small>
          <strong>{workflows.reduce((acc, w) => acc + w.executions, 0)}</strong>
        </div>
        <div className={styles.statCard}>
          <small>PgVector Memory Links</small>
          <strong>Active (768d)</strong>
        </div>
      </div>

      {/* Workflow List */}
      <div className={styles.workflowList}>
        {workflows.map((wf) => (
          <div key={wf.id} className={styles.workflowCard}>
            <div className={styles.flowInfo}>
              <div className={styles.flowTitleRow}>
                <h3>{wf.title}</h3>
                <span className={styles.badge}>{wf.executions} executions</span>
              </div>
              <p className={styles.flowDesc}>{wf.description}</p>
              <div className={styles.pipelineSteps}>
                <span className={styles.stepPill}>⚡ Trigger: {wf.trigger}</span>
                <span className={styles.stepArrow}>➔</span>
                <span className={styles.stepPill}>⚙️ Action: {wf.action}</span>
              </div>
            </div>

            <label className={styles.switch}>
              <input
                type="checkbox"
                checked={wf.enabled}
                onChange={() => toggleWorkflow(wf.id)}
              />
              <span className={styles.slider} />
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}
