"use client";

import React, { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  LineChart, Line, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend,
} from "recharts";
import { retrain, aiAnalyze } from "@/services/api";
import { useSensorContext } from "@/context/SensorContext";
import type { MetricsResult, TrainResult } from "@/types/sensor";

const MODEL_COLORS: Record<string, string> = {
  linear:        "#3b82f6",
  random_forest: "#22c55e",
  xgboost:       "#f97316",
};

const METRIC_LABELS: Record<string, string> = { rmse: "RMSE", mae: "MAE", r2: "R²" };

function MetricBarChart({ results }: { results: MetricsResult }) {
  const entries = Object.entries(results);
  const maxRmse = Math.max(...entries.map(([, v]) => v.rmse)) || 1;
  const maxMae  = Math.max(...entries.map(([, v]) => v.mae))  || 1;

  const radarData = [
    { metric: "R²",   ...Object.fromEntries(entries.map(([k, v]) => [k, parseFloat((v.r2).toFixed(4))])) },
    { metric: "RMSE", ...Object.fromEntries(entries.map(([k, v]) => [k, parseFloat((1 - v.rmse / maxRmse).toFixed(4))])) },
    { metric: "MAE",  ...Object.fromEntries(entries.map(([k, v]) => [k, parseFloat((1 - v.mae  / maxMae ).toFixed(4))])) },
  ];

  const MODEL_NAMES: Record<string, string> = { linear: "Linear Regression", random_forest: "Random Forest", xgboost: "XGBoost" };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem", marginTop: "1rem", alignItems: "start" }}>
      <div className="metric-card" style={{ gridRow: "span 1" }}>
        <div className="metric-title" style={{ marginBottom: 4 }}>Radar so sánh tổng thể</div>
        <div style={{ fontSize: "0.7rem", color: "var(--text-gray)", marginBottom: 8 }}>RMSE &amp; MAE đã đảo ngược (cao hơn = tốt hơn)</div>
        <ResponsiveContainer width="100%" height={280}>
          <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
            <PolarGrid stroke="var(--border-color)" />
            <PolarAngleAxis dataKey="metric" tick={{ fontSize: 13, fontWeight: 700, fill: "var(--text-dark)" }} />
            <PolarRadiusAxis angle={90} domain={[0, 1]} tickCount={4} tick={{ fontSize: 9, fill: "var(--text-gray)" }} />
            {entries.map(([key]) => (
              <Radar key={key} name={MODEL_NAMES[key]} dataKey={key} stroke={MODEL_COLORS[key]} fill={MODEL_COLORS[key]} fillOpacity={0.15} strokeWidth={2} />
            ))}
            <Legend wrapperStyle={{ fontSize: "0.78rem", paddingTop: 8 }} />
            <Tooltip formatter={(v, name) => [(v as number).toFixed(4), MODEL_NAMES[name as string] || (name as string)]} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {(["r2", "rmse", "mae"] as const).map((m) => {
          const data = entries.map(([key, v]) => ({ name: MODEL_NAMES[key], value: v[m], fill: MODEL_COLORS[key] }));
          return (
            <div key={m} className="metric-card" style={{ padding: "0.65rem 0.75rem" }}>
              <div className="metric-title" style={{ fontSize: "0.78rem", marginBottom: 2 }}>{METRIC_LABELS[m]}</div>
              <ResponsiveContainer width="100%" height={90}>
                <BarChart data={data} margin={{ top: 2, right: 4, left: -22, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 9 }} domain={[0, "auto"]} />
                  <Tooltip formatter={(v) => (v as number).toFixed(4)} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {data.map((entry, i) => <rect key={i} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CombinedPredChart({ chart_data, results }: { chart_data: Record<string, { actual: number[]; predicted: number[] }>; results: MetricsResult }) {
  const keys = Object.keys(chart_data);
  if (!keys.length) return null;
  const actual = chart_data[keys[0]].actual;
  const points = actual.map((a, i) => {
    const pt: Record<string, number> = { i, actual: a };
    keys.forEach((k) => { pt[k] = chart_data[k].predicted[i]; });
    return pt;
  });
  const MODEL_NAMES: Record<string, string> = { linear: "Linear Regression", random_forest: "Random Forest", xgboost: "XGBoost" };

  return (
    <div className="metric-card" style={{ marginTop: "1rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem", flexWrap: "wrap", gap: 8 }}>
        <div className="metric-title" style={{ margin: 0 }}>Predicted vs Actual — so sánh các mô hình</div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 24, height: 3, background: "#94a3b8", display: "inline-block", borderRadius: 2 }} />
            <span style={{ fontSize: "0.75rem", color: "var(--text-gray)", fontWeight: 600 }}>Thực tế</span>
          </div>
          {keys.map((k) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 24, height: 3, background: MODEL_COLORS[k], display: "inline-block", borderRadius: 2 }} />
              <span style={{ fontSize: "0.75rem", color: MODEL_COLORS[k], fontWeight: 700 }}>{MODEL_NAMES[k]}</span>
            </div>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={points} margin={{ top: 4, right: 12, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
          <XAxis dataKey="i" hide />
          <YAxis tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
          <Tooltip formatter={(v, name) => [(v as number).toFixed(4), (name as string) === "actual" ? "Thực tế" : (MODEL_NAMES[name as string] || (name as string))]} contentStyle={{ fontSize: "0.78rem" }} />
          <Line type="monotone" dataKey="actual" stroke="#94a3b8" dot={false} strokeWidth={1.5} strokeDasharray="4 3" />
          {keys.map((k) => (
            <Line key={k} type="monotone" dataKey={k} stroke={MODEL_COLORS[k]} dot={false} strokeWidth={2} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function BestModelBadge({ bestModel, results }: { bestModel: string; results: MetricsResult }) {
  const m = results[bestModel];
  if (!m) return null;
  const analysis = m.r2 >= 0.9 ? "Xuất sắc — mô hình học rất tốt dữ liệu này."
    : m.r2 >= 0.7 ? "Tốt — mô hình đáng tin cậy cho dự đoán thực tế."
    : m.r2 >= 0.5 ? "Trung bình — cần thêm dữ liệu để cải thiện."
    : "Kém — dữ liệu có thể chứa nhiễu hoặc chưa đủ.";
  return (
    <div style={{ marginTop: "1.5rem", padding: "1.25rem 1.5rem", background: "linear-gradient(135deg,#1e293b,#334155)", borderRadius: 8, color: "white" }}>
      <div style={{ fontSize: "0.72rem", fontWeight: 700, opacity: 0.8, textTransform: "uppercase", letterSpacing: 1 }}>🏆 Mô hình tốt nhất</div>
      <div style={{ fontSize: "1.3rem", fontWeight: 800, margin: "0.35rem 0" }}>{m.name}</div>
      <div style={{ fontSize: "0.82rem", opacity: 0.9, marginBottom: "0.5rem" }}>R² {m.r2} · RMSE {m.rmse} · MAE {m.mae}</div>
      <div style={{ fontSize: "0.82rem", opacity: 0.85 }}>{analysis}</div>
    </div>
  );
}

function MetricsComparisonTable({ results, best_model }: { results: MetricsResult; best_model?: string }) {
  const entries = Object.entries(results);
  const bestR2   = Math.max(...entries.map(([, v]) => v.r2));
  const bestRmse = Math.min(...entries.map(([, v]) => v.rmse));
  const bestMae  = Math.min(...entries.map(([, v]) => v.mae));

  const ranked = entries.map(([key, v]) => {
    const r2Rank   = entries.filter(([, x]) => x.r2   > v.r2).length + 1;
    const rmseRank = entries.filter(([, x]) => x.rmse < v.rmse).length + 1;
    const maeRank  = entries.filter(([, x]) => x.mae  < v.mae).length + 1;
    return { key, v, score: r2Rank + rmseRank + maeRank };
  }).sort((a, b) => a.score - b.score);

  const RANK_BADGE = ["🥇", "🥈", "🥉"];

  return (
    <div className="data-card" style={{ marginTop: "1rem" }}>
      <div style={{ marginBottom: "0.85rem" }}>
        <div className="metric-title" style={{ marginBottom: 4 }}>Bảng so sánh hiệu suất mô hình</div>
        <div style={{ fontSize: "0.74rem", color: "var(--text-gray)", lineHeight: 1.6 }}>Chỉ số tốt nhất trong mỗi cột được tô xanh. Xếp hạng dựa trên tổng thứ hạng của cả 3 chỉ số.</div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: "0.84rem" }}>
          <thead>
            <tr style={{ background: "var(--btn-light-bg)" }}>
              {[["Xếp hạng","center"],["Mô hình","left"],["R² ↑","center"],["RMSE ↓","center"],["MAE ↓","center"],["Đánh giá","center"]].map(([label, align]) => (
                <th key={label} style={{ padding: "0.65rem 0.9rem", fontWeight: 700, textAlign: align as "center"|"left", borderBottom: "2px solid var(--border-color)", color: "var(--text-dark)", whiteSpace: "nowrap", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ranked.map(({ key, v }, idx) => {
              const color  = MODEL_COLORS[key];
              const isBest = key === best_model;
              const rating = v.r2 >= 0.9 ? { label: "Xuất sắc", bg: "#dcfce7", c: "#16a34a" }
                           : v.r2 >= 0.7 ? { label: "Tốt",      bg: "#dbeafe", c: "#1d4ed8" }
                           : v.r2 >= 0.5 ? { label: "Trung bình", bg: "#fef9c3", c: "#a16207" }
                           :               { label: "Cần cải thiện", bg: "#fee2e2", c: "#dc2626" };
              return (
                <tr key={key} style={{ background: isBest ? `${color}0d` : idx % 2 === 0 ? "transparent" : "var(--btn-light-bg)", transition: "background 0.15s" }}>
                  <td style={{ textAlign: "center", padding: "0.75rem 0.9rem", fontSize: "1.1rem" }}>{RANK_BADGE[idx] || idx + 1}</td>
                  <td style={{ padding: "0.75rem 0.9rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 11, height: 11, borderRadius: "50%", background: color, flexShrink: 0 }} />
                      <span style={{ fontWeight: 700, color }}>{v.name}</span>
                      {isBest && <span style={{ fontSize: "0.65rem", fontWeight: 800, background: color, color: "#fff", padding: "1px 7px", borderRadius: 20 }}>TỐT NHẤT</span>}
                    </div>
                  </td>
                  <td style={{ textAlign: "center", padding: "0.75rem 0.9rem", fontWeight: 700, color: v.r2 === bestR2 ? "#16a34a" : "var(--text-dark)", background: v.r2 === bestR2 ? "#dcfce7" : "transparent", borderRadius: v.r2 === bestR2 ? 6 : 0 }}>
                    {v.r2}{v.r2 === bestR2 && <span style={{ marginLeft: 4, fontSize: "0.7rem" }}>✓</span>}
                  </td>
                  <td style={{ textAlign: "center", padding: "0.75rem 0.9rem", fontWeight: 700, color: v.rmse === bestRmse ? "#16a34a" : "var(--text-dark)", background: v.rmse === bestRmse ? "#dcfce7" : "transparent", borderRadius: v.rmse === bestRmse ? 6 : 0 }}>
                    {v.rmse}{v.rmse === bestRmse && <span style={{ marginLeft: 4, fontSize: "0.7rem" }}>✓</span>}
                  </td>
                  <td style={{ textAlign: "center", padding: "0.75rem 0.9rem", fontWeight: 700, color: v.mae === bestMae ? "#16a34a" : "var(--text-dark)", background: v.mae === bestMae ? "#dcfce7" : "transparent", borderRadius: v.mae === bestMae ? 6 : 0 }}>
                    {v.mae}{v.mae === bestMae && <span style={{ marginLeft: 4, fontSize: "0.7rem" }}>✓</span>}
                  </td>
                  <td style={{ textAlign: "center", padding: "0.75rem 0.9rem" }}>
                    <span style={{ fontSize: "0.72rem", fontWeight: 700, background: rating.bg, color: rating.c, padding: "3px 10px", borderRadius: 20, whiteSpace: "nowrap" }}>{rating.label}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "0.75rem", marginTop: "1rem", paddingTop: "0.75rem", borderTop: "1px solid var(--border-color)" }}>
        {[
          { name: "R²", full: "Hệ số xác định", note: "Càng gần 1 càng tốt. ≥0.9 = Xuất sắc", color: "#3b82f6" },
          { name: "RMSE", full: "Căn bậc hai sai số bình phương trung bình", note: "Càng nhỏ càng tốt", color: "#22c55e" },
          { name: "MAE", full: "Sai số tuyệt đối trung bình", note: "Càng nhỏ càng tốt", color: "#f97316" },
        ].map((m) => (
          <div key={m.name} style={{ padding: "0.6rem 0.75rem", background: "var(--btn-light-bg)", borderRadius: 8, borderLeft: `3px solid ${m.color}` }}>
            <div style={{ fontWeight: 700, fontSize: "0.8rem", color: m.color }}>{m.name}</div>
            <div style={{ fontSize: "0.7rem", color: "var(--text-dark)", fontWeight: 600, margin: "2px 0" }}>{m.full}</div>
            <div style={{ fontSize: "0.68rem", color: "var(--text-gray)" }}>{m.note}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BotSVG({ size = 28, dark = false }: { size?: number; dark?: boolean }) {
  const eyeColor  = dark ? "#15803d" : "#166534";
  const leafColor = dark ? "#bbf7d0" : "#86efac";
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M24 2 C21 -0.5 16.5 1.5 17.5 6 C18.5 10 23 10 24 8 C25 10 29.5 10 30.5 6 C31.5 1.5 27 -0.5 24 2Z" fill={leafColor}/>
      <line x1="24" y1="7.5" x2="24" y2="13" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round"/>
      <rect x="6" y="13" width="36" height="28" rx="10" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5"/>
      <circle cx="16" cy="23" r="6.5" fill="white" opacity="0.18"/><circle cx="16" cy="23" r="5" fill="white" opacity="0.92"/>
      <circle cy="23" r="2.5" fill={eyeColor}><animate attributeName="cx" values="16;16;19;16;13;16;16" keyTimes="0;0.10;0.28;0.45;0.63;0.80;1" dur="4s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1"/></circle>
      <circle cx="14.2" cy="21.2" r="1.3" fill="white" opacity="0.75"/>
      <circle cx="32" cy="23" r="6.5" fill="white" opacity="0.18"/><circle cx="32" cy="23" r="5" fill="white" opacity="0.92"/>
      <circle cy="23" r="2.5" fill={eyeColor}><animate attributeName="cx" values="32;32;35;32;29;32;32" keyTimes="0;0.10;0.28;0.45;0.63;0.80;1" dur="4s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1"/></circle>
      <circle cx="30.2" cy="21.2" r="1.3" fill="white" opacity="0.75"/>
      <path fill="none" opacity="0.9" stroke="white" strokeWidth="2.2" strokeLinecap="round" d="M15 34 Q24 40.5 33 34"><animate attributeName="d" values="M15 34 Q24 40.5 33 34;M15 34 Q24 40.5 33 34;M14 33 Q24 42 34 33;M14 33 Q24 42 34 33;M16 36 Q24 36 32 36;M16 36 Q24 36 32 36;M15 34 Q24 40.5 33 34" keyTimes="0;0.1;0.28;0.45;0.60;0.78;1" dur="5s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1"/></path>
      <rect x="3" y="20" width="3" height="7" rx="1.5" fill="rgba(255,255,255,0.45)"/>
      <rect x="42" y="20" width="3" height="7" rx="1.5" fill="rgba(255,255,255,0.45)"/>
      <circle cx="12" cy="30" r="3.5" fill="rgba(255,255,255,0.13)"/>
      <circle cx="36" cy="30" r="3.5" fill="rgba(255,255,255,0.13)"/>
    </svg>
  );
}

function FloatingAiBot({ trainResult }: { trainResult: TrainResult | null }) {
  const [open, setOpen]         = useState(false);
  const [analysis, setAnalysis] = useState("");
  const [displayText, setDisplayText] = useState("");
  const [loading, setLoading]   = useState(false);
  const [err, setErr]           = useState("");
  const [analyzed, setAnalyzed] = useState(false);

  useEffect(() => {
    if (!trainResult?.success) return;
    setAnalyzed(false);
    setLoading(true); setAnalysis(""); setErr("");
    aiAnalyze({
      results:      trainResult.results,
      best_model:   trainResult.best_model,
      sample_count: trainResult.sample_count,
    }).then((res) => {
      const data = res.data as { error?: string; analysis?: string };
      if (data.error) setErr(data.error);
      else { setAnalysis(data.analysis ?? ""); setAnalyzed(true); }
    }).catch(() => setErr("Không thể kết nối AI"))
      .finally(() => setLoading(false));
  }, [trainResult]);

  useEffect(() => {
    if (!analysis) { setDisplayText(""); return; }
    setDisplayText("");
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setDisplayText(analysis.slice(0, i));
      if (i >= analysis.length) clearInterval(timer);
    }, 20);
    return () => clearInterval(timer);
  }, [analysis]);

  const isTyping = displayText.length < analysis.length;
  const hasData  = !!trainResult?.success;

  const BotAvatar = ({ size = 36 }: { size?: number }) => (
    <div style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, background: "linear-gradient(135deg,#22c55e,#15803d)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 3px 12px rgba(22,163,74,0.4)" }}>
      <BotSVG size={size * 0.68} dark />
    </div>
  );

  return (
    <>
      <style>{`
        @keyframes botFloat { 0%,100% { transform:translateY(0) scale(1); } 50% { transform:translateY(-8px) scale(1.04); } }
        @keyframes botBounce { 0%,100% { transform:translateY(0) rotate(0deg) scale(1); } 25% { transform:translateY(-14px) rotate(-6deg) scale(1.07); } 65% { transform:translateY(-6px) rotate(5deg) scale(1.03); } }
        @keyframes spinRing { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
        @keyframes glowRing { 0% { transform:scale(1); opacity:0.6; } 100% { transform:scale(1.5); opacity:0; } }
        @keyframes notifPing { 0% { transform:scale(1); opacity:1; } 75%,100% { transform:scale(2.4); opacity:0; } }
        @keyframes chatSlideUp { from { opacity:0; transform:translateY(20px) scale(0.95); } to { opacity:1; transform:translateY(0) scale(1); } }
        @keyframes msgFadeIn { from { opacity:0; transform:translateX(-16px); } to { opacity:1; transform:translateX(0); } }
        @keyframes headerShimmer { 0% { background-position:0% 50%; } 50% { background-position:100% 50%; } 100% { background-position:0% 50%; } }
        @keyframes avatarRing { 0%,100% { box-shadow:0 0 0 0 rgba(255,255,255,0.5); } 50% { box-shadow:0 0 0 7px rgba(255,255,255,0); } }
        @keyframes typingDot { 0%,60%,100% { transform:translateY(0); opacity:0.3; } 30% { transform:translateY(-8px); opacity:1; } }
        @keyframes onlineBlink { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
        @keyframes cursorBlink { 0%,100% { opacity:1; } 50% { opacity:0; } }
        .aichat-close-btn:hover { background:rgba(255,255,255,0.38) !important; }
        .aichat-fab:hover { transform:scale(1.1) translateY(-3px) !important; }
        .aichat-fab:active { transform:scale(0.92) !important; }
      `}</style>

      <div style={{ position: "fixed", bottom: 28, right: 28, zIndex: 9999 }}>
        {!open && <>
          <div style={{ position:"absolute",inset:-2,borderRadius:"50%",border:"2px solid rgba(34,197,94,0.6)",animation:"glowRing 2.2s ease-out infinite",pointerEvents:"none" }} />
          <div style={{ position:"absolute",inset:-2,borderRadius:"50%",border:"2px solid rgba(34,197,94,0.38)",animation:"glowRing 2.2s ease-out 0.73s infinite",pointerEvents:"none" }} />
          <div style={{ position:"absolute",inset:-2,borderRadius:"50%",border:"1.5px solid rgba(34,197,94,0.2)",animation:"glowRing 2.2s ease-out 1.46s infinite",pointerEvents:"none" }} />
        </>}

        {open && (
          <div style={{ position:"absolute",bottom:82,right:0,width:460,background:"white",borderRadius:24,boxShadow:"0 28px 70px rgba(0,0,0,0.13)",overflow:"hidden",display:"flex",flexDirection:"column",animation:"chatSlideUp 0.3s cubic-bezier(0.34,1.56,0.64,1)",transformOrigin:"bottom right" }}>
            <div style={{ background:"linear-gradient(270deg,#14532d,#16a34a,#4ade80,#16a34a,#14532d)",backgroundSize:"300% 300%",animation:"headerShimmer 5s ease infinite",padding:"15px 16px",display:"flex",alignItems:"center",gap:12,flexShrink:0 }}>
              <div style={{ flexShrink:0,width:48,height:48,borderRadius:"50%",background:"rgba(255,255,255,0.18)",backdropFilter:"blur(6px)",border:"2px solid rgba(255,255,255,0.45)",display:"flex",alignItems:"center",justifyContent:"center",animation:"avatarRing 2.5s ease-in-out infinite" }}>
                <BotSVG size={28} />
              </div>
              <div style={{ flex:1 }}>
                <div style={{ color:"white",fontWeight:700,fontSize:"0.97rem",letterSpacing:"0.3px" }}>Greenhouse AI</div>
                <div style={{ color:"rgba(255,255,255,0.88)",fontSize:"0.72rem",display:"flex",alignItems:"center",gap:5,marginTop:3 }}>
                  <span style={{ width:7,height:7,borderRadius:"50%",background:"#bbf7d0",display:"inline-block",animation:"onlineBlink 2s ease-in-out infinite" }} />
                  Trực tuyến
                </div>
              </div>
              <button className="aichat-close-btn" onClick={() => setOpen(false)} style={{ background:"rgba(255,255,255,0.18)",backdropFilter:"blur(4px)",border:"1.5px solid rgba(255,255,255,0.35)",color:"white",width:32,height:32,borderRadius:"50%",cursor:"pointer",fontSize:"0.88rem",display:"flex",alignItems:"center",justifyContent:"center",transition:"background 0.2s" }}>✕</button>
            </div>

            <div style={{ padding:"18px 16px",minHeight:150,maxHeight:360,overflowY:"auto",background:"linear-gradient(180deg,#f0fdf4 0%,#f8fafc 100%)" }}>
              {!hasData ? (
                <div style={{ textAlign:"center",paddingTop:32,color:"#94a3b8",fontSize:"0.84rem" }}>
                  <div style={{ marginBottom:12,display:"flex",justifyContent:"center" }}><div style={{ width:56,height:56,borderRadius:"50%",background:"linear-gradient(135deg,#dcfce7,#bbf7d0)",display:"flex",alignItems:"center",justifyContent:"center" }}><BotSVG size={28} /></div></div>
                  <div style={{ fontWeight:600,color:"#64748b",marginBottom:6,fontSize:"0.9rem" }}>Chưa có dữ liệu</div>
                  Hãy train mô hình để AI phân tích kết quả
                </div>
              ) : loading ? (
                <div style={{ display:"flex",gap:10,alignItems:"flex-end",animation:"msgFadeIn 0.3s ease" }}>
                  <BotAvatar size={36} />
                  <div style={{ background:"white",border:"1.5px solid #dcfce7",borderRadius:"15px 15px 15px 3px",padding:"12px 16px",display:"flex",gap:6,alignItems:"center",boxShadow:"0 2px 10px rgba(0,0,0,0.06)" }}>
                    {[0, 0.22, 0.44].map((delay, i) => (<span key={i} style={{ width:8,height:8,borderRadius:"50%",background:"#22c55e",display:"inline-block",animation:`typingDot 1.2s ${delay}s ease-in-out infinite` }} />))}
                  </div>
                </div>
              ) : err ? (
                <div style={{ display:"flex",gap:10,alignItems:"flex-start",animation:"msgFadeIn 0.3s ease" }}>
                  <BotAvatar size={36} />
                  <div style={{ background:"#fff7f7",border:"1.5px solid #fecaca",borderRadius:"15px 15px 15px 3px",padding:"11px 14px",fontSize:"0.83rem",color:"#ef4444",lineHeight:1.65 }}>⚠️ {err}</div>
                </div>
              ) : (
                <div style={{ display:"flex",gap:10,alignItems:"flex-start",animation:"msgFadeIn 0.35s ease" }}>
                  <BotAvatar size={36} />
                  <div style={{ background:"white",border:"1.5px solid #bbf7d0",borderRadius:"15px 15px 15px 3px",padding:"13px 15px",fontSize:"0.84rem",color:"#1e293b",lineHeight:1.8,whiteSpace:"pre-wrap",boxShadow:"0 2px 14px rgba(22,163,74,0.09)" }}>
                    {displayText}
                    {isTyping && <span style={{ display:"inline-block",width:2,height:"1em",background:"#16a34a",marginLeft:2,verticalAlign:"text-bottom",animation:"cursorBlink 0.7s step-end infinite" }} />}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {!open && (
          <div style={{ position:"absolute",inset:-2,borderRadius:"50%",background:"conic-gradient(from 0deg, #22c55e, #86efac, #4ade80, #166334, #22c55e)",animation:"spinRing 3s linear infinite",pointerEvents:"none" }}>
            <div style={{ position:"absolute",inset:2,borderRadius:"50%",background:"linear-gradient(135deg,#22c55e,#16a34a)" }} />
          </div>
        )}

        <button className="aichat-fab" onClick={() => setOpen((prev) => !prev)} style={{ position:"relative",zIndex:2,width:60,height:60,borderRadius:"50%",background:open?"linear-gradient(135deg,#15803d,#166534)":"linear-gradient(135deg,#22c55e,#16a34a)",border:"2.5px solid rgba(255,255,255,0.3)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",animation:open?"none":analyzed?"botBounce 0.95s ease-in-out infinite":"botFloat 2.6s ease-in-out infinite",boxShadow:open?"0 4px 18px rgba(22,163,74,0.4)":"0 8px 30px rgba(34,197,94,0.6)",transition:"background 0.3s, box-shadow 0.3s, transform 0.18s" }}>
          <BotSVG size={40} />
        </button>

        {analyzed && !open && (
          <div style={{ position:"absolute",top:1,right:1,width:15,height:15 }}>
            <div style={{ position:"absolute",inset:0,borderRadius:"50%",background:"#ef4444",opacity:0.55,animation:"notifPing 1.7s ease-out infinite" }} />
            <div style={{ width:15,height:15,borderRadius:"50%",background:"#ef4444",border:"2.5px solid white",position:"relative" }} />
          </div>
        )}
      </div>
    </>
  );
}

export default function Training() {
  const { isTraining, trainResult, setTrainResult } = useSensorContext();
  const [error, setError] = useState("");
  const [selectedModels, setSelectedModels] = useState(["linear", "random_forest", "xgboost"]);
  const MODEL_INFO = [
    { key: "linear",        label: "Linear Regression", desc: "Đơn giản, nhanh, dễ giải thích" },
    { key: "random_forest", label: "Random Forest",     desc: "Nhiều cây quyết định, ổn định cao" },
    { key: "xgboost",       label: "XGBoost",           desc: "Gradient boosting, chính xác cao" },
  ];

  const toggleModel = (key: string) => {
    setSelectedModels((prev) =>
      prev.includes(key) ? (prev.length > 1 ? prev.filter((k) => k !== key) : prev) : [...prev, key]
    );
  };

  const handleTrain = async () => {
    try {
      setError("");
      setTrainResult(null);
      await retrain(selectedModels);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setError(err?.response?.data?.error || "Error calling training API");
    }
  };

  return (
    <>
      <div className="view-container" style={{ padding: "1.5rem" }}>
        <div className="data-card" style={{ marginBottom: "1rem" }}>
          <div style={{ marginBottom: "1rem" }}>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.25rem" }}>Huấn luyện mô hình</h2>
            <p style={{ fontSize: "0.82rem", color: "var(--text-gray)", margin: 0 }}>
              Chọn một hoặc nhiều mô hình bên dưới rồi nhấn <b>Bắt đầu huấn luyện</b>. Cần ít nhất 10 bản ghi.
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
            {MODEL_INFO.map(({ key, label, desc }) => {
              const selected = selectedModels.includes(key);
              const color = MODEL_COLORS[key];
              return (
                <div key={key} onClick={() => toggleModel(key)} style={{ flex: "1 1 160px", padding: "0.85rem 1rem", borderRadius: 10, cursor: "pointer", border: `2px solid ${selected ? color : "var(--border-color)"}`, background: selected ? `${color}18` : "var(--btn-light-bg)", transition: "all 0.15s", userSelect: "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ width: 13, height: 13, borderRadius: "50%", flexShrink: 0, background: selected ? color : "var(--border-color)", boxShadow: selected ? `0 0 6px ${color}99` : "none", transition: "all 0.15s" }} />
                    <span style={{ fontWeight: 700, fontSize: "0.88rem", color: selected ? color : "var(--text-dark)" }}>{label}</span>
                  </div>
                  <div style={{ fontSize: "0.74rem", color: "var(--text-gray)", paddingLeft: 21 }}>{desc}</div>
                </div>
              );
            })}
          </div>

          {error && <p style={{ color: "#ef4444", fontSize: "0.82rem", marginTop: "0.5rem" }}>{error}</p>}

          <div style={{ marginTop: "1.25rem" }}>
            <button onClick={handleTrain} disabled={isTraining} style={{ width: "100%", padding: "0.75rem", borderRadius: 10, border: "none", cursor: isTraining ? "not-allowed" : "pointer", background: isTraining ? "var(--btn-light-bg)" : "linear-gradient(135deg,#22c55e,#16a34a)", color: isTraining ? "var(--text-gray)" : "#fff", fontWeight: 700, fontSize: "0.95rem", opacity: isTraining ? 0.7 : 1, boxShadow: isTraining ? "none" : "0 4px 14px rgba(34,197,94,0.4)", transition: "all 0.2s" }}>
              {isTraining ? "⏳ Đang huấn luyện, vui lòng chờ..." : "▶ Bắt đầu huấn luyện"}
            </button>
          </div>
        </div>

        {trainResult?.success && (() => {
          const { results, chart_data, best_model } = trainResult;
          return (
            <>
              {results && (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "1.25rem 0 0.5rem" }}>
                    <span style={{ width: 4, height: 20, borderRadius: 2, background: "#3b82f6", flexShrink: 0 }} />
                    <span style={{ fontWeight: 800, fontSize: "1rem", color: "var(--text-dark)" }}>Kết quả huấn luyện</span>
                    <span style={{ fontSize: "0.72rem", color: "var(--text-gray)", fontStyle: "italic" }}>Dự đoán nhu cầu tưới nước</span>
                  </div>
                  {best_model && <BestModelBadge bestModel={best_model} results={results} />}
                  <MetricsComparisonTable results={results} best_model={best_model} />
                  <div className="data-card" style={{ marginTop: "1rem" }}>
                    <div className="metric-title" style={{ marginBottom: "0.5rem" }}>So sánh chỉ số 3 mô hình</div>
                    <MetricBarChart results={results} />
                  </div>
                  {chart_data && <CombinedPredChart chart_data={chart_data} results={results} />}
                  {chart_data && (
                    <div className="data-card" style={{ marginTop: "1rem" }}>
                      <div className="metric-title" style={{ marginBottom: "0.75rem" }}>Chi tiết từng mô hình</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
                        {Object.entries(chart_data).map(([key, cd]) => {
                          const color = MODEL_COLORS[key];
                          const res = results[key];
                          const isBest = key === best_model;
                          const points = cd.actual.map((a, i) => ({ i, actual: a, predicted: cd.predicted[i] }));
                          return (
                            <div key={key} style={{ border: `2px solid ${isBest ? color : "var(--border-color)"}`, borderRadius: 12, padding: "1rem", background: isBest ? `${color}0d` : "var(--card-bg)", position: "relative" }}>
                              {isBest && <span style={{ position: "absolute", top: -11, left: 12, background: color, color: "#fff", fontSize: "0.68rem", fontWeight: 800, padding: "1px 8px", borderRadius: 20, letterSpacing: 0.5 }}>🏆 TỐT NHẤT</span>}
                              <div style={{ fontWeight: 700, fontSize: "0.9rem", color, marginBottom: 6 }}>{res?.name}</div>
                              <div style={{ display: "flex", gap: 12, fontSize: "0.75rem", color: "var(--text-gray)", marginBottom: 10 }}>
                                <span>R² <b style={{ color: "var(--text-dark)" }}>{res?.r2}</b></span>
                                <span>RMSE <b style={{ color: "var(--text-dark)" }}>{res?.rmse}</b></span>
                                <span>MAE <b style={{ color: "var(--text-dark)" }}>{res?.mae}</b></span>
                              </div>
                              <ResponsiveContainer width="100%" height={160}>
                                <LineChart data={points} margin={{ top: 2, right: 6, left: -22, bottom: 0 }}>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                                  <XAxis dataKey="i" hide />
                                  <YAxis tick={{ fontSize: 9 }} domain={["auto", "auto"]} />
                                  <Tooltip formatter={(v, n) => [(v as number).toFixed(4), (n as string) === "actual" ? "Thực tế" : "Dự đoán"]} contentStyle={{ fontSize: "0.75rem" }} />
                                  <Line type="monotone" dataKey="actual" stroke="#94a3b8" dot={false} strokeWidth={1.5} strokeDasharray="4 3" />
                                  <Line type="monotone" dataKey="predicted" stroke={color} dot={false} strokeWidth={2} />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
              <p style={{ fontSize: "0.78rem", color: "var(--text-gray)", marginTop: "1rem" }}>Đã train với {trainResult.sample_count} bản ghi</p>
            </>
          );
        })()}

        {trainResult && !trainResult.success && (
          <div className="data-card" style={{ marginTop: "1rem", color: "#ef4444" }}>❌ {trainResult.error}</div>
        )}
      </div>
      <FloatingAiBot trainResult={trainResult} />
    </>
  );
}
