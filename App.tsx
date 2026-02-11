
import React, { useState, useEffect } from 'react';
import { LayoutDashboard, PlusCircle, Users, PawPrint, Menu, X, Loader2, RefreshCw, LogOut } from 'lucide-react';
import { Dashboard } from './components/Dashboard';
import { RapidEntry } from './components/RapidEntry';
import { Roster } from './components/Roster';
import { Team } from './components/Team';
import { SessionData, Dog, Trainer, CertificationLevel } from './types';
import { GOOGLE_SCRIPT_URL, getDogAvatar, getTrainerAvatar } from './constants';

// --- CONFIGURACIÓN ---
// URL moved to constants.ts

enum Tab {
  Dashboard = 'dashboard',
  RapidEntry = 'rapidEntry',
  Roster = 'roster',
  Team = 'team',
}

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.Dashboard);

  // ESTADOS (Datos)
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [dogs, setDogs] = useState<Dog[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [currentUser, setCurrentUser] = useState<Trainer | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Helper fechas
  const parseDate = (dateStr: string): string => {
    if (!dateStr) return new Date().toISOString();
    if (dateStr.includes('T')) return dateStr;
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        // FIX: Crear fecha usando UTC a mediodía para evitar que zonas horarias adelanten/atrasen el día
        const d = new Date(Date.UTC(year, month, day, 12, 0, 0));
        return d.toISOString();
      }
    }
    return new Date().toISOString();
  };

  const fetchData = async () => {
    if (!GOOGLE_SCRIPT_URL) return;
    setIsRefreshing(true);

    try {
      console.log("📥 Descargando datos...");
      const response = await fetch(`${GOOGLE_SCRIPT_URL}?t=${Date.now()}`);
      const data = await response.json();

      const normalize = (obj: any) => {
        const newObj: any = {};
        Object.keys(obj).forEach(k => newObj[k.toLowerCase().trim()] = obj[k]);
        return newObj;
      };

      // 1. Perros
      let loadedDogs: Dog[] = [];
      if (data.dogs && Array.isArray(data.dogs)) {
        loadedDogs = data.dogs.map((r: any) => {
          const d = normalize(r);
          const name = String(d.name || d.nombre || d.dogname || '').trim();
          if (!name) return null; // Ignorar filas vacías

          const avatarUrl = d.avatar || d.avatarurl || getDogAvatar(name);

          return {
            id: String(d.id || `d-${Math.random()}`),
            name: name,
            breed: String(d.breed || d.raza || ''),
            age: Number(d.age || d.edad || 0),
            level: d.level || d.nivel || 'Novice',
            handlerId: '',
            avatarUrl: avatarUrl
          };
        }).filter(d => d !== null) as Dog[];
        setDogs(loadedDogs);
      }

      // 2. Entrenadores
      let loadedTrainers: Trainer[] = [];
      if (data.trainers && Array.isArray(data.trainers)) {
        loadedTrainers = data.trainers.map((r: any) => {
          const t = normalize(r);
          const name = String(t.name || t.nombre || t.trainername || '').trim();
          if (!name) return null; // Ignorar filas vacías

          const avatarUrl = t.avatar || t.avatarurl || getTrainerAvatar(name);

          return {
            id: String(t.id || `t-${Math.random()}`),
            name: name,
            role: String(t.role || t.rol || ''),
            avatarUrl: avatarUrl
          };
        }).filter(t => t !== null) as Trainer[];
        setTrainers(loadedTrainers);
      }

      // 3. Sesiones
      if (data.sessions && Array.isArray(data.sessions)) {
        const loadedSessions = data.sessions.map((r: any, idx: number) => {
          const s = normalize(r);
          const dName = String(s.dogname || s.perro || '').trim();
          const dateVal = s.date || s.sessiondate || s['fecha sesión'] || '';

          // CRITICAL: Ignorar filas vacías que no tengan perro ni fecha
          if (!dName || !dateVal) return null;

          // Match Perro
          let dogId = loadedDogs.find(d => d.name.toLowerCase() === dName.toLowerCase())?.id;
          if (!dogId && dName !== '') {
            const tempId = `d-auto-${idx}`;
            const autoAvatar = getDogAvatar(dName);
            loadedDogs.push({ id: tempId, name: dName, breed: 'Detectado', age: 0, level: CertificationLevel.Novice, handlerId: '', avatarUrl: autoAvatar });
            dogId = tempId;
          }

          // Match Entrenador
          const tName = String(s.trainername || s.entrenador || 'Unknown').trim();
          const trainerId = loadedTrainers.find(t => t.name.toLowerCase() === tName.toLowerCase())?.id || 'unknown';

          // Modo
          const modeRaw = String(s.mode || s.modo || 'Entrenamiento').toLowerCase();
          const mode = (modeRaw.includes('muestras') || modeRaw.includes('operational')) ? 'Operational' : 'Training';

          // Numeros
          const cleanNum = (v: any) => Number(String(v).replace(/[^0-9.]/g, '')) || 0;
          const uaC = cleanNum(s.uac || s['ua c']);
          const uaI = cleanNum(s.ual || s.uai || s['ua incorrectas']);

          // Resultados Muestras
          const result = s.result || s.resultado || null;
          let hits = 0, misses = 0, fps = 0;
          if (mode === 'Operational') {
            if (result === 'VP' || result === 'VN') hits = 1;
            if (result === 'FN') misses = 1;
            if (result === 'FP') { misses = 1; fps = 1; }
          } else {
            hits = uaC;
            misses = uaI;
          }

          return {
            id: `s-${idx}`,
            date: parseDate(dateVal),
            dogId: dogId || 'unknown',
            trainerId,
            mode,
            module: s.module || s.modulo || '',
            targetOdor: s.targetodor || s.objetivo || '',
            recordType: s.recordtype || s['tipo registro'] || 'Libre',
            uaC, uaI, hits, misses, falsePositives: fps,
            reinforcer: s.reinforcer || 'Comestible',
            schedule: s.schedule || 'Fijo',
            sampleId: s.sampleid || '',
            position: s.position || '',
            result,
            notes: s.notes || ''
          } as SessionData;
        }).filter(s => s !== null) as SessionData[];

        setSessions(loadedSessions);
        setDogs([...loadedDogs]);
      }

    } catch (e) { console.error(e); } finally { setIsLoading(false); setIsRefreshing(false); }
  };

  useEffect(() => { fetchData(); }, []);

  // --- LÓGICA DE GUARDADO MANUAL (ARRAY ORDENADO) ---
  const handleSaveSessions = (newSessions: SessionData[]) => {
    setSessions(prev => [...newSessions, ...prev]);

    // Creamos la lista de FILAS ya ordenadas
    const rowsToSend = newSessions.map(session => {
      const dogName = dogs.find(d => d.id === session.dogId)?.name || 'Desconocido';
      const trainerName = trainers.find(t => t.id === session.trainerId)?.name || 'Desconocido';
      const modeLabel = session.mode === 'Operational' ? 'Muestras' : 'Entrenamiento';
      const isTraining = session.mode === 'Training';

      // Fecha Manual
      let dateStr = session.date;
      if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [y, m, d] = dateStr.split('-');
        dateStr = `${d}/${m}/${y}`;
      }

      // ARRAY ORDENADO A -> P
      return [
        new Date().toLocaleDateString('es-ES'), // A: registrationDate
        dateStr,                                // B: date
        dogName,                                // C: dogName
        trainerName,                            // D: trainerName
        modeLabel,                              // E: mode

        isTraining ? (session.recordType || "Libre") : "", // F: recordType
        isTraining ? (session.module || "") : "",         // G: module
        isTraining ? (session.targetOdor || "") : "",     // H: targetOdor
        isTraining ? (session.uaC ?? 0) : "",             // I: uaC
        isTraining ? (session.uaI ?? 0) : "",             // J: uaI

        session.reinforcer || "Comestible",     // K: reinforcer
        session.schedule || "Fijo",             // L: schedule

        !isTraining ? (session.sampleId || "") : "",      // M: sampleId
        !isTraining ? (session.position || "") : "",      // N: position
        !isTraining ? (session.result || "") : "",        // O: result

        session.notes || ""                     // P: notes
      ];
    });

    // Enviamos con la acción 'save_raw_sessions'
    fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'save_raw_sessions', rows: rowsToSend })
    }).then(() => {
      alert("✅ Datos guardados correctamente.");
      setTimeout(fetchData, 1500);
    }).catch(() => alert("Error de conexión"));
  };

  const handleAddDog = (newDog: Dog) => {
    setDogs(prev => [...prev, newDog]);
    fetch(GOOGLE_SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ action: 'addDog', payload: newDog }) });
  };

  const handleAddTrainer = (newTrainer: Trainer) => {
    setTrainers(prev => [...prev, newTrainer]);
    fetch(GOOGLE_SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ action: 'addTrainer', payload: newTrainer }) });
  };

  const navItems = [
    { id: Tab.Dashboard, label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { id: Tab.RapidEntry, label: 'Registro Rápido', icon: <PlusCircle size={20} /> },
    { id: Tab.Roster, label: 'Unidad Canina', icon: <PawPrint size={20} /> },
    { id: Tab.Team, label: 'Equipo', icon: <Users size={20} /> },
  ];

  if (isLoading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-bida-base text-bida-navy">
        <Loader2 className="w-12 h-12 animate-spin mb-4 text-bida-orange" />
        <h2 className="text-xl font-black tracking-tight animate-pulse">CARGANDO DATOS...</h2>
        <p className="text-slate-400 text-sm mt-2">Conectando con Google Sheets</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-bida-base overflow-hidden font-sans">

      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-bida-navy text-white shadow-2xl z-10">
        <div className="p-8 flex items-center justify-between">
          <span className="text-4xl font-black text-bida-orange tracking-tight">BIDA</span>
        </div>

        <nav className="flex-1 px-4 py-2 space-y-3">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center space-x-3 px-4 py-3.5 rounded-2xl transition-all duration-300 group ${activeTab === item.id
                ? 'bg-bida-orange text-white shadow-lg shadow-bida-orange/30 translate-x-1'
                : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
            >
              <div className={`${activeTab === item.id ? 'text-white' : 'text-slate-400 group-hover:text-white'}`}>
                {item.icon}
              </div>
              <span className="font-bold tracking-wide text-sm">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Footer Sidebar */}
        <div className="p-4 bg-bida-navy/50">
          <div className="text-[10px] text-slate-400 mb-2 font-numeric text-center">
            Conectado: {sessions.length} sesiones, {dogs.length} perros
          </div>
          <button
            onClick={fetchData}
            disabled={isRefreshing}
            className="w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-2xl border border-white/10 text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
            <span className="font-bold text-xs uppercase tracking-wider">Actualizar</span>
          </button>
        </div>
      </aside>

      {/* Mobile Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <div className="flex justify-around items-center p-2">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center p-2 rounded-xl transition-colors ${activeTab === item.id ? 'text-bida-orange' : 'text-slate-400'
                }`}
            >
              {item.icon}
              <span className="text-[10px] mt-1 font-bold">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="md:hidden fixed top-0 left-0 right-0 bg-bida-navy text-white z-50 h-16 flex items-center justify-between px-6 shadow-md">
        <span className="text-2xl font-black text-bida-orange tracking-tight">BIDA</span>
        <button onClick={fetchData} disabled={isRefreshing}>
          <RefreshCw size={20} className={isRefreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto md:p-8 p-4 pt-20 md:pt-8 pb-24 md:pb-8 bg-bida-base">
        <div className="max-w-7xl mx-auto h-full">
          {activeTab === Tab.Dashboard && (
            <Dashboard sessions={sessions} dogs={dogs} />
          )}

          {activeTab === Tab.RapidEntry && (
            <RapidEntry
              dogs={dogs}
              trainers={trainers}
              currentUser={currentUser}
              onSaveSessions={handleSaveSessions}
            />
          )}

          {activeTab === Tab.Roster && (
            <Roster
              dogs={dogs}
              sessions={sessions}
              trainers={trainers}
              onAddDog={handleAddDog}
            />
          )}

          {activeTab === Tab.Team && (
            <Team
              trainers={trainers}
              sessions={sessions}
              onAddTrainer={handleAddTrainer}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
