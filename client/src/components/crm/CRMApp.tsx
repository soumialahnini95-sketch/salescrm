import {
  ArrowDownToLine,
  Bell,
  ChevronDown,
  CircleHelp,
  Clock3,
  Columns3,
  Command,
  LayoutDashboard,
  LogOut,
  Plus,
  Search,
  Settings2,
  UsersRound,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import type { FollowUp, Prospect } from "./types";
import { displayName } from "./types";
import DashboardPage from "./DashboardPage";
import FollowUpsPage from "./FollowUpsPage";
import ImportDialog from "./ImportDialog";
import PipelinePage from "./PipelinePage";
import ProspectDialog from "./ProspectDialog";
import ProspectDetailDialog from "./ProspectDetailDialog";
import ProspectsPage from "./ProspectsPage";

type Section = "overview" | "prospects" | "pipeline" | "followups";
type AuthUser = { name?: string | null; email?: string | null } | null;

const sectionMeta: Record<Section, { title: string; eyebrow: string }> = {
  overview: { title: "Revenue cockpit", eyebrow: "Workspace / Overview" },
  prospects: { title: "Prospect directory", eyebrow: "Workspace / Prospects" },
  pipeline: { title: "Pipeline board", eyebrow: "Workspace / Pipeline" },
  followups: { title: "Follow-up desk", eyebrow: "Workspace / Follow-ups" },
};

export default function CRMApp({ user, logout }: { user: AuthUser; logout: () => Promise<void> }) {
  const [section, setSection] = useState<Section>("overview");
  const [showImport, setShowImport] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const dashboard = trpc.crm.dashboard.useQuery(undefined, {
    refetchOnWindowFocus: true,
    staleTime: 15_000,
  });
  const utils = trpc.useUtils();
  const updateStage = trpc.crm.prospects.updateStage.useMutation({
    onSuccess: () => {
      void utils.crm.dashboard.invalidate();
      void utils.crm.prospects.list.invalidate();
      toast.success("Pipeline stage updated");
    },
    onError: error => toast.error(error.message || "Could not update stage"),
  });
  const userName = user?.name?.trim() || user?.email?.split("@")[0] || "Sales team";
  const initials = userName.split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map(x => x[0]?.toUpperCase()).join("");
  const dueCount = dashboard.data?.metrics.dueCount ?? 0;
  const title = sectionMeta[section];
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  }, []);

  const selectSection = (next: Section) => {
    setSection(next);
    setMobileNavOpen(false);
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Signed out");
    } catch {
      toast.error("Could not sign out. Please try again.");
    }
  };

  const handleStageChange = (prospectId: number, stage: Prospect["stage"]) => {
    updateStage.mutate({ id: prospectId, stage });
  };

  const openProspect = (prospect: Prospect) => setSelectedProspect(prospect);
  const tasks: FollowUp[] = dashboard.data?.followUps ?? [];

  return (
    <div className="crm-shell">
      <aside className={`crm-sidebar ${mobileNavOpen ? "is-open" : ""}`}>
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 40 40" fill="none">
              <path d="M8 29.5 19.8 10l12.4 19.5" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="8" cy="30" r="3.8" fill="#111827" stroke="currentColor" strokeWidth="2.2" />
              <circle cx="20" cy="10" r="3.8" fill="#111827" stroke="currentColor" strokeWidth="2.2" />
              <circle cx="32" cy="30" r="3.8" fill="#111827" stroke="currentColor" strokeWidth="2.2" />
              <circle cx="20" cy="23" r="2.2" fill="currentColor" />
            </svg>
          </div>
          <div>
            <div className="brand-name">PULSE<span>CRM</span></div>
            <div className="brand-caption">SALES INTELLIGENCE</div>
          </div>
          <button className="sidebar-collapse" aria-label="Collapse sidebar" title="Collapse sidebar"><ChevronDown size={15} /></button>
        </div>

        <div className="workspace-picker">
          <div className="workspace-icon"><Command size={15} /></div>
          <div className="workspace-copy"><span>Workspace</span><strong>Sales team</strong></div>
          <ChevronDown size={15} className="muted-icon" />
        </div>

        <div className="side-label">WORKSPACE</div>
        <nav className="primary-nav" aria-label="Main navigation">
          <button className={section === "overview" ? "nav-item active" : "nav-item"} onClick={() => selectSection("overview")}>
            <LayoutDashboard size={18} /><span>Overview</span><span className="nav-shortcut">⌘ 1</span>
          </button>
          <button className={section === "prospects" ? "nav-item active" : "nav-item"} onClick={() => selectSection("prospects")}>
            <UsersRound size={18} /><span>Prospects</span><span className="nav-count">{dashboard.data?.metrics.total ?? 0}</span>
          </button>
          <button className={section === "pipeline" ? "nav-item active" : "nav-item"} onClick={() => selectSection("pipeline")}>
            <Columns3 size={18} /><span>Pipeline</span><span className="nav-dot" />
          </button>
          <button className={section === "followups" ? "nav-item active" : "nav-item"} onClick={() => selectSection("followups")}>
            <Clock3 size={18} /><span>Follow-ups</span>{dueCount > 0 && <span className="nav-alert-count">{dueCount}</span>}
          </button>
        </nav>

        <div className="sidebar-bottom">
          <div className="side-label">QUICK ACCESS</div>
          <button className="nav-item quiet" onClick={() => setShowImport(true)}><ArrowDownToLine size={17} /><span>Import data</span></button>
          <button className="nav-item quiet" onClick={() => toast.info("Your workspace settings are coming soon.")}><Settings2 size={17} /><span>Settings</span></button>
          <button className="nav-item quiet" onClick={() => toast.info("Help center is coming soon.")}><CircleHelp size={17} /><span>Help center</span></button>
          <div className="sidebar-promo">
            <div className="promo-orbit"><Zap size={16} fill="currentColor" /></div>
            <div><strong>Keep the momentum</strong><p>Every follow-up is a new chance to close.</p></div>
            <span className="promo-light" />
          </div>
          <div className="user-profile">
            <div className="avatar-initials">{initials || "S"}</div>
            <div className="user-copy"><strong>{userName}</strong><span>Personal workspace</span></div>
            <button className="icon-button profile-menu" title="Sign out" aria-label="Sign out" onClick={() => void handleLogout()}><LogOut size={16} /></button>
          </div>
        </div>
      </aside>

      {mobileNavOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}
      <main className="crm-main">
        <header className="topbar">
          <button className="mobile-menu-button" aria-label="Open navigation" onClick={() => setMobileNavOpen(true)}><Command size={19} /></button>
          <div className="breadcrumbs"><span>Workspace</span><span className="crumb-sep">/</span><strong>{title.eyebrow.split(" / ")[1]}</strong></div>
          <div className="topbar-actions">
            <button className="command-search" type="button" aria-label="Search prospects" onClick={() => selectSection("prospects")}><Search size={15} /><span>Search prospects</span></button>
            <button className="top-icon-button" aria-label="Notifications" title={`${dueCount} open follow-ups`} onClick={() => selectSection("followups")}>
              <Bell size={17} />{dueCount > 0 && <i />}
            </button>
            <div className="topbar-divider" />
            <div className="mini-avatar">{initials || "S"}</div>
          </div>
        </header>

        <section className="page-wrap">
          <div className="page-heading-row">
            <div>
              <div className="page-eyebrow"><span className="eyebrow-pulse" />{title.eyebrow}</div>
              <h1>{section === "overview" ? `${greeting}, ${userName.split(" ")[0]}.` : title.title}</h1>
              <p className="page-subtitle">{section === "overview" ? "Your next win starts with the next conversation." : section === "prospects" ? "A clear view of every relationship in motion." : section === "pipeline" ? "Move every opportunity one step closer to yes." : "Stay ahead of every conversation that matters."}</p>
            </div>
            <div className="heading-actions">
              <button className="button-secondary" onClick={() => setShowImport(true)}><ArrowDownToLine size={16} /><span>Import</span></button>
              <button className="button-primary" onClick={() => setShowCreate(true)}><Plus size={17} /><span>Add prospect</span></button>
            </div>
          </div>

          {dashboard.isLoading ? (
            <div className="loading-panel"><div className="loading-ring" /><span>Loading your sales workspace…</span></div>
          ) : dashboard.error ? (
            <div className="error-panel"><strong>We couldn’t load your workspace.</strong><span>{dashboard.error.message}</span><button className="button-secondary" onClick={() => void dashboard.refetch()}>Try again</button></div>
          ) : (
            <>
              {section === "overview" && <DashboardPage data={dashboard.data!} onOpenProspect={openProspect} onGoTo={selectSection} />}
              {section === "prospects" && <ProspectsPage prospects={dashboard.data!.prospects} onOpenProspect={openProspect} />}
              {section === "pipeline" && <PipelinePage prospects={dashboard.data!.prospects} onOpenProspect={openProspect} onStageChange={handleStageChange} />}
              {section === "followups" && <FollowUpsPage followUps={tasks} prospects={dashboard.data!.prospects} />}
            </>
          )}
        </section>
      </main>

      <ImportDialog open={showImport} onClose={() => setShowImport(false)} onImported={() => void utils.crm.dashboard.invalidate()} />
      <ProspectDialog open={showCreate} onClose={() => setShowCreate(false)} onSaved={() => void utils.crm.dashboard.invalidate()} />
      <ProspectDetailDialog prospect={selectedProspect} onClose={() => setSelectedProspect(null)} onChanged={() => void utils.crm.dashboard.invalidate()} />
    </div>
  );
}
