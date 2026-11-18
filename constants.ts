
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
  "20UA",
  "Libre"
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

// Datos base sincronizados con las pestañas 'Perros' y 'Entrenadores' de Google Sheets
// Sirven como carga inmediata y respaldo offline/local si la red bloquea script.google.com
export const MOCK_DOGS: Dog[] = [
  { id: '01COL25', name: 'Tuty', breed: 'Mestizo colombiano', age: 2, level: CertificationLevel.Novice, avatarUrl: '', handlerId: '' },
  { id: '02COL25', name: 'Amelie', breed: 'Mestizo colombiano', age: 2, level: CertificationLevel.Novice, avatarUrl: '', handlerId: '' },
  { id: '03COL25', name: 'Wally', breed: 'Mestizo colombiano', age: 2, level: CertificationLevel.Novice, avatarUrl: '', handlerId: '' },
  { id: '04COL25', name: 'Oslo', breed: 'Clumber Spaniel', age: 2, level: CertificationLevel.Novice, avatarUrl: '', handlerId: '' },
];

export const MOCK_TRAINERS: Trainer[] = [
  { id: '01COL25', name: 'Sara Beuth', role: 'Entrenadora', avatarUrl: '' },
  { id: '02COL25', name: 'Jairo Aristizábal', role: 'Entrenador', avatarUrl: '' },
];

export const MOCK_SESSIONS: SessionData[] = [];

// --- AVATAR HELPERS ---
// Returning empty string triggers the UI fallbacks (Icons for dogs, Initials for trainers)

export const getDogAvatar = (name: string): string => {
  return "";
};

export const getTrainerAvatar = (name: string): string => {
  return "";
};
