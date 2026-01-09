import express from "express"
import cors from "cors"
import chalk from "chalk"
import path from "path"
import { fileURLToPath } from "url"
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js"
import { randomUUID } from "crypto"
import {
  logClientMessage,
  logServerMessage,
  logSessionInitialized,
  logSessionClosed,
  logSessionRequestFailed,
  logServerStarted,
} from "./utils/logger.js"
import { initMcpAppServer } from "./mcp-app-server.js"
import { BASE_URL, PORT } from "./utils/constants.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()

app.use(
  cors({
    origin: "*",
    exposedHeaders: ["Mcp-Session-Id", "Link"],
    allowedHeaders: ["Content-Type", "mcp-session-id"],
  })
)
app.use(express.json())

// Serve static assets (audio files, etc.) from the assets directory
const assetsDir = path.join(__dirname, "..", "assets")
app.use("/assets", express.static(assetsDir, { maxAge: "1h" }))

// Serve shell assets (CSS, JS) from the static/shell directory
const shellDir = path.join(__dirname, "static", "shell")
app.use("/shell", express.static(shellDir, { maxAge: "1h" }))

// =============================================================================
// Transport Maps - Separate maps for each endpoint
// =============================================================================

// Map to store transports by session ID for /mcp (OpenAI Apps SDK mode)
const mcpTransports: { [sessionId: string]: StreamableHTTPServerTransport } = {}

// =============================================================================
// /mcp Route - Original OpenAI Apps SDK Implementation
// =============================================================================

// Add favicon Link header to all /mcp requests
app.use("/mcp", (req, res, next) => {
  res.setHeader("Link", `<${BASE_URL}/assets/icon.svg>; rel="icon"`)
  next()
})

// Handle POST requests for client-to-server communication.
app.post("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined
  let transport: StreamableHTTPServerTransport

  if (sessionId && mcpTransports[sessionId]) {
    // A session already exists; reuse the existing transport.
    console.log(
      chalk.gray(`♻️  [/mcp] Reusing transport for session: ${sessionId}`)
    )
    transport = mcpTransports[sessionId]
  } else if (!sessionId && isInitializeRequest(req.body)) {
    // This is a new initialization request. Create a new transport.
    console.log(chalk.yellow("🔄 [/mcp] Creating new MCP session..."))
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sid) => {
        mcpTransports[sid] = transport
        logSessionInitialized(sid, Object.keys(mcpTransports).length, "/mcp")
      },
    })

    // Log incoming messages from the client
    transport.onmessage = (message) => {
      logClientMessage(transport.sessionId, message)
    }

    // Wrap the transport's send method to log outgoing messages
    const originalSend = transport.send.bind(transport)
    transport.send = async (message, options) => {
      logServerMessage(transport.sessionId, message)
      return originalSend(message, options)
    }

    // Clean up the transport from our map when the session closes.
    transport.onclose = () => {
      if (transport.sessionId) {
        logSessionClosed(
          transport.sessionId,
          Object.keys(mcpTransports).length - 1,
          "/mcp"
        )
        delete mcpTransports[transport.sessionId]
      }
    }

    // Create and configure the MCP server for this session (OpenAI Apps SDK mode)
    const server = initMcpAppServer()

    // Connect the server instance to the transport for this session.
    await server.connect(transport)
  } else {
    return res.status(400).json({
      error: { message: "Bad Request: No valid session ID provided" },
    })
  }

  // Handle the client's request using the session's transport.
  await transport.handleRequest(req, res, req.body)
})

// A separate, reusable handler for GET and DELETE requests on /mcp
const handleMcpSessionRequest = async (
  req: express.Request,
  res: express.Response
) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined
  const methodIcon = req.method === "GET" ? "📥" : "🗑️"
  const methodColor = req.method === "GET" ? chalk.cyan : chalk.red

  if (!sessionId || !mcpTransports[sessionId]) {
    logSessionRequestFailed(
      req.method,
      sessionId,
      Object.keys(mcpTransports).length,
      "/mcp"
    )
    return res.status(404).send("Session not found")
  }

  console.log(
    methodColor(
      `${methodIcon} [/mcp] ${req.method} request for session: ${sessionId}`
    )
  )

  const transport = mcpTransports[sessionId]
  await transport.handleRequest(req, res)
}

// GET handles the long-lived stream for server-to-client messages.
app.get("/mcp", handleMcpSessionRequest)

// DELETE handles explicit session termination from the client.
app.delete("/mcp", handleMcpSessionRequest)

// =============================================================================
// Start Server
// =============================================================================

app.listen(PORT, () => {
  logServerStarted(PORT)
})
