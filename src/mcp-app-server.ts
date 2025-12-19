/**
 * MCP Server implementation using SEP-1865 (MCP Apps) specification.
 *
 * This server uses native MCP SDK patterns without the @mcp-ui/server adapter.
 * It's designed for clients that support the MCP Apps extension (io.modelcontextprotocol/ui).
 *
 * Route: /mcp-app
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import os from "os"
import {
  APP_ICON,
  BASE_URL,
  MCP_APPS_EXTENSION_ID,
  MCP_APPS_MIME_TYPE,
  MCP_APP_URI,
} from "./utils/constants.js"
import { loadAppHtml } from "./utils/load-app-html.js"

// Developer fortunes/wisdom
const FORTUNES = [
  "There are only two hard things in Computer Science: cache invalidation and naming things. — Phil Karlton",
  "It works on my machine. 🤷",
  "The best code is no code at all.",
  "First, solve the problem. Then, write the code. — John Johnson",
  "Debugging is twice as hard as writing the code. So if you write the code as cleverly as possible, you are, by definition, not smart enough to debug it. — Brian Kernighan",
  "Any fool can write code that a computer can understand. Good programmers write code that humans can understand. — Martin Fowler",
  "Talk is cheap. Show me the code. — Linus Torvalds",
  "Premature optimization is the root of all evil. — Donald Knuth",
  "The only way to go fast is to go well. — Robert C. Martin",
  "Simplicity is prerequisite for reliability. — Edsger Dijkstra",
  "Code never lies, comments sometimes do.",
  "A good programmer is someone who always looks both ways before crossing a one-way street. — Doug Linder",
  "In theory, there is no difference between theory and practice. In practice, there is. — Yogi Berra",
  "The computer was born to solve problems that did not exist before. — Bill Gates",
  "Software is like entropy: It is difficult to grasp, weighs nothing, and obeys the Second Law of Thermodynamics; i.e., it always increases.",
]

const serverStartTime = Date.now()

export function initMcpAppServer(): McpServer {
  console.log(`\n🚀 Initializing MCP server (SEP-1865 mode)`)
  console.log(`   Extension ID: ${MCP_APPS_EXTENSION_ID}`)
  console.log(`   MIME Type: ${MCP_APPS_MIME_TYPE}`)

  const server = new McpServer(
    {
      name: "mcp-app-bench",
      version: "0.1.0",
      icons: [
        {
          src: APP_ICON,
          mimeType: "image/svg+xml",
          sizes: ["any"],
        },
      ],
    },
    {
      // Enable logging capability so clients can call logging/setLevel
      capabilities: {
        logging: {},
      },
    }
  )

  // ==========================================================================
  // Resources - Register immediately (always available)
  // ==========================================================================
  // Note: UI resources are always registered. Clients that don't support
  // MCP Apps will simply ignore them (graceful degradation per SEP-1865).

  server.registerResource(
    "mcp-app-bench",
    MCP_APP_URI,
    {
      title: "MCP App Bench",
      description:
        "An interactive bench test to evaluate MCP host support for MCP Apps",
      mimeType: MCP_APPS_MIME_TYPE,
    },
    async () => ({
      contents: [
        {
          uri: MCP_APP_URI,
          mimeType: MCP_APPS_MIME_TYPE,
          text: loadAppHtml("mcp-app-bench"),
          _meta: {
            ui: {
              prefersBorder: true,
              csp: {
                resourceDomains: [BASE_URL],
              },
            },
          },
        },
      ],
    })
  )

  server.registerTool(
    "mcp-app-bench",
    {
      title: "MCP App Bench",
      description:
        "An interactive bench test to evaluate MCP host support for MCP Apps",
      inputSchema: {
        name: z.string().describe("The name of the MCP app to test").optional(),
      },
      outputSchema: {
        name: z.string().describe("The name of the MCP app to test").optional(),
        timestamp: z.string().describe("The timestamp of the test").optional(),
      },
      _meta: {
        "ui/resourceUri": MCP_APP_URI,
      },
    },
    async (args) => {
      const name = args.name ?? "mcp-app-bench"
      const structuredContent = {
        name,
        timestamp: new Date().toISOString(),
      }
      return {
        content: [
          {
            type: "text",
            text: `MCP App bench test loaded`,
          },
        ],
        structuredContent,
      }
    }
  )

  // ==========================================================================
  // Server Status Tool - Demonstrates server-side computation
  // ==========================================================================

  server.registerTool(
    "server-status",
    {
      title: "Server Status",
      description:
        "Get current server status including uptime, memory usage, and a random developer fortune",
      inputSchema: {},
    },
    async () => {
      const fortune = FORTUNES[Math.floor(Math.random() * FORTUNES.length)]
      const now = new Date()
      const uptimeMs = Date.now() - serverStartTime
      const uptimeSeconds = Math.floor(uptimeMs / 1000)

      // Format uptime nicely
      const days = Math.floor(uptimeSeconds / 86400)
      const hours = Math.floor((uptimeSeconds % 86400) / 3600)
      const minutes = Math.floor((uptimeSeconds % 3600) / 60)
      const seconds = uptimeSeconds % 60
      const uptimeStr =
        days > 0
          ? `${days}d ${hours}h ${minutes}m ${seconds}s`
          : hours > 0
            ? `${hours}h ${minutes}m ${seconds}s`
            : minutes > 0
              ? `${minutes}m ${seconds}s`
              : `${seconds}s`

      // Format bytes to human readable
      const formatBytes = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
        if (bytes < 1024 * 1024 * 1024)
          return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
      }

      const memUsage = process.memoryUsage()

      const structuredContent = {
        fortune,
        server: {
          uptime: uptimeStr,
          uptimeSeconds,
          timestamp: now.toISOString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        system: {
          platform: os.platform(),
          arch: os.arch(),
          nodeVersion: process.version,
          cpus: os.cpus().length,
          hostname: os.hostname(),
        },
        memory: {
          heapUsed: formatBytes(memUsage.heapUsed),
          heapTotal: formatBytes(memUsage.heapTotal),
          rss: formatBytes(memUsage.rss),
          external: formatBytes(memUsage.external),
          systemTotal: formatBytes(os.totalmem()),
          systemFree: formatBytes(os.freemem()),
        },
      }

      return {
        content: [
          {
            type: "text",
            text: `🔮 ${fortune}\n\n📊 Server uptime: ${uptimeStr} | Memory: ${formatBytes(memUsage.heapUsed)} / ${formatBytes(memUsage.heapTotal)}`,
          },
        ],
        structuredContent,
      }
    }
  )

  return server
}
