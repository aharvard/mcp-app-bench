import { readFileSync } from "fs"
import { fileURLToPath } from "url"
import { dirname, join } from "path"
import { BASE_URL, CACHE_HASH } from "./constants.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export function loadAppHtml(appName: string): string {
  const staticDir = join(__dirname, "..", "static")
  const htmlFile = `${appName}.html`
  const htmlPath = join(staticDir, htmlFile)

  let html = readFileSync(htmlPath, "utf-8")

  // Replace placeholders with actual values
  html = html.replace(/\{\{BASE_URL\}\}/g, BASE_URL)
  html = html.replace(/\{\{CACHE_HASH\}\}/g, CACHE_HASH)
  // Self-contained CSP fixtures must not depend on an externally loaded shell.
  html = html.replace(/\{\{SHELL_INLINE\}\}/g, () =>
    readFileSync(join(staticDir, "shell", "shell.js"), "utf-8")
  )

  return html
}
