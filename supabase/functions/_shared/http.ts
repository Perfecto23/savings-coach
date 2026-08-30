const JSON_HEADERS = {
  "cache-control": "no-store",
  "content-type": "application/json; charset=utf-8",
} as const;

function declaredBodyLength(request: Request): number | null {
  const value = request.headers.get("content-length")?.trim();
  if (!value || !/^\d+$/.test(value)) return null;
  const length = Number(value);
  return Number.isSafeInteger(length) ? length : Number.MAX_SAFE_INTEGER;
}

export async function readRequestBody(
  request: Request,
  maximumBytes: number,
): Promise<string | null> {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 0) {
    throw new Error("invalid_body_limit");
  }
  const declaredLength = declaredBodyLength(request);
  if (declaredLength !== null && declaredLength > maximumBytes) return null;

  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (totalBytes > maximumBytes - value.byteLength) {
        await reader.cancel().catch(() => {});
        return null;
      }
      chunks.push(value);
      totalBytes += value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  });
}

export function errorResponse(
  code: string,
  message: string,
  status: number,
  allow?: string,
): Response {
  const headers = new Headers(JSON_HEADERS);
  if (allow) headers.set("allow", allow);
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers,
  });
}

export function methodNotAllowed(allow: string): Response {
  return errorResponse(
    "method_not_allowed",
    "Method not allowed.",
    405,
    allow,
  );
}

export function emptyResponse(status = 200): Response {
  return new Response(null, {
    status,
    headers: {
      "cache-control": "no-store",
      "content-length": "0",
    },
  });
}
