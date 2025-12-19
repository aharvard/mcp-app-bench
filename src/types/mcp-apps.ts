import {
  MCP_APPS_EXTENSION_ID,
  MCP_APPS_MIME_TYPE,
  MCP_APPS_UI_RESOURCE_SCHEME,
} from "../utils/constants.js"

/**
 * MCP Apps (SEP-1865) Type Definitions
 *
 * This file contains TypeScript interfaces and types for the MCP Apps extension
 * as defined in SEP-1865: Interactive User Interfaces for MCP.
 *
 * @see https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/draft/apps.mdx
 */

import type { z } from "zod"

// =============================================================================
// UI Resource Types
// =============================================================================

/**
 * Content Security Policy configuration for UI resources.
 *
 * Servers declare which external origins their UI needs to access.
 * Hosts use this to enforce appropriate CSP headers.
 */
export interface UIResourceCSP {
  /**
   * Origins for network requests (fetch, XHR, WebSocket).
   *
   * - Empty or omitted = no external connections (secure default)
   * - Maps to CSP `connect-src` directive
   *
   * @example ["https://api.weather.com", "wss://realtime.service.com"]
   */
  connectDomains?: string[]

  /**
   * Origins for static resources (images, scripts, stylesheets, fonts).
   *
   * - Empty or omitted = no external resources (secure default)
   * - Wildcard subdomains supported: `https://*.example.com`
   * - Maps to CSP `img-src`, `script-src`, `style-src`, `font-src` directives
   *
   * @example ["https://cdn.jsdelivr.net", "https://*.cloudflare.com"]
   */
  resourceDomains?: string[]
}

/**
 * Metadata for UI resources.
 *
 * Includes Content Security Policy configuration, dedicated domain settings,
 * and visual preferences.
 */
export interface UIResourceMeta {
  /**
   * Content Security Policy configuration.
   * Servers declare which external origins their UI needs to access.
   */
  csp?: UIResourceCSP

  /**
   * Dedicated origin for widget.
   *
   * Optional domain for the widget's sandbox origin. Useful when widgets need
   * dedicated origins for API key allowlists or cross-origin isolation.
   *
   * If omitted, Host uses default sandbox origin.
   *
   * @example "https://weather-widget.example.com"
   */
  domain?: string

  /**
   * Visual boundary preference.
   *
   * Boolean indicating the UI prefers a visible border. Useful for widgets
   * that might blend with host background.
   *
   * - `true`: Request visible border (host decides styling)
   * - `false` or omitted: No preference
   */
  prefersBorder?: boolean
}

/**
 * UI Resource declaration.
 *
 * UI resources are declared using the standard MCP resource pattern with specific conventions.
 */
export interface UIResource {
  /**
   * Unique identifier for the UI resource.
   *
   * MUST use the `ui://` URI scheme to distinguish UI resources from other
   * MCP resource types.
   *
   * @example "ui://weather-dashboard"
   */
  uri: `ui://${string}`

  /**
   * Human-readable display name for the UI resource.
   *
   * Used for listing and identifying the resource in host interfaces.
   *
   * @example "Weather Dashboard"
   */
  name: string

  /**
   * Optional description of the UI resource's purpose and functionality.
   *
   * Provides context about what the UI does and when to use it.
   *
   * @example "Interactive weather visualization with real-time updates"
   */
  description?: string

  /**
   * MIME type of the UI content.
   *
   * SHOULD be `text/html;profile=mcp-app` for HTML-based UIs in the initial MVP.
   * Other content types are reserved for future extensions.
   */
  mimeType: typeof MCP_APPS_MIME_TYPE

  /**
   * Resource metadata for security and rendering configuration.
   */
  _meta?: {
    ui?: UIResourceMeta
  }
}

/**
 * Content returned from resources/read for UI resources.
 */
export interface UIResourceContent {
  /** Matching UI resource URI */
  uri: `ui://${string}`

  /** MUST be "text/html;profile=mcp-app" */
  mimeType: typeof MCP_APPS_MIME_TYPE

  /** HTML content as string */
  text?: string

  /** OR base64-encoded HTML */
  blob?: string

  /** Resource metadata */
  _meta?: {
    ui?: UIResourceMeta
  }
}

/**
 * Response from resources/read for UI resources.
 */
export interface UIResourceReadResponse {
  contents: UIResourceContent[]
}

// =============================================================================
// Tool Metadata Types
// =============================================================================

/**
 * Tool metadata for associating tools with UI resources.
 *
 * Tools are associated with UI resources through the `_meta` field.
 */
export interface UIToolMeta {
  /**
   * URI of the UI resource to use for rendering.
   *
   * If present and host supports MCP Apps, host renders tool results
   * using the specified UI resource.
   */
  "ui/resourceUri"?: `ui://${string}`
}

/**
 * Extended tool definition with UI metadata.
 */
export interface UITool {
  name: string
  description: string
  inputSchema: object
  outputSchema?: object
  _meta?: UIToolMeta
}

// =============================================================================
// Capability Negotiation Types
// =============================================================================

/**
 * MCP Apps extension capabilities advertised by clients.
 */
export interface McpAppsClientCapabilities {
  /**
   * Array of supported content types.
   *
   * @example ["text/html;profile=mcp-app"]
   */
  mimeTypes: string[]

  /**
   * Specific feature support (future extension).
   *
   * @example ["streaming", "persistence"]
   */
  features?: string[]

  /**
   * Supported sandbox attribute configurations (future extension).
   */
  sandboxPolicies?: string[]
}

/**
 * Client capabilities with MCP Apps extension.
 */
export interface ClientCapabilitiesWithMcpApps {
  extensions?: {
    [MCP_APPS_EXTENSION_ID]?: McpAppsClientCapabilities
  }
  experimental?: {
    [MCP_APPS_EXTENSION_ID]?: McpAppsClientCapabilities
  }
}

// =============================================================================
// Host Context Types
// =============================================================================

/** Display mode for the UI */
export type DisplayMode = "inline" | "fullscreen" | "pip"

/** Platform type for responsive design */
export type Platform = "web" | "desktop" | "mobile"

/** Color theme preference */
export type Theme = "light" | "dark"

/**
 * Device capabilities for the UI.
 */
export interface DeviceCapabilities {
  /** Whether the device supports touch input */
  touch?: boolean
  /** Whether the device supports hover interactions */
  hover?: boolean
}

/**
 * Viewport dimensions available to the UI.
 */
export interface Viewport {
  /** Current width in pixels */
  width: number
  /** Current height in pixels */
  height: number
  /** Maximum available width */
  maxWidth?: number
  /** Maximum available height */
  maxHeight?: number
}

/**
 * Safe area boundaries in pixels.
 */
export interface SafeAreaInsets {
  top: number
  right: number
  bottom: number
  left: number
}

/**
 * Tool information provided in host context.
 */
export interface ToolInfo {
  /** JSON-RPC id of the tools/call request */
  id?: string | number
  /** Contains name, inputSchema, etc. */
  tool: UITool
}

/**
 * Host context provided to the Guest UI during initialization.
 *
 * When the Guest UI sends a `ui/initialize` request to the Host,
 * the Host SHOULD include UI-specific context in the `McpUiInitializeResult`'s
 * `hostContext` field.
 */
export interface HostContext {
  /** Metadata of the tool call that instantiated the App */
  toolInfo?: ToolInfo

  /** Current color theme preference */
  theme?: Theme

  /** How the UI is currently displayed */
  displayMode?: DisplayMode

  /** Display modes the host supports */
  availableDisplayModes?: DisplayMode[]

  /** Current and maximum dimensions available to the UI */
  viewport?: Viewport

  /** User's language/region preference (BCP 47, e.g., "en-US") */
  locale?: string

  /** User's timezone (IANA, e.g., "America/New_York") */
  timeZone?: string

  /** Host application identifier */
  userAgent?: string

  /** Platform type for responsive design */
  platform?: Platform

  /** Device capabilities such as touch */
  deviceCapabilities?: DeviceCapabilities

  /** Safe area boundaries in pixels */
  safeAreaInsets?: SafeAreaInsets
}

// =============================================================================
// JSON-RPC Message Types
// =============================================================================

/** Base JSON-RPC 2.0 message */
interface JsonRpcBase {
  jsonrpc: "2.0"
}

/** JSON-RPC request */
export interface JsonRpcRequest<
  TMethod extends string = string,
  TParams = unknown,
> extends JsonRpcBase {
  id: string | number
  method: TMethod
  params?: TParams
}

/** JSON-RPC response (success) */
export interface JsonRpcResponse<TResult = unknown> extends JsonRpcBase {
  id: string | number
  result: TResult
}

/** JSON-RPC error response */
export interface JsonRpcErrorResponse extends JsonRpcBase {
  id: string | number
  error: {
    code: number
    message: string
    data?: unknown
  }
}

/** JSON-RPC notification (no id) */
export interface JsonRpcNotification<
  TMethod extends string = string,
  TParams = unknown,
> extends JsonRpcBase {
  method: TMethod
  params?: TParams
}

// =============================================================================
// UI Initialize Types
// =============================================================================

/**
 * Parameters for ui/initialize request from Guest UI to Host.
 */
export interface UiInitializeParams {
  capabilities?: Record<string, unknown>
  clientInfo?: {
    name: string
    version: string
  }
  protocolVersion?: string
}

/**
 * Result of ui/initialize request.
 */
export interface McpUiInitializeResult {
  protocolVersion: string
  hostCapabilities?: Record<string, unknown>
  hostInfo?: {
    name: string
    version: string
  }
  hostContext?: HostContext
}

// =============================================================================
// UI Request Types (UI → Host)
// =============================================================================

/**
 * ui/open-link request - Request host to open external URL.
 */
export interface UiOpenLinkParams {
  /** URL to open in host's browser */
  url: string
}

/**
 * ui/message request - Send message content to the host's chat interface.
 */
export interface UiMessageParams {
  role: "user"
  content: {
    type: "text"
    text: string
  }
}

// =============================================================================
// UI Notification Types (Host → UI)
// =============================================================================

/**
 * ui/notifications/tool-input - Complete tool arguments.
 *
 * Host MUST send this notification with the complete tool arguments
 * after the Guest UI's initialize request completes.
 */
export interface UiToolInputParams {
  arguments: Record<string, unknown>
}

/**
 * ui/notifications/tool-input-partial - Streaming partial arguments.
 *
 * Host MAY send this notification zero or more times while the agent
 * is streaming tool arguments, before `ui/notifications/tool-input` is sent.
 */
export interface UiToolInputPartialParams {
  arguments: Record<string, unknown>
}

/**
 * ui/notifications/tool-result - Tool execution result.
 *
 * Host MUST send this notification when tool execution completes
 * (if UI is displayed during tool execution).
 */
export interface UiToolResultParams {
  content?: Array<{
    type: string
    text?: string
    [key: string]: unknown
  }>
  structuredContent?: Record<string, unknown>
  _meta?: Record<string, unknown>
  isError?: boolean
}

/**
 * ui/notifications/tool-cancelled - Tool execution was cancelled.
 */
export interface UiToolCancelledParams {
  reason?: string
}

/**
 * ui/resource-teardown - Host notifies UI before teardown.
 */
export interface UiResourceTeardownParams {
  reason?: string
}

/**
 * ui/notifications/size-changed - UI's size changed.
 *
 * Guest UI SHOULD send this notification when rendered content body size changes.
 */
export interface UiSizeChangedParams {
  /** Viewport width in pixels */
  width: number
  /** Viewport height in pixels */
  height: number
}

/**
 * ui/notifications/host-context-changed - Host context has changed.
 *
 * Host MAY send this notification when any context field changes.
 */
export type UiHostContextChangedParams = Partial<HostContext>

// =============================================================================
// Sandbox Proxy Types (Web Hosts)
// =============================================================================

/**
 * ui/notifications/sandbox-ready - Sandbox proxy is ready.
 *
 * Sent from Sandbox Proxy to Host.
 */
export interface UiSandboxReadyParams {
  // Empty params
}

/**
 * ui/notifications/sandbox-resource-ready - HTML resource ready to load.
 *
 * Sent from Host to Sandbox Proxy.
 */
export interface UiSandboxResourceReadyParams {
  /** HTML content to load */
  html: string
  /** Optional override for inner iframe `sandbox` attribute */
  sandbox?: string
}

// =============================================================================
// Method Constants
// =============================================================================

/** UI-specific JSON-RPC methods */
export const UI_METHODS = {
  // Requests (UI → Host)
  INITIALIZE: "ui/initialize",
  OPEN_LINK: "ui/open-link",
  MESSAGE: "ui/message",

  // Notifications (Host → UI)
  NOTIFICATIONS: {
    INITIALIZED: "ui/notifications/initialized",
    TOOL_INPUT: "ui/notifications/tool-input",
    TOOL_INPUT_PARTIAL: "ui/notifications/tool-input-partial",
    TOOL_RESULT: "ui/notifications/tool-result",
    TOOL_CANCELLED: "ui/notifications/tool-cancelled",
    SIZE_CHANGED: "ui/notifications/size-changed",
    HOST_CONTEXT_CHANGED: "ui/notifications/host-context-changed",
  },

  // Lifecycle
  RESOURCE_TEARDOWN: "ui/resource-teardown",

  // Sandbox Proxy (Web Hosts)
  SANDBOX: {
    READY: "ui/notifications/sandbox-ready",
    RESOURCE_READY: "ui/notifications/sandbox-resource-ready",
  },
} as const

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Check if a URI is a valid UI resource URI.
 */
export function isUIResourceUri(uri: string): uri is `ui://${string}` {
  return uri.startsWith(MCP_APPS_UI_RESOURCE_SCHEME)
}

/**
 * Get the location where MCP Apps capability is advertised.
 * Returns "extensions", "experimental", or null if not found.
 */
export function getMcpAppsCapabilityLocation(
  capabilities: ClientCapabilitiesWithMcpApps | undefined
): "extensions" | "experimental" | null {
  if (!capabilities) {
    return null
  }

  // Check extensions path (SEP-1865 standard)
  if (capabilities.extensions?.[MCP_APPS_EXTENSION_ID]) {
    const ext = capabilities.extensions[MCP_APPS_EXTENSION_ID]
    if (ext.mimeTypes?.includes(MCP_APPS_MIME_TYPE)) {
      return "extensions"
    }
  }

  // Check experimental path (for clients that advertise under experimental)
  if (capabilities.experimental?.[MCP_APPS_EXTENSION_ID]) {
    const ext = capabilities.experimental[MCP_APPS_EXTENSION_ID]
    if (ext.mimeTypes?.includes(MCP_APPS_MIME_TYPE)) {
      return "experimental"
    }
  }

  return null
}

/**
 * Check if client capabilities include MCP Apps support.
 * Supports both the standard extensions path and the experimental path.
 */
export function clientSupportsMcpApps(
  capabilities: ClientCapabilitiesWithMcpApps | undefined
): boolean {
  return getMcpAppsCapabilityLocation(capabilities) !== null
}

/**
 * Check if client capabilities support a specific MIME type.
 * Supports both the standard extensions path and the experimental path.
 */
export function clientSupportsMimeType(
  capabilities: ClientCapabilitiesWithMcpApps | undefined,
  mimeType: string
): boolean {
  if (!capabilities) {
    return false
  }

  // Check extensions path (SEP-1865 standard)
  if (capabilities.extensions?.[MCP_APPS_EXTENSION_ID]) {
    const ext = capabilities.extensions[MCP_APPS_EXTENSION_ID]
    return ext.mimeTypes?.includes(mimeType) ?? false
  }

  // Check experimental path (for clients that advertise under experimental)
  if (capabilities.experimental?.[MCP_APPS_EXTENSION_ID]) {
    const ext = capabilities.experimental[MCP_APPS_EXTENSION_ID]
    return ext.mimeTypes?.includes(mimeType) ?? false
  }

  return false
}

// =============================================================================
// Helper Types for Server Implementation
// =============================================================================

/** Zod schema shape type (matches MCP SDK expectations) */
export type ZodSchemaShape = Record<string, z.ZodTypeAny>

/**
 * Configuration for registering a UI resource.
 */
export interface UIResourceConfig {
  /** URI for the resource (must start with ui://) */
  uri: `ui://${string}`

  /** App/template name for loading HTML */
  appName: string

  /** Human-readable title */
  title: string

  /** Description of the resource */
  description: string

  /** Content Security Policy configuration */
  csp?: UIResourceCSP

  /** Whether the UI prefers a visible border */
  prefersBorder?: boolean

  /** Optional dedicated domain for the app */
  domain?: string
}

/**
 * Configuration for registering a UI-enabled tool.
 */
export interface UIToolConfig<
  TInput extends Record<string, unknown> = Record<string, unknown>,
  TOutput extends Record<string, unknown> = Record<string, unknown>,
> {
  /** Tool name */
  name: string

  /** Human-readable title */
  title: string

  /** Tool description */
  description: string

  /** Zod schema for input validation */
  inputSchema: ZodSchemaShape

  /** Optional Zod schema for output */
  outputSchema?: ZodSchemaShape

  /** URI of the associated UI resource */
  resourceUri: `ui://${string}`

  /** Tool handler function */
  handler: (args: TInput) => Promise<{
    text: string
    structuredContent: TOutput
  }>
}
