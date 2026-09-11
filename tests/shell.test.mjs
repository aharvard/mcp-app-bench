import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import vm from "node:vm"

const shellSource = readFileSync(
  new URL("../src/static/shell/shell.js", import.meta.url),
  "utf8"
)

class FakeElement {
  constructor() {
    this.classNames = new Set()
    this.classList = {
      add: (...names) => names.forEach((name) => this.classNames.add(name)),
      remove: (...names) =>
        names.forEach((name) => this.classNames.delete(name)),
      contains: (name) => this.classNames.has(name),
    }
    this.style = {}
    this.textContent = ""
    this.scrollHeight = 120
  }

  getBoundingClientRect() {
    return { bottom: 120, height: 120, top: 0 }
  }
}

function createHarness() {
  const listeners = new Map()
  const messages = []
  const errors = []
  const body = new FakeElement()
  const loading = new FakeElement()
  const loadingText = new FakeElement()
  const subtitle = new FakeElement()
  const content = new FakeElement()
  const elements = {
    "app-content": content,
    "app-loading": loading,
    "host-info-subtitle": subtitle,
  }
  const parent = {
    postMessage(message) {
      messages.push(message)
    },
  }
  let nextFrameId = 1
  const frames = new Map()
  const timers = new Map()
  let nextTimerId = 1

  const window = {
    parent,
    addEventListener(type, listener) {
      const registered = listeners.get(type) || []
      registered.push(listener)
      listeners.set(type, registered)
    },
    dispatchEvent(event) {
      for (const listener of listeners.get(event.type) || []) listener(event)
      return true
    },
    setTimeout(callback) {
      const id = nextTimerId++
      timers.set(id, callback)
      return id
    },
    clearTimeout(id) {
      timers.delete(id)
    },
    requestAnimationFrame(callback) {
      const id = nextFrameId++
      frames.set(
        id,
        setImmediate(() => {
          frames.delete(id)
          callback()
        })
      )
      return id
    },
    cancelAnimationFrame(id) {
      const frame = frames.get(id)
      if (frame) clearImmediate(frame)
      frames.delete(id)
    },
  }

  class FakeCustomEvent {
    constructor(type, options = {}) {
      this.type = type
      this.detail = options.detail
    }
  }

  class FakeResizeObserver {
    observe() {}
    disconnect() {}
  }

  const context = {
    console: {
      debug() {},
      error(...args) {
        errors.push(args)
      },
      log() {},
      warn() {},
    },
    CustomEvent: FakeCustomEvent,
    document: {
      body,
      documentElement: new FakeElement(),
      getElementById(id) {
        return elements[id] || null
      },
      querySelector(selector) {
        if (selector === ".app-loading-text") return loadingText
        if (selector === ".app-content.is-ready") {
          return content.classList.contains("is-ready") ? content : null
        }
        return null
      },
    },
    HTMLElement: FakeElement,
    ResizeObserver: FakeResizeObserver,
    setTimeout,
    window,
  }
  vm.runInNewContext(shellSource, context)

  return {
    dispatch(data, source = parent) {
      for (const listener of listeners.get("message") || []) {
        listener({ data, source })
      }
    },
    errors,
    timers,
    expireTimers() {
      for (const [id, callback] of [...timers]) {
        timers.delete(id)
        callback()
      }
    },
    loadingText,
    messages,
    parent,
    shell: window.MCPAppShell,
    subtitle,
  }
}

function validInitializeResult(overrides = {}) {
  return {
    protocolVersion: "2026-01-26",
    hostInfo: { name: "Test Host", version: "1.0.0" },
    hostCapabilities: {},
    hostContext: {},
    ...overrides,
  }
}

async function initialize(harness, result = validInitializeResult()) {
  const initialized = harness.shell.initialize()
  const request = harness.messages.at(-1)
  harness.dispatch({ jsonrpc: "2.0", id: request.id, result })
  await initialized
  await new Promise((resolve) => setImmediate(resolve))
}

test("only the parent window can settle requests or mutate tool state", async () => {
  const harness = createHarness()
  const initialized = harness.shell.initialize()
  const request = harness.messages.at(-1)
  const attacker = {}

  harness.dispatch(
    {
      jsonrpc: "2.0",
      id: request.id,
      result: validInitializeResult(),
    },
    attacker
  )
  harness.dispatch(
    {
      jsonrpc: "2.0",
      method: "ui/notifications/tool-result",
      params: { forged: true },
    },
    attacker
  )

  assert.equal(harness.shell.getConnectionState(), "connecting")
  assert.equal(harness.shell.getToolData().toolResult, null)

  harness.dispatch({
    jsonrpc: "2.0",
    id: request.id,
    result: validInitializeResult(),
  })
  await initialized
  assert.equal(harness.shell.getConnectionState(), "initialized")
})

test("host requests do not consume outgoing requests with the same ID", async () => {
  const harness = createHarness()
  await initialize(harness)
  const outgoing = harness.shell.sendRequest("example/outgoing", {})
  const request = harness.messages.at(-1)

  harness.dispatch({
    jsonrpc: "2.0",
    id: request.id,
    method: "example/unsupported",
    params: {},
  })

  assert.deepEqual(JSON.parse(JSON.stringify(harness.messages.at(-1))), {
    jsonrpc: "2.0",
    id: request.id,
    error: { code: -32601, message: "Method not found: example/unsupported" },
  })

  harness.dispatch({ jsonrpc: "2.0", id: request.id, result: { ok: true } })
  assert.deepEqual(await outgoing, { ok: true })
})

test("teardown is acknowledged and closes all pending requests", async () => {
  const harness = createHarness()
  await initialize(harness)
  const outgoing = harness.shell.sendRequest("example/outgoing", {})
  const rejected = assert.rejects(outgoing, /resource teardown/)
  const request = harness.messages.at(-1)

  harness.dispatch({
    jsonrpc: "2.0",
    id: request.id,
    method: "ui/resource-teardown",
    params: {},
  })

  assert.deepEqual(JSON.parse(JSON.stringify(harness.messages.at(-1))), {
    jsonrpc: "2.0",
    id: request.id,
    result: {},
  })
  await rejected
  assert.equal(harness.shell.getConnectionState(), "closed")
})

test("malformed initialization fails visibly, resolves null, and sends no initialized notification", async () => {
  const harness = createHarness()
  const initialized = harness.shell.initialize()
  const request = harness.messages.at(-1)

  harness.dispatch({
    jsonrpc: "2.0",
    id: request.id,
    result: { protocolVersion: 42 },
  })

  // Failure is reported through state and visible text, not a rejection, so
  // pages can call initialize() without a .catch.
  assert.equal(await initialized, null)
  assert.equal(harness.shell.getConnectionState(), "failed")
  assert.match(harness.loadingText.textContent, /valid protocolVersion/)
  assert.match(harness.loadingText.textContent, /Connection failed/)
  assert.equal(
    harness.messages.some(
      (message) => message.method === "ui/notifications/initialized"
    ),
    false
  )
})

test("a host that answered with a broken result still receives size reports", async () => {
  const harness = createHarness()
  const initialized = harness.shell.initialize()
  const request = harness.messages.at(-1)
  harness.dispatch({
    jsonrpc: "2.0",
    id: request.id,
    result: validInitializeResult({ hostContext: "dark" }),
  })
  assert.equal(await initialized, null)
  assert.equal(harness.shell.getConnectionState(), "failed")
  assert.match(
    harness.loadingText.textContent,
    /must be an object: hostContext/
  )

  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(
    harness.messages.some(
      (message) => message.method === "ui/notifications/size-changed"
    ),
    true
  )
})

test("automatic sizing starts only after successful initialization", async () => {
  const harness = createHarness()
  const initialized = harness.shell.initialize()
  const request = harness.messages.at(-1)

  assert.deepEqual(
    harness.messages.map((message) => message.method),
    ["ui/initialize"]
  )

  harness.dispatch({
    jsonrpc: "2.0",
    id: request.id,
    result: validInitializeResult(),
  })
  await initialized
  await new Promise((resolve) => setImmediate(resolve))

  assert.equal(
    harness.messages.some(
      (message) => message.method === "ui/notifications/size-changed"
    ),
    true
  )
})

test("different protocol versions are displayed without blocking initialization", async () => {
  for (const protocolVersion of [
    "2025-11-21",
    "2027-01-01",
    "vendor-preview",
  ]) {
    const h = createHarness()
    await initialize(h, validInitializeResult({ protocolVersion }))
    assert.equal(h.shell.getConnectionState(), "initialized")
    assert.equal(h.shell.getHostInfo().protocolVersion, protocolVersion)
    assert.ok(
      h.subtitle.textContent.includes("MCP Apps protocol: " + protocolVersion)
    )
    assert.ok(h.subtitle.textContent.includes("Bench reference: 2026-01-26"))
    assert.match(h.subtitle.textContent, /reference comparison/)
    assert.equal(h.shell.getCompatibility().matchesBenchVersion, false)
    assert.equal(h.shell.getCompatibility().protocolVersion, protocolVersion)
    assert.ok(
      h.messages.some((m) => m.method === "ui/notifications/initialized")
    )
    h.dispatch({
      jsonrpc: "2.0",
      method: "ui/notifications/tool-result",
      params: {},
    })
    assert.equal(h.shell.isReady(), true)
  }
})

test("unrelated browser messages are ignored", () => {
  const harness = createHarness()
  harness.dispatch({ type: "host-internal-message" })
  assert.equal(harness.errors.length, 0)
  assert.equal(harness.shell.getConnectionState(), "closed")
})

test("malformed envelopes cannot settle requests or close the connection", async () => {
  const h = createHarness()
  await initialize(h)
  const pending = h.shell.sendRequest("probe", {})
  const id = h.messages.at(-1).id
  for (const message of [
    { id, error: {} },
    { id, error: { code: "bad", message: "bad" } },
    { id, result: {}, error: { code: -1, message: "bad" } },
    { id: {}, method: "ui/resource-teardown", params: {} },
    { id: 90, method: "ui/resource-teardown", params: 7 },
    { id: null, method: "ui/resource-teardown" },
  ])
    h.dispatch({ jsonrpc: "2.0", ...message })
  assert.equal(h.shell.getConnectionState(), "initialized")
  assert.equal(h.timers.size, 1)
  h.dispatch({ jsonrpc: "2.0", id, result: { ok: true } })
  assert.deepEqual(await pending, { ok: true })
  assert.equal(h.timers.size, 0)
})

test("non-object results settle requests with whatever the host sent", async () => {
  const h = createHarness()
  await initialize(h)
  for (const result of [null, true, "done", [1]]) {
    const pending = h.shell.sendRequest("probe", {})
    const id = h.messages.at(-1).id
    h.dispatch({ jsonrpc: "2.0", id, result })
    assert.deepEqual(await pending, result)
  }
  assert.equal(h.errors.length, 0)
  assert.equal(h.timers.size, 0)
})

test("outgoing messages omit params instead of posting params: undefined", async () => {
  const h = createHarness()
  await initialize(h)
  const initialized = h.messages.find(
    (m) => m.method === "ui/notifications/initialized"
  )
  assert.equal("params" in initialized, false)
  h.shell.sendRequest("ping")
  assert.equal("params" in h.messages.at(-1), false)
  // Inbound messages with an own undefined params key are still accepted.
  h.dispatch({
    jsonrpc: "2.0",
    method: "ui/notifications/tool-cancelled",
    params: undefined,
  })
  assert.equal(h.shell.getToolData().toolCancelled, undefined)
  assert.equal(h.errors.length, 0)
  const log = h.shell.getMessageLog()
  assert.equal(log.at(-1).method, "ui/notifications/tool-cancelled")
})

test("requests named like notifications have no notification side effects", async () => {
  const h = createHarness()
  await initialize(h)
  h.dispatch({
    jsonrpc: "2.0",
    id: 40,
    method: "ui/notifications/tool-result",
    params: { unexpected: true },
  })
  assert.equal(h.shell.getToolData().toolResult, null)
  assert.equal(h.shell.isReady(), false)
  assert.equal(h.messages.at(-1).error.code, -32601)
  h.dispatch({
    jsonrpc: "2.0",
    method: "ui/notifications/tool-result",
    params: { expected: true },
  })
  assert.equal(h.shell.getToolData().toolResult.expected, true)
})

test("closed and failed connections ignore inbound and outbound traffic", async () => {
  for (const state of ["closed", "failed"]) {
    const h = createHarness()
    if (state === "closed") {
      await initialize(h)
      h.dispatch({ jsonrpc: "2.0", id: 40, method: "ui/resource-teardown" })
    } else {
      const pending = h.shell.initialize()
      h.expireTimers()
      assert.equal(await pending, null)
    }
    const count = h.messages.length
    h.dispatch({
      jsonrpc: "2.0",
      method: "ui/notifications/tool-result",
      params: {},
    })
    h.dispatch({
      jsonrpc: "2.0",
      method: "ui/notifications/host-context-changed",
      params: { theme: "light" },
    })
    await assert.rejects(h.shell.sendRequest("probe", {}), /MCP connection is/)
    h.shell.sendNotification("notifications/message", {})
    h.shell.sendSizeChanged()
    assert.equal(h.messages.length, count)
    assert.equal(h.shell.getToolData().toolResult, null)
    assert.equal(h.timers.size, 0)
    assert.equal(h.shell.getConnectionState(), state)
  }
})

test("teardown during initialization stays closed", async () => {
  const h = createHarness()
  const pending = h.shell.initialize()
  h.dispatch({ jsonrpc: "2.0", id: 40, method: "ui/resource-teardown" })
  assert.equal(await pending, null)
  assert.equal(h.shell.getConnectionState(), "closed")
  assert.equal(h.timers.size, 0)
})

test("off-spec nested values are preserved for grading instead of failing initialization", async () => {
  // These are exactly the deviations the Host Info scorecard exists to
  // report; a conformance bench must connect to grade them.
  for (const overrides of [
    { hostCapabilities: { serverTools: 42 } },
    { hostCapabilities: { sandbox: { csp: { connectDomains: [42] } } } },
    { hostContext: { theme: "system" } },
    { hostContext: { platform: "ios", displayMode: "modal" } },
    { hostContext: { locale: null } },
    { hostContext: { availableDisplayModes: "inline" } },
    { hostContext: { safeAreaInsets: { top: 0 } } },
    { hostContext: { toolInfo: { id: 1 } } },
    { hostContext: { styles: { variables: { "--font-weight-normal": 400 } } } },
  ]) {
    const h = createHarness()
    const result = validInitializeResult(overrides)
    await initialize(h, result)
    assert.equal(h.shell.getConnectionState(), "initialized")
    assert.deepEqual(h.shell.getHostInfo().hostContext, result.hostContext)
    assert.deepEqual(
      h.shell.getHostInfo().hostCapabilities,
      result.hostCapabilities
    )
    assert.ok(
      h.messages.some((m) => m.method === "ui/notifications/initialized")
    )
  }
})

test("only non-object top-level sections fail initialization", async () => {
  for (const [overrides, field] of [
    [{ hostInfo: "Host" }, "hostInfo"],
    [{ hostCapabilities: [] }, "hostCapabilities"],
    [{ hostContext: 7 }, "hostContext"],
  ]) {
    const h = createHarness()
    const initialized = h.shell.initialize()
    h.dispatch({
      jsonrpc: "2.0",
      id: h.messages.at(-1).id,
      result: validInitializeResult(overrides),
    })
    assert.equal(await initialized, null)
    assert.equal(h.shell.getConnectionState(), "failed")
    assert.match(
      h.subtitle.textContent,
      new RegExp("must be an object: " + field)
    )
  }
})

test("missing optional sections default to empty objects and legacy aliases are recorded separately", async () => {
  const h = createHarness()
  await initialize(h, {
    protocolVersion: "2026-01-26",
    appInfo: { name: "Legacy Host", version: "0.1" },
    appCapabilities: { legacy: true },
    hostContext: null,
  })
  assert.equal(h.shell.getConnectionState(), "initialized")
  // Objects built inside the sandbox have a different realm prototype, so
  // compare plain JSON copies.
  const hostInfo = h.shell.getHostInfo()
  assert.deepEqual(JSON.parse(JSON.stringify(hostInfo)), {
    protocolVersion: "2026-01-26",
    hostInfo: { name: "Legacy Host", version: "0.1" },
    hostCapabilities: { legacy: true },
    hostContext: {},
  })
  assert.equal("compatibilityMode" in hostInfo, false)
  assert.deepEqual(JSON.parse(JSON.stringify(h.shell.getCompatibility())), {
    protocolVersion: "2026-01-26",
    benchVersion: "2026-01-26",
    matchesBenchVersion: true,
    legacyAliases: true,
  })
  assert.match(h.subtitle.textContent, /Legacy Host v0\.1/)

  const bare = createHarness()
  await initialize(bare, { protocolVersion: "2026-01-26" })
  assert.equal(bare.shell.getConnectionState(), "initialized")
  assert.match(bare.subtitle.textContent, /Current host: Unknown Host/)
  assert.equal(bare.shell.getCompatibility().legacyAliases, false)
})

test("a throwing onInitialized callback does not fail a live connection", async () => {
  const h = createHarness()
  const initialized = h.shell.initialize({
    onInitialized() {
      throw new Error("page bug")
    },
  })
  h.dispatch({
    jsonrpc: "2.0",
    id: h.messages.at(-1).id,
    result: validInitializeResult(),
  })
  const hostInfo = await initialized
  assert.equal(hostInfo.protocolVersion, "2026-01-26")
  assert.equal(h.shell.getConnectionState(), "initialized")
  assert.ok(
    h.errors.some((args) => /onInitialized callback failed/.test(args[0]))
  )
  assert.doesNotMatch(h.subtitle.textContent, /Connection failed/)

  h.dispatch({
    jsonrpc: "2.0",
    method: "ui/notifications/tool-result",
    params: { still: "delivered" },
  })
  assert.equal(h.shell.getToolData().toolResult.still, "delivered")
  assert.equal(h.shell.isReady(), true)
})

test("request timeout clears the pending request without closing a healthy connection", async () => {
  const h = createHarness()
  await initialize(h)
  const pending = h.shell.sendRequest("probe", {})
  const rejected = assert.rejects(pending, /probe request timed out/)
  h.expireTimers()
  await rejected
  assert.equal(h.timers.size, 0)
  assert.equal(h.shell.getConnectionState(), "initialized")
})

test("late replies to timed-out requests are logged instead of dropped", async () => {
  const h = createHarness()
  await initialize(h)
  const pending = h.shell.sendRequest("ui/open-link", { url: "https://x" })
  const id = h.messages.at(-1).id
  h.expireTimers()
  await assert.rejects(pending, /timed out/)

  h.dispatch({ jsonrpc: "2.0", id, result: { isError: false } })
  const late = h.shell.getMessageLog().at(-1)
  assert.equal(late.direction, "received")
  assert.equal(late.method, "ui/open-link (late response)")
  assert.deepEqual(late.content, { isError: false })
  assert.equal(h.errors.length, 0)

  h.dispatch({ jsonrpc: "2.0", id: 999, error: { code: -1, message: "?" } })
  assert.equal(
    h.shell.getMessageLog().at(-1).method,
    "unmatched error (id 999)"
  )
})

test("timeouts are per request and can be disabled for user-gated calls", async () => {
  const h = createHarness()
  await initialize(h)
  assert.equal(h.timers.size, 0)
  const noTimeout = h.shell.sendRequest("ui/open-link", {}, { timeoutMs: 0 })
  assert.equal(h.timers.size, 0)
  const withTimeout = h.shell.sendRequest("ping", {}, { timeoutMs: 500 })
  assert.equal(h.timers.size, 1)
  const pingId = h.messages.at(-1).id
  h.expireTimers()
  await assert.rejects(withTimeout, /ping request timed out/)
  h.dispatch({ jsonrpc: "2.0", id: pingId - 1, result: {} })
  assert.deepEqual(await noTimeout, {})
})

test("host requests and the app's replies appear in the message log", async () => {
  const h = createHarness()
  await initialize(h)
  h.dispatch({ jsonrpc: "2.0", id: 7, method: "example/unsupported" })
  h.dispatch({ jsonrpc: "2.0", id: 8, method: "ui/resource-teardown" })
  const methods = Array.from(
    h.shell.getMessageLog(),
    (m) => m.direction + " " + m.method
  )
  assert.deepEqual(methods.slice(-4), [
    "received example/unsupported (request)",
    "sent example/unsupported (error)",
    "received ui/resource-teardown (request)",
    "sent ui/resource-teardown (response)",
  ])
  assert.equal(h.shell.getConnectionState(), "closed")
})

test("Transparency has a visible status target for initialization failures", async () => {
  const html = readFileSync(
    new URL("../src/static/transparency.html", import.meta.url),
    "utf8"
  )
  assert.match(
    html,
    /<p id="host-info-subtitle" role="status">Connecting\.\.\.<\/p>/
  )
  const h = createHarness()
  const pending = h.shell.initialize()
  h.expireTimers()
  assert.equal(await pending, null)
  assert.match(
    h.subtitle.textContent,
    /Connection failed: ui\/initialize request timed out/
  )
})
