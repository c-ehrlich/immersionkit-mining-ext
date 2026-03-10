export async function fetchAsBase64(
  url: string,
  mediaType: "image" | "audio",
): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Media fetch failed (${response.status})`);
  }

  const buffer = await response.arrayBuffer();
  validateMediaResponse(url, mediaType, response.headers.get("content-type"), buffer);
  return arrayBufferToBase64(buffer);
}

export async function canFetchMedia(
  url: string,
  mediaType: "image" | "audio",
): Promise<boolean> {
  const response = await fetch(url);
  if (!response.ok) {
    return false;
  }

  const buffer = await response.arrayBuffer();
  try {
    validateMediaResponse(url, mediaType, response.headers.get("content-type"), buffer);
    return true;
  } catch {
    return false;
  }
}

function validateMediaResponse(
  url: string,
  mediaType: "image" | "audio",
  contentType: string | null,
  buffer: ArrayBuffer,
): void {
  const normalizedContentType = (contentType ?? "").toLowerCase();
  const isExpectedContentType =
    mediaType === "image"
      ? normalizedContentType.startsWith("image/")
      : normalizedContentType.startsWith("audio/");

  const isGenericBinary = normalizedContentType.includes("octet-stream");
  const minimumSize = mediaType === "audio" ? 1024 : 512;

  if (
    normalizedContentType &&
    !isExpectedContentType &&
    !isGenericBinary
  ) {
    throw new Error(
      `Unexpected ${mediaType} content type "${normalizedContentType}" from ${url}`,
    );
  }

  if (buffer.byteLength < minimumSize) {
    throw new Error(
      `Downloaded ${mediaType} file was too small (${buffer.byteLength} bytes) from ${url}`,
    );
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}
