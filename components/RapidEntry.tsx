
import React, { useState, useEffect } from 'react';
import { Save, Trash2, CheckCircle2, ListPlus, Calendar, User, Dog as DogIcon, ClipboardList, Info, Send, Beaker, Dumbbell, TestTube2, MapPin, Disc, ArrowRight } from 'lucide-react';
import { Dog, Trainer, SessionData, RecordType, ReinforcementSchedule, SessionMode, SampleResult } from '../types';
import { MODULES, MODULE_OBJECTIVES_MAP, RECORD_TYPES, REINFORCERS, SCHEDULES } from '../constants';
import { BlockPlannerModal } from './BlockPlannerModal';
import { BlockOutcome, formatPosition, isRoundResultCorrect, isOperationalSessionSuccess } from '../planner';

interface RapidEntryProps {
  dogs: Dog[];
  trainers: Trainer[];
  currentUser: Trainer | null;
  onSaveSessions: (sessions: SessionData[]) => void;
}

interface QueuedSession extends Omit<SessionData, 'id'> {
  tempId: string;
}

export const RapidEntry: React.FC<RapidEntryProps> = ({ dogs, trainers, currentUser, onSaveSessions }) => {
  const [mode, setMode] = useState<SessionMode>('Training');

  const [selectedTrainer, setSelectedTrainer] = useState<string>('');
  const [selectedDog, setSelectedDog] = useState<string>('');

  const [date, setDate] = useState<string>(() => {
    // Usar la fecha local para evitar problemas de zona horaria con UTC
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  // Multi-select for reinforcers
  const [selectedReinforcers, setSelectedReinforcers] = useState<string[]>(['Comestible']);
  const [schedule, setSchedule] = useState<ReinforcementSchedule>('Fijo');
  const [notes, setNotes] = useState("");

  const [recordType, setRecordType] = useState<RecordType>('Libre');
  const [selectedModule, setSelectedModule] = useState<string>(MODULES[0]);
  const [selectedOdor, setSelectedOdor] = useState<string>(MODULE_OBJECTIVES_MAP[MODULES[0]][0]);
  const [uaC, setUaC] = useState<number | ''>(0);
  const [uaI, setUaI] = useState<number | ''>(0);

  const [sampleId, setSampleId] = useState("");
  const [position, setPosition] = useState("");
  const [result, setResult] = useState<SampleResult>(null);

  const [queue, setQueue] = useState<QueuedSession[]>([]);
  const [singleSaveSuccess, setSingleSaveSuccess] = useState(false);
  const [isPlannerOpen, setIsPlannerOpen] = useState(false);

  useEffect(() => {
    if (trainers.length > 0 && (!selectedTrainer || !trainers.some(t => t.id === selectedTrainer))) {
      setSelectedTrainer(currentUser?.id || trainers[0].id);
    }

    if (dogs.length > 0 && (!selectedDog || !dogs.some(d => d.id === selectedDog))) {
      setSelectedDog(dogs[0].id);
    }
  }, [trainers, dogs, currentUser, selectedTrainer, selectedDog]);

  useEffect(() => {
    if (mode === 'Training') {
      const availableOdors = MODULE_OBJECTIVES_MAP[selectedModule] || [];
      if (availableOdors.length > 0) {
        setSelectedOdor(availableOdors[0]);
      }
    }
  }, [selectedModule, mode]);

  // Efecto de cálculo automático para tipos fijos (10UA, 20UA)
  useEffect(() => {
    if (mode === 'Training') {
      if (recordType === '10UA' && uaC !== '') {
        setUaI(Math.max(0, 10 - Number(uaC)));
      } else if (recordType === '20UA' && uaC !== '') {
        setUaI(Math.max(0, 20 - Number(uaC)));
      }
    }
  }, [uaC, recordType, mode]);

  const toggleReinforcer = (r: string) => {
    setSelectedReinforcers(prev => {
      if (prev.includes(r)) {
        // Prevent deselecting all if desired, or allow empty. 
        // For now, allow empty but user should probably select one.
        return prev.filter(item => item !== r);
      } else {
        return [...prev, r];
      }
    });
  };

  const validateForm = (): boolean => {
    if (selectedReinforcers.length === 0) {
      alert("Por favor selecciona al menos un reforzador.");
      return false;
    }

    if (mode === 'Training') {
      if (uaC === '' || uaI === '') {
        alert("Por favor completa las Unidades de Aprendizaje (UA).");
        return false;
      }
    } else {
      if (!sampleId) {
        alert("Por favor indica el ID de la Muestra.");
        return false;
      }
      if (!result) {
        alert("Por favor selecciona un Resultado (VP, FP, VN, FN).");
        return false;
      }
    }
    return true;
  };

  const createSessionObject = (): Omit<SessionData, 'id'> => {
    const base = {
      date: date,
      dogId: selectedDog,
      trainerId: selectedTrainer,
      mode,
      reinforcer: selectedReinforcers.join(', '),
      schedule,
      notes
    };

    if (mode === 'Training') {
      return {
        ...base,
        recordType,
        module: selectedModule,
        targetOdor: selectedOdor,
        location: selectedModule,
        uaC: Number(uaC),
        uaI: Number(uaI),
        hits: Number(uaC),
        misses: Number(uaI),
        falsePositives: 0
      };
    } else {
      let hits = 0;
      let misses = 0;
      let fps = 0;

      if (result === 'VP' || result === 'VN') hits = 1;
      if (result === 'FN') misses = 1;
      if (result === 'FP') { misses = 1; fps = 1; }

      return {
        ...base,
        sampleId,
        position,
        result,
        uaC: hits,
        uaI: misses,
        hits,
        misses,
        falsePositives: fps
      };
    }
  };

  const resetFormPartial = () => {
    setSelectedReinforcers(['Comestible']); // Reset to default
    if (mode === 'Training') {
      setUaC(0);
      setUaI(0);
    } else {
      setSampleId("");
      setPosition("");
      setResult(null);
    }
    setNotes("");
  };

  const handleBlockOutcome = (outcome: BlockOutcome) => {
    const { VP, VN, FP, FN } = outcome.counts;
    const blanksLabel = outcome.includeBlanks ? 'con vacíos' : 'sin vacíos';

    if (mode === 'Training') {
      const plannedUaC = outcome.correct;
      const plannedUaI = outcome.errors;
      const totalMarked = plannedUaC + plannedUaI;
      if (totalMarked === 0) {
        alert('Marca el resultado (VP, VN, FP o FN) de al menos una ronda.');
        return;
      }
      if (selectedReinforcers.length === 0) {
        alert("Por favor selecciona al menos un reforzador antes de añadir el bloque.");
        return;
      }
      const effectiveRecordType: RecordType =
        totalMarked === 20 ? '20UA' : totalMarked === 10 ? '10UA' : recordType;
      const parts = outcome.rounds.map(r =>
        `R${r.roundNumber}(${r.isBlank ? 'Vacío' : `P${r.suggestedPosition}`}${r.result ? `:${r.result}` : ''})`
      );
      const summaryNotes =
        `Plan ${outcome.totalRounds}UA ${outcome.blockId} rueda ${outcome.wheelSize} (${blanksLabel}) ` +
        `[VP:${VP} VN:${VN} FP:${FP} FN:${FN}]: ${parts.join(', ')}`;
      const combinedNotes = notes ? `${summaryNotes}. ${notes}` : summaryNotes;

      const newItem: QueuedSession = {
        tempId: `${Date.now()}`,
        date,
        dogId: selectedDog,
        trainerId: selectedTrainer,
        mode: 'Training',
        reinforcer: selectedReinforcers.join(', '),
        schedule,
        notes: combinedNotes,
        recordType: effectiveRecordType,
        module: selectedModule,
        targetOdor: selectedOdor,
        location: selectedModule,
        uaC: plannedUaC,
        uaI: plannedUaI,
        hits: plannedUaC,
        misses: plannedUaI,
        falsePositives: FP,
      };
      setQueue(prev => [...prev, newItem]);
      setNotes("");
      return;
    }

    // MUESTRAS: una fila por ronda marcada (igual que el registro individual de hoy)
    if (selectedReinforcers.length === 0) {
      alert("Por favor selecciona al menos un reforzador antes de añadir el bloque.");
      return;
    }
    const baseTime = Date.now();
    const items: QueuedSession[] = outcome.rounds
      .filter(r => r.result)
      .map((r, i) => {
        const res = r.result as SampleResult;
        const isCorrect = isRoundResultCorrect(res, outcome.includeBlanks, r.isBlank);
        const hits = isCorrect ? 1 : 0;
        const misses = isCorrect ? 0 : 1;
        const fps = res === 'FP' ? 1 : 0;
        const roundNote = `Bloque ${outcome.blockId} · Ronda ${r.roundNumber}/${outcome.totalRounds} · rueda ${outcome.wheelSize} (${blanksLabel})`;
        return {
          tempId: `${baseTime}-${i}`,
          date,
          dogId: selectedDog,
          trainerId: selectedTrainer,
          mode: 'Operational' as SessionMode,
          reinforcer: selectedReinforcers.join(', '),
          schedule,
          notes: notes ? `${roundNote}. ${notes}` : roundNote,
          sampleId: r.sampleId,
          position: formatPosition(outcome.wheelSize, r),
          result: res,
          uaC: hits,
          uaI: misses,
          hits,
          misses,
          falsePositives: fps,
        };
      });
    setQueue(prev => [...prev, ...items]);
  };

  const addToQueue = () => {
    if (!validateForm()) return;
    const newItem: QueuedSession = {
      tempId: Date.now().toString(),
      ...createSessionObject()
    };
    setQueue([...queue, newItem]);
    resetFormPartial();
  };

  const handleSingleSave = () => {
    if (!validateForm()) return;
    const newSession: SessionData = {
      id: `s-${Date.now()}`,
      ...createSessionObject()
    };
    onSaveSessions([newSession]);
    setSingleSaveSuccess(true);
    setTimeout(() => setSingleSaveSuccess(false), 3000);
    resetFormPartial();
  };

  const removeQueueItem = (tempId: string) => {
    setQueue(queue.filter(q => q.tempId !== tempId));
  };

  const commitQueue = () => {
    const finalSessions: SessionData[] = queue.map(q => ({
      id: `s-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...q
    }));
    onSaveSessions(finalSessions);
    setQueue([]);
  };

  const getDogName = (id: string) => dogs.find(d => d.id === id)?.name || 'Unknown';

  const ReinforcerSelector = () => (
    <div className="flex flex-wrap gap-2">
      {REINFORCERS.map(r => (
        <button
          key={r}
          type="button"
          onClick={() => toggleReinforcer(r)}
          className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition-all flex-1 md:flex-none text-center ${selectedReinforcers.includes(r)
            ? 'bg-bida-navy text-white border-bida-navy shadow-md'
            : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
            }`}
        >
          {r}
        </button>
      ))}
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full font-sans pb-20 lg:pb-0">
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 md:p-8 relative overflow-hidden">

          {singleSaveSuccess && (
            <div className="absolute inset-0 bg-bida-green/10 z-10 flex items-center justify-center backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-white p-6 rounded-2xl shadow-xl text-center transform scale-110 border border-bida-green/20">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-10 h-10 text-bida-green" />
                </div>
                <h3 className="text-xl font-bold text-bida-navy">¡Guardado!</h3>
              </div>
            </div>
          )}

          <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl md:text-3xl font-black text-bida-navy flex items-center">
                <ListPlus className="w-6 h-6 md:w-7 md:h-7 mr-3 text-bida-orange" />
                Nuevo Registro
              </h2>
              <button
                type="button"
                onClick={() => setIsPlannerOpen(true)}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-bida-orange border border-orange-200/80 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
                title="Abrir generador de posiciones y rondas en vacío para la rueda"
              >
                <Disc className="w-3.5 h-3.5" />
                <span>Plan de Bloque ({mode === 'Training' && recordType === '20UA' ? '20 UA' : '10 UA'})</span>
              </button>
            </div>

            <div className="bg-slate-100 p-1 rounded-xl flex font-bold text-sm w-full md:w-auto">
              <button onClick={() => setMode('Training')} className={`flex-1 md:flex-none flex items-center justify-center px-4 py-2 rounded-lg transition-all ${mode === 'Training' ? 'bg-white text-bida-navy shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                <Dumbbell className="w-4 h-4 mr-2" /> <span className="hidden sm:inline">Entrenamiento</span><span className="sm:hidden">Entreno</span>
              </button>
              <button onClick={() => setMode('Operational')} className={`flex-1 md:flex-none flex items-center justify-center px-4 py-2 rounded-lg transition-all ${mode === 'Operational' ? 'bg-white text-bida-orange shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                <TestTube2 className="w-4 h-4 mr-2" /> Muestras
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
            <div>
              <label className="flex items-center text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                <User className="w-4 h-4 mr-1.5 text-bida-orange" /> Entrenador/a
              </label>
              <select
                value={selectedTrainer}
                onChange={(e) => setSelectedTrainer(e.target.value)}
                className="w-full p-3 bg-slate-50 border-0 rounded-xl focus:ring-2 focus:ring-bida-orange/50 focus:outline-none text-sm font-medium text-slate-700"
              >
                {trainers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="flex items-center text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                <DogIcon className="w-4 h-4 mr-1.5 text-bida-orange" /> Perro/a
              </label>
              <select
                value={selectedDog}
                onChange={(e) => setSelectedDog(e.target.value)}
                className="w-full p-3 bg-slate-50 border-0 rounded-xl focus:ring-2 focus:ring-bida-orange/50 focus:outline-none text-sm font-medium text-slate-700"
              >
                {dogs.map(dog => <option key={dog.id} value={dog.id}>{dog.name}</option>)}
              </select>
            </div>
            <div>
              <label className="flex items-center text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                <Calendar className="w-4 h-4 mr-1.5 text-bida-orange" /> Fecha Sesión
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full p-3 bg-slate-50 border-0 rounded-xl focus:ring-2 focus:ring-bida-orange/50 focus:outline-none text-sm font-medium text-slate-700 font-numeric"
              />
            </div>
          </div>

          <hr className="my-8 border-slate-100" />

          {mode === 'Training' ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6 animate-in slide-in-from-left-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Tipo Registro</label>
                  <div className="flex gap-2 h-[46px]">
                    {RECORD_TYPES.map(r => (
                      <button key={r} type="button" onClick={() => setRecordType(r as RecordType)} className={`flex-1 rounded-xl text-sm font-bold transition-all border ${recordType === r ? 'bg-bida-orange text-white border-bida-orange shadow-lg shadow-orange-200' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Módulo</label>
                  <select value={selectedModule} onChange={(e) => setSelectedModule(e.target.value)} className="w-full p-3 bg-slate-50 border-0 rounded-xl focus:ring-2 focus:ring-bida-orange/50 focus:outline-none text-sm font-medium text-slate-700">
                    {MODULES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Objetivo</label>
                  <select value={selectedOdor} onChange={(e) => setSelectedOdor(e.target.value)} className="w-full p-3 bg-slate-50 border-0 rounded-xl focus:ring-2 focus:ring-bida-orange/50 focus:outline-none text-sm font-medium text-slate-700">
                    {MODULE_OBJECTIVES_MAP[selectedModule]?.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </div>

              {/* Callout para abrir el Carrusel en Entrenamiento */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gradient-to-r from-orange-50/90 to-amber-50/60 border border-orange-200/80 rounded-2xl mb-6 shadow-sm gap-3 animate-in fade-in duration-200">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-2xl bg-bida-orange/15 flex items-center justify-center text-bida-orange flex-shrink-0">
                    <Disc className="w-5 h-5 text-bida-orange" />
                  </div>
                  <div className="text-sm font-black text-bida-navy flex flex-wrap items-center gap-2">
                    <span>Asistente de Bloque en Rueda ({recordType === '20UA' ? '20 UA' : '10 UA'})</span>
                    <span className="text-[10px] font-bold text-bida-orange bg-white px-2 py-0.5 rounded border border-orange-200">
                      {selectedModule === 'Módulo Vacíos'
                        ? (recordType === '20UA' ? '4 Rondas en Vacío' : '2 Rondas en Vacío')
                        : (recordType === '20UA' ? '20 Rondas Equilibradas' : '10 Rondas Equilibradas')}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPlannerOpen(true)}
                  className="self-end sm:self-center px-4 py-2.5 bg-bida-orange text-white rounded-xl text-xs font-bold hover:bg-orange-500 active:scale-95 transition-all shadow-sm whitespace-nowrap flex items-center space-x-1.5"
                >
                  <span>Abrir Plan Rueda</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 mb-8 animate-in zoom-in-95">
                <h3 className="text-sm font-bold text-bida-navy mb-4 flex items-center">
                  <ClipboardList className="w-5 h-5 mr-2 text-slate-400" /> Configuración de la Sesión
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Reforzadores</label>
                    <ReinforcerSelector />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Programa</label>
                    <select value={schedule} onChange={(e) => setSchedule(e.target.value as ReinforcementSchedule)} className="w-full p-3.5 bg-white rounded-xl text-sm font-medium text-slate-700 shadow-sm">
                      {SCHEDULES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gradient-to-r from-orange-50/90 to-amber-50/60 border border-orange-200/80 rounded-2xl mb-6 shadow-sm gap-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-2xl bg-bida-orange/15 flex items-center justify-center text-bida-orange flex-shrink-0">
                    <Disc className="w-5 h-5 text-bida-orange" />
                  </div>
                  <div className="text-sm font-black text-bida-navy">Registro de Muestras en Carrusel</div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPlannerOpen(true)}
                  className="self-end sm:self-center px-4 py-2.5 bg-bida-orange text-white rounded-xl text-xs font-bold hover:bg-orange-500 active:scale-95 transition-all shadow-sm whitespace-nowrap flex items-center space-x-1.5"
                >
                  <span>Abrir Plan Rueda</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              <div className="bg-orange-50/50 p-6 rounded-2xl border border-orange-100 mb-8 animate-in zoom-in-95">
                <h3 className="text-sm font-bold text-bida-navy mb-4 flex items-center">
                  <TestTube2 className="w-5 h-5 mr-2 text-bida-orange" /> Configuración del Bloque de Muestras
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Reforzadores</label>
                    <ReinforcerSelector />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Programa</label>
                    <select value={schedule} onChange={(e) => setSchedule(e.target.value as ReinforcementSchedule)} className="w-full p-3.5 bg-white rounded-xl text-sm font-medium text-slate-700 shadow-sm">
                      {SCHEDULES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="mb-8">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Comentarios (Opcional)</label>
            <textarea placeholder="Detalles relevantes..." className="w-full p-4 bg-slate-50 border-0 rounded-xl h-24 resize-none focus:ring-2 focus:ring-bida-orange/50 focus:outline-none text-sm text-slate-700" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="flex flex-col md:flex-row gap-4">
            <button
              type="button"
              onClick={() => setIsPlannerOpen(true)}
              className="flex-1 py-4 bg-bida-navy text-white rounded-2xl font-bold text-base hover:bg-[#003366] active:scale-[0.99] transition-all flex items-center justify-center shadow-lg shadow-slate-300"
            >
              <Disc className="mr-2 w-5 h-5 text-bida-orange" />
              <span>{mode === 'Training' ? `Abrir Carrusel (${recordType === '20UA' ? '20 UA' : '10 UA'})` : 'Abrir Carrusel de Muestras'}</span>
            </button>
            {queue.length > 0 && (
              <button
                type="button"
                onClick={commitQueue}
                className="flex-1 py-4 bg-bida-green text-bida-navy rounded-2xl font-bold text-base hover:bg-[#25d366] hover:text-white active:scale-[0.99] transition-all flex items-center justify-center shadow-lg shadow-green-200"
              >
                <Send className="mr-2 w-5 h-5" /> Enviar {queue.length} Registro(s) a Sheets
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 flex flex-col h-[400px] lg:h-auto overflow-hidden lg:sticky lg:top-6">
        <div className="p-6 border-b border-slate-50 bg-slate-50/50">
          <h3 className="font-black text-bida-navy text-lg">Cola de Registro</h3>
          <p className="text-xs text-slate-500 font-bold uppercase mt-1">Pendientes: <span className="text-bida-orange font-numeric">{queue.length}</span></p>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white">
          {queue.length === 0 ? (
            <div className="text-center text-slate-300 py-10">
              <ListPlus className="w-10 h-10 mx-auto mb-4 text-slate-200" />
              <p className="font-bold">Cola vacía</p>
            </div>
          ) : (
            queue.map((item, index) => (
              <div key={item.tempId} className="bg-slate-50 border border-slate-100 p-4 rounded-2xl relative group">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide border ${item.mode === 'Operational' ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-blue-100 text-blue-700 border-blue-200'}`}>
                      {item.mode === 'Operational' ? 'Muestra' : 'Entreno'}
                    </span>
                    <div className="font-bold text-bida-navy text-sm mt-1">{getDogName(item.dogId)}</div>
                    <div className="text-[10px] text-slate-400 font-numeric flex items-center mt-1">
                      <Calendar className="w-3 h-3 mr-1" />
                      {item.date}
                    </div>
                  </div>
                  <button onClick={() => removeQueueItem(item.tempId)} className="text-slate-300 hover:text-bida-pink"><Trash2 size={16} /></button>
                </div>
                {item.mode === 'Training' ? (
                  <div className="flex flex-wrap gap-2 text-xs font-numeric mt-2">
                    <span className="bg-white px-2 py-1 rounded border">{item.recordType}</span>
                    <span className="bg-white px-2 py-1 rounded border">{item.module}</span>
                    <span className="bg-white px-2 py-1 rounded border text-bida-navy font-bold">{item.targetOdor}</span>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 text-xs font-numeric mt-2">
                    <span className="bg-white px-2 py-1 rounded border">ID: {item.sampleId || '—'}</span>
                    {item.position && <span className="bg-white px-2 py-1 rounded border">{item.position}</span>}
                    <span className={`font-bold ${!isOperationalSessionSuccess(item) ? 'text-bida-pink' : 'text-green-600'}`}>{item.result}</span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
        <div className="hidden md:block p-6 border-t border-slate-50 bg-white">
          <button onClick={commitQueue} disabled={queue.length === 0} className="w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center uppercase tracking-wider bg-bida-orange text-white hover:bg-orange-500 shadow-lg disabled:opacity-50">
            <Send className="mr-2 w-4 h-4" /> Enviar a Google Sheets
          </button>
        </div>
      </div>

      {/* MOBILE FLOATING ACTION BUTTON */}
      {queue.length > 0 && (
        <div className="md:hidden fixed bottom-[85px] left-4 right-4 z-40 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <button
            onClick={commitQueue}
            className="w-full py-4 rounded-2xl font-bold text-base flex items-center justify-between px-6 bg-bida-orange text-white shadow-2xl shadow-orange-900/20"
          >
            <div className="flex items-center">
              <div className="bg-white/20 px-2.5 py-1 rounded-lg mr-3 backdrop-blur-sm">
                <span className="font-numeric">{queue.length}</span>
              </div>
              <span className="uppercase tracking-wide text-sm">Enviar Pendientes</span>
            </div>
            <Send className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* MODAL PLANIFICADOR DE BLOQUE (10 UA / 20 UA / RUEDA) */}
      <BlockPlannerModal
        isOpen={isPlannerOpen}
        onClose={() => setIsPlannerOpen(false)}
        onApply={handleBlockOutcome}
        mode={mode}
        initialIncludeBlanks={selectedModule === 'Módulo Vacíos'}
        initialTotalRounds={mode === 'Training' && recordType === '20UA' ? 20 : 10}
        dogName={dogs.find(d => d.id === selectedDog)?.name}
        moduleName={selectedModule}
      />

    </div>
  );
};
