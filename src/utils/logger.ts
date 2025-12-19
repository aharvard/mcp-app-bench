import chalk from "chalk"
import stringWidth from "string-width"
import stripAnsi from "strip-ansi"

/**
 * Truncates a long line to fit within the specified width
 * @param line The line to truncate
 * @param maxWidth The maximum width for the line
 * @returns Truncated line with ellipsis if needed
 */
const truncateLine = (line: string, maxWidth: number): string => {
  const stripped = stripAnsi(line)
  const visualWidth = stringWidth(stripped)

  // If the line fits, return it as-is
  if (visualWidth <= maxWidth) {
    return line
  }

  // Need to truncate - find where to cut
  let currentWidth = 0
  let cutIndex = 0

  for (let i = 0; i < stripped.length; i++) {
    const char = stripped[i]
    const charWidth = stringWidth(char)

    if (currentWidth + charWidth + 3 > maxWidth) {
      // +3 for "..."
      break
    }

    currentWidth += charWidth
    cutIndex = i + 1
  }

  // Reconstruct with ANSI codes if present
  if (line.includes("\x1b[")) {
    // Has ANSI codes, need to preserve them
    const truncated = stripped.substring(0, cutIndex)
    // Find where this substring ends in the original
    let originalIndex = 0
    let strippedIndex = 0

    while (strippedIndex < cutIndex && originalIndex < line.length) {
      if (line[originalIndex] === "\x1b") {
        // Skip ANSI sequence
        const escapeEnd = line.indexOf("m", originalIndex)
        if (escapeEnd !== -1) {
          originalIndex = escapeEnd + 1
        }
      } else {
        strippedIndex++
        originalIndex++
      }
    }

    return line.substring(0, originalIndex) + chalk.gray("...")
  }

  return stripped.substring(0, cutIndex) + chalk.gray("...")
}

/**
 * Logs a pretty box with a title and content lines
 * @param title The title of the box
 * @param content Array of content lines to display
 * @param color The chalk color function to use for borders
 */
export const logBox = (
  title: string,
  content: string[],
  color: typeof chalk.cyan = chalk.cyan
) => {
  const width = 100
  const contentMaxWidth = width - 4 // Account for borders and padding
  const topBorder = color("╭" + "─".repeat(width - 2) + "╮")
  const bottomBorder = color("╰" + "─".repeat(width - 2) + "╯")

  // Calculate title width properly (accounting for ANSI codes and emojis)
  const titleWidth = stringWidth(stripAnsi(title))
  const titlePadding = Math.max(0, width - titleWidth - 4)
  const titleLine = color("│ ") + title + " ".repeat(titlePadding) + color(" │")

  console.log(topBorder)
  console.log(titleLine)
  console.log(color("├" + "─".repeat(width - 2) + "┤"))

  // Process each line, truncating if necessary
  content.forEach((line) => {
    const truncated = truncateLine(line, contentMaxWidth)
    const visualWidth = stringWidth(stripAnsi(truncated))
    const padding = Math.max(0, contentMaxWidth - visualWidth)
    console.log(color("│ ") + truncated + " ".repeat(padding) + color(" │"))
  })

  console.log(bottomBorder)
}

/**
 * Formats JSON with white coloring
 * @param obj The object to format
 * @param indent The number of spaces to indent
 * @returns Formatted JSON string with white coloring
 */
export const formatJSON = (obj: any, indent = 2): string => {
  return JSON.stringify(obj, null, indent)
    .split("\n")
    .map((line) => chalk.white(line))
    .join("\n")
}

/**
 * Logs an incoming MCP client message
 */
export const logClientMessage = (
  sessionId: string | undefined,
  messageBody: any,
  route?: string
) => {
  const messageType = messageBody.method || "unknown"
  const isNewSession = !sessionId
  const routeLabel = route ? chalk.gray(` [${route}]`) : ""

  const title = isNewSession
    ? chalk.bold.white("📨 Client → Server ") +
      chalk.yellow("(NEW)") +
      routeLabel
    : chalk.bold.white("📨 Client → Server") + routeLabel

  logBox(
    title,
    [
      `${chalk.blue("Session:")} ${
        sessionId ? chalk.green(sessionId) : chalk.yellow("(initializing)")
      }`,
      `${chalk.blue("Method:")} ${chalk.magenta(messageType)}`,
      `${chalk.blue("Payload:")}`,
      ...formatJSON(messageBody)
        .split("\n")
        .map((line) => `  ${line}`),
    ],
    chalk.blue
  )
}

/**
 * Logs an outgoing MCP server message
 */
export const logServerMessage = (
  sessionId: string | undefined,
  messageBody: any,
  route?: string
) => {
  const messageType =
    messageBody.method ||
    (messageBody.result ? "result" : messageBody.error ? "error" : "unknown")
  const routeLabel = route ? chalk.gray(` [${route}]`) : ""

  logBox(
    chalk.bold.white("📤 Server → Client") + routeLabel,
    [
      `${chalk.blue("Session:")} ${
        sessionId ? chalk.green(sessionId) : chalk.yellow("(no session)")
      }`,
      `${chalk.blue("Type:")} ${chalk.cyan(messageType)}`,
      `${chalk.blue("Payload:")}`,
      ...formatJSON(messageBody)
        .split("\n")
        .map((line) => `  ${line}`),
    ],
    chalk.cyan
  )
}

/**
 * Logs session initialization
 */
export const logSessionInitialized = (
  sessionId: string,
  activeCount: number,
  route?: string
) => {
  const routeLabel = route ? chalk.gray(` [${route}]`) : ""

  logBox(
    chalk.bold.white("✨ Session Initialized") + routeLabel,
    [
      `${chalk.blue("Session ID:")} ${chalk.green(sessionId)}`,
      `${chalk.blue("Active Sessions:")} ${chalk.cyan(activeCount.toString())}`,
    ],
    chalk.green
  )
}

/**
 * Logs session closure
 */
export const logSessionClosed = (
  sessionId: string,
  remainingCount: number,
  route?: string
) => {
  const routeLabel = route ? chalk.gray(` [${route}]`) : ""

  logBox(
    chalk.bold.white("👋 Session Closed") + routeLabel,
    [
      `${chalk.blue("Session ID:")} ${chalk.red(sessionId)}`,
      `${chalk.blue("Remaining Sessions:")} ${chalk.cyan(
        remainingCount.toString()
      )}`,
    ],
    chalk.red
  )
}

/**
 * Logs tool invocation
 */
export const logToolInvocation = (toolName: string, action: string) => {
  logBox(
    chalk.bold.white("🛠️  Tool Invocation"),
    [
      `${chalk.blue("Tool:")} ${chalk.magenta(toolName)}`,
      `${chalk.blue("Action:")} ${chalk.gray(action)}`,
    ],
    chalk.magenta
  )
}

/**
 * Logs session request failure
 */
export const logSessionRequestFailed = (
  method: string,
  sessionId: string | undefined,
  activeCount: number,
  route?: string
) => {
  const methodIcon = method === "GET" ? "📥" : "🗑️"
  const routeLabel = route ? chalk.gray(` [${route}]`) : ""

  logBox(
    chalk.bold.white(`${methodIcon} ${method} Request Failed`) + routeLabel,
    [
      `${chalk.blue("Session:")} ${
        sessionId ? chalk.red(sessionId) : chalk.red("(missing)")
      }`,
      `${chalk.red("Error:")} Session not found`,
      `${chalk.blue("Active Sessions:")} ${chalk.cyan(activeCount.toString())}`,
    ],
    chalk.red
  )
}

/**
 * Logs server startup
 */
export const logServerStarted = (port: string | number) => {
  console.log("\n")
  logBox(
    chalk.bold.white("🚀 MCP Server Started"),
    [
      `${chalk.blue("Port:")} ${chalk.green(port.toString())}`,
      `${chalk.blue("URL:")} ${chalk.cyan(`http://localhost:${port}`)}`,
      `${chalk.blue("Status:")} ${chalk.green("Ready to accept connections")}`,
    ],
    chalk.green
  )
  console.log("\n")
}
