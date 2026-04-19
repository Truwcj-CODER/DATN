"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useSensorContext } from "@/context/SensorContext";
import type { SensorRecord } from "@/types/sensor";
import { importCsv } from "@/services/api";

const todayYMD = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const fmtYMD = (d: Date | string | null): string => {
  if (!d) return "";
  if (typeof d === "string") return d;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const fmtDisplay = (ymd: string) => {
  if (!ymd) return "—";
  const [y, m, day] = ymd.split("-");
  return `${day}/${m}/${y}`;
};

const MONTHS = ["Tháng 1","Tháng 2","Tháng 3","Tháng 4","Tháng 5","Tháng 6",
                "Tháng 7","Tháng 8","Tháng 9","Tháng 10","Tháng 11","Tháng 12"];
const WEEKDAYS = ["CN","T2","T3","T4","T5","T6","T7"];

const navBtn: React.CSSProperties = { background: "none", border: "none", cursor: "pointer", color: "var(--text-gray)", fontSize: 20, padding: "2px 8px", borderRadius: 6, lineHeight: 1 };
const hdrBtn: React.CSSProperties = { background: "none", border: "none", cursor: "pointer", color: "var(--text-dark)", fontWeight: 700, fontSize: "0.92rem", borderRadius: 6, padding: "2px 6px", textDecoration: "underline dotted", textUnderlineOffset: 3 };

function CalendarPopup({ value, onChange, onClose }: { value: string; onChange: (v: string) => void; onClose: () => void }) {
  const today = todayYMD();
  const initDate = value ? new Date(value + "T00:00:00") : new Date();
  const [viewYear,  setViewYear]  = useState(initDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initDate.getMonth());
  const [panel, setPanel] = useState<"day" | "month" | "year">("day");
  const [yearStart, setYearStart] = useState(Math.floor(initDate.getFullYear() / 12) * 12);

  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y-1); } else setViewMonth((m) => m-1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y+1); } else setViewMonth((m) => m+1); };

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth+1, 0).getDate();
  const prevDays = new Date(viewYear, viewMonth, 0).getDate();
  const cells: { day: number; cur: boolean }[] = [];
  for (let i = firstDay - 1; i >= 0; i--) cells.push({ day: prevDays - i, cur: false });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, cur: true });
  while (cells.length % 7 !== 0) cells.push({ day: cells.length - firstDay - daysInMonth + 1, cur: false });
  const cellYMD = (cell: { day: number; cur: boolean }) => !cell.cur ? null :
    `${viewYear}-${String(viewMonth+1).padStart(2,"0")}-${String(cell.day).padStart(2,"0")}`;

  return (
    <div style={{
      position: "absolute", top: "110%", left: 0, zIndex: 9999,
      background: "var(--card-bg)", border: "1px solid var(--border-color)",
      borderRadius: 14, boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
      padding: "14px", width: 268, userSelect: "none",
    }}>
      {panel === "year" && (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <button style={navBtn} onClick={() => setYearStart((y) => y - 12)}>‹</button>
            <span style={{ fontWeight: 700, fontSize: "0.92rem", color: "var(--text-dark)" }}>{yearStart} – {yearStart + 11}</span>
            <button style={navBtn} onClick={() => setYearStart((y) => y + 12)}>›</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 4 }}>
            {Array.from({ length: 12 }, (_, i) => yearStart + i).map((y) => (
              <button key={y} onClick={() => { setViewYear(y); setPanel("month"); }}
                style={{
                  borderRadius: 8, padding: "7px 4px", fontSize: "0.82rem", fontWeight: y === viewYear ? 700 : 400,
                  background: y === viewYear ? "#22c55e" : "transparent",
                  color: y === viewYear ? "#fff" : y === new Date().getFullYear() ? "#22c55e" : "var(--text-dark)",
                  border: y === new Date().getFullYear() && y !== viewYear ? "1.5px solid #22c55e" : "1.5px solid transparent",
                  cursor: "pointer",
                }}
              >{y}</button>
            ))}
          </div>
          <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid var(--border-color)", textAlign: "right" }}>
            <button onClick={() => setPanel("day")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-gray)", fontSize: "0.8rem", fontWeight: 600 }}>← Quay lại</button>
          </div>
        </>
      )}

      {panel === "month" && (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <button style={navBtn} onClick={() => setViewYear((y) => y - 1)}>‹</button>
            <button style={hdrBtn} onClick={() => { setYearStart(Math.floor(viewYear/12)*12); setPanel("year"); }}>{viewYear}</button>
            <button style={navBtn} onClick={() => setViewYear((y) => y + 1)}>›</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 4 }}>
            {MONTHS.map((name, mi) => (
              <button key={mi} onClick={() => { setViewMonth(mi); setPanel("day"); }}
                style={{
                  borderRadius: 8, padding: "8px 4px", fontSize: "0.8rem", fontWeight: mi === viewMonth ? 700 : 400,
                  background: mi === viewMonth ? "#22c55e" : "transparent",
                  color: mi === viewMonth ? "#fff" : (mi === new Date().getMonth() && viewYear === new Date().getFullYear()) ? "#22c55e" : "var(--text-dark)",
                  border: (mi === new Date().getMonth() && viewYear === new Date().getFullYear() && mi !== viewMonth) ? "1.5px solid #22c55e" : "1.5px solid transparent",
                  cursor: "pointer",
                }}
              >{name}</button>
            ))}
          </div>
          <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid var(--border-color)", textAlign: "right" }}>
            <button onClick={() => setPanel("day")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-gray)", fontSize: "0.8rem", fontWeight: 600 }}>← Quay lại</button>
          </div>
        </>
      )}

      {panel === "day" && (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <button style={navBtn} onClick={prevMonth}>‹</button>
            <div style={{ display: "flex", gap: 4 }}>
              <button style={hdrBtn} onClick={() => setPanel("month")}>{MONTHS[viewMonth]}</button>
              <button style={hdrBtn} onClick={() => { setYearStart(Math.floor(viewYear/12)*12); setPanel("year"); }}>{viewYear}</button>
            </div>
            <button style={navBtn} onClick={nextMonth}>›</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", marginBottom: 6 }}>
            {WEEKDAYS.map((d) => (
              <div key={d} style={{ textAlign: "center", fontSize: "0.7rem", fontWeight: 700, color: "var(--text-gray)", padding: "2px 0" }}>{d}</div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
            {cells.map((cell, i) => {
              const ymd = cellYMD(cell);
              const isSel   = ymd && ymd === value;
              const isToday = ymd && ymd === today;
              return (
                <button key={i} onClick={() => { if (ymd) { onChange(ymd); onClose(); } }}
                  style={{
                    background: isSel ? "#22c55e" : "transparent",
                    color: isSel ? "#fff" : isToday ? "#22c55e" : cell.cur ? "var(--text-dark)" : "var(--text-gray)",
                    border: isToday && !isSel ? "1.5px solid #22c55e" : "1.5px solid transparent",
                    borderRadius: 7, padding: "6px 0", fontSize: "0.81rem",
                    fontWeight: isSel || isToday ? 700 : 400,
                    cursor: cell.cur ? "pointer" : "default",
                    opacity: cell.cur ? 1 : 0.3,
                    transition: "background 0.12s",
                  }}
                >{cell.day}</button>
              );
            })}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, paddingTop: 8, borderTop: "1px solid var(--border-color)" }}>
            <button onClick={() => { onChange(""); onClose(); }}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-gray)", fontSize: "0.8rem", fontWeight: 600 }}>Xóa</button>
            <button onClick={() => { onChange(today); onClose(); }}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#22c55e", fontSize: "0.8rem", fontWeight: 700 }}>Hôm nay</button>
          </div>
        </>
      )}
    </div>
  );
}

function DateBtn({ value, onChange, highlight }: { value: string; onChange: (v: string) => void; highlight?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button onClick={() => setOpen((o) => !o)} style={{
        padding: "0.32rem 0.8rem", borderRadius: 7, fontWeight: 600, fontSize: "0.84rem",
        cursor: "pointer", minWidth: 118, whiteSpace: "nowrap",
        border: highlight ? "2px solid #22c55e" : "1px solid var(--border-color)",
        background: "var(--card-bg)", color: "var(--text-dark)",
      }}>
        📅 {fmtDisplay(value)}
      </button>
      {open && <CalendarPopup value={value} onChange={onChange} onClose={() => setOpen(false)} />}
    </div>
  );
}

const arrowBtn: React.CSSProperties = {
  width: 30, height: 30, borderRadius: 7, border: "1px solid var(--border-color)",
  background: "var(--btn-light-bg)", color: "var(--text-dark)", cursor: "pointer",
  fontWeight: 700, fontSize: "0.7rem", display: "inline-flex", alignItems: "center", justifyContent: "center",
  flexShrink: 0,
};

export default function HistoryTable() {
  const { history, reloadHistory } = useSensorContext();
  const [dateFrom, setDateFrom] = useState(todayYMD());
  const [dateTo,   setDateTo]   = useState(todayYMD());
  const [active,   setActive]   = useState("today");
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo,   setRangeTo]   = useState("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [toast, setToast] = useState<{show: boolean, count: number, total: number, err?: string}>({ show: false, count: 0, total: 0 });
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const res = await importCsv(file);
      await reloadHistory();
      setToast({ show: true, count: res.data.inserted, total: res.data.total_records });
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = setTimeout(() => setToast(t => ({...t, show: false})), 6000);
    } catch (err: any) {
      setToast({ show: true, count: 0, total: 0, err: err.response?.data?.error || err.message });
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = setTimeout(() => setToast(t => ({...t, show: false})), 6000);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const setPreset = (key: string) => {
    setActive(key);
    setRangeFrom(""); setRangeTo("");
    const now = new Date();
    const t = fmtYMD(now);
    if (key === "today") {
      setDateFrom(t); setDateTo(t);
    } else if (key === "week") {
      const day = now.getDay();
      const mon = new Date(now);
      mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
      setDateFrom(fmtYMD(mon)); setDateTo(t);
    } else if (key === "month") {
      const m = String(now.getMonth() + 1).padStart(2, "0");
      setDateFrom(`${now.getFullYear()}-${m}-01`); setDateTo(t);
    }
  };

  const shiftDay = (delta: number) => {
    const base = dateFrom || fmtYMD(new Date());
    const d = new Date(base);
    d.setDate(d.getDate() + delta);
    const ymd = fmtYMD(d);
    setDateFrom(ymd); setDateTo(ymd); setActive("today");
    setRangeFrom(""); setRangeTo("");
  };

  const filterFrom = useMemo(() => rangeFrom || (!rangeTo ? dateFrom : ""), [rangeFrom, rangeTo, dateFrom]);
  const filterTo   = useMemo(() => rangeTo   || (!rangeFrom ? dateTo : ""), [rangeTo, rangeFrom, dateTo]);

  const filtered = useMemo(() => {
    return history.filter((r: SensorRecord) => {
      const rDate = r.time?.slice(0, 10);
      if (filterFrom && rDate && rDate < filterFrom) return false;
      if (filterTo   && rDate && rDate > filterTo)   return false;
      return true;
    });
  }, [history, filterFrom, filterTo]);

  const dtf = useMemo(() => new Intl.DateTimeFormat("vi-VN", { 
    day: "2-digit", month: "2-digit", year: "numeric", 
    hour: "2-digit", minute: "2-digit", second: "2-digit", 
    hour12: false 
  }), []);

  const exportCsv = useCallback(() => {
    const lines = ["Time,Humidity,Atmospheric_Temp,Soil_Temp,Soil_Moisture,Dew_Point,Water_Need,Water_Flow"];
    filtered.forEach((r) => {
      lines.push(`${r.time},${r.humidity},${r.atmospheric_Temp},${r.soil_Temp},${r.soil_Moisture},${r.dew_Point},${r.water_Need > 0.5 ? 1 : 0},${r.water_Flow}`);
    });
    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `DATA_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [filtered]);

  const qBtnStyle = (key: string): React.CSSProperties => ({
    padding: "0.3rem 0.8rem", borderRadius: 7, fontSize: "0.78rem", fontWeight: 600,
    cursor: "pointer", border: "1px solid var(--border-color)", transition: "all 0.15s",
    background: active === key ? "#22c55e" : "var(--btn-light-bg)",
    color:      active === key ? "#fff"    : "var(--text-dark)",
  });

  return (
    <div className="view-container">
      <div className="data-card">
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 700, whiteSpace: "nowrap", marginRight: 4 }}>
            NHẬT KÝ DỮ LIỆU
          </h2>

          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <button style={arrowBtn} onClick={() => shiftDay(-1)}>◀</button>
            <DateBtn value={rangeFrom || rangeTo ? "" : dateFrom} highlight onChange={(d) => { setDateFrom(d); setDateTo(d); setActive("today"); setRangeFrom(""); setRangeTo(""); }} />
            <button style={arrowBtn} onClick={() => shiftDay(1)}>▶</button>
          </div>

          <button style={qBtnStyle("today")} onClick={() => setPreset("today")}>Hôm nay</button>
          <button style={qBtnStyle("week")}  onClick={() => setPreset("week")}>Tuần này</button>
          <button style={qBtnStyle("month")} onClick={() => setPreset("month")}>Tháng này</button>

          <span style={{ width: 1, height: 22, background: "var(--border-color)", display: "inline-block", margin: "0 4px", flexShrink: 0 }} />

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: "0.78rem", color: "var(--text-gray)", fontWeight: 600, whiteSpace: "nowrap" }}>Từ</span>
            <DateBtn value={rangeFrom} onChange={(d) => { setRangeFrom(d); setActive(""); }} />
            <span style={{ color: "var(--text-gray)", fontSize: "0.85rem" }}>→</span>
            <DateBtn value={rangeTo}   onChange={(d) => { setRangeTo(d);   setActive(""); }} />
          </div>

          <div style={{ marginLeft: "auto", display: "flex", gap: "0.5rem" }}>
            <input type="file" accept=".csv" ref={fileInputRef} style={{ display: "none" }} onChange={handleImport} />
            <button className="btn-export" onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              style={{ padding: "0.3rem 0.9rem", borderRadius: 7, whiteSpace: "nowrap", background: "#f59e0b", borderColor: "#f59e0b", color: "white" }}>
              {importing ? "Đang nhập..." : "📤 Nhập CSV"}
            </button>
            <button className="btn-export" onClick={exportCsv}
              style={{ padding: "0.3rem 0.9rem", borderRadius: 7, whiteSpace: "nowrap" }}>
              📥 Xuất Excel
            </button>
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Thời gian</th><th>Độ ẩm (%)</th>
                <th>Nhiệt độ Không Khí (°C)</th><th>Nhiệt độ đất (°C)</th>
                <th>Độ ẩm đất (%)</th><th>Điểm sương (°C)</th>
                <th>Lưu lượng (m³/h)</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: "center", padding: "2.5rem", color: "var(--text-gray)" }}>
                  Không có dữ liệu trong khoảng thời gian này
                </td></tr>
              ) : filtered.map((row, i) => (
                <tr key={row.time ?? i}>
                  <td>{row.time ? dtf.format(new Date(row.time)) : "—"}</td>
                  <td>{row.humidity?.toFixed(1)}</td>
                  <td>{row.atmospheric_Temp?.toFixed(1)}</td>
                  <td>{row.soil_Temp?.toFixed(1)}</td>
                  <td>{row.soil_Moisture?.toFixed(1)}</td>
                  <td>{row.dew_Point?.toFixed(1)}</td>
                  <td>{row.water_Flow?.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: "0.75rem", color: "var(--text-gray)", marginTop: "0.5rem" }}>
          {filtered.length} bản ghi
        </p>
      </div>
      
      {toast.show && (
        <div style={{
          position: "fixed", bottom: 28, right: 28, zIndex: 9999,
          background: "white", padding: "16px 20px", borderRadius: 12,
          boxShadow: "0 10px 40px rgba(0,0,0,0.15)", borderLeft: `5px solid ${toast.err ? '#ef4444' : '#22c55e'}`,
          animation: "slideUpFade 0.3s ease", display: "flex", flexDirection: "column", gap: 6, minWidth: 280
        }}>
          <style>{`
            @keyframes slideUpFade {
              from { opacity: 0; transform: translateY(20px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
          <div style={{ fontWeight: 700, color: toast.err ? "#b91c1c" : "#166534", fontSize: "0.95rem", paddingRight: 16 }}>
            {toast.err ? "Lỗi nhập dữ liệu!" : "✅ Nhập dữ liệu thành công!"}
          </div>
          {toast.err ? (
            <div style={{ fontSize: "0.85rem", color: "var(--text-dark)", lineHeight: 1.5 }}>
              {toast.err}
            </div>
          ) : (
            <div style={{ fontSize: "0.85rem", color: "var(--text-dark)", lineHeight: 1.5 }}>
              • Đã thêm: <strong>{toast.count}</strong> bản ghi<br/>
              • Tổng nhật ký: <strong>{toast.total}</strong> bản ghi
            </div>
          )}
          <button onClick={() => setToast({show: false, count: 0, total: 0})} style={{ position: "absolute", top: 12, right: 12, background: "none", border: "none", cursor: "pointer", fontSize: "1.2rem", color: "#9ca3af", lineHeight: 1, padding: 4 }}>&times;</button>
        </div>
      )}
    </div>
  );
}
