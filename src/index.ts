import { createHttpApp } from "./http-app.js"
import { PORT } from "./utils/constants.js"
import { logServerStarted } from "./utils/logger.js"

const { app, mcpHandler } = createHttpApp()

const httpServer = app.listen(Number(PORT), () => {
  logServerStarted(PORT)
})

let shuttingDown = false

async function shutdown() {
  if (shuttingDown) return
  shuttingDown = true

  await mcpHandler.close()
  httpServer.close((error) => {
    if (error) {
      console.error(error)
      process.exitCode = 1
    }
  })
}

process.once("SIGINT", () => void shutdown())
process.once("SIGTERM", () => void shutdown())
