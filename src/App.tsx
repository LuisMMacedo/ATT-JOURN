/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kzeeujqyxzgdggxettdu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_A2uSS51a_Maz1-Z-2YXL6g_d0Qnhn_I';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

type Screen = 'SPLASH' | 'AUTH' | 'ONBOARDING' | 'TODAY' | 'RUN' | 'WORKOUT' | 'SLEEP' | 'NUTRITION' | 'ARCHIVE' | 'REPORT' | 'STREAK';

interface DayData {
  run: { km: string; timeMin: string; timeSec: string; pace: string; feeling: number; note: string };
  workout: { type: string; duration: string; intensity: number; exercises: string; note: string };
  sleep: { bed: string; wake: string; duration: string; quality: number; note: string };
  nutrition: { water: number; meals: string[]; rating: number };
}

interface AppData {
  user: { name: string; weight: string; meta_streak: string };
  days: Record<string, DayData>;
  streak: number;
  record: number;
}

const INITIAL_DATA: AppData = {
  user: { name: '', weight: '', meta_streak: '' },
  days: {},
  streak: 0,
  record: 0
};

const STREAK_PHRASES: Record<number, string> = {
  1: "O PRIMEIRO PASSO É O MAIS DIFÍCIL.",
  3: "O RITMO COMEÇA A SE ESTABELECER.",
  7: "7 DIAS. O CORPO COMEÇA A ADAPTAR.",
  14: "DUAS SEMANAS. A DISCIPLINA VENCE A MOTIVAÇÃO.",
  21: "21 DIAS. ISSO AGORA É QUEM VOCÊ É.",
  30: "UM MÊS. VOCÊ É UM ATLETA DA VIDA.",
  60: "60 DIAS. O IMPOSSÍVEL É APENAS UMA OPINIÃO.",
  90: "90 DIAS. LEGADO EM CONSTRUÇÃO."
};

// FIX 1: Correct week date calculation — não muta o objeto Date original
const getWeekDates = (offsetWeeks: number): string[] => {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=dom, 1=seg...
  // Início da semana atual (domingo)
  const startOfWeek = new Date(now);
  startOfWeek.setHours(0, 0, 0, 0);
  startOfWeek.setDate(now.getDate() - dayOfWeek - offsetWeeks * 7);

  return Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    return d.toISOString().split('T')[0];
  });
};

const getWeekNumber = (date: Date): number => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

const getTodayString = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const buildPayload = (userId: string, date: string, day: DayData) => ({
  user_id: userId,
  data: date,
  corrida_km: parseFloat(day.run.km) || null,
  corrida_tempo: `${day.run.timeMin}:${day.run.timeSec}`,
  corrida_pace: day.run.pace,
  corrida_sensacao: day.run.feeling,
  corrida_nota: day.run.note,
  treino_tipo: day.workout.type,
  treino_duracao: parseInt(day.workout.duration) || null,
  treino_intensidade: day.workout.intensity,
  treino_exercicios: day.workout.exercises,
  treino_nota: day.workout.note,
  sono_dormiu: day.sleep.bed,
  sono_acordou: day.sleep.wake,
  sono_duracao: parseFloat(day.sleep.duration) || null,
  sono_qualidade: day.sleep.quality,
  sono_nota: day.sleep.note,
  alimentacao_hidratacao: day.nutrition.water,
  alimentacao_refeicao1: day.nutrition.meals[0],
  alimentacao_refeicao2: day.nutrition.meals[1],
  alimentacao_refeicao3: day.nutrition.meals[2],
  alimentacao_avaliacao: day.nutrition.rating,
});

export default function App() {
  const [screen, setScreen] = useState<Screen>('SPLASH');
  const [user, setUser] = useState<any>(null);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [data, setData] = useState<AppData>(INITIAL_DATA);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [reportWeekOffset, setReportWeekOffset] = useState(0);
  const todayDate = getTodayString();

  // FIX 3: Ref para acessar estado mais recente no onBlur sem stale closure
  const dataRef = useRef(data);
  useEffect(() => { dataRef.current = data; }, [data]);
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  // Custom Cursor
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => setCursorPos({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Auth Listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Fetch Data from Supabase quando user muda
  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      const { data: registros } = await supabase
        .from('registros')
        .select('*')
        .eq('user_id', user.id);

      if (registros) {
        const days: Record<string, DayData> = {};
        registros.forEach((r: any) => {
          days[r.data] = {
            run: {
              km: r.corrida_km?.toString() || '',
              timeMin: r.corrida_tempo?.split(':')[0] || '',
              timeSec: r.corrida_tempo?.split(':')[1] || '',
              pace: r.corrida_pace || '0:00',
              feeling: r.corrida_sensacao || 0,
              note: r.corrida_nota || ''
            },
            workout: {
              type: r.treino_tipo || '',
              duration: r.treino_duracao?.toString() || '',
              intensity: r.treino_intensidade || 0,
              exercises: r.treino_exercicios || '',
              note: r.treino_nota || ''
            },
            sleep: {
              bed: r.sono_dormiu || '23:00',
              wake: r.sono_acordou || '07:00',
              duration: r.sono_duracao?.toString() || '8:00',
              quality: r.sono_qualidade || 0,
              note: r.sono_nota || ''
            },
            nutrition: {
              water: parseFloat(r.alimentacao_hidratacao) || 0,
              meals: [r.alimentacao_refeicao1 || '', r.alimentacao_refeicao2 || '', r.alimentacao_refeicao3 || ''],
              rating: r.alimentacao_avaliacao || 0
            }
          };
        });

        // FIX 2: Calcular streak a partir dos dados do Supabase
        let streak = 0;
        let record = parseInt(user.user_metadata?.record || '0');
        const checkDate = new Date();
        checkDate.setHours(0, 0, 0, 0);

        while (true) {
          const ds = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
          if (days[ds]) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
          } else {
            break;
          }
        }

        record = Math.max(record, streak);

        // Persistir recorde no metadata do usuário se mudou
        if (record > parseInt(user.user_metadata?.record || '0')) {
          await supabase.auth.updateUser({ data: { record: record.toString() } });
        }

        setData(prev => ({
          ...prev,
          user: {
            name: user.user_metadata?.name || '',
            weight: user.user_metadata?.weight || '',
            meta_streak: user.user_metadata?.meta_streak || ''
          },
          days,
          streak,
          record
        }));
      }
    };

    fetchData();
  }, [user]);

  // Splash Screen routing
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!user) {
        setScreen('AUTH');
      } else if (!user.user_metadata?.name) {
        setScreen('ONBOARDING');
      } else {
        setScreen('TODAY');
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [user]);

  const handleAuth = async () => {
    setAuthError('');
    try {
      if (authMode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email: authEmail, password: authPassword });
        if (error) throw error;
      }
    } catch (err: any) {
      setAuthError(err.message.toUpperCase());
    }
  };

  const finishOnboarding = async () => {
    if (user) {
      const { error } = await supabase.auth.updateUser({
        data: { name: data.user.name, weight: data.user.weight, meta_streak: data.user.meta_streak }
      });
      if (!error) setScreen('TODAY');
    }
  };

  const getEmptyDay = (): DayData => ({
    run: { km: '', timeMin: '', timeSec: '', pace: '0:00', feeling: 0, note: '' },
    workout: { type: '', duration: '', intensity: 0, exercises: '', note: '' },
    sleep: { bed: '23:00', wake: '07:00', duration: '8:00', quality: 0, note: '' },
    nutrition: { water: 0, meals: ['', '', ''], rating: 0 }
  });

  const getDayData = (date: string): DayData => data.days[date] || getEmptyDay();

  // FIX 3: updateDayData retorna o novo estado para uso imediato no sync
  const updateDayData = (date: string, updates: Partial<DayData>): DayData => {
    const current = dataRef.current.days[date] || getEmptyDay();
    const updated = { ...current, ...updates };
    setData(prev => ({
      ...prev,
      days: { ...prev.days, [date]: updated }
    }));
    return updated;
  };

  // FIX 3: syncDayData aceita dayData diretamente para evitar stale closure
  const syncDayData = useCallback(async (date: string, dayData?: DayData) => {
    const currentUser = userRef.current;
    if (!currentUser) return;
    const day = dayData || dataRef.current.days[date] || getEmptyDay();
    const payload = buildPayload(currentUser.id, date, day);
    await supabase.from('registros').upsert(payload, { onConflict: 'user_id,data' });
  }, []);

  // Pace Calculation
  const currentDay = getDayData(todayDate);
  useEffect(() => {
    const km = parseFloat(currentDay.run.km);
    const min = parseInt(currentDay.run.timeMin) || 0;
    const sec = parseInt(currentDay.run.timeSec) || 0;
    if (km > 0 && (min > 0 || sec > 0)) {
      const totalMin = min + sec / 60;
      const paceMin = totalMin / km;
      const pM = Math.floor(paceMin);
      const pS = Math.round((paceMin - pM) * 60);
      const paceStr = `${pM}:${pS.toString().padStart(2, '0')}`;
      if (currentDay.run.pace !== paceStr) {
        updateDayData(todayDate, { run: { ...currentDay.run, pace: paceStr } });
      }
    }
  }, [currentDay.run.km, currentDay.run.timeMin, currentDay.run.timeSec]);

  // Sleep Duration Calculation
  useEffect(() => {
    const [bH, bM] = currentDay.sleep.bed.split(':').map(Number);
    const [wH, wM] = currentDay.sleep.wake.split(':').map(Number);
    let diff = (wH * 60 + wM) - (bH * 60 + bM);
    if (diff < 0) diff += 24 * 60;
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    const durStr = `${h}:${m.toString().padStart(2, '0')}`;
    if (currentDay.sleep.duration !== durStr) {
      updateDayData(todayDate, { sleep: { ...currentDay.sleep, duration: durStr } });
    }
  }, [currentDay.sleep.bed, currentDay.sleep.wake]);

  const renderDots = (active: number, onSelect?: (i: number) => void) => (
    <div className="flex gap-2">
      {[1, 2, 3, 4, 5].map(i => (
        <button
          key={i}
          onClick={() => onSelect?.(i)}
          className={`transition-all duration-300 ${i <= active ? 'dot-full' : 'dot-empty'}`}
        />
      ))}
    </div>
  );

  const NavDots = () => (
    <div className="fixed right-4 md:right-8 top-1/2 -translate-y-1/2 flex flex-col gap-3 md:gap-4 z-50">
      {(['TODAY', 'RUN', 'WORKOUT', 'SLEEP', 'NUTRITION', 'ARCHIVE', 'REPORT', 'STREAK'] as Screen[]).map(s => (
        <button
          key={s}
          onClick={() => setScreen(s)}
          className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full border border-white transition-all ${screen === s ? 'bg-white scale-150' : 'bg-transparent'}`}
          title={s}
        />
      ))}
    </div>
  );

  return (
    <div className="min-h-screen font-sans selection:bg-white selection:text-black overflow-x-hidden">
      <div
        id="custom-cursor"
        className="hidden md:block"
        style={{ left: cursorPos.x, top: cursorPos.y, transform: 'translate(-50%, -50%)' }}
      />

      <AnimatePresence mode="wait">

        {/* SPLASH */}
        {screen === 'SPLASH' && (
          <motion.div
            key="splash"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center bg-black z-[100]"
          >
            <div className="w-3 h-3 bg-white rounded-full pulse" />
          </motion.div>
        )}

        {/* AUTH */}
        {screen === 'AUTH' && (
          <motion.div
            key="auth"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex flex-col items-center justify-center p-12 text-center"
          >
            <div className="w-full max-w-sm">
              <h2 className="font-display text-4xl md:text-6xl mb-12 uppercase">ATHLETIC JOURNAL</h2>
              <div className="space-y-6">
                <input
                  type="email"
                  className="w-full bg-transparent border-b border-white/20 py-4 font-sans text-xl placeholder:opacity-20 text-center outline-none"
                  placeholder="EMAIL"
                  value={authEmail}
                  onChange={e => setAuthEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAuth()}
                />
                <input
                  type="password"
                  className="w-full bg-transparent border-b border-white/20 py-4 font-sans text-xl placeholder:opacity-20 text-center outline-none"
                  placeholder="SENHA"
                  value={authPassword}
                  onChange={e => setAuthPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAuth()}
                />
                <button
                  onClick={handleAuth}
                  className="font-display text-2xl md:text-4xl mt-8 uppercase hover:opacity-70 transition-opacity"
                >
                  {authMode === 'login' ? 'ENTRAR' : 'CADASTRAR'}
                </button>
                {authError && <div className="font-mono text-[10px] tracking-widest opacity-70 mt-4">{authError}</div>}
                <button
                  onClick={() => { setAuthMode(prev => prev === 'login' ? 'signup' : 'login'); setAuthError(''); }}
                  className="font-sans text-[10px] tracking-[0.3em] uppercase opacity-30 mt-12 block w-full hover:opacity-60 transition-opacity"
                >
                  {authMode === 'login' ? 'PRIMEIRO ACESSO' : 'JÁ TENHO CONTA'}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ONBOARDING */}
        {screen === 'ONBOARDING' && (
          <motion.div
            key="onboarding"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex flex-col items-center justify-center p-12 text-center"
          >
            {onboardingStep === 0 && (
              <motion.div key="ob0" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
                <label className="font-sans text-[10px] tracking-[0.3em] uppercase opacity-50 mb-4 block">IDENTIDADE</label>
                <input
                  autoFocus
                  className="font-display text-4xl md:text-8xl text-center w-full uppercase bg-transparent border-none outline-none"
                  placeholder="SEU NOME"
                  value={data.user.name}
                  onChange={e => setData(prev => ({ ...prev, user: { ...prev.user, name: e.target.value } }))}
                  onKeyDown={e => e.key === 'Enter' && data.user.name && setOnboardingStep(1)}
                />
                <button onClick={() => data.user.name && setOnboardingStep(1)} className="font-sans text-[10px] tracking-[0.3em] uppercase opacity-30 mt-12 hover:opacity-60 transition-opacity">CONTINUAR →</button>
              </motion.div>
            )}
            {onboardingStep === 1 && (
              <motion.div key="ob1" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
                <label className="font-sans text-[10px] tracking-[0.3em] uppercase opacity-50 mb-4 block">MASSA CORPORAL (KG)</label>
                <input
                  autoFocus
                  className="font-mono text-4xl md:text-8xl text-center w-full bg-transparent border-none outline-none"
                  placeholder="00.0"
                  value={data.user.weight}
                  onChange={e => setData(prev => ({ ...prev, user: { ...prev.user, weight: e.target.value } }))}
                  onKeyDown={e => e.key === 'Enter' && setOnboardingStep(2)}
                />
                <button onClick={() => setOnboardingStep(2)} className="font-sans text-[10px] tracking-[0.3em] uppercase opacity-30 mt-12 hover:opacity-60 transition-opacity">CONTINUAR →</button>
              </motion.div>
            )}
            {onboardingStep === 2 && (
              <motion.div key="ob2" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
                <label className="font-sans text-[10px] tracking-[0.3em] uppercase opacity-50 mb-4 block">META DE STREAK (DIAS)</label>
                <input
                  autoFocus
                  className="font-mono text-4xl md:text-8xl text-center w-full bg-transparent border-none outline-none"
                  placeholder="30"
                  value={data.user.meta_streak}
                  onChange={e => setData(prev => ({ ...prev, user: { ...prev.user, meta_streak: e.target.value } }))}
                  onKeyDown={e => e.key === 'Enter' && finishOnboarding()}
                />
                <button onClick={finishOnboarding} className="font-sans text-[10px] tracking-[0.3em] uppercase opacity-30 mt-12 hover:opacity-60 transition-opacity">COMEÇAR →</button>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* MAIN APP */}
        {screen !== 'SPLASH' && screen !== 'ONBOARDING' && screen !== 'AUTH' && (
          <motion.main
            key={screen}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="p-6 md:p-16 max-w-7xl mx-auto pb-24 md:pb-0"
          >
            <NavDots />

            {/* TODAY */}
            {screen === 'TODAY' && (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-12">
                <header className="md:col-span-12 mb-4 md:mb-8">
                  <h1 className="font-display text-6xl md:text-[120px] leading-[0.85] uppercase">
                    {new Date().toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '').toUpperCase()} {new Date().getDate()}
                  </h1>
                </header>

                <section className="md:col-span-8 glass p-8 md:p-12 min-h-[280px] md:min-h-[380px] flex flex-col justify-between cursor-pointer hover:border-white/30 transition-colors" onClick={() => setScreen('RUN')}>
                  <div>
                    <span className="font-sans text-[10px] tracking-[0.3em] uppercase opacity-50">CORRIDA</span>
                    <div className="mt-4 flex items-center gap-4">
                      <div className={currentDay.run.km ? 'dot-full' : 'dot-empty'} />
                      <span className="font-mono text-5xl md:text-6xl">{currentDay.run.km || '0.0'} KM</span>
                    </div>
                  </div>
                  <div className="font-mono text-lg md:text-xl opacity-30">PACE {currentDay.run.pace}</div>
                </section>

                <section className="md:col-span-4 glass p-8 md:p-12 flex flex-col justify-between cursor-pointer hover:border-white/30 transition-colors" onClick={() => setScreen('WORKOUT')}>
                  <div>
                    <span className="font-sans text-[10px] tracking-[0.3em] uppercase opacity-50">TREINO</span>
                    <div className="mt-4 flex items-center gap-4">
                      <div className={currentDay.workout.duration ? 'dot-full' : 'dot-empty'} />
                      <span className="font-mono text-3xl md:text-4xl">{currentDay.workout.duration || '0'} MIN</span>
                    </div>
                  </div>
                  <div className="font-mono text-xs md:text-sm opacity-30 uppercase">{currentDay.workout.type || 'NENHUM'}</div>
                </section>

                <section className="md:col-span-4 glass p-8 md:p-12 flex flex-col justify-between cursor-pointer hover:border-white/30 transition-colors" onClick={() => setScreen('SLEEP')}>
                  <div>
                    <span className="font-sans text-[10px] tracking-[0.3em] uppercase opacity-50">SONO</span>
                    <div className="mt-4 flex items-center gap-4">
                      <div className={currentDay.sleep.quality > 0 ? 'dot-full' : 'dot-empty'} />
                      <span className="font-mono text-3xl md:text-4xl">{currentDay.sleep.duration.split(':')[0]}H</span>
                    </div>
                  </div>
                  <div className="font-mono text-xs md:text-sm opacity-30">{currentDay.sleep.bed} — {currentDay.sleep.wake}</div>
                </section>

                <section className="md:col-span-8 glass p-8 md:p-12 flex flex-col justify-between cursor-pointer hover:border-white/30 transition-colors" onClick={() => setScreen('NUTRITION')}>
                  <div>
                    <span className="font-sans text-[10px] tracking-[0.3em] uppercase opacity-50">ALIMENTAÇÃO</span>
                    <div className="mt-4 flex items-center gap-4">
                      <div className={currentDay.nutrition.water > 0 ? 'dot-full' : 'dot-empty'} />
                      <span className="font-mono text-3xl md:text-4xl">{currentDay.nutrition.water.toFixed(1)}L H2O</span>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    {currentDay.nutrition.meals.map((m, i) => (
                      <div key={i} className={`w-2 h-2 rounded-full ${m ? 'bg-white' : 'border border-white/30'}`} />
                    ))}
                  </div>
                </section>

                <footer className="md:col-span-12 mt-4 md:mt-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 cursor-pointer" onClick={() => setScreen('STREAK')}>
                  <div className="font-mono text-xl md:text-2xl flex items-center gap-4">
                    <div className="dot-full" /> {data.streak} DIAS
                  </div>
                  <div className="font-sans text-[10px] tracking-[0.3em] uppercase opacity-30">
                    {data.user.name} / {data.user.weight}KG
                  </div>
                </footer>
              </div>
            )}

            {/* RUN */}
            {screen === 'RUN' && (
              <div className="max-w-4xl">
                <label className="font-sans text-[10px] tracking-[0.3em] uppercase opacity-50 mb-8 block">CORRIDA</label>
                <div className="flex flex-col md:flex-row items-baseline gap-4 mb-12">
                  <input
                    autoFocus
                    className="font-mono text-8xl md:text-[160px] leading-none w-full md:w-[400px] bg-transparent border-none outline-none"
                    placeholder="0.0"
                    value={currentDay.run.km}
                    onChange={e => updateDayData(todayDate, { run: { ...currentDay.run, km: e.target.value } })}
                    onBlur={() => syncDayData(todayDate)}
                  />
                  <span className="font-display text-2xl md:text-4xl uppercase opacity-50">KM</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 mb-12">
                  <div>
                    <label className="font-sans text-[10px] tracking-[0.3em] uppercase opacity-50 mb-4 block">TEMPO</label>
                    <div className="flex items-center gap-2 font-mono text-5xl md:text-6xl">
                      <input
                        className="w-16 md:w-20 text-center bg-transparent border-none outline-none"
                        placeholder="00"
                        value={currentDay.run.timeMin}
                        onChange={e => updateDayData(todayDate, { run: { ...currentDay.run, timeMin: e.target.value } })}
                        onBlur={() => syncDayData(todayDate)}
                      />
                      <span className="opacity-30">:</span>
                      <input
                        className="w-16 md:w-20 text-center bg-transparent border-none outline-none"
                        placeholder="00"
                        value={currentDay.run.timeSec}
                        onChange={e => updateDayData(todayDate, { run: { ...currentDay.run, timeSec: e.target.value } })}
                        onBlur={() => syncDayData(todayDate)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="font-sans text-[10px] tracking-[0.3em] uppercase opacity-50 mb-4 block">PACE /KM</label>
                    <div className="font-mono text-5xl md:text-6xl opacity-70">{currentDay.run.pace}</div>
                  </div>
                </div>

                <div className="mb-12">
                  <label className="font-sans text-[10px] tracking-[0.3em] uppercase opacity-50 mb-6 block">SENSAÇÃO</label>
                  {renderDots(currentDay.run.feeling, (i) => {
                    const updated = updateDayData(todayDate, { run: { ...currentDay.run, feeling: i } });
                    syncDayData(todayDate, updated);
                  })}
                </div>

                <textarea
                  className="w-full border-b border-white/20 py-4 font-sans text-xl placeholder:opacity-20 bg-transparent outline-none resize-none"
                  placeholder="NOTAS DA SESSÃO..."
                  rows={2}
                  value={currentDay.run.note}
                  onChange={e => updateDayData(todayDate, { run: { ...currentDay.run, note: e.target.value } })}
                  onBlur={() => syncDayData(todayDate)}
                />
              </div>
            )}

            {/* WORKOUT */}
            {screen === 'WORKOUT' && (
              <div className="max-w-4xl">
                <label className="font-sans text-[10px] tracking-[0.3em] uppercase opacity-50 mb-8 block">TREINO</label>

                <div className="flex flex-wrap gap-8 mb-12">
                  {['FORÇA', 'HIIT', 'MOBILIDADE', 'YOGA', 'OUTRO'].map(t => (
                    <button
                      key={t}
                      onClick={() => {
                        const updated = updateDayData(todayDate, { workout: { ...currentDay.workout, type: t } });
                        syncDayData(todayDate, updated);
                      }}
                      className="flex items-center gap-3"
                    >
                      <div className={`w-3 h-3 rounded-full border border-white transition-all ${currentDay.workout.type === t ? 'bg-white scale-125' : 'bg-transparent'}`} />
                      <span className={`font-sans text-xs tracking-[0.2em] uppercase transition-opacity ${currentDay.workout.type === t ? 'opacity-100' : 'opacity-40'}`}>{t}</span>
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-12 mb-12">
                  <div>
                    <label className="font-sans text-[10px] tracking-[0.3em] uppercase opacity-50 mb-4 block">DURAÇÃO (MIN)</label>
                    <input
                      className="font-mono text-8xl w-full bg-transparent border-none outline-none"
                      placeholder="00"
                      value={currentDay.workout.duration}
                      onChange={e => updateDayData(todayDate, { workout: { ...currentDay.workout, duration: e.target.value } })}
                      onBlur={() => syncDayData(todayDate)}
                    />
                  </div>
                  <div>
                    <label className="font-sans text-[10px] tracking-[0.3em] uppercase opacity-50 mb-4 block">INTENSIDADE</label>
                    <div className="mt-8">
                      {renderDots(currentDay.workout.intensity, (i) => {
                        const updated = updateDayData(todayDate, { workout: { ...currentDay.workout, intensity: i } });
                        syncDayData(todayDate, updated);
                      })}
                    </div>
                  </div>
                </div>

                <div className="mb-12">
                  <label className="font-sans text-[10px] tracking-[0.3em] uppercase opacity-50 mb-4 block">EXERCÍCIOS</label>
                  <textarea
                    className="w-full border-b border-white/20 py-4 font-sans text-xl placeholder:opacity-20 bg-transparent outline-none resize-none"
                    placeholder="LISTE SEU TREINO..."
                    rows={3}
                    value={currentDay.workout.exercises}
                    onChange={e => updateDayData(todayDate, { workout: { ...currentDay.workout, exercises: e.target.value } })}
                    onBlur={() => syncDayData(todayDate)}
                  />
                </div>

                <textarea
                  className="w-full border-b border-white/20 py-4 font-sans text-xl placeholder:opacity-20 bg-transparent outline-none resize-none"
                  placeholder="NOTAS ADICIONAIS..."
                  rows={2}
                  value={currentDay.workout.note}
                  onChange={e => updateDayData(todayDate, { workout: { ...currentDay.workout, note: e.target.value } })}
                  onBlur={() => syncDayData(todayDate)}
                />
              </div>
            )}

            {/* SLEEP */}
            {screen === 'SLEEP' && (
              <div className="max-w-4xl text-center">
                <label className="font-sans text-[10px] tracking-[0.3em] uppercase opacity-50 mb-16 block">SONO</label>

                <div className="flex flex-col md:flex-row items-center justify-between gap-12 mb-20">
                  <div className="text-center md:text-left">
                    <label className="font-sans text-[10px] tracking-[0.3em] uppercase opacity-30 mb-4 block">DORMIU</label>
                    <input
                      type="time"
                      className="font-mono text-5xl md:text-6xl bg-transparent border-none outline-none"
                      value={currentDay.sleep.bed}
                      onChange={e => updateDayData(todayDate, { sleep: { ...currentDay.sleep, bed: e.target.value } })}
                      onBlur={() => syncDayData(todayDate)}
                    />
                  </div>

                  <div className="flex flex-col items-center">
                    <span className="font-mono text-8xl md:text-[160px] leading-none">{currentDay.sleep.duration.split(':')[0]}</span>
                    <span className="font-sans text-[10px] tracking-[0.5em] uppercase opacity-50 mt-2">HORAS TOTAIS</span>
                  </div>

                  <div className="text-center md:text-right">
                    <label className="font-sans text-[10px] tracking-[0.3em] uppercase opacity-30 mb-4 block">ACORDOU</label>
                    <input
                      type="time"
                      className="font-mono text-5xl md:text-6xl bg-transparent border-none outline-none"
                      value={currentDay.sleep.wake}
                      onChange={e => updateDayData(todayDate, { sleep: { ...currentDay.sleep, wake: e.target.value } })}
                      onBlur={() => syncDayData(todayDate)}
                    />
                  </div>
                </div>

                <div className="mb-12 flex flex-col items-center">
                  <label className="font-sans text-[10px] tracking-[0.3em] uppercase opacity-50 mb-6 block">QUALIDADE</label>
                  {renderDots(currentDay.sleep.quality, (i) => {
                    const updated = updateDayData(todayDate, { sleep: { ...currentDay.sleep, quality: i } });
                    syncDayData(todayDate, updated);
                  })}
                </div>

                <textarea
                  className="w-full border-b border-white/20 py-4 font-sans text-xl text-center placeholder:opacity-20 bg-transparent outline-none resize-none"
                  placeholder="NOTAS SOBRE O DESCANSO..."
                  rows={2}
                  value={currentDay.sleep.note}
                  onChange={e => updateDayData(todayDate, { sleep: { ...currentDay.sleep, note: e.target.value } })}
                  onBlur={() => syncDayData(todayDate)}
                />
              </div>
            )}

            {/* NUTRITION */}
            {screen === 'NUTRITION' && (
              <div className="max-w-4xl">
                <label className="font-sans text-[10px] tracking-[0.3em] uppercase opacity-50 mb-16 block">ALIMENTAÇÃO</label>

                <div className="flex items-center justify-between mb-16 glass p-8 md:p-12">
                  <button
                    className="font-mono text-4xl md:text-6xl opacity-30 hover:opacity-100 transition-opacity"
                    onClick={() => {
                      const newVal = Math.max(0, parseFloat((currentDay.nutrition.water - 0.25).toFixed(2)));
                      const updated = updateDayData(todayDate, { nutrition: { ...currentDay.nutrition, water: newVal } });
                      syncDayData(todayDate, updated);
                    }}
                  >—</button>
                  <div className="text-center">
                    <span className="font-mono text-7xl md:text-9xl">{currentDay.nutrition.water.toFixed(1)}</span>
                    <span className="font-display text-2xl md:text-4xl ml-2 md:ml-4 opacity-50">L</span>
                  </div>
                  <button
                    className="font-mono text-4xl md:text-6xl opacity-30 hover:opacity-100 transition-opacity"
                    onClick={() => {
                      const newVal = parseFloat((currentDay.nutrition.water + 0.25).toFixed(2));
                      const updated = updateDayData(todayDate, { nutrition: { ...currentDay.nutrition, water: newVal } });
                      syncDayData(todayDate, updated);
                    }}
                  >+</button>
                </div>

                <div className="space-y-10 mb-20">
                  {currentDay.nutrition.meals.map((meal, i) => (
                    <div key={i} className="flex gap-8 items-start">
                      <span className="font-mono text-xl opacity-20 pt-2">0{i + 1}</span>
                      <textarea
                        className="flex-1 border-b border-white/20 py-2 font-sans text-2xl placeholder:opacity-10 bg-transparent outline-none resize-none"
                        placeholder="REFEIÇÃO..."
                        rows={1}
                        value={meal}
                        onChange={e => {
                          const newMeals = [...currentDay.nutrition.meals];
                          newMeals[i] = e.target.value;
                          updateDayData(todayDate, { nutrition: { ...currentDay.nutrition, meals: newMeals } });
                        }}
                        onBlur={() => syncDayData(todayDate)}
                      />
                    </div>
                  ))}
                </div>

                <div className="flex flex-col items-center">
                  <label className="font-sans text-[10px] tracking-[0.3em] uppercase opacity-50 mb-6 block">AVALIAÇÃO DO DIA</label>
                  {renderDots(currentDay.nutrition.rating, (i) => {
                    const updated = updateDayData(todayDate, { nutrition: { ...currentDay.nutrition, rating: i } });
                    syncDayData(todayDate, updated);
                  })}
                </div>
              </div>
            )}

            {/* ARCHIVE */}
            {screen === 'ARCHIVE' && (
              <div>
                <label className="font-sans text-[10px] tracking-[0.3em] uppercase opacity-50 mb-12 block">HISTÓRICO · 60 DIAS</label>
                <div className="grid grid-cols-5 md:grid-cols-10 gap-6 md:gap-10">
                  {Array.from({ length: 60 }).map((_, i) => {
                    const d = new Date();
                    d.setDate(d.getDate() - (59 - i));
                    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                    const day = data.days[dateStr];

                    let status: 'empty' | 'partial' | 'full' = 'empty';
                    if (day) {
                      const count = [
                        parseFloat(day.run.km) > 0,
                        parseInt(day.workout.duration) > 0,
                        day.nutrition.water > 0,
                        day.sleep.quality > 0
                      ].filter(Boolean).length;
                      if (count === 4) status = 'full';
                      else if (count > 0) status = 'partial';
                    }

                    return (
                      <div key={i} className="group relative flex flex-col items-center">
                        <div className={`scale-150 cursor-pointer hover:scale-[2] transition-transform ${status === 'full' ? 'dot-full' : status === 'partial' ? 'dot-partial' : 'dot-empty'}`} />
                        <div className="absolute bottom-full mb-4 hidden group-hover:flex flex-col glass p-3 z-50 min-w-[140px] left-1/2 -translate-x-1/2">
                          <div className="font-mono text-[9px] mb-2 opacity-50">{dateStr}</div>
                          {day ? (
                            <div className="font-mono text-[9px] space-y-1 opacity-70">
                              <div>RUN: {day.run.km || '0'}KM</div>
                              <div>WORK: {day.workout.duration || '0'}M</div>
                              <div>H2O: {day.nutrition.water.toFixed(1)}L</div>
                              <div>SONO: {day.sleep.duration.split(':')[0]}H</div>
                            </div>
                          ) : (
                            <div className="font-mono text-[9px] opacity-30 italic">SEM REGISTROS</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* FIX 1: REPORT com cálculo de semana correto */}
            {screen === 'REPORT' && (() => {
              const weekDates = getWeekDates(reportWeekOffset);
              const prevWeekDates = getWeekDates(reportWeekOffset + 1);
              const refDate = new Date(weekDates[0]);

              const pilares = [
                {
                  label: 'CORRIDA',
                  unit: 'KM',
                  getValue: (d: DayData | undefined) => parseFloat(d?.run.km || '0') || 0,
                },
                {
                  label: 'TREINO',
                  unit: 'MIN',
                  getValue: (d: DayData | undefined) => parseInt(d?.workout.duration || '0') || 0,
                },
                {
                  label: 'SONO',
                  unit: 'H',
                  getValue: (d: DayData | undefined) => parseFloat(d?.sleep.duration?.split(':')[0] || '0') || 0,
                },
                {
                  label: 'ÁGUA',
                  unit: 'L',
                  getValue: (d: DayData | undefined) => d?.nutrition.water || 0,
                },
              ];

              return (
                <div className="max-w-6xl mx-auto">
                  <header className="flex flex-col md:flex-row justify-between items-baseline mb-12 gap-4">
                    <h1 className="font-display text-3xl md:text-5xl uppercase">
                      SEMANA {getWeekNumber(refDate)} · {refDate.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase().replace('.', '')} {refDate.getFullYear()}
                    </h1>
                    <div className="flex gap-8 font-sans text-[10px] tracking-[0.3em] uppercase opacity-40">
                      <button onClick={() => setReportWeekOffset(prev => prev + 1)} className="hover:opacity-100 transition-opacity">← ANTERIOR</button>
                      {reportWeekOffset > 0 && (
                        <button onClick={() => setReportWeekOffset(prev => prev - 1)} className="hover:opacity-100 transition-opacity">SEGUINTE →</button>
                      )}
                    </div>
                  </header>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                    {pilares.map(pilar => {
                      const weekValues = weekDates.map(d => pilar.getValue(data.days[d]));
                      const prevValues = prevWeekDates.map(d => pilar.getValue(data.days[d]));
                      const avg = weekValues.reduce((a, b) => a + b, 0) / 7;
                      const prevAvg = prevValues.reduce((a, b) => a + b, 0) / 7;
                      const diff = avg - prevAvg;
                      const hasData = weekValues.some(v => v > 0);

                      return (
                        <div key={pilar.label} className="glass p-6 md:p-8 flex flex-col justify-between min-h-[220px] md:min-h-[280px]">
                          <div>
                            <span className="font-sans text-[10px] tracking-[0.3em] uppercase opacity-40">{pilar.label}</span>
                            <div className="flex gap-1.5 mt-5 flex-wrap">
                              {weekDates.map((d, i) => {
                                const val = pilar.getValue(data.days[d]);
                                return (
                                  <div key={i} className={`w-1.5 h-1.5 rounded-full ${val > 0 ? 'bg-white' : 'border border-white/20'}`} title={['D','S','T','Q','Q','S','S'][i]} />
                                );
                              })}
                            </div>
                          </div>
                          <div>
                            <div className="font-mono text-2xl md:text-4xl mb-2">
                              {avg.toFixed(1)} <span className="text-sm opacity-40">{pilar.unit}/DIA</span>
                            </div>
                            {prevAvg > 0 && (
                              <div className="font-mono text-[9px] md:text-[10px] opacity-40">
                                {diff >= 0 ? '+' : ''}{diff.toFixed(1)} {pilar.unit} VS SEMANA ANTERIOR
                              </div>
                            )}
                            {!hasData && (
                              <div className="font-mono text-[9px] opacity-20">SEM DADOS</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* STREAK */}
            {screen === 'STREAK' && (
              <div className="fixed inset-0 flex flex-col items-center justify-center p-8 md:p-12 text-center pointer-events-none">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 100 }}
                  className="mb-8 md:mb-12"
                >
                  <span className="font-mono text-9xl md:text-[240px] leading-none">{data.streak}</span>
                  <div className="font-sans text-[10px] tracking-[0.5em] md:tracking-[1em] uppercase opacity-50 mt-4">DIAS CONSECUTIVOS</div>
                </motion.div>

                <div className="space-y-4">
                  <div className="font-mono text-xs md:text-sm opacity-30">RECORDE PESSOAL: {data.record} DIAS</div>
                  {data.user.meta_streak && (
                    <div className="font-mono text-[10px] opacity-20">META: {data.user.meta_streak} DIAS</div>
                  )}
                  <div className="font-display text-xl md:text-2xl max-w-md mx-auto leading-tight mt-8">
                    {data.streak === 0
                      ? "COMEÇE HOJE."
                      : STREAK_PHRASES[
                          Object.keys(STREAK_PHRASES)
                            .map(Number)
                            .filter(n => n <= data.streak)
                            .pop() || 1
                        ]}
                  </div>
                </div>
              </div>
            )}

          </motion.main>
        )}
      </AnimatePresence>
    </div>
  );
}