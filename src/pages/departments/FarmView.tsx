import React, { useState, useEffect } from 'react';
import { Sprout, Beaker, ShieldCheck, Plus, Calendar, TrendingUp, Info } from 'lucide-react';
import { collection, addDoc, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { FarmActivity } from '../../types';
import { motion } from 'motion/react';

export default function FarmView() {
  const { profile } = useAuth();
  const [activities, setActivities] = useState<FarmActivity[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newActivity, setNewActivity] = useState({
    type: 'culture',
    title: '',
    description: '',
    quantity: 0,
    unit: '',
    status: 'en_cours'
  });

  useEffect(() => {
    const q = query(
      collection(db, 'farm_activities'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setActivities(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FarmActivity)));
    });

    return () => unsubscribe();
  }, []);

  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    try {
      await addDoc(collection(db, 'farm_activities'), {
        ...newActivity,
        authorId: profile.id,
        authorName: profile.fullName,
        createdAt: Date.now()
      });
      setShowAddModal(false);
      setNewActivity({ type: 'culture', title: '', description: '', quantity: 0, unit: '', status: 'en_cours' });
    } catch (err) {
      console.error("Error adding activity:", err);
    }
  };

  const stats = [
    { label: 'Cultures Actives', value: '12', icon: Sprout, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Bétail (Têtes)', value: '154', icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Vaccinations', value: '89%', icon: ShieldCheck, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Rendement Prévu', value: '+15%', icon: Calendar, color: 'text-amber-600', bg: 'bg-amber-50' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Département Ferme</h1>
          <p className="text-slate-500 font-medium">Gestion agricole, élevage et suivi vétérinaire.</p>
        </div>
        {(profile?.role === 'SUPER_USER' || profile?.role === 'ADMIN' || profile?.role === 'SUPER_ADMIN') && (
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg active:scale-95"
          >
            <Plus size={16} /> Nouvel Enregistrement
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm"
          >
            <div className={`w-12 h-12 ${stat.bg} ${stat.color} rounded-2xl flex items-center justify-center mb-4`}>
              <stat.icon size={24} />
            </div>
            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{stat.label}</p>
            <p className="text-3xl font-black text-slate-900 dark:text-white mt-1">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-8 shadow-sm">
            <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight mb-6 flex items-center gap-2">
              <Sprout className="text-emerald-600" size={24} /> Journal d'Activités
            </h3>
            
            <div className="space-y-4">
              {activities.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-slate-400 text-sm font-medium">Aucune activité enregistrée.</p>
                </div>
              ) : (
                activities.map((activity) => (
                  <div key={activity.id} className="flex gap-4 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-2xl transition-all border border-transparent hover:border-slate-100 dark:hover:border-slate-700">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      activity.type === 'culture' ? 'bg-emerald-100 text-emerald-600' : 
                      activity.type === 'élevage' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'
                    }`}>
                      {activity.type === 'culture' ? <Sprout size={18} /> : 
                       activity.type === 'élevage' ? <TrendingUp size={18} /> : <Beaker size={18} />}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="font-bold text-slate-900 dark:text-white text-sm">{activity.title}</h4>
                        <span className="text-[9px] font-mono text-slate-400 uppercase">{new Date(activity.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-2 mb-2 leading-relaxed">{activity.description}</p>
                      <div className="flex items-center gap-3">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Auteur: {activity.authorName}</span>
                        {activity.quantity > 0 && (
                          <span className="text-[9px] font-bold px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md">
                            {activity.quantity} {activity.unit}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-8 shadow-sm">
            <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight mb-6">Expertise Spécifique</h3>
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl border border-emerald-100 dark:border-emerald-500/20">
                <div className="flex items-center gap-3 mb-2">
                  <Beaker className="text-emerald-600" size={18} />
                  <span className="text-xs font-black text-emerald-700 dark:text-emerald-400 uppercase">Agronome</span>
                </div>
                <p className="text-[11px] text-emerald-900/60 dark:text-emerald-100/60 leading-relaxed font-medium">Analyse des sols et planification des cultures pour la saison prochaine.</p>
              </div>
              
              <div className="p-4 bg-purple-50 dark:bg-purple-500/10 rounded-2xl border border-purple-100 dark:border-purple-500/20">
                <div className="flex items-center gap-3 mb-2">
                  <ShieldCheck className="text-purple-600" size={18} />
                  <span className="text-xs font-black text-purple-700 dark:text-purple-400 uppercase">Vétérinaire</span>
                </div>
                <p className="text-[11px] text-purple-900/60 dark:text-purple-100/60 leading-relaxed font-medium">Suivi de la campagne de vaccination du bétail - Zone Sud.</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl">
            <div className="relative z-10">
              <Info className="text-emerald-400 mb-4" size={32} />
              <h3 className="text-lg font-black uppercase tracking-tight mb-2">Note du Directeur</h3>
              <p className="text-slate-400 text-xs leading-relaxed font-medium">"Priorité à la sécurisation des semences avant la mi-saison. Veillez au respect strict des protocoles sanitaires pour le bétail."</p>
            </div>
            <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl"></div>
          </div>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setShowAddModal(false)} />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] p-8 relative z-10 shadow-2xl"
          >
            <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-6">Nouvel Enregistrement</h2>
            
            <form onSubmit={handleAddActivity} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Type</label>
                  <select 
                    value={newActivity.type}
                    onChange={(e) => setNewActivity({...newActivity, type: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="culture">Culture</option>
                    <option value="élevage">Élevage</option>
                    <option value="vétérinaire">Vétérinaire</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Titre</label>
                  <input 
                    type="text"
                    required
                    value={newActivity.title}
                    onChange={(e) => setNewActivity({...newActivity, title: e.target.value})}
                    placeholder="Ex: Plantation Maïs"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Description détaillée</label>
                <textarea 
                  required
                  rows={4}
                  value={newActivity.description}
                  onChange={(e) => setNewActivity({...newActivity, description: e.target.value})}
                  placeholder="Détails de l'activité..."
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Quantité</label>
                  <input 
                    type="number"
                    value={newActivity.quantity}
                    onChange={(e) => setNewActivity({...newActivity, quantity: parseFloat(e.target.value)})}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Unité (Kg, Ha, Têtes...)</label>
                  <input 
                    type="text"
                    value={newActivity.unit}
                    onChange={(e) => setNewActivity({...newActivity, unit: e.target.value})}
                    placeholder="Ex: Kg"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-6 py-4 border border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                >
                  Annuler
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-6 py-4 bg-emerald-600 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
