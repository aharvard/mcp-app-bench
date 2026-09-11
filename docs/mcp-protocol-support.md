# MCP protocol support

The `/mcp` endpoint is built with `createMcpHandler(factory)` from the TypeScript
SDK v2 and mounted in Express through `toNodeHandler`. The factory creates a fresh
MCP server for every request.

## Protocol compatibility

- MCP 2026-07-28 is served through the modern per-request protocol. Clients must
  send the request metadata envelope and matching `MCP-Protocol-Version`,
  `Mcp-Method`, and, when applicable, `Mcp-Name` headers.
- 2025-era clients use the SDK's stateless legacy fallback. The endpoint does not
  issue or retain `Mcp-Session-Id` values. Each legacy POST is independent, so
  standalone GET streams, resumption, subscriptions, and DELETE-based session
  teardown are not available on this compatibility path.
- MCP Apps remains on the separately versioned `io.modelcontextprotocol/ui`
  2026-01-26 profile. The MCP core upgrade does not change that extension version.

## Network configuration

Host and Origin validation run before the body parser and MCP handler. Allowed
hostnames are assembled from `MCP_ALLOWED_HOSTS`, `RENDER_EXTERNAL_HOSTNAME`, the
hostname in `BASE_URL`, and localhost defaults. `MCP_ALLOWED_ORIGINS` overrides the
origin hostname list; otherwise it matches the allowed-host list. Both environment
variables are comma-separated hostname lists without schemes or ports.

Browser preflights reflect requested header names after Origin validation. This
supports `Content-Type`, the standard MCP headers, and dynamically named
`Mcp-Param-*` headers. Responses expose protocol, method, name, session,
resumption, and icon-link headers used by browser clients.

## Verified requirements

The automated suite verifies:

- modern discovery and explicit 2026-07-28 negotiation;
- tool and resource listing, tool calls, and UI resource reads;
- tool/resource UI metadata, structured tool results, and server-provided result
  `_meta`;
- the stateless 2025-era compatibility path;
- missing and mismatched standard headers, unsupported protocol versions,
  invalid parameters, unknown methods, malformed JSON-RPC, and unsupported HTTP
  methods;
- valid and invalid Host and Origin headers, plus browser CORS preflight behavior
  including a representative `Mcp-Param-*` header;
- handler and client cleanup.

These checks verify the mandatory requirements exercised by this server; a passing
build is not a claim of full MCP conformance. The server does not implement optional
sampling, elicitation, multi-round-trip input, tasks, OAuth, resource subscriptions,
or resumable SSE. Modern logging is advertised, but request-scoped log-level behavior
is not part of this bench's current test profile.
