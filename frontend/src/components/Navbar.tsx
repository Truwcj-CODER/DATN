"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { useSensorContext } from "@/context/SensorContext";
import { useEffect, useState } from "react";

const TABS = [
  { href: "/dashboard", label: "Biểu đồ" },
  { href: "/history",   label: "Dữ liệu" },
  { href: "/training",  label: "Huấn luyện" },
  { href: "/crops",     label: "Cây trồng" },
  { href: "/settings",  label: "Thiết bị" },
];

export default function Navbar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { isWatering } = useSensorContext();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = theme === "dark";

  return (
    <nav className="nav-bar">
      <div className="nav-left">
        <div className="logo-text">HỆ THỐNG HỌC MÁY</div>
        <div className="nav-tabs">
          {TABS.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={pathname === tab.href ? "active" : ""}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="nav-right" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div
          className="status-badge"
          style={{
            background: isWatering ? "#fee2e2" : undefined,
            color:      isWatering ? "#b91c1c" : undefined,
            border:     isWatering ? "1px solid #fca5a5" : undefined,
            fontWeight: 700,
            fontSize:   "0.78rem",
          }}
        >
          {isWatering ? "CẦN TƯỚI NƯỚC" : "BÌNH THƯỜNG"}
        </div>

        {mounted && (
          <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            title={isDark ? "Chuyển sáng" : "Chuyển tối"}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 34, height: 34, borderRadius: 8, cursor: "pointer",
              border: "1px solid var(--border-color)",
              background: "var(--card-bg)", color: "var(--text-dark)",
              transition: "background 0.15s",
            }}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        )}
      </div>
    </nav>
  );
}
