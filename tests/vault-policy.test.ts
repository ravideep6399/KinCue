import assert from "node:assert/strict";
import test from "node:test";
import {
  buildVaultStoragePath,
  isAllowedVaultContentType,
  isValidVaultId,
  isVaultStoragePath,
  maximumVaultFileSize,
} from "../src/storage/vault-policy.ts";

test("accepts only expected Vault content types", () => {
  assert.equal(isAllowedVaultContentType("image/jpeg"), true);
  assert.equal(isAllowedVaultContentType("audio/mpeg"), true);
  assert.equal(isAllowedVaultContentType("application/pdf"), true);
  assert.equal(isAllowedVaultContentType("text/html"), false);
  assert.equal(isAllowedVaultContentType("application/javascript"), false);
});

test("builds one family-scoped path with a sanitized file name", () => {
  const path = buildVaultStoragePath("space_123", "document-456", "../../Care plan (final).pdf");

  assert.equal(
    path,
    "familySpaces/space_123/documents/document-456/Care_plan_final_.pdf",
  );
  assert.equal(isVaultStoragePath("space_123", "document-456", path), true);
});

test("accepts canonical Vault paths and rejects traversal or cross-family paths", () => {
  const path = buildVaultStoragePath("space123", "document456", "care-plan.pdf");

  assert.equal(isVaultStoragePath("space123", "document456", path), true);
  assert.equal(isVaultStoragePath("anotherSpace", "document456", path), false);
  assert.equal(isVaultStoragePath("space123", "document456", `${path}/extra`), false);
  assert.equal(isVaultStoragePath("space123", "document456", path.replace("care-plan", "..")), false);
});

test("rejects identifiers that could change Firestore or object path structure", () => {
  assert.equal(isValidVaultId("abc_DEF-123"), true);
  assert.equal(isValidVaultId("../family"), false);
  assert.equal(isValidVaultId("family/member"), false);
  assert.equal(isValidVaultId(""), false);
  assert.equal(maximumVaultFileSize, 10 * 1024 * 1024);
});
