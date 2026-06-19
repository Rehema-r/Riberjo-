import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { ActivityLog } from '../types';
import { Clock, FileText, CheckCircle2, User, AlertTriangle, PlusCircle, ArrowRightCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function ActivityFeed() {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'activities'),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      setActivities(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivityLog)));
      setLoading(false);
    }, (error) => {
      console.warn("ActivityFeed onSnapshot operates in local cache mode:", error.message);
      setLoading(false);
      handleFirestoreError(error, OperationType.LIST, 'activities');
    });

    return () => unsubscribe();
  }, []);

  const getIcon = (type: string) => {
    switch (type) {
      case 'report_created': return <PlusCircle size={16} className="text-blue-500" />;
      case 'report_validated': return <CheckCircle2 size={16} className="text-emerald-500" />;
      case 'report_rejected': return <AlertTriangle size={16} className="text-red-500" />;
      case 'task_created': return <ArrowRightCircle size={16} className="text-brand" />;
      case 'task_completed': return <CheckCircle2 size={16} className="text-emerald-600" />;
      default: return <Activity size={16} className="text-slate-400" />;
    }
  };

  if (loading) return <div className="animate-pulse space-y-4">
    {[1,2,3].map(i => <div key={i} className="h-16 bg-slate-50 dark:bg-slate-800 rounded-2xl" />)}
  </div>;

  return (
    <div className="space-y-4">
      <AnimatePresence initial={false}>
        {activities.map((activity) => (
          <motion.div
            key={activity.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-4 p-4 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-3xl transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-800"
          >
            <div className={`p-3 rounded-2xl shrink-0 ${
              activity.type.includes('valid') || activity.type.includes('compl') ? 'bg-emerald-50 dark:bg-emerald-500/10' :
              activity.type.includes('reject') ? 'bg-red-50 dark:bg-red-500/10' :
              'bg-blue-50 dark:bg-blue-500/10'
            }`}>
              {getIcon(activity.type)}
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-start mb-1">
                <p className="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-tight">{activity.userName}</p>
                <div className="flex items-center gap-1 text-[9px] font-black text-slate-400 uppercase">
                  <Clock size={10} />
                  {new Date(activity.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <p className="text-[12px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">{activity.details}</p>
              {activity.departmentId && (
                <span className="inline-block mt-2 text-[8px] font-black uppercase tracking-widest px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded">
                  {activity.departmentId}
                </span>
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
      {activities.length === 0 && (
        <div className="text-center py-8">
          <p className="text-xs font-black text-slate-300 dark:text-slate-700 uppercase tracking-widest">Aucune activité récente</p>
        </div>
      )}
    </div>
  );
}

const Activity = ({ size, className }: { size: number, className: string }) => <PlusCircle size={size} className={className} />;
