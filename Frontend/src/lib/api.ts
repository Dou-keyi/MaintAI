import axios, { AxiosHeaders } from 'axios'
import { supabase } from './supabase'

export const apiBase =
  ((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '').replace(/\/$/, '') || ''

export const api = axios.create({
  baseURL: apiBase,
})

api.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession()
  const userId = data.session?.user?.id

  if (userId) {
    const headers = AxiosHeaders.from(config.headers ?? {})
    headers.set('X-User-Id', userId)
    config.headers = headers
  }

  return config
})

export type MachineSummary = {
  id: number
  name: string
  type: string
  brand?: string | null
  location?: string | null
  install_date?: string | null
  health: number
  rul_cycles: number
  rul_days: number
  revenue_per_month?: number | null
  operating_cost_per_month?: number | null
  projected_maintenance_cost?: number | null
  replacement_cost?: number | null
  economics?: MachineEconomics | null
  status: 'Healthy' | 'Warning' | 'Critical'
  last_maint?: string | null
  notes?: string | null
  latest_prediction?: Prediction | null
}

export type Prediction = {
  id?: number
  machine_id?: number | null
  health_pct: number
  rul_cycles: number
  rul_days: number
  status: 'Healthy' | 'Warning' | 'Critical'
  confidence?: number
  confidence_pct?: number
  model_mode?: string
  top_factors?: Array<{ feature: string; impact?: number; direction?: string }>
}

export type AlertItem = {
  id?: number
  machine_id?: number | null
  severity: 'warning' | 'critical' | 'info'
  title: string
  message: string
  created_at: string
  is_active?: boolean
}

export type MaintenanceLog = {
  id?: number
  machine_id: number
  machine_name?: string
  maintenance_date: string
  maintenance_type: string
  parts_replaced?: string | null
  cost: number
  technician?: string | null
  notes?: string | null
   restored_health_pct?: number | null
   restored_rul_cycles?: number | null
   reset_cycle?: number | null
   cleared_sensor_history?: boolean
   cleared_alerts?: boolean
}

export type MachineEconomics = {
  revenue_per_month: number
  operating_cost_per_month: number
  projected_maintenance_cost: number
  replacement_cost: number
  maintenance_cost_total: number
  maintenance_events: number
  monthly_margin: number
  downtime_risk_cost: number
  keep_estimated_value_12m: number
  replace_estimated_value_12m: number
  replacement_efficiency_gain: number
  recommendation: string
  rationale: string
  current_health_pct: number
  current_rul_cycles: number
}

export type SensorReading = {
  id: number
  machine_id: number
  timestamp: string
  cycle?: number | null
  temperature?: number | null
  vibration?: number | null
  pressure?: number | null
  load_pct?: number | null
  rpm?: number | null
}

export type MachineDetail = MachineSummary & {
  sensor_readings: SensorReading[]
  maintenance_logs: MaintenanceLog[]
  alerts: AlertItem[]
  predictions: Prediction[]
}

export type DashboardResponse = {
  summary: {
    total: number
    healthy: number
    warning: number
    critical: number
  }
  machines: MachineSummary[]
  alerts: AlertItem[]
  maintenance_logs: MaintenanceLog[]
  predictions: Prediction[]
}
