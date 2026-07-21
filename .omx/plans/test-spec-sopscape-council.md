# APPROVED Test Specification — SOPscape Council

> Status: APPROVED consensus test contract.
> Companion PRD: `.omx/plans/prd-sopscape-council.md`.
> Scope: greenfield verification plan only; no product implementation exists at approval time.

## 1. Quality contract

Release requires fresh evidence for every internal acceptance criterion, zero known critical/high security defects, the full protocol/security suites, and >=80% lines/branches/functions/statements in every named scope. External OKX.AI submission/approval/live status is a separate eligibility gate and is never inferred from passing tests.

The binding no-fallback directive remains:

> The user explicitly selected `no-fallback`: full MCP, cinematic 3D, six external components, multi-agent analysis and review submission remain required even if the full combination is not ready by the planned internal checkpoint. Downstream planners must not silently replace this with a minimal-MCP fallback.

Runtime containment, same-slot component substitution, mobile fidelity reduction, and GPU implementation simplification are allowed. Thin MCP, fewer than three specialist successes before moderation, fewer than six components, decorative-only decisions, or payment activation are not.

## 2. Test topology and proposed paths

```text
tests/fixtures/sops/{phishing-15k,phishing-small,invalid-unicode,oversize}.json
tests/fixtures/model/{compression,specialists,moderator,malformed,truncated,injected,timeout}.json
tests/fixtures/a2mcp/{manifest,success,validation,busy,provider-failure,timeout-58s}.json
tests/fixtures/mcp/{initialize,tools,resources,prompts,progress,errors}.json
tests/unit/{schemas,lifecycle,idempotency,attempt-budget,projections,privacy,limits,scene-adapter}.test.ts
tests/integration/{database,orchestration,concurrency,retention,shutdown,resource-pools}.test.ts
tests/integration/a2mcp/{registered-fixtures,absolute-deadline,proxy-margin,no-payment}.test.ts
tests/integration/mcp/{initialize,post-get-delete,version-origin,tools,resources,prompts}.test.ts
tests/integration/mcp/{progress,cancellation,sessions,restart,last-event-id,errors}.test.ts
tests/security/{capabilities,xss,ssrf,prompt-injection,cors-csp,proxy,secrets}.test.ts
tests/e2e/{phishing,share,accessibility,mobile,error-states}.spec.ts
tests/performance/{generation,render,disposal,overload,cold-start}.spec.ts
```

Deterministic fixtures are the CI baseline. A real provider sandbox suite is required before release but cannot be the only CI oracle. Every fixture records schema version, retrieval/generation date, expected projection, and whether it contains synthetic sensitive canaries.

## 3. Unit suite

### Schemas and boundaries

- Accept valid `SopInput`, specialist, moderator, scene, decision, Web-owner, Web-share, A2MCP, and MCP fixtures.
- Reject empty input, >60,000 UTF-8 bytes, wrong types, unknown keys/enums/camera cues, oversized arrays/strings, invalid Unicode/control payloads, executable code, and arbitrary URLs.
- Prove the 15,000-CJK-character fixture retains required step/evidence IDs through optional compression.
- Snapshot the four projections independently; private fields must be structurally impossible in external DTOs.

### Lifecycle, concurrency and idempotency

- Exercise every legal transition: `QUEUED -> COMPRESSING? -> SPECIALISTS_RUNNING -> MODERATING -> PERSISTING -> READY` and active-to-`FAILED/CANCELLED`; terminal-to-`EXPIRED`.
- Reject backward, terminal-to-active, direct specialist-to-ready, and moderation with fewer than three valid specialist outputs.
- Prove late provider completion cannot overwrite a terminal/versioned row.
- Same namespace/key/digest reuses the job only under adapter authorization; different digest conflicts.
- Web duplicate-active attach requires matching owner bearer; A2MCP uses its own ingress deadline; MCP requires the same live session.
- `evaluateDecision` increments version once; stale/concurrent expected versions receive `VERSION_CONFLICT`.

### AttemptBudget

- Optional compression: one 1,200-token attempt, no retry.
- Three specialists: at most two 1,200-token attempts each.
- Moderator: at most two 2,000-token attempts.
- Exhaustively prove maxima: with compression 9 calls/12,400 reserved attempted-output tokens; without it 8/11,200.
- Every started success/failure/cancel/malformed/timeout permanently debits its full cap and call count. Unknown provider usage charges the full cap to observed cost.
- Schema repair consumes the one retry. No hidden third call. Successful retry retains the full 1,200/2,000 cap.

### SceneAdapter and motion state

- `SceneAdapter.apply` accepts frozen snapshots, never mutates them, and maps only known IDs/tokens.
- React state updates occur only for coarse state, never per frame.
- Quality profiles enforce desktop/mobile DPR, effects, shadow, draw-call, triangle, and texture budgets.
- Reduced-motion mapping preserves distinctions while eliminating camera/parallax/pulsing motion.

## 4. Integration suite

### Database and privacy

- Job, idempotency row, and owner-capability hash commit in one transaction; injected failure rolls all back and never enqueues.
- Lost `202` after commit never permits capability recovery/reissue; UUID/key cannot authorize; orphan expires through seven-day retention.
- Raw SOP, prompts, provider payloads, chain-of-thought, raw capabilities/sessions/keys, and IPs never appear in database/log snapshots.
- Retention deletes rehearsal/decision/share/owner rows after seven days, idempotency after 24 hours, and expired sessions by policy.
- Decision transaction/OCC, capability revocation, and concurrent writes use a real test PostgreSQL instance.

### Adapter consistency

- Web, A2MCP, and MCP call the same Core functions and yield the same rehearsal ID/schema version/domain meaning while retaining different DTO/error envelopes.
- No adapter contains SOP parsing, model calls, moderation, persistence logic, or decision evaluation.
- Correlation IDs connect ingress, job, provider attempt, transaction, and sanitized session reference.

### A2MCP absolute deadline

- Capture request start at the authenticated edge timestamp stripped/injected by the trusted proxy; otherwise use the first raw-request hook.
- Fake-clock all combinations of admission/queue/compression/specialist/retry/moderator/persistence/projection/serialization.
- Absolute terminal deadline is 58.0 seconds from trusted first byte; it never resets after queueing.
- Ceilings: admission/queue 4s, compression 6s, specialists 20s, moderator 23s, persistence/projection 2s, success serialization 1s, error reserve 2s.
- Minimum useful windows: compression 4s, specialist initial/retry 6s/5s, moderator initial/retry 8s/6s.
- Frozen HTTP 504 completes by 58s; verified proxy deadline is >=65s, preserving >=7s margin. Success before the deadline is HTTP 200. Never emit partial success/job URL.
- Archived OKX fixtures pass; source/dependency scan finds no payment/x402 challenge path.

### Resource isolation and restart

- Enforce queue <=32, <=8 queued per IP/session, generation concurrency 8 with Web/A2MCP/MCP reservations 2/2/4.
- Enforce PostgreSQL pools 10 generation/5 MCP/5 Web, provider concurrency 8 global/3 per job, and bounded busy responses.
- Provider breaker opens after five consecutive retryable failures or >=50% of last 20, waits 30s, and allows one probe.
- Shutdown stops admission, drains 30s, aborts remaining work, writes `SERVER_RESTART`, closes streams/pools.
- Boot generates a new ephemeral 128-bit `serverInstanceId`, purges session rows before readiness, and terminalizes active jobs.
- Seed an old-boot row; verify old token 404. Fault-inject purge failure; instance-ID predicate must still reject it.
- Active MCP sessions never exceed 1,000 global/10 per IP; streams never exceed 100 global/2 per session/10 per IP.

## 5. MCP protocol suite

Run against the pinned production-recommended official TypeScript SDK and formal 2025-11-25 compatibility fixtures, rechecked within 24 hours of implementation.

- Initialize without session header; negotiate supported version; return 256-bit opaque session header; store hash plus current boot ID only.
- Subsequent POST/GET/DELETE require session and `MCP-Protocol-Version`. Invalid version -> 400; missing/unknown/old/expired/terminated session -> 404.
- POST validates Origin, content/accept headers and JSON-RPC; verify JSON response versus SSE routing.
- GET opens SSE, keepalive 15s, and respects stream caps.
- No event IDs or event persistence. Compatibility suite freezes `Last-Event-ID`: prefer 400 when permitted, otherwise archive the exact compliant non-resumption response; never imply replay.
- DELETE closes streams, cancels session-owned requests and returns 204; repeated/unknown ->404.
- `notifications/cancelled` aborts the matching subscriber/request and stops progress/results after terminal.
- Caller `_meta.progressToken` is echoed exactly; numeric progress is monotonic; no token means no progress; no notification follows result/error/cancel/expiry/disconnect.
- Tools: `generate_rehearsal`, `get_rehearsal`, `evaluate_decision`.
- Resources: scene/report templates and examples resource.
- Prompts: create rehearsal, review missing evidence, coach learner.
- Session state <=10 rehearsal refs/32 KiB, idle <=30m, absolute <=2h, never resumes after restart.
- Official inspector/compatible remote client completes initialize → generate/progress → resource → decision → report → delete.

## 6. Security suite

- Web create returns a one-time 256-bit owner capability and stores SHA-256 only. Owner bearer is required for status/decision/cancel/share management.
- UUID-only, wrong owner, cross-rehearsal, expired, revoked, malformed, and timing-enumeration requests fail with the same non-enumerating policy.
- Separate 192-bit share capability is hash-only, read-only, revocable, and cannot mutate/cancel/create shares; `/r/:shareCapability` exposes only `WebShareRehearsal`.
- Stored-XSS canaries in title/report/evidence/decision/export render as text; no unsafe HTML.
- Prompt-injection fixtures requesting code/secrets/assets remain inert and fail schema boundaries.
- No user/model-controlled URL fetch. Fixed provider URLs must be HTTPS/allowlisted, reject private/loopback/link-local/DNS rebinding, and disable redirects.
- Production CORS is explicit, never wildcard-with-credentials. Cookie-free bearer APIs justify no CSRF token; adding cookies reopens the decision.
- Assert CSP: self-only scripts/styles except minimum nonce/hash, restricted connect/img/font, no object/base/frame ancestors.
- Trusted proxy off by default; when enabled, accept only named hop/CIDR and reject conflicting forwarding headers.
- Parameterized SQL, body/rate/timeout limits, secret scan, client-bundle scan, dependency audit, lock integrity, component hashes/licenses/notices.

## 7. E2E and accessibility

- Desktop Chrome phishing flow: submit → shell before model result → three agents → distinguish consensus/disagreement/gaps → owner decision → visible state and 3D consequence → report → create/read/revoke share, no refresh.
- Invalid model, provider failure, timeout, offline, malformed route/capability retain usable DOM/canvas and structured retry/error state.
- Keyboard-only completion, visible focus, logical reading order, labels/status announcements, contrast, reduced motion, no hover-only action.
- Named mobile handset completes every action with reduced effects and no hidden controls.
- Exactly three audited React Bits plus three audited 21st.dev source components fill distinct slots; hidden effects pause <=250ms; no copied component owns WebGL/perpetual RAF/global timeline.
- Demo capture <=90 seconds and contains only verified claims/public URLs.

## 8. Performance and observability

### Performance windows

- Desktop production build, cache disabled, five cold navigations: shell interactive median <=2.0s, worst <=2.5s.
- Desktop 30-second primary trace: median >=55 FPS, 1% low >=45 FPS.
- Named mobile 30-second trace: median >=45 FPS, 1% low >=35 FPS.
- Five reset cycles: `renderer.info` resources within 5% of post-shell baseline; no residual timeline/listener.
- Twenty provider runs including five 15k-CJK inputs: median <=20s, p95 <=45s, all terminal <=60s, 100% required fields retained.
- Ten-minute overload soak: queue <=32, pools/caps never exceeded, bounded excess errors, event-loop lag p95 <=100ms, MCP load worsens A2MCP p95 <=20%.
- Five deployed cold starts pass A2MCP, MCP, capability share, demo, database and provider paths.

### Observability assertions

- Structured logs/metrics carry correlation IDs and redact SOP, prompts, provider payload, secrets, raw capability/session/IP.
- Metrics include adapter latency/error/rate, phase latency, attempts/tokens/schema failures, queue/pools/breaker/spend, session/stream counts, cold starts and DB latency.
- Client marks cover shell, first frame, phase transitions, final scene and decision consequence.
- Liveness proves process/event loop only; readiness fails for migrations/DB/closed admission.
- Judging-window alert checks: endpoint 5xx, p95 >45s, timeouts, breaker/spend, DB exhaustion and external review status.

## 9. Coverage and CI gates

- `packages/contracts`, `packages/core`, non-bootstrap `apps/server`, and non-vendor `apps/web` each require >=80% lines, branches, functions, and statements.
- Vendor component source may be excluded only with ledger justification and E2E/accessibility coverage.
- Aggregate coverage never substitutes for mandatory lifecycle/protocol/security branches.
- CI sequence: format/typecheck/lint → unit/coverage → integration/PostgreSQL → A2MCP/MCP protocol → security → browser E2E/accessibility → production build → bounded performance smoke.
- Release sequence additionally runs provider sandbox, inspector/client, named hardware traces, overload soak, cold deploy and evidence audit.

## 10. Requirements-to-evidence matrix

| AC | Requirement | Required evidence | Owner |
|---:|---|---|---|
| 1 | Public free A2MCP HTTP 200/no payment | registered fixture, HTTPS smoke, scan | Core/A2MCP |
| 2 | Internal review readiness vs external approval | readiness bundle; separate OKX receipt/status only | Product/review |
| 3 | 15k input and 20/45/60 latency | 20-run report | Core + verifier |
| 4 | Three parallel specialists then moderator | orchestration trace | Core |
| 5 | Malformed/injected containment | schema/security/E2E | Security verifier |
| 6 | One Core, compatible IDs/schema | cross-adapter contract suite | Core |
| 7 | Full current MCP | protocol suite/inspector transcript | MCP |
| 8 | Exactly six audited components | provenance/accessibility ledger | Front-end |
| 9 | One loop/cleanup | instrumentation/disposal report | Front-end + verifier |
| 10 | Causal phishing rehearsal | desktop E2E/video | Product + verifier |
| 11 | Desktop timing/FPS | five cold + 30s trace | Performance verifier |
| 12 | Mobile usability/FPS | device E2E + 30s trace | Performance verifier |
| 13 | Deployed cold paths/no leaks | five cold captures/redaction scan | Operations |
| 14 | <=90s truthful demo | capture/evidence review | Product |
| 15 | Payment extension only | doc/dependency scan | Architect + security |
| 16 | >=80% four metrics | CI coverage report | Test verifier |
| 17 | Bounded overload | 10-minute soak | Operations |
| 18 | Owner/share authorization | capability/IDOR suite | Core + security |
| 19 | 58s absolute A2MCP deadline | fake-clock/proxy-margin suite | Core + operations |
| 20 | Exact AttemptBudget | exhaustive budget suite | Core |
| 21 | Boot-invalid sessions/caps | purge/boot-ID fault suite | MCP + verifier |

## 11. External ASP evidence separation

Passing implementation tests proves only internal readiness. The readiness bundle must exist by 2026-07-23 12:00 UTC and contain manifest, sanitized fixtures, public HTTPS smoke and remediation checklist. Actual submission requires explicit user approval. Only OKX.AI receipt/status evidence proves submitted, approved or live; target resubmission is 2026-07-25 12:00 UTC and deadline is 2026-07-27 23:59 UTC. A missing external artifact is reported as an eligibility blocker, never converted into a test pass.

## 12. Final evidence bundle and stop rule

Bundle: coverage reports, fixture hashes, DB/adapter/protocol/security outputs, inspector transcript, component/license ledger, accessibility report, Chrome/mobile traces, renderer disposal report, overload/cold-start logs, scans, correlation/redaction samples, readiness package, external receipt/status if user-authorized, and demo capture.

Stop only when all internal AC rows pass with fresh artifacts, all thresholds hold, and no critical/high defect remains. External approval is reported separately. A local demo, written code, or readiness package alone is not completion.
