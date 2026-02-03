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
 * Specification Version: 2026-01-26 (Stable)
 *
 * @see https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx
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
   * Origins for static resources (images, scripts, stylesheets, fonts, media).
   *
   * - Empty or omitted = no external resources (secure default)
   * - Wildcard subdomains supported: `https://*.example.com`
   * - Maps to CSP `img-src`, `script-src`, `style-src`, `font-src`, `media-src` directives
   *
   * @example ["https://cdn.jsdelivr.net", "https://*.cloudflare.com"]
   */
  resourceDomains?: string[]

  /**
   * Origins for nested iframes.
   *
   * - Empty or omitted = no nested iframes allowed (`frame-src 'none'`)
   * - Maps to CSP `frame-src` directive
   *
   * @example ["https://www.youtube.com", "https://player.vimeo.com"]
   */
  frameDomains?: string[]

  /**
   * Allowed base URIs for the document.
   *
   * - Empty or omitted = only same origin allowed (`base-uri 'self'`)
   * - Maps to CSP `base-uri` directive
   *
   * @example ["https://cdn.example.com"]
   */
  baseUriDomains?: string[]
}

/**
 * Sandbox permissions requested by the UI.
 *
 * Servers declare which browser capabilities their UI needs.
 * Hosts MAY honor these by setting appropriate iframe `allow` attributes.
 * Apps SHOULD NOT assume permissions are granted; use JS feature detection as fallback.
 */
export interface UIResourcePermissions {
  /** Request camera access - Maps to Permission Policy `camera` feature */
  camera?: Record<string, never>
  /** Request microphone access - Maps to Permission Policy `microphone` feature */
  microphone?: Record<string, never>
  /** Request geolocation access - Maps to Permission Policy `geolocation` feature */
  geolocation?: Record<string, never>
  /** Request clipboard write access - Maps to Permission Policy `clipboard-write` feature */
  clipboardWrite?: Record<string, never>
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
   * Sandbox permissions requested by the UI.
   * Servers declare which browser capabilities their UI needs.
   */
  permissions?: UIResourcePermissions

  /**
   * Dedicated origin for view.
   *
   * Optional domain for the view's sandbox origin. Useful when views need
   * stable, dedicated origins for OAuth callbacks, CORS policies, or API key allowlists.
   *
   * **Host-dependent:** The format and validation rules for this field are
   * determined by each host. Servers MUST consult host-specific documentation
   * for the expected domain format.
   *
   * If omitted, Host uses default sandbox origin (typically per-conversation).
   *
   * @example "a904794854a047f6.claudemcpcontent.com"
   * @example "www-example-com.oaiusercontent.com"
   */
  domain?: string

  /**
   * Visual boundary preference.
   *
   * Boolean controlling whether a visible border and background is provided by the host.
   * Specifying an explicit value for this is recommended because hosts' defaults may vary.
   *
   * - `true`: Request visible border + background
   * - `false`: Request no visible border + background
   * - omitted: host decides border
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
// Tool UI Metadata Types
// =============================================================================

/**
 * Tool visibility options.
 *
 * - "model": Tool visible to and callable by the agent
 * - "app": Tool callable by the app from this server only
 */
export type ToolVisibility = "model" | "app"

/**
 * UI metadata for tools.
 */
export interface McpUiToolMeta {
  /** URI of UI resource for rendering tool results */
  resourceUri?: `ui://${string}`

  /**
   * Who can access this tool. Default: ["model", "app"]
   * - "model": Tool visible to and callable by the agent
   * - "app": Tool callable by the app from this server only
   */
  visibility?: ToolVisibility[]
}

/**
 * Extended tool definition with UI metadata.
 */
export interface UITool {
  name: string
  description: string
  inputSchema: object
  outputSchema?: object
  _meta?: {
    ui?: McpUiToolMeta
    /** @deprecated Use `ui.resourceUri` instead. Will be removed before GA. */
    "ui/resourceUri"?: string
  }
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
// Style Variable Types
// =============================================================================

/**
 * CSS variable keys available to Views for theming.
 *
 * These are the standardized variable names that hosts can provide
 * for visual cohesion with the host environment.
 */
export type McpUiStyleVariableKey =
  // Background colors
  | "--color-background-primary"
  | "--color-background-secondary"
  | "--color-background-tertiary"
  | "--color-background-inverse"
  | "--color-background-ghost"
  | "--color-background-info"
  | "--color-background-danger"
  | "--color-background-success"
  | "--color-background-warning"
  | "--color-background-disabled"
  // Text colors
  | "--color-text-primary"
  | "--color-text-secondary"
  | "--color-text-tertiary"
  | "--color-text-inverse"
  | "--color-text-info"
  | "--color-text-danger"
  | "--color-text-success"
  | "--color-text-warning"
  | "--color-text-disabled"
  | "--color-text-ghost"
  // Border colors
  | "--color-border-primary"
  | "--color-border-secondary"
  | "--color-border-tertiary"
  | "--color-border-inverse"
  | "--color-border-ghost"
  | "--color-border-info"
  | "--color-border-danger"
  | "--color-border-success"
  | "--color-border-warning"
  | "--color-border-disabled"
  // Ring colors
  | "--color-ring-primary"
  | "--color-ring-secondary"
  | "--color-ring-inverse"
  | "--color-ring-info"
  | "--color-ring-danger"
  | "--color-ring-success"
  | "--color-ring-warning"
  // Typography - Family
  | "--font-sans"
  | "--font-mono"
  // Typography - Weight
  | "--font-weight-normal"
  | "--font-weight-medium"
  | "--font-weight-semibold"
  | "--font-weight-bold"
  // Typography - Text Size
  | "--font-text-xs-size"
  | "--font-text-sm-size"
  | "--font-text-md-size"
  | "--font-text-lg-size"
  // Typography - Heading Size
  | "--font-heading-xs-size"
  | "--font-heading-sm-size"
  | "--font-heading-md-size"
  | "--font-heading-lg-size"
  | "--font-heading-xl-size"
  | "--font-heading-2xl-size"
  | "--font-heading-3xl-size"
  // Typography - Text Line Height
  | "--font-text-xs-line-height"
  | "--font-text-sm-line-height"
  | "--font-text-md-line-height"
  | "--font-text-lg-line-height"
  // Typography - Heading Line Height
  | "--font-heading-xs-line-height"
  | "--font-heading-sm-line-height"
  | "--font-heading-md-line-height"
  | "--font-heading-lg-line-height"
  | "--font-heading-xl-line-height"
  | "--font-heading-2xl-line-height"
  | "--font-heading-3xl-line-height"
  // Border radius
  | "--border-radius-xs"
  | "--border-radius-sm"
  | "--border-radius-md"
  | "--border-radius-lg"
  | "--border-radius-xl"
  | "--border-radius-full"
  // Border width
  | "--border-width-regular"
  // Shadows
  | "--shadow-hairline"
  | "--shadow-sm"
  | "--shadow-md"
  | "--shadow-lg"

/**
 * Style configuration for theming.
 */
export interface HostStyles {
  /** CSS variables for theming */
  variables?: Record<McpUiStyleVariableKey, string | undefined>
  /** CSS blocks that Views can inject */
  css?: {
    /** CSS for font loading (@font-face rules or @import statements) */
    fonts?: string
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
 * Container dimensions for the iframe.
 *
 * Each dimension (height and width) operates independently and can be either:
 * - **Fixed**: Host controls the size. View should fill the available space.
 * - **Flexible**: View controls the size, up to the specified maximum.
 * - **Unbounded**: View controls the size with no limit (field omitted).
 */
export type ContainerDimensions = (
  | { height: number }
  | { maxHeight?: number }
) &
  ({ width: number } | { maxWidth?: number })

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
 * Host context provided to the View during initialization.
 *
 * When the View sends a `ui/initialize` request to the Host,
 * the Host SHOULD include UI-specific context in the `McpUiInitializeResult`'s
 * `hostContext` field.
 */
export interface HostContext {
  /** Metadata of the tool call that instantiated the View */
  toolInfo?: ToolInfo

  /** Current color theme preference */
  theme?: Theme

  /** Style configuration for theming */
  styles?: HostStyles

  /** How the View is currently displayed */
  displayMode?: DisplayMode

  /** Display modes the host supports */
  availableDisplayModes?: DisplayMode[]

  /**
   * Container dimensions for the iframe.
   * Specify either width or maxWidth, and either height or maxHeight.
   */
  containerDimensions?: ContainerDimensions

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
// Host Capabilities Types
// =============================================================================

/**
 * Host capabilities sent to the View as part of the response to `ui/initialize`.
 * They describe the features and capabilities that the Host supports.
 */
export interface HostCapabilities {
  /** Experimental features (structure TBD) */
  experimental?: Record<string, unknown>

  /** Host supports opening external URLs */
  openLinks?: Record<string, never>

  /** Host can proxy tool calls to the MCP server */
  serverTools?: {
    /** Host supports tools/list_changed notifications */
    listChanged?: boolean
  }

  /** Host can proxy resource reads to the MCP server */
  serverResources?: {
    /** Host supports resources/list_changed notifications */
    listChanged?: boolean
  }

  /** Host accepts log messages */
  logging?: Record<string, never>

  /** Sandbox configuration applied by the host */
  sandbox?: {
    /** Permissions granted by the host */
    permissions?: UIResourcePermissions
    /** CSP domains approved by the host */
    csp?: UIResourceCSP
  }
}

// =============================================================================
// App Capabilities Types
// =============================================================================

/**
 * App capabilities sent by the View in the `ui/initialize` request.
 */
export interface McpUiAppCapabilities {
  /** Experimental features (structure TBD) */
  experimental?: Record<string, unknown>

  /** App exposes MCP-style tools that the host can call */
  tools?: {
    /** App supports tools/list_changed notifications */
    listChanged?: boolean
  }

  /**
   * Display modes the app supports.
   * @example ["inline", "fullscreen"]
   */
  availableDisplayModes?: DisplayMode[]
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
 * Parameters for ui/initialize request from View to Host.
 */
export interface UiInitializeParams {
  /** App capabilities */
  appCapabilities?: McpUiAppCapabilities
  /** Client info */
  clientInfo?: {
    name: string
    version: string
  }
  /** Protocol version */
  protocolVersion?: string
}

/**
 * Result of ui/initialize request.
 */
export interface McpUiInitializeResult {
  protocolVersion: string
  hostCapabilities?: HostCapabilities
  hostInfo?: {
    name: string
    version: string
  }
  hostContext?: HostContext
}

// =============================================================================
// UI Request Types (View → Host)
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

/**
 * ui/request-display-mode request - Request host to change display mode.
 */
export interface UiRequestDisplayModeParams {
  /** Requested display mode */
  mode: DisplayMode
}

/**
 * ui/request-display-mode response.
 */
export interface UiRequestDisplayModeResult {
  /** Actual display mode set (may differ from requested) */
  mode: DisplayMode
}

/**
 * Content block for ui/update-model-context.
 */
export interface ContentBlock {
  type: string
  text?: string
  [key: string]: unknown
}

/**
 * ui/update-model-context request - Update the model context.
 *
 * The View MAY send this request to update the Host's model context.
 * This context will be used in future turns. Each request overwrites
 * the previous context sent by the View.
 */
export interface UiUpdateModelContextParams {
  /** Content blocks for the model */
  content?: ContentBlock[]
  /** Structured content for the model */
  structuredContent?: Record<string, unknown>
}

// =============================================================================
// UI Notification Types (Host → View)
// =============================================================================

/**
 * ui/notifications/tool-input - Complete tool arguments.
 *
 * Host MUST send this notification with the complete tool arguments
 * after the View's initialize request completes.
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
 * (if View is displayed during tool execution).
 */
export interface UiToolResultParams {
  content?: ContentBlock[]
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
 * ui/resource-teardown - Host notifies View before teardown.
 */
export interface UiResourceTeardownParams {
  reason?: string
}

/**
 * ui/notifications/size-changed - View's size changed.
 *
 * View SHOULD send this notification when rendered content body size changes.
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
 * This notification contains partial updates - the View SHOULD merge
 * received fields with its current context state.
 */
export type UiHostContextChangedParams = Partial<HostContext>

// =============================================================================
// Sandbox Proxy Types (Web Hosts)
// =============================================================================

/**
 * ui/notifications/sandbox-proxy-ready - Sandbox proxy is ready.
 *
 * Sent from Sandbox Proxy to Host.
 */
export interface UiSandboxProxyReadyParams {
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
  /** CSP configuration from resource metadata */
  csp?: UIResourceCSP
  /** Sandbox permissions from resource metadata */
  permissions?: UIResourcePermissions
}

// =============================================================================
// Method Constants
// =============================================================================

/** UI-specific JSON-RPC methods */
export const UI_METHODS = {
  // Requests (View → Host)
  INITIALIZE: "ui/initialize",
  OPEN_LINK: "ui/open-link",
  MESSAGE: "ui/message",
  REQUEST_DISPLAY_MODE: "ui/request-display-mode",
  UPDATE_MODEL_CONTEXT: "ui/update-model-context",

  // Notifications (Host → View)
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
    PROXY_READY: "ui/notifications/sandbox-proxy-ready",
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

  /** Sandbox permissions */
  permissions?: UIResourcePermissions

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

  /** Tool visibility - who can access this tool */
  visibility?: ToolVisibility[]

  /** Tool handler function */
  handler: (args: TInput) => Promise<{
    text: string
    structuredContent: TOutput
  }>
}

// =============================================================================
// Spec Version Constant
// =============================================================================

/** The version of the MCP Apps specification this module implements */
export const MCP_APPS_SPEC_VERSION = "2026-01-26" as const
