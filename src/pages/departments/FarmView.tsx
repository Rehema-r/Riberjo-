import React, { useState, useEffect } from 'react';
import { Sprout, Beaker, ShieldCheck, Plus, Calendar, TrendingUp, Info, ListTodo, AlertTriangle, Eye, Send, Crown, CheckSquare } from 'lucide-react';
import { collection, addDoc, query, orderBy, onSnapshot, limit, doc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { FarmActivity } from '../../types';
import { motion } from 'motion/react';

interface FarmObservation {
  id?: string;
  type: string;
  detail: string;
  severity: string;
  authorName: string;
  createdAt: number;
}

export default function FarmView({ activeSpace = 'USER' }: { activeSpace?: 'USER' | 'SUPER_USER' | 'ADMIN' }) {
  const { profile } = useAuth();
  const [activities, setActivities] = useState<FarmActivity[]>([]);
  const [observations, setObservations] = useState<FarmObservation[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [directorDirective, setDirectorDirective] = useState("Priorité à la sécurisation des semences avant la mi-saison. Veillez au respect strict des protocoles sanitaires pour le bétail.");
  const [directiveInput, setDirectiveInput] = useState("");
  
  const [newActivity, setNewActivity] = useState({
    type: 'culture',
    title: '',
    description: '',
    quantity: 0,
    unit: '',
    status: 'en_cours'
  });

  // Agent interactive checklists
  const [cl1, setCl1] = useState(false);
  const [cl2, setCl2] = useState(false);
  const [cl3, setCl3] = useState(false);
  const [cl4, setCl4] = useState(false);

  // New observation state
  const [obsType, setObsType] = useState('Cultures');
  const [obsDetail, setObsDetail] = useState('');
  const [obsSeverity, setObsSeverity] = useState('normal');

  useEffect(() => {
    const q = query(
      collection(db, 'farm_activities'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setActivities(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FarmActivity)));
    });

    const qObs = query(
      collection(db, 'farm_observations'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubscribeObs = onSnapshot(qObs, (snapshot) => {
      setObservations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FarmObservation)));
    });

    const unsubscribeDirective = onSnapshot(doc(db, 'farm_directives', 'latest'), (snapshot) => {
      if (snapshot.exists()) {
        const text = snapshot.data().text;
        setDirectorDirective(text || "");
        setDirectiveInput(text || "");
      }
    });

    return () => {
      unsubscribe();
      unsubscribeObs();
      unsubscribeDirective();
    };
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

  const handleAddObservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !obsDetail.trim()) return;

    try {
      await addDoc(collection(db, 'farm_observations'), {
        type: obsType,
        detail: obsDetail,
        severity: obsSeverity,
        authorName: profile.fullName,
        createdAt: Date.now()
      });
      setObsDetail('');
      alert("Observation terrain enregistrée avec succès !");
    } catch (err) {
      console.error("Error adding observation:", err);
    }
  };

  const stats = [
    { label: 'Cultures Actives', value: '12', icon: Sprout, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Bétail (Têtes)', value: '154', icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Vaccinations', value: '89%', icon: ShieldCheck, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Rendement Prévu', value: '+15%', icon: Calendar, color: 'text-amber-600', bg: 'bg-amber-50' },
  ];

  const isGrantedExpertWrite = profile?.role === 'SUPER_USER' || profile?.role === 'ADMIN' || profile?.role === 'SUPER_ADMIN';

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Département Ferme</h1>
          <p className="text-slate-500 font-medium">Gestion agricole, élevage et suivi vétérinaire.</p>
        </div>
        {activeSpace === 'SUPER_USER' && (
          isGrantedExpertWrite ? (
            <button 
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg active:scale-95"
            >
              <Plus size={16} /> Nouvel Enregistrement
            </button>
          ) : (
            <div className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-xl font-bold text-[10px] uppercase tracking-widest border border-slate-200/50">
              🔐 Espace Expert (Lecture Seule)
            </div>
          )
        )}
      </div>

      {activeSpace === 'USER' ? (
        /* Agent Space Layout */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {/* Operator Checklist Card */}
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-8 shadow-sm">
              <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight mb-6 flex items-center gap-2">
                <ListTodo className="text-emerald-600" size={24} /> Checklist Quotidienne de l'Agent
              </h3>
              <p className="text-xs text-slate-400 mb-6 leading-relaxed">Suivez et validez vos tâches pratiques de terrain tous les jours pour assurer le bon fonctionnement de la ferme.</p>
              
              <div className="space-y-4">
                <div onClick={() => setCl1(!cl1)} className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700/50 cursor-pointer select-none">
                  <input type="checkbox" checked={cl1} readOnly className="w-5 h-5 accent-emerald-650 rounded cursor-pointer" />
                  <div>
                    <h4 className={`text-sm font-bold ${cl1 ? 'line-through text-slate-400' : 'text-slate-800 dark:text-white'}`}>Contrôler l'arrosage automatique</h4>
                    <p className="text-[11px] text-slate-400">Vérifier la pression dans les secteurs Nord et Est.</p>
                  </div>
                </div>

                <div onClick={() => setCl2(!cl2)} className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700/50 cursor-pointer select-none">
                  <input type="checkbox" checked={cl2} readOnly className="w-5 h-5 accent-emerald-650 rounded cursor-pointer" />
                  <div>
                    <h4 className={`text-sm font-bold ${cl2 ? 'line-through text-slate-400' : 'text-slate-800 dark:text-white'}`}>Distribution de provende au bétail</h4>
                    <p className="text-[11px] text-slate-400">Assurer les rations de l'étable B.</p>
                  </div>
                </div>

                <div onClick={() => setCl3(!cl3)} className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700/50 cursor-pointer select-none">
                  <input type="checkbox" checked={cl3} readOnly className="w-5 h-5 accent-emerald-650 rounded cursor-pointer" />
                  <div>
                    <h4 className={`text-sm font-bold ${cl3 ? 'line-through text-slate-400' : 'text-slate-800 dark:text-white'}`}>Enregistrer les températures des serres</h4>
                    <p className="text-[11px] text-slate-400">Garantir un climat stable à 24°C maximum.</p>
                  </div>
                </div>

                <div onClick={() => setCl4(!cl4)} className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700/50 cursor-pointer select-none">
                  <input type="checkbox" checked={cl4} readOnly className="w-5 h-5 accent-emerald-650 rounded cursor-pointer" />
                  <div>
                    <h4 className={`text-sm font-bold ${cl4 ? 'line-through text-slate-400' : 'text-slate-800 dark:text-white'}`}>Rondelle d'inspection des clôtures</h4>
                    <p className="text-[11px] text-slate-400">Inspecter la zone périphérique contre les intrusions.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Observation Logger Form */}
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-8 shadow-sm">
              <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight mb-4 flex items-center gap-2">
                <AlertTriangle className="text-amber-600" size={24} /> Signaler une Observation Terrain
              </h3>
              
              <form onSubmit={handleAddObservation} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Type d'Observation</label>
                    <select
                      value={obsType}
                      onChange={(e) => setObsType(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/10"
                    >
                      <option value="Cultures">Cultures & Sols</option>
                      <option value="Elevage">Bétail & Élevage</option>
                      <option value="Equipement">Outils & Équipement</option>
                      <option value="Meteo">Météorologie & Climat</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gravité</label>
                    <select
                      value={obsSeverity}
                      onChange={(e) => setObsSeverity(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/10"
                    >
                      <option value="normal">Normal / RAS</option>
                      <option value="warning">Attention / À surveiller</option>
                      <option value="critical">Critique / Urgent</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Description de l'observation</label>
                  <textarea
                    required
                    rows={3}
                    value={obsDetail}
                    onChange={(e) => setObsDetail(e.target.value)}
                    placeholder="Saisissez ce que vous observez sur le terrain (ex: feuilles jaunies sur secteur Nord...)"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/10 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="flex items-center justify-center gap-2 w-full py-4 bg-emerald-600 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-emerald-700 transition"
                >
                  <Send size={14} /> Envoyer l'observation
                </button>
              </form>
            </div>
          </div>

          <div className="space-y-6">
            {/* Realtime Observations Feed */}
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-8 shadow-sm">
              <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight mb-6 flex items-center gap-2">
                <Eye className="text-emerald-600" size={18} /> Journal des Observations
              </h3>
              
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
                {observations.length === 0 ? (
                  <p className="text-center py-6 text-slate-400 text-xs">Aucune observation pour l'instant.</p>
                ) : (
                  observations.map((obs) => (
                    <div key={obs.id} className="p-4 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100/50 dark:border-slate-800">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-black uppercase text-emerald-600 tracking-wider font-mono">{obs.type}</span>
                        <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase ${
                          obs.severity === 'critical' ? 'bg-red-50 text-red-650' :
                          obs.severity === 'warning' ? 'bg-amber-50 text-amber-650' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {obs.severity}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-2">{obs.detail}</p>
                      <div className="flex justify-between text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-2 border-t border-slate-100/30 pt-1">
                        <span>Par: {obs.authorName}</span>
                        <span>{new Date(obs.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      ) : activeSpace === 'SUPER_USER' ? (
        /* Expert Space Layout (Original with additions) */
        <>
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
                  <Sprout className="text-emerald-600" size={24} /> Journal d'Activités Experts
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
                    <p className="text-[11px] text-emerald-950/60 dark:text-emerald-100/60 leading-relaxed font-medium font-sans">Analyse des sols et planification des cultures pour la saison prochaine.</p>
                  </div>
                  
                  <div className="p-4 bg-purple-50 dark:bg-purple-500/10 rounded-2xl border border-purple-100 dark:border-purple-500/20">
                    <div className="flex items-center gap-3 mb-2">
                      <ShieldCheck className="text-purple-600" size={18} />
                      <span className="text-xs font-black text-purple-700 dark:text-purple-400 uppercase">Vétérinaire</span>
                    </div>
                    <p className="text-[11px] text-purple-950/60 dark:text-purple-100/60 leading-relaxed font-medium font-sans">Suivi de la campagne de vaccination du bétail - Zone Sud.</p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl">
                <div className="relative z-10">
                  <Info className="text-emerald-400 mb-4" size={32} />
                  <h3 className="text-lg font-black uppercase tracking-tight mb-2">Note du Directeur</h3>
                  <p className="text-slate-400 text-xs leading-relaxed font-medium font-sans">"{directorDirective}"</p>
                </div>
                <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl"></div>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* Administrator / Director Space Layout */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-8 shadow-sm">
              <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight mb-4 flex items-center gap-2">
                <Crown size={24} className="text-amber-500" /> Émettre une directive stratégique
              </h3>
              <p className="text-xs text-slate-400 mb-6 font-medium">Cette directive s'affichera instantanément en temps réel sur l'espace de tous les employés et experts administratifs.</p>
              
              <div className="space-y-4">
                <textarea
                  value={directiveInput}
                  onChange={(e) => setDirectiveInput(e.target.value)}
                  rows={3}
                  placeholder="Saisissez la note de direction..."
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/10 resize-none font-semibold text-slate-800 dark:text-white"
                />
                <button
                  type="button"
                  onClick={async () => {
                    if (!directiveInput.trim()) return;
                    try {
                      await setDoc(doc(db, 'farm_directives', 'latest'), {
                        text: directiveInput.trim(),
                        updatedBy: profile?.fullName || 'Directeur',
                        updatedAt: Date.now()
                      });
                      alert("Directive du Directeur mise à jour avec succès !");
                    } catch (err) {
                      console.error("Error setting directive:", err);
                    }
                  }}
                  className="flex items-center justify-center gap-2 px-6 py-3.5 bg-amber-600 hover:bg-amber-700 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl transition border-none shadow-lg w-full cursor-pointer"
                >
                  Publier la directive
                </button>
              </div>
            </div>

            {/* Validation and Inspection of Field Observations */}
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-8 shadow-sm">
              <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight mb-4 flex items-center gap-2">
                <Eye className="text-emerald-600" size={20} /> Inspections de terrain & Signalements actifs
              </h3>
              <p className="text-xs text-slate-400 mb-6 font-medium">Prenez des décisions immédiates sur les observations critiques remontées par les équipes.</p>

              <div className="space-y-4">
                {observations.length === 0 ? (
                  <p className="text-center py-6 text-slate-400 text-xs uppercase tracking-widest font-black">Aucun rapport d'observation actif.</p>
                ) : (
                  observations.map((obs) => (
                    <div key={obs.id} className="p-4 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100/50 dark:border-slate-800 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-black uppercase text-emerald-600 tracking-wider font-mono">{obs.type}</span>
                          <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase ${
                            obs.severity === 'critical' ? 'bg-rose-50 text-rose-600' :
                            obs.severity === 'warning' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {obs.severity}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-semibold">{obs.detail}</p>
                        <p className="text-[8px] text-slate-400 font-bold uppercase mt-1">Saisi par : {obs.authorName} le {new Date(obs.createdAt).toLocaleDateString()}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          alert(`Action planifiée pour l'alerte sur ${obs.type} !`);
                        }}
                        className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-[9px] uppercase tracking-widest border-none shrink-0 cursor-pointer"
                      >
                        Valider & Traiter
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Directorial Actions Sidebar */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-8 shadow-sm">
              <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight mb-6">Outils de Supervision</h3>
              <div className="space-y-4">
                <div className="p-5 bg-amber-500/10 rounded-2xl border border-amber-500/20">
                  <h4 className="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-1">Plan de Rendement Annuel</h4>
                  <p className="text-[11px] text-slate-600 dark:text-slate-450 leading-relaxed font-medium">Objectif global de +15% de rendement. Toutes les observations de sols critiques nécessitent une action d'amendement sous 48h.</p>
                </div>
                <div className="p-5 bg-sky-500/10 rounded-2xl border border-sky-500/20">
                  <h4 className="text-xs font-black uppercase tracking-wider text-sky-700 dark:text-sky-450 mb-1">Budget Logistique Ferme</h4>
                  <p className="text-[11px] text-slate-600 dark:text-slate-450 leading-relaxed font-medium">Prévu: Acquisition de 2 tracteurs électriques et automatisation de la serre Hangar-Sud.</p>
                </div>
              </div>
            </div>

            {/* Live Activities Feed for Admin */}
            <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl">
              <h3 className="text-base font-black uppercase tracking-tight mb-4 text-emerald-400">Activités Récentes</h3>
              <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1">
                {activities.slice(0, 5).map((activity) => (
                  <div key={activity.id} className="p-3 bg-white/5 rounded-xl border border-white/10 text-[11px] space-y-1">
                    <p className="font-bold text-white uppercase">{activity.title}</p>
                    <p className="text-slate-400 leading-relaxed line-clamp-1">{activity.description}</p>
                    <p className="text-[8px] text-amber-500 font-bold uppercase font-mono">{activity.authorName} | {new Date(activity.createdAt).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
              <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl"></div>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setShowAddModal(false)} />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] p-8 relative z-10 shadow-2xl animate-in fade-in"
          >
            <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-6">Nouvel Enregistrement expert</h2>
            
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
                    value={isNaN(newActivity.quantity) ? '' : newActivity.quantity}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setNewActivity({...newActivity, quantity: isNaN(val) ? 0 : val});
                    }}
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
