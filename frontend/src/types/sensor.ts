export interface SensorPredictions {
  linear?: number;
  random_forest?: number;
  xgboost?: number;
}

export interface ForecastDay {
  date: string;
  temperature: number;
  humidity: number;
  precipitation: number;
  estimated_soil_temp: number;
  estimated_soil_moisture: number;
  dew_point: number;
  predictions: SensorPredictions;
  model_score: number;
  water_need: boolean;
  recommendation: string;
}

export interface SevenDayForecast {
  source: string;
  latitude: number;
  longitude: number;
  crop_type: string;
  baseline: SensorRecord;
  days: ForecastDay[];
}

export interface GeocodeResult {
  display_name: string;
  lat: string;
  lon: string;
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
  feature_importance?: Record<string, { feature: string; importance: number }[]>;
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
