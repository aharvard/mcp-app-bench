# MCP App Bench

An interactive bench test to evaluate MCP host support for MCP Apps.

## MCP transport

The `/mcp` endpoint uses TypeScript SDK v2 and serves MCP 2026-07-28 plus a
stateless fallback for 2025-era clients. See
[docs/mcp-protocol-support.md](docs/mcp-protocol-support.md) for compatibility,
security configuration, and the verified protocol requirements.

Requires Node.js 20 or newer.
