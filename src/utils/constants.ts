export const PORT = process.env.PORT || 6789
export const BASE_URL =
  process.env.BASE_URL || (`http://localhost:${PORT}` as const)

export const MCP_APPS_EXTENSION_ID = "io.modelcontextprotocol/ui" as const
export const MCP_APPS_MIME_TYPE = "text/html;profile=mcp-app" as const
export const MCP_APPS_UI_RESOURCE_SCHEME = "ui://" as const
export const MCP_APP_URI =
  `${MCP_APPS_UI_RESOURCE_SCHEME}mcp-app-bench` as const

export const APP_ICON = `${BASE_URL}/assets/icon.svg` as const
