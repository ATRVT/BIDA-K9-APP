
export enum CertificationLevel {
  Novice = "Novice",
  Certified = "Certified",
  Master = "Master",
  Retired = "Retired"
}

export interface Dog {
  id: string;
  name: string;
  breed: string;
  age: number;
  level: CertificationLevel;
  avatarUrl: string;
  handlerId: string;
}

export interface Trainer {
  id: string;
  name: string;
  role: string;
  avatarUrl: string;
}

export type SessionMode = 'Training' | 'Operational'; // Entrenamiento vs Muestras
export type RecordType = 'OCP' | '10UA' | '20UA';
export type ReinforcerType = 'Comestible' | 'Juguete' | 'Social';
export type ReinforcementSchedule = 'Fijo' | 'Variable';
export type SampleResult = 'VP' | 'FP' | 'VN' | 'FN' | null; // Verdadero Positivo, Falso Positivo, etc.

export interface SessionData {
  id: string;
  date: string; // ISO string
  dogId: string;
  trainerId: string;
  
  // --- Mode Switching ---
  mode: SessionMode;

  // --- Common Fields ---
  reinforcer: ReinforcerType;
  schedule: ReinforcementSchedule;
  notes?: string;

  // --- Training Specific Fields (Optional in Operational Mode) ---
  location?: string; 
  recordType?: RecordType;
  module?: string;
  targetOdor?: string;
  uaC: number; 
  uaI: number; 
  
  // --- Operational/Sample Specific Fields (Optional in Training Mode) ---
  sampleId?: string; // Número/ID de la muestra
  position?: string; // Posición en la rueda/line-up
  result?: SampleResult;

  // --- Legacy/Dashboard Compatibility ---
  hits: number;
  misses: number;
  falsePositives: number;
}

// Derived stats for visualization
export interface DailyStats {
  date: string;
  accuracy: number;
}

export interface AggregateStats {
  totalSessions: number;
  globalAccuracy: number;
  totalHits: number;
  totalMisses: number;
  totalFPs: number;
  activeDogs: number;
}
