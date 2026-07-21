# APPROVED DELIBERATE RALPLAN CONSENSUS — SOPscape Council

> Status: APPROVED consensus planning artifact; planning only, no product implementation performed.
> Ground truth: `.omx/specs/deep-interview-sopscape-council-ui-commercialization.md` and `.omx/tmp/official-docs-research.md`.
> Date: 2026-07-21. Deadline: 2026-07-27 23:59 UTC.
> Repository fact: **no SOPscape application source, package manifest, schema, test suite, or deployment configuration exists yet**. The only existing material is research/specification/runtime metadata. Every path below is proposed.

## 1. Requirements Summary

Build a greenfield TypeScript product in which one shared `SOPscape Core` accepts an SOP of roughly 15,000 Chinese characters, optionally compresses oversized sections, runs three independent specialists in parallel, then runs one moderator to produce a schema-valid rehearsal, report, and constrained `scene.json`.

The same core must be exposed through three non-interchangeable adapters:

1. a cinematic React/Tailwind web experience and stable share URL;
2. a free OKX.AI A2MCP HTTPS endpoint that returns direct HTTP 200 success responses and never issues a competition-time payment challenge;
3. a standard MCP server conforming to the current 2025-11-25 specification, using Streamable HTTP on `/mcp`, with tools, resource templates/resources, prompts, progress notifications, and secure stateful sessions.

The web experience must retain all confirmed scope: fixed Three.js holographic command room, GSAP-owned global choreography, three React Bits source components, three individually audited 21st.dev source components, visible multi-agent progress, meaningful user decisions that change both state and 3D consequences, a complete phishing-email rehearsal, near-60 FPS desktop performance, usable reduced-fidelity mobile at 45 FPS, and accessible DOM controls/results.

Commercialization is only a seam: document where OKX Payment SDK middleware will later wrap A2MCP. Do not install or ship payment/x402 code during the competition.

### Non-negotiable no-fallback constraint

There is no authorization to reduce full MCP, six source components, cinematic desktop quality, multi-agent reasoning, causal decision consequences, or early ASP review. “Fallback” below means runtime error containment (for example, preserving a usable canvas after malformed model output), **not feature-scope reduction**. If delivery slips, report the slip; do not substitute a thin MCP or decorative landing page.

The binding user directive is preserved verbatim:

> The user explicitly selected `no-fallback`: full MCP, cinematic 3D, six external components, multi-agent analysis and review submission remain required even if the full combination is not ready by the planned internal checkpoint. Downstream planners must not silently replace this with a minimal-MCP fallback.

Allowed containment is limited to runtime limits, same-slot component substitution, the already-approved mobile fidelity reduction, and GPU implementation simplification that retains the cinematic/causal behavior. Forbidden reductions include thin MCP, moderation from fewer than all three specialists, fewer than six components, decorative-only decisions, or competition-time payment activation.

## 2. RALPLAN-DR

### Principles

1. **One domain truth, three adapters.** Parsing, orchestration, validation, persistence, evaluation, and report generation exist once in Core.
2. **Schemas before spectacle.** The shared contract and deterministic core tests precede protocol and renderer work; models may emit data, never code or arbitrary assets.
3. **Causality creates immersion.** Every major visual beat is driven by validated rehearsal/decision state, not an unrelated animation demo.
4. **Review clock is a first-class dependency.** A public free A2MCP vertical slice is submitted early while MCP and visual lanes continue in parallel.
5. **No silent scope negotiation.** Schedule controls sequencing, ownership, and verification frequency—not the confirmed feature set.

### Top 3 Decision Drivers

1. **External deadline and review latency:** deadline is 2026-07-27 23:59 UTC; review guidance is 24 hours to one business day but not an SLA. The plan must preserve an initial review plus one resubmission window.
2. **Cross-surface semantic consistency:** Web, A2MCP, and MCP must create/read/evaluate the same rehearsal IDs and structures while respecting different wire protocols.
3. **Cinematic reliability under model latency:** the 3D shell must become interactive around two seconds, show honest progress, and stay performant independently of a median 20-second / p95 45-second generation target.

### Viable Options

#### Option A — TypeScript workspace, Vite React client + one Fastify service (**chosen**)

Proposed shape: `apps/web`, `apps/server`, `packages/contracts`, `packages/core`; one server owns REST/A2MCP, MCP Streamable HTTP, share APIs/static artifact access, orchestration, and PostgreSQL access.

**Pros**

- A single language and contract package minimize schema drift.
- One backend process gives A2MCP and MCP distinct routes without duplicating core logic.
- Vite isolates the canvas/client build from server concerns and permits the 3D shell to load without waiting for generation.
- Fastify route/plugin boundaries support Origin/version/session checks and future payment middleware without a second service.

**Cons / bounds**

- Requires a small workspace and deployment setup from zero.
- Remote MCP integration against the pinned SDK must be proved early; framework glue cannot be assumed.
- A single service is a shared failure domain. This is accepted for the competition; health probes and protocol-level isolation are required.

#### Option B — Next.js full-stack application + dedicated MCP sidecar

**Pros**

- Strong page/share-route ergonomics and common hosting paths.
- Separate MCP process isolates long-lived Streamable HTTP/session behavior from the web runtime.

**Cons / bounds**

- Two deployables, duplicated operational configuration, cross-service auth/networking, and more cold-start surfaces.
- Serverless/edge constraints may conflict with MCP GET streaming and stateful sessions.
- More integration work before the first public A2MCP submission.

This remains viable if the selected deployment platform cannot host one long-lived Fastify process, but is not preferred under the six-day constraint.

#### Option C — Single Next.js process including MCP route handlers

**Pros:** few initial projects and convenient share pages.
**Cons:** current hosting/runtime behavior for long-lived Streamable HTTP and sessions becomes the critical uncertainty; framework coupling offers no product value. It is not selected unless a proof against the exact deployment target passes on Day 1.

### Chosen option

Choose **Option A**. It is the smallest architecture that preserves all three surfaces and current MCP semantics without assuming a serverless transport. Keep it as one deployable backend and one static client build; do not introduce queues, microservices, provider factories, an ORM, or a generalized event bus unless a measured blocker appears.

## 3. Target Architecture and Boundaries

```text
apps/web (React/Tailwind/Three/GSAP)
       | POST /api/rehearsals, GET /api/rehearsals/:id, POST .../decisions
       v
apps/server
  /a2mcp/generate-rehearsal  direct HTTP request/result contract
  /mcp                       MCP JSON-RPC + Streamable HTTP + sessions
  /api/*                     web/share JSON
       | all call the same application functions
       v
packages/core
  parse -> optional compress -> 3 parallel specialists -> moderator
  validate -> persist -> evaluate decision -> report/scene
       |
       v
PostgreSQL + one server-side model SDK

packages/contracts is imported by web/server/core; it contains data schemas only.
```

### API and schema boundaries

### Normative Core API and lifecycle

Adapters may map transport semantics, but may not parse SOPs, call agents, moderate, persist domain output, or evaluate decisions themselves.

```ts
startGeneration(
  input: SopInput,
  idempotencyKey: string,
  progressSink: (event: GenerationProgress) => void,
  abortSignal: AbortSignal,
  deadline: MonotonicDeadline,
): Promise<{ rehearsalId: string; completion: Promise<InternalRehearsal> }>

getRehearsal(id: string): Promise<InternalRehearsal | null>

evaluateDecision(
  id: string,
  node: string,
  choice: string,
  expectedVersion: number,
): Promise<InternalRehearsal>

toWebOwnerProjection(rehearsal: InternalRehearsal): WebOwnerRehearsal
toWebShareProjection(rehearsal: InternalRehearsal): WebShareRehearsal
toA2mcpProjection(rehearsal: InternalRehearsal): A2mcpResult
toMcpProjection(rehearsal: InternalRehearsal): McpRehearsalResource
```

`MonotonicDeadline` is an absolute timestamp from the injected monotonic clock, never a relative timeout reset by a stage. `startGeneration` validates once, creates/reuses the durable job transactionally, and returns a common completion promise. Web returns after obtaining the ID; A2MCP and MCP await the same promise. `progressSink` is a delivery observer only. It cannot alter orchestration. Adapter disconnect/cancel unregisters that subscriber; the job is aborted only when the creating subscriber cancels and no other subscriber is attached. A reused idempotent job is never cancelled by a later observer detaching.

For Web creation, `createWebGeneration` wraps the job row, idempotency row, and owner-capability hash in **one database transaction**; the job is not enqueued until commit. The plaintext 256-bit owner capability exists only in response memory. A disconnect before commit rolls back all three records. A lost `202` after commit creates a secure orphan: the capability is not recoverable or reissued, UUID/idempotency key cannot authorize it, and an unauthenticated duplicate returns only `IDEMPOTENT_RESULT_EXISTS`. The orphan is deleted by the normal seven-day retention job; rate/idempotency limits bound accidental duplicate cost. A user may start a new generation with a new idempotency key, but no recovery path weakens authorization.

State machine:

```text
QUEUED -> COMPRESSING? -> SPECIALISTS_RUNNING -> MODERATING -> PERSISTING -> READY
   |          |                   |                  |            |
   +----------+-------------------+------------------+------------+-> FAILED
   +----------+-------------------+------------------+------------+-> CANCELLED
READY | FAILED | CANCELLED -> EXPIRED
```

- `COMPRESSING` is skipped when the direct-analysis threshold is not crossed.
- No backward, terminal-to-active, or direct `SPECIALISTS_RUNNING -> READY` transition is legal.
- Moderation begins only if **all three** specialist outputs validate. No partial-agent moderation is permitted.
- Retry policy and arithmetic are enforced by one immutable per-job `AttemptBudget`, shared by every provider call. Optional compression gets **1 attempt, no retry, 1,200 output-token cap**. Each of the three specialists gets **up to 2 attempts, 1,200 output-token cap per attempt**. The moderator gets **up to 2 attempts, 2,000 output-token cap per attempt**. Thus the exact worst case is `1 + (3×2) + 2 = 9` provider calls and `1,200 + (6×1,200) + (2×2,000) = 12,400` reserved attempted-output tokens; without compression it is 8 calls/11,200 tokens. When an attempt starts, the budget atomically increments the call counter and permanently debits that attempt’s **full cap**, even if it fails, is cancelled/malformed/timed out, or uses fewer tokens; unused reservation is not recycled into another role. A separate observed-usage counter records provider-reported usage for cost metrics and charges the full cap when usage is unavailable. A retry starts only if its full cap was preallocated and the stage/absolute deadline permits it. A successful specialist always retains its full 1,200 cap and a successful moderator its full 2,000 cap; retry accounting may never shrink those caps. Schema repair is the one retry, never a hidden third call. Retries are allowed only for specialists/moderator on retryable transport/5xx/rate-limit or invalid structured output; compression failure fails the job. Input token admission is checked before queueing; jobs estimated above 100,000 aggregate provider input tokens are rejected as `INPUT_BUDGET_EXCEEDED` (tunable default).
- For non-A2MCP jobs the initial stage ceilings remain compression 8 seconds, parallel specialists 22, moderator 25, persistence 2, overhead 3 under a 60-second hard deadline. Every stage also clips itself to the caller-supplied absolute deadline; no retry starts with less than the role’s configured minimum response window.
- The transaction creating a job has a unique `(adapter_namespace, idempotency_key)` and records the validated input digest. The same key with another digest is `IDEMPOTENCY_CONFLICT`. For a duplicate active Web call, only a request already carrying the matching owner capability may attach a new progress subscriber and receive the existing ID/completion; an unauthenticated duplicate receives `IDEMPOTENT_RESULT_EXISTS` with no capability or result. A duplicate A2MCP call with the same key/digest attaches to and awaits the existing job under its own absolute ingress deadline. A duplicate MCP call attaches only from the same live session. After restart, startup terminalizes persisted active jobs as `FAILED/SERVER_RESTART`; authenticated duplicates return that terminal result and never recreate or resume the old job. Idempotency rows expire after 24 hours (tunable).
- `evaluateDecision` locks/updates by `WHERE id=? AND version=?`; one successful decision increments `version`. A stale concurrent writer receives `VERSION_CONFLICT` with the current public version and must refetch. Decision write and updated result are one transaction.
- Cancellation/timeout writes one terminal state and aborts downstream provider calls. Late provider completions are discarded by terminal/version check.
- `InternalRehearsal` may contain private operational metadata. Only the four named projection functions can cross an adapter boundary; adapters cannot spread/serialize the internal object. Web-owner, read-only share, A2MCP, and MCP projections are distinct types and snapshot-tested independently.

### Initial numeric limits and resource isolation

All values in this subsection are **tunable defaults** stored in validated server configuration and recorded in benchmark evidence; changing them requires a test rerun, not a code fork.

| Control | Default |
|---|---:|
| Web/A2MCP JSON body | 128 KiB |
| MCP JSON body | 256 KiB |
| SOP content | 60,000 UTF-8 bytes and approximately 15,000 CJK characters |
| Generation global concurrency | 8 |
| Reserved generation slots | Web 2, A2MCP 2, MCP 4; unused slots may be borrowed but are preempted for their owner at the next dequeue |
| Bounded generation queue | 32 global, max 8 queued per IP/session |
| Active MCP SSE streams | 100 global, 2 per session, 10 per IP |
| Active MCP sessions | 1,000 global, 10 per IP; excess initialize receives HTTP 429 |
| Web generation rate | 5/min/IP, burst 2 |
| A2MCP generation rate | 3/min/IP, burst 1 |
| MCP initialize | 10/min/IP; messages 60/min/session; generation 2/min/session |
| Reads/share | 60/min/IP; decisions 20/min/capability |
| Core hard timeout | 60 seconds for Web/MCP; A2MCP uses the earlier absolute ingress deadline below |
| HTTP request timeout | 65 seconds; headers 10 seconds; keep-alive 5 seconds |
| Queue wait | 10 seconds, then `SERVER_BUSY`/transport equivalent |
| Provider concurrency | 8 calls global, max 3 per job at once |
| Provider breaker | open 30 seconds after 5 consecutive retryable failures or >=50% failure in the last 20 calls; one half-open probe |
| Provider daily spend guard | USD 50 equivalent, configured from verified pricing; reject new jobs when crossed |
| PostgreSQL connections | 20 total via distinct pools: generation/write 10, MCP/session 5, Web/share 5 |
| MCP session idle/absolute TTL | 30 minutes / 2 hours |
| Graceful drain | stop accepts immediately, allow 30 seconds for requests/jobs, then abort and terminalize |

Pool exhaustion returns bounded `SERVER_BUSY` errors and never creates an unbounded promise/task list. Readiness is false when migrations/DB are unavailable or generation queue is closed; liveness only proves the process/event loop. Shutdown stops new initializes/jobs, closes GET streams, aborts remaining provider calls after drain, records affected jobs `FAILED` with retryable `SERVER_RESTART`, and closes DB pools.

For A2MCP, one monotonic absolute deadline is created at the **earliest trusted ingress boundary**: the edge proxy strips any client value and injects an authenticated request-start timestamp; the server converts its elapsed age to a monotonic deadline in the first raw-request/`onRequest` hook before body parsing. Without that trusted header, the raw-request hook timestamp is used and the proxy-margin integration test becomes a release gate. The deadline is **58.0 seconds after the trusted first-byte timestamp**. It covers proxy transit visible through that timestamp, validation/admission, queueing, every provider attempt, persistence/projection, and response serialization. The chosen proxy must prove a >=65.0-second upstream deadline, leaving >=7.0 seconds to serialize/send the frozen 504 before proxy termination. A2MCP uses clipped ceilings: validation/admission/queue <=4.0 seconds; compression <=6.0; parallel specialist stage <=20.0; moderator <=23.0; persistence/projection <=2.0; success serialization <=1.0; timeout/error serialization reserve 2.0. Minimum useful windows are compression initial 4.0 seconds, specialist initial 6.0 seconds, specialist retry 5.0 seconds, moderator initial 8.0 seconds, and moderator retry 6.0 seconds (tunable defaults proven by provider benchmarks). At every boundary the next timeout is `min(stage ceiling, absoluteDeadline - now - 2.0s error reserve)`; no stage/retry starts when its minimum useful window would consume the reserve. At 58.0 seconds the request is already terminal `GENERATION_TIMEOUT`; it never begins a 60-second Core timer after queue admission. Web/MCP retain their own 10-second queue and 60-second job deadline because they do not promise the frozen synchronous A2MCP response.

Sidecar extraction is not prebuilt. Reconsider a dedicated MCP entrypoint if, after limit/pool tuning, **any** of these occurs in two consecutive 10-minute production-like soaks: MCP load worsens A2MCP p95 latency by >20%; event-loop lag p95 exceeds 100 ms while >=50 MCP streams are active; MCP needs >100 concurrent streams or a different release cadence; or an MCP failure causes two cross-adapter availability incidents. Extraction moves the adapter/transport only; Core/contracts/persistence remain shared.

### Privacy and public capability decision

- Raw SOP text exists only in bounded process memory during generation and is **not persisted by default**. PostgreSQL stores a SHA-256 input digest, optional sanitized title (200 characters), structured findings/scene/report, and operational metadata. Provider payloads/responses and hidden chain-of-thought are never stored.
- Rehearsals/decisions expire after 7 days; sanitized operational logs after 7 days; idempotency records after 24 hours; sessions as above. A daily deletion task marks `EXPIRED`, deletes result/decision rows, and removes capability mappings. These are tunable retention defaults disclosed in the UI/ASP description.
- A successful Web create response returns a **one-time 256-bit CSPRNG owner capability** in the JSON body with `{ rehearsalId, ownerCapability, statusUrl }`. Only its SHA-256 hash is stored; it is never placed in a URL, cookie, log, metric, trace, or later response. The client holds it in memory/session storage and sends `Authorization: Bearer <ownerCapability>` to status, decision, cancellation, and share-management APIs. The rehearsal UUID is identifier-only and never authorizes any operation.
- Owner-authorized `POST /api/rehearsals/:id/shares` creates a separate **192-bit CSPRNG read-only share capability**; only its SHA-256 hash is stored. `/r/:shareCapability` and its read API expose `WebShareRehearsal` only: no decision/cancel/share-management operation accepts a share token. Owner-authorized `DELETE /api/rehearsals/:id/shares/:shareId` revokes it immediately. Share expiry follows rehearsal expiry. Capability comparison is constant-time; there is no listing/search endpoint.
- `WebOwnerRehearsal` includes owner-visible status/version and allowed management metadata. `WebShareRehearsal` includes only version, ready status, sanitized title, structured consensus/disagreement/evidence gaps, allowed scene tokens, report, decision outcomes, and safe timestamps; it never exposes pending/internal errors or mutation affordances. Both exclude SOP text/digest, prompts, provider/model metadata, cost, sessions, IPs, and operational fields.
- A2MCP returns its own sanitized projection without a share capability unless the registered schema explicitly includes a generated share URL. MCP resources require the authorized live session and return an MCP-specific projection.

#### Shared domain contracts (`packages/contracts`)

- `SopInput`: `title`, `content`, optional `locale`, optional scenario metadata; enforce string/type/size limits at every public boundary.
- `SpecialistFinding`: role, claim, evidence references, confidence, severity, affected step IDs, unsupported flag.
- `CouncilSynthesis`: consensus, disagreements, evidence gaps, recommended path, decision nodes, consequence definitions.
- `SceneDocument`: schema version, agent states, evidence nodes, risk paths, decision nodes, camera cue IDs, palette/state tokens; only allow known enum/cue IDs and bounded arrays.
- `Rehearsal`: ID, status, progress phase, timestamps, input digest, synthesis, scene, report, errors safe for clients.
- `DecisionInput` / `DecisionResult`: decision node, selected option, resulting confidence/topology/consequence/next action.
- `ApiError`: stable machine code, safe message, retryability, request ID; never expose prompts, provider payloads, keys, or stack traces.

Use one runtime schema definition (Zod) and derive TypeScript types/JSON Schema from it. Store `schemaVersion` on persisted results. Do not maintain hand-written copies for each adapter.

#### Web JSON API

- `POST /api/rehearsals`: maps its Web DTO to `SopInput`, calls `startGeneration`, mints the owner capability transactionally, and returns it **once** in `202 { rehearsalId, ownerCapability, statusUrl }`; client receives progress via authenticated polling.
- `GET /api/rehearsals/:id`: requires the owner bearer capability and returns `WebOwnerRehearsal`. UUID alone, share capability, cross-rehearsal owner capability, revoked/expired/invalid capability all fail with the same non-enumerating response.
- `POST /api/rehearsals/:id/decisions`: requires owner bearer capability, validates a declared scene decision plus `expectedVersion`, and returns the owner projection.
- `POST /api/rehearsals/:id/shares` and `DELETE .../shares/:shareId`: owner-only creation/revocation of separate read-only capabilities.
- `GET /shares/:shareCapability` and client `/r/:shareCapability`: read-only share projection; never accepts decisions. Server data remains authoritative.

#### Free A2MCP

- `POST /a2mcp/generate-rehearsal`: at first-byte ingress creates the normative 58.0-second absolute deadline, maps the frozen A2MCP DTO to `SopInput`, calls `startGeneration` with that deadline, and synchronously awaits the common completion. A completion serialized before the deadline returns direct HTTP 200 and only the registered A2MCP result schema. When any clipped stage cannot finish while preserving the 2.0-second error reserve, cancel under the sole-owner rule and return the frozen A2MCP HTTP 504 `GENERATION_TIMEOUT` **by 58.0 seconds**, at least 7.0 seconds before the proven >=65-second proxy deadline. Never return a success-shaped partial result or asynchronous job URL unless that exact contract passes a new OKX review.
- No x402/payment challenge, payment headers, payment dependency, or hidden paid branch.
- Keep the future insertion point at Fastify route registration/pre-handler documentation, before adapter mapping and outside Core.
- A2MCP DTOs/errors are not MCP JSON-RPC DTOs/errors. Freeze the exact manifest, success, validation, busy, provider-failure, and 58-second ingress-timeout fixtures against the OKX.AI portal immediately before first submission; archive sanitized request/response fixtures and prove the chosen proxy/load balancer permits at least 65-second upstream requests.

#### Standard MCP

- Exactly one `/mcp` path supports POST/GET/DELETE Streamable HTTP; do not add legacy HTTP+SSE. Initialize is a POST without a session header. If the global 1,000/per-IP 10 active-session caps permit, the server negotiates a supported protocol version, returns a new 256-bit CSPRNG opaque `MCP-Session-Id` header, and stores only its SHA-256 hash bound to the current ephemeral `serverInstanceId`. All subsequent lookup predicates require both hashes/instance ID plus the negotiated `MCP-Protocol-Version`; missing/invalid versions are HTTP 400 and missing/unknown/old-boot/expired/terminated sessions are HTTP 404.
- POST validates `Origin`, `Content-Type`, `Accept`, JSON-RPC shape, protocol version, and session. It returns `application/json` for a single immediate response or `text/event-stream` when streaming is required by the pinned SDK/spec. JSON-RPC errors remain MCP errors; Core error details are sanitized before mapping.
- GET with a valid session and `Accept: text/event-stream` opens the server-to-client stream, sends keepalive comments at 15 seconds (tunable), and counts against stream caps. This plan deliberately provides **no event resumption**: it emits no resumable SSE event IDs and persists no transport events. Phase 0 runs the pinned SDK/spec compatibility suite before freezing `Last-Event-ID` behavior: prefer HTTP 400 rejection when permitted; if the suite requires another compliant non-resumption response, adopt and archive that exact fixture. Never imply replay or add event persistence for this release. A server restart invalidates live sessions/streams; durable rehearsals remain readable only through a newly initialized session and are not used to revive transport state.
- DELETE with a valid session terminates it, cancels session-owned in-flight requests, closes its GET streams, and returns HTTP 204. Repeated/unknown DELETE is HTTP 404. Idle/absolute expiry has the same terminal behavior.
- Client `notifications/cancelled` is matched to the JSON-RPC request ID. It aborts that tool subscriber, stops progress immediately, and cancels the Core job only under the sole-owner rule. Server disconnect/shutdown behaves likewise. No result/progress notification is emitted for that request after cancellation or any terminal job state.
- Declare tool/resource/prompt capabilities.
- Tools: `generate_rehearsal`, `get_rehearsal`, `evaluate_decision`.
- Resource templates: `sopscape://rehearsals/{id}/scene`, `sopscape://rehearsals/{id}/report`; static resource for available example scenarios.
- Prompts: `create_rehearsal_from_sop`, `review_sop_evidence`, `coach_rehearsal`.
- `generate_rehearsal` reads the **caller-supplied** `_meta.progressToken` without replacing or inventing it. If present, emit monotonic numeric progress for legal state transitions, echo the token exactly, and stop on result, error, cancellation, expiry, disconnect, or timeout. Without it, emit no progress notifications.
- Session state stores only bounded interaction context (maximum 10 rehearsal references and 32 KiB JSON, rehearsal ID, current decision, last activity), with expiry; durable rehearsal data stays in PostgreSQL. Session state is not resumable after process restart.
- Use standard MCP error structures at the protocol boundary and domain error codes inside tool results where applicable.

### Persistence

Use managed PostgreSQL with the existing team skill set, direct parameterized `pg` queries, and one SQL migration. Proposed tables:

- `rehearsals(id, status, version, schema_version, input_digest, sanitized_title, result_json, error_code, created_at, updated_at, expires_at)`;
- `decisions(id, rehearsal_id, node_id, choice_id, result_json, created_at)`;
- `idempotency(adapter_namespace, key_hash, input_digest, rehearsal_id, expires_at)`;
- `owner_capabilities(capability_hash, rehearsal_id, created_at, expires_at, revoked_at)`;
- `share_capabilities(id, capability_hash, rehearsal_id, created_at, expires_at, revoked_at)`;
- `mcp_sessions(id_hash, server_instance_id, state_json, last_seen_at, expires_at, absolute_expires_at)`.

Do not persist raw SOPs, provider responses, prompts, chain-of-thought, IPs, raw capability/session/idempotency values, or secrets.

At every process boot, generate an ephemeral 128-bit `serverInstanceId` in memory and, before readiness, transactionally delete all `mcp_sessions` plus terminalize persisted active jobs as `FAILED/SERVER_RESTART`. Every new session row carries the current instance ID; every lookup requires both `id_hash` and the in-memory `serverInstanceId`. Therefore even a failed purge cannot authenticate an old row, and a persisted session can never survive/revive across restart. The boot ID is intentionally not restored from disk.

## 4. Dependencies and Version Gates

All versions are pinned by lockfile at implementation time; the repository currently has no package manager or dependencies.

| Dependency | Purpose | Gate before adoption |
|---|---|---|
| Node.js current LTS + pnpm workspaces | runtime/build | Pin Node in `.nvmrc`/engines; verify target host supports it. |
| React + Vite + TypeScript + Tailwind CSS | web shell | Pin compatible stable majors; build a blank production bundle on target Node. |
| `three` | sole 3D renderer loop | Confirm `renderer.setAnimationLoop`, disposal, responsive DPR strategy; record benchmark version. |
| `gsap` + `@gsap/react` | sole global animation director | Use `useGSAP`, context cleanup, and `contextSafe`; confirm license/use terms and pinned versions. |
| `fastify` | one HTTP service | Verify streaming/raw response access needed by the MCP SDK on target host. |
| `zod` | runtime schemas and derived types | Confirm JSON Schema conversion supports the chosen model/MCP tool schemas without semantic drift. |
| `pg` | parameterized PostgreSQL access | TLS/deployment test; no ORM unless schema complexity proves it necessary. |
| official MCP TypeScript SDK | protocol implementation | **24-hour pre-implementation recheck.** Current v2 is pre-release; pin production-recommended v1.x unless official status changes. Verify against formal spec 2025-11-25 and SDK examples. |
| one official model-provider SDK | structured model output | Select using available credentials; verify official structured-output support, token controls, timeout/abort support, and current model availability before coding. One provider/model only. |
| Vitest + Playwright | unit/integration/browser tests | Confirm current stable versions work with Vite/Node/Chrome target. |

### Six source components (count is fixed; exact source is gated)

Freeze these six responsibility slots on Day 1. Candidate source selections are:

**React Bits (3):** `SplitText` (hero/title reveal), `GradientText` (CSS atmospheric/accent treatment), `Magnet` (high-impact pointer/CTA feedback).
**21st.dev (3):** a `Prompt Box` source variant (SOP command surface), an `Expandable Card` source variant (agent evidence/decision cards), and a `Timeline` source variant (rehearsal result/history).

Before copying each source file, record its exact page/author, commit or retrieval date, content hash, license/notice, transitive dependencies, keyboard/screen-reader behavior, reduced-motion behavior, bundle cost, and animation ownership. React Bits is MIT + Commons Clause, not plain MIT; preserve its notice and do not redistribute it as a component library. 21st.dev components are multi-author and must pass per-component review. Reject any selected variant that imports WebGL/canvas, starts a perpetual `requestAnimationFrame`, requires Framer Motion, or owns a global timeline; replace it **within the same responsibility slot** so the total remains three plus three. This is dependency substitution, not scope fallback.

### Immutable SceneAdapter and animation budget

`SceneAdapter.apply(snapshot: Readonly<SceneDocument | DecisionResult>)` is the only domain-to-renderer boundary. It validates/freezes the snapshot, diffs IDs into an internal renderer registry, and mutates only owned Three object refs/uniforms through imperative methods. It never mutates the snapshot. React stores coarse status, accessibility text, selected decision, and panel visibility only; it does not call `setState` per frame. Three.js alone owns one `renderer.setAnimationLoop`. GSAP timelines mutate registered camera/object/uniform refs and DOM refs, are created through `useGSAP`, and are reverted on scope unmount; event/delayed tweens use `contextSafe`.

Initial **tunable** render budgets:

- desktop DPR `min(devicePixelRatio, 1.75)`, mobile DPR <=1.25; resize only when CSS size/DPR changes;
- fixed room <=150 draw calls, <=250k visible triangles, <=64 MiB estimated texture memory, maximum two post-processing passes on desktop and zero/one on mobile;
- one directional + ambient lighting budget, <=2 shadow-casting lights, 1024² shadow maps desktop, shadows disabled/reduced mobile;
- hidden tab/component: pause Three loop, GSAP timelines, timers, and component effects within 250 ms; resume from current authoritative snapshot;
- reduced motion: no camera travel/parallax/pulsing; instant or <=100 ms opacity transitions while preserving state distinctions;
- every rehearsal reset/unmount kills timelines/listeners and disposes geometries, materials, textures, and render targets. `renderer.info` must return within 5% of the post-shell baseline after five completed/reset cycles.

Binary performance windows: production build, cache disabled for shell timing, five cold navigations; shell interactive median <=2.0 s and worst <=2.5 s on the named desktop/network profile. A 30-second primary desktop trace must have median >=55 FPS and 1% low >=45 FPS. A 30-second mobile trace must have median >=45 FPS and 1% low >=35 FPS. These operationalize “near 60” and mobile 45 without reducing the confirmed experience.

## 5. Adaptive Implementation Phases and Proposed Paths

Dates are UTC and assume work begins 2026-07-21. External submission/publishing requires the user's explicit approval at the action boundary. Owners are roles, not named people.

### Phase 0 — Evidence freeze and external gates (7/21, 2–3 hours)

**Deliverables**

- Confirm exact OKX.AI registration manifest and request/result fixture.
- Recheck MCP SDK release state/spec linkage; select pinned v1.x if v2 remains pre-release.
- Select the exact six component source variants and create their license/accessibility/dependency ledger.
- Select deployment host, managed PostgreSQL, concrete model/model SDK, desktop benchmark, and mobile handset (recommended baseline: iPhone 15/Safari-equivalent GPU class or Pixel 8/current Chrome; final choice must be physically available).
- Convert this plan into `.omx/plans/prd-sopscape-council.md` and `.omx/plans/test-spec-sopscape-council.md` after consensus.

**Exit:** no unresolved transport, host, credential, component-license, or test-device blocker.

### Phase 1 — Contracts, core skeleton, public vertical slice (7/21–7/22)

**Proposed paths**

```text
package.json
pnpm-workspace.yaml
tsconfig.base.json
.env.example
packages/contracts/src/{sop,rehearsal,scene,decision,errors}.ts
packages/contracts/src/index.ts
packages/core/src/{generate-rehearsal,evaluate-decision}.ts
packages/core/src/{lifecycle,idempotency,attempt-budget,projections,limits,privacy}.ts
packages/core/src/agents/{procedure-analyst,risk-challenger,evidence-auditor,moderator}.ts
packages/core/src/{compress,model-call,persistence}.ts
apps/server/src/{app,config,db}.ts
apps/server/src/routes/{api,a2mcp,health}.ts
apps/server/src/{security,capabilities,rate-limits,resource-pools,shutdown}.ts
apps/server/src/jobs/retention.ts
apps/server/migrations/001_initial.sql
tests/fixtures/{phishing-sop,model-responses}/*
tests/unit/{lifecycle,idempotency,attempt-budget,projections,privacy,limits}.test.ts
tests/integration/{concurrency,retention,shutdown,resource-pools}.test.ts
tests/integration/a2mcp/{registered-fixtures,timeout,proxy,no-payment}.test.ts
```

Write schema tests first, then implement a deterministic fixture-backed core and public A2MCP route. Add real model calls only after fixture orchestration proves three-parallel-then-moderator ordering, validation, timeout, and persistence. Deploy the HTTPS endpoint and run cold-start smoke tests.

**Review checkpoint:** target first OKX.AI submission **by 2026-07-23 12:00 UTC at the latest**, leaving more than four days to the final deadline. Target first review result by 7/24–7/25; reserve a resubmission target no later than **2026-07-25 12:00 UTC**. Review timing is not an SLA, so status is checked twice daily. Do not wait for the cinematic UI or full MCP to begin review, but do not represent incomplete features as complete in listing material.

### Phase 2 — Full MCP adapter (7/22–7/23)

**Proposed paths**

```text
apps/server/src/mcp/{server,transport,sessions,boot-instance,progress}.ts
apps/server/src/mcp/{cancellation,projection}.ts
apps/server/src/mcp/{tools,resources,prompts}.ts
tests/integration/mcp/{initialize,post-get-delete,version-origin,tools,resources,prompts,progress,cancellation,sessions,restart,errors}.test.ts
```

Mount official SDK Streamable HTTP at `/mcp`; implement all declared capabilities against Core. Test initialize/version/session lifecycle, Origin rejection, tool schemas, resource templates, prompt rendering, progress monotonicity/termination, invalid session behavior, and concurrency. Run the official inspector/compatible client if available in the pinned SDK toolchain. Full MCP is a release gate, not a post-deadline enhancement.

### Phase 3 — Cinematic shell and staged progress (7/22–7/24, parallel with Phase 2)

**Proposed paths**

```text
apps/web/src/{main,App}.tsx
apps/web/src/styles/{theme,motion}.css
apps/web/src/features/rehearsal/{SopCommand,AgentCouncil,DecisionPanel,ReportTimeline}.tsx
apps/web/src/scene/{CommandRoom,SceneAdapter,materials,dispose}.ts
apps/web/src/scene/{render-loop,quality-profile}.ts
apps/web/src/motion/{director,camera-cues}.ts
apps/web/src/components/vendor/react-bits/{SplitText,GradientText,Magnet}.*
apps/web/src/components/vendor/21st/{PromptBox,ExpandableCard,Timeline}.*
apps/web/src/lib/api.ts
THIRD_PARTY_NOTICES.md
docs/{privacy-retention,operations,component-provenance,payment-extension}.md
tests/e2e/{phishing,accessibility,mobile,stored-xss,share-capability}.spec.ts
```

Build the fixed room and shell first. Three.js alone owns `renderer.setAnimationLoop`; GSAP changes registered values and orchestrates phase/camera/DOM cues through `useGSAP` cleanup. Bind shell → agent arrival/progress → final council states to real status values. Add a visible reduced-motion profile and pause hidden component effects.

### Phase 4 — Decision causality, report, share route (7/24–7/25)

Connect decision choices to persisted `DecisionResult` and visibly change confidence, graph topology, palette, camera, consequence, and next action. Finish consensus/disagreement/evidence-gap visual grammar, report terminal, stable `/r/:shareCapability`, and the full phishing-email rehearsal without refresh. Add two lightweight schema fixtures to prove renderer reuse without creating a second world.

### Phase 5 — Integrated hardening and resubmission window (7/25–7/26)

Run schema fuzzing, malformed-provider cases, 15,000-character input, adapter compatibility, MCP protocol suite, accessibility, cold-start deployment, browser E2E, memory/disposal checks, mobile quality profile, and performance traces. Address ASP review comments immediately; resubmit no later than the target above when comments arrive in time.

### Phase 6 — Release evidence and submission package (7/26–7/27)

Freeze dependencies and schemas, run the complete verification matrix twice (warm and cold), prepare the <=90-second demo capture/script, publish only with explicit approval, and monitor endpoint/MCP/share-page health through the deadline. Payment remains documentation-only.

### Critical path and quantitative risk

Critical path: public domain/TLS + deploy → free A2MCP schema/core → first ASP submission → review response/remediation → live status. The internal first-submission target leaves roughly 107 hours before the final deadline; a 7/25 12:00 UTC resubmission leaves roughly 60 hours. Because review is not an SLA, even these buffers do not guarantee approval. Parallel MCP/UI work cannot recover an unsubmitted or unreachable ASP.

## 6. Expanded Test Plan

### Unit

- Boundary validation: empty/oversized inputs, 15,000-character representative Chinese SOP, invalid Unicode/control content, bounded arrays/enums, unknown scene cue rejection.
- Compression threshold: exactly below/at/above threshold; required step IDs/evidence references survive compression.
- Orchestration: three specialist promises start independently; moderator starts only after all valid specialist results; token budgets are 1,200 each and 2,000 moderator; abort at hard timeout.
- Schema validation: valid fixtures accepted; missing/extra/wrong fields rejected; no executable code/asset URL injection reaches scene state.
- Decision evaluation: every fixture choice deterministically changes application state and the required 3D-facing consequence fields.
- Progress reducer: phase order and monotonic values; terminal state prevents further notifications.
- Quality-profile selection: desktop/mobile/reduced-motion/DPR caps.

### Integration

- PostgreSQL create/read/update/expiry and concurrent decision writes using real test database.
- Real provider sandbox call for each role plus invalid/truncated/timeout fixtures; never make provider calls the only deterministic CI path.
- Web API, A2MCP, and MCP generate compatible rehearsal IDs and domain result structures.
- A2MCP returns HTTP 200 for successful registered fixtures and contains no payment challenge behavior.
- MCP lifecycle on POST/GET, Origin and protocol-version handling, capability declaration, secure session IDs, invalid/expired sessions, all three tools, both resource templates plus examples, all three prompts, progress opt-in/monotonic/terminal behavior, standard errors.
- Restart during a stream/job invalidates sessions/streams, terminalizes affected owned jobs with `SERVER_RESTART`, and preserves completed rehearsals without pretending transport resumption.
- Duplicate idempotent calls, conflicting key reuse, stale/concurrent decisions, pool exhaustion/backpressure, 58-second A2MCP ingress/proxy-margin timeout, provider breaker/quota exhaustion, and deletion/retention jobs.
- Web owner-capability create/one-time-return/hash-only storage, owner-authorized duplicate-active attach, UUID-only denial, cross-rehearsal/expired/revoked/invalid owner denial, separate read-only share creation/revocation, share-token mutation denial, and post-restart duplicate behavior.
- Provider `AttemptBudget` exhaustively tests all 9-attempt paths: failed/unknown-usage attempts consume count/tokens, compression never retries, each specialist/moderator retries at most once, schema repair consumes that retry, and full successful-attempt output caps remain available.
- A2MCP fake-clock tests cover queue/admission/provider/persistence/serialization under one ingress deadline and assert frozen 504 is serialized by 58.0 seconds with >=7.0 seconds of proven proxy margin.
- MCP boot tests seed an old-instance session, start a new instance, verify startup purge and old-token 404, then simulate purge failure and verify the instance-ID predicate still rejects the row; global/per-IP session cap tests return 429 without creating rows.

### E2E

- Chrome desktop: submit the full phishing SOP; shell is usable before model completion; observe all three agent progress states; distinguish consensus/disagreement/gaps; make a decision; see state and 3D changes; open report and stable share URL without refresh.
- Timeout, provider error, malformed output, bad route ID, and offline/retry states retain usable DOM/canvas and a structured error/retry path.
- Keyboard-only operation, visible focus, accessible labels/status announcements, logical reading order, and reduced-motion preference.
- Mobile baseline handset: complete every core action with reduced particles/shadows/post-processing/transparency/camera complexity; no inaccessible hover-only action.
- Remote MCP client/inspector completes initialize → generate with progress → resource read → evaluate → report read within one session.
- Deployed cold-start: public ASP, `/mcp`, share URL, demo page, database, and model path.

### Observability

- Structured logs keyed by request/rehearsal/session IDs; redact SOP content, prompts, model payloads, credentials, and raw session IDs.
- Metrics: request count/error/latency by adapter; phase latency; model retries/schema failures/token use; compression rate; generation median/p95/timeout; active/expired MCP sessions; progress completion; DB latency; cold starts.
- Client performance marks: shell interactive, first frame, phase transitions, final scene, decision consequence.
- Health endpoints distinguish process readiness from database/provider dependency state without leaking secrets.
- Alert/manual watch thresholds during judging window: endpoint 5xx, p95 >45s, timeouts, review availability, database exhaustion.

### Performance

- Desktop benchmark named in Phase 0: shell interactive target ~2s, primary sequences near 60 FPS; capture Chrome Performance trace and frame distribution, not visual judgment alone.
- Mobile named handset: >=45 FPS under reduced profile; document DPR/effect caps.
- Generation load: representative 15,000-character SOP; provisional median <=20s, p95 <=45s, hard timeout 60s, without lowering confirmed output budgets.
- Concurrent soak sized to expected demo/judging traffic; ensure pool/session limits fail with bounded errors rather than memory growth.
- Repeated route/rehearsal cycles verify Three.js geometry/material/texture/render-target disposal through `renderer.info` and heap snapshots.
- Bundle and network budget established after selected components are frozen; block unexpected duplicate animation/3D packages.

### Security and privacy

- Validate every Web/A2MCP/MCP input and output; bound size, arrays, strings, and session state.
- Prompt-injection fixtures instructing the model to emit code, secrets, or invalid assets must remain inert data and fail/normalize through schema boundaries.
- Server-only model/database credentials; secret scan on repository/build artifacts/client bundle.
- Parameterized SQL; capability-only public reads; attempts using rehearsal UUID, another capability, expired capability, timing enumeration, or forged decision IDs return the same non-enumerating 404/403 policy.
- MCP Origin allowlist/rejection, protocol version negotiation, cryptographically secure session IDs, session fixation/replay/expiry tests, safe logging.
- Production CORS allowlist contains only the deployed web origin and configured OKX.AI origin if the registered contract requires browser access; no wildcard with credentials. APIs use Authorization/header capability and no ambient cookies, so CSRF tokens are unnecessary; if cookies are later introduced, this decision must be reopened.
- CSP default: `default-src 'self'; script-src 'self'; style-src 'self'` plus the minimum hashed/nonce style exception required by the build; `connect-src` only the app API/MCP origins; `img-src 'self' data: blob:`; `font-src 'self'`; `object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`. No unsafe HTML rendering; user/model strings render as text. Stored-XSS fixtures cover titles, reports, evidence, share metadata, and CSV/JSON export.
- No arbitrary URL appears in domain schemas and the server performs no user/model-directed fetch. If a fixed provider URL is configurable, validate HTTPS and an operator allowlist, resolve/reject private/loopback/link-local ranges, disable redirects, and revalidate DNS to prevent SSRF.
- Trust proxy is off by default; production enables exactly the documented proxy hop/CIDR before using forwarded IP/scheme for rate limits or URL construction. Reject conflicting forwarding headers.
- Rate/body/timeout/CSP/security-header tests plus dependency audit, lockfile integrity, source-component content hashes, license provenance, secret scan, and client-bundle scan.
- Confirm retention/expiry and deletion behavior for submitted SOPs; no raw provider payload retention.
- Verify no x402/payment challenge or payment dependency in competition deployment.

### Coverage gate

Vitest coverage must be >=80% independently for lines, branches, functions, and statements across `packages/contracts`, `packages/core`, and non-bootstrap `apps/server` code; non-vendor `apps/web` logic must also reach >=80%. Copied vendor component source is excluded only when its ledger documents the exclusion and its behavior is covered by E2E/accessibility tests. All protocol/security/state-machine branches listed above require explicit tests regardless of aggregate coverage. CI fails below any threshold.

## 7. Testable Acceptance Criteria

Every criterion below is binary. “Pass” requires the named artifact/window; a narrative claim is not evidence.

1. A public, globally reachable HTTPS A2MCP endpoint passes the registered request/response fixture and returns HTTP 200 on success; repository/deployment scans show no payment SDK or challenge path.
2. **Internal review-readiness gate:** a timestamped manifest plus sanitized success/error/timeout fixtures, public HTTPS smoke result, and approval-ready submission package exist by 7/23 12:00 UTC. **External eligibility gate (separate evidence):** only an OKX receipt/status artifact may prove actual submission/approval/live state; it requires explicit user approval and is not implied by implementation completion. If approved, status is recorded twice daily and remediation is ready by 7/25 12:00 UTC.
3. Across 20 representative provider runs including five 15,000-CJK-character inputs, median completion is <=20 seconds, p95 <=45 seconds, every call terminates <=60 seconds, and 100% preserve required schema fields; budgets remain ~1,200×3/~2,000.
4. Tracing/tests prove three specialists run in parallel and the moderator runs only after their validated completion, with configured budgets of ~1,200 and ~2,000 tokens.
5. Malformed/truncated/injected model output never reaches rendering or persistence as valid state; users receive a safe structured error/retry path and the canvas remains usable.
6. Contract tests prove Web, A2MCP, and MCP use compatible rehearsal IDs and the same versioned core result structures.
7. MCP protocol tests against the pinned current official SDK/spec pass initialize plus Streamable HTTP POST/GET/DELETE, JSON/SSE response routing, version/Origin/session headers, hashed 256-bit sessions, expiry/restart/non-resumption, cancellation, exact caller progress tokens with zero terminal progress, all three tools, resources/templates/examples, all three prompts, and standard errors; source scan finds no legacy HTTP+SSE route.
8. Source/DOM/license inspection proves exactly three React Bits and three 21st.dev components fill the six distinct slots, with notices, per-component audits, no Framer-owned global timeline, hidden-state pause, and reduced-motion behavior.
9. Source/runtime instrumentation finds exactly one perpetual RAF/render loop; GSAP owns coordinated choreography; hidden effects pause <=250 ms; after five reset cycles `renderer.info` resources are within 5% of baseline and no timeline/listener remains attached.
10. The phishing-email E2E completes submit → staged agents → distinguishable debate → decision → visible state **and 3D** consequence → report/share, without refresh.
11. Five cold desktop runs meet shell-interactive median <=2.0 seconds/worst <=2.5 seconds; a 30-second primary trace meets median >=55 FPS and 1% low >=45 FPS within the stated render budgets.
12. A 30-second named-handset trace meets median >=45 FPS and 1% low >=35 FPS, and the complete mobile E2E passes under the reduced profile.
13. Five deployed cold-start runs pass A2MCP, `/mcp`, capability share route, demo page, database, and model; zero secrets/private projection fields appear in captured responses/logs.
14. A <=90-second demo shows the causal loop and public URL; no claim exceeds verified implementation evidence.
15. A post-event note names the OKX Payment SDK middleware insertion point and config categories but no payment code is installed, configured, tested, or shipped.
16. CI reports >=80% for lines/branches/functions/statements in each named coverage scope, and all security/protocol/lifecycle mandatory tests pass.
17. A 10-minute overload soak at configured limits shows bounded queue <=32, no pool exceeds configured maximum, excess requests receive bounded busy/rate errors, event-loop lag p95 <=100 ms, and A2MCP p95 degradation from MCP load <=20%.
18. Web create returns a 256-bit owner capability exactly once and stores only its hash; status/decision/share management pass only with the matching owner bearer token. UUID-only, cross-rehearsal, expired, revoked, and invalid capabilities fail non-enumerably. A separately minted 192-bit share token is read-only and revocation takes effect on the next request.
19. Fake-clock A2MCP tests prove one 58.0-second ingress deadline includes queue through serialization, every stage uses the clipped remaining time, and the frozen 504 completes at least 7.0 seconds before the verified proxy deadline.
20. Attempt-budget tests prove the exact maxima of 9 calls/12,400 attempted output tokens with compression and 8/11,200 without; every failed/unknown attempt counts and successful retry attempts retain 1,200 specialist/2,000 moderator caps.
21. Restart tests prove startup purges all MCP session rows, old-boot tokens return 404 even when purge is fault-injected, persisted active jobs become `FAILED/SERVER_RESTART`, and active-session caps never exceed 1,000 global/10 per IP.

## 8. Risks and Mitigations

| Risk | Likelihood / impact | Mitigation without scope reduction | Trigger / owner |
|---|---|---|---|
| ASP review misses deadline despite early submission | High / fatal eligibility | Public vertical slice first; submit by 7/23 target; twice-daily check; reserve 7/25 resubmission; keep endpoint stable while UI/MCP advance | No review result by 7/25 00:00 UTC → product lead escalates status and preserves evidence; no scope is silently cut |
| MCP SDK/spec mismatch | Medium-high / high | 24-hour recheck; pin recommended v1.x; protocol contract tests before UI completion; use formal 2025-11-25 semantics | Any lifecycle/streaming proof fails Day 2 → backend owner stops adjacent MCP polish and fixes transport root cause |
| Six source components introduce motion/dependency/license conflict | High / medium-high | Day-1 ledger, source-only import, reject Framer/global timeline variants, same-slot substitution, bundle/license CI | Any variant lacks compatible license/accessibility by Phase 0 exit → substitute within slot |
| Model latency/schema instability | High / high | fixture-first orchestration, structured outputs, aborts, one bounded retry, schema repair only if schema-valid, progress UX, instrument budgets | p95 >45s or schema failures >5% in benchmark → prompt/schema/provider tuning; budgets remain intact absent user approval |
| Cinematic scene misses frame targets | Medium-high / high | fixed geometry, instancing/pooling, capped DPR, asset budget, disposal, mobile quality profile, performance trace each phase | Desktop p95 frame >20ms or mobile <45 FPS → profile and remove GPU cost while retaining full causal/cinematic features |
| Shared service fails under mixed protocols | Medium / high | adapter isolation, bounded pools/sessions, route-specific timeouts/rate limits, health/readiness, soak tests | Cross-adapter error correlation/load failure → resource partitioning in same service first; sidecar only if proven necessary |
| No source exists; setup consumes schedule | Certain / medium | chosen minimal workspace, one service, direct SQL, no speculative infrastructure | Phase 1 vertical slice not deployed by 7/22 end → reassign owners/extend hours; report schedule risk, do not downgrade requirements |

## 9. Deliberate Pre-mortem

### Scenario 1 — “Beautiful demo, ineligible entry”

**Failure story:** the team spends 7/21–7/24 on the command room; the A2MCP endpoint is submitted late, review requests a schema change, and there is no business-day window left.
**Early signals:** no public HTTPS fixture by 7/22; no Agent ID/submission receipt by 7/23 12:00 UTC; endpoint changes incompatibly after submission.
**Prevention:** Phase 1 public vertical slice precedes polish, registration fixtures are frozen, one owner monitors review twice daily, compatible schema changes only after submission.
**Recovery:** immediately address review feedback and resubmit; continue full MCP/UI in parallel. If approval still misses the deadline, preserve a working full build and report the external failure; do not claim eligibility or silently shrink scope.

### Scenario 2 — “MCP looks implemented but fails real clients”

**Failure story:** implementation copies an obsolete SSE example or treats MCP as REST; initialization works locally but sessions/progress/resources fail against current clients.
**Early signals:** separate SSE route, no protocol-version test, predictable session IDs, progress emitted without tokens, no GET lifecycle test.
**Prevention:** formal 2025-11-25 checklist, pinned official SDK v1.x after recheck, protocol tests and inspector/client run in Phase 2, backend owner independent of UI.
**Recovery:** delete custom transport glue and remount the SDK-supported Streamable HTTP path; keep Core intact. Full capability remains a gate.

### Scenario 3 — “Cinematic stack collapses under real data”

**Failure story:** six copied components, GSAP, and Three.js each animate independently; long model latency yields blank UX, decisions are decorative, mobile drops below target, and repeated runs leak GPU resources.
**Early signals:** more than one RAF/render scheduler, components continue hidden animation, scene directly consumes raw model JSON, `renderer.info` rises across rehearsals, decision E2E changes DOM only.
**Prevention:** schema adapter, single Three loop, GSAP director contract, staged real progress, component ledger, causal decision test, performance/disposal trace every phase.
**Recovery:** replace offending component variants within their assigned slots; simplify GPU implementation (not cinematic behavior or component count), cap DPR/effects on mobile, and fix shared lifecycle cleanup.

### Scenario 4 — “Free public endpoint becomes a cost/privacy incident”

**Failure story:** automated callers fill an unbounded generation queue, exhaust provider quota/DB connections, and enumerate public rehearsal IDs; raw SOPs or model output then leak through logs/share pages while legitimate review traffic times out.
**Early signals:** queue >24 for five minutes, breaker opens twice/hour, daily spend reaches 75%, DB pool wait p95 >500 ms, capability 404 scans spike, or redaction canary appears in a response/log.
**Prevention:** numeric per-adapter limits and reserved pools, 32-job queue, provider breaker/spend guard, capability-only access, hashed identifiers, non-persistence of raw SOP, retention deletion, sanitized projections, redaction/security tests.
**Recovery:** rate-limit/block abusive sources, open the provider breaker, drain rather than grow queues, rotate any exposed secret/capability, purge affected logs/results under the retention procedure, notify the security/privacy owner, restore from the last verified deployment, and rerun leak/cost tests. These controls contain abuse; they do not authorize a feature-scope fallback.

## 10. Verification and Stop Conditions

Planning is complete only when:

- Architect review supplies a steelman alternative/tradeoff assessment;
- Critic returns `APPROVE` after any revision loop;
- final PRD and test spec exist under `.omx/plans/`;
- all dependency/version/device/host decisions in Phase 0 are assigned explicit gates.

Implementation is complete only when all internal portions of the 21 acceptance criteria have fresh evidence, the full automated suite passes, performance traces meet named targets, deployed cold-start smoke tests pass, and there are zero known critical/high security defects. External ASP submission/approval/live state is a separate eligibility gate that can be claimed only from the external receipt/status artifact after user-authorized submission. “Code written,” “local demo works,” or “submission package ready” is not evidence of external approval.

Evidence bundle should contain: test/coverage reports, schema fixtures, MCP protocol output, component/license ledger, accessibility report, Chrome/mobile performance traces, `renderer.info` disposal check, dependency/secret scans, deployment smoke log, ASP submission/review timestamps, and demo script/capture.

### Requirements-to-evidence trace matrix and owners

| Requirement | Primary evidence | Binary owner |
|---|---|---|
| Shared Core/state/all-three policy/idempotency/OCC | lifecycle/unit/integration traces and DB transaction tests | Core/A2MCP executor |
| Web owner/read-only-share authorization | hash-storage inspection plus cross/expired/revoked/UUID capability suite | Core/A2MCP executor + security verifier |
| Free synchronous A2MCP/no payment/58s deadline | frozen fixtures, proxy-margin test, deployment capture, dependency/source scan | Core/A2MCP executor |
| Provider attempt/output arithmetic | exhaustive fake-provider AttemptBudget suite and usage metrics | Core/A2MCP executor |
| Full current MCP | protocol suite + inspector/client transcript + source route scan | MCP executor |
| MCP restart invalidation/session caps | startup-purge, boot-ID fault-injection, old-token and cap suite | MCP executor + verifier |
| Privacy retention/public projection/IDOR | migration/deletion test, projection snapshots, capability/XSS/IDOR tests | Security/privacy owner (verifier lane) |
| Numeric abuse/cost/resource isolation | 10-minute overload soak, pool/queue/breaker metrics | Deployment/operations owner (Core lane) |
| Six components/provenance/accessibility | content-hash/license ledger, dependency scan, DOM/E2E audit | Front-end designer |
| One loop/immutable SceneAdapter/causal decisions | source instrumentation, five-cycle disposal check, phishing decision E2E | Front-end designer + verifier |
| Desktop/mobile experience | five cold runs and named 30-second traces | Performance owner (verifier lane) |
| >=80% coverage/security | CI coverage four-metric report and mandatory security suite | Test/security verifier |
| Internal ASP readiness | timestamped manifest/fixture/smoke bundle | Product/review owner |
| Actual ASP submission/approval/live | OKX external receipt/status capture only | Product/review owner after explicit user approval |
| Demo/report/share | <=90-second capture, cold share smoke, sanitized response snapshot | Product/review owner + verifier |

Correlation IDs are generated at ingress and propagated as `requestId`, `rehearsalId`, hashed `sessionRef`, provider-call ID, and persistence transaction ID across logs/traces; public responses expose only `requestId` and authorized rehearsal/share fields.

## 11. ADR

### Decision

Build SOPscape Council as a TypeScript pnpm workspace with a Vite React client, one long-lived Fastify backend, shared Zod contracts and Core packages, PostgreSQL persistence, one model provider/model, and distinct Web JSON, free A2MCP, and MCP Streamable HTTP adapters. Three.js owns rendering; GSAP owns global choreography. Submit the public free A2MCP vertical slice before completing parallel MCP/UI work.

### Drivers

- Review deadline and non-SLA latency.
- One semantic core across incompatible wire protocols.
- Current MCP session/stream requirements.
- Independent shell performance during long model generation.
- User-mandated full scope and no feature fallback.

### Alternatives considered

- Next.js plus MCP sidecar: viable but adds deployment/integration work.
- One Next.js process: smallest project count, but risks runtime/hosting incompatibility with stateful Streamable HTTP.
- Separate per-protocol services: rejected because it duplicates core/operations without evidence of need.
- Thin/deferred MCP or fewer visual components: not an authorized alternative.

### Why chosen

Option A minimizes deployables and cross-language/schema drift while preserving a conventional long-lived MCP transport and independently loaded client. It allows the review-critical A2MCP route to ship before the full visual layer without creating temporary business logic.

### Consequences

- One backend is a shared failure domain and needs route-level limits/observability.
- Workspace/build/deployment must be created from zero.
- Component and SDK version gates are mandatory before imports.
- PostgreSQL and model credentials are required for integrated testing.
- The schedule remains high risk; architecture cannot eliminate external review uncertainty.

### Follow-ups

- Recheck MCP SDK 24 hours before implementation.
- Freeze exact six component sources and notices.
- Name benchmark devices/host/model during Phase 0.
- After the competition only, write a separate ADR for OKX Payment SDK middleware and billing semantics.

## 12. Execution Staffing and Handoff

### Available agent-type roster

`explore`, `researcher`, `dependency-expert`, `planner`, `architect`, `critic`, `executor`, `designer`, `test-engineer`, `debugger`, `verifier`, `code-reviewer`, `security-reviewer`, `writer`, `git-master`, `vision`.

### Ralph guidance (persistent single-owner)

Use `$ralph` if one owner must drive the entire critical path sequentially. Recommended lane order: Phase 0 gates → contracts/tests → deployed A2MCP/review evidence → MCP → web/3D → integration/performance/security → release verification. Keep specialists as bounded reviews, not concurrent file owners. Suggested reasoning: executor **high** for contracts/protocol/core; architect/critic/verifier/security **high**; designer/test-engineer **medium-high**; explore **low**. Ralph must not implement until both PRD and test spec exist.

### Team guidance (recommended for the deadline)

Use a 4-person coordinated team after plan approval:

1. **Core/A2MCP executor (high):** contracts, orchestration, persistence, deployment, initial ASP fixture/review readiness.
2. **MCP executor + protocol test engineer (high):** `/mcp`, capabilities, sessions, progress, integration tests; owns no Core duplication.
3. **Designer/front-end executor (high):** fixed room, six audited components, GSAP/Three ownership, causal decision UI, accessibility.
4. **Verifier/test engineer (high):** cross-adapter fixtures, E2E, performance, security/observability, release evidence; does not rewrite implementation without assigning defects to owners.

Shared-file ownership: lane 1 owns `packages/contracts`, `packages/core`, server API/A2MCP; lane 2 owns `apps/server/src/mcp`; lane 3 owns `apps/web`; lane 4 primarily owns `tests/e2e`, verification scripts/artifacts. Contract changes require lane-1 merge before downstream updates.

### Launch hints

After consensus and PRD/test-spec creation:

```text
$team 4:executor "Implement .omx/plans/prd-sopscape-council.md against .omx/plans/test-spec-sopscape-council.md; preserve no-fallback scope and lane ownership"
```

Equivalent CLI-oriented hint:

```text
omx team 4:executor "SOPscape Council: execute approved PRD/test spec; Core+A2MCP, MCP, Web/3D, Verify lanes"
```

The leader should explicitly allocate the specialist roles above even if the runtime launches a shared executor agent type.

### Team verification path

`team-plan → team-prd → team-exec → team-verify → team-fix` until all gates pass. Verification order: contract/unit → database/provider integration → A2MCP deployed fixture → MCP protocol → browser E2E/accessibility → performance/disposal → security/dependency/secret scans → cold-start deployment → ASP live/review evidence. A failed gate returns to its owning lane; the verifier reruns the smallest failing check and then the full affected tier. Final sign-off requires independent verifier evidence, not implementer assertion.

## 13. Goal-Mode Follow-up Suggestions

- **`$team` (recommended delivery lane):** best fit for the genuinely parallel Core/A2MCP, MCP, cinematic web, and verification streams under the deadline.
- **`$ralph`:** use when coordination overhead or team availability makes one persistent owner safer; expect less calendar parallelism.
- **`$ultragoal`:** default durable goal-mode follow-up if implementation must persist across sessions with evaluator-backed completion tracking.
- **`$performance-goal`:** use after the functional vertical slice when the dominant remaining objective is measured 2-second shell, desktop near-60 FPS, mobile 45 FPS, memory, or generation latency; it complements rather than replaces full delivery.
- **`$autoresearch-goal`:** not the primary next lane; reserve it for a new research question such as post-event OKX Payment SDK commercialization or a material SDK/provider re-evaluation.

No execution mode should start until consensus produces the PRD and test-spec artifacts. Publishing, ASP submission, or changing third-party resources remains an explicit user-approval boundary even after implementation.

## 14. Applied-improvements changelog

- Iteration 1: added explicit Core/adapter separation, current MCP Streamable HTTP semantics, six-component provenance gates, early ASP review targets, deliberate pre-mortem, and full verification/staffing handoff.
- Iteration 2: specified Core APIs/state machine, idempotency/OCC, numeric abuse/resource controls, raw-input retention, capability projection, MCP session/progress/cancel/delete behavior, immutable SceneAdapter, security controls, binary performance windows, >=80% coverage, sidecar thresholds, and requirements evidence ownership.
- Iteration 3: added owner versus read-only share capabilities, one 58-second A2MCP ingress deadline, exact 9-call/12,400-token AttemptBudget arithmetic, boot-bound MCP session invalidation, and global session caps.
- Final merge: transactionally coupled owner capability/job/idempotency creation, documented secure lost-202 orphan behavior, moved the deadline origin to the earliest trusted proxy/raw-request boundary, compatibility-gated `Last-Event-ID` without event persistence, and standardized read-only sharing on `/r/:shareCapability`.

Consensus status: **APPROVED**. This artifact authorizes an execution handoff only through the selected workflow; it does not itself implement or externally submit the product.
