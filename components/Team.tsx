
import React, { useState, useMemo } from 'react';
import { Trainer, SessionData } from '../types';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { 
  Medal, User, ChevronLeft, Target, Calendar, Activity, 
  Dog as DogIcon, TrendingUp, Award, BarChart3, Plus, X
} from 'lucide-react';
import { getTrainerAvatar } from '../constants';

interface TeamProps {
  trainers: Trainer[];
  sessions: SessionData[];
  onAddTrainer: (trainer: Trainer) => void;
}

const getInitials = (name: string) => {
  return name
    .trim()
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
};

export const Team: React.FC<TeamProps> = ({ trainers, sessions, onAddTrainer }) => {
  const [selectedTrainerId, setSelectedTrainerId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const trainersWithStats = useMemo(() => {
    return trainers.map(trainer => {
      const trainerSessions = sessions.filter(s => s.trainerId === trainer.id);
      let totalUAC = 0;
      let totalOps = 0;
      trainerSessions.forEach(s => {
        totalUAC += s.uaC;
        totalOps += (s.uaC + s.uaI);
      });
      const successRate = totalOps > 0 ? (totalUAC / totalOps) * 100 : 0;
      return {
        ...trainer,
        stats: {
          totalSessions: trainerSessions.length,
          successRate
        }
      };
    }).sort((a, b) => b.stats.successRate - a.stats.successRate);
  }, [trainers, sessions]);

  if (selectedTrainerId) {
    const trainer = trainers.find(t => t.id === selectedTrainerId);
    if (!trainer) return null;
    return (
      <TrainerDetailView 
        trainer={trainer} 
        sessions={sessions.filter(s => s.trainerId === trainer.id)} 
        onBack={() => setSelectedTrainerId(null)} 
      />
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 font-sans">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h2 className="text-2xl md:text-3xl font-black text-bida-navy">Equipo</h2>
           <p className="text-slate-500 font-medium text-sm md:text-base">Evaluación de rendimiento</p>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="w-full md:w-auto px-5 py-2.5 bg-bida-navy text-white rounded-xl text-sm font-bold hover:bg-[#003366] transition shadow-lg shadow-slate-300 flex items-center justify-center"
        >
            <Plus className="w-5 h-5 mr-2" /> Nuevo Entrenador
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {trainersWithStats.map((trainer, index) => (
          <div 
            key={trainer.id}
            onClick={() => setSelectedTrainerId(trainer.id)}
            className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 cursor-pointer group relative overflow-hidden"
          >
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-slate-50 shadow-sm group-hover:border-bida-orange/30 transition-colors shrink-0 bg-slate-100 flex items-center justify-center">
                        {trainer.avatarUrl ? (
                            <img src={trainer.avatarUrl} alt={trainer.name} className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-bida-navy font-bold text-lg">{getInitials(trainer.name)}</span>
                        )}
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-bida-navy group-hover:text-bida-orange transition-colors leading-tight">
                        {trainer.name}
                        </h3>
                        <p className="text-xs text-slate-500 font-medium truncate max-w-[140px]">{trainer.role}</p>
                    </div>
                </div>
                {index < 3 && (
                    <div className={`p-1.5 rounded-lg ${index === 0 ? 'bg-yellow-50 text-yellow-500' : index === 1 ? 'bg-slate-50 text-slate-400' : 'bg-orange-50 text-orange-400'}`}>
                        <Medal className="w-4 h-4" />
                    </div>
                )}
            </div>

            <div className="flex items-center gap-2 bg-slate-50 rounded-xl p-3 border border-slate-100/50">
               <div className="flex-1 text-center border-r border-slate-200 pr-2">
                 <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Sesiones</div>
                 <div className="text-base font-bold text-slate-800 font-numeric">{trainer.stats.totalSessions}</div>
               </div>
               <div className="flex-1 text-center pl-2">
                 <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Tasa Éxito</div>
                 <div className={`text-base font-bold font-numeric ${getEfficiencyColor(trainer.stats.successRate)}`}>
                   {trainer.stats.successRate.toFixed(0)}%
                 </div>
               </div>
            </div>
            
            <div className="mt-3 flex justify-end">
               <span className="text-[10px] font-bold text-slate-400 group-hover:text-bida-sky transition-colors flex items-center">
                 Ver detalles <ChevronLeft className="w-3 h-3 rotate-180 ml-1" />
               </span>
            </div>
          </div>
        ))}
      </div>

      {isAddModalOpen && (
        <NewTrainerModal 
          onClose={() => setIsAddModalOpen(false)}
          onSave={onAddTrainer}
        />
      )}
    </div>
  );
};

const getEfficiencyCategory = (rate: number) => {
  if (rate >= 90) return { label: 'Excelente', color: 'text-bida-green bg-green-50 border-green-200', icon: Award };
  if (rate >= 80) return { label: 'Muy Buena', color: 'text-bida-orange bg-orange-50 border-orange-200', icon: TrendingUp };
  if (rate >= 70) return { label: 'Buena', color: 'text-bida-sky bg-blue-50 border-blue-200', icon: Activity };
  return { label: 'Regular', color: 'text-bida-pink bg-pink-50 border-pink-200', icon: Activity };
};

const getEfficiencyColor = (rate: number) => {
  if (rate >= 90) return 'text-bida-green';
  if (rate >= 80) return 'text-bida-orange';
  if (rate >= 70) return 'text-bida-sky';
  return 'text-bida-pink';
};

interface NewTrainerModalProps {
  onClose: () => void;
  onSave: (trainer: Trainer) => void;
}

const NewTrainerModal: React.FC<NewTrainerModalProps> = ({ onClose, onSave }) => {
  const [formData, setFormData] = useState({ name: '', role: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newTrainer: Trainer = {
      id: `t-${Date.now()}`,
      name: formData.name,
      role: formData.role,
      avatarUrl: getTrainerAvatar(formData.name)
    };
    onSave(newTrainer);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-bida-navy/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in font-sans">
      <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 border border-white/20">
        <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-white">
          <h3 className="font-bold text-xl text-bida-navy">Nuevo Entrenador</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-full transition">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Nombre</label>
            <input required type="text" placeholder="Ej. Ana Pérez" className="w-full p-3.5 bg-slate-50 border-0 rounded-xl focus:ring-2 focus:ring-bida-orange/50 focus:outline-none text-slate-900 font-medium" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Rol</label>
            <input required type="text" placeholder="Ej. Entrenador Junior" className="w-full p-3.5 bg-slate-50 border-0 rounded-xl focus:ring-2 focus:ring-bida-orange/50 focus:outline-none text-slate-900 font-medium" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} />
          </div>
          <div className="pt-4 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-3.5 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition">Cancelar</button>
            <button type="submit" className="flex-1 py-3.5 bg-bida-orange text-white font-bold rounded-xl hover:bg-orange-500 transition shadow-lg shadow-orange-200">Guardar</button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface TrainerDetailProps {
  trainer: Trainer;
  sessions: SessionData[];
  onBack: () => void;
}

const TrainerDetailView: React.FC<TrainerDetailProps> = ({ trainer, sessions, onBack }) => {
  const stats = useMemo(() => {
    let totalUAC = 0;
    let totalOps = 0;
    const uniqueDogs = new Set<string>();
    const uniqueDays = new Set<string>();
    sessions.forEach(s => {
      totalUAC += s.uaC;
      totalOps += (s.uaC + s.uaI);
      uniqueDogs.add(s.dogId);
      uniqueDays.add(s.date.split('T')[0]);
    });
    const successRate = totalOps > 0 ? (totalUAC / totalOps) * 100 : 0;
    const totalSessions = sessions.length;
    const avgUAperSession = totalSessions > 0 ? (totalUAC / totalSessions) : 0;
    const avgUAperDay = uniqueDays.size > 0 ? (totalUAC / uniqueDays.size) : 0;
    return { totalUAC, successRate, uniqueDogs: uniqueDogs.size, avgUAperSession, avgUAperDay };
  }, [sessions]);

  const chartData = useMemo(() => {
    const daysMap = new Map<string, { uac: number, ops: number }>();
    sessions.forEach(s => {
      const dateStr = s.date.split('T')[0];
      if (!daysMap.has(dateStr)) daysMap.set(dateStr, { uac: 0, ops: 0 });
      const current = daysMap.get(dateStr)!;
      current.uac += s.uaC;
      current.ops += (s.uaC + s.uaI);
    });
    return Array.from(daysMap.entries())
      .map(([date, data]) => ({
        date,
        displayDate: new Date(date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }),
        rate: data.ops > 0 ? Math.round((data.uac / data.ops) * 100) : 0
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-10);
  }, [sessions]);

  const efficiency = getEfficiencyCategory(stats.successRate);
  const EfficiencyIcon = efficiency.icon;

  return (
    <div className="animate-in slide-in-from-right-10 duration-300 font-sans">
      <button onClick={onBack} className="flex items-center text-slate-500 hover:text-bida-navy transition mb-4 font-bold text-sm">
        <ChevronLeft className="w-5 h-5 mr-1" /> Volver
      </button>
      <div className="bg-white rounded-3xl border border-slate-100 p-6 md:p-8 shadow-sm mb-6 flex flex-col md:flex-row items-center md:items-start gap-6 md:gap-8">
        <div className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-slate-50 shadow-xl overflow-hidden shrink-0 flex items-center justify-center bg-slate-100">
           {trainer.avatarUrl ? (
               <img src={trainer.avatarUrl} alt={trainer.name} className="w-full h-full object-cover" />
           ) : (
               <span className="text-bida-navy font-black text-3xl md:text-5xl">{getInitials(trainer.name)}</span>
           )}
        </div>
        <div className="flex-1 text-center md:text-left w-full">
          <div className="flex flex-col md:flex-row md:items-center gap-3 mb-2 justify-center md:justify-start">
            <h1 className="text-2xl md:text-4xl font-black text-bida-navy tracking-tight">{trainer.name}</h1>
            <span className={`px-4 py-1.5 rounded-full text-xs md:text-sm font-bold border flex items-center gap-2 w-fit mx-auto md:mx-0 ${efficiency.color}`}>
              <EfficiencyIcon className="w-4 h-4" />
              {efficiency.label}
            </span>
          </div>
          <p className="text-slate-500 mb-6 text-base md:text-lg font-medium">{trainer.role}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
             <StatCard label="UA C. Totales" value={stats.totalUAC} icon={Target} />
             <StatCard label="UA / Sesión" value={stats.avgUAperSession.toFixed(1)} icon={BarChart3} />
             <StatCard label="UA / Día" value={stats.avgUAperDay.toFixed(1)} icon={Calendar} />
             <StatCard label="Perros" value={stats.uniqueDogs} icon={DogIcon} />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        <div className="bg-gradient-to-br from-bida-navy to-[#002a55] rounded-3xl p-6 md:p-8 text-white shadow-xl flex flex-col justify-center items-center relative overflow-hidden">
           <div className="absolute top-0 right-0 p-32 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16"></div>
           <Target className="w-12 h-12 md:w-14 md:h-14 text-bida-orange mb-4 md:mb-6 drop-shadow-md" />
           <div className="text-5xl md:text-7xl font-black mb-2 font-numeric">{stats.successRate.toFixed(1)}%</div>
           <div className="text-bida-base/60 font-bold uppercase tracking-widest text-xs">Tasa de Éxito Global</div>
        </div>
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 p-6 md:p-8 shadow-sm">
           <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-2">
             <h3 className="font-bold text-bida-navy flex items-center text-lg md:text-xl">
               <TrendingUp className="w-5 h-5 md:w-6 md:h-6 mr-2 text-bida-orange" /> Tendencia
             </h3>
             <span className="text-xs font-bold text-slate-400 bg-slate-50 px-3 py-1.5 rounded-lg uppercase tracking-wide">Últimos 10 días</span>
           </div>
           <div className="h-48 md:h-64 w-full">
             <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="displayDate" tick={{fontSize: 10, fill: '#94a3b8', fontFamily: 'Ubuntu'}} axisLine={false} tickLine={false} dy={10} />
                  <YAxis domain={[0, 100]} tick={{fontSize: 10, fill: '#94a3b8', fontFamily: 'Ubuntu'}} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontFamily: 'Ubuntu' }} cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }} />
                  <Line type="linear" dataKey="rate" name="% Éxito" stroke="#f9953c" strokeWidth={4} dot={{ r: 4, fill: '#f9953c', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6, fill: '#f9953c', stroke: '#ffedd5', strokeWidth: 4 }} />
                </LineChart>
             </ResponsiveContainer>
           </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, icon: Icon }: { label: string, value: string | number, icon: any }) => (
  <div className="bg-slate-50 p-3 md:p-4 rounded-2xl border border-slate-100 flex flex-col justify-center min-h-[80px] md:min-h-[90px]">
    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5 flex items-center truncate">
      <Icon className="w-3.5 h-3.5 mr-1.5 text-bida-orange shrink-0" />
      {label}
    </div>
    <div className="text-xl md:text-2xl font-bold text-bida-navy font-numeric">{value}</div>
  </div>
);
