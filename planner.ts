export interface PlannedRound {
  roundNumber: number;        // 1 al 10 (o 1 al 20 en bloques de 20UA)
  isBlank: boolean;           // true si es ronda en vacío
  suggestedPosition: number;  // 1 al N (o 0 si es en blanco)
}

export type WheelSize = 8 | 12;
export type BlockLength = 10 | 20;

// Resultados posibles de cada ronda.
// En rondas con olor (y en bloques de 10 o 20 con olor sin vacíos), NO puede haber VN:
// marcar VN en una ronda con olor se contabiliza como fallo/error.
export type RoundResult = 'VP' | 'VN' | 'FP' | 'FN';
export const CORRECT_RESULTS: RoundResult[] = ['VP', 'VN'];
export const ERROR_RESULTS: RoundResult[] = ['FP', 'FN'];
export const isCorrectResult = (r: RoundResult | null | undefined) => r === 'VP' || r === 'VN';
export const isErrorResult = (r: RoundResult | null | undefined) => r === 'FP' || r === 'FN';

/**
 * Determina si el resultado registrado en una ronda es acierto.
 * - Si no estamos registrando rondas en vacío (!includeBlanks) o la ronda tiene olor (!isBlankRound),
 *   no puede existir Verdadero Negativo (VN), por lo que solo VP es acierto y VN cuenta como fallo.
 * - Si la ronda es en vacío (includeBlanks && isBlankRound), el acierto es VN.
 */
export const isRoundResultCorrect = (
  r: RoundResult | null | undefined,
  includeBlanks: boolean,
  isBlankRound: boolean = false
): boolean => {
  if (!r) return false;
  if (!includeBlanks || !isBlankRound) {
    return r === 'VP';
  }
  return r === 'VN';
};

/**
 * Evalúa si un registro de Muestras (Operational) es acierto o fallo para estadísticas/Dashboard.
 * Si el resultado es VN pero la ronda tenía olor (bloque "sin vacíos" o posición "Pos X" no vacía),
 * se cuenta como fallo.
 */
export const isOperationalSessionSuccess = (s: {
  result?: string | null;
  notes?: string;
  position?: string;
}): boolean => {
  if (s.result === 'VP') return true;
  if (s.result === 'VN') {
    const notesLower = (s.notes || '').toLowerCase();
    const posLower = (s.position || '').toLowerCase();
    if (notesLower.includes('sin vacíos')) return false;
    if (posLower.includes('pos ') && !posLower.includes('vacío')) return false;
    return true;
  }
  return false;
};

export const isOperationalSessionFailure = (s: {
  result?: string | null;
  notes?: string;
  position?: string;
}): boolean => {
  if (!s.result) return false;
  return !isOperationalSessionSuccess(s);
};

/** Ronda ya ejecutada, tal y como se vuelca a la sesión. */
export interface ExecutedRound extends PlannedRound {
  result: RoundResult | null;
  sampleId: string; // solo en Muestras; '' en vacíos o entrenamiento
}

/** Resultado completo de un bloque, enviado por el planificador al formulario. */
export interface BlockOutcome {
  blockId: string;
  wheelSize: WheelSize;
  totalRounds: BlockLength;
  includeBlanks: boolean;
  rounds: ExecutedRound[];
  counts: Record<RoundResult, number>;
  correct: number; // VP + VN
  errors: number;  // FP + FN
}

/** Texto de la columna "position" de la hoja, p. ej. "Rueda 8 - Pos 3" o "Rueda 12 - Vacío". */
export const formatPosition = (wheelSize: WheelSize, round: PlannedRound) =>
  round.isBlank ? `Rueda ${wheelSize} - Vacío` : `Rueda ${wheelSize} - Pos ${round.suggestedPosition}`;

const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

/**
 * Genera un sub-bloque de 10 rondas (numeradas desde offset + 1 hasta offset + 10).
 */
function generateSingleTenBlock(includeBlanks: boolean, wheelSize: WheelSize, offset: number = 0): PlannedRound[] {
  const rounds: PlannedRound[] = [];
  const half = wheelSize / 2;
  const lowAll = range(1, half);
  const highAll = range(half + 1, wheelSize);

  if (includeBlanks) {
    // 2 rondas en blanco no consecutivas (entre las posiciones 2 y 9 del sub-bloque)
    const validPairs = [
      [2, 6], [2, 7], [2, 8], [3, 7], [3, 8], [3, 9],
      [4, 8], [4, 9], [5, 9], [3, 6], [4, 7]
    ];
    const chosenPair = validPairs[Math.floor(Math.random() * validPairs.length)];
    const blankIndices = new Set([chosenPair[0], chosenPair[1]]);

    // 8 contenedores distintos, equilibrados entre mitad baja y alta
    const positions = shuffle([
      ...shuffle(lowAll).slice(0, 4),
      ...shuffle(highAll).slice(0, 4),
    ]);

    let posIdx = 0;
    for (let r = 1; r <= 10; r++) {
      if (blankIndices.has(r)) {
        rounds.push({ roundNumber: offset + r, isBlank: true, suggestedPosition: 0 });
      } else {
        rounds.push({ roundNumber: offset + r, isBlank: false, suggestedPosition: positions[posIdx++] });
      }
    }
  } else {
    // 5 bajas y 5 altas alternadas
    const pickFive = (pool: number[]) =>
      pool.length >= 5
        ? shuffle(pool).slice(0, 5)
        : shuffle([...pool, pool[Math.floor(Math.random() * pool.length)]]);

    const low = pickFive(lowAll);
    const high = pickFive(highAll);
    const lowFirst = Math.random() < 0.5;

    const sequence: number[] = [];
    for (let i = 0; i < 5; i++) {
      if (lowFirst) sequence.push(low[i], high[i]);
      else sequence.push(high[i], low[i]);
    }

    for (let r = 1; r <= 10; r++) {
      rounds.push({ roundNumber: offset + r, isBlank: false, suggestedPosition: sequence[r - 1] });
    }
  }

  return rounds;
}

/**
 * Genera la secuencia de 10 o 20 rondas para una rueda de 8 o 12 contenedores.
 * - 10 rondas: 2 en vacío + 8 con muestra (o 10 equilibradas 5 bajas / 5 altas).
 * - 20 rondas: 4 en vacío + 16 con muestra (o 20 equilibradas 10 bajas / 10 altas),
 *   evitando repetir la misma posición entre la ronda 10 y la 11.
 */
export function generateBlockPlan(
  includeBlanks: boolean,
  wheelSize: WheelSize = 8,
  totalRounds: BlockLength = 10
): PlannedRound[] {
  const firstTen = generateSingleTenBlock(includeBlanks, wheelSize, 0);
  if (totalRounds === 10) {
    return firstTen;
  }

  let secondTen = generateSingleTenBlock(includeBlanks, wheelSize, 10);
  // Evitar que la ronda 10 y la ronda 11 tengan el mismo contenedor consecutivo
  let attempts = 0;
  while (
    !firstTen[9].isBlank &&
    !secondTen[0].isBlank &&
    firstTen[9].suggestedPosition === secondTen[0].suggestedPosition &&
    attempts < 10
  ) {
    secondTen = generateSingleTenBlock(includeBlanks, wheelSize, 10);
    attempts++;
  }

  return [...firstTen, ...secondTen];
}
