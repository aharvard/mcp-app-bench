import assert from "node:assert/strict"
import http, { type Server } from "node:http"
import { after, before, describe, test } from "node:test"
import type { AddressInfo } from "node:net"

import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client"
import { createMcpHandler } from "@modelcontextprotocol/server"

import { createHttpApp } from "../src/http-app.js"
import { initMcpAppServer } from "../src/mcp-app-server.js"
import { INSPECT_TOOL_DATA_URI } from "../src/utils/constants.js"

const MODERN_VERSION = "2026-07-28"

test("audit discovery fixtures expose deterministic valid and explicitly negative resources", async () => {
  await withClient(true, async (client) => {
    const tools = await client.listTools()
    for (const variant of [
      "text",
      "blob",
      "legacy",
      "missing",
      "malformed",
      "precedence",
    ]) {
      assert.ok(
        tools.tools.some((t) => t.name === "audit-discovery-" + variant)
      )
      const result = await client.callTool({
        name: "audit-discovery-" + variant,
        arguments: {},
      })
      assert.notEqual(result.isError, true)
    }
    const text = await client.readResource({ uri: "ui://audit/text" })
    const blob = await client.readResource({ uri: "ui://audit/blob" })
    assert.equal(
      Buffer.from(
        (blob.contents[0] as { blob: string }).blob,
        "base64"
      ).toString(),
      (text.contents[0] as { text: string }).text
    )
    const demo = await client.readResource({
      uri: "resource://example/demo-resource",
    })
    assert.equal(
      (demo.contents[0] as { text: string }).text,
      "MCP App Bench resource fixture v1"
    )
    await assert.rejects(client.readResource({ uri: "ui://audit/missing" }))
    const malformed = await client.readResource({ uri: "ui://audit/malformed" })
    assert.equal(malformed.contents[0].mimeType, "application/json")
    const listed = await client.listResources()
    assert.equal(
      (
        listed.resources.find((r) => r.uri === "ui://audit/precedence")?._meta
          ?.ui as { prefersBorder: boolean }
      ).prefersBorder,
      true
    )
    const read = await client.readResource({ uri: "ui://audit/precedence" })
    assert.equal(
      (read.contents[0]._meta?.ui as { prefersBorder: boolean }).prefersBorder,
      false
    )
    for (const variant of [
      "stable",
      "draft",
      "inline-only",
      "security-declared",
      "security-omitted",
    ]) {
      const resource = await client.readResource({
        uri: "ui://audit/" + variant,
      })
      assert.match(
        (resource.contents[0] as { text: string }).text,
        /MCPAppShell|shell\/shell.js/
      )
      assert.ok(!(resource.contents[0] as { text: string }).text.includes("{{"))
    }
  })
})
const MODERN_ENVELOPE = {
  "io.modelcontextprotocol/protocolVersion": MODERN_VERSION,
  "io.modelcontextprotocol/clientInfo": {
    name: "mcp-app-bench-tests",
    version: "1.0.0",
  },
  "io.modelcontextprotocol/clientCapabilities": {},
}

async function withClient(
  modern: boolean,
  run: (client: Client) => Promise<void>
) {
  const handler = createMcpHandler(() => initMcpAppServer())
  const transport = new StreamableHTTPClientTransport(
    new URL("http://test.local/mcp"),
    {
      fetch: (url, init) => handler.fetch(new Request(url, init)),
    }
  )
  const client = new Client(
    { name: "mcp-app-bench-tests", version: "1.0.0" },
    modern
      ? { versionNegotiation: { mode: { pin: MODERN_VERSION } } }
      : undefined
  )

  try {
    await client.connect(transport)
    await run(client)
  } finally {
    await client.close()
    await handler.close()
  }
}

function modernRequest(
  method: string,
  params: Record<string, unknown> = {},
  version = MODERN_VERSION
) {
  return {
    jsonrpc: "2.0",
    id: 1,
    method,
    params: {
      ...params,
      _meta: {
        ...MODERN_ENVELOPE,
        "io.modelcontextprotocol/protocolVersion": version,
      },
    },
  }
}

function modernHeaders(
  method: string,
  name?: string,
  version = MODERN_VERSION
): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    "MCP-Protocol-Version": version,
    "Mcp-Method": method,
    ...(name ? { "Mcp-Name": name } : {}),
  }
}

async function jsonResponse(
  handler: ReturnType<typeof createMcpHandler>,
  body: unknown,
  headers: Record<string, string>
) {
  const response = await handler.fetch(
    new Request("http://test.local/mcp", {
      method: "POST",
      headers,
      body: typeof body === "string" ? body : JSON.stringify(body),
    })
  )
  const text = await response.text()
  const eventData = text
    .split("\n")
    .find((line) => line.startsWith("data: "))
    ?.slice("data: ".length)
  return { response, body: JSON.parse(eventData ?? text) as any }
}

describe("MCP v2 integration", () => {
  test("negotiates 2026-07-28 and preserves tools, resources, and metadata", async () => {
    await withClient(true, async (client) => {
      assert.equal(client.getProtocolEra(), "modern")
      assert.equal(client.getNegotiatedProtocolVersion(), MODERN_VERSION)

      const tools = await client.listTools()
      assert.ok(tools.tools.length >= 18)
      const tool = tools.tools.find(({ name }) => name === "inspect-tool-data")
      assert.equal(
        (tool?._meta as { ui?: { resourceUri?: string } })?.ui?.resourceUri,
        INSPECT_TOOL_DATA_URI
      )

      const resources = await client.listResources()
      assert.ok(resources.resources.length >= 13)

      const result = await client.callTool({
        name: "inspect-tool-data",
        arguments: { joke: "A deterministic joke." },
      })
      assert.equal((result._meta as { foo?: string })?.foo, "bar")
      assert.equal(
        (result.structuredContent as { joke?: string })?.joke,
        "A deterministic joke."
      )
      assert.match(
        (result.content[0] as { text: string }).text,
        /Tool Data Inspector loaded/
      )

      const resource = await client.readResource({ uri: INSPECT_TOOL_DATA_URI })
      assert.equal(resource.contents[0]?.mimeType, "text/html;profile=mcp-app")
      assert.equal(
        (resource.contents[0]?._meta as { ui?: { prefersBorder?: boolean } })
          ?.ui?.prefersBorder,
        true
      )
      assert.match(
        (resource.contents[0] as { text: string }).text,
        /<!doctype html>/i
      )
    })
  })

  test("keeps 2025-era clients working through the stateless fallback", async () => {
    await withClient(false, async (client) => {
      assert.equal(client.getProtocolEra(), "legacy")
      const tools = await client.listTools()
      assert.ok(tools.tools.some(({ name }) => name === "get-server-time"))
      const result = await client.callTool({
        name: "get-server-time",
        arguments: {},
      })
      assert.equal(typeof (result.structuredContent as any)?.unixMs, "number")
    })
  })
})

describe("MCP HTTP validation", () => {
  test("enforces modern headers, versions, parameters, methods, and JSON-RPC", async () => {
    const handler = createMcpHandler(() => initMcpAppServer())
    try {
      const missingMethod = await jsonResponse(
        handler,
        modernRequest("tools/list"),
        {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          "MCP-Protocol-Version": MODERN_VERSION,
        }
      )
      assert.equal(missingMethod.response.status, 400)
      assert.equal(missingMethod.body.error.code, -32020)

      const mismatchedVersion = await jsonResponse(
        handler,
        modernRequest("tools/list"),
        modernHeaders("tools/list", undefined, "2025-11-25")
      )
      assert.equal(mismatchedVersion.response.status, 400)
      assert.equal(mismatchedVersion.body.error.code, -32020)

      const mismatchedMethod = await jsonResponse(
        handler,
        modernRequest("tools/list"),
        modernHeaders("resources/list")
      )
      assert.equal(mismatchedMethod.response.status, 400)
      assert.equal(mismatchedMethod.body.error.code, -32020)

      const missingName = await jsonResponse(
        handler,
        modernRequest("tools/call", {
          name: "get-server-time",
          arguments: {},
        }),
        modernHeaders("tools/call")
      )
      assert.equal(missingName.response.status, 400)
      assert.equal(missingName.body.error.code, -32020)

      const unsupportedVersion = "2099-01-01"
      const invalidVersion = await jsonResponse(
        handler,
        modernRequest("tools/list", {}, unsupportedVersion),
        modernHeaders("tools/list", undefined, unsupportedVersion)
      )
      assert.equal(invalidVersion.response.status, 400)
      assert.equal(invalidVersion.body.error.code, -32022)

      const invalidParameters = await jsonResponse(
        handler,
        modernRequest("tools/call", {
          name: "inspect-media-player",
          arguments: { mediaType: "paper" },
        }),
        modernHeaders("tools/call", "inspect-media-player")
      )
      assert.equal(invalidParameters.response.status, 200)
      assert.equal(invalidParameters.body.result.isError, true)

      const unknownMethod = await jsonResponse(
        handler,
        modernRequest("bench/unknown"),
        modernHeaders("bench/unknown")
      )
      assert.equal(unknownMethod.response.status, 404)
      assert.equal(unknownMethod.body.error.code, -32601)

      const malformed = await jsonResponse(handler, "{not-json", {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      })
      assert.equal(malformed.response.status, 400)
      assert.equal(malformed.body.error.code, -32700)

      const get = await handler.fetch(
        new Request("http://test.local/mcp", { method: "GET" })
      )
      assert.equal(get.status, 405)

      const put = await handler.fetch(
        new Request("http://test.local/mcp", { method: "PUT" })
      )
      assert.equal(put.status, 405)
    } finally {
      await handler.close()
    }
  })

  test("serves legacy requests without creating sessions", async () => {
    const handler = createMcpHandler(() => initMcpAppServer())
    try {
      const initialize = await jsonResponse(
        handler,
        {
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-11-25",
            capabilities: {},
            clientInfo: { name: "legacy-test", version: "1.0.0" },
          },
        },
        {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
        }
      )
      assert.equal(initialize.response.status, 200)
      assert.equal(initialize.response.headers.get("mcp-session-id"), null)
      assert.equal(initialize.body.result.protocolVersion, "2025-11-25")

      const list = await jsonResponse(
        handler,
        { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
        {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
        }
      )
      assert.equal(list.response.status, 200)
      assert.ok(Array.isArray(list.body.result.tools))
    } finally {
      await handler.close()
    }
  })

  test("closes the per-request handler and rejects new work", async () => {
    const handler = createMcpHandler(() => initMcpAppServer())
    await handler.close()
    await assert.rejects(() =>
      handler.fetch(
        new Request("http://test.local/mcp", {
          method: "POST",
          headers: modernHeaders("tools/list"),
          body: JSON.stringify(modernRequest("tools/list")),
        })
      )
    )
  })
})

describe("Express Host, Origin, and CORS policy", () => {
  let server: Server
  let port: number
  let closeHandler: () => Promise<void>

  before(async () => {
    const { app, mcpHandler } = createHttpApp({
      allowedHosts: ["allowed.test", "127.0.0.1"],
      allowedOrigins: ["app.allowed.test"],
    })
    closeHandler = () => mcpHandler.close()
    server = await new Promise<Server>((resolve) => {
      const listening = app.listen(0, "127.0.0.1", () => resolve(listening))
    })
    port = (server.address() as AddressInfo).port
  })

  after(async () => {
    await closeHandler()
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()))
    })
  })

  function request(options: {
    method?: string
    host?: string
    origin?: string
    headers?: Record<string, string>
    body?: string
  }): Promise<{
    status: number
    headers: http.IncomingHttpHeaders
    body: string
  }> {
    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port,
          path: "/mcp",
          method: options.method ?? "POST",
          headers: {
            Host: options.host ?? "allowed.test",
            ...(options.origin ? { Origin: options.origin } : {}),
            ...options.headers,
          },
        },
        (response) => {
          const chunks: Buffer[] = []
          response.on("data", (chunk) => chunks.push(Buffer.from(chunk)))
          response.on("end", () =>
            resolve({
              status: response.statusCode ?? 0,
              headers: response.headers,
              body: Buffer.concat(chunks).toString("utf8"),
            })
          )
        }
      )
      req.on("error", reject)
      if (options.body) req.write(options.body)
      req.end()
    })
  }

  test("accepts trusted browser preflights and reflects dynamic MCP headers", async () => {
    const response = await request({
      method: "OPTIONS",
      origin: "https://app.allowed.test",
      headers: {
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers":
          "content-type,mcp-protocol-version,mcp-method,mcp-name,mcp-param-region",
      },
    })

    assert.equal(response.status, 204)
    assert.equal(
      response.headers["access-control-allow-origin"],
      "https://app.allowed.test"
    )
    const allowed = response.headers["access-control-allow-headers"] ?? ""
    for (const header of [
      "mcp-protocol-version",
      "mcp-method",
      "mcp-name",
      "mcp-param-region",
    ]) {
      assert.match(allowed.toLowerCase(), new RegExp(`(?:^|,)${header}(?:,|$)`))
    }
  })

  test("initializes and serves follow-up requests from a trusted cross-origin client", async () => {
    const transport = new StreamableHTTPClientTransport(
      new URL(`http://127.0.0.1:${port}/mcp`),
      {
        requestInit: { headers: { Origin: "https://app.allowed.test" } },
      }
    )
    const client = new Client(
      { name: "cross-origin-test", version: "1.0.0" },
      { versionNegotiation: { mode: { pin: MODERN_VERSION } } }
    )
    try {
      await client.connect(transport)
      assert.equal(client.getProtocolEra(), "modern")
      const tools = await client.listTools()
      assert.ok(tools.tools.some(({ name }) => name === "get-server-time"))
    } finally {
      await client.close()
    }
  })

  test("rejects untrusted Origin and Host headers before MCP dispatch", async () => {
    const badOrigin = await request({
      method: "OPTIONS",
      origin: "https://evil.test",
      headers: { "Access-Control-Request-Method": "POST" },
    })
    assert.equal(badOrigin.status, 403)

    const badHost = await request({ host: "evil.test" })
    assert.equal(badHost.status, 403)
  })
})
