#!/usr/bin/env node

import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { authorizeDevice } from "../src/auth.js";
import { createServer } from "../src/server.js";

const command = process.argv[2] || "serve";

if (command === "auth") {
  try {
    await authorizeDevice();
  } catch (error) {
    process.stderr.write(
      `${error?.code || "authorization_failed"}: ${error?.message || "HaoyouBox authorization failed."}\n`,
    );
    process.exitCode = 1;
  }
} else if (command === "serve") {
  const handle = serveStdio(() => createServer());
  process.stderr.write("HaoyouBox MCP server running on stdio.\n");
  const close = () => {
    void handle.close().finally(() => process.exit(0));
  };
  process.once("SIGINT", close);
  process.once("SIGTERM", close);
} else {
  process.stderr.write(
    "Usage: haoyoubox-mcp [serve|auth]\n",
  );
  process.exitCode = 2;
}
