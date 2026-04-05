export interface SensorPredictions {
  linear?: number;
  random_forest?: number;
  xgboost?: number;
}

export interface SensorRecord {
  humidity: number;
  atmospheric_Temp: number;
  soil_Temp: number;
  soil_Moisture: number;
  dew_Point: number;
  water_Flow: number;
  water_Need: number;
  predictions: SensorPredictions;
  time?: string;
  timestamp?: string;
  deviceId?: string;
}

export const EMPTY_SENSOR: SensorRecord = {
  humidity: 0,
  atmospheric_Temp: 0,
  soil_Temp: 0,
  soil_Moisture: 0,
  dew_Point: 0,
  water_Flow: 0,
  water_Need: 0,
  predictions: {},
};

export interface ModelMetrics {
  rmse: number;
  mae: number;
  r2: number;
  name?: string;
}

export type MetricsResult = Record<string, ModelMetrics>;

export interface ClfMetrics {
  name?: string;
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1?: number;
  auc?: number;
  train_time?: number;
  confusion_matrix?: number[][];
}

export interface ChartData {
  actual: number[];
  predicted: number[];
}

export interface StatTest {
  t_stat?: number;
  p_value?: number;
  statistic?: number;
}

export interface TrainResult {
  success: boolean;
  error?: string;
  results?: MetricsResult;
  chart_data?: Record<string, ChartData>;
  best_model?: string;
  clf_results?: Record<string, ClfMetrics>;
  best_clf_model?: string;
  stat_results?: {
    regression?: Record<string, StatTest>;
    classification?: Record<string, StatTest>;
  };
  sample_count?: number;
}

export interface Device {
  deviceId: string;
  online: boolean;
  lastSeen?: string;
}

export interface ManualPredictInput {
  Humidity: number;
  Atmospheric_Temp: number;
  Soil_Temp: number;
  Soil_Moisture: number;
}
