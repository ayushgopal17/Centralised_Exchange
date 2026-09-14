"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CircleUserRound, LogOut, Menu, Settings, WalletCards, X } from "lucide-react";
import { useState } from "react";
import { Protected, useAuth } from "./auth-provider";

const links = [
  { href: "/", label: "Trade", icon: BarChart3 },
  { href: "/markets", label: "Markets", icon: BarChart3 },
  { href: "/wallet", label: "Portfolio", icon: WalletCards },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { username, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <Protected>
      <div className="app-frame">
        <header className="topbar">
          <Link href="/" className="brand" aria-label="Nexora home">
            <span className="brand-mark">N</span><span>NEXORA</span><span className="version-pill">V1</span>
          </Link>
          <nav className="desktop-nav" aria-label="Primary navigation">
            {links.map(({ href, label }) => <Link key={href} href={href} className={pathname === href ? "active" : ""}>{label}</Link>)}
          </nav>
          <div className="topbar-actions">
            <span className="api-status"><i /> REST connected</span>
            <button className="profile-chip" type="button" onClick={() => setMenuOpen(true)}><CircleUserRound size={17} />{username}</button>
            <button className="mobile-menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Open menu">{menuOpen ? <X /> : <Menu />}</button>
          </div>
        </header>
        <div className={`mobile-drawer ${menuOpen ? "open" : ""}`}>
          <nav>
            {links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={() => setMenuOpen(false)} className={pathname === href ? "active" : ""}><Icon size={18} />{label}</Link>)}
            <button onClick={logout}><LogOut size={18} />Sign out</button>
          </nav>
        </div>
        <main>{children}</main>
      </div>
    </Protected>
  );
}

