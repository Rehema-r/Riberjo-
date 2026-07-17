import React, { useState, useEffect } from 'react';
import { Stethoscope, Heart, Users, Activity, Plus, ShieldAlert, History, Search, ArrowUpDown, Box, HeartPulse, ListTodo, FolderHeart, Send, Thermometer, Calendar, Truck, AlertTriangle, TrendingUp, Clock, ShieldCheck } from 'lucide-react';
import { collection, addDoc, query, orderBy, onSnapshot, limit, updateDoc, doc, where, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
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
  
  // Tabs: 'records' for Medical dossiers, 'inventory' for Pharmacy stock, etc.
  const [activeTab, setActiveTab] = useState<'records' | 'inventory' | 'campaigns' | 'evacuations' | 'roster' | 'epidemiology'>('records');

  // State variables for the 4 new proposals:
  // 1. Campaigns & Prevention
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [showAddCampaignModal, setShowAddCampaignModal] = useState(false);
  const [newCampaign, setNewCampaign] = useState({
    title: '',
    type: 'Vaccination',
    targetAudience: 'Tout public',
    startDate: '',
    endDate: '',
    description: '',
    status: 'Planifié'
  });

  // 2. Medical Evacuations & Emergencies
  const [evacuations, setEvacuations] = useState<any[]>([]);
  const [showAddEvacuationModal, setShowAddEvacuationModal] = useState(false);
  const [newEvacuation, setNewEvacuation] = useState({
    patientName: '',
    destinationHospital: '',
    severity: 'Haute d\'urgence',
    reason: '',
    ambulanceCode: '',
    status: 'En cours de transfert'
  });

  // 3. Practitioner Duty Roster
  const [roster, setRoster] = useState<any[]>([]);
  const [showAddRosterModal, setShowAddRosterModal] = useState(false);
  const [newRosterItem, setNewRosterItem] = useState({
    staffName: '',
    staffRole: 'Médecin',
    date: '',
    shift: 'Garde de Jour'
  });

  // 4. Epidemiological Indicator Alerts
  const [epidemicAlerts, setEpidemicAlerts] = useState<any[]>([]);
  const [showAddEpidemicModal, setShowAddEpidemicModal] = useState(false);
  const [newEpidemicAlert, setNewEpidemicAlert] = useState({
    disease: 'Paludisme',
    suspectedCases: 1,
    severityLevel: 'Modéré',
    actionsTaken: '',
    alertActive: true
  });

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

  // Death Registry & Verification states (Directoire / Direction)
  const [deathRecords, setDeathRecords] = useState<any[]>([]);
  const [deathSearchName, setDeathSearchName] = useState('');
  const [deathVerifiedRecord, setDeathVerifiedRecord] = useState<MedicalRecord | null | 'NOT_FOUND'>(null);
  const [deathDate, setDeathDate] = useState('');
  const [deathCause, setDeathCause] = useState('');
  const [deathNotes, setDeathNotes] = useState('');
  const [deathSubmitLoading, setDeathSubmitLoading] = useState(false);
  const [errorDeath, setErrorDeath] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'medical_records'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRecords(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MedicalRecord)));
    }, (error) => {
      console.warn("HealthView records onSnapshot operates in local cache mode:", error.message);
      handleFirestoreError(error, OperationType.LIST, 'medical_records');
    });

    const qV = query(
      collection(db, 'medical_vitals'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    const unsubscribeV = onSnapshot(qV, (snapshot) => {
      setVitals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as VitalRecord)));
    }, (error) => {
      console.warn("HealthView vitals onSnapshot operates in local cache mode:", error.message);
      handleFirestoreError(error, OperationType.LIST, 'medical_vitals');
    });

    const qD = query(
      collection(db, 'clinical_deaths'),
      orderBy('createdAt', 'desc'),
      limit(30)
    );
    const unsubscribeD = onSnapshot(qD, (snapshot) => {
      setDeathRecords(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.warn("HealthView clinical_deaths onSnapshot operates in local cache mode:", error.message);
    });

    return () => {
      unsubscribe();
      unsubscribeV();
      unsubscribeD();
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
    }, (error) => {
      console.warn("HealthView inventory onSnapshot operates in local cache mode:", error.message);
      handleFirestoreError(error, OperationType.LIST, 'inventory');
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
    }, (error) => {
      console.warn("HealthView transactions onSnapshot operates in local cache mode:", error.message);
      handleFirestoreError(error, OperationType.LIST, 'inventory_transactions');
    });

    return () => {
      unsubscribeInv();
      unsubscribeTrans();
    };
  }, []);

  useEffect(() => {
    // 1. Listen to campaigns
    const qC = query(collection(db, 'health_campaigns'), orderBy('createdAt', 'desc'), limit(30));
    const unsubscribeC = onSnapshot(qC, (snapshot) => {
      setCampaigns(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => {
      console.warn("health_campaigns subscription fallback:", err.message);
    });

    // 2. Listen to evacuations
    const qE = query(collection(db, 'health_evacuations'), orderBy('createdAt', 'desc'), limit(30));
    const unsubscribeE = onSnapshot(qE, (snapshot) => {
      setEvacuations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => {
      console.warn("health_evacuations subscription fallback:", err.message);
    });

    // 3. Listen to roster
    const qR = query(collection(db, 'health_roster'), orderBy('createdAt', 'desc'), limit(30));
    const unsubscribeR = onSnapshot(qR, (snapshot) => {
      setRoster(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => {
      console.warn("health_roster subscription fallback:", err.message);
    });

    // 4. Listen to epidemic alerts
    const qEp = query(collection(db, 'health_epidemic_alerts'), orderBy('createdAt', 'desc'), limit(30));
    const unsubscribeEp = onSnapshot(qEp, (snapshot) => {
      setEpidemicAlerts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => {
      console.warn("health_epidemic_alerts subscription fallback:", err.message);
    });

    return () => {
      unsubscribeC();
      unsubscribeE();
      unsubscribeR();
      unsubscribeEp();
    };
  }, []);

  const handleAddCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    try {
      await addDoc(collection(db, 'health_campaigns'), {
        ...newCampaign,
        createdBy: profile.fullName,
        createdAt: Date.now()
      });
      setShowAddCampaignModal(false);
      setNewCampaign({
        title: '',
        type: 'Vaccination',
        targetAudience: 'Tout public',
        startDate: '',
        endDate: '',
        description: '',
        status: 'Planifié'
      });
      alert("Campagne de prévention ajoutée avec succès !");
    } catch (err) {
      console.error("Error adding campaign:", err);
    }
  };

  const handleAddEvacuation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    try {
      await addDoc(collection(db, 'health_evacuations'), {
        ...newEvacuation,
        reportedBy: profile.fullName,
        createdAt: Date.now()
      });
      setShowAddEvacuationModal(false);
      setNewEvacuation({
        patientName: '',
        destinationHospital: '',
        severity: 'Haute d\'urgence',
        reason: '',
        ambulanceCode: '',
        status: 'En cours de transfert'
      });
      alert("Évacuation sanitaire enregistrée avec succès !");
    } catch (err) {
      console.error("Error adding evacuation:", err);
    }
  };

  const handleUpdateEvacuationStatus = async (id: string, status: string) => {
    try {
      await updateDoc(doc(db, 'health_evacuations', id), { status });
    } catch (err) {
      console.error("Error updating evacuation status:", err);
    }
  };

  const handleAddRoster = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    try {
      await addDoc(collection(db, 'health_roster'), {
        ...newRosterItem,
        createdBy: profile.fullName,
        createdAt: Date.now()
      });
      setShowAddRosterModal(false);
      setNewRosterItem({
        staffName: '',
        staffRole: 'Médecin',
        date: '',
        shift: 'Garde de Jour'
      });
      alert("Planning de garde enregistré avec succès !");
    } catch (err) {
      console.error("Error adding roster:", err);
    }
  };

  const handleAddEpidemicAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    try {
      await addDoc(collection(db, 'health_epidemic_alerts'), {
        ...newEpidemicAlert,
        declaredBy: profile.fullName,
        createdAt: Date.now()
      });
      setShowAddEpidemicModal(false);
      setNewEpidemicAlert({
        disease: 'Paludisme',
        suspectedCases: 1,
        severityLevel: 'Modéré',
        actionsTaken: '',
        alertActive: true
      });
      alert("Alerte épidémique enregistrée avec succès !");
    } catch (err) {
      console.error("Error adding epidemic alert:", err);
    }
  };

  const handleToggleEpidemicAlert = async (id: string, alertActive: boolean) => {
    try {
      await updateDoc(doc(db, 'health_epidemic_alerts', id), { alertActive });
    } catch (err) {
      console.error("Error toggling alert:", err);
    }
  };

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

  const handleCheckConsultation = async () => {
    if (!deathSearchName.trim()) return;
    setErrorDeath(null);
    setDeathVerifiedRecord(null);
    
    // Search local records state first (case-insensitive)
    const matchingLocal = records.find(r => 
      r.patientName.trim().toLowerCase() === deathSearchName.trim().toLowerCase()
    );
    
    if (matchingLocal) {
      setDeathVerifiedRecord(matchingLocal);
      return;
    }
    
    // Query medical_records collection in Firestore to be absolutely sure
    try {
      const q = query(
        collection(db, 'medical_records'),
        where('patientName', '==', deathSearchName.trim())
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const foundDoc = snapshot.docs[0];
        const data = foundDoc.data() as MedicalRecord;
        setDeathVerifiedRecord({ id: foundDoc.id, ...data });
      } else {
        setDeathVerifiedRecord('NOT_FOUND');
      }
    } catch (err: any) {
      console.error(err);
      setErrorDeath("Une erreur est survenue lors de la vérification de la consultation.");
      setDeathVerifiedRecord('NOT_FOUND');
    }
  };

  const handleRegisterDeath = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!deathVerifiedRecord || deathVerifiedRecord === 'NOT_FOUND') {
      alert("Erreur: Vous n'avez pas le droit d'enregistrer ce décès.");
      return;
    }
    
    setDeathSubmitLoading(true);
    try {
      await addDoc(collection(db, 'clinical_deaths'), {
        patientName: deathSearchName.trim(),
        consultationId: deathVerifiedRecord.id,
        consultationType: deathVerifiedRecord.consultationType,
        consultationDate: deathVerifiedRecord.createdAt,
        diagnosis: deathVerifiedRecord.diagnosis,
        practitionerName: deathVerifiedRecord.practitionerName || 'Inconnu',
        deathDate: deathDate,
        reason: deathCause || 'Non spécifiée',
        notes: deathNotes || '',
        declaredBy: profile.fullName,
        declaredByRole: profile.role,
        createdAt: Date.now()
      });
      
      // Reset inputs
      setDeathSearchName('');
      setDeathVerifiedRecord(null);
      setDeathDate('');
      setDeathCause('');
      setDeathNotes('');
      alert("Décès enregistré avec succès et répertorié dans le registre de fin de vie !");
    } catch (err) {
      console.error("Error registering death:", err);
      alert("Une erreur est survenue lors de l'enregistrement.");
    } finally {
      setDeathSubmitLoading(false);
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
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-4">
            <div>
              <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Département Santé</h1>
              <p className="text-slate-500 font-medium font-sans">Espace Expert : Consultations médicales, diagnostics, pharmacie globale et activités de prévention.</p>
            </div>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
              {/* Segmented Tab Selectors */}
              <div className="bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl flex flex-wrap gap-1 shadow-sm justify-center">
                <button
                  onClick={() => setActiveTab('records')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
                    activeTab === 'records'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                  }`}
                >
                  <Stethoscope size={12} /> Consultations
                </button>
                <button
                  onClick={() => setActiveTab('inventory')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
                    activeTab === 'inventory'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                  }`}
                >
                  <Activity size={12} /> Pharmacie
                </button>
                <button
                  onClick={() => setActiveTab('campaigns')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
                    activeTab === 'campaigns'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                  }`}
                >
                  <Calendar size={12} /> Campagnes
                </button>
                <button
                  onClick={() => setActiveTab('evacuations')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
                    activeTab === 'evacuations'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                  }`}
                >
                  <Truck size={12} /> Évacuations
                </button>
                <button
                  onClick={() => setActiveTab('roster')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
                    activeTab === 'roster'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                  }`}
                >
                  <Clock size={12} /> Plannings
                </button>
                <button
                  onClick={() => setActiveTab('epidemiology')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
                    activeTab === 'epidemiology'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                  }`}
                >
                  <TrendingUp size={12} /> Épidémiologie
                </button>
              </div>

              {isGrantedExpertWrite ? (
                <>
                  {activeTab === 'records' && (
                    <button 
                      onClick={() => setShowAddModal(true)}
                      className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg active:scale-95 justify-center"
                    >
                      <Plus size={14} /> Nouvelle Consultation
                    </button>
                  )}
                  {activeTab === 'inventory' && (
                    <button 
                      onClick={() => setShowAddInventoryModal(true)}
                      className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg active:scale-95 justify-center"
                    >
                      <Plus size={14} /> Ajouter une Référence
                    </button>
                  )}
                  {activeTab === 'campaigns' && (
                    <button 
                      onClick={() => setShowAddCampaignModal(true)}
                      className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg active:scale-95 justify-center"
                    >
                      <Plus size={14} /> Planifier Campagne
                    </button>
                  )}
                  {activeTab === 'evacuations' && (
                    <button 
                      onClick={() => setShowAddEvacuationModal(true)}
                      className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg active:scale-95 justify-center"
                    >
                      <Plus size={14} /> Enregistrer Évacuation
                    </button>
                  )}
                  {activeTab === 'roster' && (
                    <button 
                      onClick={() => setShowAddRosterModal(true)}
                      className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg active:scale-95 justify-center"
                    >
                      <Plus size={14} /> Nouvelle Affectation
                    </button>
                  )}
                  {activeTab === 'epidemiology' && (
                    <button 
                      onClick={() => setShowAddEpidemicModal(true)}
                      className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg active:scale-95 justify-center"
                    >
                      <Plus size={14} /> Déclarer Alerte
                    </button>
                  )}
                </>
              ) : (
                <div className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-xl font-bold text-[10px] uppercase tracking-widest border border-slate-200/50 text-center">
                  🔐 (Lecture Seule)
                </div>
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

          {/* Section Traçabilité & Registre des Décès (Direction) */}
          <div className="mt-8 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-8 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-50 dark:border-slate-800 border-dashed">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                  <span className="p-1.5 bg-red-500/10 text-red-650 rounded-lg">💀</span> Contrôle & Traçabilité des Décès (Directoire)
                </h3>
                <p className="text-xs text-slate-500 font-medium font-sans mt-0.5">
                  Conformément à la politique clinique, seul le Directeur peut tracer un décès à condition que le patient ait été préalablement consulté.
                </p>
              </div>
              <div className="px-4 py-2 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-2xl flex items-center gap-2 text-red-700 dark:text-red-450 font-bold text-[10px] uppercase tracking-wider font-mono">
                🛡️ Espace Réservé : Direction Générale
              </div>
            </div>

            {/* If user is NOT a director, we strictly display "sinon il n'a pas le droit" */}
            {!(profile?.role === 'ADMIN' || profile?.role === 'BOARD_MEMBER' || profile?.role === 'SUPER_ADMIN') ? (
              <div className="py-12 px-6 text-center max-w-2xl mx-auto space-y-4">
                <div className="w-16 h-16 bg-amber-50 dark:bg-amber-950/20 text-amber-500 rounded-3xl flex items-center justify-center mx-auto shadow-sm">
                  <ShieldAlert size={32} />
                </div>
                <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Accès Non Autorisé ("Sinon il n'a pas droit")</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-sans font-medium font-mono">
                  Vous n'êtes pas connecté en tant que <b>Directeur</b> ou membre du Directoire. 
                  Conformément au protocole de l'établissement, seuls les directeurs ont le droit de tracer ou d'enregistrer des décès après validation du dossier de consultation clinique du patient.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-8">
                {/* Search & Verification panel */}
                <div className="space-y-6">
                  <div className="p-6 bg-slate-50 dark:bg-slate-800/30 rounded-3xl border border-slate-100/50 dark:border-slate-800 space-y-4">
                    <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5 font-mono">
                      <span>🔍</span> 1. Vérification Obligatoire de la Consultation
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-sans font-medium leading-relaxed">
                      Saisissez le nom exact du patient pour rechercher ses antécédents de consultation clinique. Sans consultation préexistante, le système bloquera l'enregistrement.
                    </p>

                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="Saisir le nom complet du patient..." 
                        value={deathSearchName}
                        onChange={(e) => {
                          setDeathSearchName(e.target.value);
                          setDeathVerifiedRecord(null);
                        }}
                        className="flex-1 px-4 py-3 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-700 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={handleCheckConsultation}
                        className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl transition"
                      >
                        Vérifier
                      </button>
                    </div>

                    {errorDeath && (
                      <p className="text-[10px] font-bold text-red-500">{errorDeath}</p>
                    )}

                    {/* Results / Right status */}
                    {deathVerifiedRecord === 'NOT_FOUND' && (
                      <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-150 dark:border-red-500/20 rounded-2xl space-y-2 animate-in fade-in duration-200">
                        <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-mono text-[10px] font-black uppercase">
                          <ShieldAlert size={14} /> AUCUNE CONSULTATION - TRACÉ INTERDIT !
                        </div>
                        <p className="text-[11px] text-red-900/75 dark:text-red-300 font-sans font-medium leading-relaxed">
                          Ce patient n'a jamais été consulté dans notre établissement. <b>Le Directeur n'a pas le droit</b> de tracer de décès pour ce patient car aucun dossier clinique n'est associé ("Sinon il n'a pas de droit").
                        </p>
                      </div>
                    )}

                    {deathVerifiedRecord && deathVerifiedRecord !== 'NOT_FOUND' && (
                      <div className="p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-150 dark:border-emerald-500/20 rounded-2xl space-y-2 animate-in fade-in duration-200">
                        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-mono text-[10px] font-black uppercase">
                          <FolderHeart size={14} className="text-emerald-500" /> DOSSIER VALIDÉ - AUTORISÉ !
                        </div>
                        <p className="text-[11px] text-emerald-950 dark:text-emerald-300 font-sans font-medium">
                          Patient consulté avec succès ! Vous disposez du droit légal d'enregistrer et de tracer le décès clinique.
                        </p>
                        <div className="mt-2 text-[10px] bg-white dark:bg-slate-900/50 p-3 rounded-xl border border-emerald-100 dark:border-emerald-500/10 text-slate-600 dark:text-slate-300 space-y-1 font-mono">
                          <p>🩺 Consultation ID: <b>{deathVerifiedRecord.id.substring(0, 8)}</b></p>
                          <p>📋 Diagnostic: <b>"{deathVerifiedRecord.diagnosis}"</b></p>
                          <p>👤 Praticien de garde: <b>{deathVerifiedRecord.practitionerName}</b></p>
                          <p>📅 Date: <b>{new Date(deathVerifiedRecord.createdAt).toLocaleDateString()}</b></p>
                        </div>
                      </div>
                    )}
                  </div>

                  {deathVerifiedRecord && deathVerifiedRecord !== 'NOT_FOUND' && (
                    <form onSubmit={handleRegisterDeath} className="p-6 bg-slate-50 dark:bg-slate-800/30 rounded-3xl border border-slate-100/50 dark:border-slate-800 space-y-4 animate-in slide-in-from-bottom duration-200">
                      <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider font-mono">
                        📝 2. Formulaire Clinique de Traçabilité
                      </h4>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Date du Décès</label>
                          <input 
                            type="date" 
                            required
                            value={deathDate}
                            onChange={(e) => setDeathDate(e.target.value)}
                            className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-700 rounded-xl text-xs focus:outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Cause présumée</label>
                          <input 
                            type="text" 
                            placeholder="Anémie, arrêt cardiaque..." 
                            required
                            value={deathCause}
                            onChange={(e) => setDeathCause(e.target.value)}
                            className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-700 rounded-xl text-xs focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Indications sur la traçabilité</label>
                        <textarea 
                          rows={2}
                          placeholder="Notez toutes les circonstances nécessaires pour la direction..."
                          value={deathNotes}
                          onChange={(e) => setDeathNotes(e.target.value)}
                          className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-700 rounded-xl text-xs focus:outline-none resize-none"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={deathSubmitLoading}
                        className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl transition disabled:opacity-50 shadow-lg"
                      >
                        {deathSubmitLoading ? "Enregistrement..." : "Enregistrer de façon conforme"}
                      </button>
                    </form>
                  )}
                </div>

                {/* Registry View log panel */}
                <div className="bg-slate-50 dark:bg-slate-950 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 flex flex-col min-h-[300px]">
                  <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2 font-mono">
                    <span className="text-red-500">📋</span> Registre Global des Décès Tracés Conformes
                  </h4>

                  <div className="flex-1 space-y-4 max-h-[440px] overflow-y-auto pr-1">
                    {deathRecords.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400 text-xs font-medium border-2 border-dashed border-slate-150 dark:border-slate-800 rounded-2xl">
                        <p>Aucun décès n'est actuellement répertorié dans ce registre.</p>
                      </div>
                    ) : (
                      deathRecords.map(rec => (
                        <div key={rec.id} className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100/50 dark:border-slate-800 relative z-10 shadow-sm animate-in fade-in duration-200">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-xs font-black text-red-650 uppercase tracking-tight">{rec.patientName}</p>
                              <p className="text-[10px] font-medium text-slate-400 mt-0.5">Décès: <b>{new Date(rec.deathDate).toLocaleDateString()}</b></p>
                            </div>
                            <span className="text-[8px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded uppercase font-bold">
                              Verifié
                            </span>
                          </div>

                          <div className="mt-3 text-[10px] text-slate-500 dark:text-slate-400 space-y-1 bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-100/50 dark:border-slate-700/50">
                            <p>🩺 Cause: <b className="text-slate-800 dark:text-slate-200">{rec.reason}</b></p>
                            <p>📋 Consulté: <b>{rec.consultationType}</b> (Diagn: "{rec.diagnosis}") par Dr. {rec.practitionerName}</p>
                            {rec.notes && <p className="italic">" {rec.notes} "</p>}
                          </div>
                          
                          <div className="mt-2 border-t border-slate-100 dark:border-slate-800/40 pt-2 flex items-center justify-between text-[8px] text-slate-400 uppercase tracking-widest font-mono">
                            <span>TRACE PAR: <b>{rec.declaredBy}</b></span>
                            <span className="text-emerald-500 font-bold">✔ CONFORME</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {activeTab === 'inventory' && (
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

          {activeTab === 'campaigns' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm">
                  <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-2xl flex items-center justify-center mb-4">
                    <Calendar size={24} />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Campagnes Planifiées</p>
                  <p className="text-3xl font-black text-slate-900 dark:text-white mt-1">
                    {campaigns.filter(c => c.status === 'Planifié').length}
                  </p>
                </div>
                <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm">
                  <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-2xl flex items-center justify-center mb-4">
                    <ShieldCheck size={24} />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Campagnes En Cours</p>
                  <p className="text-3xl font-black text-slate-900 dark:text-white mt-1">
                    {campaigns.filter(c => c.status === 'En cours').length}
                  </p>
                </div>
                <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm">
                  <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 text-slate-600 rounded-2xl flex items-center justify-center mb-4">
                    <History size={24} />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Total Campagnes</p>
                  <p className="text-3xl font-black text-slate-900 dark:text-white mt-1">{campaigns.length}</p>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-8 shadow-sm">
                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight mb-6">Campagnes de Prévention & de Vaccination</h3>
                {campaigns.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <Calendar size={48} className="mx-auto mb-4 text-slate-300" />
                    <p className="font-bold text-sm">Aucune campagne enregistrée</p>
                    <p className="text-xs mt-1 text-slate-400">Cliquez sur "Planifier Campagne" pour en ajouter une.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {campaigns.map((c) => (
                      <div key={c.id} className="p-6 bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-start gap-2 mb-3">
                            <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                              c.status === 'En cours' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400' :
                              c.status === 'Terminé' ? 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-400' :
                              'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400'
                            }`}>
                              {c.status}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider font-bold">
                              {c.type}
                            </span>
                          </div>
                          <h4 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2">{c.title}</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">{c.description}</p>
                        </div>
                        <div className="border-t border-slate-150 dark:border-slate-800/40 pt-4 mt-2 text-[10px] text-slate-500 font-medium font-sans space-y-1">
                          <p className="flex items-center gap-1">👥 Public cible: <b className="text-slate-800 dark:text-slate-200">{c.targetAudience}</b></p>
                          <p className="flex items-center gap-1">📅 Période: <b className="text-slate-800 dark:text-slate-200">Du {new Date(c.startDate).toLocaleDateString()} au {new Date(c.endDate).toLocaleDateString()}</b></p>
                          <p className="text-[8px] font-mono text-slate-400 uppercase tracking-wider pt-1">Créé par: {c.createdBy}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'evacuations' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm">
                  <div className="w-12 h-12 bg-red-50 dark:bg-red-900/20 text-red-650 rounded-2xl flex items-center justify-center mb-4">
                    <AlertTriangle size={24} />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">En Cours de Transfert</p>
                  <p className="text-3xl font-black text-slate-900 dark:text-white mt-1 text-red-600">
                    {evacuations.filter(e => e.status === 'En cours de transfert').length}
                  </p>
                </div>
                <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm">
                  <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-2xl flex items-center justify-center mb-4">
                    <Truck size={24} />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Arrivées / Sécurisées</p>
                  <p className="text-3xl font-black text-slate-900 dark:text-white mt-1">
                    {evacuations.filter(e => e.status === 'Arrivé à destination').length}
                  </p>
                </div>
                <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm">
                  <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 text-slate-600 rounded-2xl flex items-center justify-center mb-4">
                    <History size={24} />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Total Évacuations</p>
                  <p className="text-3xl font-black text-slate-900 dark:text-white mt-1">{evacuations.length}</p>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-8 shadow-sm">
                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight mb-6">Suivi des Évacuations Sanitaires & Urgences</h3>
                {evacuations.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <Truck size={48} className="mx-auto mb-4 text-slate-300" />
                    <p className="font-bold text-sm">Aucun transfert d'urgence en cours</p>
                    <p className="text-xs mt-1 text-slate-400">Cliquez sur "Enregistrer Évacuation" pour lancer une procédure.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {evacuations.map((e) => (
                      <div key={e.id} className="p-6 bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={`px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${
                              e.status === 'Clos' ? 'bg-slate-200 text-slate-800 dark:bg-slate-800' :
                              e.status === 'Arrivé à destination' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400' :
                              'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400'
                            }`}>
                              {e.status}
                            </span>
                            <span className="text-[9px] font-black uppercase text-red-650 bg-red-50 dark:bg-red-900/10 px-2 py-0.5 rounded">
                              Gravité: {e.severity}
                            </span>
                          </div>
                          <h4 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">{e.patientName}</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium font-sans">Motif : {e.reason}</p>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] text-slate-400 font-sans pt-2">
                            <p>🏥 Vers: <b className="text-slate-700 dark:text-slate-300">{e.destinationHospital}</b></p>
                            <p>🚑 Ambulance: <b className="text-slate-700 dark:text-slate-300">{e.ambulanceCode || 'Non spécifiée'}</b></p>
                            <p>🕒 Déclencheur: <b className="text-slate-700 dark:text-slate-300">{e.reportedBy}</b></p>
                            <p>📅 Date: <b className="text-slate-700 dark:text-slate-300">{new Date(e.createdAt).toLocaleString()}</b></p>
                          </div>
                        </div>
                        
                        {isGrantedExpertWrite && e.status === 'En cours de transfert' && (
                          <div className="flex gap-2 self-start md:self-center">
                            <button 
                              onClick={() => handleUpdateEvacuationStatus(e.id, 'Arrivé à destination')}
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition"
                            >
                              Déclarer Arrivé
                            </button>
                            <button 
                              onClick={() => handleUpdateEvacuationStatus(e.id, 'Clos')}
                              className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-300 dark:hover:bg-slate-600 transition"
                            >
                              Clôturer
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'roster' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm">
                  <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-2xl flex items-center justify-center mb-4">
                    <Clock size={24} />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Actuellement en Garde</p>
                  <p className="text-3xl font-black text-slate-900 dark:text-white mt-1">
                    {roster.filter(r => new Date(r.date).toDateString() === new Date().toDateString()).length}
                  </p>
                </div>
                <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm">
                  <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-2xl flex items-center justify-center mb-4">
                    <Users size={24} />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Total Praticiens Planifiés</p>
                  <p className="text-3xl font-black text-slate-900 dark:text-white mt-1">
                    {Array.from(new Set(roster.map(r => r.staffName))).length}
                  </p>
                </div>
                <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm">
                  <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-2xl flex items-center justify-center mb-4">
                    <ShieldCheck size={24} />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Affectations Futures</p>
                  <p className="text-3xl font-black text-slate-900 dark:text-white mt-1">
                    {roster.filter(r => new Date(r.date).getTime() > Date.now()).length}
                  </p>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-8 shadow-sm">
                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight mb-6">Plannings de Garde des Praticiens</h3>
                {roster.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <Clock size={48} className="mx-auto mb-4 text-slate-300" />
                    <p className="font-bold text-sm">Aucune garde programmée</p>
                    <p className="text-xs mt-1 text-slate-400">Cliquez sur "Nouvelle Affectation" pour planifier des quarts.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left font-sans text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                          <th className="pb-4">Praticien</th>
                          <th className="pb-4">Rôle</th>
                          <th className="pb-4">Date de service</th>
                          <th className="pb-4">Quart de travail</th>
                          <th className="pb-4">Planifié par</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                        {roster.map((r) => (
                          <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors font-bold text-slate-800 dark:text-slate-200">
                            <td className="py-4 text-slate-900 dark:text-white uppercase text-xs font-black">{r.staffName}</td>
                            <td className="py-4">
                              <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-[9px] uppercase tracking-wider text-slate-500 font-bold">
                                {r.staffRole}
                              </span>
                            </td>
                            <td className="py-4">{new Date(r.date).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</td>
                            <td className="py-4">
                              <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                r.shift === 'Garde de Nuit' ? 'bg-slate-950 text-indigo-400 border border-indigo-900/40' :
                                r.shift === 'Astreinte' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400' :
                                'bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-400'
                              }`}>
                                {r.shift}
                              </span>
                            </td>
                            <td className="py-4 text-slate-400 text-[10px] font-mono">{r.createdBy}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'epidemiology' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-red-50 dark:bg-red-950/10 p-6 rounded-[2rem] border border-red-100 dark:border-red-900/30">
                  <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 text-red-650 rounded-2xl flex items-center justify-center mb-4">
                    <AlertTriangle size={24} />
                  </div>
                  <p className="text-[10px] font-black text-red-800 dark:text-red-400 uppercase tracking-widest">Alertes Actives</p>
                  <p className="text-3xl font-black text-red-900 dark:text-white mt-1">
                    {epidemicAlerts.filter(a => a.alertActive).length}
                  </p>
                </div>
                <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm">
                  <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-2xl flex items-center justify-center mb-4">
                    <Activity size={24} />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Taux Paludisme (Fréq.)</p>
                  <p className="text-3xl font-black text-slate-900 dark:text-white mt-1">14.2%</p>
                </div>
                <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm">
                  <div className="w-12 h-12 bg-pink-50 dark:bg-pink-900/20 text-pink-600 rounded-2xl flex items-center justify-center mb-4">
                    <Heart size={24} />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Vaccinations Planifiées</p>
                  <p className="text-3xl font-black text-slate-900 dark:text-white mt-1">87.5%</p>
                </div>
                <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm">
                  <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-2xl flex items-center justify-center mb-4">
                    <ShieldCheck size={24} />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Seuils Alerte Épidémie</p>
                  <p className="text-3xl font-black text-slate-900 dark:text-white mt-1 text-emerald-600">Normaux</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-8 shadow-sm">
                    <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight mb-6">Alertes Sanitaires Épidémiologiques Actives</h3>
                    {epidemicAlerts.length === 0 ? (
                      <div className="text-center py-12 text-slate-400">
                        <AlertTriangle size={48} className="mx-auto mb-4 text-slate-300" />
                        <p className="font-bold text-sm">Aucune alerte sanitaire en cours</p>
                        <p className="text-xs mt-1 text-slate-400">Toutes les données de diagnostic clinique de la localité sont conformes.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {epidemicAlerts.map((a) => (
                          <div key={a.id} className={`p-6 rounded-3xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                            a.alertActive 
                              ? 'bg-red-50/50 dark:bg-red-950/10 border-red-100 dark:border-red-900/20' 
                              : 'bg-slate-50 dark:bg-slate-800/20 border-slate-100 dark:border-slate-800'
                          }`}>
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <span className={`px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${
                                  a.alertActive ? 'bg-red-600 text-white animate-pulse' : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                                }`}>
                                  {a.alertActive ? 'Active' : 'Résolue / Dormante'}
                                </span>
                                <span className="text-[10px] font-mono text-slate-400 font-bold uppercase">Niveau : {a.severityLevel}</span>
                              </div>
                              <h4 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">Signalement : {a.disease}</h4>
                              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Cas Suspectés : <b>{a.suspectedCases}</b></p>
                              {a.actionsTaken && <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 italic font-sans">Mesures : "{a.actionsTaken}"</p>}
                              <p className="text-[8px] font-mono text-slate-400 uppercase tracking-wider mt-3">Déclaré par {a.declaredBy} | {new Date(a.createdAt).toLocaleDateString()}</p>
                            </div>

                            {isGrantedExpertWrite && a.alertActive && (
                              <button
                                onClick={() => handleToggleEpidemicAlert(a.id, false)}
                                className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-300 dark:hover:bg-slate-700 transition"
                              >
                                Déclarer Résolue
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-8 shadow-sm">
                    <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight mb-6">Indicateurs Cliniques Clés</h3>
                    <div className="space-y-4 text-xs font-bold text-slate-700 dark:text-slate-300 font-sans">
                      <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100/50 dark:border-slate-800">
                        <p className="text-slate-400 text-[9px] uppercase tracking-wider font-mono">Infections Respiratoires Aiguës (IRA)</p>
                        <div className="flex justify-between items-baseline mt-1">
                          <span className="text-lg font-black text-slate-900 dark:text-white">4.1%</span>
                          <span className="text-[10px] text-emerald-500 font-bold">▼ -1.2%</span>
                        </div>
                      </div>
                      <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100/50 dark:border-slate-800">
                        <p className="text-slate-400 text-[9px] uppercase tracking-wider font-mono">Gastro-entérites suspicion épidémie</p>
                        <div className="flex justify-between items-baseline mt-1">
                          <span className="text-lg font-black text-slate-900 dark:text-white">2.3%</span>
                          <span className="text-[10px] text-slate-400">Stable</span>
                        </div>
                      </div>
                      <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100/50 dark:border-slate-800">
                        <p className="text-slate-400 text-[9px] uppercase tracking-wider font-mono">Taux couverture vaccination</p>
                        <div className="flex justify-between items-baseline mt-1">
                          <span className="text-lg font-black text-slate-900 dark:text-white">92.4%</span>
                          <span className="text-[10px] text-emerald-500 font-bold">▲ +0.8%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
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

      {/* 3. Add Campaign Modal */}
      {showAddCampaignModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setShowAddCampaignModal(false)} />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] p-8 relative z-10 shadow-2xl"
          >
            <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-6">Planifier une Campagne</h2>
            
            <form onSubmit={handleAddCampaign} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Titre de la campagne</label>
                <input 
                  type="text"
                  required
                  placeholder="Ex: Campagne Paludisme Zéro ou Vaccination Rougeole"
                  value={newCampaign.title}
                  onChange={(e) => setNewCampaign({...newCampaign, title: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-750 rounded-2xl text-sm font-bold focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Type de campagne</label>
                  <select 
                    value={newCampaign.type}
                    onChange={(e) => setNewCampaign({...newCampaign, type: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-750 rounded-2xl text-sm font-bold focus:outline-none"
                  >
                    <option value="Vaccination">Vaccination</option>
                    <option value="Sensibilisation">Sensibilisation</option>
                    <option value="Distribution">Distribution</option>
                    <option value="Dépistage">Dépistage</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Public Cible</label>
                  <input 
                    type="text"
                    required
                    placeholder="Ex: Enfants 0-5 ans, Femmes enceintes"
                    value={newCampaign.targetAudience}
                    onChange={(e) => setNewCampaign({...newCampaign, targetAudience: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-750 rounded-2xl text-sm font-bold focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Date de début</label>
                  <input 
                    type="date"
                    required
                    value={newCampaign.startDate}
                    onChange={(e) => setNewCampaign({...newCampaign, startDate: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-750 rounded-2xl text-sm font-bold focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Date de fin</label>
                  <input 
                    type="date"
                    required
                    value={newCampaign.endDate}
                    onChange={(e) => setNewCampaign({...newCampaign, endDate: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-750 rounded-2xl text-sm font-bold focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Description / Actions menées</label>
                <textarea 
                  required
                  rows={2}
                  placeholder="Objectif de la campagne, vaccins distribués, lieu de rassemblement..."
                  value={newCampaign.description}
                  onChange={(e) => setNewCampaign({...newCampaign, description: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-750 rounded-2xl text-sm font-bold focus:outline-none resize-none"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="button" 
                  onClick={() => setShowAddCampaignModal(false)}
                  className="flex-1 px-6 py-4 border border-slate-150 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                >
                  Annuler
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-6 py-4 bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
                >
                  Ajouter
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* 4. Add Evacuation Modal */}
      {showAddEvacuationModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setShowAddEvacuationModal(false)} />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] p-8 relative z-10 shadow-2xl"
          >
            <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-6">Nouvelle Évacuation</h2>
            
            <form onSubmit={handleAddEvacuation} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nom du patient</label>
                <input 
                  type="text"
                  required
                  placeholder="Ex: Jean Dupont"
                  value={newEvacuation.patientName}
                  onChange={(e) => setNewEvacuation({...newEvacuation, patientName: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-750 rounded-2xl text-sm font-bold focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Hôpital de destination</label>
                  <input 
                    type="text"
                    required
                    placeholder="Ex: CHU Central, Hôpital Militaire"
                    value={newEvacuation.destinationHospital}
                    onChange={(e) => setNewEvacuation({...newEvacuation, destinationHospital: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-750 rounded-2xl text-sm font-bold focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Code Ambulance</label>
                  <input 
                    type="text"
                    required
                    placeholder="Ex: AMB-03"
                    value={newEvacuation.ambulanceCode}
                    onChange={(e) => setNewEvacuation({...newEvacuation, ambulanceCode: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-750 rounded-2xl text-sm font-bold focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Niveau de Gravité</label>
                <select 
                  value={newEvacuation.severity}
                  onChange={(e) => setNewEvacuation({...newEvacuation, severity: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-750 rounded-2xl text-sm font-bold focus:outline-none"
                >
                  <option value="Haute d'urgence">Haute d'urgence (Absolue)</option>
                  <option value="Modérée">Modérée (Relative)</option>
                  <option value="Basse / Suivi">Basse / Transfert standard</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Raison du transfert / Diagnostic d'urgence</label>
                <textarea 
                  required
                  rows={2}
                  placeholder="Détails du traumatisme, défaillance organique, etc."
                  value={newEvacuation.reason}
                  onChange={(e) => setNewEvacuation({...newEvacuation, reason: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-750 rounded-2xl text-sm font-bold focus:outline-none resize-none"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="button" 
                  onClick={() => setShowAddEvacuationModal(false)}
                  className="flex-1 px-6 py-4 border border-slate-150 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                >
                  Annuler
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-6 py-4 bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
                >
                  Ajouter
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* 5. Add Roster Modal */}
      {showAddRosterModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setShowAddRosterModal(false)} />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] p-8 relative z-10 shadow-2xl"
          >
            <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-6">Affecter un Praticien</h2>
            
            <form onSubmit={handleAddRoster} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nom du praticien</label>
                <input 
                  type="text"
                  required
                  placeholder="Ex: Dr. Michel Sassi"
                  value={newRosterItem.staffName}
                  onChange={(e) => setNewRosterItem({...newRosterItem, staffName: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-750 rounded-2xl text-sm font-bold focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Rôle</label>
                  <select 
                    value={newRosterItem.staffRole}
                    onChange={(e) => setNewRosterItem({...newRosterItem, staffRole: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-750 rounded-2xl text-sm font-bold focus:outline-none"
                  >
                    <option value="Médecin">Médecin</option>
                    <option value="Infirmier">Infirmier</option>
                    <option value="Sage-femme">Sage-femme</option>
                    <option value="Aide-Soignant">Aide-Soignant</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Type de quart</label>
                  <select 
                    value={newRosterItem.shift}
                    onChange={(e) => setNewRosterItem({...newRosterItem, shift: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-750 rounded-2xl text-sm font-bold focus:outline-none"
                  >
                    <option value="Garde de Jour">Garde de Jour (08:00 - 20:00)</option>
                    <option value="Garde de Nuit">Garde de Nuit (20:00 - 08:00)</option>
                    <option value="Astreinte">Astreinte 24h</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Date de service</label>
                <input 
                  type="date"
                  required
                  value={newRosterItem.date}
                  onChange={(e) => setNewRosterItem({...newRosterItem, date: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-750 rounded-2xl text-sm font-bold focus:outline-none"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="button" 
                  onClick={() => setShowAddRosterModal(false)}
                  className="flex-1 px-6 py-4 border border-slate-150 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                >
                  Annuler
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-6 py-4 bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
                >
                  Ajouter
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* 6. Add Epidemic Alert Modal */}
      {showAddEpidemicModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setShowAddEpidemicModal(false)} />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] p-8 relative z-10 shadow-2xl"
          >
            <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-6">Déclarer un Signalement Épidémique</h2>
            
            <form onSubmit={handleAddEpidemicAlert} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Pathologie suspectée</label>
                  <select 
                    value={newEpidemicAlert.disease}
                    onChange={(e) => setNewEpidemicAlert({...newEpidemicAlert, disease: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-750 rounded-2xl text-sm font-bold focus:outline-none"
                  >
                    <option value="Paludisme">Paludisme (Accès Grave)</option>
                    <option value="Gastro-entérite">Gastro-entérite suspecte</option>
                    <option value="Rougeole">Rougeole</option>
                    <option value="Infection Respiratoire">Infection Respiratoire Aiguë</option>
                    <option value="Dengue / Arbovirose">Dengue / Arbovirose</option>
                    <option value="Autre Pathologie">Autre Pathologie d'importance</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cas identifiés</label>
                  <input 
                    type="number"
                    required
                    min="1"
                    value={newEpidemicAlert.suspectedCases}
                    onChange={(e) => setNewEpidemicAlert({...newEpidemicAlert, suspectedCases: parseInt(e.target.value) || 1})}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-750 rounded-2xl text-sm font-bold focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Niveau d'Alerte Sanitaire</label>
                <select 
                  value={newEpidemicAlert.severityLevel}
                  onChange={(e) => setNewEpidemicAlert({...newEpidemicAlert, severityLevel: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-750 rounded-2xl text-sm font-bold focus:outline-none"
                >
                  <option value="Faible">Faible (Vigilance)</option>
                  <option value="Modéré">Modéré (Attention)</option>
                  <option value="Critique">Critique (Seuil Épidémique franchi)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mesures et actions immédiates requises</label>
                <textarea 
                  required
                  rows={3}
                  placeholder="Ex: Confinement des cas, isolement, prophylaxie, distribution de moustiquaires, rapport à l'OMS..."
                  value={newEpidemicAlert.actionsTaken}
                  onChange={(e) => setNewEpidemicAlert({...newEpidemicAlert, actionsTaken: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-750 rounded-2xl text-sm font-bold focus:outline-none resize-none"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="button" 
                  onClick={() => setShowAddEpidemicModal(false)}
                  className="flex-1 px-6 py-4 border border-slate-150 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                >
                  Annuler
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-6 py-4 bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
                >
                  Déclarer
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
