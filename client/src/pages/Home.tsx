import { LockKeyhole, Zap } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import CRMApp from "@/components/crm/CRMApp";

export default function Home() {
  const auth = useAuth({ redirectOnUnauthenticated: true });

  if (auth.loading) {
    return <div className="auth-loading"><div className="loading-ring" /><span>Securing your sales workspace…</span></div>;
  }

  if (!auth.user) {
    return (
      <main className="login-screen">
        <div className="login-card">
          <div className="brand-mark large" aria-hidden="true"><Zap size={25} /></div>
          <div className="section-kicker">PULSE CRM</div>
          <h1>Your next win starts here.</h1>
          <p>Sign in with your Manus account to access your private prospect workspace.</p>
          <button className="button-primary login-button" onClick={startLogin}><LockKeyhole size={16} />Continue with Manus</button>
          <div className="login-privacy">Your prospects are private to your account.</div>
        </div>
      </main>
    );
  }

  return <CRMApp user={auth.user} logout={auth.logout} />;
}
