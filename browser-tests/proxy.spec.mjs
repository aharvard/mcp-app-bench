import { test, expect } from "@playwright/test"
import http from "node:http"
import { readFileSync } from "node:fs"
const shell = readFileSync(
  new URL("../src/static/shell/shell.js", import.meta.url),
  "utf8"
)
test("double-iframe sandbox proxy lifecycle forwards only its trusted peers", async ({
  page,
}) => {
  const appHtml =
    '<body><p id="host-info-subtitle"></p><script>' +
    shell +
    '</script><script>MCPAppShell.initialize({clientName:"Proxy fixture"})</script>'
  const server = http.createServer((req, res) => {
    res.setHeader("Content-Type", "text/html")
    if (req.url === "/proxy") {
      res.end(`<!doctype html><iframe id="inner" sandbox="allow-scripts"></iframe><script>
        const inner=document.getElementById('inner');
        addEventListener('message',e=>{
          if(e.source===parent){if(e.data.method==='ui/notifications/sandbox-resource-ready'){inner.srcdoc=e.data.params.html;}else inner.contentWindow.postMessage(e.data,'*')}
          else if(e.source===inner.contentWindow)parent.postMessage(e.data,'*');
        });
        parent.postMessage({jsonrpc:'2.0',method:'ui/notifications/sandbox-proxy-ready',params:{}},'*');
      </script>`)
      return
    }
    res.end(`<!doctype html><iframe id="proxy" src="/proxy"></iframe><script>
      window.messages=[];const proxy=document.getElementById('proxy');
      window.send=data=>proxy.contentWindow.postMessage(data,'*');
      addEventListener('message',e=>{if(e.source!==proxy.contentWindow)return;messages.push(e.data);
        if(e.data.method==='ui/notifications/sandbox-proxy-ready')send({jsonrpc:'2.0',method:'ui/notifications/sandbox-resource-ready',params:{html:${JSON.stringify(appHtml).replaceAll("<", "\\u003c")},sandbox:'allow-scripts'}});
        if(e.data.method==='ui/initialize')send({jsonrpc:'2.0',id:e.data.id,result:{protocolVersion:'2026-01-26',hostInfo:{name:'Proxy harness',version:'1'},hostCapabilities:{},hostContext:{}}});
      });
    </script>`)
  })
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  try {
    await page.goto("http://127.0.0.1:" + server.address().port)
    await expect
      .poll(() =>
        page.evaluate(() =>
          messages.some((m) => m.method === "ui/notifications/initialized")
        )
      )
      .toBe(true)
    expect(await page.evaluate(() => messages[0].method)).toBe(
      "ui/notifications/sandbox-proxy-ready"
    )
    await page.evaluate(() =>
      send({ jsonrpc: "2.0", method: "ui/resource-teardown", id: 99 })
    )
    await expect
      .poll(() =>
        page.evaluate(() => messages.some((m) => m.id === 99 && "result" in m))
      )
      .toBe(true)
    const inner = page.frames().find((f) => f.url() === "about:srcdoc")
    expect(await inner.evaluate(() => MCPAppShell.getConnectionState())).toBe(
      "closed"
    )
    expect(
      await inner.evaluate(() => {
        try {
          void parent.document
          return false
        } catch {
          return true
        }
      })
    ).toBe(true)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})
