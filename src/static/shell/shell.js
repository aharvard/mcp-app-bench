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
  let isReady = false

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
                inputSchema: { type: "object", optional: true },
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
          enum: ["inline", "fullscreen", "pip"],
          optional: true,
        },
        availableDisplayModes: { type: "array", optional: true },
        // containerDimensions is a union type:
        // (height | maxHeight) & (width | maxWidth)
        // We mark all as optional and validate the union logic separately
        containerDimensions: {
          type: "object",
          optional: true,
          unionGroups: [
            { oneOf: ["height", "maxHeight"], label: "height or maxHeight" },
            { oneOf: ["width", "maxWidth"], label: "width or maxWidth" },
          ],
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

  function setDisplayMode(mode) {
    document.body.classList.remove(
      "display-mode-inline",
      "display-mode-fullscreen",
      "display-mode-pip"
    )
    if (mode) {
      document.body.classList.add("display-mode-" + mode)
    }
  }

  // ==========================================================================
  // Size Reporting
  // ==========================================================================

  function sendSizeChanged() {
    // const width = document.body.scrollWidth
    const height = document.body.scrollHeight
    console.log("🔥Sending size changed notification:", { height })
    window.parent.postMessage(
      {
        jsonrpc: "2.0",
        method: "ui/notifications/size-changed",
        params: { height },
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
  // Test Runner
  // ==========================================================================

  /**
   * Generate test cases from the hostContextSchema
   * Only generates tests for leaf nodes (properties without children)
   * Returns an array of { path, expectedType, enumValues?, optional, parentPath? }
   */
  function generateTestCases(schema, prefix, parentOptional) {
    const tests = []
    prefix = prefix || ""
    parentOptional = parentOptional || false

    for (const key in schema) {
      const fullPath = prefix ? prefix + "." + key : key
      const entry = schema[key]
      // A property is effectively optional if it's marked optional OR any parent is optional
      const isOptional = parentOptional || !!entry.optional

      if (entry.children) {
        // This is a parent node - recurse into children, don't add a test for this node
        const childTests = generateTestCases(
          entry.children,
          fullPath,
          isOptional
        )
        tests.push.apply(tests, childTests)
      } else {
        // This is a leaf node - add a test
        tests.push({
          path: fullPath,
          expectedType: entry.type,
          enumValues: entry.enum || null,
          optional: isOptional,
          parentPath: prefix || null,
        })
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
      if (current === null || current === undefined) {
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
        status: "warn",
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
      if (!hostData.hasOwnProperty(key)) continue
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
      if (data.params && data.params.displayMode) {
        setDisplayMode(data.params.displayMode)
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

  // Track current app capabilities so they can be updated post-init
  var currentAppCapabilities = {
    availableDisplayModes: ["inline", "fullscreen", "pip"],
  }

  /**
   * Update app capabilities and notify the host.
   * Sends a ui/notifications/app-capabilities-changed notification with the
   * full updated appCapabilities object.
   */
  function updateAppCapabilities(capabilities) {
    if (capabilities.availableDisplayModes) {
      currentAppCapabilities.availableDisplayModes =
        capabilities.availableDisplayModes.slice()
    }
    sendNotification("ui/notifications/app-capabilities-changed", {
      appCapabilities: currentAppCapabilities,
    })
  }

  async function initialize(options) {
    options = options || {}
    const clientName = options.clientName || "MCP App"
    const clientVersion = options.clientVersion || "1.0.0"
    const onInitialized = options.onInitialized || function () {}

    // Allow apps to override initial display modes
    if (options.availableDisplayModes) {
      currentAppCapabilities.availableDisplayModes =
        options.availableDisplayModes.slice()
    }

    try {
      const initParams = {
        protocolVersion: MCP_APPS_SPEC_VERSION,
        capabilities: {},
        clientInfo: {
          name: clientName,
          version: clientVersion,
        },
        appCapabilities: {
          availableDisplayModes:
            currentAppCapabilities.availableDisplayModes.slice(),
        },
      }
      // MCP Jam compatibility - also send as appInfo/appCapabilities
      initParams.appInfo = initParams.clientInfo
      if (!initParams.appCapabilities) {
        initParams.appCapabilities = initParams.capabilities
      }

      const result = await sendRequest("ui/initialize", initParams)

      // MCP Jam compatibility
      if (result.appInfo && !result.hostInfo) {
        result.hostInfo = result.appInfo
      }
      if (result.appCapabilities && !result.hostCapabilities) {
        result.hostCapabilities = result.appCapabilities
      }

      // Apply initial theme and display mode
      if (result.hostContext && result.hostContext.theme) {
        setTheme(result.hostContext.theme)
      }
      if (result.hostContext && result.hostContext.displayMode) {
        setDisplayMode(result.hostContext.displayMode)
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
  // Inspector Navigation
  // ==========================================================================

  const inspectors = [
    { id: "inspect-host-info", icon: "🖥️", label: "Host Info" },
    { id: "inspect-host-styles", icon: "🎨", label: "Styles" },
    { id: "inspect-messaging", icon: "💬", label: "Messaging" },
    { id: "inspect-tool-data", icon: "🔧", label: "Tool Data" },
    { id: "inspect-display-modes", icon: "🖼️", label: "Display Modes" },
  ]

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
    const footer = document.getElementById("inspector-footer")
    if (!footer) return

    footer.innerHTML = inspectors
      .map(function (inspector) {
        const isCurrent = inspector.id === currentInspectorId
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
      .join("")

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
    getMessageLog: function () {
      return messageLog.slice()
    },
    isReady: checkReady,

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

    // App Capabilities
    updateAppCapabilities: updateAppCapabilities,
    getAppCapabilities: function () {
      return {
        availableDisplayModes:
          currentAppCapabilities.availableDisplayModes.slice(),
      }
    },

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
    parseLightDark: parseLightDark,

    // Navigation
    setupInspectorFooter: setupInspectorFooter,
    navigateToInspector: navigateToInspector,

    // Initialization
    initialize: initialize,
  }
})()
