"use client";

import React from "react";

// ------------------------------------------------------------------ //
//  Types                                                               //
// ------------------------------------------------------------------ //

export interface CropMetric {
  value: number;
  status: "ok" | "warning" | "critical";
  optimal: { min: number; max: number };
  warning: { min: number; max: number };
  tip: string | null;
}

export interface CropAdvisory {
  crop_type: string;
  crop_name: string;
  crop_emoji: string;
  overall_status: "ok" | "warning" | "critical";
  n_critical: number;
  n_warning: number;
  metrics: Record<string, CropMetric>;
}

// ------------------------------------------------------------------ //
//  Status config                                                       //
// ------------------------------------------------------------------ //

const METRIC_LABELS: Record<string, { label: string; unit: string }> = {
  humidity:         { label: "Độ ẩm không khí", unit: "%" },
  atmospheric_temp: { label: "Nhiệt độ không khí", unit: "°C" },
  soil_temp:        { label: "Nhiệt độ đất", unit: "°C" },
  soil_moisture:    { label: "Độ ẩm đất", unit: "%" },
  dew_point:        { label: "Điểm sương", unit: "°C" },
};

const STATUS_CONFIG = {
  ok:       { color: "#22c55e", bg: "#f0fdf4", border: "#bbf7d0", icon: "✅", label: "Tốt" },
  warning:  { color: "#f59e0b", bg: "#fffbeb", border: "#fde68a", icon: "⚠️", label: "Chú ý" },
  critical: { color: "#ef4444", bg: "#fff5f5", border: "#fecaca", icon: "🚨", label: "Nguy hiểm" },
};

// ------------------------------------------------------------------ //
//  CropSelector component                                              //
// ------------------------------------------------------------------ //

export function CropSelector({
  selected,
  onChange,
  crops = [],
}: {
  selected: string;
  onChange: (id: string) => void;
  crops?: any[];
}) {
  return (
    <div style={{
      display: "flex",
      gap: "0.5rem",
      background: "var(--card-bg)",
      padding: "4px",
      borderRadius: 10,
      border: "1px solid var(--border-color)",
    }}>
      {crops.map((c) => {
        const active = selected === c.id;
        const cfg = c; // c matches the structure {id, name, emoji...}
        return (
          <button
            key={c.id}
            onClick={() => onChange(c.id)}
            style={{
              flex: 1,
              padding: "0.4rem 0.85rem",
              borderRadius: 7,
              fontWeight: 700,
              fontSize: "0.82rem",
              cursor: "pointer",
              border: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.4rem",
              transition: "all 0.2s",
              background: active ? `linear-gradient(135deg, #3b82f6, #2563eb)` : "transparent",
              color: active ? "white" : "var(--text-dark)",
              boxShadow: active ? `0 2px 10px rgba(59,130,246,0.3)` : "none",
            }}
          >
            <span style={{ fontSize: "1rem" }}>{cfg.emoji}</span>
            {cfg.name}
          </button>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------ //
//  Metric gauge bar                                                    //
// ------------------------------------------------------------------ //

function MetricGauge({
  metricKey,
  metric,
}: {
  metricKey: string;
  metric: CropMetric;
}) {
  const cfg = METRIC_LABELS[metricKey];
  const status = STATUS_CONFIG[metric.status];
  const { min: warnMin, max: warnMax } = metric.warning;
  const { min: optMin, max: optMax } = metric.optimal;

  // Normalize value position for progress bar within warning range
  const total = warnMax - warnMin || 1;
  const pct = Math.max(0, Math.min(100, ((metric.value - warnMin) / total) * 100));
  const optStartPct = ((optMin - warnMin) / total) * 100;
  const optWidthPct = ((optMax - optMin) / total) * 100;

  return (
    <div style={{
      padding: "0.8rem 1rem",
      borderRadius: 10,
      background: status.bg,
      border: `1.5px solid ${status.border}`,
      transition: "all 0.3s",
    }}>
      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
          <span style={{ fontSize: "0.95rem" }}>{status.icon}</span>
          <span style={{ fontWeight: 600, fontSize: "0.82rem", color: "var(--text-dark)" }}>
            {cfg?.label ?? metricKey}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: "0.2rem" }}>
          <span style={{ fontWeight: 800, fontSize: "1.1rem", color: status.color }}>
            {metric.value.toFixed(1)}
          </span>
          <span style={{ fontSize: "0.72rem", color: "var(--text-gray)" }}>{cfg?.unit}</span>
        </div>
      </div>

      {/* Gauge bar */}
      <div style={{
        position: "relative",
        height: 8,
        borderRadius: 4,
        background: "#e2e8f0",
        overflow: "hidden",
        marginBottom: "0.35rem",
      }}>
        {/* Optimal zone (green band) */}
        <div style={{
          position: "absolute",
          left: `${optStartPct}%`,
          width: `${optWidthPct}%`,
          height: "100%",
          background: "rgba(34,197,94,0.25)",
          borderRadius: 4,
        }} />
        {/* Value indicator */}
        <div style={{
          position: "absolute",
          left: `${pct}%`,
          top: -1,
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: status.color,
          transform: "translateX(-50%)",
          boxShadow: `0 0 6px ${status.color}88`,
          border: "2px solid white",
        }} />
      </div>

      {/* Range hint */}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.67rem", color: "var(--text-gray)" }}>
        <span>Tốt: {optMin}–{optMax}{cfg?.unit}</span>
        <span style={{ color: status.color, fontWeight: 600 }}>{status.label}</span>
      </div>

      {/* Tip */}
      {metric.tip && (
        <div style={{
          marginTop: "0.45rem",
          padding: "0.3rem 0.6rem",
          background: `${status.color}15`,
          border: `1px solid ${status.color}33`,
          borderRadius: 6,
          fontSize: "0.72rem",
          color: status.color,
          lineHeight: 1.5,
        }}>
          💡 {metric.tip}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ //
//  CropStatusPanel — main exported component                          //
// ------------------------------------------------------------------ //

export default function CropStatusPanel({
  advisory,
  cropType,
  cropName,
  cropEmoji,
}: {
  advisory: CropAdvisory | null;
  cropType: string;
  cropName?: string;
  cropEmoji?: string;
}) {
  const name = advisory?.crop_name || cropName || "Cây trồng";
  const emoji = advisory?.crop_emoji || cropEmoji || "🌱";

  if (!advisory) {
    return (
      <div style={{
        padding: "1.5rem",
        textAlign: "center",
        color: "var(--text-gray)",
        background: "var(--card-bg)",
        border: "1px solid var(--border-color)",
        borderRadius: 12,
      }}>
        <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>{emoji}</div>
        <div style={{ fontWeight: 600 }}>Chưa có dữ liệu cảm biến</div>
        <div style={{ fontSize: "0.8rem", marginTop: "0.3rem" }}>
          Đang chờ dữ liệu từ ESP32...
        </div>
      </div>
    );
  }

  const overallCfg = STATUS_CONFIG[advisory.overall_status];
  const metricOrder = ["humidity", "atmospheric_temp", "soil_moisture", "soil_temp", "dew_point"];

  return (
    <div style={{
      background: "var(--card-bg)",
      border: "1.5px solid var(--border-color)",
      borderRadius: 14,
      overflow: "hidden",
    }}>
      {/* Panel header */}
      <div style={{
        background: "linear-gradient(135deg, #3b82f6, #2563eb)",
        padding: "0.85rem 1rem",
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
      }}>
        <div style={{
          width: 42,
          height: 42,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "1.5rem",
          border: "2px solid rgba(255,255,255,0.4)",
        }}>
          {emoji}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ color: "white", fontWeight: 700, fontSize: "0.95rem" }}>
            {name} — Trạng thái cây trồng
          </div>
          <div style={{ color: "rgba(255,255,255,0.85)", fontSize: "0.72rem", marginTop: 2 }}>
            {advisory.n_critical > 0
              ? `🚨 ${advisory.n_critical} chỉ số nguy hiểm`
              : advisory.n_warning > 0
              ? `⚠️ ${advisory.n_warning} chỉ số cần chú ý`
              : "✅ Môi trường phù hợp"}
          </div>
        </div>
        {/* Overall badge */}
        <div style={{
          padding: "0.25rem 0.7rem",
          borderRadius: 99,
          background: overallCfg.color,
          color: "white",
          fontWeight: 700,
          fontSize: "0.72rem",
          border: "2px solid rgba(255,255,255,0.4)",
        }}>
          {overallCfg.label.toUpperCase()}
        </div>
      </div>

      {/* Metrics grid */}
      <div style={{
        padding: "0.85rem",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "0.6rem",
      }}>
        {metricOrder.map((key) => {
          const m = advisory.metrics[key];
          if (!m) return null;
          return <MetricGauge key={key} metricKey={key} metric={m} />;
        })}
      </div>
    </div>
  );
}
