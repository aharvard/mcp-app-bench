# MCP Apps audit profiles and human test guide

The bench measures observable behavior. It does not certify a host from a successful JSON-RPC response.

## Pinned references

- Stable document: [2026-01-26/apps.mdx](https://github.com/modelcontextprotocol/ext-apps/blob/6d9bdc7babf275b759225aa722cbf5510c4c6021/specification/2026-01-26/apps.mdx).
- Draft document: [draft/apps.mdx](https://github.com/modelcontextprotocol/ext-apps/blob/6d9bdc7babf275b759225aa722cbf5510c4c6021/specification/draft/apps.mdx).
- SDK wire oracle: [generated/schema.json](https://github.com/modelcontextprotocol/ext-apps/blob/6d9bdc7babf275b759225aa722cbf5510c4c6021/src/generated/schema.json), vendored in `test/fixtures/ext-apps-schema.json` with the upstream license. This is a generated snapshot from the pinned revision, not a claim that every definition is stable.

The app requests MCP **Apps** version `2026-01-26`. The server's core MCP transport version is independent. `draft@6d9bdc7` is a bench profile label, never a negotiated version string. A host returning another nonempty Apps version can still be inspected; the UI labels its results a reference comparison, not conformance with that other version. Legacy aliases are compatibility observations, not canonical fields.

The pinned prose and generated schema disagree in places. The shell uses `ui/initialize`, required `appInfo` and `appCapabilities`, array `ui/message.content`, and optional width/height in size notifications. The schema requires `hostContext` in the initialization result, while prose says hosts SHOULD include it. The bench tolerates omitted/null sections to remain inspectable; that normalization is not proof of schema conformance. Dimensions may omit either axis independently. Unknown protocol versions and missing optional features must not inflate a pass/fail score.

## Run locally

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm exec playwright install chromium
pnpm test:browser
pnpm build
pnpm start
```

Connect your host to `http://localhost:6789/mcp`. For a remote host, use a reachable deployment and set `BASE_URL` to its origin; configure trusted hosts/origins as documented in the README. Request tools by their exact names below. Browser tests start temporary localhost servers and use synthetic media devices and location data, not your camera or microphone. They do not replace your system clipboard.

## Outcomes

| Outcome                 | What it establishes                                                                                                              |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Unsupported             | The optional capability was not advertised; the normal probe did not send a request.                                             |
| Sent                    | A notification left the app. There is no protocol acknowledgement for logging/list-change/teardown-request notifications.        |
| Acknowledged            | A request returned a result; rendering, model delivery, approval, or downloaded bytes still need observation.                    |
| Tool error (`isError`)  | The response reports an application-level failure; it is not a successful operation.                                             |
| JSON-RPC rejection      | The request was rejected. Inspect the error and policy; an arbitrary server error does not prove correct permission enforcement. |
| Transport error/timeout | Inconclusive about optional-feature support or policy enforcement.                                                               |
| Observed pass/fail      | A deterministic result or browser behavior was actually checked.                                                                 |
| Human observation       | Explicit evidence supplied by the tester, kept separate from automated grading.                                                  |

The explicit negative-probe checkbox intentionally bypasses capability gates. Leave it unchecked for ordinary testing. Reports remain in the view; copy the JSON/evidence before closing it. No live-host certification is implied by the controlled harness results.

## Coverage for issue #19

| Issue | Fixture and expected result                                                                                                                                                      | Automated evidence / human follow-up                                                                                                                                                             |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| #1    | `inspect-host-info`: validate containers, enums, array members, nested tool/input schema, style records; keep optional coverage separate.                                        | Shell regressions cover malformed values and safe traversal; inspect the raw data and grade in your host.                                                                                        |
| #2    | Ignore sibling/unrelated-window protocol messages.                                                                                                                               | Shell source-window regressions.                                                                                                                                                                 |
| #3    | Keep incoming requests separate from responses, including equal IDs; reject unknown methods; clean pending work on teardown.                                                     | Transport regressions and controlled proxy lifecycle.                                                                                                                                            |
| #4    | `inspect-messaging`: logging sends an ID-less notification and reports only “sent”; absent logging is unsupported.                                                               | Wire-envelope checks; inspect host logs manually for receipt.                                                                                                                                    |
| #5    | `resources/read` fixture returns exact `MCP App Bench resource fixture v1`; missing URI is explicitly negative.                                                                  | Server fixture tests and audit panel content assertion.                                                                                                                                          |
| #6    | `inspect-tool-data` is visible after initialization, before results; ordered partial/input/result/cancellation diagnostics retain reasons and flag invalid sequences.            | Deterministic streaming, success, `isError`, cancellation and invalid-order tests; browser cancellation view.                                                                                    |
| #7    | Normal modes are the host/app intersection. Omitted declaration and explicit inline-only are different tools. Negative control is separate. A host may decline a requested mode. | Browser disabled-button test; manually verify returned/notified modes stay in the supported intersection.                                                                                        |
| #8    | Unusable initialization fails visibly; other versions remain inspectable. Timeouts, late responses and cleanup are observable.                                                   | Transport tests, protocol-schema checks and browser init.                                                                                                                                        |
| #9    | Fixed/max/unbounded width and height work independently; constrained content remains reachable.                                                                                  | Nine dimension combinations, context updates and scrolling in Chromium.                                                                                                                          |
| #10   | Host CSS is injected, including fonts-only payloads; replacement and removal update the document.                                                                                | Browser CSS replacement/removal; actual font loading remains separately observable in the browser font set/Network/CSP tools.                                                                    |
| #11   | `inspect-transparency` reports local CSS alpha only, never claims host compositing from it. Host/OS themes may legitimately differ.                                              | Shared shell tests; verify host background visually as described below.                                                                                                                          |
| #12   | Browser preflight allows `MCP-Protocol-Version` and MCP v2 headers.                                                                                                              | Existing HTTP/CORS integration tests from main.                                                                                                                                                  |
| #13   | `audit-discovery-text`, `-blob`, `-legacy`, `-missing`, `-malformed`, `-precedence`.                                                                                             | SDK tests verify payloads and metadata; host render/discovery decisions need human observation. Precedence is draft-only.                                                                        |
| #14   | `inspect-security-declared` and `-omitted`: reachable connect/resource/frame/base fixtures, DOM isolation and click-to-run permissions.                                          | Real browser CSP violations, isolated single/double iframe hosts, synthetic permission grant/deny tests. Clipboard policy is automated; actual clipboard write requires an explicit human click. |
| #15   | `inspect-audit-stable`: call both/app-only/model-only/default; app-origin model-only execution is a failure.                                                                     | Browser outcome tests and server metadata. Inspect the host's model-facing tool list separately.                                                                                                 |
| #16   | Token-bearing text/structured context, overwrite and clear; next-turn evidence separate from acknowledgement.                                                                    | Capability/outcome regressions. Actual model-context delivery and injection require the human workflow below.                                                                                    |
| #17   | `inspect-audit-draft`: embedded/linked download, sampling/tools capabilities, app tools/list/call/list-change, request-teardown and message/context modalities.                  | Distinct profile UI, capability gate and app-tool transport/cleanup tests. Host-mediated behavior requires human observation.                                                                    |
| #18   | Local interfaces match emitted init/content arrays/optional size, required tool-result content and resource text/blob; draft types stay separate.                                | Actual shell messages validated against pinned generated JSON schemas; TypeScript checks.                                                                                                        |

## Human walkthrough

### Core inspectors

1. Open `inspect-host-info`. It should render as soon as initialization completes, without waiting for the tool result. Check the host-reported version and bench reference separately.
2. Open `inspect-tool-data`. With a host harness, send partial input, complete input, then result. Repeat with cancellation instead of result. Expect ordered evidence and the cancellation reason. Send result without input and confirm it is flagged.
3. Open `inspect-messaging`. Read the deterministic resource; expect an exact-match result. Send a log notification and check host logs. No pending request or timeout should be created for logging.
4. Open `inspect-display-modes-inline-only`, then `inspect-display-modes-undeclared`. Their app declarations must differ. Unsupported normal buttons must be disabled, including keyboard activation. Use the separate negative control only deliberately. A return of the current supported mode is a valid decline.
5. Resize the host pane and change dimension constraints. You should still reach lower controls. In `inspect-host-styles`, supply fonts-only CSS, replace it, then remove it. Inspect font loading separately from the presence of the style element.
6. Put `inspect-transparency` over a known patterned host background. Toggle host and OS light/dark settings separately. The host background must remain visible to establish compositing; local alpha is insufficient.

### Discovery and security

Run each `audit-discovery-*` tool in a fresh view. Text and blob must render the same marker and initialize. Record legacy compatibility separately. Missing and malformed fixtures should fail gracefully, not show a false working-app result. For the **draft** precedence fixture, list metadata requests a border and read metadata requests none; inspect the host-owned border, not app CSS.

Run `inspect-security-declared` and `inspect-security-omitted` in separate views. Click the network button and inspect both the report and browser console. The declared case requests the bench origin for connect/resource/frame/base; the omitted case requests no external origins. Match blocked requests to enforcing CSP violation events. A fetch error alone is inconclusive. Record any host-imposed restrictions rather than treating every denied optional request as nonconformance.

Click DOM isolation. Parent DOM access is a failure; same-document execution outside an iframe is not a valid isolation test. For hosts using a sandbox proxy, inspect `sandbox-proxy-ready`, `sandbox-resource-ready` and the inner iframe restrictions in host diagnostics. The automated proxy is a controlled fixture, not code installed into your host.

For camera, microphone, geolocation and clipboard, run both a granted and denied session after changing host/browser settings. These actions are never automatic in the live fixture. Media tracks stop immediately. Location coordinates are not recorded. The clipboard probe overwrites clipboard text, so preserve anything important first. Denial is a valid optional/policy outcome; record declared, host-granted, browser-policy and observed states separately.

### Visibility and model context

1. Open `inspect-audit-stable`. Call all four visibility tools. Normal app calls should work for both/app-only/default if `serverTools` exists. Model-only must not execute from the app.
2. Inspect the host's actual model-facing tool list: app-only must be absent; model-only, both and default must be present. Do not infer this from an app tool response or an assistant's guess about its tools.
3. Send text context. In a **new** user turn ask: “What is the current bench token from app context?” Do not paste the token. Compare the answer and, where possible, host context injection with the recorded token.
4. Repeat with structured context, then overwrite. Only the latest app contribution should be injected; it must not accumulate older updates.
5. Clear context. Inspect the next turn's injected context. A model may remember tokens already discussed in conversation; that is not proof that clearing failed. Use a fresh conversation or inspect injection directly.
6. Test absent capabilities with normal controls, then deliberately enable negative probes. Unsupported, policy rejection, `isError` and transport failure must remain distinguishable.

### Draft-only actions

Open `inspect-audit-draft`. Verify the separate snapshot label. These results must never reduce the stable score.

- Download embedded and linked text. Inspect approval behavior and the actual file contents. Embedded text is `MCP App Bench download fixture v1`; the linked fixture includes a trailing newline. Host refusal is permitted.
- Request sampling with and without tools. Normal probes must respect `sampling` and `sampling.tools`. Inspect any approval flow and returned completion. These user-gated requests have no automatic local timeout; host teardown still clears pending work.
- Ask the host to discover and call app-provided `bench_echo` with a string `token`. Confirm the app records the invocation and echoes the token. Toggle the tool, inspect list refresh, and try invalid arguments. After host teardown the app tool must no longer be callable.
- Send each advertised message/context modality. Compare rendered or injected content with the payload; success acknowledgement is insufficient.
- Request teardown. The host may defer or ignore it. If accepted, observe `ui/resource-teardown` and the app response before removal. Reopen a fresh view and verify no old tool handlers remain.
