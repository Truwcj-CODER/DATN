"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { SensorRecord, TrainResult } from "@/types/sensor";
import { EMPTY_SENSOR } from "@/types/sensor";
import socket from "@/services/socket";
import { fetchHistory } from "@/services/api";

interface SensorContextValue {
  history: SensorRecord[];
  isTraining: boolean;
  connected: boolean;
  trainResult: TrainResult | null;
  setTrainResult: (r: TrainResult | null) => void;
  current: SensorRecord;
  chartData: SensorRecord[];
  isWatering: boolean;
}

const SensorContext = createContext<SensorContextValue | null>(null);

export function SensorProvider({ children }: { children: ReactNode }) {
  const [history, setHistory] = useState<SensorRecord[]>([]);
  const [isTraining, setIsTraining] = useState(false);
  const [connected, setConnected] = useState(socket.connected);
  const [trainResult, setTrainResult] = useState<TrainResult | null>(null);

  useEffect(() => {
    const loadHistory = () => {
      fetchHistory()
        .then((r) => setHistory(r.data))
        .catch(() => {});
    };

    const onConnect = () => {
      setConnected(true);
      loadHistory();
    };
    const onDisconnect = () => setConnected(false);
    const onSensorData = (data: SensorRecord) =>
      setHistory((prev) => [data, ...prev].slice(0, 100));
    const onTrainingStatus = (payload: { status: string }) =>
      setIsTraining(payload.status === "started" || payload.status === "running");
    const onModelsUpdated = (result: TrainResult) => {
      setTrainResult(result);
      setIsTraining(false);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("receive_sensor_data", onSensorData);
    socket.on("training_status", onTrainingStatus);
    socket.on("models_updated", onModelsUpdated);

    if (socket.connected) loadHistory();

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("receive_sensor_data", onSensorData);
      socket.off("training_status", onTrainingStatus);
      socket.off("models_updated", onModelsUpdated);
    };
  }, []);

  const current = history[0] ?? EMPTY_SENSOR;
  const chartData = history.slice(0, 40).reverse();
  const isWatering = (current.water_Need ?? 0) > 0.5;

  return (
    <SensorContext.Provider
      value={{ history, isTraining, connected, trainResult, setTrainResult, current, chartData, isWatering }}
    >
      {children}
    </SensorContext.Provider>
  );
}

export function useSensorContext(): SensorContextValue {
  const ctx = useContext(SensorContext);
  if (!ctx) throw new Error("useSensorContext must be used inside SensorProvider");
  return ctx;
}
