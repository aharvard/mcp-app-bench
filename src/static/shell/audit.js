/* Separate reproducible probes from human observations; never infer delivery from ACK. */
;(function () {
  const shell = window.MCPAppShell
  const draft = document.body.dataset.profile === "draft"
  const records = []
  let toolEnabled = true
  let token = ""
  function record(probe, outcome, detail) {
    records.push({
      time: new Date().toISOString(),
      profile: draft ? "draft@6d9bdc7" : "2026-01-26",
      probe,
      outcome,
      detail,
    })
    document.getElementById("results").textContent = JSON.stringify(
      records,
      null,
      2
    )
  }
  function supported(path) {
    let value = shell.getHostInfo().hostCapabilities
    for (const key of path.split(".")) value = value && value[key]
    return value !== null && typeof value === "object" && !Array.isArray(value)
  }
  async function request(label, method, params, capability, check) {
    if (
      capability &&
      !supported(capability) &&
      !document.getElementById("negative").checked
    ) {
      record(label, "unsupported", "Capability absent: " + capability)
      return
    }
    try {
      const result = await shell.sendRequest(
        method,
        params,
        /^(ui\/download-file|sampling\/createMessage)$/.test(method)
          ? { timeoutMs: 0 }
          : undefined
      )
      record(
        label,
        result && result.isError
          ? "tool-error"
          : check
            ? check(result)
            : "acknowledged — behavior unverified",
        result
      )
    } catch (error) {
      record(
        label,
        typeof error.code === "number"
          ? "JSON-RPC rejection — inspect policy/error evidence"
          : "transport error or timeout — inconclusive",
        { message: error.message, code: error.code }
      )
    }
  }
  function button(label, callback) {
    const element = document.createElement("button")
    element.className = "action-btn"
    element.textContent = label
    element.onclick = async () => {
      element.disabled = true
      try {
        await callback()
      } catch (error) {
        record(label, "probe error", error.message)
      } finally {
        element.disabled = false
      }
    }
    document.getElementById("probes").appendChild(element)
  }
  for (const name of ["both", "app-only", "model-only", "default"]) {
    button("Call visibility-" + name, () =>
      request(
        "visibility-" + name,
        "tools/call",
        { name: "visibility-" + name, arguments: {} },
        "serverTools",
        name === "model-only"
          ? () => "FAIL: model-only tool executed from app"
          : (result) =>
              result && Array.isArray(result.content)
                ? "observed proxy result"
                : "FAIL: malformed tool result"
      )
    )
  }
  button("Read deterministic resource", () =>
    request(
      "resource",
      "resources/read",
      { uri: "resource://example/demo-resource" },
      "serverResources",
      (result) =>
        result &&
        Array.isArray(result.contents) &&
        result.contents.some(
          (c) =>
            c.uri === "resource://example/demo-resource" &&
            c.mimeType === "text/plain" &&
            c.text === "MCP App Bench resource fixture v1"
        )
          ? "PASS: fixture matched"
          : "FAIL: fixture mismatch"
    )
  )
  button("Read missing resource (negative)", () =>
    request(
      "missing resource — expect rejection",
      "resources/read",
      { uri: "resource://example/missing-resource" },
      "serverResources",
      () => "FAIL: missing resource succeeded"
    )
  )
  button("Send log notification", () => {
    if (!supported("logging") && !document.getElementById("negative").checked)
      return record("logging", "unsupported", "logging absent")
    shell.sendNotification("notifications/message", {
      level: "info",
      data: "MCP App Bench logging fixture v1",
    })
    record(
      "logging",
      "sent — no acknowledgement expected",
      "Inspect host logs manually"
    )
  })
  for (const kind of ["text", "structured", "overwrite", "clear"]) {
    button("Context: " + kind, () => {
      token = "bench-" + crypto.randomUUID()
      const params =
        kind === "clear"
          ? {}
          : kind === "structured"
            ? { structuredContent: { benchToken: token } }
            : {
                content: [
                  { type: "text", text: "Current bench token: " + token },
                ],
              }
      record(
        "proposed context (verify request outcome below)",
        "manual next-turn check",
        kind === "clear" ? "No app contribution" : token
      )
      return request(
        "context " + kind,
        "ui/update-model-context",
        params,
        kind === "clear"
          ? "updateModelContext"
          : kind === "structured"
            ? "updateModelContext.structuredContent"
            : "updateModelContext.text"
      )
    })
  }
  button("Send text chat message", () =>
    request(
      "message",
      "ui/message",
      {
        role: "user",
        content: [{ type: "text", text: "MCP App Bench message fixture v1" }],
      },
      "message.text"
    )
  )
  if (draft) {
    const modalities = {
      image: {
        type: "image",
        mimeType: "image/png",
        data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII=",
      },
      audio: {
        type: "audio",
        mimeType: "audio/wav",
        data: "UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQIAAACAgA==",
      },
      resource: {
        type: "resource",
        resource: {
          uri: "resource://example/demo-resource",
          mimeType: "text/plain",
          text: "MCP App Bench resource fixture v1",
        },
      },
      resourceLink: {
        type: "resource_link",
        uri: document.body.dataset.baseUrl + "/fixtures/download.txt",
        name: "bench.txt",
        mimeType: "text/plain",
      },
    }
    for (const [kind, block] of Object.entries(modalities)) {
      button("Message modality: " + kind, () =>
        request(
          "message " + kind,
          "ui/message",
          { role: "user", content: [block] },
          "message." + kind
        )
      )
      button("Context modality: " + kind, () =>
        request(
          "context " + kind,
          "ui/update-model-context",
          { content: [block] },
          "updateModelContext." + kind
        )
      )
    }
    button("Download embedded text", () =>
      request(
        "download embedded",
        "ui/download-file",
        {
          contents: [
            {
              type: "resource",
              resource: {
                uri: "file:///bench.txt",
                mimeType: "text/plain",
                text: "MCP App Bench download fixture v1",
              },
            },
          ],
        },
        "downloadFile"
      )
    )
    button("Download linked text", () =>
      request(
        "download linked",
        "ui/download-file",
        {
          contents: [
            {
              type: "resource_link",
              uri: document.body.dataset.baseUrl + "/fixtures/download.txt",
              name: "bench.txt",
              mimeType: "text/plain",
            },
          ],
        },
        "downloadFile"
      )
    )
    for (const withTools of [false, true])
      button("Sampling" + (withTools ? " with tools" : ""), () =>
        request(
          "sampling",
          "sampling/createMessage",
          {
            messages: [
              {
                role: "user",
                content: { type: "text", text: "Reply BENCH_OK" },
              },
            ],
            maxTokens: 32,
            ...(withTools
              ? {
                  tools: [
                    {
                      name: "bench_echo",
                      description: "Echo test",
                      inputSchema: { type: "object", properties: {} },
                    },
                  ],
                }
              : {}),
          },
          withTools ? "sampling.tools" : "sampling"
        )
      )
    button("Toggle app-provided tool", () => {
      toolEnabled = !toolEnabled
      shell.sendNotification("notifications/tools/list_changed")
      record("app tools", "sent — verify host refresh", { toolEnabled })
    })
    button("Request teardown", () => {
      shell.sendNotification("ui/notifications/request-teardown", {})
      record(
        "teardown",
        "requested — host may defer",
        "If accepted, expect ui/resource-teardown before removal"
      )
    })
  }
  document.getElementById("record").onclick = () =>
    record(
      "human observation",
      "manual evidence (not automatically graded)",
      document.getElementById("evidence").value
    )
  shell.initialize({
    clientName: "Audit probes",
    appCapabilities: draft ? { tools: { listChanged: true } } : {},
    hostRequestHandlers: draft
      ? {
          "tools/list": () => ({
            tools: toolEnabled
              ? [
                  {
                    name: "bench_echo",
                    description: "Echo a token in the app",
                    inputSchema: {
                      type: "object",
                      properties: { token: { type: "string" } },
                      required: ["token"],
                    },
                  },
                ]
              : [],
          }),
          "tools/call": (params) => {
            if (
              !toolEnabled ||
              !params ||
              params.name !== "bench_echo" ||
              typeof params.arguments?.token !== "string"
            )
              throw new Error("Unknown tool or invalid token")
            record("app tool invocation", "observed", params.arguments)
            return { content: [{ type: "text", text: params.arguments.token }] }
          },
        }
      : {},
    onInitialized: (info) => record("initialize", "connected", info),
  })
})()
