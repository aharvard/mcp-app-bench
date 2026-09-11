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
    setTimeout,
    clearTimeout,
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
    result: { protocolVersion: "bogus" },
  })

  await assert.rejects(initialized, /Unsupported MCP Apps protocol version/)
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

test("unrelated browser messages are ignored", () => {
  const harness = createHarness()
  harness.dispatch({ type: "host-internal-message" })
  assert.equal(harness.errors.length, 0)
  assert.equal(harness.shell.getConnectionState(), "closed")
})
