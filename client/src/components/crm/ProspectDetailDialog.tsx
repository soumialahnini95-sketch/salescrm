import { ArrowUpRight, CalendarPlus, Clock3, Edit3, Mail, MessageCircle, Phone, Plus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import type { Prospect } from "./types";
import { displayName, formatDate, formatMoney, STAGE_LABELS, STAGES } from "./types";
import ProspectDialog from "./ProspectDialog";

type ActivityType = "note" | "call" | "email" | "meeting";
const activityIcons = { note: MessageCircle, call: Phone, email: Mail, meeting: CalendarPlus, stage_change: ArrowUpRight };
const activityTitles: Record<ActivityType, string> = { note: "Added a note", call: "Logged a call", email: "Logged an email", meeting: "Logged a meeting" };

export default function ProspectDetailDialog({ prospect, onClose, onChanged }: {
  prospect: Prospect | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState("");
  const [activityType, setActivityType] = useState<ActivityType>("note");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDate, setTaskDate] = useState(() => {
    const value = new Date(Date.now() + 24 * 60 * 60 * 1000);
    value.setMinutes(0, 0, 0);
    return new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const utils = trpc.useUtils();
  const activities = trpc.crm.activities.list.useQuery(
    { prospectId: prospect?.id ?? 0 }, { enabled: Boolean(prospect), staleTime: 5_000 },
  );
  const followUps = trpc.crm.followUps.list.useQuery(undefined, { enabled: Boolean(prospect) });
  const addActivity = trpc.crm.activities.add.useMutation({
    onSuccess: async () => { setNote(""); await utils.crm.activities.list.invalidate({ prospectId: prospect!.id }); toast.success("Activity added to timeline"); },
    onError: error => toast.error(error.message),
  });
  const createTask = trpc.crm.followUps.create.useMutation({
    onSuccess: async () => { setTaskTitle(""); await utils.crm.dashboard.invalidate(); await utils.crm.followUps.list.invalidate(); toast.success("Follow-up scheduled"); onChanged(); },
    onError: error => toast.error(error.message),
  });

  if (!prospect) return null;
  if (editing) return <ProspectDialog open prospect={prospect} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); onChanged(); onClose(); }} />;

  const name = displayName(prospect);
  const openTasks = followUps.data?.filter(task => task.prospectId === prospect.id && task.status === "open") ?? [];
  const submitNote = (event: React.FormEvent) => {
    event.preventDefault();
    if (!note.trim()) return;
    addActivity.mutate({ prospectId: prospect.id, type: activityType, title: activityTitles[activityType], description: note.trim() });
  };
  const submitTask = (event: React.FormEvent) => {
    event.preventDefault();
    if (!taskTitle.trim()) return;
    createTask.mutate({ prospectId: prospect.id, title: taskTitle.trim(), dueAt: new Date(taskDate), priority: "medium" });
  };

  return (
    <div className="modal-backdrop detail-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="modal-card detail-modal" role="dialog" aria-modal="true" aria-labelledby="prospect-detail-title">
        <div className="detail-topbar"><div className="section-kicker">PROSPECT PROFILE <span className="detail-id">#{String(prospect.id).padStart(4, "0")}</span></div><div className="detail-top-actions"><button className="button-secondary compact-button" onClick={() => setEditing(true)}><Edit3 size={14} />Edit</button><button className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button></div></div>
        <div className="detail-hero"><div className="detail-avatar">{name.split(/[\s@._-]+/).map(value => value[0]).slice(0, 2).join("").toUpperCase()}</div><div className="detail-identity"><h2 id="prospect-detail-title">{name}</h2><p>{prospect.company || "Independent prospect"}</p></div><span className={`stage-badge stage-badge-${prospect.stage}`}>{STAGE_LABELS[prospect.stage]}</span></div>
        <div className="detail-main-grid">
          <div className="detail-primary">
            <div className="detail-stat-row"><div><span>POTENTIAL VALUE</span><strong>{formatMoney(prospect.estimatedValueCents)}</strong></div><div><span>LEAD SOURCE</span><strong>{prospect.source || "Not specified"}</strong></div><div><span>LAST UPDATED</span><strong>{formatDate(prospect.updatedAt, { month: "short", day: "numeric" })}</strong></div></div>
            <div className="detail-section"><div className="detail-section-heading"><div><div className="section-kicker">ACTIVITY LOG</div><h3>Conversation history</h3></div><span className="activity-count">{activities.data?.length ?? 0}</span></div>
              <form className="note-composer" onSubmit={submitNote}><div className="note-avatar">{name.split(/[\s@._-]+/).map(value => value[0]).slice(0, 2).join("").toUpperCase()}</div><div className="activity-composer-fields"><select aria-label="Activity type" value={activityType} onChange={event => setActivityType(event.target.value as ActivityType)}><option value="note">Note</option><option value="call">Call</option><option value="email">Email</option><option value="meeting">Meeting</option></select><textarea value={note} onChange={event => setNote(event.target.value)} placeholder="Add context, a call recap or next-step note…" rows={2} maxLength={5000} /></div><button className="note-submit" type="submit" disabled={!note.trim() || addActivity.isPending} title="Add to timeline"><ArrowUpRight size={16} /></button></form>
              <div className="timeline-list">{activities.isLoading ? <div className="timeline-empty">Loading activity…</div> : activities.data?.length ? activities.data.map(item => { const Icon = activityIcons[item.type]; return <article className="timeline-item" key={item.id}><div className={`timeline-icon timeline-${item.type}`}><Icon size={14} /></div><div className="timeline-copy"><div><strong>{item.title}</strong><time>{formatDate(item.createdAt, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</time></div>{item.description && <p>{item.description}</p>}</div></article>; }) : <div className="timeline-empty">The conversation starts here. Add a note after your next touch.</div>}</div>
            </div>
          </div>
          <aside className="detail-aside">
            <div className="detail-section contact-block"><div className="section-kicker">CONTACT</div>{prospect.email && <a href={`mailto:${prospect.email}`}><Mail size={15} /><span>{prospect.email}</span></a>}{prospect.phone && <a href={`tel:${prospect.phone}`}><Phone size={15} /><span>{prospect.phone}</span></a>}{!prospect.email && !prospect.phone && <span className="detail-muted">No contact details yet</span>}</div>
            <div className="detail-section stage-block"><div className="section-kicker">PIPELINE STAGE</div><div className="stage-rail">{STAGES.map((stage, index) => <div className={`stage-rail-item ${stage === prospect.stage ? "current" : ""} ${STAGES.indexOf(prospect.stage) > index ? "passed" : ""}`} key={stage}><span className="rail-point" /><span>{STAGE_LABELS[stage]}</span></div>)}</div></div>
            <div className="detail-section next-step-block"><div className="detail-section-heading"><div><div className="section-kicker">NEXT TOUCH</div><h3>Follow-ups</h3></div><Clock3 size={16} className="muted-icon" /></div>
              {openTasks.length ? <div className="mini-task-list">{openTasks.slice(0, 3).map(task => <div className="mini-task" key={task.id}><span className={`priority-dot priority-${task.priority}`} /><span><strong>{task.title}</strong><small>{formatDate(task.dueAt, { month: "short", day: "numeric" })}</small></span></div>)}</div> : <div className="no-next-touch">No next step scheduled.</div>}
              <form className="quick-task-form" onSubmit={submitTask}><input value={taskTitle} onChange={event => setTaskTitle(event.target.value)} placeholder="Add a follow-up…" maxLength={180} /><label><span>Due</span><input type="datetime-local" value={taskDate} onChange={event => setTaskDate(event.target.value)} /></label><button className="button-primary full-width" type="submit" disabled={!taskTitle.trim() || createTask.isPending}><Plus size={15} />Schedule follow-up</button></form>
            </div>
            <div className="detail-section notes-block"><div className="section-kicker">NOTES</div><p>{prospect.notes || "No notes added yet."}</p></div>
          </aside>
        </div>
      </section>
    </div>
  );
}
