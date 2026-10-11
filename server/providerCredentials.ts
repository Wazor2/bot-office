import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { providerCredentials } from "../drizzle/schema";
import { decryptProviderCredential, encryptProviderCredential, isCredentialVaultConfigured } from "./credentialVault";
import { getDb } from "./db";
import { protectedProcedure, router } from "./_core/trpc";

export const API_PROVIDER_IDS = ["anthropic-api", "openai-api", "google-api", "openrouter-api"] as const;
const apiProviderId = z.enum(API_PROVIDER_IDS);

async function requireDatabase() {
  const db = await getDb();
  if (!db) {
    throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Secure provider storage is unavailable right now." });
  }
  return db;
}

function requireVault() {
  if (!isCredentialVaultConfigured()) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Secure provider storage is not configured yet. Try again after vault setup is complete.",
    });
  }
}

export const providerCredentialsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await requireDatabase();
    const records = await db
      .select({ providerId: providerCredentials.providerId, keyLastFour: providerCredentials.keyLastFour, updatedAt: providerCredentials.updatedAt })
      .from(providerCredentials)
      .where(eq(providerCredentials.userId, ctx.user.id));

    return { vaultReady: isCredentialVaultConfigured(), credentials: records };
  }),

  save: protectedProcedure
    .input(z.object({ providerId: apiProviderId, apiKey: z.string().min(8).max(16_384).refine((value) => value.trim() === value, "Remove leading or trailing whitespace from the API key.") }))
    .mutation(async ({ ctx, input }) => {
      requireVault();
      const db = await requireDatabase();
      let encryptedKey: string;
      try {
        encryptedKey = encryptProviderCredential(input.apiKey);
      } catch {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "The secure provider vault could not encrypt this key." });
      }

      try {
        await db.insert(providerCredentials).values({
          userId: ctx.user.id,
          providerId: input.providerId,
          encryptedKey,
          keyLastFour: input.apiKey.slice(-4),
        }).onDuplicateKeyUpdate({
          set: { encryptedKey, keyLastFour: input.apiKey.slice(-4), updatedAt: new Date() },
        });
      } catch {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not securely store this provider key." });
      }

      return { success: true, providerId: input.providerId, keyLastFour: input.apiKey.slice(-4) };
    }),

  remove: protectedProcedure
    .input(z.object({ providerId: apiProviderId }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDatabase();
      await db.delete(providerCredentials).where(and(
        eq(providerCredentials.userId, ctx.user.id),
        eq(providerCredentials.providerId, input.providerId),
      ));
      return { success: true };
    }),
});

/** Internal adapter boundary; decrypted values stay server-side and are never returned by tRPC. */
export async function getProviderCredential(userId: number, providerId: (typeof API_PROVIDER_IDS)[number]): Promise<string | null> {
  requireVault();
  const db = await requireDatabase();
  const [record] = await db
    .select({ encryptedKey: providerCredentials.encryptedKey })
    .from(providerCredentials)
    .where(and(eq(providerCredentials.userId, userId), eq(providerCredentials.providerId, providerId)))
    .limit(1);
  if (!record) return null;
  try {
    return decryptProviderCredential(record.encryptedKey);
  } catch {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The stored provider key could not be decrypted." });
  }
}
