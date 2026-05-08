import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, getDocs, addDoc, updateDoc, doc, orderBy, where } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Task, UserProfile, Department } from '../types';
import { CheckSquare, Plus, Clock, User, Filter, MoreVertical, CheckCircle2, Circle, Calendar as CalendarIcon, LayoutList, ChevronLeft, ChevronRight, AlertTriangle, X, Activity, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { notificationService } from '../services/notificationService';
import { activityService } from '../services/activityService';
import CommentsSection from '../components/CommentsSection';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

import { useTheme } from '../contexts/ThemeContext';

export default function Tasks() {
  const { profile } = useAuth();
  const { isDarkMode } = useTheme();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<UserProfile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const [sortBy, setSortBy] = useState<'deadline' | 'status' | 'createdAt'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [currentDate, setCurrentDate] = useState(new Date());

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
    assigneeId: '',
    departmentId: profile?.departmentId || '',
    deadline: '',
    subTasks: [] as { title: string; completed: boolean }[],
    dependencies: [] as string[]
  });

  // Auto-save form draft
  useEffect(() => {
    const draft = localStorage.getItem('task_form_draft');
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        setFormData(prev => ({ ...prev, ...parsed }));
      } catch (e) {
        console.error("Failed to load task draft");
      }
    }
  }, []);

  useEffect(() => {
    if (isModalOpen) {
      const timeout = setTimeout(() => {
        localStorage.setItem('task_form_draft', JSON.stringify(formData));
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [formData, isModalOpen]);

  useEffect(() => {
    fetchData();
  }, [profile]);

  async function fetchData() {
    if (!profile) return;
    setLoading(true);
    const tasksPath = 'tasks';
    try {
      let q = query(collection(db, tasksPath), orderBy('createdAt', 'desc'));
      
      if (profile.role === 'USER') {
        q = query(collection(db, tasksPath), where('assigneeId', '==', profile.id), orderBy('createdAt', 'desc'));
      } else if (profile.role === 'ADMIN') {
        q = query(collection(db, tasksPath), where('departmentId', '==', profile.departmentId), orderBy('createdAt', 'desc'));
      }

      const snap = await getDocs(q).catch(err => {
        handleFirestoreError(err, OperationType.LIST, tasksPath);
        return { docs: [] } as any;
      });
      setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() } as Task)));

      const usersPath = 'users';
      const usersSnap = await getDocs(collection(db, usersPath)).catch(err => {
        handleFirestoreError(err, OperationType.LIST, usersPath);
        return { docs: [] } as any;
      });
      setEmployees(usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as UserProfile)));

      const deptsPath = 'departments';
      const deptsSnap = await getDocs(collection(db, deptsPath)).catch(err => {
        handleFirestoreError(err, OperationType.LIST, deptsPath);
        return { docs: [] } as any;
      });
      setDepartments(deptsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Department)));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const tasksPath = 'tasks';
    try {
      const newTask = {
        ...formData,
        status: 'pending',
        progress: 0,
        creatorId: profile?.id,
        createdAt: Date.now(),
        deadline: formData.deadline ? new Date(formData.deadline).getTime() : null,
        subTasks: formData.subTasks.map((st, i) => ({ ...st, id: `st_${Date.now()}_${i}` }))
      };
      await addDoc(collection(db, tasksPath), newTask);

      localStorage.removeItem('task_form_draft');

      await activityService.log({
        type: 'task_created',
        userId: profile?.id || '',
        userName: profile?.fullName || 'Utilisateur',
        details: `A assigné la mission "${newTask.title}" à ${employees.find(e => e.id === newTask.assigneeId)?.fullName}`,
        departmentId: newTask.departmentId,
        targetId: newTask.assigneeId
      });

      const notifType = newTask.priority === 'high' ? 'critical' : 'info';
      const notifTitle = newTask.priority === 'high' ? 'Mission Urgente Assignée' : 'Nouvelle Mission';
      await notificationService.notify(newTask.assigneeId, notifTitle, `On vous a assigné la mission : ${newTask.title}`, notifType);

      setIsModalOpen(false);
      setFormData({ 
        title: '', 
        description: '', 
        priority: 'medium', 
        assigneeId: '', 
        departmentId: profile?.departmentId || '', 
        deadline: '',
        subTasks: [],
        dependencies: []
      });
      fetchData();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, tasksPath);
    }
  };

  const toggleTaskStatus = async (task: Task) => {
    const taskPath = `tasks/${task.id}`;
    const nextStatus = task.status === 'completed' ? 'pending' : 'completed';
    const nextProgress = nextStatus === 'completed' ? 100 : 0;
    try {
      await updateDoc(doc(db, 'tasks', task.id), { 
        status: nextStatus,
        progress: nextProgress,
        subTasks: task.subTasks.map(st => ({ ...st, completed: nextStatus === 'completed' }))
      });
      
      await activityService.log({
        type: nextStatus === 'completed' ? 'task_completed' : 'task_created',
        userId: profile?.id || '',
        userName: profile?.fullName || 'Utilisateur',
        details: `${nextStatus === 'completed' ? 'A terminé' : 'A relancé'} la mission "${task.title}"`,
        targetId: task.id,
        departmentId: task.departmentId
      });

      fetchData();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, taskPath);
    }
  };

  const toggleSubTask = async (taskId: string, subTaskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const newSubTasks = task.subTasks.map(st => 
      st.id === subTaskId ? { ...st, completed: !st.completed } : st
    );

    const completedCount = newSubTasks.filter(st => st.completed).length;
    const progress = Math.round((completedCount / newSubTasks.length) * 100);
    const status = progress === 100 ? 'completed' : progress > 0 ? 'in_progress' : 'pending';

    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        subTasks: newSubTasks,
        progress,
        status
      });
      fetchData();
      if (viewingTask?.id === taskId) {
        setViewingTask(prev => prev ? { ...prev, subTasks: newSubTasks, progress, status } : null);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `tasks/${taskId}`);
    }
  };

  const addSubTaskToForm = () => {
    setFormData(prev => ({
      ...prev,
      subTasks: [...prev.subTasks, { title: '', completed: false }]
    }));
  };

  const updateSubTaskInForm = (index: number, title: string) => {
    const newSubTasks = [...formData.subTasks];
    newSubTasks[index].title = title;
    setFormData(prev => ({ ...prev, subTasks: newSubTasks }));
  };

  const removeSubTaskFromForm = (index: number) => {
    setFormData(prev => ({
      ...prev,
      subTasks: prev.subTasks.filter((_, i) => i !== index)
    }));
  };

  const sortedTasks = tasks.sort((a, b) => {
    if (sortBy === 'deadline') {
      const dateA = a.deadline || 0;
      const dateB = b.deadline || 0;
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    }
    if (sortBy === 'status') {
      const statusOrder = { 'pending': 1, 'in_progress': 2, 'completed': 3 };
      const valA = statusOrder[a.status as keyof typeof statusOrder] || 0;
      const valB = statusOrder[b.status as keyof typeof statusOrder] || 0;
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    }
    return sortOrder === 'asc' ? a.createdAt - b.createdAt : b.createdAt - a.createdAt;
  });

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Tâches & Missions</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Suivez l'exécution des opérations sur le terrain.</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-1.5 rounded-2xl shadow-sm">
            <button 
              onClick={() => setView('list')}
              className={`p-2 rounded-xl transition-all ${view === 'list' ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              title="Vue Liste"
            >
              <LayoutList size={20} />
            </button>
            <button 
              onClick={() => setView('calendar')}
              className={`p-2 rounded-xl transition-all ${view === 'calendar' ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              title="Vue Calendrier"
            >
              <CalendarIcon size={20} />
            </button>
          </div>

          <div className="flex bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-1.5 rounded-2xl shadow-sm">
            <button 
              onClick={() => { setSortBy('deadline'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${sortBy === 'deadline' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100 dark:shadow-none' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Deadline {sortBy === 'deadline' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>
            <button 
              onClick={() => { setSortBy('status'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${sortBy === 'status' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100 dark:shadow-none' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Statut {sortBy === 'status' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>
          </div>
          {(profile?.role === 'ADMIN' || profile?.role === 'SUPER_ADMIN') && (
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 dark:shadow-none ml-auto md:ml-0"
            >
              <Plus size={20} />
              <span className="hidden sm:inline">Assigner</span>
            </button>
          )}
        </div>
      </div>

      {view === 'calendar' ? (
        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm p-4 md:p-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
              {currentDate.toLocaleString('fr-FR', { month: 'long', year: 'numeric' })}
            </h2>
            <div className="flex gap-2">
              <button 
                onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}
                className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all text-slate-400 hover:text-slate-900 border border-slate-100 dark:border-slate-800"
              >
                <ChevronLeft size={20} />
              </button>
              <button 
                onClick={() => setCurrentDate(new Date())}
                className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-100 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all font-mono"
              >
                Aujourd'hui
              </button>
              <button 
                onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}
                className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all text-slate-400 hover:text-slate-900 border border-slate-100 dark:border-slate-800"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 border-t border-l border-slate-50 dark:border-slate-800 rounded-2xl overflow-hidden">
            {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(day => (
              <div key={day} className="py-4 text-center border-r border-b border-slate-50 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">{day}</span>
              </div>
            ))}
            {(() => {
              const year = currentDate.getFullYear();
              const month = currentDate.getMonth();
              const firstDay = new Date(year, month, 1).getDay();
              const daysInMonth = new Date(year, month + 1, 0).getDate();
              const blanks = firstDay === 0 ? 6 : firstDay - 1;
              const cells = [];

              for (let i = 0; i < blanks; i++) {
                cells.push(<div key={`blank-${i}`} className="h-24 sm:h-32 border-r border-b border-slate-50 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-900/50" />);
              }

              for (let d = 1; d <= daysInMonth; d++) {
                const dayDate = new Date(year, month, d);
                const dayTasks = tasks.filter(t => {
                  if (!t.deadline) return false;
                  const deadlineDate = new Date(t.deadline);
                  return deadlineDate.getDate() === d && 
                         deadlineDate.getMonth() === month && 
                         deadlineDate.getFullYear() === year;
                });
                const isToday = new Date().toDateString() === dayDate.toDateString();

                cells.push(
                  <div key={d} className={`h-24 sm:h-32 border-r border-b border-slate-50 dark:border-slate-800 p-1 md:p-2 overflow-y-auto scrollbar-hide hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors ${isToday ? 'bg-emerald-50/30' : ''}`}>
                    <div className="flex justify-between items-start mb-1">
                      <span className={`text-[10px] font-black ${isToday ? 'bg-emerald-600 text-white w-4 h-4 md:w-5 md:h-5 flex items-center justify-center rounded-full' : 'text-slate-400 dark:text-slate-600'}`}>
                        {d}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {dayTasks.map(task => (
                        <motion.div 
                          key={task.id} 
                          whileHover={{ scale: 1.02 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewingTask(task);
                          }}
                          className={`p-1 md:p-1.5 rounded-lg text-[8px] md:text-[9px] font-bold truncate cursor-pointer transition-all border shadow-sm ${
                            task.status === 'completed' 
                              ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30 line-through opacity-60' 
                              : task.priority === 'high' 
                                ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-100 dark:border-red-900/30'
                                : 'bg-brand text-white border-brand shadow-md shadow-brand/10'
                          }`}
                        >
                          {task.title}
                        </motion.div>
                      ))}
                    </div>
                  </div>
                );
              }
              return cells;
            })()}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedTasks.length === 0 ? (
            <div className="md:col-span-full bg-white dark:bg-slate-900 rounded-3xl p-16 text-center border-2 border-dashed border-slate-200 dark:border-slate-800">
               <CheckSquare size={48} className="mx-auto text-slate-200 dark:text-slate-800 mb-4 opacity-20" />
               <p className="text-slate-500 dark:text-slate-400 font-medium italic">Aucune tâche assignée pour le moment.</p>
            </div>
          ) : (
              sortedTasks.map((task) => (
                <motion.div 
                  key={task.id}
                  layout
                  whileHover={{ y: -4 }}
                  onClick={() => setViewingTask(task)}
                  className={`bg-white dark:bg-slate-900 p-6 rounded-[2rem] border transition-all cursor-pointer ${
                    task.status === 'completed' ? 'border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/20 dark:bg-emerald-500/5 opacity-80' : 'border-slate-100 dark:border-slate-800 hover:shadow-lg'
                  }`}
                >
                  <div className="flex justify-between items-start mb-4">
                     <button 
                      onClick={(e) => { e.stopPropagation(); toggleTaskStatus(task); }}
                      className={`p-1.5 rounded-lg transition-colors ${
                        task.status === 'completed' ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' : 'text-slate-300 dark:text-slate-700 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'
                      }`}
                     >
                       {task.status === 'completed' ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                     </button>
                   <span className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${
                     task.status === 'completed' ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400' : 
                     task.status === 'in_progress' ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400' : 
                     'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                   }`}>
                     {task.status === 'completed' ? <CheckCircle2 size={12} /> : 
                      task.status === 'in_progress' ? <Activity size={12} /> : 
                      <Clock size={12} />}
                     {task.status}
                   </span>
                </div>

                <h3 className={`font-bold text-lg mb-2 ${task.status === 'completed' ? 'text-slate-400 dark:text-slate-600 line-through' : 'text-slate-900 dark:text-white'} tracking-tight`}>{task.title}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-4 font-medium leading-relaxed">{task.description}</p>

                {task.subTasks && task.subTasks.length > 0 && (
                  <div className="mb-6">
                    <div className="flex justify-between items-center mb-2">
                       <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Progrès</span>
                       <span className="text-[10px] font-black text-slate-600 dark:text-slate-400">{task.progress}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                       <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${task.progress}%` }}
                        className={`h-full ${task.status === 'completed' ? 'bg-emerald-500' : 'bg-brand'}`} 
                       />
                    </div>
                  </div>
                )}

                <div className="space-y-3 pt-6 border-t border-slate-50 dark:border-slate-800">
                   <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider">
                      <span className="text-slate-400 dark:text-slate-500">Assigné à</span>
                      <span className="text-slate-700 dark:text-slate-300">{employees.find(e => e.id === task.assigneeId)?.fullName || 'Inconnu'}</span>
                   </div>
                   <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider">
                      <span className="text-slate-400 dark:text-slate-500">Deadline</span>
                      <span className={task.deadline && task.deadline < Date.now() && task.status !== 'completed' ? 'text-red-500' : 'text-slate-500 dark:text-slate-400'}>
                         {task.deadline ? new Date(task.deadline).toLocaleDateString() : 'Aujourd\'hui'}
                      </span>
                   </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}

      <AnimatePresence>
        {viewingTask && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setViewingTask(null)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"/>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden p-8 border border-white/20 dark:border-slate-800">
               <div className="flex justify-between items-center mb-8">
                  <div className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] ${
                    viewingTask.status === 'completed' ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400' : 
                    viewingTask.status === 'in_progress' ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400' :
                    'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400'
                  }`}>
                    {viewingTask.status === 'completed' ? <CheckCircle2 size={14} /> : 
                     viewingTask.status === 'in_progress' ? <Activity size={14} /> : 
                     <Clock size={14} />}
                    {viewingTask.status}
                  </div>
                  <div className="flex items-center gap-2">
                     <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl ${
                        viewingTask.priority === 'high' ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400' : 
                        viewingTask.priority === 'medium' ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400' : 
                        'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400'
                     }`}>
                        Priorité {viewingTask.priority}
                     </span>
                     <button onClick={() => setViewingTask(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all text-slate-400">
                        <X size={20} />
                     </button>
                  </div>
               </div>

               <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-4 uppercase tracking-tight leading-tight">{viewingTask.title}</h2>
               <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-6 mb-8">
                  <p className="text-sm text-slate-600 dark:text-slate-400 font-medium leading-relaxed whitespace-pre-wrap mb-4">{viewingTask.description || "Aucune instruction supplémentaire fournie."}</p>
                  
                  {viewingTask.subTasks && viewingTask.subTasks.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Sous-tâches</h4>
                      <div className="space-y-3">
                        {viewingTask.subTasks.map(st => (
                          <div 
                            key={st.id} 
                            onClick={(e) => { e.stopPropagation(); toggleSubTask(viewingTask.id, st.id); }}
                            className="flex items-center gap-3 cursor-pointer group"
                          >
                            <div className={`p-1 rounded-md transition-colors ${st.completed ? 'bg-emerald-500 text-white' : 'bg-white dark:bg-slate-900 text-slate-200 dark:text-slate-700 border border-slate-100 dark:border-slate-800 group-hover:border-emerald-500'}`}>
                              {st.completed ? <CheckSquare size={14} /> : <Circle size={14} />}
                            </div>
                            <span className={`text-xs font-bold leading-tight ${st.completed ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-300'}`}>
                              {st.title}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
               </div>

               <div className="grid grid-cols-2 gap-6 mb-8">
                  <div className="space-y-1">
                     <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Assigné à</p>
                     <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-brand/10 text-brand rounded-lg flex items-center justify-center font-bold text-xs uppercase">
                           {employees.find(e => e.id === viewingTask.assigneeId)?.fullName.charAt(0)}
                        </div>
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-200">{employees.find(e => e.id === viewingTask.assigneeId)?.fullName}</p>
                     </div>
                  </div>
                  <div className="space-y-1">
                     <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Échéance</p>
                     <div className="flex items-center gap-2 text-slate-900 dark:text-slate-200">
                        <Clock size={16} className="text-emerald-600 dark:text-emerald-400" />
                        <p className="text-sm font-bold">
                           {viewingTask.deadline ? format(viewingTask.deadline, 'PPP', { locale: fr }) : 'Non définie'}
                        </p>
                     </div>
                  </div>
               </div>

               <div className="flex gap-4 mb-4">
                  <button 
                    onClick={() => { toggleTaskStatus(viewingTask); setViewingTask(null); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl font-bold transition-all shadow-xl ${
                      viewingTask.status === 'completed' 
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 shadow-slate-200 dark:shadow-none' 
                        : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-200 dark:shadow-none'
                    }`}
                  >
                    {viewingTask.status === 'completed' ? (
                      <><AlertTriangle size={18} /> Marquer comme incomplète</>
                    ) : (
                      <><CheckCircle2 size={18} /> Terminer la mission</>
                    )}
                  </button>
               </div>

               <div className="max-h-64 overflow-y-auto pr-2 scrollbar-hide">
                 <CommentsSection parentId={viewingTask.id} parentType="tasks" />
               </div>
            </motion.div>
          </div>
        )}

        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"/>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative bg-white dark:bg-slate-900 w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden p-8">
               <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-8 uppercase tracking-tight">Nouvelle Mission</h2>
               <form onSubmit={handleSubmit} className="space-y-6">
                 <div>
                   <label className="block text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Titre du service</label>
                   <input required type="text" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} placeholder="ex: Nettoyage Zone A" className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600"/>
                 </div>
                 <div>
                   <label className="block text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Instructions</label>
                   <textarea rows={3} value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} placeholder="Détails de la mission..." className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600"/>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                   <div>
                     <label className="block text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Assigné à</label>
                     <select required value={formData.assigneeId} onChange={(e) => setFormData({...formData, assigneeId: e.target.value})} className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-white">
                       <option value="">Sélectionner</option>
                       {employees.filter(e => e.role === 'USER').map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}
                     </select>
                   </div>
                   <div>
                     <label className="block text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Priorité</label>
                     <select required value={formData.priority} onChange={(e) => setFormData({...formData, priority: e.target.value as any})} className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-white">
                       <option value="low">Faible</option>
                       <option value="medium">Moyenne</option>
                       <option value="high">Haute / Urgente</option>
                     </select>
                   </div>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                   <div className="col-span-2">
                     <label className="block text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Sous-tâches</label>
                       <div className="space-y-3 mb-4">
                         {formData.subTasks.map((st, i) => (
                           <div key={i} className="flex gap-2">
                             <input 
                               type="text" 
                               value={st.title} 
                               onChange={(e) => updateSubTaskInForm(i, e.target.value)}
                               placeholder="Faire ceci..."
                               className="flex-1 px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm"
                             />
                             <button 
                               type="button" 
                               onClick={() => removeSubTaskFromForm(i)}
                               className="p-3 text-red-500 hover:bg-red-50 rounded-2xl transition-all"
                             >
                               <X size={18} />
                             </button>
                           </div>
                         ))}
                       </div>
                       <button 
                         type="button" 
                         onClick={addSubTaskToForm}
                         className="w-full py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-widest rounded-2xl hover:bg-slate-200 transition-all flex items-center justify-center gap-2 border-2 border-dashed border-slate-200 dark:border-slate-700"
                       >
                         <Plus size={18} /> Ajouter une sous-tâche
                       </button>
                    </div>

                    <div className="col-span-2">
                       <label className="block text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Dépendances</label>
                       <select 
                         multiple 
                         value={formData.dependencies} 
                         onChange={(e) => {
                           const values = Array.from(e.target.selectedOptions, option => option.value);
                           setFormData({ ...formData, dependencies: values });
                         }}
                         className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-white min-h-[100px]"
                       >
                         {tasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                       </select>
                    </div>

                    <div className="col-span-2">
                      <label className="block text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Date limite</label>
                     <input type="date" value={formData.deadline} onChange={(e) => setFormData({...formData, deadline: e.target.value})} className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-white"/>
                   </div>
                 </div>
                 <div className="flex justify-end pt-4">
                   <button type="submit" className="w-full py-4 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 shadow-xl shadow-emerald-100 dark:shadow-none transition-all">
                     Assigner Mission
                   </button>
                 </div>
               </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
