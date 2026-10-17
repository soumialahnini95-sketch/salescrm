import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import type { Prospect, Stage } from "./types";
import { STAGE_LABELS, STAGES } from "./types";

type FormState = {
  firstName: string;
  lastName: string;
  company: string;
  email: string;
  phone: string;
  source: string;
  stage: Stage;
  estimatedValue: string;
  notes: string;
};

const emptyForm: FormState = {
  firstName: "", lastName: "", company: "", email: "", phone: "", source: "",
  stage: "new", estimatedValue: "", notes: "",
};

export default function ProspectDialog({ open, onClose, onSaved, prospect }: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  prospect?: Prospect | null;
}) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const utils = trpc.useUtils();
  const create = trpc.crm.prospects.create.useMutation({
    onSuccess: async () => {
      await utils.crm.prospects.list.invalidate();
      onSaved(); onClose(); toast.success("Prospect added to your pipeline");
    },
    onError: error => toast.error(error.message),
  });
  const update = trpc.crm.prospects.update.useMutation({
    onSuccess: async () => {
      await utils.crm.prospects.list.invalidate();
      onSaved(); onClose(); toast.success("Prospect details saved");
    },
    onError: error => toast.error(error.message),
  });

  useEffect(() => {
    if (!open) return;
    if (!prospect) { setForm(emptyForm); return; }
    setForm({
      firstName: prospect.firstName ?? "",
      lastName: prospect.lastName ?? "",
      company: prospect.company ?? "",
      email: prospect.email ?? "",
      phone: prospect.phone ?? "",
      source: prospect.source ?? "",
      stage: prospect.stage,
      estimatedValue: prospect.estimatedValueCents ? (prospect.estimatedValueCents / 100).toString() : "",
      notes: prospect.notes ?? "",
    });
  }, [open, prospect]);

  if (!open) return null;
  const pending = create.isPending || update.isPending;
  const change = (field: keyof FormState, value: string) => setForm(current => ({ ...current, [field]: value }));
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const amount = form.estimatedValue.trim() ? Number(form.estimatedValue.replace(/[$,\s]/g, "")) : 0;
    if (!Number.isFinite(amount) || amount < 0) { toast.error("Enter a valid opportunity value"); return; }
    const common = {
      firstName: form.firstName.trim(), lastName: form.lastName.trim(), company: form.company.trim(),
      email: form.email.trim(), phone: form.phone.trim(), source: form.source.trim(), stage: form.stage,
      estimatedValueCents: Math.round(amount * 100), notes: form.notes.trim(),
    };
    if (prospect) update.mutate({ id: prospect.id, data: common });
    else create.mutate(common);
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="modal-card prospect-form-modal" role="dialog" aria-modal="true" aria-labelledby="prospect-form-title">
        <div className="modal-heading"><div><div className="section-kicker">{prospect ? "PROSPECT PROFILE" : "NEW RELATIONSHIP"}</div><h2 id="prospect-form-title">{prospect ? "Edit prospect" : "Add a prospect"}</h2><p>Keep the details that help your next conversation move forward.</p></div><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={18} /></button></div>
        <form onSubmit={submit}>
          <div className="form-section-label">CONTACT DETAILS</div>
          <div className="form-grid">
            <label className="field-group"><span>First name</span><input value={form.firstName} onChange={event => change("firstName", event.target.value)} placeholder="Alex" maxLength={120} /></label>
            <label className="field-group"><span>Last name</span><input value={form.lastName} onChange={event => change("lastName", event.target.value)} placeholder="Morgan" maxLength={120} /></label>
            <label className="field-group span-two"><span>Company</span><input value={form.company} onChange={event => change("company", event.target.value)} placeholder="Company name" maxLength={180} /></label>
            <label className="field-group"><span>Email</span><input type="email" value={form.email} onChange={event => change("email", event.target.value)} placeholder="alex@company.com" maxLength={320} /></label>
            <label className="field-group"><span>Phone</span><input value={form.phone} onChange={event => change("phone", event.target.value)} placeholder="+1 (555) 010-0100" maxLength={80} /></label>
          </div>
          <div className="form-section-label space-top">OPPORTUNITY</div>
          <div className="form-grid">
            <label className="field-group"><span>Pipeline stage</span><select value={form.stage} onChange={event => change("stage", event.target.value)}>{STAGES.map(stage => <option value={stage} key={stage}>{STAGE_LABELS[stage]}</option>)}</select></label>
            <label className="field-group"><span>Potential value <small>USD</small></span><div className="currency-input"><span>$</span><input inputMode="decimal" value={form.estimatedValue} onChange={event => change("estimatedValue", event.target.value)} placeholder="0" /></div></label>
            <label className="field-group span-two"><span>Source</span><input value={form.source} onChange={event => change("source", event.target.value)} placeholder="e.g. Referral, Website, Event" maxLength={120} /></label>
            <label className="field-group span-two"><span>Notes</span><textarea value={form.notes} onChange={event => change("notes", event.target.value)} placeholder="Context, needs, goals or the best way to follow up…" rows={3} maxLength={12000} /></label>
          </div>
          <div className="form-hint">Add a first name, last name or company to save this prospect.</div>
          <div className="modal-actions"><button type="button" className="button-secondary" onClick={onClose}>Cancel</button><button type="submit" className="button-primary" disabled={pending}>{pending ? "Saving…" : prospect ? "Save changes" : "Add to pipeline"}</button></div>
        </form>
      </section>
    </div>
  );
}
