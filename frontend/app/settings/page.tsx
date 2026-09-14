"use client";

import { useEffect, useState } from "react";
import { Bell, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";

export default function SettingsPage() {
  const { username, logout } = useAuth();
  const [orderConfirmations, setOrderConfirmations] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    setOrderConfirmations(localStorage.getItem("cex_confirmations") !== "false");
    setReducedMotion(localStorage.getItem("cex_reduced_motion") === "true");
  }, []);
  const save = () => {
    localStorage.setItem("cex_confirmations", String(orderConfirmations));
    localStorage.setItem("cex_reduced_motion", String(reducedMotion));
    document.documentElement.classList.toggle("reduce-motion", reducedMotion);
    toast.success("Preferences saved");
  };
  return <AppShell><div className="content-page settings-page">
    <div className="page-title-row"><div><div className="eyebrow">PERSONALIZE</div><h1>Settings</h1><p>Profile, security, and interface preferences.</p></div></div>
    <div className="settings-grid">
      <section className="panel settings-section"><div className="settings-icon"><UserRound /></div><div className="settings-copy"><h2>Profile</h2><p>Your username is managed by the exchange account.</p><label>Username</label><input value={username} disabled /><small>Username changes are not supported by the V1 API.</small></div></section>
      <section className="panel settings-section"><div className="settings-icon"><ShieldCheck /></div><div className="settings-copy"><h2>Security</h2><p>Your authenticated session is stored on this device.</p><div className="security-row"><span><i /> Session active</span><button className="outline-button danger" onClick={logout}><LogOut size={15} /> Sign out</button></div><small>Password changes and 2FA are not available in V1.</small></div></section>
      <section className="panel settings-section wide"><div className="settings-icon"><Bell /></div><div className="settings-copy"><h2>Preferences</h2><p>Choose how Nexora behaves on this device.</p><div className="toggle-row"><div><strong>Order feedback</strong><span>Show confirmations after exchange actions.</span></div><button role="switch" aria-checked={orderConfirmations} className={`switch ${orderConfirmations ? "on" : ""}`} onClick={() => setOrderConfirmations(!orderConfirmations)}><i /></button></div><div className="toggle-row"><div><strong>Reduce motion</strong><span>Minimize interface animation and transitions.</span></div><button role="switch" aria-checked={reducedMotion} className={`switch ${reducedMotion ? "on" : ""}`} onClick={() => setReducedMotion(!reducedMotion)}><i /></button></div><button className="primary-button save-settings" onClick={save}>Save preferences</button></div></section>
    </div>
  </div></AppShell>;
}

