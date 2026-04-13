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
  INSPECT_DISPLAY_MODES_UNDECLARED_URI,
  INSPECT_TRANSPARENCY_URI,
  INSPECT_VISIBILITY_URI,
  INSPECT_MODEL_CONTEXT_URI,
  INSPECT_MEDIA_PLAYER_URI,
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
      inputSchema: {
        user_message: z
          .string()
          .describe("The last message the user sent to the agent")
          .optional(),
      },
      outputSchema: {
        timestamp: z.string().describe("The timestamp of the inspection"),
        user_message: z
          .string()
          .describe("The last message the user sent to the agent")
          .optional(),
      },
      _meta: {
        ui: {
          resourceUri: INSPECT_HOST_INFO_URI,
        },
      },
    },
    async (args) => {
      return {
        content: [
          {
            type: "text",
            text: `Host Info Inspector loaded. Displaying host context and capabilities.`,
          },
        ],
        structuredContent: {
          timestamp: new Date().toISOString(),
          ...(args.user_message ? { user_message: args.user_message } : {}),
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
        _meta: {
          foo: "bar",
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

  // Display Modes inspector resource (undeclared — only declares inline, but UI has fullscreen/pip buttons)
  server.registerResource(
    "inspect-display-modes-undeclared",
    INSPECT_DISPLAY_MODES_UNDECLARED_URI,
    {
      title: "Display Modes Inspector (Undeclared)",
      description:
        "Test that the host respects declared modes — this app only declares inline but renders fullscreen/pip buttons",
      mimeType: MCP_APPS_MIME_TYPE,
    },
    async () => ({
      contents: [
        {
          uri: INSPECT_DISPLAY_MODES_UNDECLARED_URI,
          mimeType: MCP_APPS_MIME_TYPE,
          text: loadAppHtml("display-modes-undeclared"),
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

  // Display Modes inspector tool (undeclared — only declares inline, but UI has fullscreen/pip buttons)
  server.registerTool(
    "inspect-display-modes-undeclared",
    {
      title: "Display Modes Inspector (Undeclared)",
      description:
        "Test that the host respects declared modes — this app only declares inline but renders fullscreen/pip buttons",
      inputSchema: {},
      outputSchema: {
        timestamp: z.string().describe("The timestamp of the inspection"),
      },
      _meta: {
        ui: {
          resourceUri: INSPECT_DISPLAY_MODES_UNDECLARED_URI,
        },
      },
    },
    async () => {
      return {
        content: [
          {
            type: "text",
            text: `Display Modes Inspector loaded. Declared modes: inline only (fullscreen/pip undeclared but UI has buttons)`,
          },
        ],
        structuredContent: {
          timestamp: new Date().toISOString(),
        },
      }
    }
  )

  // Transparency inspector resource
  server.registerResource(
    "inspect-transparency",
    INSPECT_TRANSPARENCY_URI,
    {
      title: "Transparency Inspector",
      description:
        "Test whether the host allows iframe transparency across light and dark color schemes",
      mimeType: MCP_APPS_MIME_TYPE,
    },
    async () => ({
      contents: [
        {
          uri: INSPECT_TRANSPARENCY_URI,
          mimeType: MCP_APPS_MIME_TYPE,
          text: loadAppHtml("transparency"),
          _meta: {
            ui: {
              prefersBorder: false,
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

  // Transparency inspector tool
  server.registerTool(
    "inspect-transparency",
    {
      title: "Transparency Inspector",
      description:
        "Test whether the host allows iframe transparency across light and dark color schemes",
      inputSchema: {},
      outputSchema: {
        timestamp: z.string().describe("The timestamp of the inspection"),
      },
      _meta: {
        ui: {
          resourceUri: INSPECT_TRANSPARENCY_URI,
        },
      },
    },
    async () => {
      return {
        content: [
          {
            type: "text",
            text: `Transparency Inspector loaded. Checking iframe transparency across color schemes.`,
          },
        ],
        structuredContent: {
          timestamp: new Date().toISOString(),
        },
      }
    }
  )

  // ==========================================================================
  // Visibility Inspector - Tests _meta.ui.visibility filtering
  // ==========================================================================

  // Visibility inspector resource
  server.registerResource(
    "inspect-visibility",
    INSPECT_VISIBILITY_URI,
    {
      title: "Visibility Inspector",
      description:
        "Test that the host respects _meta.ui.visibility on tools, hiding app-only tools from the model",
      mimeType: MCP_APPS_MIME_TYPE,
    },
    async () => ({
      contents: [
        {
          uri: INSPECT_VISIBILITY_URI,
          mimeType: MCP_APPS_MIME_TYPE,
          text: loadAppHtml("visibility"),
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

  // Visibility inspector launcher tool
  server.registerTool(
    "inspect-visibility",
    {
      title: "Visibility Inspector",
      description:
        "Open the visibility inspector to test _meta.ui.visibility filtering",
      inputSchema: {},
      outputSchema: {
        timestamp: z.string().describe("The timestamp of the inspection"),
      },
      _meta: {
        ui: {
          resourceUri: INSPECT_VISIBILITY_URI,
        },
      },
    },
    async () => {
      return {
        content: [
          {
            type: "text",
            text: `Visibility Inspector loaded. This page tests that hosts correctly filter tools based on _meta.ui.visibility.`,
          },
        ],
        structuredContent: {
          timestamp: new Date().toISOString(),
        },
      }
    }
  )

  // Tool with visibility: ["model", "app"] (explicit default — model SHOULD see)
  server.registerTool(
    "visibility-both",
    {
      title: "Visibility Test: Model + App",
      description:
        "Test tool with visibility ['model', 'app']. The model SHOULD be able to see and call this tool.",
      inputSchema: {},
      outputSchema: {
        visibility: z.array(z.string()),
        timestamp: z.string(),
      },
      _meta: {
        ui: {
          visibility: ["model", "app"],
        },
      },
    },
    async () => ({
      content: [
        {
          type: "text",
          text: "visibility-both called successfully. This tool is visible to both model and app.",
        },
      ],
      structuredContent: {
        visibility: ["model", "app"],
        timestamp: new Date().toISOString(),
      },
    })
  )

  // Tool with visibility: ["app"] (app-only — model should NOT see)
  server.registerTool(
    "visibility-app-only",
    {
      title: "Visibility Test: App Only",
      description:
        "Test tool with visibility ['app']. The model should NOT see this tool. Only the app UI can call it.",
      inputSchema: {},
      outputSchema: {
        visibility: z.array(z.string()),
        timestamp: z.string(),
      },
      _meta: {
        ui: {
          visibility: ["app"],
        },
      },
    },
    async () => ({
      content: [
        {
          type: "text",
          text: "visibility-app-only called successfully. If the model called this, the host has a bug!",
        },
      ],
      structuredContent: {
        visibility: ["app"],
        timestamp: new Date().toISOString(),
      },
    })
  )

  // Tool with visibility: ["model"] (model-only — model SHOULD see, app should NOT call)
  server.registerTool(
    "visibility-model-only",
    {
      title: "Visibility Test: Model Only",
      description:
        "Test tool with visibility ['model']. The model SHOULD see this. The app UI should NOT be able to call it.",
      inputSchema: {},
      outputSchema: {
        visibility: z.array(z.string()),
        timestamp: z.string(),
      },
      _meta: {
        ui: {
          visibility: ["model"],
        },
      },
    },
    async () => ({
      content: [
        {
          type: "text",
          text: "visibility-model-only called successfully. This tool is visible to the model only.",
        },
      ],
      structuredContent: {
        visibility: ["model"],
        timestamp: new Date().toISOString(),
      },
    })
  )

  // Tool with NO visibility field (defaults to ["model", "app"] — model SHOULD see)
  server.registerTool(
    "visibility-default",
    {
      title: "Visibility Test: Default (no visibility field)",
      description:
        "Test tool with no visibility field. Per spec, defaults to ['model', 'app']. The model SHOULD see this.",
      inputSchema: {},
      outputSchema: {
        visibility: z.string(),
        timestamp: z.string(),
      },
    },
    async () => ({
      content: [
        {
          type: "text",
          text: "visibility-default called successfully. No visibility field means default: visible to both.",
        },
      ],
      structuredContent: {
        visibility: "default (no _meta.ui.visibility field)",
        timestamp: new Date().toISOString(),
      },
    })
  )

  // ==========================================================================
  // Model Context Inspector
  // ==========================================================================

  server.registerResource(
    "inspect-model-context",
    INSPECT_MODEL_CONTEXT_URI,
    {
      title: "Model Context Inspector",
      description:
        "Test ui/update-model-context — send context updates from the app to the host model",
      mimeType: MCP_APPS_MIME_TYPE,
    },
    async () => ({
      contents: [
        {
          uri: INSPECT_MODEL_CONTEXT_URI,
          mimeType: MCP_APPS_MIME_TYPE,
          text: loadAppHtml("model-context"),
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

  server.registerTool(
    "inspect-model-context",
    {
      title: "Model Context Inspector",
      description:
        "Test ui/update-model-context — send context updates from the app to the host model",
      inputSchema: {},
      outputSchema: {
        timestamp: z.string().describe("The timestamp of the inspection"),
      },
      _meta: {
        ui: {
          resourceUri: INSPECT_MODEL_CONTEXT_URI,
        },
      },
    },
    async () => {
      return {
        content: [
          {
            type: "text",
            text: `Model Context Inspector loaded. Use the counter or manual form to send ui/update-model-context requests.`,
          },
        ],
        structuredContent: {
          timestamp: new Date().toISOString(),
        },
      }
    }
  )

  // ==========================================================================
  // Media Player Inspector
  // ==========================================================================

  server.registerResource(
    "inspect-media-player",
    INSPECT_MEDIA_PLAYER_URI,
    {
      title: "Media Player Inspector",
      description:
        "Interactive video and audio player demo with open media sources rendered inside an MCP app",
      mimeType: MCP_APPS_MIME_TYPE,
    },
    async () => ({
      contents: [
        {
          uri: INSPECT_MEDIA_PLAYER_URI,
          mimeType: MCP_APPS_MIME_TYPE,
          text: loadAppHtml("media-player"),
          _meta: {
            ui: {
              prefersBorder: true,
              csp: {
                resourceDomains: [
                  BASE_URL,
                  "https://fonts.googleapis.com",
                  "https://fonts.gstatic.com",
                  "https://download.blender.org",
                  "https://dn721902.ca.archive.org",
                ],
              },
            },
          },
        },
      ],
    })
  )

  server.registerTool(
    "inspect-media-player",
    {
      title: "Media Player Inspector",
      description:
        "Launch a media player demo that switches between open video and audio content inside the MCP app host",
      inputSchema: {
        mediaType: z
          .enum(["video", "audio"])
          .describe("Which media mode to open first")
          .optional(),
      },
      outputSchema: {
        timestamp: z.string().describe("The timestamp of the inspection"),
        mediaType: z
          .enum(["video", "audio"])
          .describe("The initially selected media mode"),
      },
      _meta: {
        ui: {
          resourceUri: INSPECT_MEDIA_PLAYER_URI,
        },
      },
    },
    async (args) => {
      const mediaType = args.mediaType ?? "video"

      return {
        content: [
          {
            type: "text",
            text: `Media Player Inspector loaded. Showing the ${mediaType} demo inside the MCP app host.`,
          },
        ],
        structuredContent: {
          timestamp: new Date().toISOString(),
          mediaType,
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
