import { ArrowRight, GripVertical } from "lucide-react";
import { useState } from "react";
import type { Prospect, Stage } from "./types";
import { displayName, formatMoney, STAGES, STAGE_LABELS } from "./types";

export default function PipelinePage({ prospects, onOpenProspect, onStageChange }: {
  prospects: Prospect[];
  onOpenProspect: (prospect: Prospect) => void;
  onStageChange: (prospectId: number, stage: Stage) => void;
}) {
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [hoveredStage, setHoveredStage] = useState<Stage | null>(null);
  const active = prospects.filter(prospect => prospect.stage !== "won" && prospect.stage !== "lost");
  const totalValue = active.reduce((sum, prospect) => sum + prospect.estimatedValueCents, 0);

  return (
    <div className="view-stack">
      <div className="pipeline-summary"><div><span>OPEN PIPELINE</span><strong>{formatMoney(totalValue, true)}</strong></div><div><span>ACTIVE OPPORTUNITIES</span><strong>{active.length}</strong></div><div className="pipeline-hint"><GripVertical size={15} /><span>Drag cards across stages to keep momentum moving.</span></div></div>
      <div className="kanban-scroll"><div className="kanban-board">
        {STAGES.map((stage, stageIndex) => {
          const items = prospects.filter(prospect => prospect.stage === stage);
          const value = items.reduce((sum, prospect) => sum + prospect.estimatedValueCents, 0);
          return (
            <section className={`kanban-column ${hoveredStage === stage ? "drop-target" : ""} ${stage === "won" || stage === "lost" ? "closed-column" : ""}`} key={stage}
              onDragOver={event => { event.preventDefault(); setHoveredStage(stage); }}
              onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setHoveredStage(null); }}
              onDrop={event => { event.preventDefault(); const id = draggedId ?? Number(event.dataTransfer.getData("text/plain")); if (id) onStageChange(id, stage); setDraggedId(null); setHoveredStage(null); }}>
              <div className="kanban-column-heading"><div><span className={`stage-dot stage-${stage}`} /><strong>{STAGE_LABELS[stage]}</strong><span className="column-count">{items.length}</span></div><span className="column-value">{formatMoney(value, true)}</span></div>
              <div className="kanban-column-line"><span className={`line-${stage}`} /></div>
              <div className="kanban-cards">
                {items.map((prospect, index) => (
                  <article className={`deal-card ${draggedId === prospect.id ? "dragging" : ""}`} key={prospect.id} draggable
                    onDragStart={event => { setDraggedId(prospect.id); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", String(prospect.id)); }}
                    onDragEnd={() => { setDraggedId(null); setHoveredStage(null); }}
                    onClick={() => onOpenProspect(prospect)}>
                    <div className="deal-card-top"><span className={`deal-tag tag-${stage}`}>{stage === "won" ? "CLOSED WON" : stage === "lost" ? "CLOSED LOST" : `0${stageIndex + 1} / 04`}</span><button className="deal-open" aria-label={`Open ${displayName(prospect)}`}><ArrowRight size={14} /></button></div>
                    <strong className="deal-name">{displayName(prospect)}</strong>
                    <span className="deal-company">{prospect.company || prospect.email || "No company"}</span>
                    <div className="deal-card-bottom"><span className="deal-value">{formatMoney(prospect.estimatedValueCents)}</span><div className={`deal-avatar avatar-tone-${index % 5}`}>{displayName(prospect).split(/[\s@._-]+/).map(x => x[0]).slice(0, 2).join("").toUpperCase()}</div></div>
                  </article>
                ))}
                {items.length === 0 && <div className="column-empty">Drop an opportunity here</div>}
              </div>
            </section>
          );
        })}
      </div></div>
    </div>
  );
}
