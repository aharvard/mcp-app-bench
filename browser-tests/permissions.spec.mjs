import { test, expect } from "@playwright/test"
import http from "node:http"
import { readFileSync } from "node:fs"
const root = new URL("../src/static/", import.meta.url)
const shell = readFileSync(new URL("shell/shell.js", root), "utf8")
let appServer, hostServer, appOrigin, hostOrigin
const listen = (s) =>
  new Promise((resolve) =>
    s.listen(0, "127.0.0.1", () =>
      resolve("http://127.0.0.1:" + s.address().port)
    )
  )
test.beforeAll(async () => {
  appServer = http.createServer((req, res) => {
    res.setHeader("Content-Type", "text/html")
    const grant = req.url === "/grant"
    const value = grant ? "*" : "()"
    res.setHeader(
      "Permissions-Policy",
      `camera=${value}, microphone=${value}, geolocation=${value}, clipboard-write=${value}`
    )
    res.end(
      readFileSync(new URL("security.html", root), "utf8")
        .replaceAll("{{SHELL_INLINE}}", () => shell)
        .replaceAll("{{BASE_URL}}", appOrigin)
        .replaceAll("{{POLICY}}", grant ? "declared" : "omitted")
    )
  })
  appOrigin = await listen(appServer)
  hostServer = http.createServer((req, res) => {
    res.setHeader("Content-Type", "text/html")
    res.end(`<!doctype html><iframe id="app" sandbox="allow-scripts allow-same-origin" allow="camera *; microphone *; geolocation *; clipboard-write *" src="${appOrigin}${req.url}" style="width:800px;height:700px"></iframe><script>
      addEventListener('message',e=>{if(e.source!==document.getElementById('app').contentWindow)return;if(e.data.method==='ui/initialize')e.source.postMessage({jsonrpc:'2.0',id:e.data.id,result:{protocolVersion:'2026-01-26',hostInfo:{name:'Permission harness',version:'1'},hostCapabilities:{},hostContext:{}}},'*')})
    </script>`)
  })
  hostOrigin = await listen(hostServer)
})
test.afterAll(async () => {
  await Promise.all(
    [hostServer, appServer].map(
      (s) => new Promise((resolve) => s.close(resolve))
    )
  )
})
for (const policy of ["grant", "deny"])
  test(
    "permission policy " + policy + " with synthetic devices",
    async ({ page, context }) => {
      await context.grantPermissions(["camera", "microphone", "geolocation"], {
        origin: appOrigin,
      })
      await context.grantPermissions(["geolocation"], { origin: hostOrigin })
      await context.setGeolocation({ latitude: 0, longitude: 0 })
      await page.goto(hostOrigin + "/" + policy)
      const frame = page.frameLocator("#app")
      await expect(frame.locator("#results")).toContainText("connected")
      for (const capability of ["camera", "microphone", "geolocation"]) {
        await frame.locator("#" + capability).click()
        await expect
          .poll(async () =>
            JSON.parse(await frame.locator("#results").textContent()).some(
              (r) => r.probe === capability
            )
          )
          .toBe(true)
        const record = JSON.parse(
          await frame.locator("#results").textContent()
        ).find((r) => r.probe === capability)
        expect(record.outcome, JSON.stringify(record)).toBe(
          policy === "grant"
            ? "observed granted"
            : "denied or unavailable — valid policy outcome"
        )
      }
      // Do not overwrite the user's OS clipboard during automated verification.
      const child = page.frames().find((f) => f.url().startsWith(appOrigin))
      expect(
        await child.evaluate(() =>
          document.featurePolicy.allowsFeature("clipboard-write")
        )
      ).toBe(policy === "grant")
      await frame.locator("#isolation").click()
      await expect(frame.locator("#results")).toContainText(
        "observed DOM isolation"
      )
    }
  )
