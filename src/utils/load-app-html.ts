import { readFileSync } from "fs"
import { fileURLToPath } from "url"
import { dirname, join } from "path"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export function loadAppHtml(appName: string): string {
  // In dev mode (vite-node), __dirname is src/utils/
  // In production, __dirname is dist/utils/
  // Either way, go up to project root and then into dist/static/
  const projectRoot = join(__dirname, "..", "..")
  const assetsDir = join(projectRoot, "dist", "static")
  const htmlFile = `${appName}.html`
  const assetsPath = join(assetsDir, htmlFile)
  return readFileSync(assetsPath, "utf-8")
}
