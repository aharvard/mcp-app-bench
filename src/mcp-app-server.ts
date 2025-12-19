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
import {
  APP_ICON,
  BASE_URL,
  MCP_APPS_EXTENSION_ID,
  MCP_APPS_MIME_TYPE,
  MCP_APP_URI,
} from "./utils/constants.js"
import { loadAppHtml } from "./utils/load-app-html.js"

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

  return server
}
