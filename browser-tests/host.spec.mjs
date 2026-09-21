import { test, expect } from "@playwright/test"
import http from "node:http"
import { readFileSync } from "node:fs"

const root = new URL("../src/static/", import.meta.url)
const shell = readFileSync(new URL("shell/shell.js", root), "utf8")
let host, fixtures, origin, fixtureOrigin
const listen = (server) =>
  new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () =>
      resolve("http://127.0.0.1:" + server.address().port)
    )
  )
test.beforeAll(async () => {
  fixtures = http.createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*")
    const files = {
      "/fixtures/download.txt": "text/plain",
      "/fixtures/pixel.svg": "image/svg+xml",
      "/fixtures/frame.html": "text/html",
    }
    const mime = files[req.url]
    if (!mime) {
      res.writeHead(404).end()
      return
    }
    res.setHeader("Content-Type", mime)
    res.end(readFileSync(new URL(req.url.slice(1), root)))
  })
  fixtureOrigin = await listen(fixtures)
  host = http.createServer((req, res) => {
    res.setHeader("Content-Type", "text/html")
    if (req.url.startsWith("/app")) {
      const params = new URL(req.url, "http://local").searchParams
      const name = params.get("name") || "tool-data"
      if (
        ![
          "tool-data",
          "host-info",
          "host-styles",
          "display-modes",
          "display-modes-inline-fullscreen",
          "security",
          "audit",
        ].includes(name)
      ) {
        res.writeHead(404).end()
        return
      }
      let html = readFileSync(new URL(name + ".html", root), "utf8")
      html = html
        .replaceAll("{{SHELL_INLINE}}", () => shell)
        .replace(
          /<script src="[^\"]*shell\/shell.js[^\"]*"><\/script>/g,
          () => "<script>" + shell + "</script>"
        )
        .replace(
          /<script src="[^\"]*shell\/audit.js[^\"]*"><\/script>/g,
          () =>
            "<script>" +
            readFileSync(new URL("shell/audit.js", root), "utf8") +
            "</script>"
        )
        .replaceAll("{{BASE_URL}}", fixtureOrigin)
        .replaceAll("{{POLICY}}", params.get("policy") || "declared")
        .replaceAll(
          "{{PROFILE}}",
          params.get("policy") === "draft" ? "draft" : "stable"
        )
      // Remove internet font dependencies: test the app, not a CDN's availability.
      html = html.replace(/<link[^>]*>/g, "")
      const allowed =
        params.get("policy") === "omitted" ? "'none'" : fixtureOrigin
      res.setHeader(
        "Content-Security-Policy",
        `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src ${allowed}; img-src ${allowed}; frame-src ${allowed}; base-uri ${params.get("policy") === "omitted" ? "'self'" : fixtureOrigin}`
      )
      res.setHeader(
        "Permissions-Policy",
        "camera=(), microphone=(), geolocation=(), clipboard-write=()"
      )
      res.end(html)
      return
    }
    res.end(`<!doctype html><body><iframe id="app" sandbox="allow-scripts" style="width:600px;height:300px"></iframe><script>
      window.messages=[]; window.context={}; window.responses={};
      window.send=(method,params)=>document.getElementById('app').contentWindow.postMessage({jsonrpc:'2.0',method,params},'*');
      addEventListener('message',e=>{if(e.source!==document.getElementById('app').contentWindow)return;messages.push(e.data);if(e.data.method==='ui/initialize')e.source.postMessage({jsonrpc:'2.0',id:e.data.id,result:{protocolVersion:'2026-01-26',hostInfo:{name:'Controlled harness',version:'1'},hostCapabilities:{},hostContext:context}},'*');else if(e.data.method in responses && 'id' in e.data)e.source.postMessage({jsonrpc:'2.0',id:e.data.id,result:responses[e.data.method]},'*')});
    </script>`)
  })
  origin = await listen(host)
})
test.afterAll(async () => {
  await Promise.all(
    [host, fixtures].map((s) => new Promise((resolve) => s.close(resolve)))
  )
})
async function open(
  page,
  name = "tool-data",
  context = {},
  policy = "declared"
) {
  await page.goto(origin)
  await page.evaluate(
    ({ name, context, policy }) => {
      window.context = context
      document.getElementById("app").src =
        "/app?name=" + name + "&policy=" + policy
    },
    { name, context, policy }
  )
  const frame = page.frameLocator("#app")
  await expect
    .poll(() =>
      page.evaluate(() =>
        messages.some((m) => m.method === "ui/notifications/initialized")
      )
    )
    .toBe(true)
  return frame
}
test("audit outcomes distinguish absence, isError and model-only success; draft stays separate", async ({
  page,
}) => {
  const frame = await open(page, "audit")
  await frame.getByText("Call visibility-both", { exact: true }).click()
  await expect(frame.locator("#results")).toContainText("unsupported")
  expect(
    await page.evaluate(
      () => messages.filter((m) => m.method === "tools/call").length
    )
  ).toBe(0)
  await expect(
    frame.getByText("Download embedded text", { exact: true })
  ).toHaveCount(0)
  await frame.locator("#negative").check()
  await frame.getByText("Send log notification", { exact: true }).click()
  await expect
    .poll(() =>
      page.evaluate(() =>
        messages.some((m) => m.method === "notifications/message")
      )
    )
    .toBe(true)
  const log = await page.evaluate(() =>
    messages.find((m) => m.method === "notifications/message")
  )
  expect(log).not.toHaveProperty("id")
  await page.evaluate(
    () =>
      (responses["tools/call"] = {
        isError: true,
        content: [{ type: "text", text: "denied" }],
      })
  )
  await frame.getByText("Call visibility-model-only", { exact: true }).click()
  await expect(frame.locator("#results")).toContainText("tool-error")
  await page.evaluate(
    () =>
      (responses["tools/call"] = {
        content: [{ type: "text", text: "executed" }],
      })
  )
  await frame.getByText("Call visibility-model-only", { exact: true }).click()
  await expect(frame.locator("#results")).toContainText(
    "FAIL: model-only tool executed"
  )
  const draft = await open(page, "audit", {}, "draft")
  await expect(
    draft.getByText("Download embedded text", { exact: true })
  ).toHaveCount(1)
  await draft.getByText("Sampling with tools", { exact: true }).click()
  await expect(draft.locator("#results")).toContainText("sampling.tools")
  expect(
    await page.evaluate(
      () => messages.filter((m) => m.method === "sampling/createMessage").length
    )
  ).toBe(0)
})
test("Host Info grades malformed and missing required values without penalizing optional absence", async ({
  page,
}) => {
  let frame = await open(page, "host-info", {})
  await expect(frame.locator(".test-grade-circle").first()).toHaveText("A")
  frame = await open(page, "host-info", { styles: false })
  await expect(frame.locator(".test-grade-circle").first()).toHaveText("F")
  frame = await open(page, "host-info", {
    toolInfo: { tool: { name: "fixture" } },
  })
  await expect(frame.locator(".test-grade-circle").first()).toHaveText("F")
})

test("diagnostics render before result, then show cancellation reason and order", async ({
  page,
}) => {
  const frame = await open(page)
  await expect(frame.locator("#app-content")).toHaveClass(/is-ready/)
  await page.evaluate(() => {
    send("ui/notifications/tool-input-partial", { arguments: { q: "a" } })
    send("ui/notifications/tool-cancelled", { reason: "cancel fixture" })
  })
  await expect(frame.locator("#app-content")).toContainText("cancel fixture")
  await expect(frame.locator("#app-content")).toContainText("sequence")
})
test("fixed, maximum and unbounded axes update independently and permit scrolling", async ({
  page,
}) => {
  await open(page)
  for (const height of [{ height: 120 }, { maxHeight: 180 }, {}])
    for (const width of [{ width: 240 }, { maxWidth: 300 }, {}]) {
      const dims = { ...height, ...width }
      await page.evaluate(
        (dims) =>
          send("ui/notifications/host-context-changed", {
            containerDimensions: dims,
          }),
        dims
      )
      const frame = page.frames().find((f) => f.url().includes("/app"))
      await expect
        .poll(() =>
          frame.evaluate(() => {
            const s = document.documentElement.style
            return [s.height, s.maxHeight, s.width, s.maxWidth, s.overflow]
          })
        )
        .toEqual([
          height.height ? "120px" : "",
          height.maxHeight ? "180px" : "",
          width.width ? "240px" : "",
          width.maxWidth ? "300px" : "",
          "auto",
        ])
    }
  const appFrame = page.frames().find((f) => f.url().includes("/app"))
  await appFrame.evaluate(() => {
    const spacer = document.createElement("div")
    spacer.style.height = "1000px"
    document.body.append(spacer)
    const button = document.createElement("button")
    button.id = "bottom-probe"
    button.textContent = "Bottom"
    button.onclick = () => (button.textContent = "Reached")
    document.body.append(button)
  })
  await page.frameLocator("#app").locator("#bottom-probe").click()
  await expect(page.frameLocator("#app").locator("#bottom-probe")).toHaveText(
    "Reached"
  )
})
test("font CSS replaces and removes, including fonts-only updates", async ({
  page,
}) => {
  const frame = await open(page, "host-styles", {
    styles: { css: { fonts: ".font-fixture { font-family: serif; }" } },
  })
  await expect(frame.locator("#host-font-css")).toHaveJSProperty(
    "textContent",
    ".font-fixture { font-family: serif; }"
  )
  await page.evaluate(() =>
    send("ui/notifications/host-context-changed", {
      styles: { css: { fonts: ".replacement { font-family: monospace; }" } },
    })
  )
  await expect(frame.locator("#host-font-css")).toHaveCount(1)
  await expect(frame.locator("#host-font-css")).toHaveJSProperty(
    "textContent",
    ".replacement { font-family: monospace; }"
  )
  await page.evaluate(() =>
    send("ui/notifications/host-context-changed", { styles: {} })
  )
  await expect(frame.locator("#host-font-css")).toHaveCount(0)
})
test("normal unsupported display modes cannot be clicked; explicit negative probe is separate", async ({
  page,
}) => {
  const frame = await open(page, "display-modes-inline-fullscreen", {
    availableDisplayModes: ["inline", "pip"],
  })
  await expect(frame.locator("#btn-mode-fullscreen")).toBeDisabled()
  await expect(frame.locator("#btn-mode-pip")).toBeDisabled()
  await expect(frame.locator("#btn-mode-inline")).toBeEnabled()
  await frame
    .getByText("Negative probe: request unsupported mode", { exact: true })
    .click()
  await expect
    .poll(() =>
      page.evaluate(() =>
        messages.some((m) => m.method === "ui/request-display-mode")
      )
    )
    .toBe(true)
})
test("extension display modes are requestable only when the host offers them", async ({
  page,
}) => {
  // A host that offers no extension mode: the buttons exist but stay inert.
  const specOnly = await open(page, "display-modes", {
    displayMode: "inline",
    availableDisplayModes: ["inline", "fullscreen", "pip"],
  })
  for (const mode of ["split-right", "split-bottom", "standalone"])
    await expect(specOnly.locator("#btn-mode-" + mode)).toBeDisabled()
  await expect(specOnly.locator("#btn-mode-fullscreen")).toBeEnabled()

  // A host that does offer them: the request goes out and the granted mode is
  // reflected in state and in the body class the CSS keys off.
  const frame = await open(page, "display-modes", {
    displayMode: "inline",
    availableDisplayModes: ["inline", "split-right", "standalone"],
  })
  await expect(frame.locator("#btn-mode-split-bottom")).toBeDisabled()
  await expect(frame.locator("#btn-mode-split-right")).toBeEnabled()

  await page.evaluate(
    () => (responses["ui/request-display-mode"] = { mode: "split-right" })
  )
  await frame.locator("#btn-mode-split-right").click()

  await expect
    .poll(() =>
      page.evaluate(() => {
        const m = messages.find((m) => m.method === "ui/request-display-mode")
        return m && m.params.mode
      })
    )
    .toBe("split-right")
  await expect(frame.locator("#dm-current-mode")).toHaveText("split-right")
  await expect(frame.locator("body")).toHaveClass(/display-mode-split-right/)

  // Moving to another granted mode swaps the class rather than stacking it.
  await page.evaluate(
    () => (responses["ui/request-display-mode"] = { mode: "standalone" })
  )
  await frame.locator("#btn-mode-standalone").click()
  await expect(frame.locator("#dm-current-mode")).toHaveText("standalone")
  await expect(frame.locator("body")).toHaveClass(/display-mode-standalone/)
  await expect(frame.locator("body")).not.toHaveClass(/display-mode-split-right/)
})
for (const policy of ["declared", "omitted"])
  test("real CSP and DOM isolation: " + policy, async ({ page }) => {
    const frame = await open(page, "security", {}, policy)
    await frame.locator("#network").click()
    await frame.locator("#isolation").click()
    await expect(frame.locator("#results")).toContainText(
      "observed DOM isolation"
    )
    if (policy === "declared") {
      for (const text of [
        "observed fixture",
        "observed load",
        "observed execution",
        "observed applied",
      ])
        await expect(frame.locator("#results")).toContainText(text)
    } else {
      for (const directive of [
        "connect-src",
        "img-src",
        "frame-src",
        "base-uri",
      ])
        await expect(frame.locator("#results")).toContainText(
          '"directive": "' + directive + '"'
        )
      await expect(frame.locator("#results")).not.toContainText(
        "observed fixture"
      )
    }
    await frame.locator("#camera").click()
    await expect(frame.locator("#results")).toContainText(
      "denied or unavailable"
    )
  })
