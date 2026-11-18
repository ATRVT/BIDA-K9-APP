
import React, { useState, useEffect } from 'react';
import { LayoutDashboard, PlusCircle, Users, PawPrint, Menu, X, Loader2, RefreshCw, LogOut, Smartphone } from 'lucide-react';
import { Dashboard } from './components/Dashboard';
import { RapidEntry } from './components/RapidEntry';
import { Roster } from './components/Roster';
import { Team } from './components/Team';
import { SessionData, Dog, Trainer, CertificationLevel } from './types';
import { GOOGLE_SCRIPT_URL, MOCK_DOGS, MOCK_TRAINERS, getDogAvatar, getTrainerAvatar } from './constants';
import { isOperationalSessionSuccess, isOperationalSessionFailure } from './planner';

// --- CONFIGURACIÓN ---
// URL moved to constants.ts

enum Tab {
  Dashboard = 'dashboard',
  RapidEntry = 'rapidEntry',
  Roster = 'roster',
  Team = 'team',
}

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.RapidEntry);

  // ESTADOS (Datos) - Inicializados con respaldo local/base para disponibilidad inmediata
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [dogs, setDogs] = useState<Dog[]>(() => {
    try {
      const saved = localStorage.getItem('bida.dogs');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return MOCK_DOGS;
  });
  const [trainers, setTrainers] = useState<Trainer[]>(() => {
    try {
      const saved = localStorage.getItem('bida.trainers');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return MOCK_TRAINERS;
  });
  const [currentUser, setCurrentUser] = useState<Trainer | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<any>(null);
  const [showInstallHelp, setShowInstallHelp] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      setDeferredInstallPrompt(null);
    } else {
      setShowInstallHelp(true);
    }
  };

  // Helper fechas
  const parseDate = (dateStr: any): string => {
    if (!dateStr) return new Date().toISOString();
    
    // Si ya es un objeto Date
    if (dateStr instanceof Date) {
      const d = new Date(Date.UTC(dateStr.getFullYear(), dateStr.getMonth(), dateStr.getDate(), 12, 0, 0));
      return d.toISOString();
    }

    const s = String(dateStr).trim();
    if (!s) return new Date().toISOString();
    
    // Si ya incluye T, asumimos que es ISO, pero vamos a forzar mediodía UTC 
    // para que sea consistente si solo tenía fecha originalmente
    if (s.includes('T')) {
      const d = new Date(s);
      const forced = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0));
      return forced.toISOString();
    }

    let day, month, year;

    // Caso DD/MM/YYYY
    if (s.includes('/')) {
      const parts = s.split('/');
      if (parts.length === 3) {
        day = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10) - 1;
        year = parseInt(parts[2], 10);
      }
    } 
    // Caso YYYY-MM-DD o DD-MM-YYYY
    else if (s.includes('-')) {
      const parts = s.split('-');
      if (parts.length === 3) {
        if (parts[0].length === 4) { // YYYY-MM-DD
          year = parseInt(parts[0], 10);
          month = parseInt(parts[1], 10) - 1;
          day = parseInt(parts[2], 10);
        } else { // DD-MM-YYYY
          day = parseInt(parts[0], 10);
          month = parseInt(parts[1], 10) - 1;
          year = parseInt(parts[2], 10);
        }
      }
    }

    if (year !== undefined && month !== undefined && day !== undefined && !isNaN(year) && !isNaN(month) && !isNaN(day)) {
      // FIX CRÍTICO: Crear fecha en UTC a las 12:00:00 para que al convertirla a local
      // en cualquier zona horaria razonable (de UTC-11 a UTC+12) siga siendo el mismo día.
      const d = new Date(Date.UTC(year, month, day, 12, 0, 0));
      return d.toISOString();
    }

    // Fallback: tratar de parsear lo que sea, pero re-normalizar a mediodía UTC
    try {
      const d = new Date(s);
      if (!isNaN(d.getTime())) {
        const forced = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0));
        return forced.toISOString();
      }
    } catch (e) {}

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
        if (loadedDogs.length > 0) {
          setDogs(loadedDogs);
          try { localStorage.setItem('bida.dogs', JSON.stringify(loadedDogs)); } catch {}
        } else {
          loadedDogs = [...MOCK_DOGS];
        }
      } else {
        loadedDogs = [...MOCK_DOGS];
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
        if (loadedTrainers.length > 0) {
          setTrainers(loadedTrainers);
          try { localStorage.setItem('bida.trainers', JSON.stringify(loadedTrainers)); } catch {}
        } else {
          loadedTrainers = [...MOCK_TRAINERS];
        }
      } else {
        loadedTrainers = [...MOCK_TRAINERS];
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
            const opRecord = { result, notes: s.notes || '', position: s.position || '' };
            if (isOperationalSessionSuccess(opRecord)) hits = 1;
            if (isOperationalSessionFailure(opRecord)) misses = 1;
            if (result === 'FP') fps = 1;
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

  const handleSaveSessions = (newSessions: SessionData[]) => {
    // Normalizar fechas de las nuevas sesiones antes de guardarlas en el estado local
    const normalizedNewSessions = newSessions.map(s => ({
      ...s,
      date: parseDate(s.date)
    }));
    setSessions(prev => [...normalizedNewSessions, ...prev]);

    // Creamos la lista de FILAS ya ordenadas
    const rowsToSend = newSessions.map(session => {
      const dogName = dogs.find(d => d.id === session.dogId)?.name || 'Desconocido';
      const trainerName = trainers.find(t => t.id === session.trainerId)?.name || 'Desconocido';
      const modeLabel = session.mode === 'Operational' ? 'Muestras' : 'Entrenamiento';
      const isTraining = session.mode === 'Training';

      // Fecha Manual: Convertir de ISO o YYYY-MM-DD a DD/MM/YYYY para Google Sheets
      let dateStr = session.date;
      if (dateStr.includes('T')) {
        const dObj = new Date(dateStr);
        const dd = String(dObj.getUTCDate()).padStart(2, '0');
        const mm = String(dObj.getUTCMonth() + 1).padStart(2, '0');
        const yyyy = dObj.getUTCFullYear();
        dateStr = `${dd}/${mm}/${yyyy}`;
      } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
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
        session.uaC ?? 0,                                 // I: uaC
        session.uaI ?? 0,                                 // J: uaI

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
        <div className="p-4 bg-bida-navy/50 space-y-2">
          <div className="text-[10px] text-slate-400 mb-1 font-numeric text-center">
            Conectado: {sessions.length} sesiones, {dogs.length} perros
          </div>
          <button
            onClick={handleInstallClick}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 rounded-2xl bg-bida-orange/20 border border-bida-orange/40 text-bida-orange hover:bg-bida-orange hover:text-white transition-colors"
          >
            <Smartphone size={15} />
            <span className="font-bold text-xs uppercase tracking-wider">Instalar en Móvil</span>
          </button>
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
        <div className="flex items-center space-x-3">
          <button
            onClick={handleInstallClick}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-bida-orange/20 border border-bida-orange/40 text-bida-orange text-xs font-bold"
            title="Instalar aplicación en el teléfono"
          >
            <Smartphone size={15} />
            <span>App</span>
          </button>
          <button onClick={fetchData} disabled={isRefreshing}>
            <RefreshCw size={20} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Modal de instrucciones para instalar como App nativa (PWA) */}
      {showInstallHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2.5">
                <div className="w-10 h-10 rounded-2xl bg-bida-orange/15 text-bida-orange flex items-center justify-center">
                  <Smartphone size={20} />
                </div>
                <h3 className="text-lg font-black text-bida-navy">Tener BIDA como App en tu móvil</h3>
              </div>
              <button onClick={() => setShowInstallHelp(false)} className="text-slate-400 hover:text-slate-700">
                <X size={20} />
              </button>
            </div>
            <p className="text-xs text-slate-600 mb-4">
              Puedes instalar esta aplicación directamente en la pantalla de inicio de tu teléfono. Se abrirá con su propio icono y a pantalla completa, sin necesidad de entrar al navegador ni escribir enlaces:
            </p>
            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="font-black text-bida-navy mb-1">📱 En iPhone / iPad (Safari):</div>
                <ol className="list-decimal list-inside space-y-1 text-slate-600">
                  <li>Abre la app una sola vez en <b>Safari</b>.</li>
                  <li>Toca el botón <b>Compartir</b> (el cuadrado con la flecha hacia arriba en la barra inferior).</li>
                  <li>Elige <b>"Añadir a pantalla de inicio"</b> y pulsa <b>Añadir</b>.</li>
                </ol>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="font-black text-bida-navy mb-1">🤖 En Android (Chrome):</div>
                <ol className="list-decimal list-inside space-y-1 text-slate-600">
                  <li>Abre la app una sola vez en <b>Chrome</b>.</li>
                  <li>Toca el menú de <b>tres puntos (⋮)</b> arriba a la derecha.</li>
                  <li>Pulsa <b>"Instalar aplicación"</b> o <b>"Añadir a pantalla de inicio"</b>.</li>
                </ol>
              </div>
            </div>
            <button
              onClick={() => setShowInstallHelp(false)}
              className="mt-5 w-full py-3 rounded-xl bg-bida-navy text-white font-bold text-xs hover:bg-[#003366] transition-colors"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

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
