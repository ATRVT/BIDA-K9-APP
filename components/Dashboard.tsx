import React, { useMemo, useState } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area
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
    // 1. Filtrar sesiones por modo (Entrenamiento vs Muestras)
    const filteredSessions = sessions.filter(s => s.mode === viewMode);
    
    // 2. Métricas Globales
    const totalSessions = filteredSessions.length;
    let totalSuccesses = 0; // Hits (UAC) o (VP + VN)
    let totalFailures = 0;  // Misses (UAI) o (FP + FN)
    let falsePositivesCount = 0;

    filteredSessions.forEach(s => {
      if (viewMode === 'Training') {
        totalSuccesses += s.hits;
        totalFailures += s.misses;
      } else {
        // Lógica Operativa: VP y VN son éxitos. FP y FN son fallos.
        const isSuccess = s.result === 'VP' || s.result === 'VN';
        const isFailure = s.result === 'FP' || s.result === 'FN';
        
        if (isSuccess) totalSuccesses++;
        if (isFailure) totalFailures++;
        if (s.result === 'FP') falsePositivesCount++;
      }
    });

    const totalOpportunities = totalSuccesses + totalFailures;
    const globalAccuracy = totalOpportunities > 0 ? (totalSuccesses / totalOpportunities) * 100 : 0;
    
    // Promedio UA (Solo training) o Tasa FP (Muestras)
    const secondaryMetric = viewMode === 'Training' 
      ? (totalSessions > 0 ? totalSuccesses / totalSessions : 0).toFixed(1)
      : falsePositivesCount;

    // 3. Filtrar datos de la ÚLTIMA SEMANA (7 días)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const weeklySessions = filteredSessions.filter(s => new Date(s.date) >= sevenDaysAgo);

    // 4. Preparar datos para Gráfica de Evolución (Últimos 7 días)
    const dailyStatsMap = new Map<string, { success: number, total: number }>();
    
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
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

    // 5. Top Performers (Basado SOLO en la última semana y el modo actual)
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

    // Contar perros activos (que tengan al menos 1 sesión en este modo en total)
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
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-bida-navy flex items-center gap-2">
            Tablero de Control
          </h2>
          <p className="text-slate-500 font-medium">Resumen operativo y métricas de evolución</p>
        </div>

        {/* MODO TOGGLE */}
        <div className="bg-white p-1 rounded-xl shadow-sm border border-slate-200 flex">
            <button 
                onClick={() => setViewMode('Training')}
                className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center transition-all ${viewMode === 'Training' ? 'bg-bida-navy text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
            >
                <Dumbbell className="w-4 h-4 mr-2" /> Entrenamiento
            </button>
            <button 
                onClick={() => setViewMode('Operational')}
                className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center transition-all ${viewMode === 'Operational' ? 'bg-bida-orange text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
            >
                <TestTube2 className="w-4 h-4 mr-2" /> Muestras
            </button>
        </div>
      </div>

      {/* 1. KPI CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard 
          title={viewMode === 'Training' ? "Precisión Global" : "Efectividad Muestras"}
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
          title={viewMode === 'Training' ? "Promedio UA/Sesión" : "Falsos Positivos"} 
          value={stats.secondaryMetric} 
          icon={viewMode === 'Training' ? BarChart3 : AlertTriangle} 
          color={viewMode === 'Training' ? "green" : "pink"}
          subtitle={viewMode === 'Training' ? "Intensidad de trabajo" : "Alertas incorrectas"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* 2. MAIN CHART: Weekly Evolution */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm lg:col-span-2 flex flex-col">
          <div className="flex justify-between items-center mb-6">
             <div>
                <h3 className="text-xl font-bold text-bida-navy flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-bida-orange" />
                    Evolución Semanal
                </h3>
                <p className="text-sm text-slate-400 font-medium">
                    {viewMode === 'Training' ? 'Tendencia de aprendizaje' : 'Efectividad operativa (VP+VN)'}
                </p>
             </div>
             <div className="text-right">
                <span className="block text-3xl font-bold text-bida-navy font-numeric">{stats.weeklyVolume}</span>
                <span className="text-xs text-bida-orange font-bold uppercase tracking-wider">Sesiones (7 días)</span>
             </div>
          </div>
          
          <div className="h-80 w-full">
             <ResponsiveContainer width="100%" height="100%">
               <AreaChart data={stats.evolutionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                 <defs>
                    <linearGradient id="colorAccuracy" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={viewMode === 'Training' ? "#f9953c" : "#30e674"} stopOpacity={0.2}/>
                      <stop offset="95%" stopColor={viewMode === 'Training' ? "#f9953c" : "#30e674"} stopOpacity={0}/>
                    </linearGradient>
                 </defs>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                 <XAxis dataKey="displayDate" tick={{fontSize: 12, fill: '#94a3b8', fontFamily: 'Ubuntu'}} axisLine={false} tickLine={false} dy={10} />
                 <YAxis domain={[0, 100]} tick={{fontSize: 12, fill: '#94a3b8', fontFamily: 'Ubuntu'}} axisLine={false} tickLine={false} />
                 <RechartsTooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontFamily: 'Ubuntu' }}
                 />
                 <Area 
                    type="monotone" 
                    dataKey="accuracy" 
                    stroke={viewMode === 'Training' ? "#f9953c" : "#30e674"}
                    strokeWidth={4}
                    fillOpacity={1} 
                    fill="url(#colorAccuracy)" 
                    name="% Éxito"
                    dot={{ r: 4, fill: viewMode === 'Training' ? "#f9953c" : "#30e674", strokeWidth: 2, stroke: '#fff' }}
                 />
               </AreaChart>
             </ResponsiveContainer>
          </div>
        </div>

        {/* 3. RIGHT COLUMN: Top Performers (Weekly) */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm flex flex-col p-6">
           <h3 className="font-bold text-xl mb-2 flex items-center gap-2 text-bida-navy">
             {viewMode === 'Training' ? <Target className="w-5 h-5 text-bida-green" /> : <CheckCircle2 className="w-5 h-5 text-bida-green" />}
             Top Performers
           </h3>
           <p className="text-sm text-slate-400 mb-6 font-medium">Mejor rendimiento (Última semana)</p>

           <div className="space-y-4 flex-1">
              {stats.topDogs.length === 0 ? (
                  <div className="text-center py-10 text-slate-400">
                      <p>Sin datos recientes en este modo</p>
                  </div>
              ) : (
                stats.topDogs.map((dog, idx) => (
                    <div key={dog.id} className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 transition border border-transparent hover:border-slate-100">
                       <div className="flex items-center gap-3">
                         <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm font-numeric ${
                            idx === 0 ? 'bg-yellow-100 text-yellow-700' : 
                            idx === 1 ? 'bg-slate-200 text-slate-600' :
                            idx === 2 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500'
                         }`}>
                           {idx + 1}
                         </div>
                         <div>
                            <span className="font-bold text-bida-navy block">{dog.name}</span>
                            <span className="text-xs text-slate-500 font-medium font-numeric">{dog.sessionsCount} sesiones</span>
                         </div>
                       </div>
                       <div className="text-right">
                          <div className={`font-bold text-lg font-numeric ${
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
           
           <div className="mt-6 pt-4 border-t border-slate-100 text-center">
             <p className="text-xs text-slate-400 italic">
               Calculado en base a {viewMode === 'Training' ? 'UA Correctas' : 'VP + VN'}
             </p>
           </div>
        </div>

      </div>
    </div>
  );
};

// Subcomponente simple para Tarjetas KPI
const KPICard = ({ title, value, icon: Icon, color, trend, subtitle }: any) => {
  const colors: any = {
    orange: 'text-bida-orange bg-orange-50',
    navy: 'text-bida-navy bg-slate-100',
    sky: 'text-bida-sky bg-blue-50',
    green: 'text-bida-green bg-green-50',
    pink: 'text-bida-pink bg-pink-50'
  };
  
  return (
    <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-lg transition-shadow duration-300">
      <div className="flex justify-between items-start mb-2">
        <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">{title}</span>
        <div className={`p-2.5 rounded-xl ${colors[color] || colors.navy}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div>
        <div className="text-3xl font-black text-bida-navy font-numeric">{value}</div>
        {trend && (
          <div className="text-xs font-bold text-slate-400 flex items-center mt-1 bg-slate-50 w-fit px-2 py-0.5 rounded-md">
            {trend}
          </div>
        )}
        {subtitle && (
          <div className="text-xs text-slate-400 mt-1 font-medium">{subtitle}</div>
        )}
      </div>
    </div>
  );
};