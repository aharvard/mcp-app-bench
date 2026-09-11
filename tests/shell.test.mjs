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

test("malformed initialization fails visibly and sends no initialized notification", async () => {
  const harness = createHarness()
  const initialized = harness.shell.initialize()
  const request = harness.messages.at(-1)

  harness.dispatch({
    jsonrpc: "2.0",
    id: request.id,
    result: { protocolVersion: 42 },
  })

  await assert.rejects(initialized, /valid protocolVersion/)
  assert.equal(harness.shell.getConnectionState(), "failed")
  assert.match(harness.loadingText.textContent, /Connection failed/)
  assert.equal(
    harness.messages.some(
      (message) => message.method === "ui/notifications/initialized"
    ),
    false
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
    { id, result: null },
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
      const rejected = assert.rejects(pending, /timed out/)
      h.expireTimers()
      await rejected
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
  const rejected = assert.rejects(pending, /resource teardown/)
  h.dispatch({ jsonrpc: "2.0", id: 40, method: "ui/resource-teardown" })
  await rejected
  assert.equal(h.shell.getConnectionState(), "closed")
  assert.equal(h.timers.size, 0)
})

test("nested initialization fields reject invalid values", async () => {
  for (const overrides of [
    { hostCapabilities: { serverTools: 42 } },
    { hostCapabilities: { serverResources: { listChanged: "yes" } } },
    { hostCapabilities: { sandbox: { permissions: { camera: true } } } },
    { hostCapabilities: { sandbox: { csp: { connectDomains: [42] } } } },
    { hostContext: { theme: 42 } },
    { hostContext: { availableDisplayModes: "inline" } },
    { hostContext: { availableDisplayModes: [42] } },
    { hostContext: { safeAreaInsets: { top: 0 } } },
    { hostContext: { styles: { css: { fonts: 42 } } } },
  ]) {
    const h = createHarness()
    await assert.rejects(
      initialize(h, validInitializeResult(overrides)),
      /Invalid initialization field/
    )
    assert.equal(h.shell.getConnectionState(), "failed")
    assert.equal(
      h.messages.some((m) => m.method === "ui/notifications/initialized"),
      false
    )
  }
})

test("optional omissions, empty dimensions, and extensions remain valid", async () => {
  const h = createHarness()
  await initialize(
    h,
    validInitializeResult({
      hostContext: { containerDimensions: {}, vendorField: { enabled: true } },
      hostCapabilities: { serverTools: {}, vendorCapability: true },
    })
  )
  assert.equal(h.shell.getConnectionState(), "initialized")
  assert.equal(h.shell.getHostInfo().hostContext.vendorField.enabled, true)
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
  const rejected = assert.rejects(pending, /timed out/)
  h.expireTimers()
  await rejected
  assert.match(
    h.subtitle.textContent,
    /Connection failed: ui\/initialize request timed out/
  )
})
