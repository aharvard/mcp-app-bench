# MCP App Bench

An interactive bench test to evaluate MCP host support for MCP Apps.

See the [conformance profiles and human test guide](docs/conformance-profiles.md) for the stable/draft audit tools, expected host behavior, and local browser tests.

## MCP transport

The `/mcp` endpoint uses TypeScript SDK v2 and serves MCP 2026-07-28 plus a
stateless fallback for 2025-era clients.

Requires Node.js 20 or newer.
