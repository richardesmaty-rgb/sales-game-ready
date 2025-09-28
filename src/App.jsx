import React, { useEffect, useMemo, useRef, useState } from "react";
import { saveActivityToSheet } from "./cloud";

/**
 * Sales & Marketing Productivity Game (mobile-friendly)
 * - Weekly level reset (keeps history/streaks, resets only level & XP)
 * - High-contrast form controls for mobile/dark mode
 * - Goal box allows free typing (any non-negative int)
 * - System theme (light/dark/system), Export All CSV
 * - Focus Timer awards: Work +25, Short +5, Long +15
 */

/* -------------------- UI class helpers -------------------- */
const CONTROL =
  "px-3 py-2 rounded-xl border shadow-sm " +
  "bg-white text-gray-900 placeholder-gray-400 " +
  "dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400 " +
  "border-gray-300 dark:border-gray-600 " +
  "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500";

const BTN =
  "px-3 py-2 rounded-xl border shadow-sm hover:shadow " +
  "bg-white text-gray-900 border-gray-300 " +
  "dark:bg-gray-800 dark:text-gray-100 dark:border-gray-600 " +
  "focus:outline-none focus:ring-2 focus:ring-blue-500";

const TAB_BTN =
  "px-3 py-2 rounded-xl border shadow-sm text-sm " +
  "bg-white text-gray-900 border-gray-300 " +
  "dark:bg-gray-800 dark:text-gray-100 dark:border-gray-600";

/* -------------------- Utilities -------------------- */
const todayISO = () => new Date().toISOString().slice(0, 10);
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const uid = () => Math.random().toString(36).slice(2, 9);
const xpForLevel = (level) => 100 + (level - 1) * 75;
function safeJSONParse(str, fallback) { try { return JSON.parse(str); } catch { return fallback; } }

/** ISO week key like "2025-W09" (Monday-based weeks) */
function isoWeekKey(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;          // Mon=0..Sun=6
  date.setUTCDate(date.getUTCDate() - dayNum + 3);    // Thursday in current week
  const week1 = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const weekNo = 1 + Math.round(
    ((date - week1) / 86400000 - 3 + ((week1.getUTCDay() + 6) % 7)) / 7
  );
  const year = date.getUTCFullYear();
  return `${year}-W${String(weekNo).padStart(2, "0")}`;
}

/* --- Weekly reset configuration --- */
const RESET_LEVEL_AT_WEEK_START = true; // set false to disable
const WEEKLY_RESET_LEVEL = 1;           // set to 0 if you prefer "Level 0"
const WEEKLY_RESET_XP = 0;              // XP progress resets with level

/* -------------------- Defaults -------------------- */
const defaultQuests = [
  { id: uid(), title: "Prospecting call", points: 5, category: "Sales", emoji: "📞" },
  { id: uid(), title: "Book a meeting", points: 15, category: "Sales", emoji: "📅" },
  { id: uid(), title: "Send proposal/quote", points: 20, category: "Sales", emoji: "📨" },
  { id: uid(), title: "Close a deal", points: 75, category: "Sales", emoji: "🏁" },
  { id: uid(), title: "LinkedIn post", points: 10, category: "Marketing", emoji: "📝" },
  { id: uid(), title: "5 meaningful comments", points: 5, category: "Marketing", emoji: "💬" },
  { id: uid(), title: "Email newsletter", points: 20, category: "Marketing", emoji: "📧" },
  { id: uid(), title: "Add 10 leads to CRM", points: 10, category: "Ops", emoji: "🗂️" },
];

const defaultSettings = {
  dailyGoal: 100,
  pomodoroMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  theme: "system", // light | dark | system
};

const STORAGE_VERSION = 2;

/* -------------------- Fresh person state -------------------- */
const makeFreshState = (name = "") => ({
  __version: STORAGE_VERSION,
  name,
  settings: { ...defaultSettings },
  quests: defaultQuests,
  history: [], // {id,date,questId,title,category,points,emoji,timestamp}
  xp: 0,
  level: 1,
  streak: 0,
  lastGoalDate: null,
  weekKey: isoWeekKey(), // used for weekly level reset
});

/* -------------------- Local Storage (multi-user) -------------------- */
const STORAGE_PREFIX = "sm-productivity-game:v2:";
const PROFILES_KEY = STORAGE_PREFIX + "profiles"; // string[]

function loadProfiles() {
  const arr = safeJSONParse(localStorage.getItem(PROFILES_KEY), []);
  return Array.isArray(arr) ? arr : [];
}
function saveProfiles(arr) {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(arr));
}
function personKey(person) {
  return STORAGE_PREFIX + "person:" + person;
}
function migrateState(parsed, person) {
  const base = makeFreshState(person);
  const settings = { ...defaultSettings, ...(parsed.settings || {}) };
  const quests = (parsed.quests?.length ? parsed.quests : defaultQuests).map(q => ({ emoji: "🎯", ...q }));
  return {
    ...base,
    ...parsed,
    __version: STORAGE_VERSION,
    name: person,
    settings,
    quests,
    weekKey: parsed.weekKey || base.weekKey, // ensure present for weekly reset
  };
}
function loadPersonState(person) {
  if (!person) return makeFreshState("");
  const raw = localStorage.getItem(personKey(person));
  if (!raw) return makeFreshState(person);
  const parsed = safeJSONParse(raw, null);
  if (!parsed) return makeFreshState(person);
  return migrateState(parsed, person);
}
function savePersonState(person, state) {
  if (!person) return;
  localStorage.setItem(personKey(person), JSON.stringify({ ...state, __version: STORAGE_VERSION }));
}

/* -------------------- Theme helpers -------------------- */
function effectiveTheme(themeSetting) {
  if (themeSetting === "light") return "light";
  if (themeSetting === "dark") return "dark";
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light";
}

/* -------------------- Header -------------------- */
function Header({ level, xp, nextXP, onReset, theme, setTheme, onExportAllCSV }) {
  const pct = clamp(Math.round((xp / nextXP) * 100), 0, 100);
  return (
    <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Sales & Marketing Game</h1>
        <p className="text-sm opacity-80">Gamify your day. Rack up points. Level up your results.</p>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 p-2 rounded-2xl border shadow-sm bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600">
          <span className="text-lg">🏆</span>
          <div>
            <div className="text-sm uppercase tracking-wide opacity-70">Level</div>
            <div className="font-semibold">{level}</div>
          </div>
        </div>
        <div className="p-2 rounded-2xl border shadow-sm min-w-[220px] bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600">
          <div className="flex items-center justify-between text-sm opacity-80 mb-1">
            <span>XP</span>
            <span>{xp} / {nextXP}</span>
          </div>
          <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-black dark:bg-gray-100" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <button onClick={onExportAllCSV} className={BTN}>Export All CSV</button>
        <button onClick={onReset} className={BTN}>Reset</button>

        <select
          value={theme}
          onChange={(e)=>setTheme(e.target.value)}
          className={CONTROL}
          title="Theme"
        >
          <option value="system">🖥️ System</option>
          <option value="light">☀️ Light</option>
          <option value="dark">🌙 Dark</option>
        </select>
      </div>
    </header>
  );
}

/* -------------------- Multi-user People Bar -------------------- */
function PeopleBar({ person, setPerson, profiles, setProfiles, onExportCSV }) {
  const [newName, setNewName] = useState("");

  function addPerson() {
    const name = newName.trim();
    if (!name) return;
    if (!profiles.includes(name)) {
      const next = [...profiles, name].sort((a, b) => a.localeCompare(b));
      setProfiles(next);
      saveProfiles(next);
    }
    const existing = localStorage.getItem(personKey(name));
    if (!existing) savePersonState(name, makeFreshState(name));
    setPerson(name);
    setNewName("");
  }

  function removePerson() {
    if (!person) return;
    if (!confirm(`Remove ${person} from the picker?\n(Their saved data stays in localStorage.)`)) return;
    const next = profiles.filter((p) => p !== person);
    setProfiles(next);
    saveProfiles(next);
    setPerson(next[0] || "");
  }

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <select value={person} onChange={(e) => setPerson(e.target.value)} className={CONTROL}>
        {profiles.length === 0 && <option value="">— Select person —</option>}
        {profiles.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>
      <input
        placeholder="Add person..."
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        className={CONTROL}
      />
      <button onClick={addPerson} className={BTN}>Add</button>
      {!!person && (
        <button onClick={removePerson} className={BTN}>Remove</button>
      )}
      <button onClick={onExportCSV} className={BTN}>Export CSV</button>
    </div>
  );
}

/* -------------------- Daily Progress -------------------- */
function DailyProgress({ historyToday, dailyGoal, onSetGoal }) {
  const [goalDraft, setGoalDraft] = useState(String(dailyGoal));
  useEffect(() => { setGoalDraft(String(dailyGoal)); }, [dailyGoal]);

  const commitGoal = () => {
    const n = parseInt(goalDraft, 10);
    if (Number.isFinite(n) && n >= 0) onSetGoal(n);
    else setGoalDraft(String(dailyGoal));
  };

  const total = historyToday.reduce((s, h) => s + h.points, 0);
  const denom = Math.max(1, dailyGoal);
  const pct = clamp(Math.round((total / denom) * 100), 0, 100);

  return (
    <div className="p-4 rounded-2xl border shadow-sm bg-white/60 dark:bg-gray-900/60 border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold">Today's Progress</h2>
        <div className="flex items-center gap-2 text-sm">
          <span>Goal:</span>
          <input
            type="text"
            inputMode="numeric"
            value={goalDraft}
            onChange={(e) => setGoalDraft(e.target.value)}
            onBlur={commitGoal}
            onKeyDown={(e)=>{ if(e.key==='Enter') { e.currentTarget.blur(); }}}
            className={CONTROL + " w-24"}
            placeholder="points"
          />
          <span>pts</span>
        </div>
      </div>
      <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className="h-full bg-green-500" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-2 text-sm opacity-80">{total} / {dailyGoal} pts</div>
    </div>
  );
}

/* -------------------- Quests -------------------- */
function QuestCard({ quest, onComplete, onEdit, onDelete }) {
  return (
    <div className="p-4 rounded-2xl border shadow-sm bg-white/70 dark:bg-gray-900/70 border-gray-200 dark:border-gray-700 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl" aria-hidden>{quest.emoji || '🎯'}</span>
          <div>
            <div className="font-semibold">{quest.title}</div>
            <div className="text-xs opacity-70">{quest.category} • {quest.points} pts</div>
          </div>
        </div>
        <div className="flex gap-2 text-xs">
          <button onClick={() => onEdit(quest)} className={BTN + " px-2 py-1"}>Edit</button>
          <button onClick={() => onDelete(quest.id)} className={BTN + " px-2 py-1"}>Del</button>
        </div>
      </div>
      <button onClick={() => onComplete(quest)} className="px-3 py-2 rounded-xl bg-black text-white hover:opacity-90 dark:bg-white dark:text-black">
        Complete +{quest.points}
      </button>
    </div>
  );
}

/* -------------------- Quest Editor -------------------- */
function QuestEditor({ initial, onSave, onCancel }) {
  const [title, setTitle] = useState(initial?.title || "");
  const [points, setPoints] = useState(initial?.points || 5);
  const [category, setCategory] = useState(initial?.category || "Sales");
  const [emoji, setEmoji] = useState(initial?.emoji || "🎯");
  return (
    <div className="p-4 rounded-2xl border shadow-sm bg-white/70 dark:bg-gray-900/70 border-gray-200 dark:border-gray-700 flex flex-col gap-3">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <input className={CONTROL} placeholder="Title" value={title} onChange={e=>setTitle(e.target.value)} />
        <input type="number" className={CONTROL} placeholder="Points" value={points} onChange={e=>setPoints(parseInt(e.target.value||0,10))} />
        <select className={CONTROL} value={category} onChange={e=>setCategory(e.target.value)}>
          <option>Sales</option><option>Marketing</option><option>Ops</option><option>Learning</option>
        </select>
        <input className={CONTROL} placeholder="Emoji (optional)" value={emoji} onChange={e=>setEmoji(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <button
          onClick={()=>onSave({ ...(initial||{}), id: initial?.id||uid(), title, points: clamp(points||0,0,1000), category, emoji})}
          className="px-3 py-2 rounded-xl bg-black text-white dark:bg-white dark:text-black"
        >Save</button>
        <button onClick={onCancel} className={BTN}>Cancel</button>
      </div>
    </div>
  );
}

/* -------------------- History -------------------- */
function History({ history }) {
  return (
    <div className="p-4 rounded-2xl border shadow-sm bg-white/60 dark:bg-gray-900/60 border-gray-200 dark:border-gray-700">
      <h3 className="font-semibold mb-3">Today's Activity</h3>
      {history.length === 0 && <div className="text-sm opacity-70">No activity yet. Complete a quest!</div>}
      <ul className="space-y-2">
        {history.map(h => (
          <li key={h.id} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span>{h.emoji || '🎯'}</span>
              <span className="font-medium">{h.title}</span>
              <span className="opacity-60">• {new Date(h.timestamp).toLocaleTimeString()}</span>
            </div>
            <span className="font-semibold">+{h.points}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* -------------------- Stats / Badges -------------------- */
function Stats({ allHistory, streak, level }) {
  const totals = useMemo(() => {
    const byDate = {};
    for (const h of allHistory) byDate[h.date] = (byDate[h.date] || 0) + h.points;
    const days = Object.keys(byDate).sort();
    const last7 = days.slice(-7);
    const sum7 = last7.reduce((s, d) => s + byDate[d], 0);
    return { sum7 };
  }, [allHistory]);
  return (
    <div className="p-4 rounded-2xl border shadow-sm bg-white/60 dark:bg-gray-900/60 border-gray-200 dark:border-gray-700 flex flex-col gap-2">
      <h3 className="font-semibold">Stats</h3>
      <div className="text-sm">Current streak: <span className="font-semibold">{streak}</span> day{streak===1?'':'s'}</div>
      <div className="text-sm">Level: <span className="font-semibold">{level}</span></div>
      <div className="text-sm">Last 7 days points: <span className="font-semibold">{totals.sum7}</span></div>
    </div>
  );
}
function Badges({ allHistory, level, dailyGoal }) {
  const totalCalls = allHistory.filter(h => /call/i.test(h.title)).length;
  const deals = allHistory.filter(h => /close a deal/i.test(h.title)).length;
  const posts = allHistory.filter(h => /LinkedIn post/i.test(h.title)).length;
  const badges = [
    { id: 'starter', label: 'Getting Started', earned: allHistory.length >= 1, emoji: '🚀' },
    { id: 'caller10', label: 'Call Cadet (10 calls)', earned: totalCalls >= 10, emoji: '📞' },
    { id: 'closer1', label: 'Closer (1 deal)', earned: deals >= 1, emoji: '🤝' },
    { id: 'creator5', label: 'Content Creator (5 posts)', earned: posts >= 5, emoji: '✍️' },
    { id: 'level5', label: 'Level 5+', earned: level >= 5, emoji: '🏅' },
    { id: 'goal100', label: 'Hit 100+ day', earned: dailyGoal >= 100, emoji: '💯' },
  ];

  return (
    <div className="p-4 rounded-2xl border shadow-sm bg-white/60 dark:bg-gray-900/60 border-gray-200 dark:border-gray-700">
      <h3 className="font-semibold mb-2">Badges</h3>
      <div className="flex flex-wrap gap-2">
        {badges.map(b => (
          <div key={b.id} className={`px-3 py-2 rounded-xl border shadow-sm text-sm ${b.earned ? 'bg-amber-100 dark:bg-amber-900/40' : 'opacity-70'} border-gray-300 dark:border-gray-600`}>
            <span className="mr-1">{b.emoji}</span>{b.label}
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------- Timer -------------------- */
function Timer({ settings, onTimerComplete }) {
  const [mode, setMode] = useState('work'); // work | short | long
  const [seconds, setSeconds] = useState(settings.pomodoroMinutes * 60);
  const [running, setRunning] = useState(false);
  const notifRef = useRef(null);

  useEffect(() => {
    let t;
    if (running) t = setInterval(() => setSeconds(s => Math.max(0, s-1)), 1000);
    return () => clearInterval(t);
  }, [running]);

  useEffect(() => {
    if (seconds !== 0) return;
    if (running) setRunning(false);

    try { new Audio("data:audio/wav;base64,UklGRkQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABYAAAACAAACAAA=").play(); } catch {}

    const title = mode === 'work' ? "Work block done" : mode === 'short' ? "Short break over" : "Long break over";
    const body = "Nice! Logging points now.";
    if ("Notification" in window) {
      if (Notification.permission === "granted") {
        notifRef.current = new Notification(title, { body });
      } else if (Notification.permission === "default") {
        Notification.requestPermission().then(p => { if (p === "granted") notifRef.current = new Notification(title, { body }); });
      } else {
        alert(`${title} — Logging points.`);
      }
    } else {
      alert(`${title} — Logging points.`);
    }

    onTimerComplete(mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds]);

  const resetTo = (m) => {
    setMode(m);
    const mins = m==='work'? settings.pomodoroMinutes : m==='short'? settings.shortBreakMinutes : settings.longBreakMinutes;
    setSeconds(mins*60);
    setRunning(false);
  };
  const mm = String(Math.floor(seconds/60)).padStart(2,'0');
  const ss = String(seconds%60).padStart(2,'0');

  return (
    <div className="p-4 rounded-2xl border shadow-sm bg-white/60 dark:bg-gray-900/60 border-gray-200 dark:border-gray-700">
      <h3 className="font-semibold mb-2">Focus Timer</h3>
      <div className="flex gap-2 mb-3">
        <button onClick={()=>resetTo('work')} className={`${BTN} ${mode==='work'?'!bg-black !text-white dark:!bg-white dark:!text-black':''}`}>Work</button>
        <button onClick={()=>resetTo('short')} className={`${BTN} ${mode==='short'?'!bg-black !text-white dark:!bg-white dark:!text-black':''}`}>Short</button>
        <button onClick={()=>resetTo('long')} className={`${BTN} ${mode==='long'?'!bg-black !text-white dark:!bg-white dark:!text-black':''}`}>Long</button>
      </div>
      <div className="text-4xl font-bold text-center mb-3">{mm}:{ss}</div>
      <div className="flex gap-2 justify-center">
        <button onClick={()=>setRunning(r=>!r)} className={BTN}>{running? 'Pause' : 'Start'}</button>
        <button onClick={()=>resetTo(mode)} className={BTN}>Reset</button>
      </div>
    </div>
  );
}

/* -------------------- Leaderboard (local) -------------------- */
function Leaderboard({ profiles }) {
  const [range, setRange] = useState("week"); // week | month

  const rows = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    if (range === "week") start.setDate(now.getDate() - 7);
    else start.setMonth(now.getMonth() - 1);
    const startISO = start.toISOString().slice(0, 10);

    const totals = profiles.map((p) => {
      const s = loadPersonState(p);
      const pts = (s.history || [])
        .filter((h) => h.date >= startISO)
        .reduce((sum, h) => sum + (h.points || 0), 0);
      return { name: p, points: pts };
    }).sort((a, b) => b.points - a.points);

    return totals;
  }, [profiles, range]);

  return (
    <div className="p-4 rounded-2xl border shadow-sm bg-white/60 dark:bg-gray-900/60 border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Leaderboard</h3>
        <select className={CONTROL} value={range} onChange={(e)=>setRange(e.target.value)}>
          <option value="week">Last 7 days</option>
          <option value="month">Last 30 days</option>
        </select>
      </div>
      <table className="w-full text-sm mt-3">
        <thead>
          <tr className="text-left opacity-70"><th>#</th><th>Name</th><th className="text-right">Points</th></tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.name} className="border-t border-gray-200 dark:border-gray-700">
              <td className="py-1">{i+1}</td>
              <td>{r.name}</td>
              <td className="text-right font-semibold">{r.points}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan="3" className="py-3 opacity-70">No data yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

/* -------------------- MAIN APP -------------------- */
export default function App() {
  const [profiles, setProfiles] = useState(loadProfiles());
  const [person, setPerson] = useState(profiles[0] || "");
  const [state, setState] = useState(() => loadPersonState(person));
  const [undoStack, setUndoStack] = useState([]); // kept for future use

  // Theme application
  useEffect(() => {
    const apply = () => {
      const eff = effectiveTheme(state.settings.theme);
      document.documentElement.classList.toggle('dark', eff === 'dark');
    };
    apply();
    let mql;
    if (state.settings.theme === 'system' && window.matchMedia) {
      mql = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => apply();
      mql.addEventListener ? mql.addEventListener('change', handler) : mql.addListener(handler);
      return () => {
        mql.removeEventListener ? mql.removeEventListener('change', handler) : mql.removeListener(handler);
      };
    }
  }, [state.settings.theme]);

  // Switch person & persist
  useEffect(() => { if (person) setState(loadPersonState(person)); }, [person]);
  useEffect(() => { if (person) savePersonState(person, state); }, [person, state]);

  // Weekly level reset
  useEffect(() => {
    if (!RESET_LEVEL_AT_WEEK_START || !person) return;
    const nowKey = isoWeekKey(new Date());
    if (state.weekKey !== nowKey) {
      setState(s => ({ ...s, level: WEEKLY_RESET_LEVEL, xp: WEEKLY_RESET_XP, weekKey: nowKey }));
    }
  }, [person, state.weekKey]);

  const { settings, quests, history, xp, level, streak, lastGoalDate } = state;
  const dateToday = todayISO();
  const historyToday = useMemo(() => history.filter(h => h.date === dateToday).sort((a,b)=>b.timestamp-a.timestamp), [history, dateToday]);
  const nextXP = useMemo(() => xpForLevel(level), [level]);

  // Central entry add (used by quests + timer)
  const addEntry = async ({ title, category, points, emoji, questId=null }) => {
    if (!person) { alert("Select or add a person first."); return; }

    const entry = {
      id: uid(),
      date: dateToday,
      questId,
      title,
      category: category || "General",
      points,
      emoji,
      timestamp: Date.now()
    };

    const newHistory = [...history, entry];
    const newXP = xp + points;

    // Level-up math
    let newLevel = level;
    let remainder = newXP;
    let needed = xpForLevel(newLevel);
    while (remainder >= needed) {
      remainder -= needed;
      newLevel += 1;
      needed = xpForLevel(newLevel);
    }

    // Streak logic
    const totalToday = newHistory.filter(h => h.date === dateToday).reduce((s, h) => s + h.points, 0);
    let newStreak = streak;
    let newLastGoalDate = lastGoalDate;
    if (totalToday >= settings.dailyGoal && lastGoalDate !== dateToday) {
      const y = new Date(dateToday); y.setDate(y.getDate() - 1);
      const yISO = y.toISOString().slice(0, 10);
      newStreak = (lastGoalDate === yISO) ? streak + 1 : 1;
      newLastGoalDate = dateToday;
    }

    // Save locally
    const prev = state;
    const next = { ...state, history: newHistory, xp: newXP, level: newLevel, streak: newStreak, lastGoalDate: newLastGoalDate, name: person };
    setState(next);

    setUndoStack((st)=>[{ entry, prev }, ...st].slice(0, 25));

    // Save to Google Sheet (central)
    try {
      await saveActivityToSheet({
        name: person,
        date: dateToday,
        title,
        category: category || "General",
        points,
        timestamp: entry.timestamp
      });
    } catch (err) {
      console.warn("Could not save to Google Sheet:", err);
    }
  };

  // Complete quest
  const completeQuest = (q) => addEntry({ title: q.title, category: q.category, points: q.points, emoji: q.emoji, questId: q.id });

  // Quests CRUD
  const addQuest = (q) => setState(s => ({ ...s, quests: [q, ...s.quests] }));
  const updateQuest = (q) => setState(s => ({ ...s, quests: s.quests.map(x => x.id===q.id? q : x) }));
  const deleteQuest = (id) => setState(s => ({ ...s, quests: s.quests.filter(q => q.id!==id) }));

  // Daily goal setter (accept any non-negative int)
  const setDailyGoal = (val) => {
    const n = Number.isFinite(val) ? Math.max(0, val) : 0;
    setState(s => ({ ...s, settings: { ...s.settings, dailyGoal: n }}));
  };

  // Reset & exports
  const doReset = () => {
    if (!person) return alert("Select a person first.");
    if (confirm(`Reset all data for ${person}?`)) setState(makeFreshState(person));
  };

  const exportCSV = () => {
    if (!person) return alert("Select a person first.");
    const rows = [
      ["person","date","time","title","category","points"],
      ...state.history.map(h=>[person, h.date, new Date(h.timestamp).toLocaleTimeString(), h.title, h.category||"", h.points]),
    ];
    const csv = rows.map(r=>r.map(x=>`"${String(x).replace(/"/g,'""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], {type:"text/csv"}));
    a.download = `sm-game-${person}-${todayISO()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  function exportAllProfilesCSV() {
    const profs = loadProfiles();
    const rows = [["person","date","time","title","category","points","level","streak"]]];
    for (const p of profs) {
      const s = loadPersonState(p);
      for (const h of s.history || []) {
        rows.push([
          p,
          h.date,
          new Date(h.timestamp).toLocaleTimeString(),
          h.title,
          h.category||"",
          h.points,
          s.level,
          s.streak
        ]);
      }
    }
    const csv = rows.map(r=>r.map(x=>`"${String(x).replace(/"/g,'""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], {type:"text/csv"}));
    a.download = `sm-game-all-${todayISO()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // UI filters
  const [editing, setEditing] = useState(null);
  const [tab, setTab] = useState('All');
  const categories = ['All', ...Array.from(new Set(quests.map(q=>q.category)))];
  const filteredQuests = quests.filter(q => tab==='All' || q.category===tab);

  // Focus timer completion → award points
  const handleTimerComplete = (mode) => {
    const points = mode === 'work' ? 25 : mode === 'short' ? 5 : 15;
    const title = mode === 'work' ? "Focus block (Work)" : mode === 'short' ? "Focus block (Short break)" : "Focus block (Long break)";
    addEntry({ title, category: "Ops", points, emoji: "⏱️" });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-black text-gray-900 dark:text-gray-100">
      <div className="max-w-6xl mx-auto p-4 md:p-8">
        {/* Top: header + people bar */}
        <div className="flex flex-col gap-4">
          <Header
            level={level}
            xp={xp % nextXP}
            nextXP={nextXP}
            onReset={doReset}
            theme={state.settings.theme}
            setTheme={(t)=>setState(s=>({...s, settings:{...s.settings, theme:t}}))}
            onExportAllCSV={exportAllProfilesCSV}
          />
          <PeopleBar
            person={person}
            setPerson={setPerson}
            profiles={profiles}
            setProfiles={setProfiles}
            onExportCSV={exportCSV}
          />
        </div>

        <div className="grid md:grid-cols-3 gap-6 mt-6">
          {/* LEFT: Game panel */}
          <div className="md:col-span-2 space-y-6">
            <DailyProgress historyToday={historyToday} dailyGoal={settings.dailyGoal} onSetGoal={setDailyGoal} />

            {/* Tabs & New quest */}
            <div className="flex flex-wrap gap-2">
              {categories.map(c => (
                <button key={c} onClick={()=>setTab(c)} className={TAB_BTN + (tab===c?' !bg-black !text-white dark:!bg-white dark:!text-black':'')}>
                  {c}
                </button>
              ))}
              <button onClick={()=>setEditing({})} className={TAB_BTN}>+ New Quest</button>
            </div>

            {editing && (
              <QuestEditor
                initial={editing.id? editing : null}
                onSave={(q)=>{ editing.id? updateQuest(q) : addQuest(q); setEditing(null); }}
                onCancel={()=>setEditing(null)}
              />
            )}

            {/* Quests grid */}
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredQuests.map(q => (
                <QuestCard key={q.id} quest={q} onComplete={completeQuest} onEdit={setEditing} onDelete={deleteQuest} />
              ))}
            </div>

            <History history={historyToday} />

            {/* Local leaderboard across profiles */}
            <Leaderboard profiles={profiles} />
          </div>

          {/* RIGHT: Stats / Badges / Timer / Tips */}
          <div className="space-y-6">
            <Stats allHistory={history} streak={streak} level={level} />
            <Badges allHistory={history} level={level} dailyGoal={settings.dailyGoal} />
            <Timer settings={settings} onTimerComplete={handleTimerComplete} />

            <div className="p-4 rounded-2xl border shadow-sm bg-white/60 dark:bg-gray-900/60 border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold mb-2">Tips</h3>
              <ul className="list-disc ml-5 text-sm space-y-1 opacity-90">
                <li>Weight high-impact actions with higher points.</li>
                <li>Hit your daily goal to build streaks.</li>
                <li>Use the timer for deep work blocks.</li>
                <li>Export data weekly as a backup.</li>
              </ul>
            </div>
          </div>
        </div>

        <footer className="text-xs opacity-60 mt-10">Multi-user • Local leaderboard • Per-person Export CSV • Export All Profiles</footer>
      </div>
    </div>
  );
}
