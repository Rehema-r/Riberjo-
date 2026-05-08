import React, { useState, useEffect } from 'react';
import { Stethoscope, Heart, Users, Activity, Plus, ShieldAlert, History } from 'lucide-react';
import { collection, addDoc, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { MedicalRecord } from '../../types';
import { motion } from 'motion/react';

export default function HealthView() {
  const { profile } = useAuth();
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRecord, setNewRecord] = useState({
    patientName: '',
    consultationType: 'Générale',
    diagnosis: '',
    treatment: '',
    medications: [] as string[]
  });
  const [medInput, setMedInput] = useState('');

  useEffect(() => {
    const q = query(
      collection(db, 'medical_records'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRecords(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MedicalRecord)));
    });

    return () => unsubscribe();
  }, []);

  const handleAddRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    try {
      await addDoc(collection(db, 'medical_records'), {
        ...newRecord,
        practitionerId: profile.id,
        practitionerName: profile.fullName,
        createdAt: Date.now()
      });
      setShowAddModal(false);
      setNewRecord({ patientName: '', consultationType: 'Générale', diagnosis: '', treatment: '', medications: [] });
    } catch (err) {
      console.error("Error adding record:", err);
    }
  };

  const addMedication = () => {
    if (medInput.trim()) {
      setNewRecord({...newRecord, medications: [...newRecord.medications, medInput.trim()]});
      setMedInput('');
    }
  };

  const stats = [
    { label: 'Consultations/Mois', value: '342', icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Urgences Traitées', value: '18', icon: ShieldAlert, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Stock Pharma', value: '92%', icon: Activity, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Patients Actifs', value: '1.2k', icon: Heart, color: 'text-pink-600', bg: 'bg-pink-50' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Département Santé</h1>
          <p className="text-slate-500 font-medium">Gestion médicale, consultations et contrôle sanitaire.</p>
        </div>
        {(profile?.role !== 'USER') && (
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg active:scale-95"
          >
            <Plus size={16} /> Nouvelle Consultation
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
              <History className="text-blue-600" size={24} /> Historique Médical Récent
            </h3>
            
            <div className="overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Patient</th>
                    <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                    <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Diagnostic</th>
                    <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                  {records.map((record) => (
                    <tr key={record.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-4">
                        <p className="text-xs font-bold text-slate-900 dark:text-white uppercase">{record.patientName}</p>
                        <p className="text-[9px] text-slate-500 font-medium">Dr. {record.practitionerName}</p>
                      </td>
                      <td className="py-4">
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-md uppercase">
                          {record.consultationType}
                        </span>
                      </td>
                      <td className="py-4">
                        <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-1 italic">"{record.diagnosis}"</p>
                      </td>
                      <td className="py-4 text-[10px] font-mono text-slate-400">
                        {new Date(record.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {records.length === 0 && (
                <div className="py-12 text-center text-slate-400 text-xs font-medium">Aucun dossier médical trouvé.</div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl">
            <h3 className="text-lg font-black uppercase tracking-tight mb-6">Urgences & Alertes</h3>
            <div className="space-y-4 relative z-10">
              <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/10">
                <div className="w-10 h-10 bg-red-500/20 text-red-500 rounded-xl flex items-center justify-center shrink-0">
                  <ShieldAlert size={20} />
                </div>
                <div>
                  <p className="text-xs font-black uppercase">Épidémie Ségur</p>
                  <p className="text-[10px] text-slate-400 font-medium">Surveillance accrue requise.</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/10">
                <div className="w-10 h-10 bg-emerald-500/20 text-emerald-500 rounded-xl flex items-center justify-center shrink-0">
                  <Activity size={20} />
                </div>
                <div>
                  <p className="text-xs font-black uppercase">Stock OK</p>
                  <p className="text-[10px] text-slate-400 font-medium">Réapprovisionnement reçu.</p>
                </div>
              </div>
            </div>
            <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl"></div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-8 shadow-sm">
            <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight mb-4 flex items-center gap-2">
              <Stethoscope className="text-blue-600" size={20} /> Note Direction
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
              "Assurer le suivi des relais communautaires pour la campagne de sensibilisation sanitaire prévue lundi prochain."
            </p>
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
            <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-6">Nouvelle Consultation</h2>
            
            <form onSubmit={handleAddRecord} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Patient</label>
                  <input 
                    type="text"
                    required
                    value={newRecord.patientName}
                    onChange={(e) => setNewRecord({...newRecord, patientName: e.target.value})}
                    placeholder="Nom complet"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Type</label>
                  <select 
                    value={newRecord.consultationType}
                    onChange={(e) => setNewRecord({...newRecord, consultationType: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="Générale">Générale</option>
                    <option value="Urgences">Urgences</option>
                    <option value="Suivi">Suivi</option>
                    <option value="Vaccination">Vaccination</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Diagnostic</label>
                <textarea 
                  required
                  rows={2}
                  value={newRecord.diagnosis}
                  onChange={(e) => setNewRecord({...newRecord, diagnosis: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Médicaments</label>
                <div className="flex gap-2 mb-2">
                  <input 
                    type="text"
                    value={medInput}
                    onChange={(e) => setMedInput(e.target.value)}
                    placeholder="Ajouter un médicament"
                    className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl text-sm"
                  />
                  <button 
                    type="button" 
                    onClick={addMedication}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold text-xs"
                  >
                    Ajouter
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {newRecord.medications.map((med, i) => (
                    <span key={i} className="px-3 py-1 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg text-[10px] font-bold uppercase">{med}</span>
                  ))}
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
                  className="flex-1 px-6 py-4 bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
                >
                  Valider
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
