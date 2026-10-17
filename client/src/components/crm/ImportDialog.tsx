import { ArrowDownToLine, ArrowRight, Check, FileSpreadsheet, Loader2, Upload, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import type { Stage } from "./types";
import { displayName, formatMoney, STAGES, STAGE_LABELS } from "./types";

type Field = "firstName" | "lastName" | "company" | "email" | "phone" | "source" | "stage" | "value" | "notes";
type NormalizedRow = {
  rowNumber: number;
  firstName: string;
  lastName: string;
  company: string;
  email: string;
  phone: string;
  source: string;
  stage: Stage;
  estimatedValueCents: number;
  notes: string;
  error: string;
  duplicate: boolean;
};

const fieldLabels: Record<Field, string> = {
  firstName: "First name / full name", lastName: "Last name", company: "Company", email: "Email",
  phone: "Phone", source: "Source", stage: "Pipeline stage", value: "Potential value", notes: "Notes",
};
const autoAliases: Record<Field, string[]> = {
  firstName: ["first name", "firstname", "contact name", "lead name", "name", "contact"],
  lastName: ["last name", "lastname", "surname", "family name"],
  company: ["company", "organization", "organisation", "account", "business"],
  email: ["email", "email address", "e-mail"],
  phone: ["phone", "telephone", "mobile", "phone number"],
  source: ["source", "lead source", "channel", "origin"],
  stage: ["stage", "status", "pipeline stage", "deal stage"],
  value: ["value", "amount", "potential value", "deal value", "revenue"],
  notes: ["notes", "note", "comments", "description"],
};
const mapHeader = (header: string, field: Field) => autoAliases[field].includes(header.trim().toLowerCase().replace(/[_-]+/g, " "));
const stageFromCell = (raw: string): Stage | null => {
  const value = raw.trim().toLowerCase().replace(/[ _-]+/g, " ");
  if (!value || ["new", "lead", "prospect", "open"].includes(value)) return "new";
  if (["qualified", "qualify", "discovery"].includes(value)) return "qualified";
  if (["proposal", "proposed", "quote", "quoted"].includes(value)) return "proposal";
  if (["negotiation", "negotiating", "contract"].includes(value)) return "negotiation";
  if (["won", "closed won", "closed-won", "customer"].includes(value)) return "won";
  if (["lost", "closed lost", "closed-lost", "disqualified"].includes(value)) return "lost";
  return null;
};

export default function ImportDialog({ open, onClose, onImported }: { open: boolean; onClose: () => void; onImported: () => void }) {
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<unknown[][]>([]);
  const [mapping, setMapping] = useState<Record<Field, number | "">>({ firstName: "", lastName: "", company: "", email: "", phone: "", source: "", stage: "", value: "", notes: "" });
  const [includeDuplicates, setIncludeDuplicates] = useState(false);
  const [result, setResult] = useState<{ importedRows: number; duplicateRows: number; errorRows: number } | null>(null);
  const prospects = trpc.crm.prospects.list.useQuery(undefined, { enabled: open, staleTime: 10_000 });
  const utils = trpc.useUtils();
  const commit = trpc.crm.imports.commit.useMutation({
    onSuccess: async data => {
      setResult(data);
      await utils.crm.prospects.list.invalidate();
      onImported();
      toast.success(`${data.importedRows} prospect${data.importedRows === 1 ? "" : "s"} imported`);
    },
    onError: error => toast.error(error.message || "Import failed"),
  });

  const normalized = useMemo((): NormalizedRow[] => rawRows.map((values, index) => {
    const cell = (field: Field) => {
      const column = mapping[field];
      if (column === "") return "";
      return String(values[column] ?? "").trim();
    };
    const firstName = cell("firstName");
    const lastName = cell("lastName");
    const company = cell("company");
    const email = cell("email");
    const rawValue = cell("value").replace(/[$,\s]/g, "");
    const value = rawValue ? Number(rawValue) : 0;
    const parsedStage = stageFromCell(cell("stage"));
    let error = "";
    if (!firstName && !lastName && !company) error = "Add a name or company";
    else if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) error = "Invalid email address";
    else if (rawValue && (!Number.isFinite(value) || value < 0)) error = "Invalid potential value";
    else if (cell("stage") && !parsedStage) error = "Unknown pipeline stage";
    const candidate = { firstName, lastName, company, email };
    const signature = email ? `email:${email.toLowerCase()}` : `contact:${`${firstName} ${lastName}`.trim().toLowerCase()}|${company.toLowerCase()}`;
    const duplicate = Boolean(prospects.data?.some(existing => {
      const existingSignature = existing.email?.trim().toLowerCase()
        ? `email:${existing.email.trim().toLowerCase()}`
        : `contact:${`${existing.firstName ?? ""} ${existing.lastName ?? ""}`.trim().toLowerCase()}|${(existing.company ?? "").trim().toLowerCase()}`;
      return signature !== "contact:|" && existingSignature === signature;
    }));
    void candidate;
    return {
      rowNumber: index + 2,
      firstName, lastName, company, email,
      phone: cell("phone"), source: cell("source"),
      stage: parsedStage ?? "new",
      estimatedValueCents: Math.round((Number.isFinite(value) ? value : 0) * 100),
      notes: cell("notes"), error, duplicate,
    };
  }), [rawRows, mapping, prospects.data]);

  if (!open) return null;
  const validCount = normalized.filter(row => !row.error).length;
  const duplicateCount = normalized.filter(row => !row.error && row.duplicate).length;
  const importableCount = validCount - (includeDuplicates ? 0 : duplicateCount);
  const close = () => {
    if (commit.isPending) return;
    setFileName(""); setHeaders([]); setRawRows([]); setResult(null); setIncludeDuplicates(false);
    onClose();
  };
  const handleFile = async (file?: File) => {
    if (!file) return;
    setResult(null);
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) { toast.error("This workbook has no readable worksheet."); return; }
      const data = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false });
      const nextHeaders = (data[0] ?? []).map(value => String(value ?? "").trim());
      if (!nextHeaders.length || !nextHeaders.some(Boolean)) { toast.error("The first row needs column headers."); return; }
      const nextRows = data.slice(1).filter(row => row.some(value => String(value ?? "").trim() !== ""));
      if (nextRows.length > 1000) { toast.error("This workbook has more than 1,000 rows. Split it into smaller files."); return; }
      const defaults = {} as Record<Field, number | "">;
      (Object.keys(fieldLabels) as Field[]).forEach(field => {
        const match = nextHeaders.findIndex(header => mapHeader(header, field));
        defaults[field] = match >= 0 ? match : "";
      });
      setFileName(file.name); setHeaders(nextHeaders); setRawRows(nextRows); setMapping(defaults);
    } catch {
      toast.error("Could not read this file. Choose a valid .xlsx, .xls or .csv workbook.");
    }
  };
  const updateMapping = (field: Field, value: string) => setMapping(current => ({ ...current, [field]: value === "" ? "" : Number(value) }));
  const startImport = () => {
    const rows = normalized.filter(row => !row.error).map(({ rowNumber: _rowNumber, error: _error, duplicate: _duplicate, ...row }) => ({
      ...row,
      ...(row.firstName ? { firstName: row.firstName } : {}),
      ...(row.lastName ? { lastName: row.lastName } : {}),
      ...(row.company ? { company: row.company } : {}),
      ...(row.email ? { email: row.email } : {}),
      ...(row.phone ? { phone: row.phone } : {}),
      ...(row.source ? { source: row.source } : {}),
      ...(row.notes ? { notes: row.notes } : {}),
    }));
    commit.mutate({ fileName, totalRows: rawRows.length, errorRows: normalized.filter(row => Boolean(row.error)).length, includeDuplicates, rows });
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}>
      <section className="modal-card import-modal" role="dialog" aria-modal="true" aria-labelledby="import-title">
        <div className="modal-heading"><div><div className="section-kicker">BULK ADD</div><h2 id="import-title">Import from Excel</h2><p>Map columns, review the data and bring new relationships into your pipeline.</p></div><button className="icon-button" onClick={close} aria-label="Close"><X size={18} /></button></div>
        {!headers.length ? <label className="dropzone" htmlFor="excel-file"><input id="excel-file" type="file" accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv" onChange={event => void handleFile(event.target.files?.[0])} /><div className="dropzone-icon"><Upload size={22} /></div><strong>Drop your workbook here</strong><span>or <u>browse files</u> · .xlsx, .xls or .csv · up to 1,000 rows</span><div className="dropzone-trust"><FileSpreadsheet size={14} />The file is read in your browser before import.</div></label> : result ? <div className="import-success"><div className="success-check"><Check size={22} /></div><div className="section-kicker">IMPORT COMPLETE</div><h3>Your pipeline just got bigger.</h3><p>{result.importedRows} prospects added · {result.duplicateRows} duplicate rows · {result.errorRows} rows with errors</p><button className="button-primary" onClick={close}>Done</button></div> : <>
          <div className="selected-file"><div className="file-icon"><FileSpreadsheet size={18} /></div><div><strong>{fileName}</strong><span>{rawRows.length} data rows · first worksheet</span></div><button className="text-button" onClick={() => { setHeaders([]); setRawRows([]); setFileName(""); }}>Change file</button></div>
          <div className="import-step-title"><div><span className="step-number">1</span><div><strong>Map your columns</strong><span>We’ve suggested matches based on the column headers.</span></div></div><ArrowRight size={15} /></div>
          <div className="mapping-grid">{(Object.keys(fieldLabels) as Field[]).map(field => <label className="mapping-row" key={field}><span>{fieldLabels[field]}</span><select value={mapping[field]} onChange={event => updateMapping(field, event.target.value)}><option value="">Don’t import</option>{headers.map((header, index) => <option value={index} key={`${header}-${index}`}>{header || `Column ${index + 1}`}</option>)}</select></label>)}</div>
          <div className="preview-heading"><div><span className="step-number">2</span><div><strong>Review your data</strong><span>{validCount} valid · {duplicateCount} potential duplicates · {normalized.filter(row => row.error).length} errors</span></div></div><span className="preview-limits">Preview · {Math.min(normalized.length, 5)} of {normalized.length}</span></div>
          <div className="import-preview-wrap"><table className="import-preview"><thead><tr><th>ROW</th><th>NAME / COMPANY</th><th>EMAIL</th><th>STAGE</th><th>VALUE</th><th>REVIEW</th></tr></thead><tbody>{normalized.slice(0, 5).map(row => <tr key={row.rowNumber}><td>#{row.rowNumber}</td><td><strong>{displayName(row)}</strong>{row.company && row.firstName && <span>{row.company}</span>}</td><td>{row.email || "—"}</td><td><span className={`stage-badge stage-badge-${row.stage}`}>{STAGE_LABELS[row.stage]}</span></td><td>{formatMoney(row.estimatedValueCents)}</td><td>{row.error ? <span className="import-row-error">{row.error}</span> : row.duplicate ? <span className="import-row-duplicate">Duplicate</span> : <span className="import-row-valid"><Check size={12} />Ready</span>}</td></tr>)}</tbody></table></div>
          <label className="duplicate-option"><input type="checkbox" checked={includeDuplicates} onChange={event => setIncludeDuplicates(event.target.checked)} /><span><strong>Import duplicates anyway</strong><small>Off by default. Existing matches are skipped to keep your directory clean.</small></span></label>
          <div className="modal-actions import-actions"><span>{importableCount} row{importableCount === 1 ? "" : "s"} will be imported</span><button className="button-secondary" onClick={close}>Cancel</button><button className="button-primary" onClick={startImport} disabled={commit.isPending || importableCount === 0}>{commit.isPending ? <><Loader2 size={15} className="spin" />Importing…</> : <><ArrowDownToLine size={15} />Import prospects</>}</button></div>
        </>}
      </section>
    </div>
  );
}
