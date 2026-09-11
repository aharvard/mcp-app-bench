import cors from "cors"
import express from "express"
import { createMcpExpressApp } from "@modelcontextprotocol/express"
import { toNodeHandler } from "@modelcontextprotocol/node"
import { createMcpHandler } from "@modelcontextprotocol/server"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { initMcpAppServer } from "./mcp-app-server.js"
import { BASE_URL } from "./utils/constants.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const EXPOSED_MCP_HEADERS = [
  "Mcp-Session-Id",
  "MCP-Protocol-Version",
  "Mcp-Method",
  "Mcp-Name",
  "Last-Event-Id",
  "Link",
] as const

export interface HttpAppOptions {
  host?: string
  allowedHosts?: string[]
  allowedOrigins?: string[]
}

function splitHostnames(value: string | undefined): string[] {
  return value
    ? value
        .split(",")
        .map((hostname) => hostname.trim())
        .filter(Boolean)
    : []
}

function baseUrlHostname(): string {
  try {
    return new URL(BASE_URL).hostname
  } catch {
    throw new Error(`BASE_URL must be an absolute URL; received ${BASE_URL}`)
  }
}

function uniqueHostnames(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
}

export function resolveAllowedHosts(): string[] {
  return uniqueHostnames([
    ...splitHostnames(process.env.MCP_ALLOWED_HOSTS),
    process.env.RENDER_EXTERNAL_HOSTNAME,
    baseUrlHostname(),
    "localhost",
    "127.0.0.1",
    "::1",
  ])
}

export function resolveAllowedOrigins(allowedHosts: string[]): string[] {
  const configured = splitHostnames(process.env.MCP_ALLOWED_ORIGINS)
  return configured.length > 0 ? uniqueHostnames(configured) : allowedHosts
}

/**
 * Build the production Express app without binding a port so tests can exercise
 * the exact middleware and MCP handler that are deployed.
 */
export function createHttpApp(options: HttpAppOptions = {}) {
  const allowedHosts = options.allowedHosts ?? resolveAllowedHosts()
  const allowedOrigins =
    options.allowedOrigins ?? resolveAllowedOrigins(allowedHosts)

  const app = createMcpExpressApp({
    host: options.host ?? "0.0.0.0",
    allowedHosts,
    allowedOrigins,
  })

  // Omitting cors.allowedHeaders intentionally reflects the browser's requested
  // header names. That permits the fixed MCP headers plus dynamically named
  // Mcp-Param-* headers while Origin validation above limits trusted sites.
  app.use(
    cors({
      origin: true,
      methods: ["GET", "POST", "DELETE", "OPTIONS"],
      exposedHeaders: [...EXPOSED_MCP_HEADERS],
    })
  )

  const assetsDir = path.join(__dirname, "..", "assets")
  app.use("/assets", express.static(assetsDir, { maxAge: "1h" }))

  const staticDir = path.join(__dirname, "static")
  app.use("/static", express.static(staticDir, { maxAge: "1h" }))
  app.use("/shell", express.static(path.join(staticDir, "shell")))

  const mcpHandler = createMcpHandler(() => initMcpAppServer())
  const nodeHandler = toNodeHandler(mcpHandler)

  app.use("/mcp", (_req, res, next) => {
    res.setHeader("Link", `<${BASE_URL}/static/icon.svg>; rel="icon"`)
    next()
  })

  app.all("/mcp", async (req, res, next) => {
    try {
      await nodeHandler(req, res, req.body)
    } catch (error) {
      next(error)
    }
  })

  return { app, mcpHandler }
}
