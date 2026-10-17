import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  activities,
  followUps,
  importBatches,
  prospects,
  type ProspectStage,
} from "../drizzle/schema";
import { getDb } from "./db";

async function database() {
  const db = await getDb();
  if (!db) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "The CRM database is not available.",
    });
  }
  return db;
}

export async function listProspects(ownerId: number) {
  const db = await database();
  return db
    .select()
    .from(prospects)
    .where(eq(prospects.ownerId, ownerId))
    .orderBy(desc(prospects.updatedAt))
    .limit(1000);
}

export async function getProspect(ownerId: number, prospectId: number) {
  const db = await database();
  const [prospect] = await db
    .select()
    .from(prospects)
    .where(and(eq(prospects.ownerId, ownerId), eq(prospects.id, prospectId)))
    .limit(1);
  return prospect ?? null;
}

export async function createProspect(
  ownerId: number,
  input: {
    firstName?: string;
    lastName?: string;
    company?: string;
    email?: string;
    phone?: string;
    source?: string;
    stage: ProspectStage;
    estimatedValueCents: number;
    notes?: string;
  },
) {
  const db = await database();
  const [result] = await db.insert(prospects).values({
    ownerId,
    firstName: input.firstName || null,
    lastName: input.lastName || null,
    company: input.company || null,
    email: input.email || null,
    phone: input.phone || null,
    source: input.source || null,
    stage: input.stage,
    estimatedValueCents: input.estimatedValueCents,
    notes: input.notes || null,
  });
  return Number(result.insertId);
}

export async function updateProspect(
  ownerId: number,
  prospectId: number,
  input: Partial<{
    firstName: string;
    lastName: string;
    company: string;
    email: string;
    phone: string;
    source: string;
    stage: ProspectStage;
    estimatedValueCents: number;
    notes: string;
  }>,
) {
  const db = await database();
  await db
    .update(prospects)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(and(eq(prospects.ownerId, ownerId), eq(prospects.id, prospectId)));
}

export async function addActivity(
  userId: number,
  prospectId: number,
  input: {
    type: "note" | "call" | "email" | "meeting" | "stage_change";
    title: string;
    description?: string;
  },
) {
  const db = await database();
  const prospect = await getProspect(userId, prospectId);
  if (!prospect) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Prospect not found." });
  }
  await db.insert(activities).values({
    userId,
    prospectId,
    type: input.type,
    title: input.title,
    description: input.description || null,
  });
}

export async function listActivities(ownerId: number, prospectId: number) {
  const db = await database();
  const prospect = await getProspect(ownerId, prospectId);
  if (!prospect) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Prospect not found." });
  }
  return db
    .select()
    .from(activities)
    .where(eq(activities.prospectId, prospectId))
    .orderBy(desc(activities.createdAt))
    .limit(100);
}

export async function listFollowUps(ownerId: number) {
  const db = await database();
  return db
    .select({
      id: followUps.id,
      prospectId: followUps.prospectId,
      ownerId: followUps.ownerId,
      title: followUps.title,
      dueAt: followUps.dueAt,
      priority: followUps.priority,
      status: followUps.status,
      completedAt: followUps.completedAt,
      createdAt: followUps.createdAt,
      prospectName: prospects.firstName,
      prospectLastName: prospects.lastName,
      company: prospects.company,
      prospectStage: prospects.stage,
    })
    .from(followUps)
    .innerJoin(
      prospects,
      and(
        eq(followUps.prospectId, prospects.id),
        eq(prospects.ownerId, ownerId),
      ),
    )
    .where(eq(followUps.ownerId, ownerId))
    .orderBy(asc(followUps.dueAt))
    .limit(1000);
}

export async function createFollowUp(
  ownerId: number,
  input: {
    prospectId: number;
    title: string;
    dueAt: Date;
    priority: "low" | "medium" | "high";
  },
) {
  const db = await database();
  const prospect = await getProspect(ownerId, input.prospectId);
  if (!prospect) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Prospect not found." });
  }
  const [result] = await db.insert(followUps).values({
    ownerId,
    prospectId: input.prospectId,
    title: input.title,
    dueAt: input.dueAt,
    priority: input.priority,
  });
  return Number(result.insertId);
}

export async function setFollowUpStatus(
  ownerId: number,
  followUpId: number,
  status: "open" | "completed",
) {
  const db = await database();
  await db
    .update(followUps)
    .set({
      status,
      completedAt: status === "completed" ? new Date() : null,
    })
    .where(and(eq(followUps.id, followUpId), eq(followUps.ownerId, ownerId)));
}

export async function importProspects(
  ownerId: number,
  userId: number,
  input: {
    fileName: string;
    totalRows: number;
    errorRows: number;
    rows: Array<{
      firstName?: string;
      lastName?: string;
      company?: string;
      email?: string;
      phone?: string;
      source?: string;
      stage: ProspectStage;
      estimatedValueCents: number;
      notes?: string;
    }>;
    includeDuplicates: boolean;
  },
) {
  const db = await database();
  const existing = await db
    .select({
      firstName: prospects.firstName,
      lastName: prospects.lastName,
      company: prospects.company,
      email: prospects.email,
    })
    .from(prospects)
    .where(eq(prospects.ownerId, ownerId));

  const signature = (row: {
    firstName?: string | null;
    lastName?: string | null;
    company?: string | null;
    email?: string | null;
  }) => {
    const email = row.email?.trim().toLowerCase();
    if (email) return `email:${email}`;
    const name = `${row.firstName ?? ""} ${row.lastName ?? ""}`
      .trim()
      .toLowerCase();
    const company = row.company?.trim().toLowerCase() ?? "";
    return name || company ? `contact:${name}|${company}` : "";
  };

  const seen = new Set(existing.map(signature).filter(Boolean));
  const accepted: typeof input.rows = [];
  let duplicateRows = 0;
  for (const row of input.rows) {
    const key = signature(row);
    const duplicate = key ? seen.has(key) : false;
    if (duplicate) duplicateRows += 1;
    if (duplicate && !input.includeDuplicates) continue;
    accepted.push(row);
    if (key) seen.add(key);
  }

  if (accepted.length) {
    await db.insert(prospects).values(
      accepted.map(row => ({
        ownerId,
        firstName: row.firstName || null,
        lastName: row.lastName || null,
        company: row.company || null,
        email: row.email || null,
        phone: row.phone || null,
        source: row.source || null,
        stage: row.stage,
        estimatedValueCents: row.estimatedValueCents,
        notes: row.notes || null,
      })),
    );
  }

  await db.insert(importBatches).values({
    userId,
    fileName: input.fileName.slice(0, 255),
    totalRows: input.totalRows,
    importedRows: accepted.length,
    duplicateRows,
    errorRows: input.errorRows,
  });

  return {
    importedRows: accepted.length,
    duplicateRows,
    errorRows: input.errorRows,
    skippedDuplicates: duplicateRows - (input.includeDuplicates ? 0 : duplicateRows),
  };
}

export async function listStages(ownerId: number, stages: ProspectStage[]) {
  const db = await database();
  if (!stages.length) return [];
  return db
    .select()
    .from(prospects)
    .where(and(eq(prospects.ownerId, ownerId), inArray(prospects.stage, stages)));
}
