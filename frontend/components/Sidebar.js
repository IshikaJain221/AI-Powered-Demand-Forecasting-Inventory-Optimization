"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  TrendingUp,
  Zap,
  FlaskConical,
  MessageCircle,
  History,
  Boxes,
} from "lucide-react";

const NAV = [
  { href: "/", label: "Overview", icon: LayoutGrid },
  { href: "/forecasting", label: "Forecasting", icon: TrendingUp },
  { href: "/risk", label: "Risk & shocks", icon: Zap },
  { href: "/simulation", label: "Simulation", icon: FlaskConical },
  { href: "/copilot", label: "Copilot", icon: MessageCircle },
  { href: "/backtesting", label: "Backtesting", icon: History },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      style={{
        width: 226,
        flexShrink: 0,
        background: "var(--surface)",
        borderRight: "1px solid var(--border)",
        padding: "20px 14px",
        position: "sticky",
        top: 0,
        height: "100vh",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 8px 22px" }}>
        <Boxes size={20} color="var(--accent-blue)" />
        <span style={{ fontWeight: 600, fontSize: 15 }}>Inventory copilot</span>
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "9px 10px",
                borderRadius: 6,
                fontSize: 14,
                fontWeight: active ? 500 : 400,
                color: active ? "var(--ink)" : "var(--ink-secondary)",
                background: active ? "var(--surface-sunken)" : "transparent",
              }}
            >
              <Icon size={17} strokeWidth={active ? 2.2 : 1.8} />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
