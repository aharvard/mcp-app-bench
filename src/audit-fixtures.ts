import type { McpServer } from "@modelcontextprotocol/server"
import * as z from "zod/v4"
import { BASE_URL, MCP_APPS_MIME_TYPE } from "./utils/constants.js"
import { loadAppHtml } from "./utils/load-app-html.js"

/** Fixture expectations are documented in docs/conformance-profiles.md. */
export function registerAuditFixtures(server: McpServer) {
  for (const policy of ["declared", "omitted"]) {
    const uri = "ui://audit/security-" + policy
    server.registerResource(
      "audit-security-" + policy,
      uri,
      { mimeType: MCP_APPS_MIME_TYPE },
      async () => ({
        contents: [
          {
            uri,
            mimeType: MCP_APPS_MIME_TYPE,
            text: loadAppHtml("security").replaceAll("{{POLICY}}", policy),
            ...(policy === "declared"
              ? {
                  _meta: {
                    ui: {
                      csp: {
                        connectDomains: [BASE_URL],
                        resourceDomains: [BASE_URL],
                        frameDomains: [BASE_URL],
                        baseUriDomains: [BASE_URL],
                      },
                      permissions: {
                        camera: {},
                        microphone: {},
                        geolocation: {},
                        clipboardWrite: {},
                      },
                    },
                  },
                }
              : {}),
          },
        ],
      })
    )
    server.registerTool(
      "inspect-security-" + policy,
      {
        description:
          "Browser security probe with " +
          policy +
          " CSP/permissions. Permission probes run only on a user click.",
        inputSchema: z.object({}),
        _meta: { ui: { resourceUri: uri } },
      },
      async () => ({
        content: [{ type: "text", text: "Security fixture: " + policy }],
      })
    )
  }
  server.registerResource(
    "audit-inline-only",
    "ui://audit/inline-only",
    { mimeType: MCP_APPS_MIME_TYPE },
    async () => ({
      contents: [
        {
          uri: "ui://audit/inline-only",
          mimeType: MCP_APPS_MIME_TYPE,
          text: loadAppHtml("display-modes-undeclared")
            .replace(
              "var appDeclaredModes = undefined;",
              "var appDeclaredModes = ['inline'];"
            )
            .replace(
              "availableDisplayModes: null,",
              "availableDisplayModes: ['inline'],"
            )
            .replaceAll("Undeclared", "Inline only"),
          _meta: {
            ui: {
              csp: {
                resourceDomains: [
                  BASE_URL,
                  "https://fonts.googleapis.com",
                  "https://fonts.gstatic.com",
                ],
              },
            },
          },
        },
      ],
    })
  )
  server.registerTool(
    "inspect-display-modes-inline-only",
    {
      description:
        "Explicit inline-only declaration, separate from omitted display modes.",
      inputSchema: z.object({}),
      _meta: { ui: { resourceUri: "ui://audit/inline-only" } },
    },
    async () => ({
      content: [{ type: "text", text: "Inline-only display-mode fixture" }],
    })
  )
  const html = loadAppHtml("discovery")
  const cases = [
    { name: "text", text: html },
    { name: "blob", blob: Buffer.from(html).toString("base64") },
    { name: "malformed", text: "", mimeType: "application/json" },
    { name: "precedence", text: html },
  ]
  for (const fixture of cases) {
    const uri = "ui://audit/" + fixture.name
    server.registerResource(
      "audit-" + fixture.name,
      uri,
      {
        mimeType: MCP_APPS_MIME_TYPE,
        ...(fixture.name === "precedence"
          ? { _meta: { ui: { prefersBorder: true } } }
          : {}),
      },
      async () => ({
        contents: [
          {
            uri,
            mimeType: fixture.mimeType || MCP_APPS_MIME_TYPE,
            ...(fixture.text !== undefined
              ? { text: fixture.text }
              : { blob: fixture.blob! }),
            ...(fixture.name === "precedence"
              ? { _meta: { ui: { prefersBorder: false } } }
              : {}),
          },
        ],
      })
    )
  }
  for (const variant of [
    "text",
    "blob",
    "legacy",
    "missing",
    "malformed",
    "precedence",
  ]) {
    const uri = "ui://audit/" + (variant === "legacy" ? "text" : variant)
    server.registerTool(
      "audit-discovery-" + variant,
      {
        description:
          "Explicit discovery fixture: " +
          variant +
          ". Negative fixtures may fail to render. Precedence is a draft-profile check only.",
        inputSchema: z.object({}),
        _meta:
          variant === "legacy"
            ? { "ui/resourceUri": uri }
            : { ui: { resourceUri: uri } },
      },
      async () => ({
        content: [{ type: "text", text: "Discovery fixture: " + variant }],
      })
    )
  }
  for (const profile of ["stable", "draft"]) {
    const uri = "ui://audit/" + profile
    server.registerResource(
      "audit-" + profile,
      uri,
      { mimeType: MCP_APPS_MIME_TYPE },
      async () => ({
        contents: [
          {
            uri,
            mimeType: MCP_APPS_MIME_TYPE,
            text: loadAppHtml("audit").replaceAll("{{PROFILE}}", profile),
            _meta: { ui: { csp: { resourceDomains: [BASE_URL] } } },
          },
        ],
      })
    )
    server.registerTool(
      "inspect-audit-" + profile,
      {
        description:
          "Run " +
          profile +
          " MCP Apps audit probes. Results distinguish acknowledgement from verified host behavior.",
        inputSchema: z.object({}),
        _meta: { ui: { resourceUri: uri } },
      },
      async () => ({
        content: [{ type: "text", text: "Open " + profile + " audit probes." }],
      })
    )
  }
}
