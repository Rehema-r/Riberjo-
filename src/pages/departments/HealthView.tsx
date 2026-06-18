import React, { useState, useEffect } from 'react';
import { Stethoscope, Heart, Users, Activity, Plus, ShieldAlert, History, Search, ArrowUpDown, Box, HeartPulse, ListTodo, FolderHeart, Send, Thermometer } from 'lucide-react';
import { collection, addDoc, query, orderBy, onSnapshot, limit, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { MedicalRecord, InventoryItem, InventoryTransaction } from '../../types';
import { motion } from 'motion/react';

interface VitalRecord {
  id?: string;
  patientName: string;
  temp: number;
  bp: string;
  weight: number;
  pulse: number;
  authorName: string;
  createdAt: number;
}

export default function HealthView({ activeSpace = 'USER' }: { activeSpace?: 'USER' | 'SUPER_USER' | 'ADMIN' }) {
  const { profile } = useAuth();
  const isGrantedExpertWrite = profile?.role !== 'USER' && profile?.role !== 'BOARD_MEMBER';
  
  // Tabs: 'records' for Medical dossiers, 'inventory' for Pharmacy stock
  const [activeTab, setActiveTab] = useState<'records' | 'inventory'>('records');

  // Medical Consultation states
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

  // Pharmacy Inventory states
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [inventoryTransactions, setInventoryTransactions] = useState<InventoryTransaction[]>([]);
  const [inventorySearchTerm, setInventorySearchTerm] = useState('');
  const [showAddInventoryModal, setShowAddInventoryModal] = useState(false);
  const [newInventoryItem, setNewInventoryItem] = useState({
    name: '',
    category: 'Médicaments',
    quantity: 0,
    unit: 'Boîtes',
    minThreshold: 10,
    location: ''
  });

  // Pre-consultation / Nurse vital signs states
  const [vitals, setVitals] = useState<VitalRecord[]>([]);
  const [newVital, setNewVital] = useState({
    patientName: '',
    temp: 36.8,
    bp: '12/8',
    weight: 70,
    pulse: 75
  });

  // Health assistant checklists
  const [cl1, setCl1] = useState(false);
  const [cl2, setCl2] = useState(false);
  const [cl3, setCl3] = useState(false);

  // Stock Movement states
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<InventoryItem | null>(null);
  const [showStockMoveModal, setShowStockMoveModal] = useState(false);
  const [stockMoveType, setStockMoveType] = useState<'in' | 'out'>('in');
  const [stockMoveQty, setStockMoveQty] = useState<number>(0);
  const [stockMoveDescription, setStockMoveDescription] = useState<string>('');

  useEffect(() => {
    const q = query(
      collection(db, 'medical_records'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRecords(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MedicalRecord)));
    });

    const qV = query(
      collection(db, 'medical_vitals'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    const unsubscribeV = onSnapshot(qV, (snapshot) => {
      setVitals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as VitalRecord)));
    });

    return () => {
      unsubscribe();
      unsubscribeV();
    };
  }, []);

  useEffect(() => {
    const qInv = query(
      collection(db, 'inventory'),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribeInv = onSnapshot(qInv, (snapshot) => {
      const allItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem));
      // Show only items for departmentId '02' (or category 'Médical' if they are old)
      const healthItems = allItems.filter(item => 
        item.departmentId === '02' || 
        (item.category === 'Médical' && !item.departmentId)
      );
      setInventoryItems(healthItems);
    });

    const qTrans = query(
      collection(db, 'inventory_transactions'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribeTrans = onSnapshot(qTrans, (snapshot) => {
      const allTrans = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryTransaction));
      // Filter transactions for departmentId '02'
      const healthTrans = allTrans.filter(t => t.departmentId === '02');
      setInventoryTransactions(healthTrans);
    });

    return () => {
      unsubscribeInv();
      unsubscribeTrans();
    };
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

  const handleCreateInventoryItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    try {
      await addDoc(collection(db, 'inventory'), {
        ...newInventoryItem,
        departmentId: '02',
        lastUpdatedBy: profile.fullName,
        updatedAt: Date.now()
      });
      setShowAddInventoryModal(false);
      setNewInventoryItem({ name: '', category: 'Médicaments', quantity: 0, unit: 'Boîtes', minThreshold: 5, location: '' });
    } catch (err) {
      console.error("Error adding medical inventory item:", err);
    }
  };

  const handleSaveStockMove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !selectedInventoryItem) return;
    if (stockMoveQty <= 0) return;

    let computedQty = selectedInventoryItem.quantity;
    if (stockMoveType === 'in') {
      computedQty += stockMoveQty;
    } else {
      computedQty = Math.max(0, computedQty - stockMoveQty);
    }

    try {
      // 1. Update quantities in inventory doc
      await updateDoc(doc(db, 'inventory', selectedInventoryItem.id), {
        quantity: computedQty,
        lastUpdatedBy: profile.fullName,
        updatedAt: Date.now()
      });

      // 2. Add entry/egress to the transaction ledger with departmentId '02'
      await addDoc(collection(db, 'inventory_transactions'), {
        itemId: selectedInventoryItem.id,
        itemName: selectedInventoryItem.name,
        type: stockMoveType,
        quantity: stockMoveQty,
        description: stockMoveDescription || (stockMoveType === 'in' ? 'Entrée de stock médical' : 'Distribution de médicaments'),
        departmentId: '02',
        userId: profile.id,
        userName: profile.fullName,
        createdAt: Date.now()
      });

      setShowStockMoveModal(false);
      setSelectedInventoryItem(null);
      setStockMoveQty(0);
      setStockMoveDescription('');
    } catch (err) {
      console.error("Error executing medical stock transaction:", err);
    }
  };

  const addMedication = () => {
    if (medInput.trim()) {
      setNewRecord({...newRecord, medications: [...newRecord.medications, medInput.trim()]});
      setMedInput('');
    }
  };

  const handleAddVital = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !newVital.patientName.trim()) return;

    try {
      await addDoc(collection(db, 'medical_vitals'), {
        ...newVital,
        authorName: profile.fullName,
        createdAt: Date.now()
      });
      alert("Signes vitaux enregistrés avec succès !");
      setNewVital({ patientName: '', temp: 36.8, bp: '12/8', weight: 70, pulse: 75 });
    } catch (err) {
      console.error("Error adding vitals:", err);
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
      {activeSpace === 'USER' ? (
        /* Agent Space Layout (Nurse / Vital Check space) */
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Département Santé</h1>
            <p className="text-slate-500 font-medium">Espace Aide-Soignant, Infirmier de garde et Pré-consultation.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              {/* Pre-Consultation checklist */}
              <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-8 shadow-sm">
                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight mb-6 flex items-center gap-2">
                  <ListTodo className="text-blue-600" size={24} /> Checklist de l'Aide-Soignant
                </h3>
                
                <div className="space-y-4">
                  <div onClick={() => setCl1(!cl1)} className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700/50 cursor-pointer select-none">
                    <input type="checkbox" checked={cl1} readOnly className="w-5 h-5 accent-blue-650 rounded cursor-pointer" />
                    <div>
                      <h4 className={`text-sm font-bold ${cl1 ? 'line-through text-slate-400' : 'text-slate-800 dark:text-white'}`}>Stérilisation du matériel clinique</h4>
                      <p className="text-[11px] text-slate-400">Assurer l'autoclave pour les outils de premier soin.</p>
                    </div>
                  </div>

                  <div onClick={() => setCl2(!cl2)} className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700/50 cursor-pointer select-none">
                    <input type="checkbox" checked={cl2} readOnly className="w-5 h-5 accent-blue-650 rounded cursor-pointer" />
                    <div>
                      <h4 className={`text-sm font-bold ${cl2 ? 'line-through text-slate-400' : 'text-slate-800 dark:text-white'}`}>Vérification d'urgence (Trousse)</h4>
                      <p className="text-[11px] text-slate-400">Vérifier l'insuline et les pansements de secours.</p>
                    </div>
                  </div>

                  <div onClick={() => setCl3(!cl3)} className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700/50 cursor-pointer select-none">
                    <input type="checkbox" checked={cl3} readOnly className="w-5 h-5 accent-blue-650 rounded cursor-pointer" />
                    <div>
                      <h4 className={`text-sm font-bold ${cl3 ? 'line-through text-slate-400' : 'text-slate-800 dark:text-white'}`}>Contrôler la température du frigo à vaccins</h4>
                      <p className="text-[11px] text-slate-400">Garantir un climat stable à 4°C maximum.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Vital Signs Capture Form */}
              <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-8 shadow-sm">
                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight mb-4 flex items-center gap-2">
                  <HeartPulse className="text-blue-600" size={24} /> Prise des Constantes / Signes Vitaux
                </h3>
                
                <form onSubmit={handleAddVital} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Nom Complet du Patient</label>
                    <input
                      type="text"
                      required
                      value={newVital.patientName}
                      onChange={(e) => setNewVital({ ...newVital, patientName: e.target.value })}
                      placeholder="Ex: Jean Dupont"
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">T° (°C)</label>
                      <input
                        type="number"
                        step="0.1"
                        required
                        value={newVital.temp}
                        onChange={(e) => setNewVital({ ...newVital, temp: parseFloat(e.target.value) || 0 })}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Tension (mmHg)</label>
                      <input
                        type="text"
                        required
                        value={newVital.bp}
                        onChange={(e) => setNewVital({ ...newVital, bp: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Poids (Kg)</label>
                      <input
                        type="number"
                        required
                        value={newVital.weight}
                        onChange={(e) => setNewVital({ ...newVital, weight: parseFloat(e.target.value) || 0 })}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Pouls (bpm)</label>
                      <input
                        type="number"
                        required
                        value={newVital.pulse}
                        onChange={(e) => setNewVital({ ...newVital, pulse: parseInt(e.target.value) || 0 })}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="flex items-center justify-center gap-2 w-full py-4 bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-blue-700 transition"
                  >
                    <Send size={14} /> Enregistrer les constantes
                  </button>
                </form>
              </div>
            </div>

            <div className="space-y-6">
              {/* Vitals History feed */}
              <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-8 shadow-sm">
                <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight mb-6 flex items-center gap-2">
                  <FolderHeart className="text-blue-600" size={18} /> Rapports de Constantes Récentes
                </h3>
                <div className="space-y-4 max-h-[480px] overflow-y-auto pr-1">
                  {vitals.length === 0 ? (
                    <p className="text-center py-6 text-slate-400 text-xs font-bold">Aucune constante enregistrée aujourd'hui.</p>
                  ) : (
                    vitals.map((v) => (
                      <div key={v.id} className="p-4 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100/50 dark:border-slate-800">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">{v.patientName}</span>
                          <span className="text-[8px] font-mono text-slate-400">{new Date(v.createdAt).toLocaleDateString()}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-500 font-medium font-sans">
                          <p className="flex items-center gap-1"><Thermometer size={12} className="text-red-500" /> Température: <b className="text-slate-700 dark:text-slate-300">{v.temp}°C</b></p>
                          <p>Tension: <b className="text-slate-700 dark:text-slate-300">{v.bp} mmHg</b></p>
                          <p>Poids: <b className="text-slate-700 dark:text-slate-300">{v.weight} Kg</b></p>
                          <p>Pouls: <b className="text-slate-700 dark:text-slate-300">{v.pulse} bpm</b></p>
                        </div>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-2 pt-1 border-t border-slate-150/20 font-mono">Pre-enregistré par: {v.authorName}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Original Expert Doctor and Pharmacy layout */
        <>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 pb-4">
            <div>
              <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Département Santé</h1>
              <p className="text-slate-500 font-medium font-sans">Espace Expert : Consultations médicales, diagnostics et contrôle de la pharmacie globale.</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              {/* Segmented Tab Selectors */}
              <div className="bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl flex gap-1 shadow-sm w-full sm:w-auto justify-center">
                <button
                  onClick={() => setActiveTab('records')}
                  className={`flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
                    activeTab === 'records'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                  }`}
                >
                  <Stethoscope size={14} /> Consultations
                </button>
                <button
                  onClick={() => setActiveTab('inventory')}
                  className={`flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
                    activeTab === 'inventory'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                  }`}
                >
                  <Activity size={14} /> Pharmacie & Stocks
                </button>
              </div>

              {activeTab === 'records' ? (
                isGrantedExpertWrite ? (
                  <button 
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg active:scale-95 w-full sm:w-auto justify-center"
                  >
                    <Plus size={16} /> Nouvelle Consultation
                  </button>
                ) : (
                  <div className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-xl font-bold text-[10px] uppercase tracking-widest border border-slate-200/50">
                    🔐 (Lecture Seule)
                  </div>
                )
              ) : (
                isGrantedExpertWrite ? (
                  <button 
                    onClick={() => setShowAddInventoryModal(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg active:scale-95 w-full sm:w-auto justify-center"
                  >
                    <Plus size={16} /> Ajouter une Référence
                  </button>
                ) : (
                  <div className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-xl font-bold text-[10px] uppercase tracking-widest border border-slate-200/50">
                    🔐 (Lecture Seule)
                  </div>
                )
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-8">
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

          <div className="mt-8">
            {activeTab === 'records' ? (
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
        </>
      ) : (
        <>
          {/* Pharmacy & Stocks Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in duration-300">
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm"
            >
              <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-2xl flex items-center justify-center mb-4">
                <Box size={24} />
              </div>
              <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Références Médicales</p>
              <p className="text-3xl font-black text-slate-900 dark:text-white mt-1">{inventoryItems.length}</p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm"
            >
              <div className="w-12 h-12 bg-red-50 dark:bg-red-900/20 text-red-650 rounded-2xl flex items-center justify-center mb-4">
                <ShieldAlert size={24} />
              </div>
              <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Articles Stock Bas</p>
              <p className="text-3xl font-black text-slate-900 dark:text-white mt-1">
                {inventoryItems.filter(item => item.quantity <= item.minThreshold).length}
              </p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-slate-900 p-6 rounded-[2rem] text-white overflow-hidden relative shadow-2xl"
            >
              <div className="relative z-10">
                <div className="w-12 h-12 bg-white/10 text-white rounded-2xl flex items-center justify-center mb-4">
                  <Activity size={24} />
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Mouvements Enregistrés</p>
                <p className="text-3xl font-black mt-1">{inventoryTransactions.length}</p>
              </div>
              <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl"></div>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Stock List Panel */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm p-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-50 dark:border-slate-800">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Pharmacie & Consommables</h3>
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Filtrer le stock..." 
                      value={inventorySearchTerm}
                      onChange={(e) => setInventorySearchTerm(e.target.value)}
                      className="pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl text-[10px] font-bold uppercase transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/10">
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Article</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Catégorie</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Quantité</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Statut</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ajuster</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                      {inventoryItems
                        .filter(item => (item.name || '').toLowerCase().includes((inventorySearchTerm || '').toLowerCase()) || (item.category || '').toLowerCase().includes((inventorySearchTerm || '').toLowerCase()))
                        .map((item) => {
                          const isLow = item.quantity <= item.minThreshold;
                          const isOut = item.quantity === 0;
                          return (
                            <tr key={item.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                              <td className="px-6 py-5">
                                <p className="text-xs font-bold text-slate-900 dark:text-white uppercase">{item.name}</p>
                                <p className="text-[9px] text-slate-400 font-semibold font-mono uppercase">Mis à jour par {item.lastUpdatedBy}</p>
                              </td>
                              <td className="px-6 py-5">
                                <span className="text-[9px] font-black px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-md uppercase">
                                  {item.category}
                                </span>
                              </td>
                              <td className="px-6 py-5 text-right">
                                <span className={`text-xs font-mono font-black ${isLow ? 'text-red-500 font-bold' : 'text-slate-900 dark:text-white'}`}>
                                  {item.quantity} {item.unit}
                                </span>
                              </td>
                              <td className="px-6 py-5">
                                <div className="flex justify-center">
                                  <span className={`text-[9px] font-black px-2 py-1 rounded-full uppercase tracking-tighter ${
                                    isOut ? 'bg-red-500 text-white' : 
                                    isLow ? 'bg-amber-100 text-amber-700' : 
                                    'bg-emerald-100 text-emerald-700'
                                  }`}>
                                    {isOut ? 'Rupture' : isLow ? 'Stock Bas' : 'Optimal'}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-5 text-right">
                                <button
                                  onClick={() => {
                                    setSelectedInventoryItem(item);
                                    setStockMoveType('in');
                                    setShowStockMoveModal(true);
                                  }}
                                  className="p-2 border border-slate-200 dark:border-slate-800 bg-slate-50 hover:bg-blue-600 dark:bg-slate-900 dark:hover:bg-blue-600 hover:text-white dark:text-white rounded-xl transition-all inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider"
                                  title="Enregistrer une entrée/sortie"
                                >
                                  <ArrowUpDown size={12} /> mvt
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                  {inventoryItems.length === 0 && (
                    <div className="py-20 text-center text-slate-400 font-black text-[10px] uppercase tracking-widest">
                      Aucune référence médicale répertoriée
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Health Movements and Alerts Sidebar */}
            <div className="space-y-6">
              {/* Critical stock alerts widget */}
              <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-8 shadow-sm">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center justify-between">
                  Alertes de Stock Bas <ShieldAlert size={16} className="text-red-500" />
                </h3>
                <div className="space-y-4">
                  {inventoryItems.filter(item => item.quantity <= item.minThreshold).length === 0 ? (
                    <p className="text-[10px] text-slate-400 font-medium text-center py-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl text-emerald-700">Tous les stocks sont optimaux.</p>
                  ) : (
                    inventoryItems
                      .filter(item => item.quantity <= item.minThreshold)
                      .map(item => (
                        <div key={item.id} className="p-4 bg-red-50 dark:bg-red-500/10 rounded-2xl border border-red-100 dark:border-red-500/20">
                          <p className="text-xs font-black text-red-950 dark:text-red-300 uppercase leading-tight line-clamp-1">{item.name}</p>
                          <p className="text-[10px] font-mono font-bold text-red-700/60 dark:text-red-400/60 uppercase mt-1">
                            Seuil: {item.minThreshold} {item.unit} | Actuel: {item.quantity}
                          </p>
                        </div>
                      ))
                  )}
                </div>
              </div>

              {/* Dynamic fluxes tracking log */}
              <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-8 shadow-sm">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center justify-between">
                  Flux Pharmacie <History size={16} />
                </h3>
                <div className="max-h-80 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
                  {inventoryTransactions.length === 0 ? (
                    <p className="text-[10px] text-slate-400 font-medium text-center py-4">Aucun flux récent.</p>
                  ) : (
                    inventoryTransactions.map(t => (
                      <div key={t.id} className="flex gap-3 items-start border-b border-slate-100 dark:border-slate-800/40 pb-3 last:border-0 last:pb-0 font-sans">
                        <div className={`w-1.5 h-10 rounded-full shrink-0 ${t.type === 'in' ? 'bg-emerald-500' : 'bg-blue-500'}`}></div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-black uppercase tracking-tight text-slate-900 dark:text-white line-clamp-1">{t.itemName}</p>
                            <span className={`text-[10px] font-mono font-black ${t.type === 'in' ? 'text-emerald-500' : 'text-blue-500'}`}>
                              {t.type === 'in' ? '+' : '-'}{t.quantity}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium line-clamp-1 italic">"{t.description}"</p>
                          <p className="text-[8px] text-slate-400 font-medium uppercase font-mono mt-0.5">Par {t.userName} | {new Date(t.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
          </div>
        </>
      )}

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

      {/* 1. Add Medical Inventory Reference Modal */}
      {showAddInventoryModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setShowAddInventoryModal(false)} />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] p-8 relative z-10 shadow-2xl"
          >
            <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-6">Ajouter une Référence</h2>
            
            <form onSubmit={handleCreateInventoryItem} className="space-y-4">
              <div className="space-y-1 font-sans">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nom du produit / médicament</label>
                <input 
                  type="text"
                  required
                  placeholder="Ex: Paracétamol 500mg, compresses..."
                  value={newInventoryItem.name}
                  onChange={(e) => setNewInventoryItem({...newInventoryItem, name: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Catégorie</label>
                  <select 
                    value={newInventoryItem.category}
                    onChange={(e) => setNewInventoryItem({...newInventoryItem, category: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold focus:outline-none"
                  >
                    <option value="Médicaments">Médicaments</option>
                    <option value="Seringues & Aiguilles">Seringues / Diluants</option>
                    <option value="Pansements & Compresses">Matériel pansement</option>
                    <option value="Vaccins">Vaccins & Solutés</option>
                    <option value="Diagnostics & Tests">Tests rapides</option>
                    <option value="Autre">Autre</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Emplacement</label>
                  <input 
                    type="text"
                    placeholder="Ex: Armoire A"
                    value={newInventoryItem.location}
                    onChange={(e) => setNewInventoryItem({...newInventoryItem, location: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Quantité Initiale</label>
                  <input 
                    type="number"
                    value={isNaN(newInventoryItem.quantity) ? '' : newInventoryItem.quantity}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setNewInventoryItem({...newInventoryItem, quantity: isNaN(val) ? 0 : val});
                    }}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Unité</label>
                  <input 
                    type="text"
                    value={newInventoryItem.unit}
                    onChange={(e) => setNewInventoryItem({...newInventoryItem, unit: e.target.value})}
                    placeholder="Ex: Boîtes"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Seuil Alerte</label>
                  <input 
                    type="number"
                    value={isNaN(newInventoryItem.minThreshold) ? '' : newInventoryItem.minThreshold}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setNewInventoryItem({...newInventoryItem, minThreshold: isNaN(val) ? 0 : val});
                    }}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4 font-sans">
                <button 
                  type="button" 
                  onClick={() => setShowAddInventoryModal(false)}
                  className="flex-1 px-6 py-4 border border-slate-150 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                >
                  Annuler
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-6 py-4 bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-blue-700 transition-all shadow-lg"
                >
                  Ajouter
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* 2. Stock Movement Action Modal */}
      {showStockMoveModal && selectedInventoryItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => { setShowStockMoveModal(false); setSelectedInventoryItem(null); }} />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] p-8 relative z-10 shadow-2xl"
          >
            <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-1">Mouvement de Stock</h2>
            <p className="text-xs text-slate-500 font-medium mb-6 uppercase tracking-wider font-mono bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700 inline-block">
              {selectedInventoryItem.name}
            </p>

            <form onSubmit={handleSaveStockMove} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Type de mouvement</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setStockMoveType('in')}
                    className={`py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${
                      stockMoveType === 'in' 
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' 
                        : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Entrée Stock (+)
                  </button>
                  <button
                    type="button"
                    onClick={() => setStockMoveType('out')}
                    className={`py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${
                      stockMoveType === 'out' 
                        ? 'bg-blue-650 bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
                        : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Sortie Stock (-)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 font-sans">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Quantité ({selectedInventoryItem.unit})</label>
                  <input 
                    type="number"
                    required
                    min="1"
                    step="any"
                    value={stockMoveQty || ''}
                    onChange={(e) => setStockMoveQty(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-10s0 dark:border-slate-700 rounded-2xl text-sm font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Stock Actuel</label>
                  <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-black text-slate-800 dark:text-slate-200">
                    {selectedInventoryItem.quantity} {selectedInventoryItem.unit}
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Motif / Commentaire</label>
                <input 
                  type="text"
                  required
                  placeholder="Ex: Réassortiment d'urgence, ordonnance patient, don..."
                  value={stockMoveDescription}
                  onChange={(e) => setStockMoveDescription(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold focus:outline-none"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="button" 
                  onClick={() => { setShowStockMoveModal(false); setSelectedInventoryItem(null); }}
                  className="flex-1 px-6 py-4 border border-slate-150 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-805 transition-all"
                >
                  Annuler
                </button>
                <button 
                  type="submit"
                  className={`flex-1 px-6 py-4 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl hover:opacity-90 transition-all shadow-lg ${
                    stockMoveType === 'in' ? 'bg-emerald-600 shadow-emerald-600/20' : 'bg-blue-600 shadow-blue-600/20'
                  }`}
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
