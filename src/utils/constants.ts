import { randomBytes } from "crypto"

export const PORT = process.env.PORT || 6789
export const BASE_URL =
  process.env.BASE_URL || (`http://localhost:${PORT}` as const)

// Cache-busting hash generated on server start
export const CACHE_HASH = randomBytes(8).toString("hex")

export const MCP_APPS_EXTENSION_ID = "io.modelcontextprotocol/ui" as const
export const MCP_APPS_MIME_TYPE = "text/html;profile=mcp-app" as const
export const MCP_APPS_UI_RESOURCE_SCHEME = "ui://" as const

// Resource URIs
export const MCP_APP_URI =
  `${MCP_APPS_UI_RESOURCE_SCHEME}mcp-app-bench` as const
export const INSPECT_HOST_INFO_URI =
  `${MCP_APPS_UI_RESOURCE_SCHEME}inspect-host-info` as const
export const INSPECT_HOST_STYLES_URI =
  `${MCP_APPS_UI_RESOURCE_SCHEME}inspect-host-styles` as const
export const INSPECT_MESSAGING_URI =
  `${MCP_APPS_UI_RESOURCE_SCHEME}inspect-messaging` as const
export const INSPECT_TOOL_DATA_URI =
  `${MCP_APPS_UI_RESOURCE_SCHEME}inspect-tool-data` as const

export const APP_ICON = `${BASE_URL}/assets/icon.svg` as const
