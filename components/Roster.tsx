
import React, { useState, useMemo } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { Dog, SessionData, CertificationLevel, Trainer, SessionMode } from '../types';
import { MODULES, getDogAvatar } from '../constants';
import { Activity, Bone, ChevronRight, ChevronLeft, Target, Layers, ChevronDown, ChevronUp, X, Plus, Dog as DogIcon, Dumbbell, TestTube2, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface RosterProps {
  dogs: Dog[];
  sessions: SessionData[];
  trainers: Trainer[];
  onAddDog: (dog: Dog) => void;
}

// --- HELPER COMPONENTS (Defined before use) ---

const LevelBadge = ({ level }: { level: CertificationLevel }) => {
  const colors: Record<string, string> = {
    [CertificationLevel.Master]: 'bg-purple-100 text-purple-700 border-purple-200',
    [CertificationLevel.Certified]: 'bg-green-100 text-green-700 border-green-200', 
    [CertificationLevel.Novice]: 'bg-blue-100 text-blue-700 border-blue-200', 
    [CertificationLevel.Retired]: 'bg-slate-100 text-slate-700 border-slate-200',
  };
  // Fallback for custom levels
  const style = colors[level] || 'bg-slate-100 text-slate-600 border-slate-200';
  
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wide ${style}`}>
      {level}
    </span>
  );
};

const UACChart = ({ data, color }: { data: SessionData[], color: string }) => {
  if (!data || data.length === 0) return null;

  const chartData = data.map((s, i) => {
    return {
      name: `S${i + 1}`,
      uac: s.uaC,
      uai: s.uaI,
      date: new Date(s.date).toLocaleDateString()
    };
  });

  return (
    <ResponsiveContainer width="100%" height="100%" minHeight={200}>
      <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
        <XAxis dataKey="name" tick={{fontSize: 10, fill: '#94a3b8', fontFamily: 'Ubuntu'}} axisLine={false} tickLine={false} />
        <YAxis tick={{fontSize: 10, fill: '#94a3b8', fontFamily: 'Ubuntu'}} axisLine={false} tickLine={false} />
        <Tooltip 
          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontFamily: 'Ubuntu' }}
          labelStyle={{ color: '#64748b', fontSize: '12px' }}
        />
        <Line 
          type="monotone" 
          dataKey="uac" 
          stroke={color} 
          strokeWidth={3} 
          dot={{ r: 4, fill: color, strokeWidth: 2, stroke: '#fff' }} 
          activeDot={{ r: 6 }}
          name="Aciertos"
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

interface HistoryItemProps {
  group: {
    module: string;
    objective: string;
    sessions: SessionData[];
  };
}

const HistoryItem: React.FC<HistoryItemProps> = ({ group }) => {
  const [isOpen, setIsOpen] = useState(false);

  // Stats resumen
  const totalUAC = group.sessions.reduce((acc, s) => acc + s.uaC, 0);
  const totalOps = group.sessions.reduce((acc, s) => acc + s.uaC + s.uaI, 0);
  const accuracy = totalOps > 0 ? (totalUAC / totalOps) * 100 : 0;

  return (
    <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="p-4 flex items-center justify-between cursor-pointer bg-slate-50/50 hover:bg-white transition-colors"
      >
        <div className="flex items-center space-x-4">
          <div className={`p-2 rounded-lg transition-colors ${isOpen ? 'bg-bida-orange/10 text-bida-orange' : 'bg-slate-100 text-slate-400'}`}>
            {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-bida-navy truncate">{group.module}</div>
            <div className="text-xs text-slate-500 font-medium truncate">Obj: <span className="font-bold text-slate-700">{group.objective}</span></div>
          </div>
        </div>

        <div className="flex items-center space-x-6">
           <div className="hidden sm:block text-right">
              <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Aciertos</div>
              <div className="font-mono font-bold text-slate-700 font-numeric">{totalUAC}</div>
           </div>
           <div className="text-right min-w-[60px]">
              <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">%</div>
              <div className={`font-mono font-bold font-numeric ${accuracy >= 80 ? 'text-bida-green' : 'text-bida-orange'}`}>
                {accuracy.toFixed(1)}%
              </div>
           </div>
        </div>
      </div>

      {isOpen && (
        <div className="p-4 border-t border-slate-100 bg-white animate-in slide-in-from-top-2">
           <div className="h-64 w-full min-h-[200px]">
             <UACChart data={group.sessions} color="#024580" />
           </div>
        </div>
      )}
    </div>
  );
};

interface DogDetailProps {
  dog: Dog;
  sessions: SessionData[];
  onBack: () => void;
  viewMode: SessionMode;
}

const DogDetailView: React.FC<DogDetailProps> = ({ dog, sessions, onBack, viewMode }) => {
  
  const uniqueModulesCount = useMemo(() => {
    const mods = new Set<string>();
    sessions.forEach(s => {
       if (s.module) mods.add(s.module);
    });
    return mods.size;
  }, [sessions]);

  const totalModules = MODULES.length;
  const progressPercent = Math.min(100, Math.round((uniqueModulesCount / totalModules) * 100));
  
  let progressBarColor = "bg-bida-sky";
  if (progressPercent <= 30) progressBarColor = "bg-bida-orange";
  else if (progressPercent === 100) progressBarColor = "bg-bida-green";

  const history = useMemo(() => {
    const sortedSessions = [...sessions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    const groups = new Map<string, {
      module: string;
      objective: string;
      sessions: SessionData[];
      firstDate: Date;
    }>();

    sortedSessions.forEach(s => {
      const mod = s.module || 'Muestras';
      const obj = s.targetOdor || s.sampleId || 'General';
      
      const key = `${mod}-${obj}`;
      if (!groups.has(key)) {
        groups.set(key, {
          module: mod,
          objective: obj,
          sessions: [],
          firstDate: new Date(s.date)
        });
      }
      groups.get(key)!.sessions.push(s);
    });

    const historyArray = Array.from(groups.values()).sort((a, b) => a.firstDate.getTime() - b.firstDate.getTime());
    
    const current = historyArray.pop(); 
    const previous = historyArray;

    return { current, previous };
  }, [sessions, viewMode]);

  const totalSuccess = sessions.reduce((acc, s) => acc + s.uaC, 0); 
  
  return (
    <div className="animate-in slide-in-from-right-10 duration-300 font-sans">
      <div className="flex justify-between items-center mb-6">
        <button 
          onClick={onBack}
          className="flex items-center text-slate-400 hover:text-bida-navy transition font-bold text-sm"
        >
          <ChevronLeft className="w-5 h-5 mr-1" /> Volver
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 p-6 md:p-8 shadow-sm mb-8 flex flex-col md:flex-row items-center md:items-start gap-6 md:gap-8">
        <div className="w-24 h-24 md:w-32 md:h-32 rounded-3xl bg-slate-50 flex items-center justify-center border-4 border-white shadow-xl shadow-slate-200 shrink-0 overflow-hidden">
           {dog.avatarUrl ? (
             <img src={dog.avatarUrl} alt={dog.name} className="w-full h-full object-cover" />
           ) : (
             <DogIcon className="w-10 h-10 md:w-14 md:h-14 text-slate-300" />
           )}
        </div>

        <div className="flex-1 text-center md:text-left w-full">
          <div className="flex flex-col md:flex-row md:items-center gap-3 mb-2 justify-center md:justify-start">
            <h1 className="text-3xl md:text-4xl font-black text-bida-navy tracking-tight">{dog.name}</h1>
            <LevelBadge level={dog.level} />
          </div>
          <p className="text-slate-500 mb-6 font-medium text-base md:text-lg">{dog.breed}</p>

          {viewMode === 'Training' && (
            <div className="mb-8 w-full max-w-sm mx-auto md:mx-0">
                <div className="flex justify-between items-end mb-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Progreso de Entrenamiento</span>
                <span className="text-xs font-bold text-bida-navy font-numeric">{uniqueModulesCount} / {totalModules} Módulos</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                <div 
                    className={`h-full rounded-full transition-all duration-1000 ease-out shadow-sm ${progressBarColor}`} 
                    style={{ width: `${progressPercent}%` }}
                />
                </div>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-md mx-auto md:mx-0">
             <div className="bg-slate-50 p-3 md:p-4 rounded-2xl border border-slate-100">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Sesiones</div>
                <div className="text-xl md:text-2xl font-bold text-bida-navy font-numeric">{sessions.length}</div>
             </div>
             <div className={`p-3 md:p-4 rounded-2xl border ${viewMode === 'Training' ? 'bg-green-50 border-green-100' : 'bg-orange-50 border-orange-100'}`}>
                <div className={`text-[10px] font-bold uppercase tracking-wider ${viewMode === 'Training' ? 'text-green-600' : 'text-orange-600'}`}>
                    {viewMode === 'Training' ? 'UAC' : 'OK'}
                </div>
                <div className={`text-xl md:text-2xl font-bold font-numeric ${viewMode === 'Training' ? 'text-green-700' : 'text-orange-700'}`}>
                  {totalSuccess}
                </div>
             </div>
          </div>
        </div>
      </div>

      {history.current && (
        <div className="bg-white rounded-3xl border border-slate-100 p-6 md:p-8 shadow-sm mb-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-lg md:text-xl font-bold text-bida-navy flex items-center">
                <Activity className="w-5 h-5 md:w-6 md:h-6 mr-2 text-bida-orange" />
                {viewMode === 'Training' ? 'Objetivo Actual' : 'Actividad'}
              </h2>
              <p className="text-slate-500 text-xs md:text-sm mt-1 font-medium flex flex-wrap items-center">
                {history.current.module} <ChevronRight className="w-3 h-3 inline mx-1 text-slate-300" /> 
                <span className="font-bold text-bida-navy">{history.current.objective}</span>
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl md:text-3xl font-black text-bida-orange font-numeric">
                {history.current.sessions.reduce((acc, s) => acc + s.uaC, 0)} <span className="text-xs md:text-sm font-bold text-slate-300 font-sans">{viewMode === 'Training' ? 'UAC' : 'OK'}</span>
              </div>
            </div>
          </div>

          <div className="h-64 md:h-80 w-full min-h-[250px]">
             <UACChart data={history.current.sessions.slice(-6)} color="#f9953c" />
          </div>
        </div>
      )}

      {history.previous.length > 0 && (
        <div>
          <h3 className="text-lg md:text-xl font-bold text-bida-navy mb-5 flex items-center">
            <Layers className="w-5 h-5 mr-2 text-slate-400" />
            Historial
          </h3>
          <div className="space-y-4">
            {history.previous.map((group, idx) => (
              <HistoryItem key={`${group.module}-${group.objective}-${idx}`} group={group} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

interface NewDogModalProps {
  onClose: () => void;
  onSave: (dog: Dog) => void;
}

const NewDogModal: React.FC<NewDogModalProps> = ({ onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: '',
    breed: '',
    age: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newDog: Dog = {
      id: `d-${Date.now()}`,
      name: formData.name,
      breed: formData.breed,
      age: Number(formData.age),
      level: CertificationLevel.Novice, 
      handlerId: '', 
      avatarUrl: getDogAvatar(formData.name)
    };
    onSave(newDog);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-bida-navy/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in font-sans">
      <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 border border-white/20">
        <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-white">
          <h3 className="font-bold text-xl text-bida-navy">Nuevo Perro</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-full transition">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Nombre</label>
            <input 
              required
              type="text" 
              placeholder="Ej. Atlas"
              className="w-full p-3.5 bg-slate-50 border-0 rounded-xl focus:ring-2 focus:ring-bida-orange/50 focus:outline-none text-slate-900 font-medium"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
            />
          </div>
          
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Raza</label>
            <input 
              required
              type="text" 
              placeholder="Ej. Pastor Belga"
              className="w-full p-3.5 bg-slate-50 border-0 rounded-xl focus:ring-2 focus:ring-bida-orange/50 focus:outline-none text-slate-900 font-medium"
              value={formData.breed}
              onChange={e => setFormData({...formData, breed: e.target.value})}
            />
          </div>
          
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Edad (Años)</label>
            <input 
              required
              type="number" 
              min="0"
              step="0.5"
              placeholder="Ej. 3"
              className="w-full p-3.5 bg-slate-50 border-0 rounded-xl focus:ring-2 focus:ring-bida-orange/50 focus:outline-none text-slate-900 font-medium font-numeric"
              value={formData.age}
              onChange={e => setFormData({...formData, age: e.target.value})}
            />
          </div>

          <div className="pt-4 flex gap-3">
            <button 
              type="button" 
              onClick={onClose}
              className="flex-1 py-3.5 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              className="flex-1 py-3.5 bg-bida-orange text-white font-bold rounded-xl hover:bg-orange-500 transition shadow-lg shadow-orange-200"
            >
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const Roster: React.FC<RosterProps> = ({ dogs, sessions, trainers, onAddDog }) => {
  const [selectedDogId, setSelectedDogId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<SessionMode>('Training');
  
  const dogsWithStats = useMemo(() => {
    return dogs.map(dog => {
      const dogSessions = sessions.filter(s => s.dogId === dog.id && s.mode === viewMode);
      
      let totalSuccess = 0; 
      let totalOps = 0;     
      let secondaryMetric = 0; 

      const uniqueModules = new Set<string>();

      dogSessions.forEach(s => {
        if (viewMode === 'Training') {
            totalSuccess += s.uaC;
            totalOps += (s.uaC + s.uaI); 
            if (s.module) uniqueModules.add(s.module);
        } else {
            const isSuccess = s.result === 'VP' || s.result === 'VN';
            const isFailure = s.result === 'FP' || s.result === 'FN';
            
            if (isSuccess) totalSuccess++;
            if (isSuccess || isFailure) totalOps++;
            if (s.result === 'FP') secondaryMetric++;
        }
      });

      const accuracy = totalOps > 0 ? (totalSuccess / totalOps) * 100 : 0;

      return {
        ...dog,
        stats: {
          totalSessions: dogSessions.length,
          primaryMetric: viewMode === 'Training' ? uniqueModules.size : secondaryMetric,
          totalSuccess,
          accuracy
        }
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [dogs, sessions, viewMode]);

  if (selectedDogId) {
    const dog = dogs.find(d => d.id === selectedDogId);
    if (!dog) return null;

    return (
      <DogDetailView 
        dog={dog} 
        sessions={sessions.filter(s => s.dogId === dog.id && s.mode === viewMode)} 
        onBack={() => setSelectedDogId(null)} 
        viewMode={viewMode}
      />
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 font-sans">
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-bida-navy">Unidad Canina</h2>
          <p className="text-slate-500 font-medium text-sm md:text-base">Estado y rendimiento</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="bg-white p-1 rounded-xl shadow-sm border border-slate-200 flex w-full sm:w-auto">
                <button 
                    onClick={() => setViewMode('Training')}
                    className={`flex-1 sm:flex-none px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center transition-all ${viewMode === 'Training' ? 'bg-bida-navy text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    <Dumbbell className="w-3 h-3 mr-1" /> Entreno
                </button>
                <button 
                    onClick={() => setViewMode('Operational')}
                    className={`flex-1 sm:flex-none px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center transition-all ${viewMode === 'Operational' ? 'bg-bida-orange text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    <TestTube2 className="w-3 h-3 mr-1" /> Muestras
                </button>
            </div>

            <button 
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 bg-bida-navy text-white rounded-xl text-sm font-bold hover:bg-[#003366] transition shadow-lg shadow-slate-300 flex items-center justify-center w-full sm:w-auto"
            >
                <Plus className="w-5 h-5 mr-1" /> Nuevo Perro
            </button>
        </div>
      </div>

      {dogs.length === 0 ? (
        <div className="text-center py-24 bg-white rounded-3xl border border-dashed border-slate-200">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Bone className="w-10 h-10 text-slate-300" />
          </div>
          <h3 className="text-xl font-bold text-bida-navy">No hay perros registrados</h3>
          <p className="text-slate-500 mb-6 font-medium">Añade un nuevo miembro a la unidad para empezar.</p>
          <button 
             onClick={() => setIsAddModalOpen(true)}
             className="text-bida-orange font-bold hover:underline"
          >
            Añadir Perro
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
          {dogsWithStats.map(dog => (
            <div 
              key={dog.id} 
              onClick={() => setSelectedDogId(dog.id)}
              className="group bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer"
            >
              <div className="flex p-4 md:p-6">
                <div className={`w-16 h-16 md:w-24 md:h-24 rounded-2xl flex items-center justify-center border transition-colors shrink-0 overflow-hidden ${viewMode === 'Training' ? 'bg-orange-50/50 border-orange-100' : 'bg-green-50/50 border-green-100'}`}>
                   {dog.avatarUrl ? (
                     <img src={dog.avatarUrl} alt={dog.name} className="w-full h-full object-cover" />
                   ) : (
                      viewMode === 'Training' ? (
                          <DogIcon className="w-8 h-8 md:w-12 md:h-12 text-slate-300 group-hover:text-bida-orange transition-colors" />
                      ) : (
                          <CheckCircle2 className="w-8 h-8 md:w-12 md:h-12 text-slate-300 group-hover:text-bida-green transition-colors" />
                      )
                   )}
                </div>
                
                <div className="ml-4 md:ml-5 flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="text-xl md:text-2xl font-black text-bida-navy truncate">{dog.name}</h3>
                    <LevelBadge level={dog.level} />
                  </div>
                  <p className="text-slate-500 text-sm mt-1 truncate font-medium">{dog.breed}</p>
                  
                  <div className="flex items-center mt-3 md:mt-5 text-[10px] md:text-xs font-bold text-slate-500 bg-slate-50 rounded-lg p-2 w-fit font-numeric">
                    {viewMode === 'Training' ? (
                        <>
                            <Target className="w-3.5 h-3.5 mr-1.5 text-bida-sky" />
                            {dog.stats.primaryMetric} Módulos
                        </>
                    ) : (
                        <>
                            <AlertTriangle className="w-3.5 h-3.5 mr-1.5 text-bida-pink" />
                            {dog.stats.primaryMetric} Falsos Positivos
                        </>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-slate-50/50 px-4 py-3 md:px-6 md:py-5 border-t border-slate-50 grid grid-cols-3 gap-4 divide-x divide-slate-200">
                <div className="text-center">
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Sesiones</div>
                  <div className="text-lg md:text-xl font-bold text-slate-700 font-numeric">{dog.stats.totalSessions}</div>
                </div>
                <div className="text-center">
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                      {viewMode === 'Training' ? 'UA Corr.' : 'Efectivos'}
                  </div>
                  <div className="text-lg md:text-xl font-bold text-bida-green font-numeric">{dog.stats.totalSuccess}</div>
                </div>
                <div className="text-center">
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">% Éxito</div>
                  <div className={`text-lg md:text-xl font-bold font-numeric ${dog.stats.accuracy >= 80 ? 'text-bida-sky' : 'text-bida-orange'}`}>
                    {dog.stats.accuracy.toFixed(0)}%
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isAddModalOpen && (
        <NewDogModal 
          onClose={() => setIsAddModalOpen(false)}
          onSave={onAddDog}
        />
      )}
    </div>
  );
};