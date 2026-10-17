import { ArrowRight, ArrowUpRight, Clock3, Flame, Layers3, Sparkles, Target, TrendingUp, Trophy, UsersRound } from "lucide-react";
import type { FollowUp, Prospect } from "./types";
import { displayName, formatDate, formatMoney, STAGES, STAGE_LABELS } from "./types";

type DashboardData = {
  prospects: Prospect[];
  followUps: FollowUp[];
  metrics: {
    total: number;
    active: number;
    pipelineValueCents: number;
    wonValueCents: number;
    conversionRate: number;
    dueCount: number;
    overdueCount: number;
  };
};

type Section = "overview" | "prospects" | "pipeline" | "followups";
const INACTIVE_AFTER_DAYS = 14;

export default function DashboardPage({ data, onOpenProspect, onGoTo }: {
  data: DashboardData;
  onOpenProspect: (prospect: Prospect) => void;
  onGoTo: (section: Section) => void;
}) {
  const openTasks = data.followUps.filter(task => task.status === "open");
  const upcoming = [...openTasks].sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()).slice(0, 5);
  const stageValue = (stage: typeof STAGES[number]) => data.prospects.filter(p => p.stage === stage).reduce((sum, p) => sum + p.estimatedValueCents, 0);
  const maxStageValue = Math.max(1, ...STAGES.map(stageValue));
  const totalPipeline = data.metrics.pipelineValueCents || 0;
  const dueToday = openTasks.filter(task => new Date(task.dueAt).toDateString() === new Date().toDateString()).length;
  const inactiveBefore = Date.now() - INACTIVE_AFTER_DAYS * 24 * 60 * 60 * 1000;
  const staleProspects = data.prospects
    .filter(prospect => prospect.stage !== "won" && prospect.stage !== "lost" && new Date(prospect.updatedAt).getTime() < inactiveBefore)
    .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());

  const cards = [
    { label: "Active opportunities", value: String(data.metrics.active), note: `${data.metrics.total} prospects in your book`, icon: Layers3, accent: "blue" },
    { label: "Pipeline value", value: formatMoney(totalPipeline, true), note: "Across open opportunities", icon: TrendingUp, accent: "cyan" },
    { label: "Won revenue", value: formatMoney(data.metrics.wonValueCents, true), note: "Closed won to date", icon: Trophy, accent: "green" },
    { label: "Win rate", value: `${data.metrics.conversionRate}%`, note: "Of all closed opportunities", icon: Target, accent: "violet" },
  ];

  return (
    <div className="dashboard-grid">
      <div className="metric-grid">
        {cards.map((card, index) => {
          const Icon = card.icon;
          return (
            <article className={`metric-card accent-${card.accent}`} key={card.label} style={{ animationDelay: `${index * 55}ms` }}>
              <div className="metric-top"><span>{card.label}</span><span className="metric-icon"><Icon size={17} /></span></div>
              <div className="metric-value">{card.value}</div>
              <div className="metric-note"><span className="metric-live-dot" />{card.note}</div>
              <div className={`metric-sparkline ${index === 1 ? "cyan" : index === 2 ? "green" : index === 3 ? "violet" : ""}`}><span /><span /><span /><span /><span /><span /><span /></div>
            </article>
          );
        })}
      </div>

      <section className="panel pipeline-overview">
        <div className="panel-header">
          <div><div className="section-kicker">LIVE PIPELINE</div><h2>Opportunity flow</h2><p>Value moving through each stage</p></div>
          <button className="text-button" onClick={() => onGoTo("pipeline")}>Open pipeline <ArrowRight size={15} /></button>
        </div>
        {data.prospects.length === 0 ? (
          <div className="empty-inline"><div className="empty-icon"><Layers3 size={20} /></div><strong>Your pipeline is ready.</strong><span>Add your first prospect to see opportunities take shape here.</span></div>
        ) : (
          <div className="stage-bars">
            {STAGES.map(stage => {
              const deals = data.prospects.filter(p => p.stage === stage);
              const amount = deals.reduce((sum, p) => sum + p.estimatedValueCents, 0);
              const percent = Math.max(amount > 0 ? 2 : 0, Math.round((amount / maxStageValue) * 100));
              return (
                <div className="stage-row" key={stage}>
                  <div className="stage-meta"><span className={`stage-dot stage-${stage}`} /><span className="stage-name">{STAGE_LABELS[stage]}</span><span className="stage-deal-count">{deals.length}</span><strong>{formatMoney(amount, true)}</strong></div>
                  <div className="stage-track"><div className={`stage-fill stage-${stage}`} style={{ width: `${percent}%` }} /></div>
                </div>
              );
            })}
          </div>
        )}
        <div className="panel-footer pipeline-footer"><span><span className="tiny-line" />Total open pipeline</span><strong>{formatMoney(totalPipeline, true)}</strong></div>
      </section>

      <section className="panel followup-panel">
        <div className="panel-header compact">
          <div><div className="section-kicker">NEXT BEST ACTION</div><h2>Follow-ups</h2></div>
          <button className="round-arrow" aria-label="Open follow-ups" onClick={() => onGoTo("followups")}><ArrowRight size={16} /></button>
        </div>
        <div className="followup-summary">
          <div className="followup-summary-value">{data.metrics.dueCount}</div>
          <div><strong>Open reminders</strong><span>{dueToday} due today · {data.metrics.overdueCount} overdue</span>{staleProspects.length > 0 && <span className="stale-count-note">{staleProspects.length} inactive 14+ days</span>}</div>
          <div className="followup-icon"><Clock3 size={19} /></div>
        </div>
        <div className="task-list compact-list">
          {upcoming.length === 0 ? (
            <div className="empty-task"><Sparkles size={16} /><span>All clear. No open follow-ups.</span></div>
          ) : upcoming.map(task => {
            const linkedProspect = data.prospects.find(p => p.id === task.prospectId);
            const isOverdue = task.status === "open" && new Date(task.dueAt).getTime() < Date.now();
            return (
              <button className="task-row" key={task.id} onClick={() => linkedProspect && onOpenProspect(linkedProspect)}>
                <span className={`task-check ${isOverdue ? "is-overdue" : ""}`}><span /></span>
                <span className="task-copy"><strong>{task.title}</strong><span>{task.company || displayName({ firstName: task.prospectName, lastName: task.prospectLastName, company: task.company })}</span></span>
                <span className={`task-date ${isOverdue ? "overdue-text" : ""}`}>{isOverdue ? "Overdue" : formatDate(task.dueAt, { month: "short", day: "numeric" })}</span>
              </button>
            );
          })}
        </div>
        <button className="panel-link" onClick={() => onGoTo("followups")}>View all follow-ups <ArrowRight size={14} /></button>
      </section>

      <section className="panel recent-panel">
        <div className="panel-header">
          <div><div className="section-kicker">RECENTLY IN MOTION</div><h2>Latest prospects</h2><p>The relationships you touched most recently</p></div>
          <button className="text-button" onClick={() => onGoTo("prospects")}>All prospects <ArrowRight size={15} /></button>
        </div>
        {data.prospects.length === 0 ? (
          <div className="empty-inline recent-empty"><div className="empty-icon"><UsersRound size={20} /></div><strong>No prospects yet.</strong><span>Start with a name or company and build momentum from there.</span></div>
        ) : (
          <div className="recent-table-wrap"><table className="recent-table"><thead><tr><th>PROSPECT</th><th>STAGE</th><th>VALUE</th><th>UPDATED</th><th /></tr></thead><tbody>
            {data.prospects.slice(0, 5).map((prospect, index) => (
              <tr key={prospect.id} className="clickable-row" onClick={() => onOpenProspect(prospect)}>
                <td><div className="prospect-cell"><div className={`table-avatar avatar-tone-${index % 5}`}>{displayName(prospect).split(/[\s@._-]+/).map(x => x[0]).slice(0, 2).join("").toUpperCase()}</div><div><strong>{displayName(prospect)}</strong><span>{prospect.company || prospect.email || "No company listed"}</span></div></div></td>
                <td><span className={`stage-badge stage-badge-${prospect.stage}`}>{STAGE_LABELS[prospect.stage]}</span></td>
                <td className="value-cell">{formatMoney(prospect.estimatedValueCents)}</td>
                <td className="updated-cell">{formatDate(prospect.updatedAt, { month: "short", day: "numeric" })}</td>
                <td><ArrowRight size={15} className="row-arrow" /></td>
              </tr>
            ))}
          </tbody></table></div>
        )}
      </section>

      <aside className="insight-card">
        <div className="insight-glow" />
        <div className="insight-icon"><Flame size={17} /></div>
        <div className="section-kicker">MOMENTUM CHECK</div>
        <h3>{data.metrics.overdueCount > 0 ? "A warm lead is waiting." : staleProspects.length > 0 ? "Some conversations cooled off." : "Keep your pipeline warm."}</h3>
        <p>{data.metrics.overdueCount > 0 ? `You have ${data.metrics.overdueCount} overdue ${data.metrics.overdueCount === 1 ? "follow-up" : "follow-ups"}. A quick touch can keep the conversation moving.` : staleProspects.length > 0 ? `${staleProspects.length} active ${staleProspects.length === 1 ? "opportunity has" : "opportunities have"} not moved in ${INACTIVE_AFTER_DAYS}+ days. A timely check-in can restart the conversation.` : "Small, timely follow-ups are what turn a good conversation into a closed deal."}</p>
        {staleProspects.length > 0 && <div className="insight-stale-list">{staleProspects.slice(0, 2).map(prospect => <button key={prospect.id} className="stale-lead-link" onClick={() => onOpenProspect(prospect)}><span>{displayName(prospect)}</span><span>{formatDate(prospect.updatedAt, { month: "short", day: "numeric" })}</span></button>)}</div>}
        <button className="insight-action" onClick={() => data.metrics.overdueCount > 0 ? onGoTo("followups") : staleProspects.length > 0 ? onOpenProspect(staleProspects[0]) : onGoTo("followups")}>{data.metrics.overdueCount > 0 ? "Review overdue" : staleProspects.length > 0 ? "Open a quiet lead" : "View follow-ups"}<ArrowUpRight size={15} /></button>
        <div className="insight-decoration"><span /><span /><span /></div>
      </aside>
    </div>
  );
}
