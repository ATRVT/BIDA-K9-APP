import React, { useState, useEffect, useMemo } from 'react';
import { X, Copy, Check, Target, Disc, ArrowRight, ArrowLeft, CheckCircle2, Shuffle } from 'lucide-react';
import { BlockLength, BlockOutcome, PlannedRound, RoundResult, WheelSize, generateBlockPlan, isRoundResultCorrect, isErrorResult } from '../planner';
import { SessionMode } from '../types';

interface BlockPlannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply?: (outcome: BlockOutcome, saveImmediately?: boolean) => void;
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

    // Avanzar automáticamente al siguiente ensayo sin mover el scroll
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
    ].filter(Boolean);

    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleApply = (saveImmediately: boolean = false) => {
    if (!onApply) return;

    const marked = plan.filter(r => roundResults[r.roundNumber]);
    if (marked.length === 0) {
      alert('Marca el resultado (VP, VN, FP o FN) de al menos una ronda.');
      return;
    }

    if (isSamples) {
      const missingId = marked.filter(r => !r.isBlank && !(sampleIds[r.roundNumber] || '').trim());
      if (missingId.length > 0) {
        alert(`Falta el Nº de muestra en las rondas: ${missingId.map(r => r.roundNumber).join(', ')}.`);
        return;
      }
      const unmarked = plan.length - marked.length;
      if (unmarked > 0 && !confirm(`Hay ${unmarked} ronda(s) sin resultado. Solo se procesarán las ${marked.length} rondas marcadas. ¿Continuar?`)) {
        return;
      }
    }

    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const blockId = `B${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;

    onApply(
      {
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
      },
      saveImmediately
    );
    onClose();
  };

  if (!isOpen) return null;

  // Geometría de la rueda: posición 1 abajo y numeración en sentido horario.
  const wheelPositions = Array.from({ length: wheelSize }, (_, i) => i + 1);
  const is12 = wheelSize === 12;
  const radius = is12 ? 96 : 92;
  const nodeR = is12 ? 15 : 18;
  const centerX = 120;
  const centerY = 120;
  const posXY = (pos: number) => {
    const angleRad = ((90 + (pos - 1) * (360 / wheelSize)) * Math.PI) / 180;
    return { x: centerX + radius * Math.cos(angleRad), y: centerY + radius * Math.sin(angleRad) };
  };

  const resultButtonClass = (opt: RoundResult, selected: boolean, isBlankRound: boolean) => {
    if (!selected) return 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100';
    return isRoundResultCorrect(opt, includeBlanks, isBlankRound)
      ? 'bg-bida-green text-bida-navy border-bida-green shadow-sm scale-[1.03]'
      : 'bg-bida-pink text-white border-bida-pink shadow-sm scale-[1.03]';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl max-h-[96vh] rounded-3xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">

        {/* HEADER ULTRA COMPACTO */}
        <div className="px-3.5 py-2.5 md:px-6 md:py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-bida-orange/10 rounded-xl flex items-center justify-center text-bida-orange border border-bida-orange/20 flex-shrink-0">
              <Disc className="w-4 h-4" />
            </div>
            <h2 className="text-sm md:text-xl font-black text-bida-navy truncate">
              Plan de Bloque ({totalRounds} UA)
            </h2>
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              type="button"
              onClick={() => regenerate(includeBlanks, wheelSize, totalRounds)}
              className="flex items-center space-x-1 px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-[11px] font-bold transition-colors"
              title="Regenerar posiciones"
            >
              <Shuffle className="w-3.5 h-3.5 text-bida-orange" />
              <span className="hidden sm:inline">Regenerar</span>
            </button>
            <button
              type="button"
              onClick={handleCopySequence}
              className="flex items-center space-x-1 px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-[11px] font-bold transition-colors"
              title="Copiar secuencia"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-bida-green" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-slate-500" />
              )}
              <span className="hidden sm:inline">{copied ? '¡Copiado!' : 'Copiar'}</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* BARRA DE CONTROLES EN UNA SOLA FILA */}
        <div className="px-3 py-2 md:px-6 md:py-2.5 bg-white border-b border-slate-100 flex items-center justify-between gap-1.5 overflow-x-auto">
          {/* 10 UA vs 20 UA */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl flex-shrink-0">
            {([10, 20] as BlockLength[]).map(count => (
              <button
                key={count}
                type="button"
                onClick={() => handleTotalRounds(count)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  totalRounds === count ? 'bg-bida-navy text-white shadow-2xs' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {count}UA
              </button>
            ))}
          </div>

          {/* Rueda 8 vs Rueda 12 */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl flex-shrink-0">
            {([8, 12] as WheelSize[]).map(size => (
              <button
                key={size}
                type="button"
                onClick={() => handleWheelSize(size)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  wheelSize === size ? 'bg-bida-orange text-white shadow-2xs' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                R{size}
              </button>
            ))}
          </div>

          {/* Sin vacíos vs Con vacíos */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl flex-shrink-0">
            <button
              type="button"
              onClick={() => handleToggleBlanks(false)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                !includeBlanks ? 'bg-white text-bida-navy shadow-2xs' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {totalRounds} Olor
            </button>
            <button
              type="button"
              onClick={() => handleToggleBlanks(true)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                includeBlanks ? 'bg-bida-navy text-white shadow-2xs' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {blankCount} Vacíos
            </button>
          </div>
        </div>

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto p-2.5 md:p-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 items-start">

            {/* PANEL PRINCIPAL: RUEDA + POSICIÓN + BOTONES VP/VN/FP/FN (SIN SCROLL EN MÓVIL) */}
            <div className="md:col-span-5 flex flex-col items-center bg-slate-50/70 p-3 md:p-5 rounded-2xl md:rounded-3xl border border-slate-100 md:sticky md:top-0">
              
              {/* Tira superior integrada: Navegación + Ronda + Posición objetivo */}
              <div className="w-full flex items-center justify-between bg-white px-2.5 py-1.5 rounded-xl border border-slate-200/80 shadow-2xs mb-2">
                <button
                  type="button"
                  onClick={() => setActiveRoundIndex(prev => Math.max(0, prev - 1))}
                  disabled={activeRoundIndex === 0}
                  className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-25"
                  title="Ronda anterior"
                >
                  <ArrowLeft size={16} />
                </button>

                <div className="flex items-center space-x-2 text-center">
                  <span className="font-numeric font-black text-xs px-2 py-0.5 rounded-md bg-bida-navy text-white">
                    {activeRound.roundNumber}/{totalRounds}
                  </span>
                  {activeRound.isBlank ? (
                    <span className="text-xs font-black text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-md border border-amber-200">
                      ⚪ EN VACÍO
                    </span>
                  ) : (
                    <span className="text-xs md:text-sm font-black text-bida-navy flex items-center">
                      <Target className="w-3.5 h-3.5 text-bida-orange mr-1" />
                      Contenedor <span className="font-numeric text-base text-bida-orange ml-1">#{activeRound.suggestedPosition}</span>
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setActiveRoundIndex(prev => Math.min(plan.length - 1, prev + 1))}
                  disabled={activeRoundIndex === plan.length - 1}
                  className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-25"
                  title="Siguiente ronda"
                >
                  <ArrowRight size={16} />
                </button>
              </div>

              {/* RUEDA SVG ESCALABLE */}
              <div className="relative select-none my-0.5">
                <svg viewBox="0 0 240 240" className="w-[182px] h-[182px] sm:w-[205px] sm:h-[205px] md:w-[225px] md:h-[225px] overflow-visible">
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
                    cx={centerX} cy={centerY} r={36}
                    fill={activeRound.isBlank ? '#fef3c7' : '#ffffff'}
                    stroke={activeRound.isBlank ? '#f59e0b' : '#cbd5e1'}
                    strokeWidth="2"
                  />
                  <text
                    x={centerX} y={centerY - 5}
                    textAnchor="middle"
                    className="font-black text-[11px] uppercase"
                    fill={activeRound.isBlank ? '#b45309' : '#024580'}
                  >
                    {activeRound.isBlank ? 'VACÍO' : `R${activeRound.roundNumber}`}
                  </text>
                  <text
                    x={centerX} y={centerY + 15}
                    textAnchor="middle"
                    className="font-numeric font-black text-base"
                    fill={activeRound.isBlank ? '#b45309' : '#f9953c'}
                  >
                    {activeRound.isBlank ? '0' : `#${activeRound.suggestedPosition}`}
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

              {/* CONTROLES DE REGISTRO DIRECTO (SIEMPRE VISIBLES BAJO LA RUEDA) */}
              <div className="w-full mt-2 bg-white p-2.5 rounded-2xl border border-slate-100 shadow-2xs space-y-2">
                {isSamples && !activeRound.isBlank && (
                  <input
                    type="text"
                    value={sampleIds[activeRound.roundNumber] || ''}
                    onChange={(e) => setSampleIds(prev => ({ ...prev, [activeRound.roundNumber]: e.target.value }))}
                    placeholder={`Nº muestra hospital (Ronda ${activeRound.roundNumber})`}
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-numeric text-center focus:outline-none focus:ring-2 focus:ring-bida-orange/40 focus:bg-white"
                  />
                )}

                {/* 4 Botones grandes de respuesta: VP / VN / FP / FN */}
                <div className="grid grid-cols-4 gap-1.5">
                  {RESULT_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setRoundResult(activeRound.roundNumber, opt.value)}
                      className={`py-2.5 rounded-xl font-black text-xs transition-all border ${resultButtonClass(opt.value, roundResults[activeRound.roundNumber] === opt.value, activeRound.isBlank)}`}
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

                {/* Resumen compacto en 1 línea: VP · VN · FP · FN · Completadas */}
                <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-[11px] font-numeric">
                  <div className="flex items-center space-x-2.5 font-bold">
                    <span className="text-green-600">VP:{stats.counts.VP}</span>
                    <span className={!includeBlanks ? 'text-bida-pink' : 'text-green-600'}>VN:{stats.counts.VN}</span>
                    <span className="text-bida-pink">FP:{stats.counts.FP}</span>
                    <span className="text-bida-pink">FN:{stats.counts.FN}</span>
                  </div>
                  <span className="font-bold text-bida-navy">
                    {stats.completed}/{totalRounds} rondas
                  </span>
                </div>
              </div>
            </div>

            {/* COLUMNA DERECHA / INFERIOR: LISTADO COMPLETO DE RONDAS */}
            <div className="md:col-span-7 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Detalle de Rondas (1 al {totalRounds})
                  </h3>
                </div>

                <div className="space-y-1.5 md:max-h-[430px] md:overflow-y-auto pr-1">
                  {plan.map((round, idx) => {
                    const isSelected = activeRoundIndex === idx;
                    const res = roundResults[round.roundNumber];

                    return (
                      <div
                        key={round.roundNumber}
                        onClick={() => setActiveRoundIndex(idx)}
                        className={`flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-2xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-orange-50/50 border-bida-orange/40 shadow-2xs ring-1 ring-bida-orange/20'
                            : 'bg-white border-slate-100 hover:border-slate-200'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5">
                          <span
                            className={`w-6 h-6 rounded-lg flex items-center justify-center font-numeric font-bold text-xs ${
                              isSelected ? 'bg-bida-navy text-white' : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {round.roundNumber}
                          </span>
                          {round.isBlank ? (
                            <span className="px-2 py-0.5 rounded-lg bg-amber-100/70 border border-amber-200 text-amber-800 text-xs font-black">
                              ⚪ EN VACÍO
                            </span>
                          ) : (
                            <div className="flex items-center space-x-1">
                              <span className="text-xs font-bold text-slate-700">{isSamples ? 'Pos' : 'Cont.'}</span>
                              <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-bida-orange font-numeric font-black text-xs border border-slate-200">
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
                              className={`w-24 px-2 py-1 rounded-lg border text-xs font-numeric focus:outline-none focus:ring-2 focus:ring-bida-orange/40 ${
                                res && !(sampleIds[round.roundNumber] || '').trim() ? 'border-bida-pink bg-pink-50' : 'border-slate-200 bg-white'
                              }`}
                            />
                          )}
                        </div>

                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          {RESULT_OPTIONS.map(opt => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setRoundResult(round.roundNumber, opt.value)}
                              className={`w-10 py-1 rounded-xl font-bold text-xs transition-all border ${resultButtonClass(opt.value, res === opt.value, round.isBlank)}`}
                              title={opt.label}
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
            </div>
          </div>
        </div>

        {/* FOOTER COMPACTO */}
        <div className="px-3 py-2.5 md:px-6 md:py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 font-bold text-xs hover:bg-slate-50 transition-colors"
          >
            Cerrar
          </button>
          {onApply && (
            <div className="flex items-center gap-2 flex-1 justify-end">
              <button
                type="button"
                onClick={() => handleApply(false)}
                className="px-3 py-2.5 rounded-xl bg-bida-navy text-white font-bold text-xs hover:bg-[#003366] transition-all flex items-center justify-center space-x-1"
              >
                <span>+ Cola ({stats.completed}/{totalRounds})</span>
              </button>
              <button
                type="button"
                onClick={() => handleApply(true)}
                className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-bida-green text-bida-navy font-black text-xs hover:bg-[#25d366] transition-all shadow-md shadow-green-100 flex items-center justify-center space-x-1.5"
              >
                <CheckCircle2 size={15} />
                <span>Guardar en Sheets ({stats.completed}/{totalRounds})</span>
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
