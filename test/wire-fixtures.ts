import type {
  UiInitializeParams,
  UiMessageParams,
  UiSizeChangedParams,
  UiToolResultParams,
  UiUpdateModelContextParams,
  UiDownloadFileParams,
  McpUiInitializeResult,
  UIResourceContent,
} from "../src/types/mcp-apps.js"

// These fixtures must both typecheck locally and validate against the pinned SDK schema.
export const wireFixtures = {
  McpUiInitializeRequest: {
    method: "ui/initialize",
    params: {
      appInfo: { name: "Fixture", version: "1" },
      appCapabilities: {},
      protocolVersion: "2026-01-26",
    } satisfies UiInitializeParams,
  },
  McpUiMessageRequest: {
    method: "ui/message",
    params: {
      role: "user",
      content: [
        { type: "text", text: "fixture" },
        { type: "image", data: "AA==", mimeType: "image/png" },
      ],
    } satisfies UiMessageParams,
  },
  McpUiSizeChangedNotification: {
    method: "ui/notifications/size-changed",
    params: { height: 120 } satisfies UiSizeChangedParams,
  },
  McpUiToolResultNotification: {
    method: "ui/notifications/tool-result",
    params: { content: [], isError: true } satisfies UiToolResultParams,
  },
  McpUiUpdateModelContextRequest: {
    method: "ui/update-model-context",
    params: {
      structuredContent: { token: "fixture" },
    } satisfies UiUpdateModelContextParams,
  },
  McpUiDownloadFileRequest: {
    method: "ui/download-file",
    params: {
      contents: [
        {
          type: "resource",
          resource: { uri: "file:///fixture.txt", text: "fixture" },
        },
      ],
    } satisfies UiDownloadFileParams,
  },
  McpUiInitializeResult: {
    protocolVersion: "2026-01-26",
    hostInfo: { name: "Host", version: "1" },
    hostCapabilities: {},
    hostContext: { containerDimensions: {} },
  } satisfies McpUiInitializeResult,
}

const badInit: UiInitializeParams = {
  // @ts-expect-error clientInfo is not the app wire field.
  clientInfo: { name: "x", version: "1" },
  protocolVersion: "2026-01-26",
  appCapabilities: {},
}
const badMessage: UiMessageParams = {
  role: "user",
  // @ts-expect-error The content field is an array, not a single content block.
  content: { type: "text", text: "x" },
}
// @ts-expect-error Tool result content is required.
const badToolResult: UiToolResultParams = { isError: true }
// @ts-expect-error A resource needs text or blob content.
const badResource: UIResourceContent = {
  uri: "ui://fixture",
  mimeType: "text/html;profile=mcp-app",
}
void [badInit, badMessage, badToolResult, badResource]
