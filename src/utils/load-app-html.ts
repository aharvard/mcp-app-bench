import { readFileSync } from "fs"
import { fileURLToPath } from "url"
import { dirname, join } from "path"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export function loadAppHtml(appName: string): string {
  const assetsDir = join(__dirname, "..", "static")
  const htmlFile = `${appName}.html`
  const assetsPath = join(assetsDir, htmlFile)
  return readFileSync(assetsPath, "utf-8")
}
