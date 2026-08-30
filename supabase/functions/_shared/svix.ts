const DEFAULT_TOLERANCE_SECONDS = 5 * 60;

function decodeBase64(value: string): Uint8Array {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function encodeBase64(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function timingSafeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

function secretBytes(secret: string): Uint8Array {
  if (!secret.startsWith("whsec_")) throw new Error("invalid_webhook_secret");
  return decodeBase64(secret.slice("whsec_".length));
}

async function hmacSha256(
  secret: string,
  content: string,
): Promise<Uint8Array> {
  const keyData = Uint8Array.from(secretBytes(secret)).buffer;
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(content),
  );
  return new Uint8Array(signature);
}

export interface SvixHeaders {
  id: string | null;
  signature: string | null;
  timestamp: string | null;
}

export async function verifySvixSignature(input: {
  headers: SvixHeaders;
  now: Date;
  payload: string;
  secret: string;
  toleranceSeconds?: number;
}): Promise<boolean> {
  const { id, signature, timestamp } = input.headers;
  if (!id || !signature || !timestamp || id.length > 256) return false;
  if (!/^\d+$/.test(timestamp)) return false;
  const timestampSeconds = Number(timestamp);
  const tolerance = input.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  if (
    !Number.isSafeInteger(timestampSeconds) ||
    Math.abs(Math.floor(input.now.getTime() / 1000) - timestampSeconds) >
      tolerance
  ) {
    return false;
  }

  let expected: Uint8Array;
  try {
    expected = await hmacSha256(
      input.secret,
      `${id}.${timestamp}.${input.payload}`,
    );
  } catch {
    return false;
  }

  for (const versionedSignature of signature.split(" ")) {
    const [version, encoded] = versionedSignature.split(",", 2);
    if (version !== "v1" || !encoded) continue;
    try {
      if (timingSafeEqual(expected, decodeBase64(encoded))) return true;
    } catch {
      // Continue so malformed alternatives do not expose verification details.
    }
  }
  return false;
}

export async function signSvixPayloadForTest(input: {
  id: string;
  payload: string;
  secret: string;
  timestamp: number;
}): Promise<string> {
  const signature = await hmacSha256(
    input.secret,
    `${input.id}.${input.timestamp}.${input.payload}`,
  );
  return `v1,${encodeBase64(signature)}`;
}
