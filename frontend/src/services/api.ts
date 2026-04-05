import axios from "axios";
import type { SensorRecord, MetricsResult, Device, ManualPredictInput, SensorPredictions } from "@/types/sensor";

const api = axios.create({ baseURL: "/api" });

export const fetchHistory = (limit = 100) =>
  api.get<SensorRecord[]>("/sensor/history", { params: { limit } });

export const setLogging = (enabled: boolean) =>
  api.post("/sensor/logging", null, { params: { enabled } });

export const getDevices = () =>
  api.get<Device[]>("/sensor/devices");

export const predictManual = (data: ManualPredictInput) =>
  api.post<SensorPredictions>("/sensor/predict", data);

export const getModelMetrics = () =>
  api.get<MetricsResult>("/models/metrics");

export const retrain = (models: string[]) =>
  api.post("/training/retrain", { models });

export const aiAnalyze = (data: unknown) =>
  api.post<{ analysis: string }>("/ai/analyze", data);

export const getClassificationMetrics = () =>
  api.get("/models/classification-metrics");
