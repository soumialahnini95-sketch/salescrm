export const STAGES = [
  "new",
  "qualified",
  "proposal",
  "negotiation",
  "won",
  "lost",
] as const;

export type Stage = (typeof STAGES)[number];
export type Priority = "low" | "medium" | "high";
export type FollowUpStatus = "open" | "completed";

export interface Prospect {
  id: number;
  ownerId: number;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  stage: Stage;
  estimatedValueCents: number;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FollowUp {
  id: number;
  prospectId: number;
  ownerId: number;
  title: string;
  dueAt: Date;
  priority: Priority;
  status: FollowUpStatus;
  completedAt: Date | null;
  createdAt: Date;
  prospectName: string | null;
  prospectLastName: string | null;
  company: string | null;
  prospectStage: Stage;
}

export interface Activity {
  id: number;
  prospectId: number;
  userId: number;
  type: "note" | "call" | "email" | "meeting" | "stage_change";
  title: string;
  description: string | null;
  createdAt: Date;
}

export const STAGE_LABELS: Record<Stage, string> = {
  new: "New",
  qualified: "Qualified",
  proposal: "Proposal",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
};

export function displayName(prospect: Pick<Prospect, "firstName" | "lastName" | "company">) {
  const person = [prospect.firstName, prospect.lastName].filter(Boolean).join(" ");
  return person || prospect.company || "Unnamed prospect";
}

export function formatMoney(cents: number, compact = false) {
  const amount = cents / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
    notation: compact && amount >= 10000 ? "compact" : "standard",
  }).format(amount);
}

export function formatDate(value: Date | string, options?: Intl.DateTimeFormatOptions) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", options ?? {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function initials(name: string) {
  return name
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? "")
    .join("") || "?";
}
