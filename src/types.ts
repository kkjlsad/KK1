export interface CommandResult {
  [key: string]: unknown;
  command: string;
  args: string[];
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

export interface BatteryStatus {
  source: "termux-api" | "sysfs";
  present?: boolean;
  technology?: string;
  health?: string;
  plugged?: string;
  status?: string;
  temperature_c?: number;
  voltage_mv?: number;
  current_ua?: number;
  current_average_ua?: number;
  percentage?: number;
  charge_counter_uah?: number;
  energy_nwh?: number;
  cycle_count?: number;
  estimated_power_w?: number;
  notes: string[];
}

export interface ToolPayload {
  [key: string]: unknown;
  ok: boolean;
  timestamp: string;
  data?: unknown;
  error?: string;
  hint?: string;
}
