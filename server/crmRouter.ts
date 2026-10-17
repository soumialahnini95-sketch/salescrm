import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { prospectStages } from "../drizzle/schema";
import { protectedProcedure, router } from "./_core/trpc";
import * as crmDb from "./crmDb";

const stageSchema = z.enum(prospectStages);
const prioritySchema = z.enum(["low", "medium", "high"]);
const activityTypeSchema = z.enum([
  "note",
  "call",
  "email",
  "meeting",
  "stage_change",
]);

const prospectFields = z.object({
  firstName: z.string().trim().max(120).optional().default(""),
  lastName: z.string().trim().max(120).optional().default(""),
  company: z.string().trim().max(180).optional().default(""),
  email: z.string().trim().max(320).optional().default(""),
  phone: z.string().trim().max(80).optional().default(""),
  source: z.string().trim().max(120).optional().default(""),
  stage: stageSchema.default("new"),
  estimatedValueCents: z.number().int().min(0).max(2_000_000_000).default(0),
  notes: z.string().max(12000).optional().default(""),
}).refine(
  value => Boolean(value.firstName || value.lastName || value.company),
  "Enter a person name or company.",
).refine(
  value => !value.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email),
  "Enter a valid email address.",
);

const importRowSchema = z.object({
  firstName: z.string().max(120).optional(),
  lastName: z.string().max(120).optional(),
  company: z.string().max(180).optional(),
  email: z.string().max(320).optional(),
  phone: z.string().max(80).optional(),
  source: z.string().max(120).optional(),
  stage: stageSchema,
  estimatedValueCents: z.number().int().min(0).max(2_000_000_000),
  notes: z.string().max(12000).optional(),
}).refine(
  value => Boolean(value.firstName || value.lastName || value.company),
  "Enter a person name or company.",
).refine(
  value => !value.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email),
  "Enter a valid email address.",
);

export const crmRouter = router({
  dashboard: protectedProcedure.query(async ({ ctx }) => {
    const [prospects, followUps] = await Promise.all([
      crmDb.listProspects(ctx.user.id),
      crmDb.listFollowUps(ctx.user.id),
    ]);
    const active = prospects.filter(
      prospect => prospect.stage !== "won" && prospect.stage !== "lost",
    );
    const pipelineValueCents = active.reduce(
      (sum, prospect) => sum + prospect.estimatedValueCents,
      0,
    );
    const wonValueCents = prospects
      .filter(prospect => prospect.stage === "won")
      .reduce((sum, prospect) => sum + prospect.estimatedValueCents, 0);
    const closed = prospects.filter(
      prospect => prospect.stage === "won" || prospect.stage === "lost",
    );
    const won = prospects.filter(prospect => prospect.stage === "won").length;
    const openFollowUps = followUps.filter(item => item.status === "open");
    const overdueCount = openFollowUps.filter(
      item => item.dueAt.getTime() < Date.now(),
    ).length;
    return {
      prospects,
      followUps,
      metrics: {
        total: prospects.length,
        active: active.length,
        pipelineValueCents,
        wonValueCents,
        conversionRate: closed.length ? Math.round((won / closed.length) * 100) : 0,
        dueCount: openFollowUps.length,
        overdueCount,
      },
    };
  }),
  prospects: router({
    list: protectedProcedure.query(({ ctx }) =>
      crmDb.listProspects(ctx.user.id),
    ),
    create: protectedProcedure.input(prospectFields).mutation(({ ctx, input }) =>
      crmDb.createProspect(ctx.user.id, input),
    ),
    update: protectedProcedure
      .input(z.object({ id: z.number().int().positive(), data: prospectFields.partial() }))
      .mutation(async ({ ctx, input }) => {
        const existing = await crmDb.getProspect(ctx.user.id, input.id);
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Prospect not found." });
        }
        await crmDb.updateProspect(ctx.user.id, input.id, input.data);
        return { success: true };
      }),
    updateStage: protectedProcedure
      .input(z.object({ id: z.number().int().positive(), stage: stageSchema }))
      .mutation(async ({ ctx, input }) => {
        const existing = await crmDb.getProspect(ctx.user.id, input.id);
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Prospect not found." });
        }
        if (existing.stage !== input.stage) {
          await crmDb.updateProspect(ctx.user.id, input.id, { stage: input.stage });
          await crmDb.addActivity(ctx.user.id, input.id, {
            type: "stage_change",
            title: `Moved from ${existing.stage} to ${input.stage}`,
          });
        }
        return { success: true };
      }),
  }),
  activities: router({
    list: protectedProcedure
      .input(z.object({ prospectId: z.number().int().positive() }))
      .query(({ ctx, input }) =>
        crmDb.listActivities(ctx.user.id, input.prospectId),
      ),
    add: protectedProcedure
      .input(z.object({
        prospectId: z.number().int().positive(),
        type: activityTypeSchema,
        title: z.string().trim().min(1).max(180),
        description: z.string().max(5000).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await crmDb.addActivity(ctx.user.id, input.prospectId, input);
        return { success: true };
      }),
  }),
  followUps: router({
    list: protectedProcedure.query(({ ctx }) =>
      crmDb.listFollowUps(ctx.user.id),
    ),
    create: protectedProcedure
      .input(z.object({
        prospectId: z.number().int().positive(),
        title: z.string().trim().min(1).max(180),
        dueAt: z.date(),
        priority: prioritySchema.default("medium"),
      }))
      .mutation(({ ctx, input }) => crmDb.createFollowUp(ctx.user.id, input)),
    setStatus: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        status: z.enum(["open", "completed"]),
      }))
      .mutation(async ({ ctx, input }) => {
        await crmDb.setFollowUpStatus(ctx.user.id, input.id, input.status);
        return { success: true };
      }),
  }),
  imports: router({
    commit: protectedProcedure
      .input(z.object({
        fileName: z.string().trim().min(1).max(255),
        totalRows: z.number().int().min(0).max(10000),
        errorRows: z.number().int().min(0).max(10000),
        includeDuplicates: z.boolean().default(false),
        rows: z.array(importRowSchema).max(1000),
      }))
      .mutation(({ ctx, input }) =>
        crmDb.importProspects(ctx.user.id, ctx.user.id, input),
      ),
  }),
});
