/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';

type Screen = 'SPLASH' | 'ONBOARDING' | 'TODAY' | 'RUN' | 'WORKOUT' | 'SLEEP' | 'NUTRITION' | 'ARCHIVE' | 'STREAK';

interface DayData {
  run: { km: string; timeMin: string; timeSec: string; pace: string; feeling: number; note: string };
  workout: { type: string; duration: string; intensity: number; exercises: string; note: string };
  sleep: { bed: string; wake: string; duration: string; quality: number; note: string };
  nutrition: { water: number; meals: string[]; rating: number };
}

interface AppData {
  user: { name: string; weight: string; goal: string };
  days: Record<string, DayData>;
  streak: number;
  record: number;
}

const INITIAL_DATA: AppData = {
  user: { name: '', weight: '', goal: '' },
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

export default function App() {
  const [screen, setScreen] = useState<Screen>('SPLASH');
  const [data, setData] = useState<AppData>(() => {
    const saved = localStorage.getItem('athletic_journal_data');
    return saved ? JSON.parse(saved) : INITIAL_DATA;
  });
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [todayDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Custom Cursor
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setCursorPos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Persistence
  useEffect(() => {
    localStorage.setItem('athletic_journal_data', JSON.stringify(data));
  }, [data]);

  // Splash Screen
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!data.user.name) {
        setScreen('ONBOARDING');
      } else {
        setScreen('TODAY');
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [data.user.name]);

  const getDayData = (date: string): DayData => {
    return data.days[date] || {
      run: { km: '', timeMin: '', timeSec: '', pace: '0:00', feeling: 0, note: '' },
      workout: { type: '', duration: '', intensity: 0, exercises: '', note: '' },
      sleep: { bed: '23:00', wake: '07:00', duration: '8:00', quality: 0, note: '' },
      nutrition: { water: 0, meals: ['', '', ''], rating: 0 }
    };
  };

  const updateDayData = (date: string, updates: Partial<DayData>) => {
    setData(prev => ({
      ...prev,
      days: {
        ...prev.days,
        [date]: { ...getDayData(date), ...updates }
      }
    }));
  };

  const currentDay = getDayData(todayDate);

  // Pace Calculation
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

  // Sleep Calculation
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

  // Streak Calculation (Simplified)
  useEffect(() => {
    const dates = Object.keys(data.days).sort();
    if (dates.length === 0) return;
    
    let currentStreak = 0;
    const today = new Date(todayDate);
    let checkDate = new Date(today);

    while (true) {
      const dateStr = checkDate.toISOString().split('T')[0];
      if (data.days[dateStr]) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    if (currentStreak !== data.streak) {
      setData(prev => ({
        ...prev,
        streak: currentStreak,
        record: Math.max(prev.record, currentStreak)
      }));
    }
  }, [data.days]);

  const renderDots = (count: number, active: number, onSelect?: (i: number) => void) => (
    <div className="flex gap-2">
      {[1, 2, 3, 4, 5].map(i => (
        <button
          key={i}
          onClick={() => onSelect?.(i)}
          className={`transition-all duration-400 ${i <= active ? 'dot-full' : 'dot-empty'}`}
        />
      ))}
    </div>
  );

  const NavDots = () => (
    <div className="fixed right-4 md:right-8 top-1/2 -translate-y-1/2 flex flex-col gap-3 md:gap-4 z-50">
      {(['TODAY', 'RUN', 'WORKOUT', 'SLEEP', 'NUTRITION', 'ARCHIVE', 'STREAK'] as Screen[]).map(s => (
        <button
          key={s}
          onClick={() => setScreen(s)}
          className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full border border-white transition-all ${screen === s ? 'bg-white scale-150' : 'bg-transparent'}`}
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

        {screen === 'ONBOARDING' && (
          <motion.div
            key="onboarding"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex flex-col items-center justify-center p-12 text-center"
          >
            {onboardingStep === 0 && (
              <motion.div initial={{ y: 20 }} animate={{ y: 0 }}>
                <label className="font-sans text-[10px] tracking-[0.3em] uppercase opacity-50 mb-4 block">IDENTIDADE</label>
                <input
                  autoFocus
                  className="font-display text-4xl md:text-8xl text-center w-full uppercase"
                  placeholder="SEU NOME"
                  value={data.user.name}
                  onChange={e => setData(prev => ({ ...prev, user: { ...prev.user, name: e.target.value } }))}
                  onKeyDown={e => e.key === 'Enter' && setOnboardingStep(1)}
                />
              </motion.div>
            )}
            {onboardingStep === 1 && (
              <motion.div initial={{ y: 20 }} animate={{ y: 0 }}>
                <label className="font-sans text-[10px] tracking-[0.3em] uppercase opacity-50 mb-4 block">MASSA CORPORAL (KG)</label>
                <input
                  autoFocus
                  className="font-mono text-4xl md:text-8xl text-center w-full"
                  placeholder="00.0"
                  value={data.user.weight}
                  onChange={e => setData(prev => ({ ...prev, user: { ...prev.user, weight: e.target.value } }))}
                  onKeyDown={e => e.key === 'Enter' && setOnboardingStep(2)}
                />
              </motion.div>
            )}
            {onboardingStep === 2 && (
              <motion.div initial={{ y: 20 }} animate={{ y: 0 }}>
                <label className="font-sans text-[10px] tracking-[0.3em] uppercase opacity-50 mb-4 block">META DE STREAK (DIAS)</label>
                <input
                  autoFocus
                  className="font-mono text-4xl md:text-8xl text-center w-full"
                  placeholder="00"
                  value={data.user.goal}
                  onChange={e => setData(prev => ({ ...prev, user: { ...prev.user, goal: e.target.value } }))}
                  onKeyDown={e => e.key === 'Enter' && setScreen('TODAY')}
                />
              </motion.div>
            )}
          </motion.div>
        )}

        {screen !== 'SPLASH' && screen !== 'ONBOARDING' && (
          <motion.main
            key={screen}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="p-6 md:p-16 max-w-7xl mx-auto mb-20 md:mb-0"
          >
            <NavDots />

            {screen === 'TODAY' && (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-12">
                <header className="md:col-span-12 mb-8 md:mb-12">
                  <h1 className="font-display text-6xl md:text-[120px] leading-[0.8] uppercase break-words">
                    {new Date().toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')} {new Date().getDate()}
                  </h1>
                </header>

                <section className="md:col-span-8 glass p-8 md:p-12 min-h-[300px] md:min-h-[400px] flex flex-col justify-between" onClick={() => setScreen('RUN')}>
                  <div>
                    <span className="font-sans text-[10px] tracking-[0.3em] uppercase opacity-50">CORRIDA</span>
                    <div className="mt-4 flex items-center gap-4">
                      <div className={currentDay.run.km ? 'dot-full' : 'dot-empty'} />
                      <span className="font-mono text-5xl md:text-6xl">{currentDay.run.km || '0.0'} KM</span>
                    </div>
                  </div>
                  <div className="font-mono text-lg md:text-xl opacity-30">PACE {currentDay.run.pace}</div>
                </section>

                <section className="md:col-span-4 glass p-8 md:p-12 flex flex-col justify-between" onClick={() => setScreen('WORKOUT')}>
                  <div>
                    <span className="font-sans text-[10px] tracking-[0.3em] uppercase opacity-50">TREINO</span>
                    <div className="mt-4 flex items-center gap-4">
                      <div className={currentDay.workout.duration ? 'dot-full' : 'dot-empty'} />
                      <span className="font-mono text-3xl md:text-4xl">{currentDay.workout.duration || '0'} MIN</span>
                    </div>
                  </div>
                  <div className="font-mono text-xs md:text-sm opacity-30 uppercase">{currentDay.workout.type || 'NENHUM'}</div>
                </section>

                <section className="md:col-span-4 glass p-8 md:p-12 flex flex-col justify-between" onClick={() => setScreen('SLEEP')}>
                  <div>
                    <span className="font-sans text-[10px] tracking-[0.3em] uppercase opacity-50">SONO</span>
                    <div className="mt-4 flex items-center gap-4">
                      <div className={currentDay.sleep.duration ? 'dot-full' : 'dot-empty'} />
                      <span className="font-mono text-3xl md:text-4xl">{currentDay.sleep.duration}H</span>
                    </div>
                  </div>
                  <div className="font-mono text-xs md:text-sm opacity-30">{currentDay.sleep.bed} — {currentDay.sleep.wake}</div>
                </section>

                <section className="md:col-span-8 glass p-8 md:p-12 flex flex-col justify-between" onClick={() => setScreen('NUTRITION')}>
                  <div>
                    <span className="font-sans text-[10px] tracking-[0.3em] uppercase opacity-50">ALIMENTAÇÃO</span>
                    <div className="mt-4 flex items-center gap-4">
                      <div className={currentDay.nutrition.water > 0 ? 'dot-full' : 'dot-empty'} />
                      <span className="font-mono text-3xl md:text-4xl">{currentDay.nutrition.water.toFixed(1)}L H2O</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {currentDay.nutrition.meals.map((m, i) => (
                      <div key={i} className={`w-2 h-2 rounded-full ${m ? 'bg-white' : 'border border-white/30'}`} />
                    ))}
                  </div>
                </section>

                <footer className="md:col-span-12 mt-8 md:mt-12 flex flex-col md:flex-row justify-between items-start md:items-end gap-4" onClick={() => setScreen('STREAK')}>
                  <div className="font-mono text-xl md:text-2xl flex items-center gap-4">
                    <div className="dot-full" /> {data.streak} DIAS
                  </div>
                  <div className="font-sans text-[10px] tracking-[0.3em] uppercase opacity-30">
                    {data.user.name} / {data.user.weight}KG
                  </div>
                </footer>
              </div>
            )}

            {screen === 'RUN' && (
              <div className="max-w-4xl">
                <label className="font-sans text-[10px] tracking-[0.3em] uppercase opacity-50 mb-8 block">CORRIDA</label>
                <div className="flex flex-col md:flex-row items-baseline gap-4 mb-12">
                  <input
                    autoFocus
                    className="font-mono text-8xl md:text-[160px] leading-none w-full md:w-[400px]"
                    placeholder="0.0"
                    value={currentDay.run.km}
                    onChange={e => updateDayData(todayDate, { run: { ...currentDay.run, km: e.target.value } })}
                  />
                  <span className="font-display text-2xl md:text-4xl uppercase">KM</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 mb-12">
                  <div>
                    <label className="font-sans text-[10px] tracking-[0.3em] uppercase opacity-50 mb-4 block">TEMPO</label>
                    <div className="flex items-center gap-2 font-mono text-5xl md:text-6xl">
                      <input
                        className="w-16 md:w-20 text-center"
                        placeholder="00"
                        value={currentDay.run.timeMin}
                        onChange={e => updateDayData(todayDate, { run: { ...currentDay.run, timeMin: e.target.value } })}
                      />
                      <span>:</span>
                      <input
                        className="w-16 md:w-20 text-center"
                        placeholder="00"
                        value={currentDay.run.timeSec}
                        onChange={e => updateDayData(todayDate, { run: { ...currentDay.run, timeSec: e.target.value } })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="font-sans text-[10px] tracking-[0.3em] uppercase opacity-50 mb-4 block">PACE</label>
                    <div className="font-mono text-5xl md:text-6xl">{currentDay.run.pace}</div>
                  </div>
                </div>

                <div className="mb-12">
                  <label className="font-sans text-[10px] tracking-[0.3em] uppercase opacity-50 mb-4 block">SENSAÇÃO</label>
                  {renderDots(5, currentDay.run.feeling, (i) => updateDayData(todayDate, { run: { ...currentDay.run, feeling: i } }))}
                </div>

                <textarea
                  className="w-full border-b border-white/20 py-4 font-sans text-xl placeholder:opacity-20"
                  placeholder="NOTAS DA SESSÃO..."
                  rows={1}
                  value={currentDay.run.note}
                  onChange={e => updateDayData(todayDate, { run: { ...currentDay.run, note: e.target.value } })}
                />
              </div>
            )}

            {screen === 'WORKOUT' && (
              <div className="max-w-4xl">
                <label className="font-sans text-[10px] tracking-[0.3em] uppercase opacity-50 mb-8 block">TREINO</label>
                
                <div className="flex flex-wrap gap-8 mb-12">
                  {['FORÇA', 'HIIT', 'MOBILIDADE', 'YOGA', 'OUTRO'].map(t => (
                    <button
                      key={t}
                      onClick={() => updateDayData(todayDate, { workout: { ...currentDay.workout, type: t } })}
                      className="flex items-center gap-3 group"
                    >
                      <div className={`w-3 h-3 rounded-full border border-white transition-all ${currentDay.workout.type === t ? 'bg-white scale-125' : 'bg-transparent'}`} />
                      <span className={`font-sans text-xs tracking-[0.2em] uppercase ${currentDay.workout.type === t ? 'opacity-100' : 'opacity-40'}`}>{t}</span>
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-12 mb-12">
                  <div>
                    <label className="font-sans text-[10px] tracking-[0.3em] uppercase opacity-50 mb-4 block">DURAÇÃO (MIN)</label>
                    <input
                      className="font-mono text-8xl w-full"
                      placeholder="00"
                      value={currentDay.workout.duration}
                      onChange={e => updateDayData(todayDate, { workout: { ...currentDay.workout, duration: e.target.value } })}
                    />
                  </div>
                  <div>
                    <label className="font-sans text-[10px] tracking-[0.3em] uppercase opacity-50 mb-4 block">INTENSIDADE</label>
                    <div className="mt-8">
                      {renderDots(5, currentDay.workout.intensity, (i) => updateDayData(todayDate, { workout: { ...currentDay.workout, intensity: i } }))}
                    </div>
                  </div>
                </div>

                <div className="mb-12">
                  <label className="font-sans text-[10px] tracking-[0.3em] uppercase opacity-50 mb-4 block">EXERCÍCIOS</label>
                  <textarea
                    className="w-full border-b border-white/20 py-4 font-sans text-xl placeholder:opacity-20"
                    placeholder="LISTE SEU TREINO..."
                    rows={3}
                    value={currentDay.workout.exercises}
                    onChange={e => updateDayData(todayDate, { workout: { ...currentDay.workout, exercises: e.target.value } })}
                  />
                </div>

                <textarea
                  className="w-full border-b border-white/20 py-4 font-sans text-xl placeholder:opacity-20"
                  placeholder="NOTAS ADICIONAIS..."
                  rows={1}
                  value={currentDay.workout.note}
                  onChange={e => updateDayData(todayDate, { workout: { ...currentDay.workout, note: e.target.value } })}
                />
              </div>
            )}

            {screen === 'SLEEP' && (
              <div className="max-w-4xl text-center">
                <label className="font-sans text-[10px] tracking-[0.3em] uppercase opacity-50 mb-16 block">SONO</label>
                
                <div className="flex flex-col md:flex-row items-center justify-between gap-12 mb-24">
                  <div className="text-center md:text-left">
                    <label className="font-sans text-[10px] tracking-[0.3em] uppercase opacity-30 mb-4 block">DORMIU</label>
                    <input
                      type="time"
                      className="font-mono text-5xl md:text-6xl"
                      value={currentDay.sleep.bed}
                      onChange={e => updateDayData(todayDate, { sleep: { ...currentDay.sleep, bed: e.target.value } })}
                    />
                  </div>
                  
                  <div className="flex flex-col items-center">
                    <span className="font-mono text-8xl md:text-[160px] leading-none">{currentDay.sleep.duration.split(':')[0]}</span>
                    <span className="font-sans text-[10px] tracking-[0.5em] uppercase opacity-50">HORAS TOTAIS</span>
                  </div>

                  <div className="text-center md:text-right">
                    <label className="font-sans text-[10px] tracking-[0.3em] uppercase opacity-30 mb-4 block">ACORDOU</label>
                    <input
                      type="time"
                      className="font-mono text-5xl md:text-6xl"
                      value={currentDay.sleep.wake}
                      onChange={e => updateDayData(todayDate, { sleep: { ...currentDay.sleep, wake: e.target.value } })}
                    />
                  </div>
                </div>

                <div className="mb-12 flex flex-col items-center">
                  <label className="font-sans text-[10px] tracking-[0.3em] uppercase opacity-50 mb-8 block">QUALIDADE</label>
                  {renderDots(5, currentDay.sleep.quality, (i) => updateDayData(todayDate, { sleep: { ...currentDay.sleep, quality: i } }))}
                </div>

                <textarea
                  className="w-full border-b border-white/20 py-4 font-sans text-xl text-center placeholder:opacity-20"
                  placeholder="NOTAS SOBRE O DESCANSO..."
                  rows={1}
                  value={currentDay.sleep.note}
                  onChange={e => updateDayData(todayDate, { sleep: { ...currentDay.sleep, note: e.target.value } })}
                />
              </div>
            )}

            {screen === 'NUTRITION' && (
              <div className="max-w-4xl">
                <label className="font-sans text-[10px] tracking-[0.3em] uppercase opacity-50 mb-16 block">ALIMENTAÇÃO</label>
                
                <div className="flex items-center justify-between mb-12 md:mb-24 glass p-8 md:p-12">
                  <button 
                    className="font-mono text-4xl md:text-6xl opacity-30 hover:opacity-100 transition-opacity"
                    onClick={() => updateDayData(todayDate, { nutrition: { ...currentDay.nutrition, water: Math.max(0, currentDay.nutrition.water - 0.25) } })}
                  >—</button>
                  <div className="text-center">
                    <span className="font-mono text-7xl md:text-9xl">{currentDay.nutrition.water.toFixed(1)}</span>
                    <span className="font-display text-2xl md:text-4xl ml-2 md:ml-4">L</span>
                  </div>
                  <button 
                    className="font-mono text-4xl md:text-6xl opacity-30 hover:opacity-100 transition-opacity"
                    onClick={() => updateDayData(todayDate, { nutrition: { ...currentDay.nutrition, water: currentDay.nutrition.water + 0.25 } })}
                  >+</button>
                </div>

                <div className="space-y-12 mb-24">
                  {currentDay.nutrition.meals.map((meal, i) => (
                    <div key={i} className="flex gap-8 items-start">
                      <span className="font-mono text-xl opacity-30">0{i+1}</span>
                      <textarea
                        className="flex-1 border-b border-white/20 py-2 font-sans text-2xl placeholder:opacity-10"
                        placeholder="REFEIÇÃO..."
                        rows={1}
                        value={meal}
                        onChange={e => {
                          const newMeals = [...currentDay.nutrition.meals];
                          newMeals[i] = e.target.value;
                          updateDayData(todayDate, { nutrition: { ...currentDay.nutrition, meals: newMeals } });
                        }}
                      />
                    </div>
                  ))}
                </div>

                <div className="flex flex-col items-center">
                  <label className="font-sans text-[10px] tracking-[0.3em] uppercase opacity-50 mb-8 block">AVALIAÇÃO DO DIA</label>
                  {renderDots(5, currentDay.nutrition.rating, (i) => updateDayData(todayDate, { nutrition: { ...currentDay.nutrition, rating: i } }))}
                </div>
              </div>
            )}

            {screen === 'ARCHIVE' && (
              <div>
                <label className="font-sans text-[10px] tracking-[0.3em] uppercase opacity-50 mb-12 block">HISTÓRICO / 60 DIAS</label>
                <div className="grid grid-cols-5 md:grid-cols-10 gap-4 md:gap-8">
                  {Array.from({ length: 60 }).map((_, i) => {
                    const d = new Date();
                    d.setDate(d.getDate() - (59 - i));
                    const dateStr = d.toISOString().split('T')[0];
                    const day = data.days[dateStr];
                    
                    let status: 'empty' | 'partial' | 'full' = 'empty';
                    if (day) {
                      const completedCount = [
                        parseFloat(day.run.km) > 0,
                        parseInt(day.workout.duration) > 0,
                        day.nutrition.water > 0,
                        day.sleep.quality > 0
                      ].filter(Boolean).length;
                      
                      if (completedCount === 4) status = 'full';
                      else if (completedCount > 0) status = 'partial';
                    }

                    return (
                      <div key={i} className="group relative flex flex-col items-center">
                        <div className={`
                          ${status === 'full' ? 'dot-full' : status === 'partial' ? 'dot-partial' : 'dot-empty'}
                          scale-150 cursor-pointer hover:scale-[2] transition-transform
                        `} />
                        
                        <div className="absolute bottom-full mb-4 hidden group-hover:block glass p-4 z-50 min-w-[150px]">
                          <div className="font-mono text-[10px] mb-2">{dateStr}</div>
                          {day ? (
                            <div className="font-mono text-[9px] space-y-1 opacity-70">
                              <div>RUN: {day.run.km || '0'}KM</div>
                              <div>WORK: {day.workout.duration || '0'}M</div>
                              <div>H2O: {day.nutrition.water.toFixed(1)}L</div>
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

            {screen === 'STREAK' && (
              <div className="fixed inset-0 flex flex-col items-center justify-center p-8 md:p-12 text-center">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="mb-8 md:mb-12"
                >
                  <span className="font-mono text-9xl md:text-[240px] leading-none">{data.streak}</span>
                  <div className="font-sans text-[10px] tracking-[0.5em] md:tracking-[1em] uppercase opacity-50 mt-4">DIAS CONSECUTIVOS</div>
                </motion.div>

                <div className="space-y-4">
                  <div className="font-mono text-xs md:text-sm opacity-30">RECORDE PESSOAL: {data.record} DIAS</div>
                  <div className="font-display text-xl md:text-2xl max-w-md mx-auto leading-tight">
                    {STREAK_PHRASES[data.streak] || STREAK_PHRASES[Object.keys(STREAK_PHRASES).map(Number).filter(n => n <= data.streak).pop() || 1]}
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
