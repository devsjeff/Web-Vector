export type ServiceId =
  | "whatsapp"
  | "workflows"
  | "vector_memory"
  | "webhooks"
  | "scheduler"
  | "telegram"
  | "discord"
  | "slack"
  | "instagram"
  | "twitter"
  | "linkedin";

export type ServiceDefinition = {
  id: ServiceId;
  name: string;
  shortName: string;
  category: "core" | "workflows" | "channels";
  description: string;
};

export const services: ServiceDefinition[] = [
  {
    id: "whatsapp",
    name: "WhatsApp Automation",
    shortName: "WA",
    category: "core",
    description: "Live channel connection, search numbers, track chat counts, per-contact custom sarcasm/tones, and PgVector semantic recall.",
  },
  {
    id: "workflows",
    name: "Event & Workflow Automations",
    shortName: "WF",
    category: "workflows",
    description: "Trigger-based rule engine: automatic lead routing, customer qualification, follow-up chains, and multi-step agent actions.",
  },
  {
    id: "vector_memory",
    name: "PgVector Knowledge Bank",
    shortName: "KB",
    category: "core",
    description: "768-dimensional semantic vector database in PostgreSQL. Index, recall, and search long-term memory across all contact interactions.",
  },
  {
    id: "webhooks",
    name: "Webhooks & API Triggers",
    shortName: "WH",
    category: "workflows",
    description: "Real-time incoming and outgoing webhooks to synchronize CRM, Stripe payments, Calendly appointments, and custom backend systems.",
  },
  {
    id: "scheduler",
    name: "Scheduled Actions & Cron",
    shortName: "CR",
    category: "workflows",
    description: "Automated timed campaigns, morning summary reports, recurring follow-ups, and scheduled reminders.",
  },
  {
    id: "telegram",
    name: "Telegram Automation",
    shortName: "TG",
    category: "channels",
    description: "Telegram bot pipelines, group moderation, customer broadcast automations, and intelligent agent turns.",
  },
  {
    id: "discord",
    name: "Discord Bot Agent",
    shortName: "DC",
    category: "channels",
    description: "Community automation, role assignment workflows, ticket triage, and conversational server assistant.",
  },
  {
    id: "slack",
    name: "Slack Ops Assistant",
    shortName: "SK",
    category: "channels",
    description: "Internal team workflow notifications, daily standup summaries, database lookup commands, and issue triage.",
  },
  {
    id: "instagram",
    name: "Instagram Direct Automation",
    shortName: "IG",
    category: "channels",
    description: "Story reply triggers, DM lead qualification, product catalog lookups, and auto-responder agent.",
  },
  {
    id: "twitter",
    name: "X / Twitter Automation",
    shortName: "X",
    category: "channels",
    description: "Automated thread generation, customer inquiry responses, brand sentiment tracking, and keyword alerts.",
  },
  {
    id: "linkedin",
    name: "LinkedIn Lead Assistant",
    shortName: "IN",
    category: "channels",
    description: "Professional relationship manager, meeting scheduling assistant, and warm outreach automations.",
  },
];
