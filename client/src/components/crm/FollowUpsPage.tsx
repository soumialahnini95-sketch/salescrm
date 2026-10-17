import { CalendarClock, Check, CheckCheck, Circle, Clock3, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import type { FollowUp, Prospect } from "./types";
import { displayName, formatDate } from "./types";

type Filter = "open" | "all" | "completed";

export default function FollowUpsPage({ followUps, prospects }: { followUps: FollowUp[]; prospects: Prospect[] }) {
  const [filter, setFilter] = useState<Filter>("open");
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [prospectId, setProspectId] = useState("");
  const [dueAt, setDueAt] = useState(() => {
    const value = new Date(Date.now() + 24 * 60 * 60 * 1000);
    value.setMinutes(0, 0, 0);
    return new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const utils = trpc.useUtils();
  const setStatus = trpc.crm.followUps.setStatus.useMutation({
    onSuccess: () => { void utils.crm.dashboard.invalidate(); toast.success("Follow-up updated"); },
    onError: error => toast.error(error.message),
  });
  const create = trpc.crm.followUps.create.useMutation({
    onSuccess: () => {
      void utils.crm.dashboard.invalidate();
      setShowForm(false); setTitle(""); setProspectId("");
      toast.success("Follow-up added");
    },
    onError: error => toast.error(error.message),
  });
  const items = useMemo(() => followUps.filter(item => filter === "all" || item.status === filter)
    .sort((a, b) => (a.status === "open" ? 0 : 1) - (b.status === "open" ? 0 : 1) || new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()), [followUps, filter]);
  const overdue = followUps.filter(item => item.status === "open" && new Date(item.dueAt).getTime() < Date.now()).length;
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !prospectId || !dueAt) return;
    create.mutate({ prospectId: Number(prospectId), title: title.trim(), dueAt: new Date(dueAt), priority });
  };

  return (
    <div className="view-stack">
      <div className="followup-banner"><div className="followup-banner-icon"><CalendarClock size={19} /></div><div><strong>{overdue ? `${overdue} ${overdue === 1 ? "follow-up needs" : "follow-ups need"} your attention` : "You’re on top of your follow-ups"}</strong><span>{overdue ? "Revisit an overdue conversation and keep the momentum alive." : "Set a next step for every promising conversation."}</span></div><button className="button-primary compact-button" onClick={() => setShowForm(value => !value)}><Plus size={16} />New follow-up</button></div>
      {showForm && <form className="panel task-create-form" onSubmit={submit}>
        <div className="form-title-row"><div><div className="section-kicker">PLAN THE NEXT TOUCH</div><h2>Create a follow-up</h2></div><button className="icon-button" type="button" onClick={() => setShowForm(false)} aria-label="Close"><X size={17} /></button></div>
        <div className="form-grid">
          <label className="field-group span-two"><span>What needs to happen?</span><input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Send revised proposal" required maxLength={180} /></label>
          <label className="field-group"><span>Prospect</span><select value={prospectId} onChange={e => setProspectId(e.target.value)} required><option value="">Select a prospect</option>{prospects.map(item => <option value={item.id} key={item.id}>{displayName(item)}{item.company ? ` · ${item.company}` : ""}</option>)}</select></label>
          <label className="field-group"><span>Due date & time</span><input type="datetime-local" value={dueAt} onChange={e => setDueAt(e.target.value)} required /></label>
          <label className="field-group"><span>Priority</span><select value={priority} onChange={e => setPriority(e.target.value as typeof priority)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
        </div>
        <div className="form-actions"><button className="button-secondary" type="button" onClick={() => setShowForm(false)}>Cancel</button><button className="button-primary" type="submit" disabled={create.isPending || !prospects.length}>{create.isPending ? "Saving…" : "Add follow-up"}</button></div>
        {!prospects.length && <div className="form-hint">Add a prospect before creating a follow-up.</div>}
      </form>}
      <section className="panel followups-table-panel">
        <div className="followup-tabs">
          {(["open", "all", "completed"] as Filter[]).map(item => <button key={item} className={filter === item ? "followup-tab active" : "followup-tab"} onClick={() => setFilter(item)}>{item === "open" ? "Open" : item === "all" ? "All tasks" : "Completed"}<span>{item === "open" ? followUps.filter(x => x.status === "open").length : item === "completed" ? followUps.filter(x => x.status === "completed").length : followUps.length}</span></button>)}
          <div className="followup-list-note"><span className="tiny-line" />Sorted by due date</div>
        </div>
        {items.length === 0 ? <div className="empty-directory"><div className="empty-icon"><CheckCheck size={21} /></div><strong>{filter === "completed" ? "No completed follow-ups yet." : "No follow-ups here."}</strong><span>{filter === "open" ? "Create a reminder so the next conversation never slips." : "Your follow-up activity will appear here."}</span><button className="text-button" onClick={() => setShowForm(true)}>Create a follow-up <Plus size={15} /></button></div> : <div className="followup-list">
          {items.map(item => {
            const isOverdue = item.status === "open" && new Date(item.dueAt).getTime() < Date.now();
            return <article className={`followup-list-item ${item.status === "completed" ? "completed" : ""}`} key={item.id}>
              <button className={`complete-toggle ${item.status === "completed" ? "checked" : ""}`} title={item.status === "open" ? "Mark complete" : "Reopen follow-up"} onClick={() => setStatus.mutate({ id: item.id, status: item.status === "open" ? "completed" : "open" })}>{item.status === "completed" ? <Check size={14} /> : <Circle size={17} />}</button>
              <div className="followup-task-main"><strong>{item.title}</strong><span>{item.company || displayName({ firstName: item.prospectName, lastName: item.prospectLastName, company: item.company })}</span></div>
              <span className={`priority-label priority-${item.priority}`}><i />{item.priority}</span>
              <span className={`followup-due ${isOverdue ? "overdue-text" : ""}`}>{isOverdue && <Clock3 size={14} />}{item.status === "completed" ? "Completed" : isOverdue ? `Overdue · ${formatDate(item.dueAt, { month: "short", day: "numeric" })}` : formatDate(item.dueAt, { month: "short", day: "numeric", year: "numeric" })}</span>
            </article>;
          })}
        </div>}
      </section>
      <div className="notification-disclaimer"><Circle size={14} /><span>Reminders appear in this workspace when you return. External email or push alerts require a configured recipient channel.</span></div>
    </div>
  );
}
