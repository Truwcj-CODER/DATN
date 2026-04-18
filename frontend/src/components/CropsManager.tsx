"use client";

import React, { useEffect, useRef, useState } from "react";
import { getCrops, updateCrop } from "@/services/api";
import { Save, RefreshCw, AlertCircle, CheckCircle2, Lock } from "lucide-react";

interface CropProfile {
  id: string;
  name: string;
  emoji: string;
  description: string;
  optimal: {
    humidity: [number, number];
    atmospheric_temp: [number, number];
    soil_temp: [number, number];
    soil_moisture: [number, number];
    dew_point: [number, number];
  };
  warning: {
    humidity: [number, number];
    atmospheric_temp: [number, number];
    soil_temp: [number, number];
    soil_moisture: [number, number];
    dew_point: [number, number];
  };
}

const CORRECT_PIN = "000000";
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 10 * 60 * 1000; // 10 minutes

// Sort crops so tomato always comes first
function sortCrops(crops: CropProfile[]): CropProfile[] {
  return [...crops].sort((a, b) => {
    if (a.id === "tomato") return -1;
    if (b.id === "tomato") return 1;
    return 0;
  });
}

const METRIC_INFO: Record<string, { label: string; unit: string; desc: string }> = {
  humidity:         { label: "Độ ẩm không khí", unit: "%",  desc: "Lượng hơi nước trong không khí" },
  atmospheric_temp: { label: "Nhiệt độ không khí", unit: "°C", desc: "Nhiệt độ môi trường xung quanh" },
  soil_temp:        { label: "Nhiệt độ đất",      unit: "°C", desc: "Nhiệt độ bên trong lớp đất" },
  soil_moisture:    { label: "Độ ẩm đất",         unit: "%",  desc: "Lượng nước trong đất" },
  dew_point:        { label: "Điểm sương",        unit: "°C", desc: "Nhiệt độ mà không khí bắt đầu ngưng tụ" },
};

export default function CropsManager() {
  const [crops, setCrops] = useState<CropProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingCrop, setEditingCrop] = useState<CropProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);

  // PIN state
  const [pinDigits, setPinDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [pinError, setPinError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [lockCountdown, setLockCountdown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Countdown tick when locked
  useEffect(() => {
    if (lockedUntil) {
      const tick = () => {
        const remaining = Math.max(0, lockedUntil - Date.now());
        setLockCountdown(Math.ceil(remaining / 1000));
        if (remaining <= 0) {
          setLockedUntil(null);
          setAttempts(0);
          if (countdownRef.current) clearInterval(countdownRef.current);
        }
      };
      tick();
      countdownRef.current = setInterval(tick, 1000);
    }
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [lockedUntil]);

  const fetchCrops = async () => {
    setLoading(true);
    try {
      const res = await getCrops();
      const sorted = sortCrops(res.data);
      setCrops(sorted);
      if (sorted.length > 0 && !selectedId) {
        setSelectedId(sorted[0].id);
        setEditingCrop(JSON.parse(JSON.stringify(sorted[0])));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCrops(); }, []);

  useEffect(() => {
    const crop = crops.find((c) => c.id === selectedId);
    if (crop) {
      setEditingCrop(JSON.parse(JSON.stringify(crop)));
      setMessage(null);
    }
  }, [selectedId, crops]);

  const handleUpdateField = (path: string, value: any) => {
    if (!editingCrop) return;
    const newCrop = { ...editingCrop };
    const keys = path.split(".");
    let current: any = newCrop;
    for (let i = 0; i < keys.length - 1; i++) current = current[keys[i]];
    current[keys[keys.length - 1]] = value;
    setEditingCrop(newCrop);
  };

  const handleUpdateRange = (group: "optimal" | "warning", metric: string, index: number, value: string) => {
    if (!editingCrop) return;
    const val = parseFloat(value) || 0;
    const newCrop = { ...editingCrop };
    (newCrop[group] as any)[metric][index] = val;
    setEditingCrop(newCrop);
  };

  const handleSave = async () => {
    if (!editingCrop || !selectedId) return;
    setSaving(true);
    setMessage(null);
    try {
      await updateCrop(selectedId, editingCrop);
      setMessage({ type: "success", text: "Đã cập nhật cấu hình cây trồng thành công!" });
      const res = await getCrops();
      setCrops(sortCrops(res.data));
    } catch {
      setMessage({ type: "error", text: "Lỗi khi lưu cấu hình. Vui lòng thử lại." });
    } finally {
      setSaving(false);
      setIsUnlocked(false);
    }
  };

  // ── PIN handlers ──────────────────────────────────────────────
  const openPinModal = () => {
    setPinDigits(["", "", "", "", "", ""]);
    setPinError(null);
    setShowPinModal(true);
    setTimeout(() => inputRefs.current[0]?.focus(), 80);
  };

  const handlePinDigit = (index: number, val: string) => {
    if (lockedUntil) return;
    const digit = val.replace(/\D/g, "").slice(-1);
    const next = [...pinDigits];
    next[index] = digit;
    setPinDigits(next);
    setPinError(null);
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
    // Auto-submit when all filled
    if (digit && index === 5) {
      const full = [...next].join("");
      if (full.length === 6) setTimeout(() => verifyPin(full), 80);
    }
  };

  const handlePinKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (pinDigits[index]) {
        const next = [...pinDigits];
        next[index] = "";
        setPinDigits(next);
      } else if (index > 0) {
        inputRefs.current[index - 1]?.focus();
        const next = [...pinDigits];
        next[index - 1] = "";
        setPinDigits(next);
      }
    } else if (e.key === "Enter") {
      const full = pinDigits.join("");
      if (full.length === 6) verifyPin(full);
    }
  };

  const verifyPin = (pin: string) => {
    if (lockedUntil) return;
    if (pin === CORRECT_PIN) {
      setIsUnlocked(true);
      setShowPinModal(false);
      setAttempts(0);
      setPinError(null);
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      if (newAttempts >= MAX_ATTEMPTS) {
        const until = Date.now() + LOCKOUT_MS;
        setLockedUntil(until);
        setPinError(`Sai quá ${MAX_ATTEMPTS} lần! Bị khóa 10 phút.`);
      } else {
        setPinError(`Sai mã PIN! Còn ${MAX_ATTEMPTS - newAttempts} lần thử.`);
      }
      setPinDigits(["", "", "", "", "", ""]);
      setTimeout(() => inputRefs.current[0]?.focus(), 80);
    }
  };

  const handlePinSubmit = () => {
    const full = pinDigits.join("");
    if (full.length === 6) verifyPin(full);
  };

  if (loading) return <div className="view-container" style={{ padding: "2rem", textAlign: "center" }}>Đang tải dữ liệu...</div>;

  const activeCrop = editingCrop;

  return (
    <div className="view-container" style={{ padding: "1.5rem" }}>

      {/* ── Global styles for PIN ── */}
      <style>{`
        @keyframes pinShake {
          0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 40%{transform:translateX(8px)} 60%{transform:translateX(-5px)} 80%{transform:translateX(5px)}
        }
        @keyframes pinSlideIn {
          from{opacity:0;transform:translateY(24px) scale(0.96)}
          to{opacity:1;transform:translateY(0) scale(1)}
        }
        @keyframes overlayFadeIn {
          from{opacity:0} to{opacity:1}
        }
        .pin-box {
          width: 52px; height: 62px;
          border: 2.5px solid #cbd5e1;
          border-radius: 12px;
          font-size: 1.6rem; font-weight: 700;
          text-align: center; outline: none;
          background: #f8fafc;
          color: #1e293b;
          caret-color: transparent;
          transition: border-color 0.18s, background 0.18s, box-shadow 0.18s;
          font-family: 'Courier New', monospace;
        }
        .pin-box:focus {
          border-color: #3b82f6;
          background: #fff;
          box-shadow: 0 0 0 3px rgba(59,130,246,0.18);
        }
        .pin-box.pin-filled {
          border-color: #6366f1;
          background: #eef2ff;
        }
        .pin-box.pin-error {
          border-color: #ef4444 !important;
          background: #fff5f5 !important;
          animation: pinShake 0.4s ease;
        }
        .pin-box.pin-locked {
          border-color: #94a3b8 !important;
          background: #f1f5f9 !important;
          color: #94a3b8;
          cursor: not-allowed;
        }
      `}</style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Quản Lý Cây Trồng</h1>
        <div style={{ display: "flex", gap: "1rem" }}>
          <button onClick={fetchCrops} className="btn-secondary" style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 1rem" }}>
            <RefreshCw size={16} /> Làm mới
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "250px 1fr", gap: "1.5rem" }}>

        {/* ── Sidebar: Crop List ── */}
        <div className="data-card" style={{ padding: "0.75rem" }}>
          <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--text-gray)", marginBottom: "0.75rem", padding: "0 0.5rem" }}>DANH SÁCH CÂY</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {crops.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                style={{
                  display: "flex", alignItems: "center", gap: "0.75rem",
                  padding: "0.75rem 1rem", borderRadius: 8, border: "none",
                  background: selectedId === c.id ? "#3b82f615" : "transparent",
                  color:      selectedId === c.id ? "#3b82f6" : "var(--text-dark)",
                  cursor: "pointer", transition: "all 0.2s", textAlign: "left",
                  fontWeight: selectedId === c.id ? 700 : 500,
                  borderLeft: selectedId === c.id ? "4px solid #3b82f6" : "4px solid transparent",
                }}
              >
                <span style={{ fontSize: "1.25rem" }}>{c.emoji}</span>
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* ── Main: Editor ── */}
        {activeCrop && (
          <div className="data-card" style={{ padding: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                <span style={{ fontSize: "2.5rem" }}>{activeCrop.emoji}</span>
                <div>
                  <input
                    value={activeCrop.name}
                    disabled={!isUnlocked}
                    onChange={(e) => handleUpdateField("name", e.target.value)}
                    style={{ fontSize: "1.25rem", fontWeight: 700, border: "none", background: "transparent", padding: 0, outline: "none", width: "100%", opacity: isUnlocked ? 1 : 0.7 }}
                  />
                  <input
                    value={activeCrop.description}
                    disabled={!isUnlocked}
                    onChange={(e) => handleUpdateField("description", e.target.value)}
                    placeholder="Mô tả ngắn về cây..."
                    style={{ fontSize: "0.85rem", color: "var(--text-gray)", border: "none", background: "transparent", padding: 0, outline: "none", width: "100%", marginTop: 4, opacity: isUnlocked ? 1 : 0.7 }}
                  />
                </div>
              </div>
              {!isUnlocked ? (
                <button
                  onClick={openPinModal}
                  className="btn-secondary"
                  style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "#f1f5f9", color: "#475569", border: "1.5px solid #cbd5e1" }}
                >
                  <Lock size={18} />
                  Mở khóa để Cài đặt
                </button>
              ) : (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="btn-export"
                  style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "#10b981", color: "white", border: "none" }}
                >
                  {saving ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
                  {saving ? "Đang lưu..." : "Lưu cấu hình"}
                </button>
              )}
            </div>

            {message && (
              <div style={{
                marginBottom: "1.5rem", padding: "0.75rem 1rem", borderRadius: 8,
                display: "flex", alignItems: "center", gap: "0.75rem",
                background: message.type === "success" ? "#dcfce7" : "#fee2e2",
                color:      message.type === "success" ? "#15803d" : "#b91c1c",
                fontSize: "0.85rem", fontWeight: 500,
              }}>
                {message.type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                {message.text}
              </div>
            )}

            {/* ── Table header ── */}
            <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1.2fr 1.2fr", gap: "0", marginBottom: "0", paddingBottom: "0.5rem", borderBottom: "2px solid var(--border-color)", alignItems: "center" }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-gray)", textTransform: "uppercase", letterSpacing: "0.05em", paddingRight: "1rem" }}>Thông số (đơn vị)</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem", fontSize: "0.9rem", fontWeight: 700, color: "#10b981", borderLeft: "2px dashed #cbd5e1", padding: "0 1rem" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981" }} />
                Ngưỡng Tối Ưu (Optimal)
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem", fontSize: "0.9rem", fontWeight: 700, color: "#f59e0b", borderLeft: "2px dashed #cbd5e1", padding: "0 1rem" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b" }} />
                Ngưỡng Cảnh Báo (Warning)
              </div>
            </div>

            {/* ── Metric rows ── */}
            <div style={{ display: "flex", flexDirection: "column" }}>
              {Object.keys(activeCrop.optimal).map((key) => {
                const info = METRIC_INFO[key];
                const optRange = (activeCrop.optimal as any)[key];
                const warnRange = (activeCrop.warning as any)[key];
                return (
                  <div key={key} style={{ display: "grid", gridTemplateColumns: "1.6fr 1.2fr 1.2fr", gap: "0", alignItems: "center", padding: "0.75rem 0", borderBottom: "1px solid #f1f5f9" }}>
                    {/* Label + description */}
                    <div style={{ paddingRight: "1rem" }}>
                      <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1e293b", textTransform: "uppercase", letterSpacing: "0.03em" }}>{key.replace(/_/g, " ")}</span>
                      {info && (
                        <div style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: 2 }}>{info.desc}</div>
                      )}
                    </div>

                    {/* Optimal inputs */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.35rem", opacity: isUnlocked ? 1 : 0.6, pointerEvents: isUnlocked ? "auto" : "none", borderLeft: "2px dashed #cbd5e1", padding: "0 1rem" }}>
                      <input type="number" value={optRange[0]} disabled={!isUnlocked}
                        onChange={(e) => handleUpdateRange("optimal", key, 0, e.target.value)}
                        style={{ width: "40%", padding: "0.45rem 0.5rem", borderRadius: 6, border: "1.5px solid #bbf7d0", fontSize: "0.95rem", fontWeight: 700, color: "#065f46", background: isUnlocked ? "#f0fdf4" : "#f1f5f9", textAlign: "center", minWidth: 0 }} />
                      <span style={{ color: "#94a3b8", fontSize: "0.8rem", margin: "0 2px" }}>→</span>
                      <input type="number" value={optRange[1]} disabled={!isUnlocked}
                        onChange={(e) => handleUpdateRange("optimal", key, 1, e.target.value)}
                        style={{ width: "40%", padding: "0.45rem 0.5rem", borderRadius: 6, border: "1.5px solid #bbf7d0", fontSize: "0.95rem", fontWeight: 700, color: "#065f46", background: isUnlocked ? "#f0fdf4" : "#f1f5f9", textAlign: "center", minWidth: 0 }} />
                      {info && <span style={{ fontSize: "0.75rem", color: "#10b981", fontWeight: 700, minWidth: 20 }}>{info.unit}</span>}
                    </div>

                    {/* Warning inputs */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.35rem", opacity: isUnlocked ? 1 : 0.6, pointerEvents: isUnlocked ? "auto" : "none", borderLeft: "2px dashed #cbd5e1", padding: "0 1rem" }}>
                      <input type="number" value={warnRange[0]} disabled={!isUnlocked}
                        onChange={(e) => handleUpdateRange("warning", key, 0, e.target.value)}
                        style={{ width: "40%", padding: "0.45rem 0.5rem", borderRadius: 6, border: "1.5px solid #fde68a", fontSize: "0.95rem", fontWeight: 700, color: "#92400e", background: isUnlocked ? "#fffbeb" : "#f1f5f9", textAlign: "center", minWidth: 0 }} />
                      <span style={{ color: "#94a3b8", fontSize: "0.8rem", margin: "0 2px" }}>→</span>
                      <input type="number" value={warnRange[1]} disabled={!isUnlocked}
                        onChange={(e) => handleUpdateRange("warning", key, 1, e.target.value)}
                        style={{ width: "40%", padding: "0.45rem 0.5rem", borderRadius: 6, border: "1.5px solid #fde68a", fontSize: "0.95rem", fontWeight: 700, color: "#92400e", background: isUnlocked ? "#fffbeb" : "#f1f5f9", textAlign: "center", minWidth: 0 }} />
                      {info && <span style={{ fontSize: "0.75rem", color: "#f59e0b", fontWeight: 700, minWidth: 20 }}>{info.unit}</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Legend ── */}
            <div style={{ marginTop: "1.5rem", padding: "0.85rem 1rem", borderRadius: 10, background: "#f8fafc", border: "1px solid var(--border-color)", fontSize: "0.8rem", color: "#475569", lineHeight: 1.8 }}>
              <strong>Cách đọc thông số:</strong><br/>
              ✅ <strong>Nằm trong Tối Ưu</strong> → cây phát triển tốt nhất, màn hình hiện xanh.<br/>
              ⚠️ <strong>Nằm trong Cảnh Báo</strong> (nhưng ngoài Tối Ưu) → hệ thống báo Warning, cần chú ý.<br/>
              🚨 <strong>Ngoài cả Cảnh Báo</strong> → hệ thống báo Critical, cần xử lý ngay.
            </div>
          </div>
        )}
      </div>

      {/* ── PIN Modal ── */}
      {showPinModal && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setShowPinModal(false); }}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(15,23,42,0.55)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex", alignItems: "center", justifyContent: "center",
            animation: "overlayFadeIn 0.2s ease",
          }}
        >
          <div style={{
            background: "white",
            padding: "2.5rem 2rem",
            borderRadius: 20,
            width: "100%", maxWidth: 400,
            boxShadow: "0 32px 64px rgba(0,0,0,0.22), 0 8px 24px rgba(59,130,246,0.12)",
            textAlign: "center",
            animation: "pinSlideIn 0.28s cubic-bezier(0.34,1.56,0.64,1)",
          }}>
            {/* Icon */}
            <div style={{
              width: 64, height: 64, borderRadius: "50%",
              background: lockedUntil
                ? "linear-gradient(135deg,#ef4444,#dc2626)"
                : "linear-gradient(135deg,#6366f1,#4f46e5)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 1.25rem",
              boxShadow: lockedUntil
                ? "0 8px 24px rgba(239,68,68,0.3)"
                : "0 8px 24px rgba(99,102,241,0.3)",
              fontSize: "1.75rem",
              transition: "all 0.3s",
            }}>
              {lockedUntil ? "🔒" : "🔐"}
            </div>

            <h3 style={{ fontSize: "1.2rem", fontWeight: 800, marginBottom: "0.4rem", color: "#0f172a" }}>
              {lockedUntil ? "Tạm thời bị khóa" : "Xác thực bảo mật"}
            </h3>
            <p style={{ fontSize: "0.85rem", color: "#64748b", marginBottom: "1.75rem", lineHeight: 1.6 }}>
              {lockedUntil
                ? <>Nhập sai quá {MAX_ATTEMPTS} lần. Vui lòng thử lại sau <strong style={{ color: "#ef4444" }}>{Math.floor(lockCountdown / 60)}:{String(lockCountdown % 60).padStart(2, "0")}</strong></>
                : "Nhập mã PIN 6 số để mở khóa cài đặt"}
            </p>

            {/* 6-digit PIN boxes */}
            <div style={{ display: "flex", gap: "0.6rem", justifyContent: "center", marginBottom: "1rem" }}>
              {pinDigits.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { inputRefs.current[i] = el; }}
                  id={`pin-box-${i}`}
                  type="password"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  disabled={!!lockedUntil}
                  onChange={(e) => handlePinDigit(i, e.target.value)}
                  onKeyDown={(e) => handlePinKeyDown(i, e)}
                  className={`pin-box ${digit ? "pin-filled" : ""} ${pinError ? "pin-error" : ""} ${lockedUntil ? "pin-locked" : ""}`}
                />
              ))}
            </div>

            {/* Error message */}
            {pinError && (
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
                color: "#b91c1c", fontSize: "0.82rem", fontWeight: 600,
                background: "#fef2f2", borderRadius: 8, padding: "0.5rem 1rem",
                marginBottom: "1.25rem", border: "1px solid #fecaca",
              }}>
                <AlertCircle size={15} />
                {pinError}
              </div>
            )}

            {/* Attempts dots */}
            {!lockedUntil && (
              <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: "1.5rem" }}>
                {Array.from({ length: MAX_ATTEMPTS }).map((_, i) => (
                  <div key={i} style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: i < attempts ? "#ef4444" : "#e2e8f0",
                    transition: "background 0.2s",
                  }} />
                ))}
              </div>
            )}

            {/* Buttons */}
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button
                onClick={() => setShowPinModal(false)}
                style={{
                  flex: 1, padding: "0.7rem", borderRadius: 10,
                  border: "1.5px solid #e2e8f0", background: "#f8fafc",
                  color: "#64748b", fontWeight: 600, cursor: "pointer",
                  fontSize: "0.9rem", transition: "background 0.15s",
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                onMouseOut={(e) => (e.currentTarget.style.background = "#f8fafc")}
              >
                Hủy
              </button>
              <button
                onClick={handlePinSubmit}
                disabled={!!lockedUntil || pinDigits.join("").length < 6}
                style={{
                  flex: 1, padding: "0.7rem", borderRadius: 10, border: "none",
                  background: lockedUntil || pinDigits.join("").length < 6
                    ? "#cbd5e1"
                    : "linear-gradient(135deg,#6366f1,#4f46e5)",
                  color: "white", fontWeight: 700, cursor: lockedUntil || pinDigits.join("").length < 6 ? "not-allowed" : "pointer",
                  fontSize: "0.9rem", transition: "opacity 0.15s",
                  boxShadow: lockedUntil || pinDigits.join("").length < 6 ? "none" : "0 4px 12px rgba(99,102,241,0.35)",
                }}
              >
                Xác nhận
              </button>
            </div>


          </div>
        </div>
      )}
    </div>
  );
}
