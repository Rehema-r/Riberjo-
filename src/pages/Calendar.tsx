import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, getDocs, limit, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { CalendarEvent } from '../types';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, MapPin, Clock, Users, Tag, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function CalendarPage() {
  const { profile } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (!profile) return;

    // In a real app, we would filter by month range
    const q = query(
      collection(db, 'calendar_events'),
      orderBy('startDate', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const records = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CalendarEvent));
      setEvents(records);
      setIsLoading(false);
    }, (error) => {
      console.warn("Calendar onSnapshot operates in local cache mode:", error.message);
      setIsLoading(false);
      handleFirestoreError(error, OperationType.LIST, 'calendar_events');
    });

    return () => unsubscribe();
  }, [profile]);

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));

  const monthName = currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  
  const calendarDays = [];
  const totalDays = daysInMonth(currentDate.getFullYear(), currentDate.getMonth());
  const startDay = (firstDayOfMonth(currentDate.getFullYear(), currentDate.getMonth()) + 6) % 7; // Start on Monday

  // Empty cells for previous month
  for (let i = 0; i < startDay; i++) {
    calendarDays.push(null);
  }
  for (let i = 1; i <= totalDays; i++) {
    calendarDays.push(i);
  }

  const getEventsForDay = (day: number) => {
    const dateStr = new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toISOString().split('T')[0];
    return events.filter(e => e.startDate.startsWith(dateStr));
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Calendrier</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Planning des activités et évènements.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-xl shadow-emerald-900/20 transition-all flex items-center justify-center gap-2"
        >
          <Plus size={18} /> Nouvel Évènement
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Calendar Grid */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{monthName}</h2>
            <div className="flex gap-2">
              <button 
                onClick={prevMonth}
                className="p-3 bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-emerald-600 rounded-xl transition-all"
              >
                <ChevronLeft size={20} />
              </button>
              <button 
                onClick={nextMonth}
                className="p-3 bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-emerald-600 rounded-xl transition-all"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 mb-4">
            {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(d => (
              <div key={d} className="text-center text-[10px] font-black text-slate-400 uppercase tracking-widest py-2">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, idx) => {
              const dayEvents = day ? getEventsForDay(day) : [];
              const isToday = day && day === new Date().getDate() && currentDate.getMonth() === new Date().getMonth() && currentDate.getFullYear() === new Date().getFullYear();

              return (
                <div 
                  key={idx}
                  className={`min-h-[120px] p-3 rounded-2xl border transition-all ${
                    day 
                      ? 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-800' 
                      : 'bg-transparent border-transparent'
                  } ${isToday ? 'ring-2 ring-emerald-500 ring-inset' : ''}`}
                >
                  {day && (
                    <>
                      <span className={`text-xs font-black mb-2 block ${isToday ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {day.toString().padStart(2, '0')}
                      </span>
                      <div className="space-y-1">
                        {dayEvents.map(event => (
                          <div 
                            key={event.id}
                            className={`text-[8px] p-2 rounded-lg font-black uppercase tracking-tight truncate border-l-4 ${
                              event.category === 'meeting' ? 'bg-blue-50 text-blue-600 border-blue-500' :
                              event.category === 'farm' ? 'bg-emerald-50 text-emerald-600 border-emerald-500' :
                              'bg-purple-50 text-purple-600 border-purple-500'
                            }`}
                          >
                            {event.title}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Upcoming Sidebar */}
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <AlertCircle size={20} className="text-slate-400" />
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">À Venir</h2>
          </div>
          
          <div className="space-y-4">
            {events.filter(e => new Date(e.startDate) >= new Date()).slice(0, 5).map(event => (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                key={event.id}
                className="bg-white dark:bg-slate-900 p-5 rounded-[1.5rem] border border-slate-100 dark:border-slate-800 shadow-sm group hover:border-emerald-500 transition-all"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    event.category === 'meeting' ? 'bg-blue-50 text-blue-600' :
                    event.category === 'farm' ? 'bg-emerald-50 text-emerald-600' :
                    'bg-purple-50 text-purple-600'
                  }`}>
                    {event.category === 'meeting' ? <Users size={18} /> : 
                     event.category === 'farm' ? <Tag size={18} /> : 
                     <CalendarIcon size={18} />}
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight mb-0.5">{event.title}</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{event.category}</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    <Clock size={12} className="text-slate-300" />
                    {new Date(event.startDate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    <MapPin size={12} className="text-slate-300" />
                    {event.location || 'Bureau Central'}
                  </div>
                </div>
              </motion.div>
            ))}
            
            {events.length === 0 && (
              <div className="text-center py-10 opacity-50">
                <CalendarIcon size={32} className="mx-auto mb-3 text-slate-300" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Aucun évènement</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
