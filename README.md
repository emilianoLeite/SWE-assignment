# Home Assignment — Software Engineer (AI native)


## Questions
- What does the "AI not active" toggle do?
- What are the minimum required channels for the demo?


## Business Rules
- Human user can only reply to whatsapp messages when AI is not active
- Human user cannot reply to on=site message, that's always managed by an AI agent


## Context

TextYess is the AI-first CRM for e-commerce. We help brands build real relationships with their customers — automating and personalizing conversations across WhatsApp, email, and voice, and connecting every interaction to revenue.

Today, each channel lives in its own silo. WhatsApp conversations are in one place, email campaigns are in another, and voice call records are somewhere else entirely. Operators who need to understand a customer's full history have to jump between views and piece things together manually.

Your task is to fix that.

---

## The Task

**Build a Unified Inbox.**

Design and implement a feature that brings conversations from multiple channels — at minimum WhatsApp, email, voice and onsite are a bonus  — into a single, coherent inbox experience.

To get a sense of how the current inbox works, here is a short walkthrough of the existing product: [Inbox overview →](https://www.loom.com/share/b0634150ce3e4e329fb751bd4829d46d)

This is intentionally open-ended. We want to see how you think about a product problem before you write a single line of code. A good solution requires making deliberate choices about data modeling, UX, and scope — not just wiring up endpoints.

---

## Stack

Context7 ids are between parenthesis.

Our codebase is a **TypeScript** (`/microsoft/typescript`) monorepo using **pnpm workspaces** (`/pnpm/pnpm`) and **Turborepo** (`/vercel/turborepo`). We work with:

- **Backend** — NestJS (`/nestjs/docs.nestjs.com`), MongoDB (`/mongodb/docs`) (Mongoose (`/automattic/mongoose`)), REST
- **Frontend** — Next.js (`/vercel/next.js`), Tailwind CSS (`/tailwindlabs/tailwindcss.com`), shadcn/ui (`/shadcn-ui/ui`), React Query (`/tanstack/query`), Cypress for e2e tests (`/cypress-io/cypress-documentation`)
- **Shared** — packages for models, UI components, and locales

We also provide a `tailwind.config.js` with our design tokens already set up. Use it as a reference to stay consistent with our visual language.

We prefer you work within this stack, but it is not a hard requirement. If you are more productive in a different stack, use it — just be ready to explain the tradeoff. Whatever you choose, keep the dependency footprint lean.

---

## Guidelines

A few things to keep in mind as you approach this:

**Think in product terms first.** Before modeling a schema or building a component, ask what an operator actually needs when they open the inbox. What makes a conversation actionable? What makes it easy to triage?

**Design for heterogeneity.** WhatsApp, email, and voice are structurally different. A WhatsApp message has buttons. An email has a subject and thread. A voice call has a transcript and a duration. Your data model needs to handle this without forcing everything into the same shape.

**Scope deliberately.** Two to three days is not enough to build everything. Decide what the core of the feature is and build that well. A focused, working MVP is better than an ambitious half-finished one. Document what you would build next and why.

**The UI matters.** This is a product you would use every day. The inbox should feel fast, clear, and easy to scan. Think about information hierarchy: what does an operator need to see at a glance vs on demand?

**Write code you would ship.** We will read your code as closely as we watch what you built. Structure, naming, and separation of concerns matter.

---

## Requirements

- **Use coding agents for the majority of the work.** This is an AI-native role — we expect you to leverage AI coding agents (Cursor, Claude Code, Copilot, or equivalent) as your primary development tool. How you prompt, direct, and collaborate with agents is part of what we evaluate.
- **Timeline is 3 days** from the moment you receive this assignment.
- **For any clarification**, reach out to Valdo directly on LinkedIn or WhatsApp. Do not hesitate — a good question is a signal too.

---

## Deliverables

- A working full-stack feature inside the monorepo structure
- A short written note (can be in the PR description or a separate file) covering:
  - The product decisions you made and why
  - What you cut and what you would build next
  - Any assumptions you made about the business or the users

---

## What We Evaluate

- **Product thinking** — did you make the right tradeoffs? does the result solve the actual problem?
- **Backend design** — is the data model clean and extensible? are the APIs well-structured?
- **Frontend quality** — is the UI functional and thoughtful? does it handle real-world edge cases?
- **Code clarity** — is the code easy to read, maintain, and extend?
- **Communication** — can you clearly explain the choices you made?

---

Good luck.
