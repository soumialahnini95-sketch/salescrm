import { ArrowDownWideNarrow, ArrowUpDown, Search, SlidersHorizontal, UsersRound, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { Prospect, Stage } from "./types";
import { displayName, formatDate, formatMoney, STAGE_LABELS, STAGES } from "./types";

export default function ProspectsPage({ prospects, onOpenProspect }: {
  prospects: Prospect[];
  onOpenProspect: (prospect: Prospect) => void;
}) {
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState<Stage | "all">("all");
  const [source, setSource] = useState("all");
  const [sort, setSort] = useState<"updated" | "value" | "name">("updated");
  const sources = useMemo(() => Array.from(new Set(prospects.map(item => item.source).filter(Boolean) as string[])).sort(), [prospects]);
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return prospects.filter(item => {
      const matchesSearch = !needle || [item.firstName, item.lastName, item.company, item.email, item.phone, item.source]
        .some(value => value?.toLowerCase().includes(needle));
      return matchesSearch && (stage === "all" || item.stage === stage) && (source === "all" || item.source === source);
    }).sort((a, b) => {
      if (sort === "value") return b.estimatedValueCents - a.estimatedValueCents;
      if (sort === "name") return displayName(a).localeCompare(displayName(b));
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [prospects, search, stage, source, sort]);
  const clearFilters = () => { setSearch(""); setStage("all"); setSource("all"); };

  return (
    <div className="view-stack">
      <section className="panel directory-panel">
        <div className="directory-toolbar">
          <div className="directory-count"><strong>{filtered.length}</strong><span>{filtered.length === 1 ? "prospect" : "prospects"}{filtered.length !== prospects.length ? " found" : " in your book"}</span></div>
          <div className="filter-controls">
            <label className="search-field"><Search size={16} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search name, company, email…" aria-label="Search prospects" />{search && <button className="input-clear" onClick={() => setSearch("")} aria-label="Clear search"><X size={14} /></button>}</label>
            <label className="filter-select"><SlidersHorizontal size={15} /><select aria-label="Filter by stage" value={stage} onChange={event => setStage(event.target.value as Stage | "all")}><option value="all">All stages</option>{STAGES.map(value => <option value={value} key={value}>{STAGE_LABELS[value]}</option>)}</select></label>
            <label className="filter-select source-filter"><select aria-label="Filter by source" value={source} onChange={event => setSource(event.target.value)}><option value="all">All sources</option>{sources.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
            <button className="sort-button" onClick={() => setSort(value => value === "updated" ? "value" : value === "value" ? "name" : "updated")} title={`Sort by ${sort}`}><ArrowUpDown size={15} /><span>{sort === "updated" ? "Recent" : sort === "value" ? "Value" : "Name"}</span></button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-directory">
            <div className="empty-icon"><UsersRound size={21} /></div>
            <strong>{prospects.length ? "No prospects match your filters." : "Your directory is ready."}</strong>
            <span>{prospects.length ? "Try a different search or clear the filters." : "Add a prospect or import your Excel workbook to get started."}</span>
            {(search || stage !== "all" || source !== "all") && <button className="text-button" onClick={clearFilters}>Clear filters <X size={14} /></button>}
          </div>
        ) : (
          <div className="directory-table-wrap"><table className="directory-table"><thead><tr><th>PROSPECT</th><th>COMPANY</th><th>STAGE</th><th>VALUE</th><th>SOURCE</th><th>LAST UPDATED</th><th /></tr></thead><tbody>
            {filtered.map((prospect, index) => (
              <tr key={prospect.id} className="clickable-row" onClick={() => onOpenProspect(prospect)}>
                <td><div className="prospect-cell"><div className={`table-avatar avatar-tone-${index % 5}`}>{displayName(prospect).split(/[\s@._-]+/).map(x => x[0]).slice(0, 2).join("").toUpperCase()}</div><div><strong>{displayName(prospect)}</strong><span>{prospect.email || prospect.phone || "No contact details"}</span></div></div></td>
                <td className="muted-cell">{prospect.company || "—"}</td>
                <td><span className={`stage-badge stage-badge-${prospect.stage}`}>{STAGE_LABELS[prospect.stage]}</span></td>
                <td className="value-cell">{formatMoney(prospect.estimatedValueCents)}</td>
                <td><span className="source-tag">{prospect.source || "—"}</span></td>
                <td className="updated-cell">{formatDate(prospect.updatedAt, { month: "short", day: "numeric", year: "numeric" })}</td>
                <td><button className="row-open" aria-label={`Open ${displayName(prospect)}`}><ArrowDownWideNarrow size={15} /></button></td>
              </tr>
            ))}
          </tbody></table></div>
        )}
        <div className="table-footer"><span>Showing {filtered.length} of {prospects.length}</span><span>Search updates as you type</span></div>
      </section>
    </div>
  );
}
