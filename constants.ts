
import { Dog, Trainer, SessionData, CertificationLevel } from './types';

// API Configuration
export const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxdeitHLm4Q4VS0qP6OFXEv9dIWgYpI2HvOPDELh_wFiEnSqUd3w4PONhP3DNKfsiSZ/exec";

// Specific K9 Unit Modules
export const MODULES = [
  "Módulo Asociación",
  "Módulo Discriminación",
  "Módulo Transición",
  "Módulo Discriminación II",
  "Módulo Aleatorios",
  "Módulo Vacíos",
  "Módulo Asociación II"
];

// Mapping Modules to specific Objectives (Odors)
export const MODULE_OBJECTIVES_MAP: Record<string, string[]> = {
  "Módulo Asociación": ["OCP1", "OCP2", "OCP3", "OCP4"],
  "Módulo Discriminación": ["OCP1", "OCP2", "OCP3", "OCP4", "OCP5", "OCP6", "OCP7", "OCP8", "OCP9"],
  "Módulo Transición": ["OCP1", "OCP2", "OCP3"],
  "Módulo Discriminación II": ["OCP1"],
  "Módulo Aleatorios": ["OCP1"],
  "Módulo Vacíos": ["OCP1", "OCP2", "OCP3"],
  "Módulo Asociación II": ["OCP1"]
};

export const RECORD_TYPES = [
  "OCP",
  "10UA",
  "20UA"
];

export const REINFORCERS = [
  "Comestible",
  "Juguete",
  "Social"
];

export const SCHEDULES = [
  "Fijo",
  "Variable"
];

// Helper to get all unique odors for mock data generation
export const ALL_ODORS = Array.from(new Set(Object.values(MODULE_OBJECTIVES_MAP).flat()));

// MOCK DATA REMOVED - App relies on Google Sheets data
export const MOCK_DOGS: Dog[] = [];
export const MOCK_TRAINERS: Trainer[] = [];
export const MOCK_SESSIONS: SessionData[] = [];