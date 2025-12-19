import type {
  App,
  McpUiHostCapabilities,
  McpUiHostContext,
} from "@modelcontextprotocol/ext-apps"
import { useApp } from "@modelcontextprotocol/ext-apps/react"
import type { Implementation } from "@modelcontextprotocol/sdk/types.js"
import React, { useEffect, useState } from "react"
import { ActionButton } from "./components/ActionButton"
import { JsonDisplay } from "./components/JsonDisplay"
import { TerminalSection } from "./components/TerminalSection"

const APP_INFO = { name: "MCP App Bench", version: "1.0.0" }

interface HostData {
  hostInfo?: Implementation
  hostCapabilities?: McpUiHostCapabilities
  hostContext?: McpUiHostContext
}

interface ToolData {
  toolInput: unknown
  toolInputPartial: unknown
  toolResult: unknown
  toolCancelled: unknown
}

function McpAppBench(): React.ReactElement {
  const [toolData, setToolData] = useState<ToolData>({
    toolInput: null,
    toolInputPartial: null,
    toolResult: null,
    toolCancelled: null,
  })
  const [theme, setTheme] = useState<"light" | "dark">("dark")

  const { app, error, isConnected } = useApp({
    appInfo: APP_INFO,
    capabilities: {
      tools: {}, // Declare that this app can handle tools/call and tools/list from the host
    },
    onAppCreated: (app) => {
      app.onteardown = async () => {
        console.log("[MCP App Bench] App is being torn down")
        return {}
      }

      app.ontoolinput = (params) => {
        console.log("[MCP App Bench] Received tool input:", params)
        setToolData((prev) => ({ ...prev, toolInput: params }))
      }

      app.ontoolinputpartial = (params) => {
        console.log("[MCP App Bench] Received partial tool input:", params)
        setToolData((prev) => ({ ...prev, toolInputPartial: params }))
      }

      app.ontoolresult = (params) => {
        console.log("[MCP App Bench] Received tool result:", params)
        setToolData((prev) => ({ ...prev, toolResult: params }))
      }

      app.ontoolcancelled = (params) => {
        console.log("[MCP App Bench] Tool cancelled:", params)
        setToolData((prev) => ({ ...prev, toolCancelled: params }))
      }

      app.onhostcontextchanged = (params) => {
        console.log("[MCP App Bench] Host context changed:", params)
        if (params.theme) {
          setTheme(params.theme as "light" | "dark")
        }
      }

      // Optional: Handle when host calls a tool that this app provides
      app.oncalltool = async (params) => {
        console.log("[MCP App Bench] Host called tool:", params)
        // Return a result for the tool call
        return {
          content: [
            {
              type: "text",
              text: `Tool ${params.name} called with args: ${JSON.stringify(params.arguments)}`,
            },
          ],
        }
      }

      // Optional: Handle when host lists tools this app provides
      app.onlisttools = async () => {
        console.log("[MCP App Bench] Host requested tool list")
        return {
          tools: ["app_example_tool"],
        }
      }
    },
  })

  // Apply theme from host context once connected
  useEffect(() => {
    if (app && isConnected) {
      const context = app.getHostContext()
      if (context?.theme) {
        setTheme(context.theme as "light" | "dark")
      }
    }
  }, [app, isConnected])

  // Apply theme class to body
  useEffect(() => {
    document.body.classList.remove("theme-light", "theme-dark")
    document.body.classList.add(`theme-${theme}`)
  }, [theme])

  if (error) {
    return (
      <div className="error">
        <strong>ERROR:</strong> {error.message}
      </div>
    )
  }

  if (!app || !isConnected) {
    return (
      <>
        <p className="host-info-subtitle">Connecting...</p>
        <h1>MCP App Bench</h1>
      </>
    )
  }

  return <McpAppBenchInner app={app} toolData={toolData} />
}

interface McpAppBenchInnerProps {
  app: App
  toolData: ToolData
}

function McpAppBenchInner({
  app,
  toolData,
}: McpAppBenchInnerProps): React.ReactElement {
  // Get host data from app
  const hostInfo = app.getHostVersion()
  const hostCapabilities = app.getHostCapabilities()
  const hostContext = app.getHostContext()

  const hostData: HostData = {
    hostInfo,
    hostCapabilities,
    hostContext,
  }

  const connectionStatus = hostInfo
    ? hostInfo.version
      ? `${hostInfo.name} v${hostInfo.version}`
      : hostInfo.name
    : "Connected"

  async function handleOpenLink() {
    try {
      const result = await app.openLink({
        url: "https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/draft/apps.mdx",
      })
      console.log("[MCP App Bench] openLink result:", result)
    } catch (err) {
      console.error("[MCP App Bench] openLink error:", err)
    }
  }

  async function handleSendMessage() {
    try {
      const result = await app.sendMessage({
        role: "user",
        content: [
          {
            type: "text",
            text: "Hello from MCP App Bench! This message was sent via sendMessage.",
          },
        ],
      })
      console.log("[MCP App Bench] sendMessage result:", result)
    } catch (err) {
      console.error("[MCP App Bench] sendMessage error:", err)
    }
  }

  async function handleSendLog() {
    try {
      await app.sendLog({
        level: "info",
        data: "This is a log message from MCP App Bench!",
      })
      console.log("[MCP App Bench] sendLog sent")
    } catch (err) {
      console.error("[MCP App Bench] sendLog error:", err)
    }
  }

  async function handleServerStatus() {
    try {
      const result = await app.callServerTool({
        name: "server-status",
        arguments: {},
      })
      console.log("[MCP App Bench] server-status result:", result)
    } catch (err) {
      console.error("[MCP App Bench] server-status error:", err)
    }
  }

  async function handleListResources() {
    try {
      const result = await app.request(
        { method: "resources/list", params: {} },
        // @ts-expect-error - using raw request method from Protocol base class
        { parse: (data: unknown) => data }
      )
      console.log("[MCP App Bench] resources/list result:", result)
    } catch (err) {
      console.error("[MCP App Bench] resources/list error:", err)
    }
  }

  async function handleListResourceTemplates() {
    try {
      const result = await app.request(
        { method: "resources/templates/list", params: {} },
        // @ts-expect-error - using raw request method from Protocol base class
        { parse: (data: unknown) => data }
      )
      console.log("[MCP App Bench] resources/templates/list result:", result)
    } catch (err) {
      console.error("[MCP App Bench] resources/templates/list error:", err)
    }
  }

  async function handleReadResource() {
    try {
      const result = await app.request(
        {
          method: "resources/read",
          params: { uri: "resource://example/demo-resource" },
        },
        // @ts-expect-error - using raw request method from Protocol base class
        { parse: (data: unknown) => data }
      )
      console.log("[MCP App Bench] resources/read result:", result)
    } catch (err) {
      console.error("[MCP App Bench] resources/read error:", err)
    }
  }

  async function handleListPrompts() {
    try {
      const result = await app.request(
        { method: "prompts/list", params: {} },
        // @ts-expect-error - using raw request method from Protocol base class
        { parse: (data: unknown) => data }
      )
      console.log("[MCP App Bench] prompts/list result:", result)
    } catch (err) {
      console.error("[MCP App Bench] prompts/list error:", err)
    }
  }

  async function handlePing() {
    try {
      const result = await app.request(
        { method: "ping", params: {} },
        // @ts-expect-error - using raw request method from Protocol base class
        { parse: (data: unknown) => data }
      )
      console.log("[MCP App Bench] ping result:", result)
    } catch (err) {
      console.error("[MCP App Bench] ping error:", err)
    }
  }

  async function handleRequestDisplayMode() {
    try {
      const result = await app.requestDisplayMode({ mode: "fullscreen" })
      console.log("[MCP App Bench] requestDisplayMode result:", result)
    } catch (err) {
      console.error("[MCP App Bench] requestDisplayMode error:", err)
    }
  }

  return (
    <>
      <p className="host-info-subtitle">{connectionStatus}</p>
      <h1>MCP App Bench</h1>

      <div className="actions">
        <h2 className="actions-heading">Host Requests</h2>
        <div className="actions-buttons">
          <ActionButton onClick={handleOpenLink} code="openLink">
            Open Link
          </ActionButton>
          <ActionButton onClick={handleSendMessage} code="sendMessage">
            Send Message
          </ActionButton>
          <ActionButton onClick={handleSendLog} code="sendLog">
            Send Log
          </ActionButton>
          <ActionButton
            onClick={handleRequestDisplayMode}
            code="requestDisplayMode"
          >
            Request Fullscreen
          </ActionButton>
        </div>
      </div>

      <div className="actions">
        <h2 className="actions-heading">Server Requests</h2>
        <div className="actions-buttons">
          <ActionButton onClick={handleServerStatus} code="tools/call">
            🔮 Server Status
          </ActionButton>
          <ActionButton onClick={handleListResources} code="resources/list">
            List Resources
          </ActionButton>
          <ActionButton
            onClick={handleListResourceTemplates}
            code="resources/templates/list"
          >
            List Templates
          </ActionButton>
          <ActionButton onClick={handleReadResource} code="resources/read">
            Read Resource
          </ActionButton>
          <ActionButton onClick={handleListPrompts} code="prompts/list">
            List Prompts
          </ActionButton>
          <ActionButton onClick={handlePing} code="ping">
            Ping
          </ActionButton>
        </div>
      </div>

      <div className="terminal">
        <div className="terminal-grid">
          <TerminalSection title="Host Data">
            <JsonDisplay data={hostData} />
          </TerminalSection>
          <TerminalSection title="Tool Data">
            <JsonDisplay data={toolData} />
          </TerminalSection>
        </div>
      </div>
    </>
  )
}

export default McpAppBench
