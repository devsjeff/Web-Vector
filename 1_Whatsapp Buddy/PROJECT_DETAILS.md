# Project Plan

## 1. Idea

### What am I building?

I am building a **WhatsApp AI Assistant** that can act as an intelligent assistant for a person or a business.

The assistant will be able to:

* Read and respond to WhatsApp messages.
* Generate quick replies based on the conversation.
* Understand the user's context and previous conversations.
* Use an owner's custom context, instructions, and preferences.
* Access the web when necessary.
* Access a calendar and perform calendar-related actions.
* Schedule, confirm, reschedule, or cancel appointments.
* Perform actions through external APIs/tools.
* Remember useful information about individual users.
* Provide a web dashboard where the owner can control, configure, and monitor the assistant.

The long-term goal is to make the assistant capable of taking on a **role on WhatsApp**, rather than simply being a chatbot.

For example:

> A hospital could use it as a WhatsApp appointment assistant.

> A hotel could use it to answer questions and manage bookings.

> A business could use it to answer customers and manage orders.

> A school could use it to handle common parent/student queries.

---

## 2. Goal

### Why am I building it?

The main goal is to automate repetitive conversations and business operations through WhatsApp.

The system should allow different types of organizations to configure the assistant for their own use case.

Examples:

* Hospitals → appointment scheduling
* Hotels → room inquiries and bookings
* Restaurants → orders and reservations
* Schools → common questions and notifications
* Businesses → customer support and lead management
* Individuals → personal WhatsApp assistant

The project should eventually become a **general-purpose AI assistant platform**, where the owner can configure what the assistant knows, what it can access, and what actions it is allowed to perform.

---

## 3. Core Features

### 3.1 AI Chat

* AI-powered replies
* Quick replies
* Conversation understanding
* Context-aware responses
* Hinglish / multilingual support
* Tone-aware responses
* Human-like conversational flow

### 3.2 Owner Context

The owner should be able to provide information about themselves or their business.

Examples:

* Business information
* Working hours
* Services
* Pricing
* Policies
* Communication style
* Frequently asked questions
* Custom instructions

The AI uses this information when generating responses.

---

### 3.3 Work / Business Context

The assistant should understand what the owner or business is currently doing.

For example:

```text
Business:
Dental Clinic

Working hours:
10 AM - 7 PM

Services:
- Dental cleaning
- Root canal
- Dental consultation

Appointment duration:
30 minutes
```

The assistant can use this context while communicating with customers.

---

### 3.4 User Memory

The system should maintain useful memory for individual WhatsApp users.

Example:

```text
User:
Rahul

Previous information:
- Interested in dental consultation
- Preferred appointment time: evening
- Previous appointment: 2 September
```

The AI can use relevant previous information when responding.

Memory should eventually support both:

* Short-term conversation context
* Long-term user memory

---

### 3.5 Web Access

The assistant can use web search when required.

Examples:

* Search current information
* Find a website
* Research a question
* Retrieve information requested by the user

Web access should be configurable by the owner.

---

### 3.6 Calendar Access

The assistant can interact with a calendar.

Possible actions:

* Check availability
* Create appointment
* Confirm appointment
* Reschedule appointment
* Cancel appointment
* Check upcoming appointments
* Send appointment information to the user

Example:

```text
Customer:
Can I book an appointment tomorrow at 5 PM?

AI:
Checks calendar
        ↓
Finds available slot
        ↓
Creates appointment
        ↓
Confirms through WhatsApp
```

---

### 3.7 Tools / Actions

The AI should not only generate text.

It should eventually be able to **use tools**.

Possible tools:

```text
AI
 ├── Web Search
 ├── Calendar
 ├── Database
 ├── WhatsApp
 ├── Booking System
 ├── Order System
 └── External APIs
```

The AI decides when a tool is required based on the user's request and the permissions configured by the owner.

---

### 3.8 Web Dashboard

A web dashboard will allow the owner to control the assistant.

Possible dashboard features:

* Login / authentication
* WhatsApp connection status
* Enable / disable AI
* Configure AI instructions
* Add owner context
* Manage business context
* View conversations
* Manage user memory
* Configure tools
* Configure calendar
* Configure web access
* Manage permissions
* View activity/logs
* Customize assistant behavior

---

## 4. Tech Stack

### Frontend

* React
* Next.js
* TypeScript
* Tailwind CSS

### Backend

* Python
* FastAPI

### Database

* PostgreSQL
* pgvector

PostgreSQL will store normal application data.

pgvector will be used when vector-based semantic search / memory is required.

### Cache / Temporary Data

* Redis

Possible uses:

* Caching
* Temporary conversation state
* Rate limiting
* Queues / background jobs
* Session-related data

### AI

* OpenRouter initially

The AI layer should be designed so that different models/providers can be added later.

### WhatsApp

Initial development:

* WhatsApp Web automation

Future production direction:

* Official WhatsApp Business / Cloud API

### Infrastructure

Potential technologies:

* Docker
* Nginx
* AWS
* Cloudflare
* Kubernetes
* Linux
* CI/CD

Not every infrastructure technology needs to be used from day one.

The architecture should allow the system to scale gradually.

---

# 5. High-Level Architecture

The basic idea:

```text
                    ┌─────────────────┐
                    │   Web Dashboard │
                    │   Next.js       │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │    FastAPI      │
                    │    Backend      │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
        PostgreSQL         Redis        AI Provider
        + pgvector                       OpenRouter
              │                             │
              │                             ▼
              │                         AI Agent
              │                             │
              │              ┌──────────────┼──────────────┐
              │              │              │              │
              │              ▼              ▼              ▼
              │         Web Search      Calendar      Other APIs
              │
              ▼
         User Memory
```

WhatsApp sits at the communication layer:

```text
WhatsApp User
      │
      ▼
 WhatsApp
      │
      ▼
 WhatsApp Integration
      │
      ▼
 FastAPI Backend
      │
      ▼
 AI Agent
      │
      ├── Memory
      ├── Owner Context
      ├── Business Context
      ├── Web
      ├── Calendar
      └── Other Tools
      │
      ▼
 Response
      │
      ▼
 WhatsApp User
```

---

# 6. AI Agent Architecture

The AI should not directly have unlimited access to everything.

Instead, it should have controlled tools.

```text
                    AI Agent
                       │
        ┌──────────────┼──────────────┐
        │              │              │
     Context          Memory         Tools
        │              │              │
   ┌────┼────┐         │       ┌──────┼──────┐
   │    │    │         │       │      │      │
Owner Work User     pgvector   Web Calendar API
Context Context Context
```

The agent receives:

1. Current user message
2. Recent conversation
3. Relevant long-term memory
4. Owner context
5. Business/work context
6. Available tools
7. Tool permissions

Then it decides whether to:

* Reply directly
* Search the web
* Check the calendar
* Perform an action
* Ask the user for missing information
* Refuse an action it is not allowed to perform

---

# 7. Database Design

Initial entities may include:

```text
users
owners
businesses
conversations
messages
memories
owner_context
business_context
tools
tool_permissions
appointments
integrations
```

Possible relationship:

```text
Owner
 │
 ├── Business
 │
 ├── Conversations
 │      └── Messages
 │
 ├── Memories
 │
 ├── Context
 │
 ├── Tools
 │
 └── Integrations
         └── Calendar
```

The exact database schema will be designed after the core workflow is finalized.

---

# 8. API Design

The backend will expose APIs for the dashboard and internal systems.

Possible API groups:

```text
/auth
/users
/conversations
/messages
/memory
/context
/tools
/calendar
/integrations
/settings
/whatsapp
```

Example:

```text
POST   /auth/login
GET    /conversations
GET    /conversations/{id}
GET    /memory/{user_id}
POST   /memory
GET    /settings
PUT    /settings
POST   /calendar/appointment
GET    /calendar/availability
```

The exact endpoints will be decided during implementation.

---

# 9. Project Folder Structure

Initial structure:

```text
whatsapp-ai-assistant/
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── agents/
│   │   ├── models/
│   │   ├── services/
│   │   ├── tools/
│   │   ├── database/
│   │   └── main.py
│   │
│   ├── tests/
│   └── requirements.txt
│
├── frontend/
│   └── ...
│
├── whatsapp/
│   └── ...
│
├── infrastructure/
│   ├── docker/
│   ├── nginx/
│   └── kubernetes/
│
├── docs/
│   ├── ARCHITECTURE.md
│   └── API.md
│
├── PROJECT_PLAN.md
├── README.md
└── .gitignore
```

This structure can change as the project grows.

---

# 10. External Tools / APIs

The assistant will eventually communicate with external services through tools.

Examples:

```text
AI Provider
     ↓
Web Search API
     ↓
Calendar API
     ↓
WhatsApp API
     ↓
Booking API
     ↓
Payment API
     ↓
Business-specific APIs
```

The system should use a common tool interface so that new tools can be added without rewriting the entire AI system.

---

# 11. Development Plan

## Phase 1 — Basic WhatsApp AI

1. Set up project
2. Connect WhatsApp Web
3. Receive messages
4. Send messages
5. Connect AI
6. Generate replies

## Phase 2 — Context

7. Add conversation history
8. Add owner context
9. Add business/work context
10. Improve prompt structure

## Phase 3 — Database

11. Set up PostgreSQL
12. Store users
13. Store conversations
14. Store messages
15. Store memory

## Phase 4 — AI Memory

16. Add pgvector
17. Create embeddings
18. Store relevant memories
19. Retrieve relevant memories
20. Give memories to the AI

## Phase 5 — Tools

21. Create tool system
22. Add web search
23. Add calendar
24. Add external API tools
25. Add tool permissions

## Phase 6 — Dashboard

26. Build authentication
27. Build dashboard
28. Add assistant settings
29. Add context management
30. Add conversation management
31. Add tool configuration

## Phase 7 — Reliability

32. Error handling
33. Logging
34. Rate limiting
35. Background jobs
36. Retry system
37. Testing
38. Security

## Phase 8 — Deployment

39. Dockerize services
40. Configure Nginx
41. Deploy to AWS
42. Configure Cloudflare
43. Monitoring
44. CI/CD

## Phase 9 — Scaling

45. Redis
46. Worker system
47. Queue architecture
48. Horizontal scaling
49. Kubernetes if actually required
50. Production WhatsApp API

---

# 12. Future Ideas

The platform can eventually support different business-specific assistant modes.

### Healthcare

* Appointment booking
* Appointment reminders
* Doctor availability
* Basic FAQs

### Hotels

* Room inquiries
* Booking
* Cancellation
* Check-in information

### Restaurants

* Menu
* Orders
* Reservations
* Order status

### Schools

* Common questions
* Schedule information
* Notifications
* Event information

### Businesses

* Customer support
* Lead qualification
* Order management
* Appointment scheduling

### Personal Assistant

* Calendar
* Reminders
* Web research
* Personal information
* Daily tasks

These are future use cases rather than requirements for the first version.

---

# 13. Important Design Principles

### 1. Tool-based architecture

The AI should use tools to perform actions rather than having direct uncontrolled access to external systems.

### 2. Permission-based actions

The owner should control what the AI is allowed to do.

For example:

```text
Web Search       → ON
Calendar         → ON
Create Booking   → ON
Cancel Booking   → OFF
Send Payment     → OFF
```

### 3. Separation of concerns

Keep different responsibilities separate:

```text
WhatsApp → communication
FastAPI  → application/backend
AI Agent → reasoning
Postgres → permanent data
Redis    → temporary/fast data
pgvector → semantic memory
Tools    → external actions
Next.js  → dashboard
```

### 4. Provider independence

The AI system should not be tightly coupled to one AI provider.

OpenRouter can be used initially, while the architecture should allow other providers/models later.

### 5. Start simple, scale later

Do not introduce Kubernetes, complex distributed systems, or unnecessary infrastructure in the first version.

First prove that the assistant works.

---

# 14. Why I Chose This Project

I chose this project because it combines many areas I am interested in and want to demonstrate:

* Python
* FastAPI
* React
* Next.js
* TypeScript
* PostgreSQL
* Redis
* Vector databases
* AI / LLMs
* APIs
* WebSockets
* Playwright
* Docker
* Linux
* AWS
* Cloudflare
* Nginx
* DevOps
* System architecture

More importantly, this is not just a technology showcase.

The project solves a real problem:

> **Give a person or business an AI-powered role on WhatsApp that can communicate with users, remember context, access information, and perform useful actions.**

The project will start as a learning/prototype system and can gradually evolve toward a production-ready platform.
