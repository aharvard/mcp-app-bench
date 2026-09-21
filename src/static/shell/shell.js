/**
 * MCP App Bench - Shell JavaScript
 * Shared foundation code for all MCP App inspection pages
 */

;(function () {
  "use strict"

  // ==========================================================================
  // State
  // ==========================================================================

  // Display modes in the pinned upstream schema. Apps that declare only these
  // keep emitting handshakes that validate against the vendored oracle.
  const SPEC_DISPLAY_MODES = ["inline", "fullscreen", "pip"]
  // Modes the bench understands but upstream has not standardized. Hosts may
  // offer them and fixtures may opt into declaring them; the default
  // declaration below stays spec-only so opting in is always deliberate.
  const EXTENSION_DISPLAY_MODES = ["split-right", "split-bottom", "standalone"]
  const RECOGNIZED_DISPLAY_MODES = SPEC_DISPLAY_MODES.concat(
    EXTENSION_DISPLAY_MODES
  )

  let requestId = 1
  const pendingRequests = new Map()
  // Requests that timed out locally, kept so a late host reply can still be
  // logged instead of silently dropped.
  const expiredRequests = new Map()
  const MAX_EXPIRED_REQUESTS = 50
  const INITIALIZE_TIMEOUT_MS = 10000
  // Ordinary requests may wait on the user (open-link confirmations) or on a
  // tool call, so the default is generous. Pass { timeoutMs: 0 } to disable.
  const DEFAULT_REQUEST_TIMEOUT_MS = 60000
  let currentHostInfo = null
  let currentCompatibility = null
  let currentToolData = {
    toolInput: null,
    toolInputPartial: null,
    toolResult: null,
    toolCancelled: null,
  }
  let isReady = false
  let connectionState = "closed"
  let sizeReportingEnabled = false
  let resizeObserver = null
  let lastReportedHeight = null
  let pendingReportedHeight = null
  let sizeChangeFrame = null

  const lifecycleEvents = []
  let lifecycleSequence = 0
  let hostRequestHandlers = {}
  let completeInputReceived = false
  let toolTerminal = false

  function recordLifecycle(method, params) {
    const problems = []
    if (method.endsWith("tool-input-partial") && completeInputReceived)
      problems.push("Partial input after complete input")
    if (method.endsWith("tool-result") && !completeInputReceived)
      problems.push("Result without required complete input")
    if (method.endsWith("tool-input") && completeInputReceived)
      problems.push("Duplicate complete input")
    if (toolTerminal) problems.push("Event after terminal result/cancellation")
    if (method.endsWith("tool-input")) completeInputReceived = true
    if (method.endsWith("tool-result") || method.endsWith("tool-cancelled"))
      toolTerminal = true
    lifecycleEvents.push({
      sequence: ++lifecycleSequence,
      method,
      params,
      problems,
    })
    if (lifecycleEvents.length > 200) lifecycleEvents.shift()
  }

  function applyHostLayout(context) {
    const dims = isObject(context.containerDimensions)
      ? context.containerDimensions
      : {}
    for (const axis of ["height", "width"]) {
      const maxAxis = "max" + axis[0].toUpperCase() + axis.slice(1)
      const fixed = Number.isFinite(dims[axis]) && dims[axis] >= 0
      const maximum = Number.isFinite(dims[maxAxis]) && dims[maxAxis] >= 0
      document.documentElement.style[axis] = fixed ? dims[axis] + "px" : ""
      document.documentElement.style[maxAxis] =
        !fixed && maximum ? dims[maxAxis] + "px" : ""
    }
    document.documentElement.style.overflow = "auto"
  }

  function applyHostStyles(styles) {
    styles = isObject(styles) ? styles : {}
    injectStyleVariables(isObject(styles.variables) ? styles.variables : {})
    const existing = document.getElementById("host-font-css")
    if (existing) existing.remove()
    if (styles.css && typeof styles.css.fonts === "string") {
      const element = document.createElement("style")
      element.id = "host-font-css"
      element.textContent = styles.css.fonts
      document.head.appendChild(element)
    }
  }

  function getMeasuredContentHeight() {
    const bodyRect = document.body.getBoundingClientRect()
    const readyContent = document.querySelector(".app-content.is-ready")
    const loadingContent = document.getElementById("app-loading")
    const activeRoot =
      readyContent && readyContent instanceof HTMLElement
        ? readyContent
        : loadingContent

    if (activeRoot && activeRoot instanceof HTMLElement) {
      const rootRect = activeRoot.getBoundingClientRect()
      return Math.max(0, Math.ceil(rootRect.bottom - bodyRect.top))
    }

    return Math.max(
      Math.ceil(document.body.getBoundingClientRect().height),
      Math.ceil(document.body.scrollHeight)
    )
  }

  // Message log
  const messageLog = []
  const MAX_MESSAGES = 100

  // ==========================================================================
  // HostContext Schema (for validation)
  // ==========================================================================

  // Style variable keys from the MCP Apps spec
  const styleVariableKeys = [
    // Background colors (10)
    "--color-background-primary",
    "--color-background-secondary",
    "--color-background-tertiary",
    "--color-background-inverse",
    "--color-background-ghost",
    "--color-background-info",
    "--color-background-danger",
    "--color-background-success",
    "--color-background-warning",
    "--color-background-disabled",
    // Text colors (10)
    "--color-text-primary",
    "--color-text-secondary",
    "--color-text-tertiary",
    "--color-text-inverse",
    "--color-text-info",
    "--color-text-danger",
    "--color-text-success",
    "--color-text-warning",
    "--color-text-disabled",
    "--color-text-ghost",
    // Border colors (10)
    "--color-border-primary",
    "--color-border-secondary",
    "--color-border-tertiary",
    "--color-border-inverse",
    "--color-border-ghost",
    "--color-border-info",
    "--color-border-danger",
    "--color-border-success",
    "--color-border-warning",
    "--color-border-disabled",
    // Ring colors (7)
    "--color-ring-primary",
    "--color-ring-secondary",
    "--color-ring-inverse",
    "--color-ring-info",
    "--color-ring-danger",
    "--color-ring-success",
    "--color-ring-warning",
    // Typography - Family (2)
    "--font-sans",
    "--font-mono",
    // Typography - Weight (4)
    "--font-weight-normal",
    "--font-weight-medium",
    "--font-weight-semibold",
    "--font-weight-bold",
    // Typography - Text Size (4)
    "--font-text-xs-size",
    "--font-text-sm-size",
    "--font-text-md-size",
    "--font-text-lg-size",
    // Typography - Heading Size (7)
    "--font-heading-xs-size",
    "--font-heading-sm-size",
    "--font-heading-md-size",
    "--font-heading-lg-size",
    "--font-heading-xl-size",
    "--font-heading-2xl-size",
    "--font-heading-3xl-size",
    // Typography - Text Line Height (4)
    "--font-text-xs-line-height",
    "--font-text-sm-line-height",
    "--font-text-md-line-height",
    "--font-text-lg-line-height",
    // Typography - Heading Line Height (7)
    "--font-heading-xs-line-height",
    "--font-heading-sm-line-height",
    "--font-heading-md-line-height",
    "--font-heading-lg-line-height",
    "--font-heading-xl-line-height",
    "--font-heading-2xl-line-height",
    "--font-heading-3xl-line-height",
    // Border radius (6)
    "--border-radius-xs",
    "--border-radius-sm",
    "--border-radius-md",
    "--border-radius-lg",
    "--border-radius-xl",
    "--border-radius-full",
    // Border width (1)
    "--border-width-regular",
    // Shadows (4)
    "--shadow-hairline",
    "--shadow-sm",
    "--shadow-md",
    "--shadow-lg",
  ]

  // Build the variables schema dynamically
  const styleVariablesSchema = {}
  styleVariableKeys.forEach(function (key) {
    styleVariablesSchema[key] = { type: "string", optional: true }
  })

  // HostContext Schema based on MCP Apps spec (SEP-1865, version 2026-01-26)
  // Note: All top-level properties are optional (?)
  // containerDimensions uses union types for height/maxHeight and width/maxWidth
  const hostContextSchema = {
    hostContext: {
      type: "object",
      children: {
        toolInfo: {
          type: "object",
          optional: true,
          children: {
            id: { type: ["string", "number"], optional: true },
            tool: {
              type: "object",
              children: {
                name: { type: "string" },
                description: { type: "string", optional: true },
                inputSchema: {
                  type: "object",
                  children: {
                    type: { type: "string", enum: ["object"] },
                    properties: { type: "object", optional: true },
                    required: {
                      type: "array",
                      optional: true,
                      items: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
        theme: { type: "string", enum: ["light", "dark"], optional: true },
        styles: {
          type: "object",
          optional: true,
          children: {
            variables: {
              type: "object",
              recordValueType: "string",
              optional: true,
              children: styleVariablesSchema,
            },
            css: {
              type: "object",
              optional: true,
              children: {
                fonts: { type: "string", optional: true },
              },
            },
          },
        },
        displayMode: {
          type: "string",
          enum: RECOGNIZED_DISPLAY_MODES,
          optional: true,
        },
        availableDisplayModes: {
          type: "array",
          optional: true,
          items: { type: "string", enum: RECOGNIZED_DISPLAY_MODES },
        },
        // Each axis independently permits fixed, maximum, or omitted (unbounded).
        containerDimensions: {
          type: "object",
          optional: true,
          children: {
            height: { type: "number", optional: true },
            maxHeight: { type: "number", optional: true },
            width: { type: "number", optional: true },
            maxWidth: { type: "number", optional: true },
          },
        },
        locale: { type: "string", optional: true },
        timeZone: { type: "string", optional: true },
        userAgent: { type: "string", optional: true },
        platform: {
          type: "string",
          enum: ["web", "desktop", "mobile"],
          optional: true,
        },
        deviceCapabilities: {
          type: "object",
          optional: true,
          children: {
            touch: { type: "boolean", optional: true },
            hover: { type: "boolean", optional: true },
          },
        },
        safeAreaInsets: {
          type: "object",
          optional: true,
          children: {
            top: { type: "number" },
            right: { type: "number" },
            bottom: { type: "number" },
            left: { type: "number" },
          },
        },
      },
    },
  }

  // Spec version constant
  const MCP_APPS_SPEC_VERSION = "2026-01-26"

  // ==========================================================================
  // Utilities
  // ==========================================================================

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
  }

  function getTimestamp() {
    return new Date().toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  }

  // ==========================================================================
  // Theme Management
  // ==========================================================================

  function setTheme(theme) {
    document.body.classList.remove("theme-light", "theme-dark")
    if (theme === "light") {
      document.body.classList.add("theme-light")
    } else {
      document.body.classList.add("theme-dark")
    }
  }

  function getTheme() {
    if (document.body.classList.contains("theme-light")) return "light"
    return "dark"
  }

  // Applies the body class the layout CSS keys off. Only recognized modes are
  // applied: the value comes straight from the host, and an arbitrary string
  // would either throw in classList.add (whitespace) or silently strip every
  // layout class. Unrecognized modes are left to the grading schema to report.
  // Returns true when the class was applied.
  function setDisplayMode(mode) {
    if (mode && RECOGNIZED_DISPLAY_MODES.indexOf(mode) === -1) {
      console.warn("[MCP Shell] Ignoring unrecognized display mode:", mode)
      return false
    }
    document.body.classList.remove.apply(
      document.body.classList,
      RECOGNIZED_DISPLAY_MODES.map(function (name) {
        return "display-mode-" + name
      })
    )
    if (mode) {
      document.body.classList.add("display-mode-" + mode)
    }
    // Allow scrolling in the non-inline modes by overriding html overflow
    document.documentElement.style.overflow = "auto"
    return true
  }

  // A host may grant ui/request-display-mode without also sending
  // host-context-changed, so the response is the third path (after the
  // initialize result and the notification) on which the shell owns the body
  // class and the recorded host context. Keeping it here means every fixture
  // that requests a mode gets the same behavior.
  function applyGrantedDisplayMode(result) {
    if (!isObject(result) || typeof result.mode !== "string") return
    if (currentHostInfo && currentHostInfo.hostContext) {
      currentHostInfo.hostContext.displayMode = result.mode
    }
    setDisplayMode(result.mode)
  }

  // ==========================================================================
  // Size Reporting
  // ==========================================================================

  function sendSizeChanged() {
    if (!sizeReportingEnabled) return

    const measuredHeight = getMeasuredContentHeight()

    pendingReportedHeight = measuredHeight

    if (sizeChangeFrame !== null) {
      return
    }

    sizeChangeFrame = window.requestAnimationFrame(function () {
      sizeChangeFrame = null

      if (pendingReportedHeight === null) {
        return
      }

      if (lastReportedHeight === pendingReportedHeight) {
        return
      }

      lastReportedHeight = pendingReportedHeight
      console.log("🔥Sending size changed notification:", {
        height: pendingReportedHeight,
      })
      window.parent.postMessage(
        {
          jsonrpc: "2.0",
          method: "ui/notifications/size-changed",
          params: { height: pendingReportedHeight },
        },
        "*"
      )
    })
  }

  // ==========================================================================
  // Messaging
  // ==========================================================================

  function logMessage(direction, method, content) {
    messageLog.push({
      time: getTimestamp(),
      direction: direction,
      method: method,
      content: content,
    })
    if (messageLog.length > MAX_MESSAGES) {
      messageLog.shift()
    }
    // Trigger custom event for pages that want to render the log
    window.dispatchEvent(
      new CustomEvent("mcp-message-logged", {
        detail: { direction, method, content },
      })
    )
  }

  // JSON-RPC params are optional; omit the key entirely rather than posting an
  // own `params: undefined` property that strict hosts would reject.
  function withParams(message, params) {
    if (params !== undefined) message.params = params
    return message
  }

  function rememberExpiredRequest(id, method) {
    expiredRequests.set(id, method)
    if (expiredRequests.size > MAX_EXPIRED_REQUESTS) {
      expiredRequests.delete(expiredRequests.keys().next().value)
    }
  }

  /**
   * Send a JSON-RPC request to the host.
   * options.timeoutMs — milliseconds before the request rejects locally.
   *   Defaults to DEFAULT_REQUEST_TIMEOUT_MS; 0 or a non-finite value disables
   *   the timeout so user-gated requests can wait indefinitely.
   */
  function sendRequest(method, params, options) {
    options = options || {}
    return new Promise((resolve, reject) => {
      if (
        connectionState !== "initialized" &&
        !(connectionState === "connecting" && method === "ui/initialize")
      ) {
        reject(new Error("MCP connection is " + connectionState))
        return
      }
      const id = requestId++
      const timeoutMs =
        typeof options.timeoutMs === "number"
          ? options.timeoutMs
          : DEFAULT_REQUEST_TIMEOUT_MS
      let timeoutId = null
      if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
        timeoutId = window.setTimeout(function () {
          if (!pendingRequests.has(id)) return
          pendingRequests.delete(id)
          rememberExpiredRequest(id, method)
          console.warn(
            "[MCP Shell] " +
              method +
              " request timed out after " +
              timeoutMs +
              "ms"
          )
          reject(new Error(method + " request timed out"))
        }, timeoutMs)
      }
      pendingRequests.set(id, { resolve, reject, method, timeoutId })
      logMessage("sent", method + " (request)", params)
      window.parent.postMessage(
        withParams({ jsonrpc: "2.0", id: id, method: method }, params),
        "*"
      )
    })
  }

  function sendNotification(method, params) {
    if (
      connectionState !== "initialized" &&
      !(
        connectionState === "connecting" &&
        method === "ui/notifications/initialized"
      )
    )
      return
    logMessage("sent", method + " (notification)", params)
    window.parent.postMessage(
      withParams({ jsonrpc: "2.0", method: method }, params),
      "*"
    )
  }

  // ==========================================================================
  // JSON Viewer
  // ==========================================================================

  function getPreview(value) {
    if (Array.isArray(value)) {
      return "[" + value.length + " items]"
    }
    if (typeof value === "object" && value !== null) {
      const keys = Object.keys(value)
      return "{" + keys.length + " keys}"
    }
    return ""
  }

  function renderJsonValue(value, depth, collapseDepth) {
    if (value === null) {
      return '<span class="jv-null">null</span>'
    }
    if (typeof value === "boolean") {
      return '<span class="jv-boolean">' + value + "</span>"
    }
    if (typeof value === "number") {
      return '<span class="jv-number">' + value + "</span>"
    }
    if (typeof value === "string") {
      return '<span class="jv-string">"' + escapeHtml(value) + '"</span>'
    }
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return '<span class="jv-punctuation">[]</span>'
      }
      const collapsed = depth >= collapseDepth ? "jv-collapsed" : "jv-expanded"
      let html = '<span class="jv-item ' + collapsed + '">'
      html +=
        "<span class=\"jv-toggle\" onclick=\"this.parentElement.classList.toggle('jv-collapsed');this.parentElement.classList.toggle('jv-expanded');\"></span>"
      html += '<span class="jv-punctuation">[</span>'
      html += '<span class="jv-preview">' + getPreview(value) + "</span>"
      html += '<div class="jv-children">'
      value.forEach(function (item, index) {
        html += '<div class="jv-line">'
        html += renderJsonValue(item, depth + 1, collapseDepth)
        if (index < value.length - 1)
          html += '<span class="jv-punctuation">,</span>'
        html += "</div>"
      })
      html += "</div>"
      html += '<span class="jv-punctuation">]</span>'
      html += "</span>"
      return html
    }
    if (typeof value === "object") {
      const keys = Object.keys(value)
      if (keys.length === 0) {
        return '<span class="jv-punctuation">{}</span>'
      }
      const collapsed = depth >= collapseDepth ? "jv-collapsed" : "jv-expanded"
      let html = '<span class="jv-item ' + collapsed + '">'
      html +=
        "<span class=\"jv-toggle\" onclick=\"this.parentElement.classList.toggle('jv-collapsed');this.parentElement.classList.toggle('jv-expanded');\"></span>"
      html += '<span class="jv-punctuation">{</span>'
      html += '<span class="jv-preview">' + getPreview(value) + "</span>"
      html += '<div class="jv-children">'
      keys.forEach(function (key, index) {
        html += '<div class="jv-line">'
        html += '<span class="jv-key">"' + escapeHtml(key) + '"</span>'
        html += '<span class="jv-punctuation">: </span>'
        html += renderJsonValue(value[key], depth + 1, collapseDepth)
        if (index < keys.length - 1)
          html += '<span class="jv-punctuation">,</span>'
        html += "</div>"
      })
      html += "</div>"
      html += '<span class="jv-punctuation">}</span>'
      html += "</span>"
      return html
    }
    return String(value)
  }

  function renderCollapsibleJson(elementId, data, collapseDepth) {
    const container = document.getElementById(elementId)
    if (!container) return
    collapseDepth = collapseDepth !== undefined ? collapseDepth : 3
    container.innerHTML =
      '<div class="json-viewer">' +
      renderJsonValue(data, 0, collapseDepth) +
      "</div>"
  }

  // ==========================================================================
  // Host Data Display (Dot Notation)
  // ==========================================================================

  function addValueToRows(allRows, key, value) {
    if (value === null) {
      allRows.push({ key: key, value: "null", type: "null" })
    } else if (typeof value === "boolean") {
      allRows.push({ key: key, value: String(value), type: "boolean" })
    } else if (typeof value === "number") {
      allRows.push({ key: key, value: String(value), type: "number" })
    } else if (typeof value === "string") {
      allRows.push({ key: key, value: value, type: "string" })
    } else if (Array.isArray(value)) {
      allRows.push({ key: key, value: value, type: "array", isObject: true })
    } else if (typeof value === "object") {
      allRows.push({ key: key, value: value, type: "object", isObject: true })
    }
  }

  function flattenObject(
    allRows,
    obj,
    prefix,
    maxDepth,
    currentDepth,
    skipPaths
  ) {
    currentDepth = currentDepth || 0
    skipPaths = skipPaths || []

    for (const key in obj) {
      if (!obj.hasOwnProperty(key)) continue
      const value = obj[key]
      const fullKey = prefix ? prefix + "." + key : key

      // Check if this path should be skipped (replaced with reference)
      let shouldSkip = false
      for (let i = 0; i < skipPaths.length; i++) {
        if (fullKey === skipPaths[i].path) {
          allRows.push({
            key: fullKey,
            value: skipPaths[i].message,
            type: "reference",
          })
          shouldSkip = true
          break
        }
      }
      if (shouldSkip) continue

      // If we haven't reached max depth and value is a plain object (not array), recurse
      if (
        currentDepth < maxDepth &&
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
      ) {
        flattenObject(
          allRows,
          value,
          fullKey,
          maxDepth,
          currentDepth + 1,
          skipPaths
        )
      } else {
        addValueToRows(allRows, fullKey, value)
      }
    }
  }

  function renderHostDataValue(row, uniqueId) {
    // Handle arrays - display as comma-separated list
    if (row.type === "array") {
      if (row.value.length === 0) {
        return '<span class="host-data-value is-null">[]</span>'
      }
      const items = row.value.map(function (item) {
        if (item === null) return "null"
        if (typeof item === "object") return JSON.stringify(item)
        return String(item)
      })
      return (
        '<span class="host-data-value is-string">' +
        escapeHtml(items.join(", ")) +
        "</span>"
      )
    }

    // Handle objects - show as collapsible
    if (row.isObject) {
      const preview = "{" + Object.keys(row.value).length + " keys}"
      let html =
        '<span class="host-data-collapsed" onclick="this.classList.toggle(\'is-expanded\')" id="toggle-' +
        uniqueId +
        '">'
      html += '<span class="toggle-icon">▶</span>'
      html += "<span>" + preview + "</span>"
      html += "</span>"
      html += '<div class="host-data-collapsed-content">'
      html += renderJsonValue(row.value, 0, 2)
      html += "</div>"
      return html
    }

    return (
      '<span class="host-data-value is-' +
      row.type +
      '">' +
      escapeHtml(row.value) +
      "</span>"
    )
  }

  function renderKeyWithSegments(key, statusHtml) {
    const parts = key.split(".")
    let html = '<span class="host-data-key">'

    if (statusHtml) {
      html += statusHtml
    }

    let pathSoFar = ""
    parts.forEach(function (part, index) {
      pathSoFar = pathSoFar ? pathSoFar + "." + part : part
      if (index > 0) {
        html += '<span class="host-data-key-dot">.</span>'
      }
      html +=
        '<span class="host-data-key-segment" data-segment-path="' +
        escapeHtml(pathSoFar) +
        '">' +
        escapeHtml(part) +
        "</span>"
    })

    html += "</span>"
    return html
  }

  function setupDataListHoverEffects(list) {
    if (!list) return

    const rows = list.querySelectorAll(".host-data-row")
    const segments = list.querySelectorAll(".host-data-key-segment")
    const valueCells = list.querySelectorAll(".host-data-value-cell")

    segments.forEach(function (segment) {
      segment.addEventListener("mouseenter", function (e) {
        e.stopPropagation()
        const segmentPath = segment.getAttribute("data-segment-path")
        list.classList.add("has-hover")

        rows.forEach(function (r) {
          const rowPath = r.getAttribute("data-path")
          const isMatch =
            rowPath === segmentPath || rowPath.startsWith(segmentPath + ".")
          if (isMatch) {
            r.classList.add("is-highlighted")
          } else {
            r.classList.remove("is-highlighted")
          }
        })
      })
    })

    valueCells.forEach(function (valueCell) {
      valueCell.addEventListener("mouseenter", function (e) {
        e.stopPropagation()
        const row = valueCell.closest(".host-data-row")
        if (!row) return

        list.classList.add("has-hover")
        rows.forEach(function (r) {
          if (r === row) {
            r.classList.add("is-highlighted")
          } else {
            r.classList.remove("is-highlighted")
          }
        })
      })
    })

    list.addEventListener("mouseleave", function () {
      list.classList.remove("has-hover")
      rows.forEach(function (r) {
        r.classList.remove("is-highlighted")
      })
    })
  }

  // ==========================================================================
  // Validation
  // ==========================================================================

  function validateHostContext(data) {
    const result = {
      missing: [],
      unexpected: [],
      valid: [],
    }

    function validate(obj, schema, path) {
      if (!obj || typeof obj !== "object") return

      for (const key in schema) {
        const fullPath = path ? path + "." + key : key
        const schemaEntry = schema[key]

        if (!(key in obj) || obj[key] === undefined || obj[key] === null) {
          result.missing.push(fullPath)
        } else {
          result.valid.push(fullPath)
          if (
            schemaEntry.children &&
            typeof obj[key] === "object" &&
            !Array.isArray(obj[key])
          ) {
            validate(obj[key], schemaEntry.children, fullPath)
          }
        }
      }

      for (const key in obj) {
        if (!obj.hasOwnProperty(key)) continue
        const fullPath = path ? path + "." + key : key

        if (!(key in schema)) {
          result.unexpected.push(fullPath)
          if (
            typeof obj[key] === "object" &&
            obj[key] !== null &&
            !Array.isArray(obj[key])
          ) {
            markAllAsUnexpected(obj[key], fullPath)
          }
        }
      }
    }

    function markAllAsUnexpected(obj, path) {
      for (const key in obj) {
        if (!obj.hasOwnProperty(key)) continue
        const fullPath = path + "." + key
        result.unexpected.push(fullPath)
        if (
          typeof obj[key] === "object" &&
          obj[key] !== null &&
          !Array.isArray(obj[key])
        ) {
          markAllAsUnexpected(obj[key], fullPath)
        }
      }
    }

    if (data && data.hostContext) {
      validate({ hostContext: data.hostContext }, hostContextSchema, "")
    }

    return result
  }

  function getPathValidationStatus(path, validationResult) {
    if (validationResult.missing.indexOf(path) !== -1) {
      return "missing"
    }
    if (validationResult.unexpected.indexOf(path) !== -1) {
      return "unexpected"
    }
    for (let i = 0; i < validationResult.unexpected.length; i++) {
      if (path.indexOf(validationResult.unexpected[i] + ".") === 0) {
        return "unexpected"
      }
    }
    return "valid"
  }

  // ==========================================================================
  // Test Runner
  // ==========================================================================

  /**
   * Generate test cases from the hostContextSchema
   * Only generates tests for leaf nodes (properties without children)
   * Returns leaf-node tests with optional ancestry metadata for scorecards.
   */
  function generateTestCases(
    schema,
    prefix,
    parentOptional,
    optionalAncestorPath
  ) {
    const tests = []
    prefix = prefix || ""
    parentOptional = parentOptional || false
    optionalAncestorPath = optionalAncestorPath || null

    for (const key in schema) {
      const fullPath = prefix ? prefix + "." + key : key
      const entry = schema[key]
      // A property is effectively optional if it's marked optional OR any parent is optional
      const isOptional = parentOptional || !!entry.optional
      const nextOptionalAncestorPath =
        optionalAncestorPath || (entry.optional ? fullPath : null)

      tests.push({
        path: fullPath,
        expectedType: entry.type,
        enumValues: entry.enum || null,
        items: entry.items,
        recordValueType: entry.recordValueType,
        optional: isOptional,
        declaredOptional: !!entry.optional,
        optionalAncestorPath: optionalAncestorPath,
        parentPath: prefix || null,
      })
      if (entry.children) {
        // Validate both the container and its children.
        const childTests = generateTestCases(
          entry.children,
          fullPath,
          isOptional,
          nextOptionalAncestorPath
        )
        tests.push.apply(tests, childTests)
      }
    }

    return tests
  }

  /**
   * Get a value from an object by dot-notation path
   */
  function getValueByPath(obj, path) {
    const parts = path.split(".")
    let current = obj
    for (let i = 0; i < parts.length; i++) {
      if (current === null || typeof current !== "object") {
        return { found: false, value: undefined }
      }
      if (!(parts[i] in current)) {
        return { found: false, value: undefined }
      }
      current = current[parts[i]]
    }
    return { found: true, value: current }
  }

  /**
   * Check if parent path exists in the host data
   */
  function parentPathExists(hostData, path) {
    const parts = path.split(".")
    if (parts.length <= 1) return true
    const parentPath = parts.slice(0, -1).join(".")
    return getValueByPath(hostData, parentPath).found
  }

  /**
   * Run a single test case against the host data
   * Returns { status: 'provided'|'missing'|'invalid'|'warn', message, actualValue, actualType }
   *
   * Status meanings:
   * - 'provided': Property exists with correct type
   * - 'missing': Property not provided by host
   * - 'invalid': Property exists but has wrong type
   * - 'warn': Property exists but value is unexpected (e.g., unknown enum)
   */
  function runTestCase(testCase, hostData) {
    const result = getValueByPath(hostData, testCase.path)

    // If property not found
    if (!result.found) {
      return {
        status: "missing",
        message: "Not provided",
        actualValue: undefined,
        actualType: "undefined",
      }
    }

    const value = result.value
    const actualType =
      value === null ? "null" : Array.isArray(value) ? "array" : typeof value

    // Check type
    const expectedTypes = Array.isArray(testCase.expectedType)
      ? testCase.expectedType
      : [testCase.expectedType]
    const typeMatches = expectedTypes.indexOf(actualType) !== -1

    if (!typeMatches) {
      return {
        status: "invalid",
        message:
          "Expected " + expectedTypes.join(" | ") + ", got " + actualType,
        actualValue: value,
        actualType: actualType,
      }
    }

    // Check enum values if specified
    if (testCase.enumValues && testCase.enumValues.indexOf(value) === -1) {
      return {
        status: "invalid",
        message:
          'Value "' +
          value +
          '" not in spec: [' +
          testCase.enumValues.join(", ") +
          "]",
        actualValue: value,
        actualType: actualType,
      }
    }

    if (actualType === "number" && !Number.isFinite(value)) {
      return {
        status: "invalid",
        message: "Expected finite number",
        actualValue: value,
        actualType,
      }
    }
    if (
      testCase.recordValueType &&
      Object.values(value).some(
        (item) => item !== undefined && typeof item !== testCase.recordValueType
      )
    ) {
      return {
        status: "invalid",
        message: "Invalid record value",
        actualValue: value,
        actualType,
      }
    }
    if (
      testCase.items &&
      value.some(function (item) {
        return (
          typeof item !== testCase.items.type ||
          (testCase.items.enum && !testCase.items.enum.includes(item))
        )
      })
    ) {
      return {
        status: "invalid",
        message: "Invalid array member",
        actualValue: value,
        actualType,
      }
    }
    return {
      status: "provided",
      message: "OK",
      actualValue: value,
      actualType: actualType,
    }
  }

  /**
   * Calculate a letter grade from a percentage
   */
  function getGrade(percentage) {
    if (percentage >= 90) return { letter: "A", color: "pass" }
    if (percentage >= 80) return { letter: "B", color: "pass" }
    if (percentage >= 70) return { letter: "C", color: "warn" }
    if (percentage >= 60) return { letter: "D", color: "warn" }
    return { letter: "F", color: "fail" }
  }

  /**
   * Find unexpected properties in the host data that aren't in the schema
   */
  function findUnexpectedProperties(hostData, schema, prefix) {
    const unexpected = []
    prefix = prefix || ""

    if (!hostData || typeof hostData !== "object" || Array.isArray(hostData)) {
      return unexpected
    }

    for (const key in hostData) {
      if (!Object.prototype.hasOwnProperty.call(hostData, key)) continue
      const fullPath = prefix ? prefix + "." + key : key

      if (!(key in schema)) {
        unexpected.push({
          path: fullPath,
          value: hostData[key],
          type:
            hostData[key] === null
              ? "null"
              : Array.isArray(hostData[key])
                ? "array"
                : typeof hostData[key],
        })
        // Also add nested unexpected properties
        if (
          typeof hostData[key] === "object" &&
          hostData[key] !== null &&
          !Array.isArray(hostData[key])
        ) {
          const nested = findUnexpectedProperties(hostData[key], {}, fullPath)
          unexpected.push.apply(unexpected, nested)
        }
      } else if (
        schema[key].children &&
        typeof hostData[key] === "object" &&
        !Array.isArray(hostData[key])
      ) {
        const nested = findUnexpectedProperties(
          hostData[key],
          schema[key].children,
          fullPath
        )
        unexpected.push.apply(unexpected, nested)
      }
    }

    return unexpected
  }

  /**
   * Format a value for display in test results
   */
  function formatTestValue(value, maxLength) {
    maxLength = maxLength || 50
    if (value === undefined) return "undefined"
    if (value === null) return "null"
    if (typeof value === "string") {
      const display =
        value.length > maxLength ? value.substring(0, maxLength) + "..." : value
      return '"' + display + '"'
    }
    if (typeof value === "boolean" || typeof value === "number") {
      return String(value)
    }
    if (Array.isArray(value)) {
      return "[" + value.length + " items]"
    }
    if (typeof value === "object") {
      return "{" + Object.keys(value).length + " keys}"
    }
    return String(value)
  }

  // ==========================================================================
  // Styles Helpers
  // ==========================================================================

  function injectStyleVariables(variables) {
    if (!variables) return

    const existingStyle = document.getElementById("host-style-variables")
    if (existingStyle) {
      existingStyle.remove()
    }

    let css = ":root {\n"
    for (const [varName, value] of Object.entries(variables)) {
      if (typeof value !== "string" || !/^--[a-zA-Z0-9_-]+$/.test(varName))
        continue
      css += "  " + varName + ": " + value + ";\n"
    }
    css += "}\n"

    const styleEl = document.createElement("style")
    styleEl.id = "host-style-variables"
    styleEl.textContent = css
    document.head.appendChild(styleEl)
  }

  function categorizeStyleVariables(variables) {
    const categories = {
      "Background Colors": [],
      "Text Colors": [],
      "Border Colors": [],
      "Ring Colors": [],
      "Font Families": [],
      "Font Weights": [],
      "Heading Styles": [],
      "Text Styles": [],
      "Border Radius": [],
      Shadows: [],
      Other: [],
    }

    for (const [key, value] of Object.entries(variables)) {
      if (typeof value !== "string") continue
      if (key.startsWith("--color-background-")) {
        categories["Background Colors"].push([key, value])
      } else if (key.startsWith("--color-text-")) {
        categories["Text Colors"].push([key, value])
      } else if (key.startsWith("--color-border-")) {
        categories["Border Colors"].push([key, value])
      } else if (key.startsWith("--color-ring-")) {
        categories["Ring Colors"].push([key, value])
      } else if (key === "--font-sans" || key === "--font-mono") {
        categories["Font Families"].push([key, value])
      } else if (key.startsWith("--font-weight-")) {
        categories["Font Weights"].push([key, value])
      } else if (key.startsWith("--font-heading-")) {
        categories["Heading Styles"].push([key, value])
      } else if (key.startsWith("--font-text-")) {
        categories["Text Styles"].push([key, value])
      } else if (
        key.startsWith("--border-radius-") ||
        key.startsWith("--border-width-")
      ) {
        categories["Border Radius"].push([key, value])
      } else if (key.startsWith("--shadow-")) {
        categories["Shadows"].push([key, value])
      } else {
        categories["Other"].push([key, value])
      }
    }

    return categories
  }

  // ==========================================================================
  // Message Handling
  // ==========================================================================

  function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value)
  }

  function classifyJsonRpcMessage(data) {
    if (!isObject(data) || data.jsonrpc !== "2.0") return null

    const hasId = Object.prototype.hasOwnProperty.call(data, "id")
    const hasMethod = Object.prototype.hasOwnProperty.call(data, "method")
    const hasResult = Object.prototype.hasOwnProperty.call(data, "result")
    const hasError = Object.prototype.hasOwnProperty.call(data, "error")

    if (
      hasId &&
      !(
        typeof data.id === "string" ||
        (typeof data.id === "number" && Number.isFinite(data.id))
      )
    )
      return "invalid"
    // MCP params are always objects; an own `params: undefined` (which
    // structured clone preserves) is treated as absent, not as malformed.
    if (data.params !== undefined && !isObject(data.params)) return "invalid"

    if (hasMethod) {
      if (typeof data.method !== "string" || hasResult || hasError) {
        return "invalid"
      }
      return hasId ? "request" : "notification"
    }

    // JSON-RPC permits any `result` value; the bench records whatever the host
    // actually sent rather than timing the request out.
    if (
      hasId &&
      hasResult !== hasError &&
      (!hasError ||
        (isObject(data.error) &&
          Number.isInteger(data.error.code) &&
          typeof data.error.message === "string"))
    ) {
      return hasError ? "error-response" : "success-response"
    }

    return "invalid"
  }

  function sendResponse(id, method, result) {
    logMessage("sent", method + " (response)", result)
    window.parent.postMessage({ jsonrpc: "2.0", id: id, result: result }, "*")
  }

  function sendErrorResponse(id, method, code, message) {
    const error = { code: code, message: message }
    logMessage("sent", method + " (error)", error)
    window.parent.postMessage({ jsonrpc: "2.0", id: id, error: error }, "*")
  }

  function setConnectionState(nextState, error) {
    connectionState = nextState
    window.dispatchEvent(
      new CustomEvent("mcp-connection-state-changed", {
        detail: { state: nextState, error: error || null },
      })
    )
  }

  function failPendingRequests(reason) {
    const error = reason instanceof Error ? reason : new Error(String(reason))
    pendingRequests.forEach(function (pending) {
      if (pending.timeoutId !== null) window.clearTimeout(pending.timeoutId)
      pending.reject(error)
    })
    pendingRequests.clear()
  }

  function stopAutomaticSizing() {
    if (resizeObserver) {
      resizeObserver.disconnect()
      resizeObserver = null
    }
    if (sizeChangeFrame !== null) {
      window.cancelAnimationFrame(sizeChangeFrame)
      sizeChangeFrame = null
    }
    pendingReportedHeight = null
  }

  function startAutomaticSizing() {
    if (resizeObserver) return
    if (typeof ResizeObserver !== "function") {
      sendSizeChanged()
      return
    }

    resizeObserver = new ResizeObserver(sendSizeChanged)
    resizeObserver.observe(document.body)
    const appContent = document.getElementById("app-content")
    if (appContent) resizeObserver.observe(appContent)
    const appLoading = document.getElementById("app-loading")
    if (appLoading) resizeObserver.observe(appLoading)
    sendSizeChanged()
  }

  function enableSizeReporting() {
    sizeReportingEnabled = true
    startAutomaticSizing()
  }

  function disableSizeReporting() {
    sizeReportingEnabled = false
    stopAutomaticSizing()
  }

  function closeConnection(reason) {
    hostRequestHandlers = {}
    setConnectionState("closed")
    disableSizeReporting()
    failPendingRequests(reason || new Error("MCP connection closed"))
  }

  // Only reject what the shell cannot operate without: a string protocol
  // version and object-shaped (or absent) top-level sections. Value-level
  // conformance of hostContext is the grading schema's job, so an off-spec
  // theme or platform is graded rather than turned into a connection failure.
  function optionalObjectSection(value, name) {
    if (value === undefined || value === null) return {}
    if (!isObject(value)) {
      throw new Error("Initialization result field must be an object: " + name)
    }
    return value
  }

  function normalizeInitializeResult(result) {
    if (!isObject(result)) {
      throw new Error("Host returned an invalid initialization result")
    }
    if (
      typeof result.protocolVersion !== "string" ||
      !result.protocolVersion.trim()
    ) {
      throw new Error(
        "Initialization result is missing a valid protocolVersion"
      )
    }

    // Legacy hosts (MCP Jam) reply with appInfo/appCapabilities.
    let legacyAliases = false
    let hostInfo = result.hostInfo
    if (hostInfo == null && isObject(result.appInfo)) {
      hostInfo = result.appInfo
      legacyAliases = true
    }
    let hostCapabilities = result.hostCapabilities
    if (hostCapabilities == null && isObject(result.appCapabilities)) {
      hostCapabilities = result.appCapabilities
      legacyAliases = true
    }

    return {
      hostInfo: {
        protocolVersion: result.protocolVersion,
        hostInfo: optionalObjectSection(hostInfo, "hostInfo"),
        hostCapabilities: optionalObjectSection(
          hostCapabilities,
          "hostCapabilities"
        ),
        hostContext: optionalObjectSection(result.hostContext, "hostContext"),
      },
      compatibility: {
        protocolVersion: result.protocolVersion,
        benchVersion: MCP_APPS_SPEC_VERSION,
        matchesBenchVersion: result.protocolVersion === MCP_APPS_SPEC_VERSION,
        legacyAliases: legacyAliases,
      },
    }
  }

  function showConnectionError(error) {
    const message = error instanceof Error ? error.message : String(error)
    const subtitle = document.getElementById("host-info-subtitle")
    if (subtitle) subtitle.textContent = "Connection failed: " + message
    const loadingText = document.querySelector(".app-loading-text")
    if (loadingText) loadingText.textContent = "Connection failed: " + message
    const spinner = document.querySelector(".app-loading-spinner")
    if (spinner) spinner.style.display = "none"
  }

  function handleMessage(event) {
    if (event.source !== window.parent) return
    if (connectionState === "closed" || connectionState === "failed") return

    const data = event.data
    const messageType = classifyJsonRpcMessage(data)
    if (messageType === null) return
    if (messageType === "invalid") {
      console.error("[MCP Shell] Ignoring invalid JSON-RPC message", data)
      return
    }

    // Handle responses to our requests
    if (
      messageType === "success-response" ||
      messageType === "error-response"
    ) {
      const isError = messageType === "error-response"
      const payload = isError ? data.error : data.result
      const pending = pendingRequests.get(data.id)
      if (pending) {
        pendingRequests.delete(data.id)
        if (pending.timeoutId !== null) window.clearTimeout(pending.timeoutId)
        logMessage(
          "received",
          pending.method + (isError ? " (error)" : " (response)"),
          payload
        )
        if (isError) pending.reject(payload)
        else {
          if (pending.method === "ui/request-display-mode")
            applyGrantedDisplayMode(payload)
          pending.resolve(payload)
        }
        return
      }
      // A reply that arrived after the local timeout, or one we never asked
      // for: record it so the inspectors can show what the host actually did.
      const expiredMethod = expiredRequests.get(data.id)
      if (expiredMethod !== undefined) {
        expiredRequests.delete(data.id)
        logMessage(
          "received",
          expiredMethod + (isError ? " (late error)" : " (late response)"),
          payload
        )
      } else {
        logMessage(
          "received",
          "unmatched " +
            (isError ? "error" : "response") +
            " (id " +
            String(data.id) +
            ")",
          payload
        )
      }
      return
    }

    // Handle requests from host
    if (messageType === "request") {
      logMessage("received", data.method + " (request)", data.params)
      if (data.method === "ui/resource-teardown") {
        sendResponse(data.id, data.method, {})
        closeConnection(new Error("Host requested resource teardown"))
      } else if (data.method === "ping") {
        sendResponse(data.id, data.method, {})
      } else if (
        connectionState === "initialized" &&
        Object.hasOwn(hostRequestHandlers, data.method)
      ) {
        const handler = hostRequestHandlers[data.method]
        Promise.resolve()
          .then(() => {
            if (connectionState === "initialized")
              return handler(data.params || {})
          })
          .then((result) => {
            if (connectionState === "initialized")
              sendResponse(data.id, data.method, result)
          })
          .catch((error) => {
            if (connectionState === "initialized")
              sendErrorResponse(data.id, data.method, -32602, error.message)
          })
      } else {
        sendErrorResponse(
          data.id,
          data.method,
          -32601,
          "Method not found: " + data.method
        )
      }
      return
    }

    // Handle notifications from host
    logMessage("received", data.method, data.params)

    // Handle host-context-changed notification
    if (data.method === "ui/notifications/host-context-changed") {
      if (data.params && data.params.theme) {
        setTheme(data.params.theme)
      }
      if (data.params && data.params.displayMode) {
        setDisplayMode(data.params.displayMode)
      }
      if (currentHostInfo && currentHostInfo.hostContext) {
        Object.assign(currentHostInfo.hostContext, data.params)
        applyHostLayout(currentHostInfo.hostContext)
        if (data.params && "styles" in data.params)
          applyHostStyles(data.params.styles)
      }
      window.dispatchEvent(
        new CustomEvent("mcp-host-context-changed", { detail: data.params })
      )
    }

    // Handle tool-input notification
    if (data.method === "ui/notifications/tool-input") {
      recordLifecycle(data.method, data.params)
      currentToolData.toolInput = data.params
      window.dispatchEvent(
        new CustomEvent("mcp-tool-input", { detail: data.params })
      )
    }

    // Handle tool-result notification
    if (data.method === "ui/notifications/tool-result") {
      recordLifecycle(data.method, data.params)
      currentToolData.toolResult = data.params
      window.dispatchEvent(
        new CustomEvent("mcp-tool-result", { detail: data.params })
      )
    }

    // Handle tool-input-partial notification
    if (data.method === "ui/notifications/tool-input-partial") {
      recordLifecycle(data.method, data.params)
      currentToolData.toolInputPartial = data.params
      window.dispatchEvent(
        new CustomEvent("mcp-tool-input-partial", { detail: data.params })
      )
    }

    // Handle tool-cancelled notification
    if (data.method === "ui/notifications/tool-cancelled") {
      recordLifecycle(data.method, data.params)
      setReady()
      currentToolData.toolCancelled = data.params
      window.dispatchEvent(
        new CustomEvent("mcp-tool-cancelled", { detail: data.params })
      )
    }
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  /**
   * Perform the ui/initialize handshake.
   *
   * Resolves with the normalized host info on success and with `null` on
   * failure. Failure is reported through the connection state, the
   * `mcp-connection-state-changed` event, and the visible status text rather
   * than by rejecting, so pages can call this without a `.catch`.
   */
  async function initialize(options) {
    options = options || {}
    const clientName = options.clientName || "MCP App"
    const clientVersion = options.clientVersion || "1.0.0"
    const onInitialized = options.onInitialized || function () {}
    if (connectionState === "connecting" || connectionState === "initialized") {
      throw new Error("MCP connection is already " + connectionState)
    }
    hostRequestHandlers = options.hostRequestHandlers || {}
    lifecycleEvents.length = 0
    lifecycleSequence = 0
    completeInputReceived = false
    toolTerminal = false
    disableSizeReporting()
    setConnectionState("connecting")

    let hostResponded = false
    let normalized
    try {
      // Defaults to the spec modes only: an app has to ask for the extension
      // modes by name, so a stock handshake stays valid upstream.
      const availableDisplayModes =
        options.availableDisplayModes === null
          ? null
          : options.availableDisplayModes || SPEC_DISPLAY_MODES.slice()
      const initParams = {
        protocolVersion: MCP_APPS_SPEC_VERSION,
        appInfo: {
          name: clientName,
          version: clientVersion,
          ...(options.title ? { title: options.title } : {}),
        },
        appCapabilities: {
          ...(options.appCapabilities || {}),
          ...(availableDisplayModes
            ? { availableDisplayModes: availableDisplayModes }
            : {}),
        },
      }

      const result = await sendRequest("ui/initialize", initParams, {
        timeoutMs: INITIALIZE_TIMEOUT_MS,
      })
      hostResponded = true
      normalized = normalizeInitializeResult(result)
    } catch (error) {
      console.error("[MCP Shell] Initialization error:", error)
      failPendingRequests(error)
      // Teardown during the handshake already closed the connection.
      if (connectionState === "closed") return null
      setConnectionState("failed", error)
      showConnectionError(error)
      // The host answered, so it is rendering this view: keep reporting our
      // size so the connection error is readable instead of clipped.
      if (hostResponded) enableSizeReporting()
      return null
    }

    // The handshake succeeded. From here on, failures in page code must not
    // be mistaken for a broken connection.
    const hostInfo = normalized.hostInfo
    if (hostInfo.hostContext.theme) {
      setTheme(hostInfo.hostContext.theme)
    }
    if (hostInfo.hostContext.displayMode) {
      setDisplayMode(hostInfo.hostContext.displayMode)
    }

    currentHostInfo = hostInfo
    currentCompatibility = normalized.compatibility
    applyHostLayout(hostInfo.hostContext)
    if (hostInfo.hostContext.styles)
      applyHostStyles(hostInfo.hostContext.styles)

    const subtitle = document.getElementById("host-info-subtitle")
    if (subtitle) {
      const name = hostInfo.hostInfo.name || "Unknown Host"
      const version = hostInfo.hostInfo.version || ""
      const hostDisplay = version ? name + " v" + version : name
      subtitle.textContent =
        "Current host: " +
        hostDisplay +
        " · MCP Apps protocol: " +
        hostInfo.protocolVersion +
        " · Bench reference: " +
        MCP_APPS_SPEC_VERSION +
        (currentCompatibility.matchesBenchVersion
          ? ""
          : " (different versions; results are a reference comparison)")
    }

    sendNotification("ui/notifications/initialized")
    setConnectionState("initialized")
    enableSizeReporting()
    setReady()

    try {
      onInitialized(hostInfo)
    } catch (error) {
      console.error("[MCP Shell] onInitialized callback failed:", error)
    }

    window.dispatchEvent(
      new CustomEvent("mcp-initialized", { detail: hostInfo })
    )
    return hostInfo
  }

  // ==========================================================================
  // Setup
  // ==========================================================================

  window.addEventListener("message", handleMessage)

  // ==========================================================================
  // Inspector Navigation
  // ==========================================================================

  const inspectors = [
    { id: "inspect-host-info", icon: "🖥️", label: "Host Info" },
    { id: "inspect-host-styles", icon: "🎨", label: "Styles" },
    { id: "inspect-messaging", icon: "💬", label: "Messaging" },
    { id: "inspect-tool-data", icon: "🔧", label: "Tool Data" },
    { id: "inspect-display-modes", icon: "🖼️", label: "Display Modes" },
    { id: "inspect-model-context", icon: "🧠", label: "Model Context" },
    { id: "inspect-media-player", icon: "🎬", label: "Media Player" },
  ]
  let currentInspectorFooterId = null

  function getFooterStructuredContent() {
    const toolResult = currentToolData.toolResult
    if (
      !toolResult ||
      !toolResult.structuredContent ||
      typeof toolResult.structuredContent !== "object"
    ) {
      return null
    }

    return toolResult.structuredContent
  }

  function renderFooterMetadata() {
    const structuredContent = getFooterStructuredContent()
    if (!structuredContent) {
      return ""
    }

    const timestamp =
      typeof structuredContent.timestamp === "string"
        ? structuredContent.timestamp
        : null
    const joke =
      typeof structuredContent.joke === "string"
        ? structuredContent.joke.trim()
        : ""

    if (!timestamp && !joke) {
      return ""
    }

    let html = '<div class="inspector-footer-meta">'

    if (timestamp) {
      html +=
        '<div class="inspector-footer-timestamp">Inspection time: ' +
        escapeHtml(timestamp) +
        "</div>"
    }

    if (joke) {
      html +=
        '<div class="inspector-footer-joke">' + escapeHtml(joke) + "</div>"
    }

    html += "</div>"
    return html
  }

  function renderInspectorFooter() {
    const footer = document.getElementById("inspector-footer")
    if (!footer) return

    footer.innerHTML =
      '<div class="inspector-footer-nav">' +
      inspectors
        .map(function (inspector) {
          const isCurrent = inspector.id === currentInspectorFooterId
          return (
            '<button class="inspector-footer-btn' +
            (isCurrent ? " is-current" : "") +
            '" data-tool="' +
            inspector.id +
            '"' +
            (isCurrent ? " disabled" : "") +
            ">" +
            '<span class="inspector-footer-btn-icon">' +
            inspector.icon +
            "</span>" +
            inspector.label +
            "</button>"
          )
        })
        .join("") +
      "</div>" +
      renderFooterMetadata()

    footer.querySelectorAll(".inspector-footer-btn").forEach(function (btn) {
      if (!btn.disabled) {
        btn.addEventListener("click", function () {
          const toolName = btn.getAttribute("data-tool")
          if (toolName) {
            navigateToInspector(toolName)
          }
        })
      }
    })
  }

  function navigateToInspector(toolName) {
    sendRequest("ui/message", {
      role: "user",
      content: [
        {
          type: "text",
          text: "Run the " + toolName + " tool.",
        },
      ],
    })
      .then(function (result) {
        console.log("[Shell] Navigation message sent:", toolName)
      })
      .catch(function (error) {
        console.error("[Shell] Navigation error:", error)
      })
  }

  function setupInspectorFooter(currentInspectorId) {
    currentInspectorFooterId = currentInspectorId || null
    renderInspectorFooter()
  }

  // ==========================================================================
  // Loading State Management
  // ==========================================================================

  function setReady() {
    isReady = true
    const loading = document.getElementById("app-loading")
    const content = document.getElementById("app-content")
    if (loading) loading.style.display = "none"
    if (content) content.classList.add("is-ready")
    sendSizeChanged()
  }

  function checkReady() {
    return isReady
  }

  // Auto-set ready when tool-result is received
  window.addEventListener("mcp-tool-result", function () {
    setReady()
    renderInspectorFooter()
  })

  // ==========================================================================
  // Export Global API
  // ==========================================================================

  window.MCPAppShell = {
    // Spec version
    SPEC_VERSION: MCP_APPS_SPEC_VERSION,

    // State access
    getHostInfo: function () {
      return currentHostInfo
    },
    getToolData: function () {
      return currentToolData
    },
    getLifecycleEvents: function () {
      return lifecycleEvents.slice()
    },
    applyHostLayout: applyHostLayout,
    applyHostStyles: applyHostStyles,
    getMessageLog: function () {
      return messageLog.slice()
    },
    isReady: checkReady,
    getConnectionState: function () {
      return connectionState
    },
    // Bench-side view of the handshake: protocol version vs. bench reference
    // and whether legacy appInfo aliases were used. Kept separate from
    // getHostInfo() so that object only ever contains what the host sent.
    getCompatibility: function () {
      return currentCompatibility
    },

    // Loading state
    setReady: setReady,

    // Messaging
    sendRequest: sendRequest,
    sendNotification: sendNotification,
    sendSizeChanged: sendSizeChanged,

    // Theme
    setTheme: setTheme,
    getTheme: getTheme,

    // Display Mode
    setDisplayMode: setDisplayMode,
    SPEC_DISPLAY_MODES: SPEC_DISPLAY_MODES.slice(),
    EXTENSION_DISPLAY_MODES: EXTENSION_DISPLAY_MODES.slice(),
    RECOGNIZED_DISPLAY_MODES: RECOGNIZED_DISPLAY_MODES.slice(),

    // Utilities
    escapeHtml: escapeHtml,
    getTimestamp: getTimestamp,

    // JSON rendering
    renderJsonValue: renderJsonValue,
    renderCollapsibleJson: renderCollapsibleJson,

    // Host data display
    flattenObject: flattenObject,
    renderHostDataValue: renderHostDataValue,
    renderKeyWithSegments: renderKeyWithSegments,
    setupDataListHoverEffects: setupDataListHoverEffects,

    // Validation
    validateHostContext: validateHostContext,
    getPathValidationStatus: getPathValidationStatus,
    hostContextSchema: hostContextSchema,

    // Test Runner
    generateTestCases: generateTestCases,
    getValueByPath: getValueByPath,
    runTestCase: runTestCase,
    findUnexpectedProperties: findUnexpectedProperties,
    formatTestValue: formatTestValue,
    getGrade: getGrade,

    // Styles
    injectStyleVariables: injectStyleVariables,
    categorizeStyleVariables: categorizeStyleVariables,

    // Navigation
    setupInspectorFooter: setupInspectorFooter,
    navigateToInspector: navigateToInspector,

    // Initialization
    initialize: initialize,
  }
})()
