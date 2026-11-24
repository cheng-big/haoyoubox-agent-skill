import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { publishFile } from "./publish-file.js";
import { OPERATION_KEY } from "./publish-recovery.js";

const inputSchema = z.object({
  path: z
    .string()
    .min(1)
    .describe("Explicit path to one local HTML or Markdown file"),
  operationKey: z.string().regex(OPERATION_KEY).optional()
    .describe("Choose one random lowercase UUID v4 for this publish. On interruption, use the same key, approved token, file and options."),
  locale: z
    .enum(["en", "zh"])
    .optional()
    .describe("Receiver interface language; inferred locally when omitted"),
  expiryHours: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe("Share duration in hours; the service returns the actual expiry"),
  password: z
    .string()
    .min(6)
    .max(128)
    .optional()
    .describe("Optional local share password; generated locally when omitted"),
});

const outputSchema = z.object({
  shareUrl: z.string().url(),
  password: z.string(),
  expiresAt: z.number(),
  versionId: z.string(),
  publishStatus: z.literal("shared").optional(),
  verification: z.object({ status: z.literal("not_run") }).optional(),
});

export function createServer({ publish = publishFile } = {}) {
  const server = new McpServer({ name: "haoyoubox-mcp", version: "1.0.0" });
  server.registerTool(
    "publish_file",
    {
      title: "Publish file to HaoyouBox",
      description:
        "Create an expiring, password-protected HaoyouBox browser link for one local HTML prototype, playable demo, interactive report, or Markdown document. Use after the user authorizes publishing that exact file through HaoyouBox. Route ZIP bundles with local assets to the browser workspace and keep local previews on the device.",
      inputSchema,
      outputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
      },
    },
    async (input) => {
      try {
        const result = await publish(input);
        const expires = new Date(result.expiresAt).toISOString();
        return {
          content: [
            {
              type: "text",
              text: [
                result.shareUrl,
                `Access password: ${result.password}`,
                `Expires: ${expires}`,
                `Version: ${result.versionId}`,
                "Receiver page verification: not run",
              ].join("\n"),
            },
          ],
          structuredContent: {
            ...result,
            publishStatus: "shared",
            verification: { status: "not_run" },
          },
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: safeToolError(error) }],
          isError: true,
        };
      }
    },
  );
  return server;
}

function safeToolError(error) {
  const code = typeof error?.code === "string" ? error.code : "publish_failed";
  const known = new Set([
    "auth_required",
    "agent_token_invalid",
    "agent_token_missing",
    "agent_token_revoked",
    "agent_token_expired",
    "agent_scope_denied",
    "account_restricted",
    "file_required",
    "file_not_found",
    "file_symlink",
    "file_not_regular",
    "file_hidden",
    "file_type_unsupported",
    "file_empty",
    "file_changed",
    "file_too_large",
    "file_local_dependency",
    "file_backend_dependency",
    "limits_unavailable",
    "locale_invalid",
    "password_invalid",
    "expiry_invalid",
    "network_unavailable",
    "publish_state_unknown",
    "share_incomplete",
    "operation_key_invalid",
    "publish_inputs_changed",
    "publish_recovery_expired",
    "share_recovery_unavailable",
    "agent_share_replay_unavailable",
  ]);
  const message = known.has(code) && typeof error?.message === "string"
    ? error.message
    : "HaoyouBox could not confirm this publish.";
  const retry = OPERATION_KEY.test(error?.operationKey) ? ` Resume using operationKey ${error.operationKey} with the same file, options and publish token.` : "";
  return `${code}: ${message}${retry}`.replace(
    /hb_pub_[a-f0-9]{24}_[A-Za-z0-9_-]{20,}/g,
    "[redacted-token]",
  );
}
