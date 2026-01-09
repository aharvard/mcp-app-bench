import { readFileSync } from "fs"
import { fileURLToPath } from "url"
import { dirname, join } from "path"
import { BASE_URL } from "./constants.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export function loadAppHtml(appName: string): string {
  const staticDir = join(__dirname, "..", "static")
  const htmlFile = `${appName}.html`
  const htmlPath = join(staticDir, htmlFile)

  let html = readFileSync(htmlPath, "utf-8")

  // Replace BASE_URL placeholder with actual value
  html = html.replace(/\{\{BASE_URL\}\}/g, BASE_URL)

  return html
}
