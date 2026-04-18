"use client";

import React, { useEffect, useState, useCallback } from "react";
import { getDevices } from "@/services/api";
import type { Device } from "@/types/sensor";


const REFRESH_INTERVAL = 10_000;

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
        <animate attributeName="cx" values="16;16;19;16;13;16;16"
          keyTimes="0;0.10;0.28;0.45;0.63;0.80;1" dur="4s" repeatCount="indefinite"
          calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1"/>
      </circle>
      <circle cx="14.2" cy="21.2" r="1.3" fill="white" opacity="0.75"/>
      <circle cx="32" cy="23" r="6.5" fill="white" opacity="0.18"/>
      <circle cx="32" cy="23" r="5" fill="white" opacity="0.92"/>
      <circle cy="23" r="2.5" fill={eyeColor}>
        <animate attributeName="cx" values="32;32;35;32;29;32;32"
          keyTimes="0;0.10;0.28;0.45;0.63;0.80;1" dur="4s" repeatCount="indefinite"
          calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1"/>
      </circle>
      <circle cx="30.2" cy="21.2" r="1.3" fill="white" opacity="0.75"/>
      <path fill="none" opacity="0.9" stroke="white" strokeWidth="2.2" strokeLinecap="round" d="M15 34 Q24 40.5 33 34">
        <animate attributeName="d"
          values="M15 34 Q24 40.5 33 34;M15 34 Q24 40.5 33 34;M14 33 Q24 42 34 33;M14 33 Q24 42 34 33;M16 36 Q24 36 32 36;M16 36 Q24 36 32 36;M15 34 Q24 40.5 33 34"
          keyTimes="0;0.1;0.28;0.45;0.60;0.78;1" dur="5s" repeatCount="indefinite"
          calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1"/>
      </path>
      <rect x="3" y="20" width="3" height="7" rx="1.5" fill="rgba(255,255,255,0.45)"/>
      <rect x="42" y="20" width="3" height="7" rx="1.5" fill="rgba(255,255,255,0.45)"/>
      <circle cx="12" cy="30" r="3.5" fill="rgba(255,255,255,0.13)"/>
      <circle cx="36" cy="30" r="3.5" fill="rgba(255,255,255,0.13)"/>
    </svg>
  );
}

function DeviceBot({ devices, loading }: { devices: Device[]; loading: boolean }) {
  const [open, setOpen] = useState(false);
  const offlineDevices = devices.filter((d) => !d.online);
  const hasAlerts = offlineDevices.length > 0;

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
        @keyframes dvBotFloat {
          0%,100% { transform: translateY(0) scale(1); }
          50%      { transform: translateY(-8px) scale(1.04); }
        }
        @keyframes dvBotAlert {
          0%,100% { transform: translateY(0) rotate(0deg) scale(1); }
          20%     { transform: translateY(-12px) rotate(-7deg) scale(1.07); }
          55%     { transform: translateY(-5px) rotate(6deg) scale(1.03); }
        }
        @keyframes dvSpinRing {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes dvGlowRing {
          0%   { transform: scale(1);   opacity: 0.6; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        @keyframes dvNotifPing {
          0%        { transform: scale(1);   opacity: 1; }
          75%, 100% { transform: scale(2.4); opacity: 0; }
        }
        @keyframes dvSlideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes dvMsgFadeIn {
          from { opacity: 0; transform: translateX(-12px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes dvShimmer {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes dvBlink {
          0%,100% { opacity: 1; }
          50%     { opacity: 0.3; }
        }
        .dv-fab:hover  { transform: scale(1.1) translateY(-3px) !important; }
        .dv-fab:active { transform: scale(0.92) !important; }
        .dv-close:hover { background: rgba(255,255,255,0.38) !important; }
      `}</style>

      <div style={{ position: "fixed", bottom: 28, right: 28, zIndex: 9999 }}>
        {!open && !hasAlerts && <>
          <div style={{ position: "absolute", inset: -2, borderRadius: "50%", border: "2px solid rgba(34,197,94,0.6)", animation: "dvGlowRing 2.2s ease-out infinite", pointerEvents: "none" }} />
          <div style={{ position: "absolute", inset: -2, borderRadius: "50%", border: "2px solid rgba(34,197,94,0.38)", animation: "dvGlowRing 2.2s ease-out 0.73s infinite", pointerEvents: "none" }} />
          <div style={{ position: "absolute", inset: -2, borderRadius: "50%", border: "1.5px solid rgba(34,197,94,0.2)", animation: "dvGlowRing 2.2s ease-out 1.46s infinite", pointerEvents: "none" }} />
        </>}
        {!open && hasAlerts && <>
          <div style={{ position: "absolute", inset: -2, borderRadius: "50%", border: "2px solid rgba(239,68,68,0.7)", animation: "dvGlowRing 1.4s ease-out infinite", pointerEvents: "none" }} />
          <div style={{ position: "absolute", inset: -2, borderRadius: "50%", border: "2px solid rgba(239,68,68,0.45)", animation: "dvGlowRing 1.4s ease-out 0.47s infinite", pointerEvents: "none" }} />
        </>}

        {open && (
          <div style={{
            position: "absolute", bottom: 82, right: 0,
            width: 460,
            background: "white",
            borderRadius: 24,
            boxShadow: "0 28px 70px rgba(0,0,0,0.13), 0 6px 28px rgba(22,163,74,0.13)",
            overflow: "hidden",
            display: "flex", flexDirection: "column",
            animation: "dvSlideUp 0.3s cubic-bezier(0.34,1.56,0.64,1)",
            transformOrigin: "bottom right",
          }}>
            <div style={{
              background: hasAlerts
                ? "linear-gradient(270deg,#7f1d1d,#dc2626,#f87171,#dc2626,#7f1d1d)"
                : "linear-gradient(270deg,#14532d,#16a34a,#4ade80,#16a34a,#14532d)",
              backgroundSize: "300% 300%",
              animation: "dvShimmer 5s ease infinite",
              padding: "15px 16px",
              display: "flex", alignItems: "center", gap: 12, flexShrink: 0,
            }}>
              <div style={{
                flexShrink: 0, width: 48, height: 48, borderRadius: "50%",
                background: "rgba(255,255,255,0.18)", backdropFilter: "blur(6px)",
                border: "2px solid rgba(255,255,255,0.45)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <BotSVG size={28} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: "white", fontWeight: 700, fontSize: "0.97rem", letterSpacing: "0.3px" }}>
                  {hasAlerts ? "⚠️ Cảnh báo thiết bị" : "Greenhouse AI"}
                </div>
                <div style={{ color: "rgba(255,255,255,0.88)", fontSize: "0.72rem", display: "flex", alignItems: "center", gap: 5, marginTop: 3 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: hasAlerts ? "#fca5a5" : "#bbf7d0", display: "inline-block", animation: "dvBlink 2s ease-in-out infinite" }} />
                  {loading ? "Đang kiểm tra..." : hasAlerts ? `${offlineDevices.length} thiết bị mất kết nối` : `${devices.length} thiết bị hoạt động bình thường`}
                </div>
              </div>
              <button className="dv-close" onClick={() => setOpen(false)} style={{
                background: "rgba(255,255,255,0.18)", backdropFilter: "blur(4px)",
                border: "1.5px solid rgba(255,255,255,0.35)", color: "white",
                width: 32, height: 32, borderRadius: "50%", cursor: "pointer",
                fontSize: "0.88rem", display: "flex", alignItems: "center", justifyContent: "center",
                transition: "background 0.2s",
              }}>✕</button>
            </div>

            <div style={{
              padding: "14px 16px",
              minHeight: 120, maxHeight: 340, overflowY: "auto",
              background: hasAlerts
                ? "linear-gradient(180deg,#fff5f5 0%,#f8fafc 100%)"
                : "linear-gradient(180deg,#f0fdf4 0%,#f8fafc 100%)",
            }}>
              {loading ? (
                <div style={{ display: "flex", gap: 10, alignItems: "flex-end", animation: "dvMsgFadeIn 0.3s ease" }}>
                  <BotAvatar size={36} />
                  <div style={{ background: "white", border: "1.5px solid #dcfce7", borderRadius: "15px 15px 15px 3px", padding: "12px 16px", display: "flex", gap: 6, alignItems: "center", boxShadow: "0 2px 10px rgba(0,0,0,0.06)" }}>
                    {[0, 0.22, 0.44].map((delay, i) => (
                      <span key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", display: "inline-block", animation: `dvBlink 1.2s ${delay}s ease-in-out infinite` }} />
                    ))}
                  </div>
                </div>
              ) : devices.length === 0 ? (
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start", animation: "dvMsgFadeIn 0.3s ease" }}>
                  <BotAvatar size={36} />
                  <div style={{ background: "white", border: "1.5px solid #e2e8f0", borderRadius: "15px 15px 15px 3px", padding: "12px 14px", fontSize: "0.84rem", color: "#64748b", lineHeight: 1.75 }}>
                    📡 Chưa có thiết bị nào kết nối. Hãy đảm bảo ESP32 đang gửi dữ liệu.
                  </div>
                </div>
              ) : !hasAlerts ? (
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start", animation: "dvMsgFadeIn 0.3s ease" }}>
                  <BotAvatar size={36} />
                  <div style={{ background: "white", border: "1.5px solid #bbf7d0", borderRadius: "15px 15px 15px 3px", padding: "12px 14px", fontSize: "0.84rem", color: "#1e293b", lineHeight: 1.75, boxShadow: "0 2px 10px rgba(22,163,74,0.08)" }}>
                    ✅ Tất cả <strong>{devices.length}</strong> thiết bị đang hoạt động bình thường!
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, animation: "dvMsgFadeIn 0.3s ease" }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <BotAvatar size={36} />
                    <div style={{ background: "white", border: "1.5px solid #fecaca", borderRadius: "15px 15px 15px 3px", padding: "10px 13px", fontSize: "0.82rem", color: "#7f1d1d", lineHeight: 1.6, boxShadow: "0 2px 8px rgba(239,68,68,0.08)" }}>
                      Phát hiện <strong>{offlineDevices.length}</strong> thiết bị mất kết nối — cần kiểm tra ngay!
                    </div>
                  </div>
                  {offlineDevices.map((d, i) => (
                    <div key={d.deviceId} style={{
                      marginLeft: 46,
                      background: "#fff7ed",
                      border: "1.5px solid #fed7aa",
                      borderLeft: "4px solid #f97316",
                      borderRadius: "0 10px 10px 0", padding: "9px 12px",
                      fontSize: "0.8rem", color: "#1e293b", lineHeight: 1.55,
                      animation: `dvMsgFadeIn 0.3s ${i * 0.07}s ease both`,
                    }}>
                      <span style={{ fontWeight: 700, color: "#c2410c" }}>📡 {d.deviceId}</span>
                      <br />Mất kết nối — lần cuối thấy: {d.lastSeen ? new Date(d.lastSeen).toLocaleTimeString("vi-VN") : "—"}
                    </div>
                  ))}
                  {devices.filter((d) => d.online).length > 0 && (
                    <div style={{ marginLeft: 46, background: "#f0fdf4", border: "1.5px solid #bbf7d0", borderLeft: "4px solid #22c55e", borderRadius: "0 10px 10px 0", padding: "9px 12px", fontSize: "0.8rem", color: "#166534" }}>
                      ✅ {devices.filter((d) => d.online).length} thiết bị khác vẫn online bình thường
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {!open && (
          <div style={{
            position: "absolute", inset: -2, borderRadius: "50%",
            background: hasAlerts
              ? "conic-gradient(from 0deg, #ef4444, #fca5a5, #f87171, #dc2626, #ef4444)"
              : "conic-gradient(from 0deg, #22c55e, #86efac, #4ade80, #166534, #22c55e)",
            animation: "dvSpinRing 3s linear infinite",
            pointerEvents: "none",
          }}>
            <div style={{
              position: "absolute", inset: 2, borderRadius: "50%",
              background: hasAlerts
                ? "linear-gradient(135deg,#ef4444,#dc2626)"
                : "linear-gradient(135deg,#22c55e,#16a34a)",
            }} />
          </div>
        )}

        <button className="dv-fab" onClick={() => setOpen((p) => !p)} style={{
          position: "relative", zIndex: 2,
          width: 60, height: 60, borderRadius: "50%",
          background: open
            ? (hasAlerts ? "linear-gradient(135deg,#b91c1c,#991b1b)" : "linear-gradient(135deg,#15803d,#166534)")
            : (hasAlerts ? "linear-gradient(135deg,#ef4444,#dc2626)" : "linear-gradient(135deg,#22c55e,#16a34a)"),
          border: "2.5px solid rgba(255,255,255,0.3)",
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          animation: open ? "none" : hasAlerts ? "dvBotAlert 0.95s ease-in-out infinite" : "dvBotFloat 2.6s ease-in-out infinite",
          boxShadow: open ? "0 4px 18px rgba(22,163,74,0.4)" : hasAlerts ? "0 8px 30px rgba(239,68,68,0.6)" : "0 8px 30px rgba(34,197,94,0.6)",
          transition: "background 0.3s, box-shadow 0.3s, transform 0.18s",
        }}>
          <BotSVG size={40} />
        </button>

        {hasAlerts && !open && (
          <div style={{ position: "absolute", top: -4, right: -4, width: 22, height: 22, zIndex: 10 }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#ef4444", opacity: 0.55, animation: "dvNotifPing 1.4s ease-out infinite" }} />
            <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#ef4444", border: "2.5px solid white", position: "relative", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", color: "white", fontWeight: 800, boxShadow: "0 2px 6px rgba(239,68,68,0.6)" }}>
              {offlineDevices.length}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default function Settings() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await getDevices();
      setDevices(res.data);
    } catch {
      // server not yet ready
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <div className="view-container" style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>

      {/* ─── Device Card ─── */}
      <div className="data-card">
        <div className="data-header">
          <h2>Thiết bị ESP32</h2>
          <span className="data-controls" style={{ cursor: "pointer", color: "#3b82f6" }} onClick={refresh}>
            ↻ Làm mới
          </span>
        </div>

        {loading ? (
          <p style={{ color: "var(--text-gray)", fontSize: "0.9rem" }}>Đang tải...</p>
        ) : devices.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-gray)" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>📡</div>
            <p style={{ fontWeight: 600 }}>Chưa có thiết bị nào gửi dữ liệu</p>
            <p style={{ fontSize: "0.82rem", marginTop: "0.5rem" }}>
              ESP32 hãy POST tới: <code style={{ background: "var(--bg-main)", padding: "2px 6px", borderRadius: 4 }}>POST /api/sensor/push</code>
            </p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Device ID</th>
                  <th>Trạng thái</th>
                  <th>Lần cuối gửi</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((d) => (
                  <tr key={d.deviceId}>
                    <td style={{ fontWeight: 600 }}>{d.deviceId}</td>
                    <td>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: "6px",
                        padding: "2px 10px", borderRadius: 99, fontSize: "0.78rem", fontWeight: 600,
                        background: d.online ? "#dcfce7" : "#fee2e2",
                        color:      d.online ? "#15803d" : "#b91c1c",
                      }}>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: d.online ? "#22c55e" : "#ef4444", display: "inline-block" }} />
                        {d.online ? "Online" : "Offline"}
                      </span>
                    </td>
                    <td style={{ color: "var(--text-gray)", fontSize: "0.83rem" }}>
                      {d.lastSeen ? new Date(d.lastSeen).toLocaleTimeString("vi-VN") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p style={{ fontSize: "0.78rem", color: "var(--text-gray)", marginTop: "1rem" }}>
          Tự động làm mới mỗi 10 giây · Offline sau &gt;30 giây không nhận tín hiệu
        </p>
      </div>
      <DeviceBot devices={devices} loading={loading} />
    </div>
  );
}
