"use client";

import { useSensorContext } from "@/context/SensorContext";

export default function LoadingOverlay() {
  const { isTraining } = useSensorContext();
  if (!isTraining) return null;

  return (
    <div className="loading-overlay">
      <div className="loader-content">
        <div className="spinner"></div>
        <div className="loader-text">HỆ THỐNG ĐANG TRAINING AI...</div>
        <div className="loader-subtext">Vui lòng đợi trong giây lát</div>
      </div>
    </div>
  );
}
