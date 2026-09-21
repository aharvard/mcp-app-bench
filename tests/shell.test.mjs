import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import vm from "node:vm"
import Ajv2020 from "ajv/dist/2020.js"
import addFormats from "ajv-formats"
import { wireFixtures } from "../test/wire-fixtures.ts"

const shellSource = readFileSync(
  new URL("../src/static/shell/shell.js", import.meta.url),
  "utf8"
)

const upstreamSchema = JSON.parse(
  readFileSync(
    new URL("../test/fixtures/ext-apps-schema.json", import.meta.url),
    "utf8"
  )
)
const ajv = new Ajv2020({ strict: false, allErrors: true })
addFormats(ajv)
const json = (value) => JSON.parse(JSON.stringify(value))

function validateWire(name, value) {
  const validate = ajv.compile(upstreamSchema.$defs[name])
  assert.ok(validate(value), JSON.stringify(validate.errors))
}

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
      head: {
        appendChild(element) {
          elements[element.id] = element
        },
      },
      createElement() {
        const element = new FakeElement()
        element.remove = () => {
          delete elements[element.id]
        }
        return element
      },
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
    document: context.document,
    elements,
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
  assert.equal(h.shell.isReady(), true)
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

test("emitted initialize, content arrays and height-only size match pinned upstream wire schemas", async () => {
  for (const [name, fixture] of Object.entries(wireFixtures))
    validateWire(name, fixture)
  const h = createHarness()
  await initialize(h)
  const init = h.messages.find((m) => m.method === "ui/initialize")
  validateWire("McpUiInitializeRequest", {
    method: init.method,
    params: init.params,
  })
  assert.equal("clientInfo" in init.params, false)
  const promise = h.shell.sendRequest("ui/message", {
    role: "user",
    content: [{ type: "text", text: "fixture" }],
  })
  const message = h.messages.at(-1)
  validateWire("McpUiMessageRequest", {
    method: message.method,
    params: message.params,
  })
  h.dispatch({ jsonrpc: "2.0", id: message.id, result: {} })
  await promise
  const size = h.messages.find(
    (m) => m.method === "ui/notifications/size-changed"
  )
  assert.ok(size)
  validateWire("McpUiSizeChangedNotification", {
    method: size.method,
    params: size.params,
  })
  assert.equal("id" in size, false)
  const validate = ajv.compile(upstreamSchema.$defs.McpUiMessageRequest)
  assert.equal(
    validate({
      method: "ui/message",
      params: { role: "user", content: { type: "text", text: "wrong" } },
    }),
    false
  )
})

test("extension display modes are recognized without leaking into the default declaration", async () => {
  const h = createHarness()
  await initialize(h)
  const init = h.messages.find((m) => m.method === "ui/initialize")

  // The default handshake stays inside the pinned upstream enum, so apps that
  // never opt in keep validating against the vendored oracle.
  assert.deepEqual(json(init.params.appCapabilities.availableDisplayModes), [
    "inline",
    "fullscreen",
    "pip",
  ])
  validateWire("McpUiInitializeRequest", {
    method: init.method,
    params: init.params,
  })

  // Opting in is deliberate, and such a handshake is knowingly off-spec.
  const optedIn = createHarness()
  optedIn.shell.initialize({
    availableDisplayModes: optedIn.shell.RECOGNIZED_DISPLAY_MODES,
  })
  const optedInInit = optedIn.messages.at(-1)
  assert.deepEqual(
    json(optedInInit.params.appCapabilities.availableDisplayModes),
    ["inline", "fullscreen", "pip", "split-right", "split-bottom", "standalone"]
  )
  const validate = ajv.compile(upstreamSchema.$defs.McpUiInitializeRequest)
  assert.equal(
    validate({
      method: optedInInit.method,
      params: optedInInit.params,
    }),
    false
  )

  // A host offering an extension mode grades as conformant, not off-spec.
  const cases = h.shell.generateTestCases(h.shell.hostContextSchema)
  const check = (context, path) =>
    h.shell.runTestCase(
      cases.find((t) => t.path === path),
      { hostContext: context }
    ).status
  for (const mode of h.shell.EXTENSION_DISPLAY_MODES) {
    assert.equal(
      check({ displayMode: mode }, "hostContext.displayMode"),
      "provided"
    )
    assert.equal(
      check(
        { availableDisplayModes: [mode] },
        "hostContext.availableDisplayModes"
      ),
      "provided"
    )
  }
  assert.equal(
    check({ displayMode: "modal" }, "hostContext.displayMode"),
    "invalid"
  )
})

test("setDisplayMode swaps recognized classes and ignores unrecognized modes", async () => {
  const h = createHarness()
  const has = (mode) => h.document.body.classList.contains("display-mode-" + mode)

  assert.equal(h.shell.setDisplayMode("standalone"), true)
  assert.ok(has("standalone"))
  assert.equal(h.shell.setDisplayMode("inline"), true)
  assert.ok(has("inline"))
  assert.ok(!has("standalone"), "leaving a mode must drop its class")

  // Host-supplied strings must never throw in classList.add or strip the
  // current layout; the grading schema reports them instead.
  for (const bad of ["modal", "full screen", "display-mode-pip"]) {
    assert.equal(h.shell.setDisplayMode(bad), false)
  }
  assert.ok(has("inline"), "an unrecognized mode leaves the current class")
  assert.ok(!has("modal"))

  // An empty mode is the explicit "no mode" reset.
  assert.equal(h.shell.setDisplayMode(""), true)
  assert.ok(!has("inline"))
})

test("a granted ui/request-display-mode response applies the body class and updates host context", async () => {
  const h = createHarness()
  await initialize(
    h,
    validInitializeResult({
      hostContext: {
        displayMode: "inline",
        availableDisplayModes: h.shell.RECOGNIZED_DISPLAY_MODES,
      },
    })
  )
  const has = (mode) => h.document.body.classList.contains("display-mode-" + mode)
  assert.ok(has("inline"))

  const granted = h.shell.sendRequest("ui/request-display-mode", {
    mode: "split-bottom",
  })
  const request = h.messages.at(-1)
  h.dispatch({ jsonrpc: "2.0", id: request.id, result: { mode: "split-bottom" } })
  assert.deepEqual(await granted, { mode: "split-bottom" })
  assert.ok(has("split-bottom"))
  assert.ok(!has("inline"))
  assert.equal(h.shell.getHostInfo().hostContext.displayMode, "split-bottom")

  // A host answering with a mode the bench does not recognize is recorded for
  // grading but must not throw or disturb the applied layout.
  const odd = h.shell.sendRequest("ui/request-display-mode", { mode: "pip" })
  h.dispatch({
    jsonrpc: "2.0",
    id: h.messages.at(-1).id,
    result: { mode: "full screen" },
  })
  assert.deepEqual(await odd, { mode: "full screen" })
  assert.ok(has("split-bottom"))
  assert.equal(h.shell.getHostInfo().hostContext.displayMode, "full screen")

  // Shapes without a string mode are passed through untouched.
  const declined = h.shell.sendRequest("ui/request-display-mode", { mode: "pip" })
  h.dispatch({ jsonrpc: "2.0", id: h.messages.at(-1).id, result: {} })
  assert.deepEqual(await declined, {})
  assert.ok(has("split-bottom"))
})

test("malformed style records stay inspectable instead of throwing during CSS injection", async () => {
  const h = createHarness()
  const variables = { "--font-sans": { toString: 0 } }
  await initialize(
    h,
    validInitializeResult({ hostContext: { styles: { variables } } })
  )
  assert.equal(h.shell.getConnectionState(), "initialized")
  const tests = h.shell.generateTestCases(h.shell.hostContextSchema)
  const recordTest = tests.find(
    (t) => t.path === "hostContext.styles.variables"
  )
  assert.equal(
    h.shell.runTestCase(recordTest, h.shell.getHostInfo()).status,
    "invalid"
  )
})

test("complete host containers, enums and array members are validated without primitive traversal crashes", () => {
  const h = createHarness()
  const cases = h.shell.generateTestCases(h.shell.hostContextSchema)
  const check = (context, path) =>
    h.shell.runTestCase(
      cases.find((t) => t.path === path),
      { hostContext: context }
    ).status
  for (const value of [false, "bad", [], null])
    assert.equal(check({ styles: value }, "hostContext.styles"), "invalid")
  assert.equal(
    check(
      { availableDisplayModes: ["inline", 7] },
      "hostContext.availableDisplayModes"
    ),
    "invalid"
  )
  assert.equal(check({ theme: "sepia" }, "hostContext.theme"), "invalid")
  assert.equal(
    check(
      { toolInfo: { tool: { name: "x" } } },
      "hostContext.toolInfo.tool.inputSchema"
    ),
    "missing"
  )
  assert.equal(
    check(
      { toolInfo: { tool: { inputSchema: { type: "array" } } } },
      "hostContext.toolInfo.tool.inputSchema.type"
    ),
    "invalid"
  )
  assert.equal(
    check({ containerDimensions: {} }, "hostContext.containerDimensions"),
    "provided"
  )
  assert.equal(
    h.shell.getValueByPath(
      { hostContext: { styles: false } },
      "hostContext.styles.css.fonts"
    ).found,
    false
  )
})

test("lifecycle fixtures retain ordered streaming, success, tool error and cancellation evidence", async () => {
  for (const terminal of [
    ["tool-result", { content: [{ type: "text", text: "success" }] }],
    [
      "tool-result",
      { content: [{ type: "text", text: "error" }], isError: true },
    ],
    ["tool-cancelled", { reason: "fixture cancellation" }],
  ]) {
    const h = createHarness()
    await initialize(h)
    for (const [method, params] of [
      ["tool-input-partial", { arguments: { q: "a" } }],
      ["tool-input", { arguments: { q: "abc" } }],
      terminal,
    ])
      h.dispatch({
        jsonrpc: "2.0",
        method: "ui/notifications/" + method,
        params,
      })
    const events = h.shell.getLifecycleEvents()
    assert.equal(events.length, 3)
    assert.ok(events.every((e) => e.problems.length === 0))
    assert.equal(events[2].params, terminal[1])
    assert.equal(h.shell.isReady(), true)
  }
  const h = createHarness()
  await initialize(h)
  for (const method of ["tool-result", "tool-input-partial"])
    h.dispatch({
      jsonrpc: "2.0",
      method: "ui/notifications/" + method,
      params: {},
    })
  assert.match(
    h.shell.getLifecycleEvents()[0].problems[0],
    /without required complete input/
  )
  assert.match(h.shell.getLifecycleEvents()[1].problems[0], /terminal/)
})

test("draft app tools route independently and are unavailable after teardown", async () => {
  const h = createHarness()
  let calls = 0
  const promise = h.shell.initialize({
    appCapabilities: { tools: { listChanged: true } },
    hostRequestHandlers: {
      "tools/list": () => {
        calls++
        return { tools: [] }
      },
    },
  })
  h.dispatch({
    jsonrpc: "2.0",
    id: h.messages.at(-1).id,
    result: validInitializeResult(),
  })
  await promise
  h.dispatch({ jsonrpc: "2.0", id: 92, method: "tools/list", params: {} })
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(calls, 1)
  assert.deepEqual(
    JSON.parse(JSON.stringify(h.messages.find((m) => m.id === 92).result)),
    { tools: [] }
  )
  h.dispatch({ jsonrpc: "2.0", id: 93, method: "ui/resource-teardown" })
  h.dispatch({ jsonrpc: "2.0", id: 94, method: "tools/list" })
  assert.equal(calls, 1)
})
