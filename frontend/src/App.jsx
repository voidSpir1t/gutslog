import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Settings,
  Play,
  Check,
  Trash2,
  History,
  ChevronLeft,
  ChevronRight,
  Download,
  Languages,
  Sun,
  Moon,
  SunMoon,
  Home,
  Calendar,
  Share2
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { useTranslation } from 'react-i18next';
import { dbGetAll, dbPut, dbDelete, dbSaveAll } from './utils/db';
import { getTemplates as getOldTemplates, getSessions as getOldSessions } from './utils/storage';
import Body from '@mjcdev/react-body-highlighter';

const MaleSymbol = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="15" r="5" />
    <path d="M13 11l6-6" />
    <path d="M19 5h-5" />
    <path d="M19 5v5" />
  </svg>
);

const FemaleSymbol = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="10" r="5" />
    <path d="M12 15v6" />
    <path d="M9 18h6" />
  </svg>
);

const App = () => {
  const { t, i18n } = useTranslation();
  const [view, setView] = useState('HISTORY'); // HOME, EDIT_TEMPLATE, WORKOUT, HISTORY
  const [templates, setTemplates] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [currentTemplate, setCurrentTemplate] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [themeMode, setThemeMode] = useState('auto'); // auto, light, dark
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [inheritMode, setInheritMode] = useState(localStorage.getItem('gymlog_inherit_pref') || 'all'); // all, weight, reps
  const [confirmDialog, setConfirmDialog] = useState(null); // { message, onConfirm }
  const [weightUnit, setWeightUnit] = useState(localStorage.getItem('gymlog_unit') || 'kg'); // kg, lbs
  const [userGender, setUserGender] = useState(localStorage.getItem('gymlog_gender') || 'male');

  const exportRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('gymlog_gender', userGender);
  }, [userGender]);

  useEffect(() => {
    const initData = async () => {
      let t = await dbGetAll('templates');
      let s = await dbGetAll('sessions');

      // Migration from localStorage if IndexedDB is empty
      if (t.length === 0 && s.length === 0) {
        const oldT = getOldTemplates();
        const oldS = getOldSessions();
        if (oldT.length > 0) {
          await dbSaveAll('templates', oldT);
          t = oldT;
        }
        if (oldS.length > 0) {
          await dbSaveAll('sessions', oldS);
          s = oldS;
        }
      }

      setTemplates(t.sort((a, b) => b.id - a.id));
      setSessions(s.sort((a, b) => b.id - a.id));
    };

    initData();
    applyTheme(themeMode);

    const timer = setInterval(() => {
      if (themeMode === 'auto') applyTheme('auto');
    }, 60000);

    return () => clearInterval(timer);
  }, [themeMode]);

  useEffect(() => {
    localStorage.setItem('gymlog_inherit_pref', inheritMode);
    localStorage.setItem('gymlog_unit', weightUnit);
  }, [inheritMode, weightUnit]);

  const applyTheme = (mode) => {
    let theme = mode;
    if (mode === 'auto') {
      const hour = new Date().getHours();
      theme = (hour >= 6 && hour < 18) ? 'light' : 'dark';
    }
    document.documentElement.setAttribute('data-theme', theme);
  };

  const toggleTheme = () => {
    const modes = ['auto', 'light', 'dark'];
    const nextIndex = (modes.indexOf(themeMode) + 1) % modes.length;
    setThemeMode(modes[nextIndex]);
  };

  const toggleLanguage = () => {
    const nextLng = i18n.language.startsWith('zh') ? 'en' : 'zh';
    i18n.changeLanguage(nextLng);
  };

  const handleCreateTemplate = (category = 'Default', color = '#8b5cf6') => {
    setCurrentTemplate({
      id: null, // New template has no ID initially
      name: '',
      exercises: [],
      category: category,
      color: color
    });
    setView('EDIT_TEMPLATE');
  };

  const handleEditTemplate = (t) => {
    setCurrentTemplate({ ...t });
    setView('EDIT_TEMPLATE');
  };

  const handleDeleteTemplate = async (id) => {
    setConfirmDialog({
      message: t('common.confirmDelete'),
      onConfirm: async () => {
        await dbDelete('templates', id);
        setTemplates(templates.filter(t => t.id !== id));
        setView('HOME');
      }
    });
  };

  const handleSaveTemplate = async (updatedTemplate) => {
    const templateToSave = {
      ...updatedTemplate,
      id: updatedTemplate.id || Date.now()
    };
    await dbPut('templates', templateToSave);
    const newTemplates = templates.find(t => t.id === templateToSave.id)
      ? templates.map(t => t.id === templateToSave.id ? templateToSave : t)
      : [templateToSave, ...templates];
    setTemplates(newTemplates);
    setView('HOME');
  };

  const handleStartWorkout = (template) => {
    // Find last session for this template to inherit data
    const lastSession = sessions.find(s => s.templateId === template.id);

    const session = {
      id: Date.now(),
      templateId: template.id,
      name: template.name,
      color: template.color || '#8b5cf6',
      date: new Date().toISOString(),
      exercises: template.exercises.map(ex => {
        const isCardio = ex.category === 'Cardio';
        let sets = isCardio
          ? [{ incline: '', pace: '', time: '', distance: '', completed: false, note: '', startTime: null, endTime: null }]
          : [{ reps: '', weight: '', completed: false, note: '', startTime: null, endTime: null }];

        if (lastSession && !isCardio) {
          const lastEx = lastSession.exercises.find(le => le.name === ex.name);
          if (lastEx && lastEx.sets.length > 0) {
            sets = lastEx.sets.map(ls => ({
              reps: (inheritMode === 'all' || inheritMode === 'reps') ? ls.reps : '',
              weight: (inheritMode === 'all' || inheritMode === 'weight') ? ls.weight : '',
              completed: false,
              note: '',
              startTime: null,
              endTime: null
            }));
          }
        }

        return {
          ...ex,
          note: '',
          sets: sets
        };
      })
    };
    setActiveSession(session);
    setView('WORKOUT');
  };

  const handleFinishWorkout = async (session) => {
    // Sanitize session data: convert empty numeric strings to '0'
    const sanitizedSession = {
      ...session,
      exercises: session.exercises.map(ex => ({
        ...ex,
        sets: ex.sets.map(set => {
          const newSet = { ...set };
          if (ex.category === 'Cardio') {
            ['incline', 'pace', 'time', 'distance'].forEach(field => {
              if (newSet[field] === '') newSet[field] = '0';
            });
          } else {
            if (newSet.reps === '') newSet.reps = '0';
            if (newSet.weight === '') newSet.weight = '0';
          }
          return newSet;
        })
      }))
    };
    await dbPut('sessions', sanitizedSession);
    setSessions([sanitizedSession, ...sessions]);
    setView('HOME');
  };

  const handleExport = async (targetRef, sessionName) => {
    if (targetRef.current === null) return;

    const buttons = targetRef.current.querySelectorAll('button');
    buttons.forEach(b => b.style.display = 'none');

    try {
      const dataUrl = await toPng(targetRef.current, {
        cacheBust: true,
        backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bg-color').trim(),
        style: { borderRadius: '0' }
      });
      const link = document.createElement('a');
      link.download = `Workout-${sessionName}-${new Date().toISOString().split('T')[0]}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Export failed', err);
    } finally {
      buttons.forEach(b => b.style.display = 'flex');
    }
  };

  const handleDeleteSession = async (sessionId) => {
    await dbDelete('sessions', sessionId);
    setSessions(sessions.filter(s => s.id !== sessionId));
  };

  return (
    <div className="container">
      <div className="bg-blob blob-1"></div>
      <div className="bg-blob blob-2"></div>

      <header className="flex-between" style={{ marginBottom: '2rem', paddingTop: '0.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '800', lineHeight: 1.1 }}>{t('home.title')}</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{t('home.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <button
            className="btn-ghost"
            onClick={() => setUserGender(userGender === 'male' ? 'female' : 'male')}
            title={`Gender: ${userGender}`}
            style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: userGender === 'male' ? '#60a5fa' : '#f472b6' }}
          >
            {userGender === 'male' ? <MaleSymbol size={22} /> : <FemaleSymbol size={22} />}
          </button>
          <button className="btn-ghost" onClick={toggleTheme} title={`Theme: ${themeMode}`}>
            {themeMode === 'auto' && <SunMoon size={20} />}
            {themeMode === 'light' && <Sun size={20} />}
            {themeMode === 'dark' && <Moon size={20} />}
          </button>
          <button className="btn-ghost" onClick={toggleLanguage}><Languages size={20} /></button>
        </div>
      </header>

      {view === 'HOME' && (
        <HomeView
          templates={templates}
          onStart={handleStartWorkout}
          onEdit={handleEditTemplate}
          onDelete={handleDeleteTemplate}
          onCreate={handleCreateTemplate}
          onViewHistory={() => setView('HISTORY')}
          userGender={userGender}
        />
      )}

      {view === 'EDIT_TEMPLATE' && (
        <TemplateEditor
          template={currentTemplate}
          templates={templates}
          onSave={handleSaveTemplate}
          onDelete={handleDeleteTemplate}
          onBack={() => setView('HOME')}
          setConfirmDialog={setConfirmDialog}
          userGender={userGender}
        />
      )}

      {view === 'WORKOUT' && (
        <WorkoutView
          session={activeSession}
          onFinish={handleFinishWorkout}
          onBack={() => setView('HOME')}
          setConfirmDialog={setConfirmDialog}
          weightUnit={weightUnit}
          onToggleUnit={() => setWeightUnit(weightUnit === 'kg' ? 'lbs' : 'kg')}
        />
      )}

      {view === 'HISTORY' && (
        <HistoryView
          sessions={sessions}
          templates={templates}
          onBack={() => setView('HOME')}
          onExport={handleExport}
          weightUnit={weightUnit}
          onDeleteSession={handleDeleteSession}
          setConfirmDialog={setConfirmDialog}
          userGender={userGender}
          setUserGender={setUserGender}
        />
      )}

      {['HOME', 'HISTORY'].includes(view) && (
        <nav className="bottom-nav glass">
          <button
            className={`nav-item ${view === 'HISTORY' ? 'active' : ''}`}
            onClick={() => setView('HISTORY')}
          >
            <Calendar size={24} />
            <span>{t('nav.history')}</span>
          </button>

          <button className="nav-item action-btn" onClick={() => setShowTemplateSelector(true)}>
            <Plus size={28} />
            <span>{t('nav.newWorkout')}</span>
          </button>

          <button
            className={`nav-item ${view === 'HOME' ? 'active' : ''}`}
            onClick={() => setView('HOME')}
          >
            <Home size={24} />
            <span>{t('nav.home')}</span>
          </button>
        </nav>
      )}

      {showTemplateSelector && (
        <div className="modal-overlay fade-in" onClick={() => setShowTemplateSelector(false)}>
          <div className="glass modal-content" onClick={e => e.stopPropagation()}>
            <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem' }}>{t('nav.newWorkout')}</h2>
              <button className="btn-ghost" onClick={() => setShowTemplateSelector(false)}><Plus size={24} style={{ transform: 'rotate(45deg)' }} /></button>
            </div>

            <div className="glass" style={{ marginBottom: '1.5rem', padding: '0.4rem', borderRadius: '14px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
              <button
                onClick={() => setInheritMode('all')}
                style={{
                  padding: '0.4rem',
                  fontSize: '0.65rem',
                  fontWeight: '600',
                  borderRadius: '8px',
                  background: inheritMode === 'all' ? 'var(--primary-color)' : 'transparent',
                  color: inheritMode === 'all' ? 'white' : 'var(--text-secondary)',
                  border: inheritMode === 'all' ? 'none' : '1px solid var(--card-border)',
                  whiteSpace: 'nowrap'
                }}
              >
                {t('inherit.all')}
              </button>
              <button
                onClick={() => setInheritMode('weight')}
                style={{
                  padding: '0.4rem',
                  fontSize: '0.65rem',
                  fontWeight: '600',
                  borderRadius: '8px',
                  background: inheritMode === 'weight' ? 'var(--primary-color)' : 'transparent',
                  color: inheritMode === 'weight' ? 'white' : 'var(--text-secondary)',
                  border: inheritMode === 'weight' ? 'none' : '1px solid var(--card-border)',
                  whiteSpace: 'nowrap'
                }}
              >
                {t('inherit.weight')}
              </button>
              <button
                onClick={() => setInheritMode('reps')}
                style={{
                  padding: '0.4rem',
                  fontSize: '0.65rem',
                  fontWeight: '600',
                  borderRadius: '8px',
                  background: inheritMode === 'reps' ? 'var(--primary-color)' : 'transparent',
                  color: inheritMode === 'reps' ? 'white' : 'var(--text-secondary)',
                  border: inheritMode === 'reps' ? 'none' : '1px solid var(--card-border)',
                  whiteSpace: 'nowrap'
                }}
              >
                {t('inherit.reps')}
              </button>
              <button
                onClick={() => setInheritMode('none')}
                style={{
                  padding: '0.4rem',
                  fontSize: '0.65rem',
                  fontWeight: '600',
                  borderRadius: '8px',
                  background: inheritMode === 'none' ? 'var(--primary-color)' : 'transparent',
                  color: inheritMode === 'none' ? 'white' : 'var(--text-secondary)',
                  border: inheritMode === 'none' ? 'none' : '1px solid var(--card-border)',
                  whiteSpace: 'nowrap'
                }}
              >
                {t('inherit.none')}
              </button>
            </div>

            <div style={{ maxHeight: '50vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {templates.length === 0 ? (
                <p style={{ textAlign: 'center', opacity: 0.5 }}>{t('home.noTemplates')}</p>
              ) : (
                templates.map(t_item => (
                  <button
                    key={t_item.id}
                    className="glass card flex-between"
                    style={{ width: '100%', padding: '1rem', textAlign: 'left', margin: 0 }}
                    onClick={() => {
                      handleStartWorkout(t_item);
                      setShowTemplateSelector(false);
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <span style={{ color: t_item.color || 'var(--primary-color)', fontWeight: '600', marginRight: '0.5rem' }}>
                        [{t_item.category || 'Default'}]
                      </span>
                      <span style={{ fontWeight: '500' }}>{t_item.name}</span>
                    </div>
                    <Play size={18} style={{ color: t_item.color || 'var(--primary-color)', opacity: 0.8 }} />
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {confirmDialog && (
        <div className="modal-overlay fade-in" style={{ zIndex: 3000 }} onClick={() => setConfirmDialog(null)}>
          <div className="glass modal-content animate-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '320px', textAlign: 'center', padding: '2rem' }}>
            <p style={{ fontSize: '1.1rem', marginBottom: '2rem', fontWeight: '500' }}>{confirmDialog.message}</p>
            <div className="flex" style={{ gap: '1.25rem' }}>
              <button className="btn-ghost" onClick={() => setConfirmDialog(null)} style={{ flex: 1, padding: '0.8rem', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }}>{t('common.back')}</button>
              <button className="btn-primary" onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }} style={{ flex: 1, background: '#ef4444', padding: '0.8rem', borderRadius: '12px', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)' }}>{t('common.delete')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Sub-Views ---

const HomeView = ({ templates, onStart, onEdit, onDelete, onCreate, onViewHistory, userGender }) => {
  const { t } = useTranslation();
  return (
    <div className="fade-in">

      <section style={{ paddingBottom: '100px' }}>
        <div className="flex-between" style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem' }}>{t('home.myTemplates')}</h2>
          <button className="btn-primary flex-between gap-2" onClick={() => onCreate()}>
            <Plus size={18} /> {t('common.new')}
          </button>
        </div>

        {templates.length === 0 ? (
          <div className="glass card" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
            {t('home.noTemplates')}
          </div>
        ) : (
          Object.entries((templates || []).reduce((acc, t_item) => {
            const cat = t_item.category || 'Default';
            if (!acc[cat]) acc[cat] = [];
            acc[cat].push(t_item);
            return acc;
          }, {})).map(([category, items]) => (
            <div key={category} style={{ marginBottom: '2.5rem' }}>
              <h3 style={{
                fontSize: '0.9rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: items[0]?.color || 'var(--primary-color)',
                marginBottom: '1rem',
                borderLeft: `3px solid ${items[0]?.color || 'var(--primary-color)'}`,
                paddingLeft: '0.75rem'
              }}>
                {category}
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                {items.map(t_item => {
                  {/* Exercise Listing */ }

                  return (
                    <div key={t_item.id} className="glass card" style={{ margin: 0, borderTop: `4px solid ${t_item.color || 'var(--primary-color)'}` }}>
                      <div className="flex-between" style={{ marginBottom: '1rem' }} onClick={() => onEdit(t_item)}>
                        <div style={{ cursor: 'pointer', flex: 1 }}>
                          <h3 style={{ marginBottom: '0.25rem' }}>{t_item.name}</h3>
                          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                            {t('home.exercisesCount', { count: (t_item.exercises || []).length })}
                          </p>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '0.4rem' }}>
                        {(t_item.exercises || []).slice(0, 6).map(ex => (
                          <div key={ex.id} style={{
                            fontSize: '0.7rem',
                            textAlign: 'center',
                            padding: '0.3rem',
                            background: 'rgba(255,255,255,0.05)',
                            borderRadius: '6px',
                            opacity: 0.8,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {ex.name || '?'}
                          </div>
                        ))}
                        {(t_item.exercises || []).length > 6 && (
                          <div style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', textAlign: 'center', alignSelf: 'center' }}>
                            ...
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
};


const TemplateEditor = ({ template, templates, onSave, onDelete, onBack, setConfirmDialog, userGender }) => {
  const { t } = useTranslation();
  const [name, setName] = useState(template.name);
  const [category, setCategory] = useState(template.category || 'Default');
  const [exercises, setExercises] = useState(template.exercises || []);
  const [color, setColor] = useState(template.color || '#8b5cf6');
  // Calculate active muscles dynamically from all exercises
  const activeMuscles = [...new Set(['hair', ...exercises.flatMap(e => e.muscles || [])])];

  const muscleGroups = [
    { id: 'abs', name: t('muscles.abs'), side: 'front' },
    { id: 'adductors', name: t('muscles.adductors'), side: 'front' },
    { id: 'ankles', name: t('muscles.ankles'), side: 'front' },
    { id: 'biceps', name: t('muscles.biceps'), side: 'front' },
    { id: 'calves', name: t('muscles.calves'), side: 'back' },
    { id: 'chest', name: t('muscles.chest'), side: 'front' },
    { id: 'deltoids', name: t('muscles.deltoids'), side: 'front' },
    { id: 'feet', name: t('muscles.feet'), side: 'front' },
    { id: 'forearm', name: t('muscles.forearm'), side: 'front' },
    { id: 'gluteal', name: t('muscles.gluteal'), side: 'back' },
    { id: 'hair', name: t('muscles.hair'), side: 'front' },
    { id: 'hamstring', name: t('muscles.hamstrings'), side: 'back' },
    { id: 'hands', name: t('muscles.hands'), side: 'front' },
    { id: 'head', name: t('muscles.head'), side: 'front' },
    { id: 'knees', name: t('muscles.knees'), side: 'front' },
    { id: 'lower-back', name: t('muscles.lower-back'), side: 'back' },
    { id: 'neck', name: t('muscles.neck'), side: 'front' },
    { id: 'obliques', name: t('muscles.obliques'), side: 'front' },
    { id: 'quadriceps', name: t('muscles.quadriceps'), side: 'front' },
    { id: 'tibialis', name: t('muscles.tibialis'), side: 'front' },
    { id: 'trapezius', name: t('muscles.trapezius'), side: 'back' },
    { id: 'triceps', name: t('muscles.triceps'), side: 'back' },
    { id: 'upper-back', name: t('muscles.upper-back'), side: 'back' },
  ];

  const presetColors = [
    '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
    '#ec4899', '#06b6d4', '#84cc16', '#a855f7', '#6366f1'
  ];

  const defaultCategories = ['Default'];
  const existingCategories = [...new Set([
    ...defaultCategories,
    ...templates.map(t => t.category).filter(Boolean)
  ])];
  const [showCatDropdown, setShowCatDropdown] = useState(false);
  const [activeDropdownId, setActiveDropdownId] = useState(null);
  const [menuView, setMenuView] = useState(null);
  const catRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (catRef.current && !catRef.current.contains(event.target)) {
        setShowCatDropdown(false);
      }
      // Always close muscle dropdown if click reaches document
      if (!event.target.closest('.muscle-dropdown-container')) {
        setActiveDropdownId(null);
        setMenuView(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const addExercise = (type = 'Strength') => {
    setExercises([...exercises, {
      id: Date.now(),
      name: '',
      category: type,
      sets: [{ reps: '', weight: '', completed: false, note: '' }],
      muscles: []
    }]);
  };

  const removeExercise = (id) => {
    setConfirmDialog({
      message: t('common.confirmDelete'),
      onConfirm: () => {
        setExercises(exercises.filter(ex => ex.id !== id));
      }
    });
  };

  const updateExercise = (id, field, value) => {
    setExercises(exercises.map(ex => ex.id === id ? { ...ex, [field]: value } : ex));
  };

  const renderBody = (viewSide) => (
    <div style={{ position: 'relative', width: '80px', height: '140px', display: 'flex', justifyContent: 'center' }}>
      {/* Ghost layer - Background */}
      <div style={{ position: 'absolute', opacity: 0.15 }}>
        <Body
          data={[]}
          colors={['rgba(255, 255, 255, 0.2)', 'transparent']}
          gender={userGender}
          side={viewSide}
          scale={0.8}
        />
      </div>
      {/* Energy layer - Selected Muscles Solid Color */}
      <div style={{ position: 'absolute', opacity: 1 }}>
        <Body
          data={activeMuscles
            .filter(m => ['abs', 'adductors', 'ankles', 'biceps', 'calves', 'chest', 'deltoids', 'feet', 'forearm', 'gluteal', 'hair', 'hamstring', 'hands', 'head', 'knees', 'lower-back', 'neck', 'obliques', 'quadriceps', 'tibialis', 'trapezius', 'triceps', 'upper-back'].includes(m))
            .map(m => ({ slug: m, intensity: 1 }))}
          colors={[color, color]}
          gender={userGender}
          side={viewSide}
          scale={0.8}
        />
      </div>
    </div>
  );

  return (
    <div className="fade-in">
      <header className="flex-between" style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '12px', marginBottom: '2rem' }}>
        <button className="btn-ghost" onClick={onBack}><ChevronLeft size={24} /></button>
        <h2 style={{ fontSize: '1rem' }}>{template.id ? t('editor.editTemplate') : t('editor.newTemplate')}</h2>
        <button className="btn-primary" style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }} onClick={() => onSave({ ...template, name, exercises, category, color, muscles: activeMuscles })}>{t('common.save')}</button>
      </header>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3rem', justifyContent: 'center', marginBottom: '3rem' }}>
        {/* Left Side: Compact Muscle Visualizer */}
        <div style={{
          display: 'flex',
          gap: '1rem',
          background: 'rgba(255,255,255,0.02)',
          padding: '1rem', // Reduced padding
          borderRadius: '20px',
          alignItems: 'center'
        }}>
          <div style={{ textAlign: 'center' }}>
            {/* <div style={{ fontSize: '0.6rem', opacity: 0.3, marginBottom: '0.5rem', textTransform: 'uppercase' }}>{t('muscles.front')}</div> */}
            <div style={{ position: 'relative', width: '50px', height: '100px', display: 'flex', justifyContent: 'center' }}>
              <div style={{ position: 'absolute', opacity: 0.15 }}>
                <Body data={[]} colors={['rgba(255, 255, 255, 0.2)', 'transparent']} gender={userGender} side="front" scale={0.45} />
              </div>
              <div style={{ position: 'absolute', opacity: 1 }}>
                <Body
                  data={activeMuscles.filter(m => ['abs', 'adductors', 'ankles', 'biceps', 'calves', 'chest', 'deltoids', 'feet', 'forearm', 'gluteal', 'hair', 'hamstring', 'hands', 'knees', 'lower-back', 'neck', 'obliques', 'quadriceps', 'tibialis', 'trapezius', 'triceps', 'upper-back'].includes(m)).map(m => ({ slug: m, intensity: 1 }))}
                  colors={[color, color]} gender={userGender} side="front" scale={0.45}
                />
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            {/* <div style={{ fontSize: '0.6rem', opacity: 0.3, marginBottom: '0.5rem', textTransform: 'uppercase' }}>{t('muscles.back_view')}</div> */}
            <div style={{ position: 'relative', width: '50px', height: '100px', display: 'flex', justifyContent: 'center' }}>
              <div style={{ position: 'absolute', opacity: 0.15 }}>
                <Body data={[]} colors={['rgba(255, 255, 255, 0.2)', 'transparent']} gender={userGender} side="back" scale={0.45} />
              </div>
              <div style={{ position: 'absolute', opacity: 1 }}>
                <Body
                  data={activeMuscles.filter(m => ['abs', 'adductors', 'ankles', 'biceps', 'calves', 'chest', 'deltoids', 'feet', 'forearm', 'gluteal', 'hair', 'hamstring', 'hands', 'knees', 'lower-back', 'neck', 'obliques', 'quadriceps', 'tibialis', 'trapezius', 'triceps', 'upper-back'].includes(m)).map(m => ({ slug: m, intensity: 1 }))}
                  colors={[color, color]} gender={userGender} side="back" scale={0.45}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Form Controls */}
        <div style={{ flex: 1, minWidth: '280px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Template Name */}
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{t('editor.templateName')}</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('editor.placeholderName')}
              style={{ padding: '0.75rem', width: '100%', fontSize: '1.2rem', fontWeight: 'bold' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            {/* Group Selector */}
            <div ref={catRef} style={{ position: 'relative', flex: 1, minWidth: '150px' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Group</label>
              <div style={{ position: 'relative' }}>
                <input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  onFocus={() => setShowCatDropdown(true)}
                  placeholder="Select or Type"
                  style={{ padding: '0.75rem', width: '100%', paddingRight: '2rem' }}
                />
                <div
                  onClick={() => setShowCatDropdown(!showCatDropdown)}
                  style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', opacity: 0.5, display: 'flex' }}
                >
                  <Plus size={14} style={{ transform: showCatDropdown ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s' }} />
                </div>

                {showCatDropdown && (
                  <div className="glass" style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 100,
                    marginTop: '0.5rem',
                    borderRadius: '12px',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                    border: '1px solid var(--card-border)'
                  }}>
                    {existingCategories.map(cat => (
                      <div
                        key={cat}
                        onClick={() => {
                          setCategory(cat);
                          setShowCatDropdown(false);
                        }}
                        style={{
                          padding: '0.75rem 1rem',
                          cursor: 'pointer',
                          fontSize: '0.9rem',
                          background: category === cat ? 'rgba(255,255,255,0.1)' : 'transparent',
                          borderBottom: '1px solid rgba(255,255,255,0.05)'
                        }}
                        onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.05)'}
                        onMouseLeave={(e) => e.target.style.background = category === cat ? 'rgba(255,255,255,0.1)' : 'transparent'}
                      >
                        {cat}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Color Picker */}
            <div style={{ flex: 1, minWidth: '150px' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Theme Color</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                {presetColors.slice(0, 5).map(c => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: c,
                      border: color === c ? '2px solid white' : 'none',
                      cursor: 'pointer',
                      boxShadow: color === c ? `0 0 8px ${c}` : 'none'
                    }}
                  />
                ))}
                <div style={{ position: 'relative', width: '24px', height: '24px' }}>
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                  />
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: 'linear-gradient(45deg, red, yellow, green, blue)',
                    border: !presetColors.slice(0, 5).includes(color) ? '2px solid white' : 'none'
                  }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <section>
        <div style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>{t('editor.exercises')}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <button
              className="btn-ghost"
              onClick={() => addExercise('Strength')}
              style={{
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                background: 'rgba(239, 68, 68, 0.05)',
                padding: '0.8rem',
                borderRadius: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                fontSize: '0.9rem',
                fontWeight: '600'
              }}
            >
              <Plus size={18} />
              {t('common.strength')}
            </button>
            <button
              className="btn-ghost"
              onClick={() => addExercise('Cardio')}
              style={{
                border: '1px solid rgba(59, 130, 246, 0.3)',
                color: '#3b82f6',
                background: 'rgba(59, 130, 246, 0.05)',
                padding: '0.8rem',
                borderRadius: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                fontSize: '0.9rem',
                fontWeight: '600'
              }}
            >
              <Plus size={18} />
              {t('common.cardio')}
            </button>
          </div>
        </div>

        {exercises.map((ex, index) => (
          <div key={ex.id} className="glass card" style={{ padding: '1rem', borderTop: `2px solid ${ex.category === 'Cardio' ? '#3b82f6' : color}`, overflow: 'hidden' }}>
            <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', opacity: 0.5, marginBottom: '0.5rem', color: ex.category === 'Cardio' ? '#3b82f6' : color, fontWeight: '800' }}>
              {ex.category || 'Strength'}
            </div>
            <div className="flex-between">
              <input
                placeholder={t('editor.exerciseName')}
                value={ex.name}
                onChange={(e) => updateExercise(ex.id, 'name', e.target.value)}
                style={{ background: 'transparent', border: 'none', fontSize: '1.1rem', fontWeight: '600', padding: 0 }}
              />
              <button className="btn-ghost" onClick={() => removeExercise(ex.id)}><Trash2 size={18} /></button>
            </div>

            {/* Per-Exercise Muscle Selector */}
            <div style={{ marginTop: '0.8rem' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                {(ex.muscles || []).map(mId => {
                  const muscleName = muscleGroups.find(mg => mg.id === mId)?.name || mId;
                  return (
                    <span key={mId} className="badge" style={{
                      background: 'rgba(255,255,255,0.08)',
                      fontSize: '0.7rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      paddingRight: '4px'
                    }}>
                      {muscleName}
                      <button
                        onClick={() => updateExercise(ex.id, 'muscles', (ex.muscles || []).filter(m => m !== mId))}
                        style={{ padding: 2, display: 'flex', background: 'transparent' }}
                      >
                        <Plus size={12} style={{ transform: 'rotate(45deg)', opacity: 0.6 }} />
                      </button>
                    </span>
                  );
                })}

                <div
                  style={{ position: 'relative' }}
                  className="muscle-dropdown-container"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <button
                    className="badge-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (activeDropdownId === ex.id) {
                        setActiveDropdownId(null);
                        setMenuView(null);
                      } else {
                        setActiveDropdownId(ex.id);
                        setMenuView(null);
                      }
                    }}
                    style={{ fontSize: '0.7rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                  >
                    <Plus size={10} /> {t('muscles.title')}
                  </button>

                  {/* Dropdown removed from here */}
                </div>
              </div>
            </div>
          </div>
        ))}

        {templates.some(t_item => t_item.id === template.id) && (
          <div style={{ marginTop: '4rem', padding: '0 1rem' }}>
            <button
              className="btn-ghost"
              onClick={() => onDelete(template.id)}
              style={{
                width: '100%',
                color: '#ef4444',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                padding: '1rem',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                fontWeight: '600',
                background: 'rgba(239, 68, 68, 0.05)'
              }}
            >
              <Trash2 size={20} />
              {t('common.delete')} {t('nav.home')}
            </button>
          </div>
        )}
      </section>

      {/* Global Muscle Selection Modal */}
      {activeDropdownId && (() => {
        const ex = exercises.find(e => e.id === activeDropdownId);
        if (!ex) return null;

        return (
          <>
            {/* Backdrop */}
            <div
              style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 999, backdropFilter: 'blur(2px)' }}
              onClick={() => { setActiveDropdownId(null); setMenuView(null); }}
            />
            {/* Modal */}
            <div className="glass muscle-dropdown-container" style={{
              position: 'fixed',
              top: '60%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 1000,
              width: 'min(85%, 320px)',
              maxHeight: '60vh',
              overflowY: 'auto',
              background: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              borderRadius: '20px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem'
            }}>
              {/* Level 1: Categories */}
              {!menuView && (
                <>
                  {[
                    { id: 'upper_body', label: t('muscles.upper_body'), icon: '⬆️' },
                    { id: 'arms_shoulders', label: t('muscles.arms_shoulders'), icon: '💪' },
                    { id: 'lower_body', label: t('muscles.lower_body'), icon: '⬇️' }
                  ].map(cat => (
                    <button
                      key={cat.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuView(cat.id);
                      }}
                      style={{
                        padding: '1rem',
                        borderRadius: '12px',
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        color: 'var(--text-primary)',
                        textAlign: 'left',
                        fontSize: '0.9rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.8rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.1)'}
                      onMouseLeave={(e) => e.target.style.background = 'rgba(255,255,255,0.05)'}
                    >
                      <span style={{ fontSize: '1.2rem' }}>{cat.icon}</span> {cat.label}
                      <ChevronRight size={16} style={{ marginLeft: 'auto', opacity: 0.5 }} />
                    </button>
                  ))}
                </>
              )}

              {/* Level 2: Body Parts */}
              {menuView && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingBottom: '0.8rem', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '0.3rem' }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setMenuView(null); }}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', padding: 0 }}
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <span style={{ fontSize: '0.9rem', fontWeight: 'bold', marginLeft: '0.2rem' }}>
                      {menuView === 'upper_body' ? t('muscles.upper_body') :
                        menuView === 'arms_shoulders' ? t('muscles.arms_shoulders') :
                          t('muscles.lower_body')}
                    </span>
                  </div>

                  {(() => {
                    const groups = {
                      'upper_body': ['chest', 'abs', 'obliques', 'upper-back', 'lower-back', 'trapezius', 'neck'],
                      'arms_shoulders': ['deltoids', 'biceps', 'triceps', 'forearm', 'hands'],
                      'lower_body': ['gluteal', 'quadriceps', 'hamstring', 'adductors', 'calves', 'tibialis', 'knees', 'ankles', 'feet']
                    };

                    return groups[menuView].map(mId => {
                      const mg = muscleGroups.find(m => m.id === mId) || { id: mId, name: mId };
                      const isSelected = (ex.muscles || []).includes(mg.id);
                      return (
                        <div
                          key={mg.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            const newMuscles = isSelected
                              ? (ex.muscles || []).filter(m => m !== mg.id)
                              : [...(ex.muscles || []), mg.id];
                            updateExercise(ex.id, 'muscles', newMuscles);
                          }}
                          style={{
                            padding: '0.6rem 0.8rem',
                            fontSize: '0.9rem',
                            cursor: 'pointer',
                            background: isSelected ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                            color: isSelected ? '#fff' : 'var(--text-secondary)',
                            borderRadius: '8px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          {mg.name}
                          {isSelected && <span style={{ fontWeight: 'bold', fontSize: '1.2rem', color: '#818cf8' }}>✓</span>}
                        </div>
                      );
                    });
                  })()}
                </>
              )}
            </div>
          </>
        );
      })()}

    </div >
  );
};

const TimelineBar = ({ sets, color, showLabels, weightUnit }) => {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const hasStarted = sets.some(s => s.startTime);
    const allFinished = sets.length > 0 && sets.every(s => s.completed);
    if (!hasStarted || allFinished) return;

    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [sets]);

  const segments = [];
  let previousEndTime = null;

  sets.forEach((set, idx) => {
    // 1. Add historical rest if this set started after a previous set ended
    if (set.startTime && previousEndTime && set.startTime > previousEndTime) {
      segments.push({
        type: 'rest',
        duration: set.startTime - previousEndTime,
        active: false
      });
    }

    // 2. Add work segment
    if (set.startTime) {
      segments.push({
        type: 'work',
        duration: (set.endTime || now) - set.startTime,
        active: !set.endTime,
        weight: set.weight,
        reps: set.reps
      });
      // Update previousEndTime for the next iteration
      previousEndTime = set.endTime;
    }
  });

  // 3. Handle active rest (only for active workouts)
  if (!showLabels && previousEndTime && previousEndTime < now) {
    segments.push({
      type: 'rest',
      duration: now - previousEndTime,
      active: true
    });
  }

  if (segments.length === 0) return null;

  // New predictable scaling: 
  // Each work set gets a base weight of 100.
  // Each rest gets a weight based on duration but capped at 40 (0.4 of a work set).
  const processedSegments = segments.map(seg => {
    if (seg.type === 'work') {
      return { ...seg, val: 100 };
    } else {
      // Logarithmic scaling for rest: 
      // 10s -> ~20, 60s -> ~35, 600s -> ~55 (uncapped)
      let restVal = Math.log10(Math.max(seg.duration / 1000, 1) + 2) * 20; // Adjusted for better visual
      // Strict cap: no rest can be wider than 40% of a standard work set
      return { ...seg, val: Math.min(restVal, 40) };
    }
  });

  const total = processedSegments.reduce((s, seg) => s + seg.val, 0);

  const formatDur = (ms) => {
    const s = Math.round(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const rs = s % 60;
    return `${m}'${rs}"`;
  };

  return (
    <div style={{ margin: showLabels ? '0.5rem 0 1rem 0' : '0.75rem 0' }}>
      {/* Top Labels: Rest Times */}
      <div style={{ display: 'flex', width: '100%', marginBottom: '4px' }}>
        {processedSegments.map((seg, i) => (
          <div key={i} style={{
            width: `${(seg.val / total) * 100}%`,
            textAlign: 'center',
            fontSize: '0.6rem',
            color: 'var(--text-secondary)',
            fontWeight: '600',
            opacity: 0.8,
            height: '14px',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center'
          }}>
            {seg.type === 'rest' && seg.duration > 5000 && (
              <span style={{ whiteSpace: 'nowrap' }}>{formatDur(seg.duration)}</span>
            )}
          </div>
        ))}
      </div>

      {/* The Bar */}
      <div style={{ height: '8px', width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', display: 'flex', overflow: 'hidden', marginBottom: showLabels ? '6px' : '0' }}>
        {processedSegments.map((seg, i) => (
          <div key={i} style={{
            width: `${(seg.val / total) * 100}%`,
            height: '100%',
            background: seg.type === 'work' ? color : 'rgba(255,255,255,0.1)',
            opacity: seg.active ? 0.8 : 1,
            transition: 'all 0.5s ease',
            position: 'relative',
            borderRight: '1px solid rgba(0,0,0,0.1)'
          }}>
            {seg.active && (
              <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 1, bottom: 0,
                background: 'white', opacity: 0.3,
                animation: 'pulse 2s infinite'
              }} />
            )}
          </div>
        ))}
      </div>

      {/* Bottom Labels: Work Stats */}
      {showLabels && (
        <div style={{ display: 'flex', width: '100%' }}>
          {processedSegments.map((seg, i) => (
            <div key={i} style={{
              width: `${(seg.val / total) * 100}%`,
              textAlign: 'center',
              fontSize: '0.65rem',
              color: 'var(--text-secondary)',
              opacity: 0.9,
              fontWeight: '500',
              whiteSpace: 'nowrap',
              overflow: 'hidden'
            }}>
              {seg.type === 'work' && (
                <span>{seg.weight}{weightUnit}×{seg.reps}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const WorkoutView = ({ session: initialSession, onFinish, onBack, setConfirmDialog, weightUnit, onToggleUnit }) => {
  const { t } = useTranslation();
  const [session, setSession] = useState(initialSession);

  const updateSet = (exIdx, setIdx, field, value) => {
    setSession(prev => {
      const newSession = { ...prev };
      newSession.exercises = [...prev.exercises];
      newSession.exercises[exIdx] = { ...prev.exercises[exIdx] };
      newSession.exercises[exIdx].sets = [...prev.exercises[exIdx].sets];
      newSession.exercises[exIdx].sets[setIdx] = {
        ...prev.exercises[exIdx].sets[setIdx],
        [field]: value
      };
      return newSession;
    });
  };

  const toggleSet = (exIdx, setIdx) => {
    setSession(prev => {
      const newSession = { ...prev };
      newSession.exercises = [...prev.exercises];
      newSession.exercises[exIdx] = { ...prev.exercises[exIdx] };
      newSession.exercises[exIdx].sets = [...prev.exercises[exIdx].sets];

      const set = { ...newSession.exercises[exIdx].sets[setIdx] };
      const now = Date.now();

      if (!set.completed) {
        set.completed = true;
        set.endTime = now;
        // If it was never started, auto-start it at the same time
        if (!set.startTime) set.startTime = now;
      } else {
        set.completed = false;
        set.endTime = null;
      }

      newSession.exercises[exIdx].sets[setIdx] = set;
      return newSession;
    });
  };

  const startSet = (exIdx, setIdx) => {
    setSession(prev => {
      const newSession = { ...prev };
      newSession.exercises = [...prev.exercises];
      newSession.exercises[exIdx] = { ...prev.exercises[exIdx] };
      newSession.exercises[exIdx].sets = [...prev.exercises[exIdx].sets];

      const set = { ...newSession.exercises[exIdx].sets[setIdx], startTime: Date.now() };
      newSession.exercises[exIdx].sets[setIdx] = set;
      return newSession;
    });
  };

  const addSet = (exIdx) => {
    setSession(prev => {
      const newSession = { ...prev };
      newSession.exercises = [...prev.exercises];
      newSession.exercises[exIdx] = { ...prev.exercises[exIdx] };
      newSession.exercises[exIdx].sets = [...prev.exercises[exIdx].sets];

      const lastEx = newSession.exercises[exIdx];
      const isCardio = lastEx.category === 'Cardio';

      if (isCardio) {
        newSession.exercises[exIdx].sets.push({
          incline: '',
          pace: '',
          time: '',
          distance: '',
          completed: false,
          note: '',
          startTime: null,
          endTime: null
        });
      } else {
        const lastSet = lastEx.sets[lastEx.sets.length - 1];
        newSession.exercises[exIdx].sets.push({
          reps: lastSet ? lastSet.reps : '',
          weight: lastSet ? lastSet.weight : '',
          completed: false,
          note: '',
          startTime: null,
          endTime: null
        });
      }
      return newSession;
    });
  };

  const addExerciseInWorkout = (category = 'Strength') => {
    setSession(prev => {
      const newSession = { ...prev };
      newSession.exercises = [...prev.exercises, {
        id: Date.now() + Math.random(),
        name: '',
        category: category,
        sets: []
      }];
      return newSession;
    });
  };

  const updateExerciseInWorkout = (exIdx, field, value) => {
    setSession(prev => {
      const newSession = { ...prev };
      newSession.exercises = [...prev.exercises];
      newSession.exercises[exIdx] = { ...prev.exercises[exIdx], [field]: value };
      return newSession;
    });
  };

  const removeSet = (exIdx, setIdx) => {
    setConfirmDialog({
      message: t('common.confirmDelete'),
      onConfirm: () => {
        const newSession = { ...session };
        newSession.exercises[exIdx].sets.splice(setIdx, 1);
        setSession(newSession);
      }
    });
  };

  return (
    <div className="fade-in">
      <header className="flex-between" style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '12px', marginBottom: '2rem' }}>
        <button className="btn-ghost" onClick={onBack}><ChevronLeft size={24} /></button>
        <h2 style={{ fontSize: '1rem' }}>{t('workout.title')}</h2>
        <button className="btn-primary" style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }} onClick={() => onFinish(session)}>{t('common.finish')}</button>
      </header>

      <div style={{
        background: 'var(--bg-color)',
        padding: '2rem 1rem',
        '--primary-color': session.color || '#3b82f6' // Dynamic override for this view
      }}>
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2rem' }}>{session.name}</h1>
          <p style={{ color: 'var(--text-secondary)' }}>{new Date(session.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>

        {session.exercises.map((ex, exIdx) => {
          const lastEx = exIdx > 0 ? session.exercises[exIdx - 1] : null;
          const lastSetOfPrev = lastEx ? lastEx.sets[lastEx.sets.length - 1] : null;
          const firstSetOfCurr = ex.sets[0];
          const transitionGap = (lastSetOfPrev?.endTime && firstSetOfCurr?.startTime)
            ? firstSetOfCurr.startTime - lastSetOfPrev.endTime
            : null;

          return (
            <React.Fragment key={exIdx}>
              {transitionGap && transitionGap > 10000 && (
                <div style={{ textAlign: 'center', margin: '1.5rem 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', opacity: 0.5 }}>
                  <div style={{ height: '1px', flex: 1, background: 'var(--text-secondary)', opacity: 0.3 }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <History size={14} style={{ opacity: 0.6 }} />
                    <span style={{ fontSize: '0.75rem', fontWeight: '700', letterSpacing: '0.05em' }}>
                      {t('workout.rest').toUpperCase()} {Math.floor(transitionGap / 60000)}m {(Math.round(transitionGap / 1000) % 60)}s
                    </span>
                  </div>
                  <div style={{ height: '1px', flex: 1, background: 'var(--text-secondary)', opacity: 0.3 }} />
                </div>
              )}
              <div className="exercise-item" style={{ marginBottom: '2.5rem' }}>
                <div className="flex-between">
                  <input
                    placeholder={t('editor.exerciseName')}
                    value={ex.name}
                    onChange={(e) => updateExerciseInWorkout(exIdx, 'name', e.target.value)}
                    style={{ background: 'transparent', border: 'none', fontSize: '1.25rem', fontWeight: '600', padding: 0, marginBottom: '0.25rem', width: '100%' }}
                  />
                </div>
                <TimelineBar sets={ex.sets} color={session.color} />

                {ex.category === 'Cardio' ? (
                  <div className="set-header-row" style={{ display: 'grid', gridTemplateColumns: 'minmax(25px, auto) 1fr 1fr 1fr 1fr 40px', gap: '0.25rem', marginBottom: '0.5rem' }}>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>#</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textAlign: 'center' }}>{t('workout.incline')}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textAlign: 'center' }}>{t('workout.pace')}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textAlign: 'center' }}>{t('workout.time')}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textAlign: 'center' }}>{t('workout.distance')}</div>
                    <div></div>
                  </div>
                ) : (
                  <div className="set-header-row" style={{ display: 'grid', gridTemplateColumns: '30px 1fr 15px 1fr 40px', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>#</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                      <button className="btn-ghost" onClick={onToggleUnit} style={{ fontSize: '0.7rem', padding: '0 4px', textDecoration: 'underline' }}>
                        {t('workout.weight')} ({weightUnit})
                      </button>
                    </div>
                    <div></div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textAlign: 'center' }}>{t('workout.reps')}</div>
                    <div></div>
                  </div>
                )}

                {ex.sets.map((set, setIdx) => (
                  <LongPressSetRow
                    key={`${exIdx}-${setIdx}`}
                    set={set}
                    setIdx={setIdx}
                    onUpdate={(field, value) => updateSet(exIdx, setIdx, field, value)}
                    onToggle={() => toggleSet(exIdx, setIdx)}
                    onStart={() => startSet(exIdx, setIdx)}
                    onDelete={() => removeSet(exIdx, setIdx)}
                    t={t}
                    weightUnit={weightUnit}
                    category={ex.category}
                  />
                ))}

                <div className="flex-between" style={{ marginTop: '0.5rem' }}>
                  <button className="btn-ghost" onClick={() => addSet(exIdx)} style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}>{t('workout.addSet')}</button>
                </div>
              </div>
            </React.Fragment>
          );
        })}

        <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
          <button
            className="btn-ghost"
            onClick={() => addExerciseInWorkout('Strength')}
            style={{
              flex: 1,
              border: '1px dashed var(--card-border)',
              borderRadius: '16px',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.5rem',
              background: 'rgba(255,255,255,0.02)'
            }}
          >
            <Plus size={24} style={{ color: session.color || '#8b5cf6' }} />
            <span style={{ fontSize: '0.8rem', fontWeight: '600', opacity: 0.7 }}>{t('common.strength')}</span>
          </button>
          <button
            className="btn-ghost"
            onClick={() => addExerciseInWorkout('Cardio')}
            style={{
              flex: 1,
              border: '1px dashed var(--card-border)',
              borderRadius: '16px',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.5rem',
              background: 'rgba(255,255,255,0.02)'
            }}
          >
            <Plus size={24} style={{ color: '#3b82f6' }} />
            <span style={{ fontSize: '0.8rem', fontWeight: '600', opacity: 0.7 }}>{t('common.cardio')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

const LongPressSetRow = ({ set, setIdx, onUpdate, onToggle, onStart, onDelete, t, weightUnit, category }) => {
  const [isPressing, setIsPressing] = useState(false);
  const timerRef = useRef(null);

  const startPress = () => {
    setIsPressing(true);
    timerRef.current = setTimeout(() => {
      setIsPressing(false);
      onDelete();
    }, 800);
  };

  const endPress = () => {
    clearTimeout(timerRef.current);
    setIsPressing(false);
  };

  return (
    <div
      className={`set-item-container ${set.completed ? 'checked' : ''} ${isPressing ? 'pressing' : ''}`}
      onMouseDown={startPress}
      onMouseUp={endPress}
      onMouseLeave={endPress}
      onTouchStart={startPress}
      onTouchEnd={endPress}
      style={{ userSelect: 'none' }}
    >
      <div className={`set-row ${set.completed ? 'completed-set' : ''}`} style={category === 'Cardio' ? { gridTemplateColumns: 'minmax(25px, auto) 1fr 1fr 1fr 1fr 40px', gap: '0.25rem' } : {}}>
        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>{setIdx + 1}</div>

        {category === 'Cardio' ? (
          <>
            <input
              type="number"
              inputMode="decimal"
              value={set.incline}
              onChange={(e) => onUpdate('incline', e.target.value)}
              style={{ textAlign: 'center', fontSize: '0.85rem' }}
            />
            <input
              type="text"
              value={set.pace}
              onChange={(e) => onUpdate('pace', e.target.value)}
              style={{ textAlign: 'center', fontSize: '0.85rem' }}
            />
            <input
              type="text"
              value={set.time}
              onChange={(e) => onUpdate('time', e.target.value)}
              style={{ textAlign: 'center', fontSize: '0.85rem' }}
            />
            <input
              type="number"
              inputMode="decimal"
              value={set.distance}
              onChange={(e) => onUpdate('distance', e.target.value)}
              style={{ textAlign: 'center', fontSize: '0.85rem' }}
            />
          </>
        ) : (
          <>
            <div className="weight-input-wrapper">
              <input
                type="number"
                inputMode="decimal"
                value={set.weight}
                onChange={(e) => onUpdate('weight', e.target.value)}
                style={{ textAlign: 'center', width: '100%', paddingRight: '1.8rem' }}
              />
              <span className="unit-label">{weightUnit}</span>
            </div>
            <div className="multiply-sign">×</div>
            <input
              type="number"
              inputMode="numeric"
              value={set.reps}
              onChange={(e) => onUpdate('reps', e.target.value)}
              style={{ textAlign: 'center' }}
            />
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          {set.startTime ? (
            <button
              className={`set-checkbox ${set.completed ? 'checked' : ''}`}
              onClick={onToggle}
            >
              <Check size={18} strokeWidth={3} />
            </button>
          ) : (
            <button
              className="btn-primary"
              onClick={onStart}
              style={{ width: '32px', height: '32px', borderRadius: '8px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Play size={16} fill="currentColor" />
            </button>
          )}
        </div>
      </div>
      <input
        placeholder={t('workout.note')}
        value={set.note}
        onChange={(e) => onUpdate('note', e.target.value)}
        style={{ fontSize: '0.8rem', padding: '0.4rem', marginTop: '0.2rem', background: 'transparent', border: 'none', borderBottom: '1px solid var(--card-border)', borderRadius: 0 }}
      />
    </div>
  );
};

const HistoryView = ({ sessions, templates, onBack, onExport, weightUnit, onDeleteSession, setConfirmDialog, userGender, setUserGender }) => {
  const { t, i18n } = useTranslation();
  const exportRef = useRef(null);
  const [sessionToExport, setSessionToExport] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [viewingSession, setViewingSession] = useState(null);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [isDailyExport, setIsDailyExport] = useState(false);
  const [exportConfig, setExportConfig] = useState({
    showTimeline: true,
    showNotes: true,
    showDetails: true,
    showBody: true,
    darkMode: true
  });

  const getSessionColor = (s) => {
    const template = templates.find(t => t.id === s.templateId);
    return template ? template.color : (s.color || '#3b82f6');
  };

  useEffect(() => {
    if (sessionToExport && exportRef.current) {
      // Small timeout to ensure DOM update
      setTimeout(() => {
        onExport(exportRef, sessionToExport.name).then(() => {
          setSessionToExport(null);
        });
      }, 100);
    }
  }, [sessionToExport]);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const days = daysInMonth(year, month);
  const firstDay = firstDayOfMonth(year, month);

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1));

  const workoutDates = sessions.reduce((acc, s) => {
    const d = new Date(s.date).toDateString();
    if (!acc[d]) acc[d] = [];
    acc[d].push(s);
    return acc;
  }, {});

  const calendarDays = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let d = 1; d <= days; d++) calendarDays.push(new Date(year, month, d));

  const workoutsToShow = selectedDate
    ? (workoutDates[selectedDate.toDateString()] || [])
    : sessions.filter(s => {
      const sessionDate = new Date(s.date);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return sessionDate >= sevenDaysAgo;
    });

  const getFirstStartedSetIdx = (sets) => {
    const idx = sets.findIndex(s => s.startTime);
    return idx === -1 ? null : idx;
  };

  return (
    <div className="fade-in" style={{ paddingBottom: '80px' }}>
      {viewingSession ? (() => {
        const displayColor = getSessionColor(viewingSession);
        return (
          <>
            <header className="flex-between" style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '12px', marginBottom: '2rem' }}>
              <button className="btn-ghost" onClick={() => setViewingSession(null)}><ChevronLeft size={24} /></button>
              <div style={{ textAlign: 'center' }}>
                <h2 style={{ fontSize: '1rem' }}>{viewingSession.name}</h2>
                <div style={{ fontSize: '0.7rem', opacity: 0.5 }}>{new Date(viewingSession.date).toLocaleDateString()}</div>
              </div>
              <button className="btn-ghost" onClick={() => {
                setIsDailyExport(false);
                setShowExportOptions(true);
              }}><Share2 size={20} /></button>
            </header>

            {viewingSession.exercises.map((ex, idx) => {
              const lastEx = idx > 0 ? viewingSession.exercises[idx - 1] : null;
              const lastSetOfPrev = lastEx ? lastEx.sets[lastEx.sets.length - 1] : null;
              const firstSetOfCurr = ex.sets[getFirstStartedSetIdx(ex.sets) || 0];
              const transitionGap = (lastSetOfPrev?.endTime && firstSetOfCurr?.startTime)
                ? firstSetOfCurr.startTime - lastSetOfPrev.endTime
                : null;

              return (
                <React.Fragment key={idx}>
                  {transitionGap && transitionGap > 30000 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: '0.5rem 0 1.5rem', opacity: 0.4 }}>
                      <div style={{ height: '1px', flex: 1, background: 'var(--text-secondary)', opacity: 0.3 }} />
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap' }}>
                        <History size={14} style={{ opacity: 0.6 }} />
                        <span style={{ fontSize: '0.75rem', fontWeight: '700', letterSpacing: '0.05em' }}>
                          {t('workout.rest').toUpperCase()} {Math.floor(transitionGap / 60000)}m {(Math.round(transitionGap / 1000) % 60)}s
                        </span>
                      </div>
                      <div style={{ height: '1px', flex: 1, background: 'var(--text-secondary)', opacity: 0.3 }} />
                    </div>
                  )}
                  <div className="glass card" style={{ marginBottom: '1.5rem', padding: '1.25rem', borderTop: `4px solid ${ex.category === 'Cardio' ? '#3b82f6' : displayColor}` }}>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {ex.name}
                      <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: ex.category === 'Cardio' ? '#3b82f620' : `${displayColor}20`, color: ex.category === 'Cardio' ? '#3b82f6' : displayColor }}>
                        {ex.category || 'Strength'}
                      </span>
                    </h3>
                    {ex.category !== 'Cardio' && ex.sets.some(s => s.startTime) && (
                      <TimelineBar sets={ex.sets} color={displayColor} showLabels={true} weightUnit={weightUnit} />
                    )}

                    {ex.category === 'Cardio' ? (
                      <div style={{ marginTop: '1rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(25px, auto) 1fr 1fr 1fr 1fr 40px', gap: '0.25rem', padding: '0 12px', marginBottom: '0.5rem', opacity: 0.4, fontSize: '0.65rem' }}>
                          <div>#</div>
                          <div style={{ textAlign: 'center' }}>{t('workout.incline')}</div>
                          <div style={{ textAlign: 'center' }}>{t('workout.pace')}</div>
                          <div style={{ textAlign: 'center' }}>{t('workout.time')}</div>
                          <div style={{ textAlign: 'center' }}>{t('workout.distance')}</div>
                          <div></div>
                        </div>
                        <div style={{ display: 'grid', gap: '0.5rem' }}>
                          {ex.sets.map((set, sIdx) => (
                            <div key={sIdx} style={{
                              display: 'grid',
                              gridTemplateColumns: 'minmax(25px, auto) 1fr 1fr 1fr 1fr 40px',
                              gap: '0.25rem',
                              alignItems: 'center',
                              padding: '8px 12px',
                              background: 'rgba(255, 255, 255, 0.03)',
                              borderRadius: '8px',
                              opacity: set.completed ? 1 : 0.5
                            }}>
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{sIdx + 1}</div>
                              <div style={{ textAlign: 'center', fontSize: '0.8rem' }}>{set.incline || '-'}°</div>
                              <div style={{ textAlign: 'center', fontSize: '0.8rem' }}>{set.pace || '-'}</div>
                              <div style={{ textAlign: 'center', fontSize: '0.8rem' }}>{set.time || '-'}</div>
                              <div style={{ textAlign: 'center', fontSize: '0.8rem' }}>{set.distance || '-'}km</div>
                              <div style={{ textAlign: 'right' }}></div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {ex.sets.some(s => s.note) && (
                      <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', display: 'grid', gap: '0.5rem' }}>
                        {ex.sets.map((s, sIdx) => s.note && (
                          <div key={sIdx} style={{ fontSize: '0.75rem', opacity: 0.7, fontStyle: 'italic', display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
                            <span style={{ opacity: 0.3, fontWeight: '800', fontSize: '0.6rem', background: 'rgba(255,255,255,0.1)', padding: '1px 4px', borderRadius: '4px', marginTop: '2px' }}>#{sIdx + 1}</span>
                            <span style={{ lineHeight: '1.4' }}>{s.note}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </React.Fragment>
              );
            })}

            <button
              className="btn-ghost"
              onClick={() => {
                setConfirmDialog({
                  message: t('common.confirmDelete'),
                  onConfirm: () => {
                    onDeleteSession(viewingSession.id);
                    setViewingSession(null);
                  }
                });
              }}
              style={{ width: '100%', color: '#ef4444', marginTop: '1rem', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '0.75rem', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Trash2 size={18} style={{ marginRight: '0.5rem' }} /> {t('common.deletehistory')}
            </button>
          </>
        );
      })() : (
        <>
          <header className="flex-between" style={{ marginBottom: '2rem', background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '12px' }}>
            <div className="flex gap-2" style={{ width: '100%', justifyContent: 'center', alignItems: 'center' }}>
              <button className="btn-ghost" onClick={prevMonth}>&lt;</button>
              <span style={{ fontWeight: '600', fontSize: '0.9rem', minWidth: '120px', textAlign: 'center' }}>{currentMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>
              <button className="btn-ghost" onClick={nextMonth}>&gt;</button>
            </div>
          </header >

          <div className="glass card" style={{ padding: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '5px', textAlign: 'center', marginBottom: '10px', fontSize: '0.8rem', opacity: 0.5 }}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d}>{d}</div>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px' }}>
              {calendarDays.map((date, i) => {
                if (!date) return <div key={i}></div>;
                const isToday = date.toDateString() === new Date().toDateString();
                const workouts = workoutDates[date.toDateString()];
                const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString();
                return (
                  <div
                    key={i}
                    className={`calendar-day ${isToday ? 'today' : ''} ${workouts ? 'has-workout' : ''} ${isSelected ? 'selected' : ''}`}
                    title={workouts ? `${workouts.length} workouts` : ''}
                    onClick={() => setSelectedDate(date)}
                    style={{
                      cursor: 'pointer',
                      border: isSelected ? '2px solid var(--primary-color)' : (isToday ? '1px solid var(--primary-color)' : 'none'),
                      background: isSelected ? 'rgba(99, 102, 241, 0.2)' : (workouts ? 'rgba(99, 102, 241, 0.05)' : 'transparent')
                    }}
                  >
                    <span style={{ position: 'relative', zIndex: 1, fontWeight: '800', textShadow: '0 0 4px rgba(255, 255, 255, 0.8)' }}>{date.getDate()}</span>
                    <div className="rings-container">
                      {workouts && workouts.slice(0, 3).map((w, idx) => (
                        <div
                          key={idx}
                          className="workout-ring"
                          style={{
                            width: `${34 - idx * 10}px`,
                            height: `${34 - idx * 10}px`,
                            borderColor: getSessionColor(w),
                            opacity: 0.7
                          }}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ marginTop: '2rem' }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div
                onClick={() => setSelectedDate(null)}
                style={{
                  cursor: selectedDate ? 'pointer' : 'default',
                  userSelect: 'none',
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: '0.4rem'
                }}
              >
                <span style={{
                  fontSize: selectedDate ? '0.85rem' : '1rem',
                  opacity: selectedDate ? 0.5 : 1,
                  transition: 'all 0.2s',
                  fontWeight: selectedDate ? '400' : '700'
                }}>
                  {i18n.language.startsWith('zh') ? '最近训练' : 'Recent'}
                </span>
                {selectedDate && (
                  <>
                    <span style={{ fontSize: '0.8rem', opacity: 0.3 }}>/</span>
                    <span style={{ fontSize: '1rem', fontWeight: '700' }}>
                      {selectedDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  </>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>{workoutsToShow.length} {t('editor.exercises')}</span>
                {selectedDate && (
                  <button
                    className="btn-ghost"
                    style={{ padding: '0.4rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}
                    onClick={() => {
                      setIsDailyExport(true);
                      setShowExportOptions(true);
                    }}
                  >
                    <Share2 size={16} style={{ opacity: 0.7 }} />
                  </button>
                )}
              </div>
            </h3>
            {workoutsToShow.length === 0 ? (
              <div className="glass card" style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>
                {t('home.noTemplates')}
              </div>
            ) : (
              workoutsToShow.map(s => {
                const displayColor = getSessionColor(s);
                return (
                  <div
                    key={s.id}
                    className="glass card"
                    onClick={() => setViewingSession(s)}
                    style={{
                      marginBottom: '0.75rem',
                      padding: '0.75rem 1rem',
                      borderLeft: `4px solid ${displayColor}`,
                      cursor: 'pointer',
                      transition: 'transform 0.1s'
                    }}
                  >
                    <div className="flex-between">
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '600' }}>{s.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{new Date(s.date).toLocaleDateString()}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <div className="badge" style={{
                          background: `${displayColor}15`,
                          color: displayColor,
                          border: `1px solid ${displayColor}25`,
                          fontSize: '0.7rem',
                          padding: '0.2rem 0.6rem',
                          borderRadius: '8px'
                        }}>
                          {s.exercises.length} Ex
                        </div>
                        <ChevronRight size={18} style={{ opacity: 0.25, color: 'var(--text-primary)' }} />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {
        showExportOptions && (
          <div className="modal-overlay fade-in" style={{ zIndex: 2000 }} onClick={() => setShowExportOptions(false)}>
            <div className="glass modal-content animate-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '360px' }}>
              <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '700' }}>{t('share.title')}</h2>
                <button className="btn-ghost" onClick={() => setShowExportOptions(false)}><Plus size={24} style={{ transform: 'rotate(45deg)' }} /></button>
              </div>

              <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '2rem' }}>
                {[
                  { id: 'dark', label: t('share.darkMode'), value: exportConfig.darkMode, key: 'darkMode' },
                  { id: 'timeline', label: t('share.showTimeline'), value: exportConfig.showTimeline, key: 'showTimeline' },
                  { id: 'notes', label: t('share.showNotes'), value: exportConfig.showNotes, key: 'showNotes' },
                  { id: 'details', label: t('share.showDetails'), value: exportConfig.showDetails, key: 'showDetails' },
                  { id: 'body', label: t('share.showBody'), value: exportConfig.showBody, key: 'showBody' }
                ].map(opt => (
                  <div key={opt.id} className="flex-between glass card" style={{ padding: '0.8rem 1rem', margin: 0, borderRadius: '15px' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>{opt.label}</span>
                    <button
                      onClick={() => setExportConfig({ ...exportConfig, [opt.key]: !opt.value })}
                      style={{
                        width: '44px',
                        height: '24px',
                        borderRadius: '12px',
                        background: opt.key === 'dark' ? (opt.value ? '#1e293b' : 'rgba(0,0,0,0.1)') : (opt.value ? 'var(--primary-color)' : 'rgba(255,255,255,0.1)'),
                        position: 'relative',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        padding: 0,
                        border: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        background: 'white',
                        position: 'absolute',
                        top: '3px',
                        left: opt.value ? '23px' : '3px',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                      }} />
                    </button>
                  </div>
                ))}
              </div>

              <button
                className="btn-primary"
                style={{
                  width: '100%',
                  padding: '1rem',
                  borderRadius: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.6rem',
                  fontSize: '1rem',
                  fontWeight: '600',
                  boxShadow: '0 10px 20px rgba(99, 102, 241, 0.2)'
                }}
                onClick={() => {
                  if (isDailyExport && selectedDate) {
                    const mergedExercises = workoutsToShow.flatMap(s => {
                      const sColor = getSessionColor(s);
                      return s.exercises.map(ex => ({ ...ex, sessionColor: sColor }));
                    });
                    const dayName = i18n.language.startsWith('zh') ? '全天汇总' : 'Daily Summary';
                    const dailySession = {
                      id: 'daily-' + selectedDate.getTime(),
                      name: dayName,
                      date: selectedDate,
                      exercises: mergedExercises,
                      isDaily: true
                    };
                    setSessionToExport(dailySession);
                  } else {
                    setSessionToExport(viewingSession);
                  }
                  setShowExportOptions(false);
                }}
              >
                <Download size={20} />
                {t('share.download')}
              </button>
            </div>
          </div>
        )
      }

      {/* Hidden Export Renderer */}
      {
        sessionToExport && (
          <div style={{ position: 'fixed', left: '-9999px', top: 0, width: '450px' }}>
            <div ref={exportRef} style={{
              background: exportConfig.darkMode
                ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)'
                : '#ffffff',
              padding: '2.5rem 2rem',
              width: '450px',
              color: exportConfig.darkMode ? '#f8fafc' : '#0f172a',
              fontFamily: "'Outfit', sans-serif",
              position: 'relative'
            }}>
              <div style={{ marginBottom: '2.5rem', borderLeft: `6px solid ${getSessionColor(sessionToExport)}`, paddingLeft: '1.25rem', position: 'relative' }}>
                <div style={{ fontSize: '0.85rem', opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.4rem' }}>{t('history.title')}</div>
                <h1 style={{ fontSize: '2.25rem', fontWeight: '800', lineHeight: 1.1, marginBottom: '0.5rem', color: exportConfig.darkMode ? '#f8fafc' : '#1e293b' }}>{sessionToExport.name}</h1>
                <p style={{ color: exportConfig.darkMode ? '#94a3b8' : '#64748b', fontSize: '1rem' }}>{new Date(sessionToExport.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>

                {exportConfig.showBody && (
                  <div style={{ position: 'absolute', top: '0px', right: '-10px', display: 'flex', gap: '0', opacity: 0.6 }}>
                    <div style={{ width: '60px', height: '120px', position: 'relative' }}>
                      <div style={{ transform: 'scale(0.25) translate(-75px, -50px)', transformOrigin: 'top left', width: '300px', height: '300px' }}>
                        <Body
                          data={[...new Set(['hair', ...sessionToExport.exercises.flatMap(e => e.muscles || [])])].map(m => ({ slug: m, intensity: 1 }))}
                          colors={[getSessionColor(sessionToExport), getSessionColor(sessionToExport)]}
                          gender={userGender || 'male'}
                          side="front"
                        />
                      </div>
                    </div>
                    <div style={{ width: '60px', height: '120px', position: 'relative' }}>
                      <div style={{ transform: 'scale(0.25) translate(-75px, -50px)', transformOrigin: 'top left', width: '300px', height: '300px' }}>
                        <Body
                          data={[...new Set(['hair', ...sessionToExport.exercises.flatMap(e => e.muscles || [])])].map(m => ({ slug: m, intensity: 1 }))}
                          colors={[getSessionColor(sessionToExport), getSessionColor(sessionToExport)]}
                          gender={userGender || 'male'}
                          side="back"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {sessionToExport.exercises.map((ex, idx) => {
                const displayColor = ex.category === 'Cardio' ? '#3b82f6' : (ex.sessionColor || getSessionColor(sessionToExport));
                return (
                  <div key={idx} style={{
                    marginBottom: '2rem',
                    padding: '1.5rem',
                    background: exportConfig.darkMode ? 'rgba(255,255,255,0.03)' : '#f8fafc',
                    borderRadius: '20px',
                    border: exportConfig.darkMode ? '1px solid rgba(255,255,255,0.05)' : '1px solid #e2e8f0'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: exportConfig.darkMode ? '#f8fafc' : '#1e293b' }}>{ex.name}</h3>
                      <span style={{ fontSize: '0.65rem', padding: '4px 10px', borderRadius: '20px', background: `${displayColor}20`, color: displayColor, fontWeight: '700', textTransform: 'uppercase' }}>
                        {ex.category || 'Strength'}
                      </span>
                    </div>

                    {exportConfig.showTimeline && ex.category !== 'Cardio' && ex.sets.some(s => s.startTime) && (
                      <TimelineBar sets={ex.sets} color={displayColor} showLabels={true} weightUnit={weightUnit} />
                    )}

                    {ex.category === 'Cardio' ? (
                      exportConfig.showDetails && (
                        <div style={{ display: 'grid', gap: '0.5rem', marginTop: '1rem' }}>
                          {ex.sets.map((set, sIdx) => (
                            <div key={sIdx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '8px 0', borderBottom: exportConfig.darkMode ? '1px solid rgba(255,255,255,0.05)' : '1px solid #e2e8f0' }}>
                              <span style={{ opacity: 0.5, color: exportConfig.darkMode ? '#f8fafc' : '#64748b' }}>#{sIdx + 1}</span>
                              <span style={{ fontWeight: '600', color: exportConfig.darkMode ? '#f8fafc' : '#334155' }}>{set.incline}° / {set.pace} / {set.time} / {set.distance}km</span>
                            </div>
                          ))}
                        </div>
                      )
                    ) : (
                      exportConfig.showDetails && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: '0.5rem', marginTop: '1rem' }}>
                          {ex.sets.map((set, sIdx) => (
                            <div key={sIdx} style={{
                              padding: '6px 4px',
                              background: exportConfig.darkMode ? 'rgba(255,255,255,0.02)' : '#f1f5f9',
                              borderRadius: '10px',
                              textAlign: 'center',
                              border: exportConfig.darkMode ? '1px solid rgba(255,255,255,0.05)' : '1px solid #e2e8f0'
                            }}>
                              <div style={{ fontSize: '0.6rem', opacity: 0.4, fontWeight: '700' }}>#{sIdx + 1}</div>
                              <div style={{ fontSize: '0.85rem', fontWeight: '800', color: displayColor }}>{set.weight}</div>
                              <div style={{ fontSize: '0.65rem', opacity: 0.6 }}>{set.reps} reps</div>
                            </div>
                          ))}
                        </div>
                      )
                    )}

                    {exportConfig.showNotes && ex.sets.some(s => s.note) && (
                      <div style={{ marginTop: '1rem', padding: '1rem', background: exportConfig.darkMode ? 'rgba(255,255,255,0.02)' : '#f1f5f9', borderRadius: '12px' }}>
                        {ex.sets.map((s, sIdx) => s.note && (
                          <div key={sIdx} style={{ fontSize: '0.8rem', opacity: 0.8, fontStyle: 'italic', marginBottom: '0.4rem', display: 'flex', gap: '0.5rem', color: exportConfig.darkMode ? '#cbd5e1' : '#475569' }}>
                            <span style={{ opacity: 0.3 }}>#{sIdx + 1}</span>
                            <span>{s.note}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              <div style={{ marginTop: '3rem', pt: '1.5rem', borderTop: exportConfig.darkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e2e8f0', textAlign: 'center', opacity: 0.3, fontSize: '0.75rem', color: exportConfig.darkMode ? '#f8fafc' : '#64748b' }}>
                Generated by Workout Tracker • {new Date().toLocaleTimeString()}
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
};


export default App;
