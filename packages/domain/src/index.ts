export {
  MIN_INTERVAL_SECONDS,
  createMonitor,
  detectOverdue,
  pauseMonitor,
  registerHeartbeat,
  resumeMonitor,
} from './monitoring/monitor.ts'

export type {
  CreateMonitorInput,
  Monitor,
  MonitorStatus,
} from './monitoring/monitor.ts'
