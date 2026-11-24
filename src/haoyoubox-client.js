const DEFAULT_ORIGIN = "https://www.haoyoubox.com";

export class HaoyouBoxError extends Error {
  constructor(message, { code = "haoyoubox_request_failed", status } = {}) {
    super(message);
    this.name = "HaoyouBoxError";
    this.code = code;
    if (status) this.status = status;
  }
}

export class HaoyouBoxClient {
  constructor({
    token,
    fetch = globalThis.fetch,
    origin = DEFAULT_ORIGIN,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  }) {
    if (typeof token !== "string" || !token)
      throw new HaoyouBoxError("Authorize HaoyouBox before publishing.", {
        code: "auth_required",
      });
    this.token = token;
    this.fetch = fetch;
    this.origin = new URL(origin).origin;
    this.sleep = sleep;
  }

  reserve(file, idempotencyKey) {
    return this.request("/api/agent/v1/uploads", {
      method: "POST",
      json: {
        path: file.path,
        name: file.name,
        size: file.size,
        sha256: file.sha256,
      },
      idempotencyKey,
    });
  }

  putOriginal(versionId, operationId, file, idempotencyKey) {
    return this.request(`/api/agent/v1/uploads/${versionId}/file`, {
      method: "PUT",
      body: file.bytes,
      headers: fileHeaders(file),
      idempotencyKey,
      operationId,
    });
  }

  putRenderedHtml(versionId, operationId, file, idempotencyKey) {
    return this.request(`/api/agent/v1/uploads/${versionId}/rendered`, {
      method: "PUT",
      body: file.bytes,
      headers: {
        ...fileHeaders(file),
        "X-Onepage-Source-Sha256": file.sha256,
      },
      idempotencyKey,
      operationId,
    });
  }

  putRenderedMarkdown(versionId, operationId, locale, idempotencyKey) {
    return this.request(`/api/agent/v1/uploads/${versionId}/rendered`, {
      method: "PUT",
      json: { locale },
      idempotencyKey,
      operationId,
    });
  }

  complete(versionId, operationId, entry, idempotencyKey) {
    return this.request(`/api/agent/v1/uploads/${versionId}/complete`, {
      method: "POST",
      json: { entry },
      idempotencyKey,
      operationId,
    });
  }

  publish(versionId, operationId, idempotencyKey) {
    return this.request(`/api/agent/v1/uploads/${versionId}/publish`, {
      method: "POST",
      json: {},
      idempotencyKey,
      operationId,
    });
  }

  share(versionId, operationId, input, idempotencyKey, { retryNetwork = false } = {}) {
    return this.request(`/api/agent/v1/uploads/${versionId}/share`, {
      method: "POST",
      json: input,
      idempotencyKey,
      operationId,
      headers: retryNetwork ? { "X-HaoyouBox-Share-Replay": "1" } : undefined,
      retryNetwork,
    });
  }

  operation(operationId, idempotencyKey) {
    return this.request(`/api/agent/v1/operations/${operationId}`, {
      method: "GET",
      idempotencyKey,
      recover: false,
    });
  }

  async request(path, options) {
    const {
      method,
      json,
      body,
      headers = {},
      idempotencyKey,
      operationId,
      recover = true,
      retryNetwork = true,
    } = options;
    const requestHeaders = new Headers(headers);
    requestHeaders.set("Authorization", `Bearer ${this.token}`);
    if (idempotencyKey)
      requestHeaders.set("Idempotency-Key", idempotencyKey);
    let requestBody = body;
    if (json !== undefined) {
      requestHeaders.set("Content-Type", "application/json");
      requestBody = JSON.stringify(json);
    }

    for (let attempt = 0; attempt < 2; attempt += 1) {
      let response;
      try {
        response = await this.fetch(new URL(path, this.origin), {
          method,
          headers: requestHeaders,
          ...(requestBody === undefined ? {} : { body: requestBody }),
        });
      } catch {
        if (attempt === 0 && retryNetwork) continue;
        if (recover && operationId) {
          const status = await this.safeOperation(operationId, idempotencyKey);
          throw new HaoyouBoxError(
            `The publish request outcome is uncertain. Current operation state: ${status}.`,
            { code: "publish_state_unknown" },
          );
        }
        throw new HaoyouBoxError("Cannot reach HaoyouBox. Retry the same publish.", {
          code: "network_unavailable",
        });
      }

      const result = await safeJson(response);
      if (response.status === 429 && attempt === 0) {
        await this.sleep(retryDelay(response.headers.get("Retry-After")));
        continue;
      }
      if (!response.ok)
        throw new HaoyouBoxError(
          typeof result?.error === "string"
            ? result.error
            : "HaoyouBox rejected the publish request.",
          {
            code: result?.code || "haoyoubox_request_failed",
            status: response.status,
          },
        );
      return result;
    }
    throw new HaoyouBoxError("HaoyouBox did not complete the request.");
  }

  async safeOperation(operationId, idempotencyKey) {
    try {
      const result = await this.operation(operationId, idempotencyKey);
      return result?.operation?.state || "unknown";
    } catch {
      return "unknown";
    }
  }
}

function fileHeaders(file) {
  return {
    "Content-Type": "application/octet-stream",
    "X-Onepage-Path": Buffer.from(file.path, "utf8").toString("base64url"),
    "X-Onepage-Kind": file.kind,
    "X-Onepage-Type": file.type,
    "X-Onepage-Size": String(file.size),
    "X-Onepage-Sha256": file.sha256,
  };
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function retryDelay(value) {
  if (!value) return 1000;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? 1000 : Math.max(0, date - Date.now());
}
