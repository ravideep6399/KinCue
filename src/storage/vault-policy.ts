export const maximumVaultFileSize = 10 * 1024 * 1024;
export const maximumVaultRequestSize = maximumVaultFileSize + 64 * 1024;

const vaultIdPattern = /^[A-Za-z0-9_-]{1,128}$/;
const allowedVaultContentType = /^(image\/|audio\/|application\/pdf$)/;

export function isValidVaultId(value: string) {
  return vaultIdPattern.test(value);
}

export function isAllowedVaultContentType(value: string) {
  return allowedVaultContentType.test(value);
}

export function sanitizeVaultFileName(value: string) {
  const safe = value
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/\.{2,}/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[_.-]+/, "")
    .slice(-180);
  return safe || "file";
}

export function buildVaultStoragePath(spaceId: string, documentId: string, fileName: string) {
  if (!isValidVaultId(spaceId) || !isValidVaultId(documentId)) {
    throw new Error("The Vault path contains an invalid identifier.");
  }
  return `familySpaces/${spaceId}/documents/${documentId}/${sanitizeVaultFileName(fileName)}`;
}

export function isVaultStoragePath(spaceId: string, documentId: string, value: unknown) {
  if (!isValidVaultId(spaceId) || !isValidVaultId(documentId) || typeof value !== "string") {
    return false;
  }
  return value.startsWith(`familySpaces/${spaceId}/documents/${documentId}/`) &&
    !value.includes("..") &&
    value.split("/").length === 5;
}
