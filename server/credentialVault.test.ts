import { describe, expect, it } from "vitest";
import { decryptProviderCredential, encryptProviderCredential, isCredentialVaultConfigured } from "./credentialVault";

function withTestSecret<T>(secret: string, run: () => T): T {
  const previousSecret = process.env.MANUS_JWT_SECRET;
  const previousProject = process.env.MANUS_PROJECT_ID;
  process.env.MANUS_JWT_SECRET = secret;
  process.env.MANUS_PROJECT_ID = "vault-test-project";
  try {
    return run();
  } finally {
    if (previousSecret === undefined) delete process.env.MANUS_JWT_SECRET;
    else process.env.MANUS_JWT_SECRET = previousSecret;
    if (previousProject === undefined) delete process.env.MANUS_PROJECT_ID;
    else process.env.MANUS_PROJECT_ID = previousProject;
  }
}

describe("provider credential vault", () => {
  it("encrypts and decrypts a test value using a project-scoped derived AES-256 key", () => {
    withTestSecret("test-only-platform-secret-long-enough", () => {
      const plaintext = "test-provider-key-not-a-real-secret";
      const encrypted = encryptProviderCredential(plaintext);
      expect(encrypted).not.toContain(plaintext);
      expect(encrypted.split(".")).toHaveLength(4);
      expect(decryptProviderCredential(encrypted)).toBe(plaintext);
      expect(isCredentialVaultConfigured()).toBe(true);
    });
  });

  it("uses a fresh nonce for the same plaintext", () => {
    withTestSecret("test-only-platform-secret-long-enough", () => {
      const left = encryptProviderCredential("test-value");
      const right = encryptProviderCredential("test-value");
      expect(left).not.toBe(right);
    });
  });

  it("rejects tampering, a different platform secret and a different project scope", () => {
    const encrypted = withTestSecret("test-only-platform-secret-long-enough", () => encryptProviderCredential("test-value"));
    const [version, iv, tag, body] = encrypted.split(".");
    const changedTag = `${tag?.startsWith("A") ? "B" : "A"}${tag?.slice(1)}`;
    withTestSecret("test-only-platform-secret-long-enough", () => {
      expect(() => decryptProviderCredential(`${version}.${iv}.${changedTag}.${body}`)).toThrow();
    });
    withTestSecret("different-test-platform-secret-long-enough", () => {
      expect(() => decryptProviderCredential(encrypted)).toThrow();
    });
    withTestSecret("test-only-platform-secret-long-enough", () => {
      process.env.MANUS_PROJECT_ID = "different-project";
      expect(() => decryptProviderCredential(encrypted)).toThrow();
    });
  });

  it("rejects malformed encrypted data and missing or weak platform secrets", () => {
    withTestSecret("test-only-platform-secret-long-enough", () => {
      expect(() => decryptProviderCredential("v1.aa.bb.cc")).toThrow();
    });
    withTestSecret("short", () => {
      expect(() => encryptProviderCredential("test-value")).toThrow();
      expect(isCredentialVaultConfigured()).toBe(false);
    });
  });
});
