"use client";

import React, { useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { predictManual } from "@/services/api";
import { useSensorContext } from "@/context/SensorContext";
import type { SensorRecord, SensorPredictions, ManualPredictInput } from "@/types/sensor";

const GRADIENTS = [
  { id: "colorTemp",  color: "#f97316" },
  { id: "colorHum",   color: "#0ea5e9" },
  { id: "colorSoilM", color: "#22c55e" },
  { id: "colorDew",   color: "#8b5cf6" },
];

const GradientDefs = () => (
  <defs>
    {GRADIENTS.map((g) => (
      <linearGradient key={g.id} id={g.id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%"  stopColor={g.color} stopOpacity={0.3} />
        <stop offset="95%" stopColor={g.color} stopOpacity={0} />
      </linearGradient>
    ))}
  </defs>
);

function Chart({ data, dataKey, color, gradientId, height = "120px" }: {
  data: SensorRecord[];
  dataKey: string;
  color: string;
  gradientId: string;
  height?: string;
}) {
  return (
    <div className="chart-wrapper" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
          <GradientDefs />
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
          <XAxis dataKey="time" hide />
          <YAxis stroke="#a0a0a0" fontSize={11} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
          <Tooltip contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }} />
          <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={3}
                fill={`url(#${gradientId})`} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function MetricCard({ className, title, value, unit, children }: {
  className: string;
  title: string;
  value: string | undefined;
  unit: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={`metric-card ${className}`}>
      <div className="metric-title">{title}</div>
      <div className="metric-value">{value} <span className="metric-unit">{unit}</span></div>
      {children}
    </div>
  );
}

function PredictionStrip({ predictions }: { predictions: SensorPredictions }) {
  if (!predictions || !Object.keys(predictions).length) return null;
  const models = [
    { key: "linear",        label: "Linear",  color: "#3b82f6" },
    { key: "random_forest", label: "RF",      color: "#22c55e" },
    { key: "xgboost",       label: "XGBoost", color: "#f97316" },
  ];
  return (
    <div className="full metric-card" style={{ flexDirection: "row", gap: "1.5rem", alignItems: "center" }}>
      <span className="metric-title" style={{ marginBottom: 0, whiteSpace: "nowrap" }}>DỰ ĐOÁN TƯỚI</span>
      {models.map((m) => (
        <div key={m.key} style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: "0.7rem", fontWeight: 700, color: m.color, marginBottom: 3 }}>{m.label}</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 800, color: m.color }}>
            {predictions[m.key as keyof SensorPredictions] !== undefined
              ? predictions[m.key as keyof SensorPredictions]!.toFixed(3)
              : "—"}
          </div>
        </div>
      ))}
    </div>
  );
}

const FIELDS: { key: keyof ManualPredictInput; label: string; placeholder: string }[] = [
  { key: "Humidity",         label: "Độ ẩm KK (%)",      placeholder: "60" },
  { key: "Atmospheric_Temp", label: "Nhiệt độ KK (°C)",  placeholder: "28" },
  { key: "Soil_Temp",        label: "Nhiệt độ đất (°C)", placeholder: "24" },
  { key: "Soil_Moisture",    label: "Độ ẩm đất (%)",     placeholder: "40" },
];

function ManualMode() {
  const [form, setForm] = useState({ Humidity: "", Atmospheric_Temp: "", Soil_Temp: "", Soil_Moisture: "" });
  const [result, setResult] = useState<SensorPredictions | null>(null);
  const [loading, setLoading] = useState(false);

  const handlePredict = async () => {
    setLoading(true);
    try {
      const payload = Object.fromEntries(
        Object.entries(form).map(([k, v]) => [k, parseFloat(v) || 0])
      ) as unknown as ManualPredictInput;
      const res = await predictManual(payload);
      setResult(res.data);
    } catch {
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="data-card" style={{ marginTop: "1rem" }}>
      <div className="metric-title" style={{ marginBottom: "0.75rem" }}>Nhập giá trị cảm biến để AI dự đoán</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "0.75rem", marginBottom: "0.75rem" }}>
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label style={{ fontSize: "0.75rem", color: "var(--text-gray)" }}>{f.label}</label>
            <input type="number" placeholder={f.placeholder} value={form[f.key]}
              onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
              style={{ marginTop: 4 }}
            />
          </div>
        ))}
      </div>
      <button className="btn-export" onClick={handlePredict} disabled={loading}
        style={{ width: "auto", padding: "0.4rem 1.25rem" }}>
        {loading ? "Đang tính..." : "Dự đoán"}
      </button>
      {result && Object.keys(result).length === 0 && (
        <div style={{ marginTop: "1rem", padding: "0.75rem 1rem", background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 6, fontSize: "0.83rem", color: "#92400e" }}>
          ⚠️ Chưa có mô hình nào được train. Vào tab <strong>Huấn luyện</strong> → bấm <strong>Train từ DB</strong> trước.
        </div>
      )}
      {result && Object.keys(result).length > 0 && (
        <div style={{ display: "flex", gap: "1.5rem", marginTop: "1rem" }}>
          {[{ k: "linear", l: "Linear", c: "#3b82f6" }, { k: "random_forest", l: "Random Forest", c: "#22c55e" }, { k: "xgboost", l: "XGBoost", c: "#f97316" }]
            .map((m) => (
              <div key={m.k} style={{ flex: 1, textAlign: "center", padding: "0.75rem", border: `2px solid ${m.c}`, borderRadius: 8 }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 700, color: m.c }}>{m.l}</div>
                <div style={{ fontSize: "1.8rem", fontWeight: 800, color: m.c }}>
                  {result[m.k as keyof SensorPredictions]?.toFixed(3) ?? "—"}
                </div>
              </div>
            ))}
        </div>
      )}
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
      <circle cx="16" cy="23" r="6.5" fill="white" opacity="0.18"/>
      <circle cx="16" cy="23" r="5" fill="white" opacity="0.92"/>
      <circle cy="23" r="2.5" fill={eyeColor}>
        <animate attributeName="cx" values="16;16;19;16;13;16;16" keyTimes="0;0.10;0.28;0.45;0.63;0.80;1" dur="4s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1"/>
      </circle>
      <circle cx="14.2" cy="21.2" r="1.3" fill="white" opacity="0.75"/>
      <circle cx="32" cy="23" r="6.5" fill="white" opacity="0.18"/>
      <circle cx="32" cy="23" r="5" fill="white" opacity="0.92"/>
      <circle cy="23" r="2.5" fill={eyeColor}>
        <animate attributeName="cx" values="32;32;35;32;29;32;32" keyTimes="0;0.10;0.28;0.45;0.63;0.80;1" dur="4s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1"/>
      </circle>
      <circle cx="30.2" cy="21.2" r="1.3" fill="white" opacity="0.75"/>
      <path fill="none" opacity="0.9" stroke="white" strokeWidth="2.2" strokeLinecap="round" d="M15 34 Q24 40.5 33 34">
        <animate attributeName="d" values="M15 34 Q24 40.5 33 34;M15 34 Q24 40.5 33 34;M14 33 Q24 42 34 33;M14 33 Q24 42 34 33;M16 36 Q24 36 32 36;M16 36 Q24 36 32 36;M15 34 Q24 40.5 33 34" keyTimes="0;0.1;0.28;0.45;0.60;0.78;1" dur="5s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1"/>
      </path>
      <rect x="3" y="20" width="3" height="7" rx="1.5" fill="rgba(255,255,255,0.45)"/>
      <rect x="42" y="20" width="3" height="7" rx="1.5" fill="rgba(255,255,255,0.45)"/>
      <circle cx="12" cy="30" r="3.5" fill="rgba(255,255,255,0.13)"/>
      <circle cx="36" cy="30" r="3.5" fill="rgba(255,255,255,0.13)"/>
    </svg>
  );
}

const SENSOR_THRESHOLDS: Record<string, { min: number; max: number; label: string; unit: string }> = {
  humidity:         { min: 40,  max: 85, label: "Độ ẩm không khí",   unit: "%" },
  atmospheric_Temp: { min: 15,  max: 35, label: "Nhiệt độ không khí", unit: "°C" },
  soil_Moisture:    { min: 30,  max: 85, label: "Độ ẩm đất",          unit: "%" },
  soil_Temp:        { min: 12,  max: 32, label: "Nhiệt độ đất",       unit: "°C" },
  dew_Point:        { min: 5,   max: 28, label: "Điểm sương",         unit: "°C" },
};

interface Alert { key: string; label: string; val: number; unit: string; type: "low" | "high"; msg: string; }

function getAlerts(current: SensorRecord): Alert[] {
  return Object.entries(SENSOR_THRESHOLDS).flatMap(([key, cfg]): Alert[] => {
    const val = (current as unknown as Record<string, number>)[key];
    if (val === undefined || val === null) return [];
    if (val < cfg.min) return [{ key, label: cfg.label, val, unit: cfg.unit, type: "low" as const,
      msg: `${cfg.label} quá thấp: ${val.toFixed(1)}${cfg.unit} (tối thiểu ${cfg.min}${cfg.unit})` }];
    if (val > cfg.max) return [{ key, label: cfg.label, val, unit: cfg.unit, type: "high" as const,
      msg: `${cfg.label} quá cao: ${val.toFixed(1)}${cfg.unit} (tối đa ${cfg.max}${cfg.unit})` }];
    return [];
  });
}

function DashboardBot({ current }: { current: SensorRecord | null }) {
  const [open, setOpen] = useState(false);
  const alerts = current ? getAlerts(current) : [];
  const hasAlerts = alerts.length > 0;

  const BotAvatar = ({ size = 36 }: { size?: number }) => (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: "linear-gradient(135deg,#22c55e,#15803d)",
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: "0 3px 12px rgba(22,163,74,0.4)",
    }}>
      <BotSVG size={size * 0.68} dark />
    </div>
  );

  return (
    <>
      <style>{`
        @keyframes dbBotFloat { 0%,100% { transform:translateY(0) scale(1); } 50% { transform:translateY(-8px) scale(1.04); } }
        @keyframes dbBotAlert { 0%,100% { transform:translateY(0) rotate(0deg) scale(1); } 20% { transform:translateY(-12px) rotate(-7deg) scale(1.07); } 55% { transform:translateY(-5px) rotate(6deg) scale(1.03); } }
        @keyframes dbSpinRing { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
        @keyframes dbGlowRing { 0% { transform:scale(1); opacity:0.6; } 100% { transform:scale(1.5); opacity:0; } }
        @keyframes dbNotifPing { 0% { transform:scale(1); opacity:1; } 75%,100% { transform:scale(2.4); opacity:0; } }
        @keyframes dbChatSlideUp { from { opacity:0; transform:translateY(20px) scale(0.95); } to { opacity:1; transform:translateY(0) scale(1); } }
        @keyframes dbMsgFadeIn { from { opacity:0; transform:translateX(-12px); } to { opacity:1; transform:translateX(0); } }
        @keyframes dbHeaderShimmer { 0% { background-position:0% 50%; } 50% { background-position:100% 50%; } 100% { background-position:0% 50%; } }
        @keyframes dbOnlineBlink { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
        .db-fab:hover { transform:scale(1.1) translateY(-3px) !important; }
        .db-fab:active { transform:scale(0.92) !important; }
        .db-close:hover { background:rgba(255,255,255,0.38) !important; }
      `}</style>

      <div style={{ position: "fixed", bottom: 28, right: 28, zIndex: 9999 }}>
        {!open && !hasAlerts && <>
          <div style={{ position:"absolute",inset:-2,borderRadius:"50%",border:"2px solid rgba(34,197,94,0.6)",animation:"dbGlowRing 2.2s ease-out infinite",pointerEvents:"none" }} />
          <div style={{ position:"absolute",inset:-2,borderRadius:"50%",border:"2px solid rgba(34,197,94,0.38)",animation:"dbGlowRing 2.2s ease-out 0.73s infinite",pointerEvents:"none" }} />
          <div style={{ position:"absolute",inset:-2,borderRadius:"50%",border:"1.5px solid rgba(34,197,94,0.2)",animation:"dbGlowRing 2.2s ease-out 1.46s infinite",pointerEvents:"none" }} />
        </>}
        {!open && hasAlerts && <>
          <div style={{ position:"absolute",inset:-2,borderRadius:"50%",border:"2px solid rgba(239,68,68,0.7)",animation:"dbGlowRing 1.4s ease-out infinite",pointerEvents:"none" }} />
          <div style={{ position:"absolute",inset:-2,borderRadius:"50%",border:"2px solid rgba(239,68,68,0.45)",animation:"dbGlowRing 1.4s ease-out 0.47s infinite",pointerEvents:"none" }} />
        </>}

        {open && (
          <div style={{ position:"absolute",bottom:82,right:0,width:460,background:"white",borderRadius:24,boxShadow:"0 28px 70px rgba(0,0,0,0.13)",overflow:"hidden",display:"flex",flexDirection:"column",animation:"dbChatSlideUp 0.3s cubic-bezier(0.34,1.56,0.64,1)",transformOrigin:"bottom right" }}>
            <div style={{ background:hasAlerts?"linear-gradient(270deg,#7f1d1d,#dc2626,#f87171,#dc2626,#7f1d1d)":"linear-gradient(270deg,#14532d,#16a34a,#4ade80,#16a34a,#14532d)",backgroundSize:"300% 300%",animation:"dbHeaderShimmer 5s ease infinite",padding:"15px 16px",display:"flex",alignItems:"center",gap:12,flexShrink:0 }}>
              <div style={{ flexShrink:0,width:48,height:48,borderRadius:"50%",background:"rgba(255,255,255,0.18)",backdropFilter:"blur(6px)",border:"2px solid rgba(255,255,255,0.45)",display:"flex",alignItems:"center",justifyContent:"center" }}>
                <BotSVG size={28} />
              </div>
              <div style={{ flex:1 }}>
                <div style={{ color:"white",fontWeight:700,fontSize:"0.97rem",letterSpacing:"0.3px" }}>{hasAlerts?"⚠️ Cảnh báo cảm biến":"Greenhouse AI"}</div>
                <div style={{ color:"rgba(255,255,255,0.88)",fontSize:"0.72rem",display:"flex",alignItems:"center",gap:5,marginTop:3 }}>
                  <span style={{ width:7,height:7,borderRadius:"50%",background:hasAlerts?"#fca5a5":"#bbf7d0",display:"inline-block",animation:"dbOnlineBlink 2s ease-in-out infinite" }} />
                  {hasAlerts?`${alerts.length} thông số bất thường`:"Tất cả thông số bình thường"}
                </div>
              </div>
              <button className="db-close" onClick={() => setOpen(false)} style={{ background:"rgba(255,255,255,0.18)",backdropFilter:"blur(4px)",border:"1.5px solid rgba(255,255,255,0.35)",color:"white",width:32,height:32,borderRadius:"50%",cursor:"pointer",fontSize:"0.88rem",display:"flex",alignItems:"center",justifyContent:"center",transition:"background 0.2s" }}>✕</button>
            </div>

            <div style={{ padding:"14px 16px",minHeight:120,maxHeight:340,overflowY:"auto",background:hasAlerts?"linear-gradient(180deg,#fff5f5 0%,#f8fafc 100%)":"linear-gradient(180deg,#f0fdf4 0%,#f8fafc 100%)" }}>
              {!current ? (
                <div style={{ textAlign:"center",paddingTop:28,color:"#94a3b8",fontSize:"0.84rem" }}>
                  <div style={{ marginBottom:10,display:"flex",justifyContent:"center" }}>
                    <div style={{ width:48,height:48,borderRadius:"50%",background:"linear-gradient(135deg,#dcfce7,#bbf7d0)",display:"flex",alignItems:"center",justifyContent:"center" }}>
                      <BotSVG size={26} />
                    </div>
                  </div>
                  <div style={{ fontWeight:600,color:"#64748b",fontSize:"0.88rem" }}>Chưa có dữ liệu cảm biến</div>
                </div>
              ) : !hasAlerts ? (
                <div style={{ display:"flex",gap:10,alignItems:"flex-start",animation:"dbMsgFadeIn 0.3s ease" }}>
                  <BotAvatar size={36} />
                  <div style={{ background:"white",border:"1.5px solid #bbf7d0",borderRadius:"15px 15px 15px 3px",padding:"12px 14px",fontSize:"0.84rem",color:"#1e293b",lineHeight:1.75,boxShadow:"0 2px 10px rgba(22,163,74,0.08)" }}>
                    ✅ Tất cả thông số cảm biến đang trong ngưỡng an toàn. Nhà kính hoạt động bình thường!
                  </div>
                </div>
              ) : (
                <div style={{ display:"flex",flexDirection:"column",gap:8,animation:"dbMsgFadeIn 0.3s ease" }}>
                  <div style={{ display:"flex",gap:10,alignItems:"flex-start" }}>
                    <BotAvatar size={36} />
                    <div style={{ background:"white",border:"1.5px solid #fecaca",borderRadius:"15px 15px 15px 3px",padding:"10px 13px",fontSize:"0.82rem",color:"#7f1d1d",lineHeight:1.6,boxShadow:"0 2px 8px rgba(239,68,68,0.08)" }}>
                      Phát hiện <strong>{alerts.length}</strong> thông số bất thường — cần kiểm tra ngay!
                    </div>
                  </div>
                  {alerts.map((a, i) => (
                    <div key={a.key} style={{ marginLeft:46,background:a.type==="high"?"#fff7ed":"#eff6ff",border:`1.5px solid ${a.type==="high"?"#fed7aa":"#bfdbfe"}`,borderLeft:`4px solid ${a.type==="high"?"#f97316":"#3b82f6"}`,borderRadius:"0 10px 10px 0",padding:"9px 12px",fontSize:"0.8rem",color:"#1e293b",lineHeight:1.55,animation:`dbMsgFadeIn 0.3s ${i*0.07}s ease both` }}>
                      <span style={{ fontWeight:700,color:a.type==="high"?"#c2410c":"#1d4ed8" }}>{a.type==="high"?"🌡 ":"📉 "}{a.label}</span>
                      <br />{a.msg}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {!open && (
          <div style={{ position:"absolute",inset:-2,borderRadius:"50%",background:hasAlerts?"conic-gradient(from 0deg, #ef4444, #fca5a5, #f87171, #dc2626, #ef4444)":"conic-gradient(from 0deg, #22c55e, #86efac, #4ade80, #166534, #22c55e)",animation:"dbSpinRing 3s linear infinite",pointerEvents:"none" }}>
            <div style={{ position:"absolute",inset:2,borderRadius:"50%",background:hasAlerts?"linear-gradient(135deg,#ef4444,#dc2626)":"linear-gradient(135deg,#22c55e,#16a34a)" }} />
          </div>
        )}

        <button className="db-fab" onClick={() => setOpen((p) => !p)} style={{ position:"relative",zIndex:2,width:60,height:60,borderRadius:"50%",background:open?(hasAlerts?"linear-gradient(135deg,#b91c1c,#991b1b)":"linear-gradient(135deg,#15803d,#166534)"):(hasAlerts?"linear-gradient(135deg,#ef4444,#dc2626)":"linear-gradient(135deg,#22c55e,#16a34a)"),border:"2.5px solid rgba(255,255,255,0.3)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",animation:open?"none":hasAlerts?"dbBotAlert 0.95s ease-in-out infinite":"dbBotFloat 2.6s ease-in-out infinite",boxShadow:open?"0 4px 18px rgba(22,163,74,0.4)":hasAlerts?"0 8px 30px rgba(239,68,68,0.6)":"0 8px 30px rgba(34,197,94,0.6)",transition:"background 0.3s, box-shadow 0.3s, transform 0.18s" }}>
          <BotSVG size={40} />
        </button>

        {hasAlerts && !open && (
          <div style={{ position:"absolute",top:-4,right:-4,width:22,height:22,zIndex:10 }}>
            <div style={{ position:"absolute",inset:0,borderRadius:"50%",background:"#ef4444",opacity:0.55,animation:"dbNotifPing 1.4s ease-out infinite" }} />
            <div style={{ width:22,height:22,borderRadius:"50%",background:"#ef4444",border:"2.5px solid white",position:"relative",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.7rem",color:"white",fontWeight:800,boxShadow:"0 2px 6px rgba(239,68,68,0.6)" }}>{alerts.length}</div>
          </div>
        )}
      </div>
    </>
  );
}

export default function Dashboard() {
  const { chartData, current } = useSensorContext();
  const [liveMode, setLiveMode] = useState(true);

  return (
    <div>
      <div style={{ display:"flex",justifyContent:"flex-end",marginBottom:"0.75rem",gap:"0.5rem" }}>
        <button onClick={() => setLiveMode(true)} style={{ padding:"0.35rem 1rem",borderRadius:6,fontWeight:600,fontSize:"0.82rem",cursor:"pointer",border:liveMode?"1.5px solid #0ea5e9":"1px solid var(--border-color)",background:liveMode?"#0ea5e9":"var(--card-bg)",color:liveMode?"white":"var(--text-dark)" }}>
          🟢 Live
        </button>
        <button onClick={() => setLiveMode(false)} style={{ padding:"0.35rem 1rem",borderRadius:6,fontWeight:600,fontSize:"0.82rem",cursor:"pointer",border:!liveMode?"1.5px solid #8b5cf6":"1px solid var(--border-color)",background:!liveMode?"#8b5cf6":"var(--card-bg)",color:!liveMode?"white":"var(--text-dark)" }}>
          Dự đoán
        </button>
      </div>

      {liveMode ? (
        <div className="dashboard-grid">
          <MetricCard className="half"  title="NHIỆT ĐỘ KHÔNG KHÍ" value={current.atmospheric_Temp?.toFixed(1)} unit="°C">
            <Chart data={chartData} dataKey="atmospheric_Temp" color="#f97316" gradientId="colorTemp" />
          </MetricCard>
          <MetricCard className="half"  title="ĐỘ ẨM KHÔNG KHÍ"   value={current.humidity?.toFixed(0)}        unit="%">
            <Chart data={chartData} dataKey="humidity" color="#0ea5e9" gradientId="colorHum" />
          </MetricCard>
          <MetricCard className="third" title="ĐỘ ẨM ĐẤT"          value={current.soil_Moisture?.toFixed(0)}  unit="%">
            <Chart data={chartData} dataKey="soil_Moisture" color="#22c55e" gradientId="colorSoilM" />
          </MetricCard>
          <MetricCard className="third" title="NHIỆT ĐỘ ĐẤT"       value={current.soil_Temp?.toFixed(1)}      unit="°C">
            <Chart data={chartData} dataKey="soil_Temp" color="#f97316" gradientId="colorTemp" />
          </MetricCard>
          <MetricCard className="third" title="ĐIỂM SƯƠNG"          value={current.dew_Point?.toFixed(1)}     unit="°C">
            <Chart data={chartData} dataKey="dew_Point" color="#8b5cf6" gradientId="colorDew" />
          </MetricCard>
          <MetricCard className="full"  title="LƯU LƯỢNG NƯỚC"      value={current.water_Flow?.toFixed(2)}     unit="m³/h">
            <Chart data={chartData} dataKey="water_Flow" color="#0ea5e9" gradientId="colorHum" height="90px" />
          </MetricCard>
          <PredictionStrip predictions={current.predictions} />
        </div>
      ) : (
        <ManualMode />
      )}
      <DashboardBot current={liveMode ? current : null} />
    </div>
  );
}
