
import React, { useMemo, useState } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer
} from 'recharts';
import { 
  Activity, Target, TrendingUp, Calendar, 
  BarChart3, Dog as DogIcon, Dumbbell, TestTube2, AlertTriangle, CheckCircle2
} from 'lucide-react';
import { SessionData, Dog, SessionMode } from '../types';

interface DashboardProps {
  sessions: SessionData[];
  dogs: Dog[];
}

export const Dashboard: React.FC<DashboardProps> = ({ sessions, dogs }) => {
  const [viewMode, setViewMode] = useState<SessionMode>('Training');
  
  // --- CÁLCULOS DE ESTADÍSTICAS ---
  const stats = useMemo(() => {
    const filteredSessions = sessions.filter(s => s.mode === viewMode);
    
    const totalSessions = filteredSessions.length;
    let totalUA_Correct = 0;
    let totalUA_Incorrect = 0;
    let falsePositivesCount = 0;

    filteredSessions.forEach(s => {
      if (viewMode === 'Training') {
        totalUA_Correct += s.uaC;
        totalUA_Incorrect += s.uaI;
      } else {
        const isSuccess = s.result === 'VP' || s.result === 'VN';
        const isFailure = s.result === 'FP' || s.result === 'FN';
        
        if (isSuccess) totalUA_Correct++;
        if (isFailure) totalUA_Incorrect++;
        if (s.result === 'FP') falsePositivesCount++;
      }
    });

    const totalOpportunities = totalUA_Correct + totalUA_Incorrect;
    const globalAccuracy = totalOpportunities > 0 ? (totalUA_Correct / totalOpportunities) * 100 : 0;
    
    const secondaryMetric = viewMode === 'Training' 
      ? (totalSessions > 0 ? totalUA_Correct / totalSessions : 0).toFixed(1)
      : falsePositivesCount;

    // --- LÓGICA DE EVOLUCIÓN MEJORADA (Ventana de 7 días con actividad) ---
    const sortedSessions = [...filteredSessions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const lastSessionDate = sortedSessions.length > 0 ? new Date(sortedSessions[0].date) : new Date();
    
    const startDate = new Date(lastSessionDate);
    startDate.setDate(startDate.getDate() - 6);

    const weeklySessions = filteredSessions.filter(s => {
        const d = new Date(s.date);
        return d >= startDate && d <= lastSessionDate;
    });

    const dailyStatsMap = new Map<string, { success: number, total: number }>();
    
    for (let i = 6; i >= 0; i--) {
        const d = new Date(lastSessionDate);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        dailyStatsMap.set(dateStr, { success: 0, total: 0 });
    }

    weeklySessions.forEach(s => {
        const dateStr = s.date.split('T')[0];
        if (dailyStatsMap.has(dateStr)) {
            const current = dailyStatsMap.get(dateStr)!;
            if (viewMode === 'Training') {
                current.success += s.hits;
                current.total += (s.hits + s.misses);
            } else {
                const isSuccess = s.result === 'VP' || s.result === 'VN';
                const isFailure = s.result === 'FP' || s.result === 'FN';
                if (isSuccess) current.success++;
                if (isSuccess || isFailure) current.total++;
            }
        }
    });

    const evolutionData = Array.from(dailyStatsMap.entries()).map(([date, data]) => ({
        date,
        displayDate: new Date(date).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' }),
        accuracy: data.total > 0 ? Math.round((data.success / data.total) * 100) : 0
    }));

    const dogPerformance = dogs.map(dog => {
      const dogWeeklySessions = weeklySessions.filter(s => s.dogId === dog.id);
      let dSuccess = 0;
      let dTotal = 0;
      
      dogWeeklySessions.forEach(s => {
        if (viewMode === 'Training') {
            dSuccess += s.hits;
            dTotal += (s.hits + s.misses);
        } else {
            const isSuccess = s.result === 'VP' || s.result === 'VN';
            const isFailure = s.result === 'FP' || s.result === 'FN';
            if (isSuccess) dSuccess++;
            if (isSuccess || isFailure) dTotal++;
        }
      });
      
      return {
        ...dog,
        accuracy: dTotal > 0 ? (dSuccess / dTotal) * 100 : 0,
        sessionsCount: dogWeeklySessions.length
      };
    });

    const topDogs = [...dogPerformance]
      .filter(d => d.sessionsCount > 0)
      .sort((a, b) => b.accuracy - a.accuracy)
      .slice(0, 5);

    const activeDogsSet = new Set(filteredSessions.map(s => s.dogId));

    return {
      totalSessions,
      globalAccuracy: globalAccuracy.toFixed(1),
      activeDogs: activeDogsSet.size,
      secondaryMetric,
      evolutionData,
      topDogs,
      weeklyVolume: weeklySessions.length
    };
  }, [sessions, dogs, viewMode]);

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500 pb-10">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-bida-navy flex items-center gap-2">
            Tablero
          </h2>
          <p className="text-slate-500 font-medium text-sm md:text-base">Métricas y evolución</p>
        </div>

        {/* MODO TOGGLE */}
        <div className="bg-white p-1 rounded-xl shadow-sm border border-slate-200 flex w-full md:w-auto">
            <button 
                onClick={() => setViewMode('Training')}
                className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs md:text-sm font-bold flex items-center justify-center transition-all ${viewMode === 'Training' ? 'bg-bida-navy text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
            >
                <Dumbbell className="w-4 h-4 mr-2" /> Entrenamiento
            </button>
            <button 
                onClick={() => setViewMode('Operational')}
                className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs md:text-sm font-bold flex items-center justify-center transition-all ${viewMode === 'Operational' ? 'bg-bida-orange text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
            >
                <TestTube2 className="w-4 h-4 mr-2" /> Muestras
            </button>
        </div>
      </div>

      {/* 1. KPI CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <KPICard 
          title={viewMode === 'Training' ? "Precisión Global" : "Efectividad"}
          value={`${stats.globalAccuracy}%`} 
          icon={Target} 
          trend="Histórico"
          color="orange"
        />
        <KPICard 
          title="Sesiones Totales" 
          value={stats.totalSessions} 
          icon={Activity} 
          color="navy"
        />
        <KPICard 
          title="Perros Activos" 
          value={stats.activeDogs} 
          icon={DogIcon} 
          color="sky"
        />
        <KPICard 
          title={viewMode === 'Training' ? "Aciertos Promedio" : "Falsos Pos."} 
          value={stats.secondaryMetric} 
          icon={viewMode === 'Training' ? BarChart3 : AlertTriangle} 
          color={viewMode === 'Training' ? "green" : "pink"}
          subtitle={viewMode === 'Training' ? "Por sesión" : "Alertas incorrectas"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        
        {/* 2. MAIN CHART: Weekly Evolution */}
        <div className="bg-white p-4 md:p-6 rounded-3xl border border-slate-100 shadow-sm lg:col-span-2 flex flex-col">
          <div className="flex justify-between items-center mb-6">
             <div>
                <h3 className="text-lg md:text-xl font-bold text-bida-navy flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-bida-orange" />
                    Última Actividad
                </h3>
             </div>
             <div className="text-right">
                <span className="block text-2xl md:text-3xl font-bold text-bida-navy font-numeric">{stats.weeklyVolume}</span>
                <span className="text-[10px] md:text-xs text-bida-orange font-bold uppercase tracking-wider">Sesiones en la ventana</span>
             </div>
          </div>
          
          <div className="h-64 md:h-80 w-full">
             <ResponsiveContainer width="100%" height="100%">
               <LineChart data={stats.evolutionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                 <XAxis dataKey="displayDate" tick={{fontSize: 10, fill: '#94a3b8', fontFamily: 'Ubuntu'}} axisLine={false} tickLine={false} dy={10} />
                 <YAxis domain={[0, 100]} tick={{fontSize: 10, fill: '#94a3b8', fontFamily: 'Ubuntu'}} axisLine={false} tickLine={false} />
                 <RechartsTooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontFamily: 'Ubuntu' }}
                 />
                 <Line 
                    type="linear" 
                    dataKey="accuracy" 
                    stroke={viewMode === 'Training' ? "#f9953c" : "#30e674"}
                    strokeWidth={4}
                    name="% Éxito"
                    dot={{ r: 4, fill: viewMode === 'Training' ? "#f9953c" : "#30e674", strokeWidth: 2, stroke: '#fff' }}
                 />
               </LineChart>
             </ResponsiveContainer>
          </div>
        </div>

        {/* 3. RIGHT COLUMN: Dog Performance */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm flex flex-col p-4 md:p-6">
           <h3 className="font-bold text-lg md:text-xl mb-2 flex items-center gap-2 text-bida-navy">
             {viewMode === 'Training' ? <Target className="w-5 h-5 text-bida-green" /> : <CheckCircle2 className="w-5 h-5 text-bida-green" />}
             Desempeño canino
           </h3>

           <div className="space-y-3 flex-1">
              {stats.topDogs.length === 0 ? (
                  <div className="text-center py-10 text-slate-400">
                      <p>Sin datos recientes</p>
                  </div>
              ) : (
                stats.topDogs.map((dog, idx) => (
                    <div key={dog.id} className="flex items-center justify-between p-2 md:p-3 rounded-2xl hover:bg-slate-50 transition border border-transparent hover:border-slate-100">
                       <div className="flex items-center gap-3">
                         <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm font-numeric ${
                            idx === 0 ? 'bg-yellow-100 text-yellow-700' : 
                            idx === 1 ? 'bg-slate-200 text-slate-600' :
                            idx === 2 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500'
                         }`}>
                           {idx + 1}
                         </div>
                         <div>
                            <span className="font-bold text-bida-navy block text-sm md:text-base">{dog.name}</span>
                            <span className="text-[10px] md:text-xs text-slate-500 font-medium font-numeric">{dog.sessionsCount} sesiones</span>
                         </div>
                       </div>
                       <div className="text-right">
                          <div className={`font-bold text-base md:text-lg font-numeric ${
                              dog.accuracy >= 90 ? 'text-bida-green' : 
                              dog.accuracy >= 80 ? 'text-bida-sky' : 'text-slate-600'
                          }`}>
                              {dog.accuracy.toFixed(0)}%
                          </div>
                       </div>
                    </div>
                  ))
              )}
           </div>
        </div>

      </div>
    </div>
  );
};

const KPICard = ({ title, value, icon: Icon, color, trend, subtitle }: any) => {
  const colors: any = {
    orange: 'text-bida-orange bg-orange-50',
    navy: 'text-bida-navy bg-slate-100',
    sky: 'text-bida-sky bg-blue-50',
    green: 'text-bida-green bg-green-50',
    pink: 'text-bida-pink bg-pink-50'
  };
  
  return (
    <div className="bg-white p-4 md:p-5 rounded-2xl md:rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-lg transition-shadow duration-300 min-h-[110px]">
      <div className="flex justify-between items-start mb-2">
        <span className="text-slate-400 text-[10px] md:text-xs font-bold uppercase tracking-wider truncate">{title}</span>
        <div className={`p-2 rounded-xl ${colors[color] || colors.navy}`}>
          <Icon className="w-4 h-4 md:w-5 md:h-5" />
        </div>
      </div>
      <div>
        <div className="text-2xl md:text-3xl font-black text-bida-navy font-numeric">{value}</div>
        {subtitle && (
          <div className="text-[10px] md:text-xs text-slate-400 mt-1 font-medium truncate">{subtitle}</div>
        )}
      </div>
    </div>
  );
};
