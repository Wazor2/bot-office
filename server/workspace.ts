import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { conversations, messages, projects } from "../drizzle/schema";
import { getDb } from "./db";
import { protectedProcedure, router } from "./_core/trpc";

async function requireDatabase() {
  const db = await getDb();
  if (!db) {
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message: "Project storage is not available right now. Please try again shortly.",
    });
  }
  return db;
}

function projectTitleFromBrief(brief: string) {
  const firstLine = brief.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
  const normalized = (firstLine ?? "New project").replace(/\s+/g, " ");
  return normalized.length > 112 ? `${normalized.slice(0, 109)}…` : normalized;
}

export const workspaceRouter = router({
  current: protectedProcedure.query(async ({ ctx }) => {
    const db = await requireDatabase();
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.userId, ctx.user.id))
      .orderBy(desc(projects.updatedAt))
      .limit(1);

    if (!project) return { project: null, conversation: null, messages: [] };

    const [conversation] = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.projectId, project.id), eq(conversations.userId, ctx.user.id)))
      .orderBy(desc(conversations.updatedAt))
      .limit(1);

    if (!conversation) return { project, conversation: null, messages: [] };

    const recentMessages = await db
      .select()
      .from(messages)
      .where(and(eq(messages.conversationId, conversation.id), eq(messages.userId, ctx.user.id)))
      .orderBy(desc(messages.createdAt), desc(messages.id))
      .limit(50);

    return { project, conversation, messages: recentMessages.reverse() };
  }),

  createWithBrief: protectedProcedure
    .input(z.object({ brief: z.string().trim().min(1).max(20_000) }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDatabase();
      const name = projectTitleFromBrief(input.brief);

      const created = await db.transaction(async (tx) => {
        const [projectIdRow] = await tx
          .insert(projects)
          .values({ userId: ctx.user.id, name, description: input.brief, status: "draft" })
          .$returningId();
        const projectId = projectIdRow.id;

        const [conversationIdRow] = await tx
          .insert(conversations)
          .values({ projectId, userId: ctx.user.id, title: name, status: "open" })
          .$returningId();
        const conversationId = conversationIdRow.id;

        await tx.insert(messages).values({
          projectId,
          conversationId,
          userId: ctx.user.id,
          role: "user",
          content: input.brief,
        });

        return { projectId, conversationId, name };
      });

      return { success: true, ...created };
    }),

  addMessage: protectedProcedure
    .input(z.object({ conversationId: z.number().int().positive(), content: z.string().trim().min(1).max(20_000) }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDatabase();
      const [conversation] = await db
        .select({ id: conversations.id, projectId: conversations.projectId })
        .from(conversations)
        .where(and(eq(conversations.id, input.conversationId), eq(conversations.userId, ctx.user.id)))
        .limit(1);

      if (!conversation) {
        throw new TRPCError({ code: "NOT_FOUND", message: "That project conversation was not found." });
      }

      await db.insert(messages).values({
        projectId: conversation.projectId,
        conversationId: conversation.id,
        userId: ctx.user.id,
        role: "user",
        content: input.content,
      });
      await db.update(conversations).set({ updatedAt: new Date() }).where(eq(conversations.id, conversation.id));
      await db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, conversation.projectId));

      return { success: true };
    }),
});
