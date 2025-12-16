// Enums as per PRD
export enum AlarmLevel {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

export enum TaskStatus {
  INIT = 'INIT',
  RUNNING = 'RUNNING',
  STOPPED = 'STOPPED',
  TRAINING = 'TRAINING',
  ERROR = 'ERROR',
}

export enum LabelStatus {
  UNLABELED = 'UNLABELED',
  POSITIVE = 'POSITIVE',
  NEGATIVE = 'NEGATIVE',
  IGNORED = 'IGNORED',
}

export enum EventStatus {
  PENDING = 'PENDING',
  PROCESSED = 'PROCESSED',
}

// Interfaces
export interface Coordinate {
  x: number;
  y: number;
}

export interface Camera {
  id: string;
  name: string;
  location: string;
  thumbnail: string;
  status: 'online' | 'offline';
}

export interface Algorithm {
  id: string;
  name: string;
  description: string;
  version: string;
  icon: string;
  type: 'PRESET' | 'GENAI';
}

export interface Task {
  id: string;
  name: string;
  camera_ids: string[];
  roi: Coordinate[]; // Normalized 0-1
  algorithm: Algorithm;
  nlp_text?: string; // For display in list
  duration: number; // Seconds
  alarm_level: AlarmLevel;
  status: TaskStatus;
  sample_count: {
    total: number;
    threshold: number;
  };
  created_at: string;
}

export interface EventLog {
  id: string;
  task_id: string;
  trigger_time: string;
  alarm_level: AlarmLevel;
  description: string;
  thumbnail: string;
  video_url: string; // Placeholder
  biz_status: EventStatus;
  roi: Coordinate[]; // Snapshot of ROI at event time
  target_rect?: { x: number; y: number; w: number; h: number }; // Normalized
}

export interface SampleImage {
  id: string;
  url: string;
  confidence: number;
  label: LabelStatus;
  timestamp: string;
}
