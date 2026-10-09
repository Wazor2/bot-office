# Bot Office — implementation plan

## Product outcome

Build Bot Office as a project-focused AI team workspace that feels like a normal chatbot. A user starts a project conversation, types a brief and adds material; a left sidebar shows available AIs and lets the user assign providers/models to roles. The Supervisor owns the run: it plans work, delegates independent tasks, receives workers’ results and questions, handles technical blockers, asks the user only for intent/preference decisions, corrects or retries work, and reviews evidence before calling anything complete. The user can see progress and current activity throughout.

Cloud AI APIs are the primary workers; official coding-agent CLIs are also supported, and Ollama is an optional secondary fallback. Do not automate consumer desktop apps or bypass provider quotas/terms. Prefer eligible free tiers and clearly show usage/limits; do not promise unlimited cloud AI for free. Do not publish the app without the user explicitly asking.

## Delivery approach

Build incrementally in this managed React/Express/tRPC/Drizzle project. The full requested scope remains the target, but the first release should be a safe, usable vertical slice rather than an unverified claim that every agent/runtime is production-ready.

1. **Workspace foundation:** replace the starter screen with a responsive chat workspace: project/conversation navigation, center conversation and composer with material attachment affordance, provider/role sidebar, and a collapsible live activity panel. Use real persisted project and conversation records, task/run state, provider metadata, worker events and audit records. Make empty, loading, connected, paused, waiting-for-user and error states clear.
2. **Supervisor and provider APIs:** define provider/worker contracts and structured task/result messages; add a Supervisor flow that can plan, dispatch compatible roles concurrently, receive results/blockers, resolve technical questions, ask the user when intent is required, request corrections and summarize evidence. Implement server-side adapters for configured official cloud APIs behind one router; stream run events to the UI, enforce bounded retries and log failover reasons. Never send provider credentials to browser code or logs.
3. **Safe credential and provider settings:** let the operator add/remove providers, select models and roles, enable/disable/reorder providers, test connectivity and see masked credential status. Store credentials only through a server-side encrypted vault with an operator-controlled secret; persist provider metadata separately. Add the credential-input flow only after the vault design and access boundary are implemented. Keep this preview private; before public release, implement and verify application-level authentication and per-user authorization.
4. **Worker execution:** add an isolated worker-runner boundary for supported official CLIs and repository operations. Workers receive task-scoped files, allowed tools/commands, budgets and acceptance criteria; use isolated Git worktrees/sandboxes, retain patches/commits and command/test evidence, and require approval for destructive/protected/production/network-sensitive operations. The web server must not execute arbitrary commands directly from chat content. Continue with the Docker Compose self-hosting path once the managed vertical slice is stable.
5. **Completion and operations:** add correction/retry/reassign/pause/resume/cancel controls, provider health and recovery without interrupting active work by default, usage/budget visibility, final evidence-based reports, security review, tests, operations documentation and the larger documentation set requested in the project brief. Restore a preferred provider only after health recovery and according to policy.

### MVP boundary and dependencies

The managed web project supplies the app shell, backend, database and preview. It does not supply users’ OpenAI/Anthropic/Gemini API keys, free-tier quota, or arbitrary provider CLIs. Real cloud requests require credentials and remain subject to each provider’s own terms, quotas and possible charges. Official CLIs require a separately deployed/installed trusted worker runner; they are not assumed to exist in the managed web server. Ollama stays optional. Never display mocked activity as real AI execution; mark any fixtures/demo state clearly.

The application should be prepared for self-hosting, but the first managed preview is not a public deployment. Provider credentials must remain server-side, be masked in the UI and never be written to source, Git, logs or ordinary plaintext database fields. Development and publishing share the managed database, so schema/data changes must be additive and intentional.

## Implementation structure

Use the actual starter layout first; avoid premature microservices. Keep clear module boundaries so a later self-hosted API/worker split is possible.

- `client/src/pages/` and `client/src/components/`: chat workspace, navigation, provider/role controls, activity stream, run review and settings.
- `server/routers.ts`: typed tRPC entry points; add focused modules under `server/` for projects/conversations, orchestration, providers, runs/events, security/credential vault, repositories/sandbox runner and reports.
- `drizzle/schema.ts` and migrations: users/owner scope as needed, projects, conversations/messages, providers (no plaintext secrets), role assignments, runs/tasks/dependencies, worker events, evidence, budgets and audit records.
- `shared/`: shared schemas, states, worker contracts and validated event types.
- Later self-hosted extraction: `apps/api`, `apps/dashboard`, `apps/worker`, `packages/domain`, `packages/providers`, `packages/orchestration`, `packages/sandbox`, `packages/observability`, `infra/`, `docs/` and `tests/`, preserving the user’s requested repository structure where practical.

## Design direction

- **Design movement:** precision editorial / contemporary mission-control software; practical, composed and legible rather than sci-fi decoration.
- **Core principles:** show ownership of every task; make the feedback loop visible; keep the user in control; make failures and limits understandable.
- **Color philosophy:** warm paper/soft graphite surfaces for long reading, deep ink for structure, and an ownable signal-lime/teal accent for active work; reserve amber/red for waiting, limits and failures. Avoid default all-purple AI gradients.
- **Layout paradigm:** a three-zone command desk rather than a centered landing page: slim project rail, role/provider list at left, generous chat canvas, and a right-side activity/evidence drawer that can collapse on small screens.
- **Signature elements:** a small connected-node relay mark; role-colored identity dots and compact chips; a thin dispatch trace that visually links supervisor, worker and review states.
- **Interaction philosophy:** actions are explicit and reversible; tasks show who owns them and what is blocking them; worker questions return to the Supervisor; user questions appear inline with a clear resume action. No silent auto-merge or hidden cost/limit changes.
- **Animation:** restrained 140–220 ms transitions for panels/status changes; a subtle pulse only for active work; no looping motion for idle workers; honor reduced-motion preferences.
- **Typography:** a neutral high-legibility sans for interface and conversation, paired with a compact monospace for task IDs, commands, test output and usage details; strong hierarchy without oversized marketing headings.
- **Brand essence:** “A coordinated AI team for projects, with a human-readable chain of command.” Personality: **clear, capable, accountable**.
- **Brand voice:** concise and informative. Example lines: “Give the team the brief. Stay in command.” “Two tasks are moving; one decision from you will unblock the next step.”
- **Wordmark/logo:** custom lowercase “bot office” wordmark with a linked three-node relay symbol, not a default-font-only title.
- **Signature brand color:** signal teal-lime, used sparingly for active delegation and confirmed progress.

## Constraints and decisions

- Use official APIs and supported CLIs only. Never automate ChatGPT/Claude/Gemini desktop apps or bypass provider quotas/terms.
- Cloud providers are primary; Ollama is optional secondary fallback.
- Support both APIs and CLIs; CLI execution belongs behind a trusted, isolated runner.
- Failover preserves context, is bounded, records the cause, and never retries invalid credentials/requests unchanged.
- Completion requires reviewable evidence, not a worker’s claim.
- Keep build stages small; do not claim the entire long-term specification is implemented after the first slice.
- Do not enable public publishing as part of this plan.
