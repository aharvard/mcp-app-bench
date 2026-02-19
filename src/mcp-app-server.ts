/**
 * MCP Server implementation using SEP-1865 (MCP Apps) specification.
 *
 * This server uses native MCP SDK patterns without the @mcp-ui/server adapter.
 * It's designed for clients that support the MCP Apps extension (io.modelcontextprotocol/ui).
 *
 * Route: /mcp
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import {
  APP_ICON,
  BASE_URL,
  MCP_APPS_EXTENSION_ID,
  MCP_APPS_MIME_TYPE,
  MCP_APP_URI,
  INSPECT_HOST_INFO_URI,
  INSPECT_HOST_STYLES_URI,
  INSPECT_MESSAGING_URI,
  INSPECT_TOOL_DATA_URI,
  INSPECT_DISPLAY_MODES_URI,
  INSPECT_DISPLAY_MODES_INLINE_PIP_URI,
  INSPECT_DISPLAY_MODES_INLINE_FULLSCREEN_URI,
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

  // Main launcher resource
  server.registerResource(
    "mcp-app-bench",
    MCP_APP_URI,
    {
      title: "MCP App Bench",
      description:
        "An interactive bench test launcher to evaluate MCP host support for MCP Apps",
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
                resourceDomains: [
                  BASE_URL,
                  "https://fonts.googleapis.com",
                  "https://fonts.gstatic.com",
                ],
              },
            },
          },
        },
      ],
    })
  )

  // Host Info inspector resource
  server.registerResource(
    "inspect-host-info",
    INSPECT_HOST_INFO_URI,
    {
      title: "Host Info Inspector",
      description:
        "Inspect host context, capabilities, protocol version, and validate against the HostContext schema",
      mimeType: MCP_APPS_MIME_TYPE,
    },
    async () => ({
      contents: [
        {
          uri: INSPECT_HOST_INFO_URI,
          mimeType: MCP_APPS_MIME_TYPE,
          text: loadAppHtml("host-info"),
          _meta: {
            ui: {
              prefersBorder: true,
              csp: {
                resourceDomains: [
                  BASE_URL,
                  "https://fonts.googleapis.com",
                  "https://fonts.gstatic.com",
                ],
              },
            },
          },
        },
      ],
    })
  )

  // Host Styles inspector resource
  server.registerResource(
    "inspect-host-styles",
    INSPECT_HOST_STYLES_URI,
    {
      title: "Host Styles Inspector",
      description:
        "Visualize host-provided CSS variables, typography, colors, shadows, and border radius tokens",
      mimeType: MCP_APPS_MIME_TYPE,
    },
    async () => ({
      contents: [
        {
          uri: INSPECT_HOST_STYLES_URI,
          mimeType: MCP_APPS_MIME_TYPE,
          text: loadAppHtml("host-styles"),
          _meta: {
            ui: {
              prefersBorder: true,
              csp: {
                resourceDomains: [
                  BASE_URL,
                  "https://fonts.googleapis.com",
                  "https://fonts.gstatic.com",
                ],
              },
            },
          },
        },
      ],
    })
  )

  // Messaging inspector resource
  server.registerResource(
    "inspect-messaging",
    INSPECT_MESSAGING_URI,
    {
      title: "Messaging Inspector",
      description:
        "Test UI↔Host and UI↔Server messaging. Monitor requests, responses, and notifications",
      mimeType: MCP_APPS_MIME_TYPE,
    },
    async () => ({
      contents: [
        {
          uri: INSPECT_MESSAGING_URI,
          mimeType: MCP_APPS_MIME_TYPE,
          text: loadAppHtml("messaging"),
          _meta: {
            ui: {
              prefersBorder: true,
              csp: {
                resourceDomains: [
                  BASE_URL,
                  "https://fonts.googleapis.com",
                  "https://fonts.gstatic.com",
                ],
              },
            },
          },
        },
      ],
    })
  )

  // Tool Data inspector resource
  server.registerResource(
    "inspect-tool-data",
    INSPECT_TOOL_DATA_URI,
    {
      title: "Tool Data Inspector",
      description:
        "Inspect tool lifecycle events: input, partial input, results, and cancellation",
      mimeType: MCP_APPS_MIME_TYPE,
    },
    async () => ({
      contents: [
        {
          uri: INSPECT_TOOL_DATA_URI,
          mimeType: MCP_APPS_MIME_TYPE,
          text: loadAppHtml("tool-data"),
          _meta: {
            ui: {
              prefersBorder: true,
              csp: {
                resourceDomains: [
                  BASE_URL,
                  "https://fonts.googleapis.com",
                  "https://fonts.gstatic.com",
                ],
              },
            },
          },
        },
      ],
    })
  )

  // Display Modes inspector resource
  server.registerResource(
    "inspect-display-modes",
    INSPECT_DISPLAY_MODES_URI,
    {
      title: "Display Modes Inspector",
      description:
        "Test display mode switching between inline, fullscreen, and pip modes",
      mimeType: MCP_APPS_MIME_TYPE,
    },
    async () => ({
      contents: [
        {
          uri: INSPECT_DISPLAY_MODES_URI,
          mimeType: MCP_APPS_MIME_TYPE,
          text: loadAppHtml("display-modes"),
          _meta: {
            ui: {
              prefersBorder: true,
              csp: {
                resourceDomains: [
                  BASE_URL,
                  "https://fonts.googleapis.com",
                  "https://fonts.gstatic.com",
                ],
              },
            },
          },
        },
      ],
    })
  )

  // ==========================================================================
  // Tools
  // ==========================================================================

  // Main launcher tool
  server.registerTool(
    "mcp-app-bench",
    {
      title: "MCP App Bench",
      description:
        "An interactive bench test launcher to evaluate MCP host support for MCP Apps",
      inputSchema: {
        name: z.string().describe("The name of the MCP app to test").optional(),
      },
      outputSchema: {
        name: z.string().describe("The name of the MCP app to test").optional(),
        timestamp: z.string().describe("The timestamp of the test").optional(),
      },
      _meta: {
        ui: {
          resourceUri: MCP_APP_URI,
        },
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
            text: `MCP App Bench launcher loaded. Select an inspector to begin testing.`,
          },
        ],
        structuredContent,
      }
    }
  )

  // Host Info inspector tool
  server.registerTool(
    "inspect-host-info",
    {
      title: "Host Info Inspector",
      description:
        "Inspect host context, capabilities, protocol version, and validate against the HostContext schema",
      inputSchema: {},
      outputSchema: {
        timestamp: z.string().describe("The timestamp of the inspection"),
      },
      _meta: {
        ui: {
          resourceUri: INSPECT_HOST_INFO_URI,
        },
      },
    },
    async () => {
      return {
        content: [
          {
            type: "text",
            text: `Host Info Inspector loaded. Displaying host context and capabilities.`,
          },
        ],
        structuredContent: {
          timestamp: new Date().toISOString(),
        },
      }
    }
  )

  // Host Styles inspector tool
  server.registerTool(
    "inspect-host-styles",
    {
      title: "Host Styles Inspector",
      description:
        "Visualize host-provided CSS variables, typography, colors, shadows, and border radius tokens",
      inputSchema: {},
      outputSchema: {
        timestamp: z.string().describe("The timestamp of the inspection"),
      },
      _meta: {
        ui: {
          resourceUri: INSPECT_HOST_STYLES_URI,
        },
      },
    },
    async () => {
      return {
        content: [
          {
            type: "text",
            text: `Host Styles Inspector loaded. Displaying host-provided style tokens.`,
          },
        ],
        structuredContent: {
          timestamp: new Date().toISOString(),
        },
      }
    }
  )

  // Messaging inspector tool
  server.registerTool(
    "inspect-messaging",
    {
      title: "Messaging Inspector",
      description:
        "Test UI↔Host and UI↔Server messaging. Monitor requests, responses, and notifications",
      inputSchema: {},
      outputSchema: {
        timestamp: z.string().describe("The timestamp of the inspection"),
      },
      _meta: {
        ui: {
          resourceUri: INSPECT_MESSAGING_URI,
        },
      },
    },
    async () => {
      return {
        content: [
          {
            type: "text",
            text: `Messaging Inspector loaded. Use the buttons to test messaging capabilities.`,
          },
        ],
        structuredContent: {
          timestamp: new Date().toISOString(),
        },
      }
    }
  )

  // Tool Data inspector tool
  server.registerTool(
    "inspect-tool-data",
    {
      title: "Tool Data Inspector",
      description:
        "Inspect tool lifecycle events: input, partial input, results, and cancellation",
      inputSchema: {},
      outputSchema: {
        timestamp: z.string().describe("The timestamp of the inspection"),
      },
      _meta: {
        ui: {
          resourceUri: INSPECT_TOOL_DATA_URI,
        },
      },
    },
    async () => {
      return {
        content: [
          {
            type: "text",
            text: `Tool Data Inspector loaded. Tool lifecycle events will be displayed here.`,
          },
        ],
        structuredContent: {
          timestamp: new Date().toISOString(),
        },
      }
    }
  )

  // Display Modes inspector tool (all modes: inline, fullscreen, pip)
  server.registerTool(
    "inspect-display-modes",
    {
      title: "Display Modes Inspector",
      description:
        "Test display mode switching between inline, fullscreen, and pip modes",
      inputSchema: {},
      outputSchema: {
        timestamp: z.string().describe("The timestamp of the inspection"),
      },
      _meta: {
        ui: {
          resourceUri: INSPECT_DISPLAY_MODES_URI,
        },
      },
    },
    async () => {
      return {
        content: [
          {
            type: "text",
            text: `Display Modes Inspector loaded. Declared modes: inline, fullscreen, pip`,
          },
        ],
        structuredContent: {
          timestamp: new Date().toISOString(),
        },
      }
    }
  )

  // Display Modes inspector resource (inline + pip only)
  server.registerResource(
    "inspect-display-modes-inline-pip",
    INSPECT_DISPLAY_MODES_INLINE_PIP_URI,
    {
      title: "Display Modes Inspector (Inline + PiP)",
      description:
        "Test display mode switching with only inline and pip modes declared",
      mimeType: MCP_APPS_MIME_TYPE,
    },
    async () => ({
      contents: [
        {
          uri: INSPECT_DISPLAY_MODES_INLINE_PIP_URI,
          mimeType: MCP_APPS_MIME_TYPE,
          text: loadAppHtml("display-modes-inline-pip"),
          _meta: {
            ui: {
              prefersBorder: true,
              csp: {
                resourceDomains: [
                  BASE_URL,
                  "https://fonts.googleapis.com",
                  "https://fonts.gstatic.com",
                ],
              },
            },
          },
        },
      ],
    })
  )

  // Display Modes inspector tool (inline + pip only)
  server.registerTool(
    "inspect-display-modes-inline-pip",
    {
      title: "Display Modes Inspector (Inline + PiP)",
      description:
        "Test display mode switching with only inline and pip modes declared",
      inputSchema: {},
      outputSchema: {
        timestamp: z.string().describe("The timestamp of the inspection"),
      },
      _meta: {
        ui: {
          resourceUri: INSPECT_DISPLAY_MODES_INLINE_PIP_URI,
        },
      },
    },
    async () => {
      return {
        content: [
          {
            type: "text",
            text: `Display Modes Inspector loaded. Declared modes: inline, pip`,
          },
        ],
        structuredContent: {
          timestamp: new Date().toISOString(),
        },
      }
    }
  )

  // Display Modes inspector resource (inline + fullscreen only)
  server.registerResource(
    "inspect-display-modes-inline-fullscreen",
    INSPECT_DISPLAY_MODES_INLINE_FULLSCREEN_URI,
    {
      title: "Display Modes Inspector (Inline + Fullscreen)",
      description:
        "Test display mode switching with only inline and fullscreen modes declared",
      mimeType: MCP_APPS_MIME_TYPE,
    },
    async () => ({
      contents: [
        {
          uri: INSPECT_DISPLAY_MODES_INLINE_FULLSCREEN_URI,
          mimeType: MCP_APPS_MIME_TYPE,
          text: loadAppHtml("display-modes-inline-fullscreen"),
          _meta: {
            ui: {
              prefersBorder: true,
              csp: {
                resourceDomains: [
                  BASE_URL,
                  "https://fonts.googleapis.com",
                  "https://fonts.gstatic.com",
                ],
              },
            },
          },
        },
      ],
    })
  )

  // Display Modes inspector tool (inline + fullscreen only)
  server.registerTool(
    "inspect-display-modes-inline-fullscreen",
    {
      title: "Display Modes Inspector (Inline + Fullscreen)",
      description:
        "Test display mode switching with only inline and fullscreen modes declared",
      inputSchema: {},
      outputSchema: {
        timestamp: z.string().describe("The timestamp of the inspection"),
      },
      _meta: {
        ui: {
          resourceUri: INSPECT_DISPLAY_MODES_INLINE_FULLSCREEN_URI,
        },
      },
    },
    async () => {
      return {
        content: [
          {
            type: "text",
            text: `Display Modes Inspector loaded. Declared modes: inline, fullscreen`,
          },
        ],
        structuredContent: {
          timestamp: new Date().toISOString(),
        },
      }
    }
  )

  // Utility tool: Get Server Time
  server.registerTool(
    "get-server-time",
    {
      title: "Get Server Time",
      description: "Returns the current server time",
      inputSchema: {},
      outputSchema: {
        timestamp: z.string().describe("ISO 8601 formatted server timestamp"),
        timezone: z.string().describe("Server timezone"),
        unixMs: z.number().describe("Unix timestamp in milliseconds"),
      },
    },
    async () => {
      const now = new Date()
      const structuredContent = {
        timestamp: now.toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        unixMs: now.getTime(),
      }
      return {
        content: [
          {
            type: "text",
            text: `Server time: ${now.toISOString()}`,
          },
        ],
        structuredContent,
      }
    }
  )

  return server
}
