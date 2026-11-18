import React, { useState, useEffect, useMemo } from 'react';
import { X, Copy, Check, Target, Disc, ArrowRight, ArrowLeft, CheckCircle2, Info, Shuffle } from 'lucide-react';
import { BlockLength, BlockOutcome, PlannedRound, RoundResult, WheelSize, generateBlockPlan, isRoundResultCorrect, isErrorResult } from '../planner';
import { SessionMode } from '../types';

interface BlockPlannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply?: (outcome: BlockOutcome) => void;
  mode?: SessionMode;
  initialIncludeBlanks?: boolean;
  initialTotalRounds?: BlockLength;
  dogName?: string;
  moduleName?: string;
}

const WHEEL_SIZE_KEY = 'bida.wheelSize';

const loadWheelSize = (): WheelSize => {
  try {
    return localStorage.getItem(WHEEL_SIZE_KEY) === '12' ? 12 : 8;
  } catch {
    return 8;
  }
};

const RESULT_OPTIONS: { value: RoundResult; label: string }[] = [
  { value: 'VP', label: 'Verdadero Positivo (correcto)' },
  { value: 'VN', label: 'Verdadero Negativo (correcto)' },
  { value: 'FP', label: 'Falso Positivo (error)' },
  { value: 'FN', label: 'Falso Negativo (error)' },
];

export const BlockPlannerModal: React.FC<BlockPlannerModalProps> = ({
  isOpen,
  onClose,
  onApply,
  mode = 'Training',
  initialIncludeBlanks = false,
  initialTotalRounds = 10,
  dogName,
  moduleName,
}) => {
  const isSamples = mode === 'Operational';
  const [wheelSize, setWheelSize] = useState<WheelSize>(loadWheelSize);
  const [totalRounds, setTotalRounds] = useState<BlockLength>(initialTotalRounds);
  const [includeBlanks, setIncludeBlanks] = useState<boolean>(initialIncludeBlanks);
  const [plan, setPlan] = useState<PlannedRound[]>(() =>
    generateBlockPlan(initialIncludeBlanks, loadWheelSize(), initialTotalRounds)
  );
  const [activeRoundIndex, setActiveRoundIndex] = useState<number>(0);
  const [roundResults, setRoundResults] = useState<Record<number, RoundResult | null>>({});
  const [sampleIds, setSampleIds] = useState<Record<number, string>>({});
  const [copied, setCopied] = useState<boolean>(false);

  // Al abrir: sincronizar con el tipo de registro (10UA o 20UA) y el módulo actual
  useEffect(() => {
    if (isOpen) {
      setIncludeBlanks(initialIncludeBlanks);
      setTotalRounds(initialTotalRounds);
      setPlan(generateBlockPlan(initialIncludeBlanks, wheelSize, initialTotalRounds));
      setActiveRoundIndex(0);
      setRoundResults({});
      setSampleIds({});
      setCopied(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialIncludeBlanks, initialTotalRounds]);

  const regenerate = (withBlanks: boolean, size: WheelSize, roundsCount: BlockLength) => {
    setPlan(generateBlockPlan(withBlanks, size, roundsCount));
    setActiveRoundIndex(0);
    setRoundResults({});
    setSampleIds({});
  };

  const handleToggleBlanks = (newValue: boolean) => {
    setIncludeBlanks(newValue);
    regenerate(newValue, wheelSize, totalRounds);
  };

  const handleWheelSize = (size: WheelSize) => {
    setWheelSize(size);
    try { localStorage.setItem(WHEEL_SIZE_KEY, String(size)); } catch { /* noop */ }
    regenerate(includeBlanks, size, totalRounds);
  };

  const handleTotalRounds = (roundsCount: BlockLength) => {
    setTotalRounds(roundsCount);
    regenerate(includeBlanks, wheelSize, roundsCount);
  };

  const setRoundResult = (roundNumber: number, result: RoundResult) => {
    const isDeselecting = roundResults[roundNumber] === result;
    setRoundResults(prev => ({
      ...prev,
      [roundNumber]: isDeselecting ? null : result,
    }));

    // Al registrar un resultado (VP, VN, FP o FN), avanzar automáticamente
    // a la siguiente ronda en la rueda SIN mover el scroll de la pantalla,
    // para que el guía mantenga siempre la vista fija en la rueda.
    if (!isDeselecting) {
      const currentIdx = roundNumber - 1;
      if (currentIdx + 1 < plan.length) {
        setActiveRoundIndex(currentIdx + 1);
      }
    }
  };

  // Métricas: si no hay rondas en vacío (10 o 20 con olor) o la ronda tiene olor,
  // marcar VN cuenta como fallo/error porque no puede haber verdadero negativo.
  const stats = useMemo(() => {
    const counts: Record<RoundResult, number> = { VP: 0, VN: 0, FP: 0, FN: 0 };
    let correct = 0;
    let errors = 0;

    plan.forEach(r => {
      const res = roundResults[r.roundNumber];
      if (!res) return;
      counts[res]++;
      if (isRoundResultCorrect(res, includeBlanks, r.isBlank)) {
        correct++;
      } else {
        errors++;
      }
    });

    const completed = correct + errors;
    const accuracy = completed > 0 ? Math.round((correct / completed) * 100) : 0;
    return { counts, correct, errors, completed, accuracy };
  }, [plan, roundResults, includeBlanks]);

  const activeRound = plan[activeRoundIndex] || plan[0];
  const blankCount = totalRounds === 20 ? 4 : 2;
  const odorCount = totalRounds - blankCount;

  const handleCopySequence = () => {
    const lines = [
      `PLAN DE BLOQUE (${totalRounds} UA) - BIDA`,
      `Rueda: ${wheelSize} contenedores · Ensayos: ${totalRounds}`,
      `Configuración: ${includeBlanks ? `Con ${blankCount} rondas en vacío` : `${totalRounds} rondas con muestra (${totalRounds / 2} bajas / ${totalRounds / 2} altas)`}`,
      moduleName ? `Módulo: ${moduleName}` : '',
      dogName ? `Perro: ${dogName}` : '',
      '------------------------------',
      ...plan.map(r => {
        const res = roundResults[r.roundNumber] ? ` [${roundResults[r.roundNumber]}]` : '';
        const sid = isSamples && !r.isBlank && sampleIds[r.roundNumber] ? ` · Muestra ${sampleIds[r.roundNumber]}` : '';
        return `Ronda ${r.roundNumber}: ${r.isBlank ? '⚪ EN VACÍO' : `Contenedor ${r.suggestedPosition}`}${sid}${res}`;
      }),
      '------------------------------',
      `VP: ${stats.counts.VP} · VN: ${stats.counts.VN} · FP: ${stats.counts.FP} · FN: ${stats.counts.FN}`,
      `Correctos: ${stats.correct} · Errores: ${stats.errors}`,
    ].filter(Boolean);

    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleApply = () => {
    if (!onApply) return;

    if (isSamples) {
      const marked = plan.filter(r => roundResults[r.roundNumber]);
      if (marked.length === 0) {
        alert('Marca el resultado (VP, VN, FP o FN) de al menos una ronda.');
        return;
      }
      const missingId = marked.filter(r => !r.isBlank && !(sampleIds[r.roundNumber] || '').trim());
      if (missingId.length > 0) {
        alert(`Falta el Nº de muestra en las rondas: ${missingId.map(r => r.roundNumber).join(', ')}.`);
        return;
      }
      const unmarked = plan.length - marked.length;
      if (unmarked > 0 && !confirm(`Hay ${unmarked} ronda(s) sin resultado. Solo se añadirán las ${marked.length} rondas marcadas. ¿Continuar?`)) {
        return;
      }
    }

    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const blockId = `B${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;

    onApply({
      blockId,
      wheelSize,
      totalRounds,
      includeBlanks,
      rounds: plan.map(r => ({
        ...r,
        result: roundResults[r.roundNumber] || null,
        sampleId: isSamples && !r.isBlank ? (sampleIds[r.roundNumber] || '').trim() : '',
      })),
      counts: { ...stats.counts },
      correct: stats.correct,
      errors: stats.errors,
    });
    onClose();
  };

  if (!isOpen) return null;

  // Geometría de la rueda: posición 1 abajo y numeración en sentido horario.
  const wheelPositions = Array.from({ length: wheelSize }, (_, i) => i + 1);
  const is12 = wheelSize === 12;
  const radius = is12 ? 100 : 95;
  const nodeR = is12 ? 15 : 18;
  const centerX = 120;
  const centerY = 120;
  const posXY = (pos: number) => {
    const angleRad = ((90 + (pos - 1) * (360 / wheelSize)) * Math.PI) / 180;
    return { x: centerX + radius * Math.cos(angleRad), y: centerY + radius * Math.sin(angleRad) };
  };

  const resultButtonClass = (opt: RoundResult, selected: boolean, isBlankRound: boolean) => {
    if (!selected) return 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100 hover:text-slate-600';
    return isRoundResultCorrect(opt, includeBlanks, isBlankRound)
      ? 'bg-bida-green text-bida-navy border-bida-green shadow-sm scale-105'
      : 'bg-bida-pink text-white border-bida-pink shadow-sm scale-105';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl max-h-[94vh] rounded-3xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">

        {/* HEADER */}
        <div className="p-4 md:px-8 md:py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-bida-orange/10 rounded-2xl flex items-center justify-center text-bida-orange border border-bida-orange/20">
              <Disc className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg md:text-2xl font-black text-bida-navy">Plan de Bloque ({totalRounds} UA)</h2>
                <span className="px-2 py-0.5 bg-bida-orange/10 text-bida-orange text-[10px] font-black rounded uppercase tracking-wider">
                  Rueda {wheelSize} Pos
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium hidden sm:block">
                Vista fija de rueda para entrenar y registrar · Desliza abajo si quieres revisar el listado
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50 flex items-center justify-center transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* CONTROLS BAR */}
        <div className="px-4 md:px-8 py-3 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {/* Cantidad de ensayos: 10 UA vs 20 UA */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl">
              {([10, 20] as BlockLength[]).map(count => (
                <button
                  key={count}
                  type="button"
                  onClick={() => handleTotalRounds(count)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    totalRounds === count ? 'bg-bida-navy text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {count} UA
                </button>
              ))}
            </div>

            {/* Tamaño de rueda: 8 vs 12 */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl">
              {([8, 12] as WheelSize[]).map(size => (
                <button
                  key={size}
                  type="button"
                  onClick={() => handleWheelSize(size)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    wheelSize === size ? 'bg-bida-orange text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Rueda {size}
                </button>
              ))}
            </div>

            {/* Modo: Sin vacíos vs Con vacíos */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => handleToggleBlanks(false)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  !includeBlanks ? 'bg-white text-bida-navy shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {totalRounds} con Olor
              </button>
              <button
                type="button"
                onClick={() => handleToggleBlanks(true)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  includeBlanks ? 'bg-bida-navy text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {blankCount} Vacíos + {odorCount} Olor
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => regenerate(includeBlanks, wheelSize, totalRounds)}
              className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
              title="Barajar nuevas posiciones"
            >
              <Shuffle className="w-3.5 h-3.5 text-bida-orange" />
              <span>Regenerar</span>
            </button>
            <button
              type="button"
              onClick={handleCopySequence}
              className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-bida-green" />
                  <span className="text-bida-green">¡Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>Copiar</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">

            {/* LEFT COLUMN: RUEDA INTERACTIVA (VISTA PRINCIPAL DE ENTRENAMIENTO) */}
            <div className="md:col-span-5 flex flex-col items-center bg-slate-50/70 p-5 rounded-3xl border border-slate-100 md:sticky md:top-0">
              <div className="w-full flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Ensayo Actual en Rueda
                </span>
                <span className="font-numeric font-bold text-sm bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-bida-navy">
                  {activeRound.roundNumber} / {totalRounds}
                </span>
              </div>

              <div className="relative my-1 select-none">
                <svg width="240" height="240" className="overflow-visible">
                  <circle cx={centerX} cy={centerY} r={radius} fill="none" stroke="#e2e8f0" strokeWidth="3" strokeDasharray="4 4" />

                  {wheelPositions.map(pos => {
                    const { x, y } = posXY(pos);
                    const isTarget = !activeRound.isBlank && activeRound.suggestedPosition === pos;
                    return (
                      <line
                        key={`spoke-${pos}`}
                        x1={centerX} y1={centerY} x2={x} y2={y}
                        stroke={isTarget ? '#f9953c' : '#f1f5f9'}
                        strokeWidth={isTarget ? 3 : 1.5}
                      />
                    );
                  })}

                  <circle
                    cx={centerX} cy={centerY} r={38}
                    fill={activeRound.isBlank ? '#fef3c7' : '#ffffff'}
                    stroke={activeRound.isBlank ? '#f59e0b' : '#cbd5e1'}
                    strokeWidth="2"
                  />
                  <text
                    x={centerX} y={centerY - 6}
                    textAnchor="middle"
                    className="font-black text-xs uppercase"
                    fill={activeRound.isBlank ? '#b45309' : '#024580'}
                  >
                    {activeRound.isBlank ? 'VACÍO' : 'RONDA'}
                  </text>
                  <text
                    x={centerX} y={centerY + 15}
                    textAnchor="middle"
                    className="font-numeric font-black text-lg"
                    fill={activeRound.isBlank ? '#b45309' : '#f9953c'}
                  >
                    R{activeRound.roundNumber}
                  </text>

                  {wheelPositions.map(pos => {
                    const { x, y } = posXY(pos);
                    const isTarget = !activeRound.isBlank && activeRound.suggestedPosition === pos;
                    return (
                      <g
                        key={`pos-${pos}`}
                        className="cursor-pointer"
                        onClick={() => {
                          const idx = plan.findIndex(r => !r.isBlank && r.suggestedPosition === pos);
                          if (idx !== -1) setActiveRoundIndex(idx);
                        }}
                      >
                        {isTarget && (
                          <circle cx={x} cy={y} r={nodeR + 8} fill="#f9953c" opacity="0.25" className="animate-ping" />
                        )}
                        <circle
                          cx={x} cy={y} r={nodeR}
                          fill={isTarget ? '#f9953c' : '#ffffff'}
                          stroke={isTarget ? '#ea580c' : '#cbd5e1'}
                          strokeWidth={isTarget ? 3 : 2}
                        />
                        <text
                          x={x} y={y + 5}
                          textAnchor="middle"
                          fill={isTarget ? '#ffffff' : '#475569'}
                          className={`font-numeric font-bold select-none ${is12 ? 'text-xs' : 'text-sm'}`}
                        >
                          {pos}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              <div className="w-full mt-3 p-4 rounded-2xl bg-white border border-slate-100 text-center shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Posición Indicada (Ronda {activeRound.roundNumber})
                </span>
                {activeRound.isBlank ? (
                  <div className="flex items-center justify-center space-x-1.5 text-amber-700 bg-amber-50 py-1.5 px-3 rounded-xl border border-amber-200">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
                    <span className="text-sm font-black">Ronda en Vacío (Sin Muestra)</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center space-x-2 text-bida-navy">
                    <Target className="w-5 h-5 text-bida-orange" />
                    <span className="text-base font-black">
                      Colocar en Contenedor <span className="font-numeric text-xl text-bida-orange">#{activeRound.suggestedPosition}</span>
                    </span>
                  </div>
                )}

                {/* Input de muestra directo bajo la rueda cuando estamos en modo Muestras */}
                {isSamples && !activeRound.isBlank && (
                  <div className="mt-3">
                    <input
                      type="text"
                      value={sampleIds[activeRound.roundNumber] || ''}
                      onChange={(e) => setSampleIds(prev => ({ ...prev, [activeRound.roundNumber]: e.target.value }))}
                      placeholder={`Nº muestra hospital (Ronda ${activeRound.roundNumber})`}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-numeric text-center focus:outline-none focus:ring-2 focus:ring-bida-orange/40 focus:bg-white"
                    />
                  </div>
                )}

                {/* Botones de respuesta directa sin mover el scroll */}
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                    Marcar resultado Ronda {activeRound.roundNumber} (pasa a la siguiente)
                  </span>
                  <div className="grid grid-cols-4 gap-2">
                    {RESULT_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setRoundResult(activeRound.roundNumber, opt.value)}
                        className={`py-2.5 rounded-xl font-bold text-xs transition-all border ${resultButtonClass(opt.value, roundResults[activeRound.roundNumber] === opt.value, activeRound.isBlank)}`}
                        title={
                          opt.value === 'VN' && (!includeBlanks || !activeRound.isBlank)
                            ? 'VN (Fallo: en ronda con olor no puede haber verdadero negativo)'
                            : opt.label
                        }
                      >
                        {opt.value}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Navegación manual y resumen rápido */}
                <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setActiveRoundIndex(prev => Math.max(0, prev - 1))}
                    disabled={activeRoundIndex === 0}
                    className="px-2.5 py-1.5 rounded-xl text-slate-600 hover:bg-slate-100 disabled:opacity-30 flex items-center space-x-1 text-xs font-bold"
                  >
                    <ArrowLeft size={14} />
                    <span>Ant.</span>
                  </button>
                  <div className="text-[11px] font-numeric font-bold text-slate-600">
                    <span>Completadas: {stats.completed} / {totalRounds}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveRoundIndex(prev => Math.min(plan.length - 1, prev + 1))}
                    disabled={activeRoundIndex === plan.length - 1}
                    className="px-2.5 py-1.5 rounded-xl text-slate-600 hover:bg-slate-100 disabled:opacity-30 flex items-center space-x-1 text-xs font-bold"
                  >
                    <span>Sig.</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: LISTADO COMPLETO DE RONDAS Y RESUMEN */}
            <div className="md:col-span-7 flex flex-col justify-between">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-1 mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Secuencia del Bloque (1 al {totalRounds})
                  </h3>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {includeBlanks ? (
                      <>
                        <span className="text-green-600 font-bold">VP (con olor) / VN (vacío) = correcto</span> · <span className="text-bida-pink font-bold">resto = fallo</span>
                      </>
                    ) : (
                      <>
                        <span className="text-green-600 font-bold">VP = correcto</span> · <span className="text-bida-pink font-bold">VN/FP/FN = fallo (sin vacíos)</span>
                      </>
                    )}
                  </span>
                </div>

                <div className="space-y-2 md:max-h-[430px] md:overflow-y-auto pr-1">
                  {plan.map((round, idx) => {
                    const isSelected = activeRoundIndex === idx;
                    const res = roundResults[round.roundNumber];

                    return (
                      <div
                        key={round.roundNumber}
                        onClick={() => setActiveRoundIndex(idx)}
                        className={`flex flex-wrap items-center justify-between gap-2 p-3 rounded-2xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-orange-50/50 border-bida-orange/40 shadow-sm ring-1 ring-bida-orange/20'
                            : 'bg-white border-slate-100 hover:border-slate-200'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <span
                            className={`w-7 h-7 rounded-xl flex items-center justify-center font-numeric font-bold text-xs ${
                              isSelected ? 'bg-bida-navy text-white' : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {round.roundNumber}
                          </span>
                          {round.isBlank ? (
                            <span className="px-2.5 py-1 rounded-lg bg-amber-100/70 border border-amber-200 text-amber-800 text-xs font-black tracking-wide">
                              ⚪ EN VACÍO
                            </span>
                          ) : (
                            <div className="flex items-center space-x-1.5">
                              <span className="text-xs font-bold text-slate-700">{isSamples ? 'Pos' : 'Contenedor'}</span>
                              <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 text-bida-orange font-numeric font-black text-sm border border-slate-200">
                                #{round.suggestedPosition}
                              </span>
                            </div>
                          )}
                          {isSamples && !round.isBlank && (
                            <input
                              type="text"
                              value={sampleIds[round.roundNumber] || ''}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => setSampleIds(prev => ({ ...prev, [round.roundNumber]: e.target.value }))}
                              placeholder="Nº muestra"
                              className={`w-28 px-2 py-1 rounded-lg border text-xs font-numeric focus:outline-none focus:ring-2 focus:ring-bida-orange/40 ${
                                res && !(sampleIds[round.roundNumber] || '').trim() ? 'border-bida-pink bg-pink-50' : 'border-slate-200 bg-white'
                              }`}
                            />
                          )}
                        </div>

                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {RESULT_OPTIONS.map(opt => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setRoundResult(round.roundNumber, opt.value)}
                              className={`w-11 py-1.5 rounded-xl font-bold text-xs transition-all border ${resultButtonClass(opt.value, res === opt.value, round.isBlank)}`}
                              title={
                                opt.value === 'VN' && (!includeBlanks || !round.isBlank)
                                  ? 'VN (Fallo: en ronda con olor no puede haber verdadero negativo)'
                                  : opt.label
                              }
                            >
                              {opt.value}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* MARCADOR DE RESPUESTAS (VP / VN / FP / FN) */}
              <div className="mt-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="grid grid-cols-4 gap-2 mb-2.5">
                  {(['VP', 'VN', 'FP', 'FN'] as RoundResult[]).map(r => {
                    const isErrorBox = isErrorResult(r) || (r === 'VN' && !includeBlanks);
                    return (
                      <div key={r} className="bg-white rounded-xl border border-slate-100 py-1.5 text-center">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          {r === 'VN' && !includeBlanks ? 'VN (Fallo)' : r}
                        </span>
                        <span className={`font-numeric font-bold text-base ${isErrorBox ? 'text-bida-pink' : 'text-green-600'}`}>
                          {stats.counts[r]}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                  <span className="font-bold uppercase tracking-wider text-[10px] text-slate-400">Rondas registradas</span>
                  <span className="font-numeric font-bold text-sm text-bida-navy">{stats.completed} / {totalRounds}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="p-4 md:px-8 bg-slate-50 border-t border-slate-100 flex flex-col lg:flex-row items-center justify-between gap-3">
          <div className="flex items-center text-xs text-slate-500 min-w-0">
            <Info size={14} className="mr-1.5 text-bida-orange flex-shrink-0" />
            <span>
              {includeBlanks
                ? `Modo Vacíos (${totalRounds} UA): ${odorCount} ensayos con muestra en rueda de ${wheelSize} y ${blankCount} rondas en vacío no consecutivas.`
                : `Modo Equilibrado (${totalRounds} UA): ${totalRounds / 2} contenedores bajos (1-${wheelSize / 2}) y ${totalRounds / 2} altos (${wheelSize / 2 + 1}-${wheelSize}) alternados.`}
            </span>
          </div>

          <div className="flex items-center space-x-3 w-full lg:w-auto flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 lg:flex-none px-5 py-3 rounded-xl border border-slate-200 bg-white text-slate-600 font-bold text-xs hover:bg-slate-50 transition-colors"
            >
              Cerrar
            </button>
            {onApply && (
              <button
                type="button"
                onClick={handleApply}
                className="flex-1 lg:flex-none px-5 py-3 rounded-xl bg-bida-green text-bida-navy font-bold text-xs hover:bg-[#25d366] transition-all shadow-md shadow-green-100 flex items-center justify-center space-x-1.5"
              >
                <CheckCircle2 size={16} />
                <span>
                  {isSamples
                    ? `Añadir ${stats.completed} muestra(s) a la cola`
                    : `Añadir Bloque a la Cola (${stats.completed}/${totalRounds})`}
                </span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
