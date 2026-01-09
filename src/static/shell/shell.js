/**
 * MCP App Bench - Shell JavaScript
 * Shared foundation code for all MCP App inspection pages
 */

;(function () {
  "use strict"

  // ==========================================================================
  // State
  // ==========================================================================

  let requestId = 1
  const pendingRequests = new Map()
  let currentHostInfo = null
  let currentToolData = {
    toolInput: null,
    toolInputPartial: null,
    toolResult: null,
    toolCancelled: null,
  }

  // Message log
  const messageLog = []
  const MAX_MESSAGES = 100

  // ==========================================================================
  // HostContext Schema (for validation)
  // ==========================================================================

  const hostContextSchema = {
    hostContext: {
      type: "object",
      children: {
        toolInfo: {
          type: "object",
          children: {
            id: { type: ["string", "number"] },
            tool: {
              type: "object",
              children: {
                name: { type: "string" },
                description: { type: "string" },
                inputSchema: { type: "object" },
              },
            },
          },
        },
        theme: { type: "string", enum: ["light", "dark"] },
        styles: {
          type: "object",
          children: {
            variables: { type: "object" },
            css: {
              type: "object",
              children: {
                fonts: { type: "string" },
              },
            },
          },
        },
        displayMode: { type: "string", enum: ["inline", "fullscreen", "pip"] },
        availableDisplayModes: { type: "array" },
        containerDimensions: {
          type: "object",
          children: {
            height: { type: "number" },
            maxHeight: { type: "number" },
            width: { type: "number" },
            maxWidth: { type: "number" },
          },
        },
        locale: { type: "string" },
        timeZone: { type: "string" },
        userAgent: { type: "string" },
        platform: { type: "string", enum: ["web", "desktop", "mobile"] },
        deviceCapabilities: {
          type: "object",
          children: {
            touch: { type: "boolean" },
            hover: { type: "boolean" },
          },
        },
        safeAreaInsets: {
          type: "object",
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

  // ==========================================================================
  // Size Reporting
  // ==========================================================================

  function sendSizeChanged() {
    const width = document.body.scrollWidth
    const height = document.body.scrollHeight
    window.parent.postMessage(
      {
        jsonrpc: "2.0",
        method: "ui/notifications/size-changed",
        params: { width, height },
      },
      "*"
    )
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

  function sendRequest(method, params) {
    return new Promise((resolve, reject) => {
      const id = requestId++
      pendingRequests.set(id, { resolve, reject, method, params })
      logMessage("sent", method + " (request)", params)
      window.parent.postMessage(
        {
          jsonrpc: "2.0",
          id: id,
          method: method,
          params: params,
        },
        "*"
      )
    })
  }

  function sendNotification(method, params) {
    logMessage("sent", method + " (notification)", params)
    window.parent.postMessage(
      {
        jsonrpc: "2.0",
        method: method,
        params: params,
      },
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

  function parseLightDark(value) {
    const match = value.match(/^light-dark\(\s*([^,]+)\s*,\s*([^)]+)\s*\)$/)
    if (match) {
      return { light: match[1].trim(), dark: match[2].trim() }
    }
    return null
  }

  // ==========================================================================
  // Message Handling
  // ==========================================================================

  function handleMessage(event) {
    const data = event.data
    if (!data || typeof data !== "object" || data.jsonrpc !== "2.0") return

    // Handle response to our request
    if ("id" in data && pendingRequests.has(data.id)) {
      const pending = pendingRequests.get(data.id)
      pendingRequests.delete(data.id)
      if (data.error) {
        logMessage("received", pending.method + " (error)", data.error)
        pending.reject(data.error)
      } else {
        logMessage("received", pending.method + " (response)", data.result)
        pending.resolve(data.result)
      }
      return
    }

    // Handle notifications from host
    if (data.method) {
      logMessage("received", data.method, data.params)
    }

    // Handle host-context-changed notification
    if (data.method === "ui/notifications/host-context-changed") {
      if (data.params && data.params.theme) {
        setTheme(data.params.theme)
      }
      if (currentHostInfo && currentHostInfo.hostContext) {
        Object.assign(currentHostInfo.hostContext, data.params)
      }
      window.dispatchEvent(
        new CustomEvent("mcp-host-context-changed", { detail: data.params })
      )
    }

    // Handle tool-input notification
    if (data.method === "ui/notifications/tool-input") {
      currentToolData.toolInput = data.params
      window.dispatchEvent(
        new CustomEvent("mcp-tool-input", { detail: data.params })
      )
    }

    // Handle tool-result notification
    if (data.method === "ui/notifications/tool-result") {
      currentToolData.toolResult = data.params
      window.dispatchEvent(
        new CustomEvent("mcp-tool-result", { detail: data.params })
      )
    }

    // Handle tool-input-partial notification
    if (data.method === "ui/notifications/tool-input-partial") {
      currentToolData.toolInputPartial = data.params
      window.dispatchEvent(
        new CustomEvent("mcp-tool-input-partial", { detail: data.params })
      )
    }

    // Handle tool-cancelled notification
    if (data.method === "ui/notifications/tool-cancelled") {
      currentToolData.toolCancelled = data.params
      window.dispatchEvent(
        new CustomEvent("mcp-tool-cancelled", { detail: data.params })
      )
    }

    // Handle resource-teardown request
    if (data.method === "ui/resource-teardown") {
      if ("id" in data) {
        window.parent.postMessage(
          {
            jsonrpc: "2.0",
            id: data.id,
            result: {},
          },
          "*"
        )
      }
    }
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  async function initialize(options) {
    options = options || {}
    const clientName = options.clientName || "MCP App"
    const clientVersion = options.clientVersion || "1.0.0"
    const onInitialized = options.onInitialized || function () {}

    try {
      const initParams = {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: {
          name: clientName,
          version: clientVersion,
        },
      }
      // MCP Jam compatibility
      initParams.appInfo = initParams.clientInfo
      initParams.appCapabilities = initParams.capabilities

      const result = await sendRequest("ui/initialize", initParams)

      // MCP Jam compatibility
      if (result.appInfo && !result.hostInfo) {
        result.hostInfo = result.appInfo
      }
      if (result.appCapabilities && !result.hostCapabilities) {
        result.hostCapabilities = result.appCapabilities
      }

      // Apply initial theme
      if (result.hostContext && result.hostContext.theme) {
        setTheme(result.hostContext.theme)
      }

      // Store host info
      currentHostInfo = {
        protocolVersion: result.protocolVersion,
        hostInfo: result.hostInfo,
        hostCapabilities: result.hostCapabilities,
        hostContext: result.hostContext || {},
      }

      // Update subtitle if present
      const subtitle = document.getElementById("host-info-subtitle")
      if (subtitle && result.hostInfo) {
        const name = result.hostInfo.name || "Unknown Host"
        const version = result.hostInfo.version || ""
        const hostDisplay = version ? name + " v" + version : name
        subtitle.textContent = "Current host: " + hostDisplay
      }

      // Send initialized notification
      sendNotification("ui/notifications/initialized")

      // Call the callback
      onInitialized(result)

      // Dispatch event
      window.dispatchEvent(
        new CustomEvent("mcp-initialized", { detail: result })
      )
    } catch (error) {
      console.error("[MCP Shell] Initialization error:", error)
      const subtitle = document.getElementById("host-info-subtitle")
      if (subtitle) {
        subtitle.textContent = "Error: " + error.message
      }
    }
  }

  // ==========================================================================
  // Setup
  // ==========================================================================

  window.addEventListener("message", handleMessage)

  // Send initial size
  sendSizeChanged()

  // Observe size changes
  const resizeObserver = new ResizeObserver(sendSizeChanged)
  resizeObserver.observe(document.body)

  // ==========================================================================
  // Export Global API
  // ==========================================================================

  window.MCPAppShell = {
    // State access
    getHostInfo: function () {
      return currentHostInfo
    },
    getToolData: function () {
      return currentToolData
    },
    getMessageLog: function () {
      return messageLog.slice()
    },

    // Messaging
    sendRequest: sendRequest,
    sendNotification: sendNotification,
    sendSizeChanged: sendSizeChanged,

    // Theme
    setTheme: setTheme,
    getTheme: getTheme,

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

    // Styles
    injectStyleVariables: injectStyleVariables,
    categorizeStyleVariables: categorizeStyleVariables,
    parseLightDark: parseLightDark,

    // Initialization
    initialize: initialize,
  }
})()
