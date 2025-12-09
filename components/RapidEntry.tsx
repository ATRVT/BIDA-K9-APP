
import React, { useState, useEffect } from 'react';
import { Save, Trash2, CheckCircle2, ListPlus, Calendar, User, Dog as DogIcon, ClipboardList, Info, Send, Beaker, Dumbbell, TestTube2, MapPin } from 'lucide-react';
import { Dog, Trainer, SessionData, RecordType, ReinforcerType, ReinforcementSchedule, SessionMode, SampleResult } from '../types';
import { MODULES, MODULE_OBJECTIVES_MAP, RECORD_TYPES, REINFORCERS, SCHEDULES } from '../constants';

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
  // --- GLOBAL STATE ---
  const [mode, setMode] = useState<SessionMode>('Training');

  // --- COMMON FIELDS ---
  const [selectedTrainer, setSelectedTrainer] = useState<string>('');
  const [selectedDog, setSelectedDog] = useState<string>('');
  
  // FIX: Usar hora local para inicializar el input de fecha y evitar problemas con UTC
  const [date, setDate] = useState<string>(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  const [reinforcer, setReinforcer] = useState<ReinforcerType>('Comestible');
  const [schedule, setSchedule] = useState<ReinforcementSchedule>('Fijo');
  const [notes, setNotes] = useState("");

  // --- TRAINING FIELDS ---
  const [recordType, setRecordType] = useState<RecordType>('10UA');
  const [selectedModule, setSelectedModule] = useState<string>(MODULES[0]);
  const [selectedOdor, setSelectedOdor] = useState<string>(MODULE_OBJECTIVES_MAP[MODULES[0]][0]);
  const [uaC, setUaC] = useState<number | ''>(0);
  const [uaI, setUaI] = useState<number | ''>(0);

  // --- OPERATIONAL (SAMPLES) FIELDS ---
  const [sampleId, setSampleId] = useState("");
  const [position, setPosition] = useState("");
  const [result, setResult] = useState<SampleResult>(null);

  // --- QUEUE & SUBMISSION ---
  const [queue, setQueue] = useState<QueuedSession[]>([]);
  const [singleSaveSuccess, setSingleSaveSuccess] = useState(false);

  // --- EFFECTS ---

  // Initialize selected items based on props
  useEffect(() => {
    if (currentUser && !selectedTrainer) {
        setSelectedTrainer(currentUser.id);
    } else if (trainers.length > 0 && !selectedTrainer) {
        setSelectedTrainer(trainers[0].id);
    }
    
    if (dogs.length > 0 && !selectedDog) {
        setSelectedDog(dogs[0].id);
    }
  }, [trainers, dogs, currentUser]);

  useEffect(() => {
    if (mode === 'Training') {
      const availableOdors = MODULE_OBJECTIVES_MAP[selectedModule] || [];
      if (availableOdors.length > 0) {
        setSelectedOdor(availableOdors[0]);
      }
    }
  }, [selectedModule, mode]);

  useEffect(() => {
    if (mode === 'Training') {
      const correct = uaC === '' ? 0 : uaC;
      if (recordType === '10UA') {
        setUaI(Math.max(0, 10 - correct));
      } else if (recordType === '20UA') {
        setUaI(Math.max(0, 20 - correct));
      }
    }
  }, [uaC, recordType, mode]);

  // --- HANDLERS ---

  const validateForm = (): boolean => {
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
    // IMPORTANT: Keep date as string YYYY-MM-DD locally to avoid timezone shifts
    const base = {
      date: date, 
      dogId: selectedDog,
      trainerId: selectedTrainer,
      mode,
      reinforcer,
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
    if (mode === 'Training') {
      setUaC(0);
    } else {
      setSampleId("");
      setPosition("");
      setResult(null);
    }
    setNotes("");
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full font-sans">
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8 relative overflow-hidden">
          
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
            <h2 className="text-2xl font-black text-bida-navy flex items-center">
              <ListPlus className="w-7 h-7 mr-3 text-bida-orange" />
              Nuevo Registro
            </h2>
            
            <div className="bg-slate-100 p-1 rounded-xl flex font-bold text-sm">
              <button onClick={() => setMode('Training')} className={`flex items-center px-4 py-2 rounded-lg transition-all ${mode === 'Training' ? 'bg-white text-bida-navy shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                <Dumbbell className="w-4 h-4 mr-2" /> Entrenamiento
              </button>
              <button onClick={() => setMode('Operational')} className={`flex items-center px-4 py-2 rounded-lg transition-all ${mode === 'Operational' ? 'bg-white text-bida-orange shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
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

              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 mb-8 animate-in zoom-in-95">
                <h3 className="text-sm font-bold text-bida-navy mb-4 flex items-center">
                  <ClipboardList className="w-5 h-5 mr-2 text-slate-400" /> Resultados (Training)
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                  <div>
                    <label className="block text-xs font-bold text-bida-green uppercase mb-2">UA C</label>
                    <input type="number" min="0" value={uaC} onChange={(e) => setUaC(e.target.value === '' ? '' : parseInt(e.target.value))} className="w-full p-3 bg-white border-2 border-transparent rounded-xl focus:border-bida-green focus:outline-none text-2xl font-bold text-bida-green shadow-sm text-center font-numeric" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-bida-pink uppercase mb-2">UA I</label>
                    <input type="number" min="0" value={uaI} readOnly={recordType !== 'OCP'} onChange={(e) => setUaI(e.target.value === '' ? '' : parseInt(e.target.value))} className={`w-full p-3 rounded-xl text-2xl font-bold text-center border-2 border-transparent font-numeric ${recordType !== 'OCP' ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white text-bida-pink shadow-sm'}`} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Reforzador</label>
                    <select value={reinforcer} onChange={(e) => setReinforcer(e.target.value as ReinforcerType)} className="w-full p-3.5 bg-white rounded-xl text-sm font-medium text-slate-700 shadow-sm">
                      {REINFORCERS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6 animate-in slide-in-from-right-4">
                 <div>
                    <label className="flex items-center text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                       <Beaker className="w-4 h-4 mr-1.5 text-bida-orange" /> ID Muestra
                    </label>
                    <input type="text" placeholder="Ej. U-2023-001" value={sampleId} onChange={(e) => setSampleId(e.target.value)} className="w-full p-3 bg-slate-50 border-0 rounded-xl focus:ring-2 focus:ring-bida-orange/50 focus:outline-none text-sm font-medium text-slate-700 font-numeric" />
                 </div>
                 <div>
                    <label className="flex items-center text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                       <MapPin className="w-4 h-4 mr-1.5 text-bida-orange" /> Posición
                    </label>
                    <input type="text" placeholder="Ej. Rueda 1 - Pos 3" value={position} onChange={(e) => setPosition(e.target.value)} className="w-full p-3 bg-slate-50 border-0 rounded-xl focus:ring-2 focus:ring-bida-orange/50 focus:outline-none text-sm font-medium text-slate-700" />
                 </div>
              </div>

              <div className="bg-orange-50/50 p-6 rounded-2xl border border-orange-100 mb-8 animate-in zoom-in-95">
                <h3 className="text-sm font-bold text-bida-navy mb-4 flex items-center">
                  <TestTube2 className="w-5 h-5 mr-2 text-bida-orange" /> Resultado de la Detección
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                   {['VP', 'FP', 'VN', 'FN'].map((res) => (
                     <button key={res} onClick={() => setResult(res as SampleResult)} className={`py-4 rounded-xl border-2 font-bold text-lg transition-all ${result === res ? 'bg-bida-navy border-bida-navy text-white shadow-lg scale-105' : 'bg-white border-slate-100 text-slate-400 hover:border-bida-navy/30'}`}>
                       {res}
                     </button>
                   ))}
                </div>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Reforzador</label>
                    <select value={reinforcer} onChange={(e) => setReinforcer(e.target.value as ReinforcerType)} className="w-full p-3.5 bg-white rounded-xl text-sm font-medium text-slate-700 shadow-sm">
                      {REINFORCERS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
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
             <button onClick={handleSingleSave} className="flex-1 py-4 bg-bida-green text-bida-navy rounded-2xl font-bold text-base hover:bg-[#25d366] hover:text-white active:scale-[0.99] transition-all flex items-center justify-center shadow-lg shadow-green-200">
              <Save className="mr-2" /> Guardar Sesión
            </button>
            <button onClick={addToQueue} className="flex-1 py-4 bg-bida-navy text-white rounded-2xl font-bold text-base hover:bg-[#003366] active:scale-[0.99] transition-all flex items-center justify-center shadow-lg shadow-slate-300">
              <ListPlus className="mr-2" /> Añadir a la Cola
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 flex flex-col h-[calc(100vh-140px)] lg:h-auto overflow-hidden sticky top-6">
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
                   <div className="flex gap-2 text-xs font-numeric mt-2">
                      <span className="bg-white px-2 py-1 rounded border">Mod: {item.module}</span>
                      <span className="text-bida-green font-bold">C: {item.uaC}</span>
                   </div>
                 ) : (
                   <div className="flex gap-2 text-xs font-numeric mt-2">
                      <span className="bg-white px-2 py-1 rounded border">ID: {item.sampleId}</span>
                      <span className="text-bida-navy font-bold">{item.result}</span>
                   </div>
                 )}
              </div>
            ))
          )}
        </div>
        <div className="p-6 border-t border-slate-50 bg-white">
           <button onClick={commitQueue} disabled={queue.length === 0} className="w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center uppercase tracking-wider bg-bida-orange text-white hover:bg-orange-500 shadow-lg disabled:opacity-50">
              <Send className="mr-2 w-4 h-4" /> Enviar a Google Sheets
            </button>
        </div>
      </div>
    </div>
  );
};
