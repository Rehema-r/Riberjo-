import React, { useState, useEffect } from 'react';
import { Package, Truck, ShieldAlert, BarChart3, Plus, ArrowRight, CornerDownRight, History, Box, Search, ArrowUpDown } from 'lucide-react';
import { collection, query, orderBy, onSnapshot, limit, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { InventoryItem, InventoryTransaction } from '../../types';
import { motion } from 'motion/react';

export default function LogisticsView({ activeSpace = 'USER' }: { activeSpace?: 'USER' | 'SUPER_USER' | 'ADMIN' }) {
  const { profile } = useAuth();

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Create New Item Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItem, setNewItem] = useState({
    name: '',
    category: 'Agricole',
    quantity: 0,
    unit: 'Unité',
    minThreshold: 10,
    location: ''
  });

  // Stock Movement Transaction Modal
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [transType, setTransType] = useState<'in' | 'out'>('in');
  const [transQuantity, setTransQuantity] = useState<number>(0);
  const [transDescription, setTransDescription] = useState<string>('');

  useEffect(() => {
    const q = query(
      collection(db, 'inventory'),
      orderBy('updatedAt', 'desc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem));
      // Show logistics items (assigned to department '05' or having no departmentId for backwards compat)
      const logisticsItems = allItems.filter(item => !item.departmentId || item.departmentId === '05');
      setItems(logisticsItems);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const qTrans = query(
      collection(db, 'inventory_transactions'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribeTrans = onSnapshot(qTrans, (snapshot) => {
      const allTrans = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryTransaction));
      // Show logistics transactions (assigned to department '05' or no departmentId for backwards compat)
      const logisticsTrans = allTrans.filter(t => !t.departmentId || t.departmentId === '05');
      setTransactions(logisticsTrans);
    });

    return () => unsubscribeTrans();
  }, []);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    try {
      await addDoc(collection(db, 'inventory'), {
        ...newItem,
        departmentId: '05',
        lastUpdatedBy: profile.fullName,
        updatedAt: Date.now()
      });
      setShowAddModal(false);
      setNewItem({ name: '', category: 'Agricole', quantity: 0, unit: 'Unité', minThreshold: 10, location: '' });
    } catch (err) {
      console.error("Error adding item:", err);
    }
  };

  const handleSubmissionTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !selectedItem) return;
    if (transQuantity <= 0) return;

    let newQty = selectedItem.quantity;
    if (transType === 'in') {
      newQty += transQuantity;
    } else {
      newQty = Math.max(0, newQty - transQuantity);
    }

    try {
      // 1. Update overall stock item quantity
      await updateDoc(doc(db, 'inventory', selectedItem.id), {
        quantity: newQty,
        lastUpdatedBy: profile.fullName,
        updatedAt: Date.now()
      });

      // 2. Add entry/egress to the transaction ledger
      await addDoc(collection(db, 'inventory_transactions'), {
        itemId: selectedItem.id,
        itemName: selectedItem.name,
        type: transType,
        quantity: transQuantity,
        description: transDescription || (transType === 'in' ? 'Entrée de stock' : 'Consommation de stock'),
        departmentId: selectedItem.departmentId || '05',
        userId: profile.id,
        userName: profile.fullName,
        createdAt: Date.now()
      });

      setShowTransactionModal(false);
      setSelectedItem(null);
      setTransQuantity(0);
      setTransDescription('');
    } catch (err) {
      console.error("Error executing stock transaction:", err);
    }
  };

  const lowStockItems = items.filter(item => item.quantity <= item.minThreshold);
  const filteredItems = items.filter(item => 
    (item.name || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
    (item.category || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
    (item.location || '').toLowerCase().includes((searchTerm || '').toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {activeSpace === 'USER' ? (
        /* Collaborator / Agent Space */
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Logistique & Stocks</h1>
            <p className="text-slate-500 font-medium">Espace Collaborateur : Consultation des stocks & Déclaration de retrait de matériel.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              {/* Declare Egress of stock */}
              <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-8 shadow-sm">
                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight mb-6 flex items-center gap-2">
                  <Box className="text-amber-500" size={24} /> Déclarer l’utilisation / Sortie d’un article
                </h3>

                <form onSubmit={async (e) => {
                  e.preventDefault();
                  if (!profile || !selectedItem || transQuantity <= 0) {
                    alert("Veuillez sélectionner un article et entrer une quantité valide !");
                    return;
                  }
                  if (transQuantity > selectedItem.quantity) {
                    alert("La quantité demandée préssentie dépasse le niveau de stock disponible !");
                    return;
                  }

                  try {
                    const newQty = Math.max(0, selectedItem.quantity - transQuantity);
                    await updateDoc(doc(db, 'inventory', selectedItem.id), {
                      quantity: newQty,
                      lastUpdatedBy: profile.fullName,
                      updatedAt: Date.now()
                    });

                    await addDoc(collection(db, 'inventory_transactions'), {
                      itemId: selectedItem.id,
                      itemName: selectedItem.name,
                      type: 'out',
                      quantity: transQuantity,
                      description: transDescription || 'Retrait collaborateur pour utilisation de terrain',
                      departmentId: '05',
                      userId: profile.id,
                      userName: profile.fullName,
                      createdAt: Date.now()
                    });

                    alert("Sortie de stock enregistrée avec succès !");
                    setTransQuantity(0);
                    setTransDescription('');
                    setSelectedItem(null);
                  } catch (err) {
                    console.error("Error declaring withdrawal:", err);
                  }
                }} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Article à retirer</label>
                      <select
                        value={selectedItem ? selectedItem.id : ''}
                        onChange={(e) => {
                          const itemObj = items.find(i => i.id === e.target.value);
                          setSelectedItem(itemObj || null);
                        }}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold"
                      >
                        <option value="">-- Choisir un article --</option>
                        {items.map(item => (
                          <option key={item.id} value={item.id}>{item.name} ({item.quantity} {item.unit} dispo)</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Quantité à Sortir</label>
                      <input 
                        type="number"
                        min="1"
                        required
                        value={transQuantity || ''}
                        onChange={(e) => setTransQuantity(parseInt(e.target.value) || 0)}
                        placeholder="Ex: 5"
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">But / Emplacement d'utilisation</label>
                    <input 
                      type="text"
                      value={transDescription}
                      onChange={(e) => setTransDescription(e.target.value)}
                      placeholder="Ex: Hangar Sud, tracteur herse..."
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="flex items-center justify-center gap-2 w-full py-4 bg-amber-600 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-amber-700 transition shadow-lg shadow-amber-600/20"
                  >
                    Confirmer le retrait
                  </button>
                </form>
              </div>

              {/* Warehouse stock levels map */}
              <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-8 shadow-sm">
                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight mb-4">État des Stocks Disponibles</h3>
                <p className="text-xs text-slate-400 font-medium mb-6">Consultez en temps réel les quantités en réserve de chaque matériel.</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {items.map((item) => {
                    const isLow = item.quantity <= item.minThreshold;
                    return (
                      <div key={item.id} className="p-4 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100/60 dark:border-slate-750 flex justify-between items-center">
                        <div>
                          <p className="text-xs font-black text-slate-950 dark:text-slate-100 uppercase">{item.name}</p>
                          <p className="text-[9px] text-slate-400 uppercase tracking-tight mt-0.5">Localisation: {item.location || 'Hangar principal'}</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-base font-black ${isLow ? 'text-rose-600' : 'text-slate-900 dark:text-white'}`}>{item.quantity} {item.unit}</p>
                          {isLow && <span className="text-[7px] font-black uppercase text-rose-600 tracking-wider">Stock Bas</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {/* Daily scan checkout instruction */}
              <div className="bg-sky-950 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl">
                <h3 className="text-lg font-black uppercase tracking-tight mb-4 flex items-center gap-2">
                  <Truck className="text-sky-450" size={24} /> Bons de Sorties
                </h3>
                <p className="text-xs text-slate-400 font-medium leading-relaxed mb-6">
                  Toute sortie doit être dument enregistrée via l'application pour garantir le réapprovisionnement automatique par les logisticiens.
                </p>

                <div className="p-5 bg-white/5 rounded-3xl border border-white/10 mb-6 text-center">
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Seuils Alerte</p>
                  <p className="text-xl font-black text-white mt-1">Seuils Intelligents Activés</p>
                </div>

                <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-sky-500/10 rounded-full blur-3xl"></div>
              </div>

              {/* Recent withdrawal feed of USER */}
              <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-8 shadow-sm">
                <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight mb-4 flex items-center gap-2">
                  <History className="text-amber-500" size={20} /> Mes Retraits Récents
                </h3>

                <div className="space-y-3">
                  {transactions.filter(t => t.userId === profile?.id).map((t) => (
                    <div key={t.id} className="p-4 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-850/50 flex justify-between items-center text-xs">
                      <div>
                        <p className="font-bold text-slate-950 dark:text-slate-100 uppercase">{t.itemName}</p>
                        <p className="text-[9px] text-slate-400 mt-0.5">{new Date(t.createdAt).toLocaleDateString()}</p>
                      </div>
                      <span className="font-mono font-black text-rose-600 bg-rose-500/10 px-2 py-0.5 rounded">
                        -{t.quantity}
                      </span>
                    </div>
                  ))}
                  {transactions.filter(t => t.userId === profile?.id).length === 0 && (
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center py-6">Aucun retrait récent.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Original Logistics Super User Admin view */
        <>
          <div className="flex justify-between items-end">
            <div>
              <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Logistique & Stocks</h1>
              <p className="text-slate-500 font-medium">Espace Expert : Gestion globale de l'inventaire, flux et approvisionnement.</p>
            </div>
            <button 
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-6 py-3 bg-amber-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-amber-700 transition-all shadow-lg active:scale-95"
            >
              <Plus size={16} /> Ajouter à l'Inventaire
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm col-span-1"
        >
          <div className="w-12 h-12 bg-amber-50 dark:bg-amber-500/10 text-amber-600 rounded-2xl flex items-center justify-center mb-6">
            <Box size={24} />
          </div>
          <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Total Références</p>
          <p className="text-4xl font-black text-slate-900 dark:text-white">{items.length}</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm col-span-1"
        >
          <div className="w-12 h-12 bg-red-50 dark:bg-red-500/10 text-red-600 rounded-2xl flex items-center justify-center mb-6">
            <ShieldAlert size={24} />
          </div>
          <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Alertes Stock Bas</p>
          <p className="text-4xl font-black text-slate-900 dark:text-white">{lowStockItems.length}</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl col-span-1"
        >
          <div className="relative z-10">
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mb-6">
              <Truck size={24} />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-1">Livraisons à venir</p>
            <p className="text-4xl font-black">04</p>
          </div>
          <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl"></div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm">
            <div className="p-8 border-b border-slate-50 dark:border-slate-800 flex justify-between items-center">
              <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Inventaire Global</h3>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Rechercher..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-105 dark:border-slate-700 rounded-xl text-[10px] font-bold uppercase transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Article</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Catégorie</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Emplacement</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Quantité</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">État</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Flux</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                  {filteredItems.map((item) => {
                    const isLow = item.quantity <= item.minThreshold;
                    const isOut = item.quantity === 0;
                    return (
                      <tr key={item.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-8 py-6">
                          <p className="text-xs font-bold text-slate-900 dark:text-white uppercase">{item.name}</p>
                          <p className="text-[9px] text-slate-400 font-medium">Mis à jour par {item.lastUpdatedBy}</p>
                        </td>
                        <td className="px-8 py-6">
                          <span className="text-[9px] font-black px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-md uppercase">
                            {item.category}
                          </span>
                        </td>
                        <td className="px-8 py-6 text-[10px] font-mono text-slate-500 uppercase">
                          {item.location || 'Non spécifié'}
                        </td>
                        <td className="px-8 py-6 text-right">
                          <span className={`text-xs font-black ${isLow ? 'text-red-650' : 'text-slate-900 dark:text-white'}`}>
                            {item.quantity} {item.unit}
                          </span>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex justify-center">
                            <span className={`text-[9px] font-black px-2 py-1 rounded-full uppercase tracking-tighter ${
                              isOut ? 'bg-red-500 text-white' : 
                              isLow ? 'bg-amber-100 text-amber-700' : 
                              'bg-emerald-100 text-emerald-700'
                            }`}>
                              {isOut ? 'Rupture' : isLow ? 'Faible' : 'Optimale'}
                            </span>
                          </div>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <button
                            onClick={() => {
                              setSelectedItem(item);
                              setShowTransactionModal(true);
                              setTransType('in');
                            }}
                            className="p-2 border border-slate-200 dark:border-slate-800 bg-slate-50 hover:bg-amber-500 dark:bg-slate-900 dark:hover:bg-amber-600 hover:text-white dark:text-white rounded-xl transition-all inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider"
                            title="Ajuster/Mouvement Stock"
                          >
                            <ArrowUpDown size={12} />
                            Mvt
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredItems.length === 0 && (
                <div className="py-20 text-center text-slate-400 font-black text-[10px] uppercase tracking-widest">
                  Aucun article trouvé
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-8 shadow-sm">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center justify-between">
              Alertes Critiques <ShieldAlert size={16} className="text-red-500" />
            </h3>
            <div className="space-y-4">
              {lowStockItems.length === 0 ? (
                <p className="text-[10px] text-slate-400 font-medium text-center py-4">Aucune alerte en cours.</p>
              ) : (
                lowStockItems.map(item => (
                  <div key={item.id} className="p-4 bg-red-50 dark:bg-red-500/10 rounded-2xl border border-red-100 dark:border-red-500/20">
                    <div className="flex justify-between items-start mb-1">
                      <p className="text-xs font-black text-red-900 dark:text-red-300 uppercase line-clamp-1">{item.name}</p>
                      <ArrowRight size={14} className="text-red-400" />
                    </div>
                    <p className="text-[10px] font-bold text-red-700/60 dark:text-red-400/60 uppercase">
                      Seuil: {item.minThreshold} {item.unit} | Actuel: {item.quantity}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-8 shadow-sm">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center justify-between">
              Historique Flux <History size={16} />
            </h3>
            <div className="max-h-80 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
              {transactions.length === 0 ? (
                <p className="text-[10px] text-slate-400 font-medium text-center py-4">Aucun flux enregistré.</p>
              ) : (
                transactions.map(t => (
                  <div key={t.id} className="flex gap-3 items-start border-b border-slate-100 dark:border-slate-800/45 pb-3 last:border-0 last:pb-0">
                    <div className={`w-1.5 h-10 rounded-full shrink-0 ${t.type === 'in' ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-black uppercase tracking-tight text-slate-900 dark:text-white line-clamp-1">{t.itemName}</p>
                        <span className={`text-[10px] font-mono font-black ${t.type === 'in' ? 'text-emerald-500' : 'text-amber-500'}`}>
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


      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setShowAddModal(false)} />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] p-8 relative z-10 shadow-2xl"
          >
            <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-6">Ajouter une Référence</h2>
            
            <form onSubmit={handleAddItem} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nom de l'article</label>
                <input 
                  type="text"
                  required
                  value={newItem.name}
                  onChange={(e) => setNewItem({...newItem, name: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Catégorie</label>
                  <select 
                    value={newItem.category}
                    onChange={(e) => setNewItem({...newItem, category: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold"
                  >
                    <option value="Agricole">Agricole</option>
                    <option value="Médical">Médical</option>
                    <option value="Bureautique">Bureautique</option>
                    <option value="Carburant">Carburant</option>
                    <option value="Pièces">Pièces Auto</option>
                    <option value="Autre">Autre</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Emplacement</label>
                  <input 
                    type="text"
                    value={newItem.location}
                    onChange={(e) => setNewItem({...newItem, location: e.target.value})}
                    placeholder="Ex: Entrepôt A"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Quantité</label>
                  <input 
                    type="number"
                    value={isNaN(newItem.quantity) ? '' : newItem.quantity}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setNewItem({...newItem, quantity: isNaN(val) ? 0 : val});
                    }}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Unité</label>
                  <input 
                    type="text"
                    value={newItem.unit}
                    onChange={(e) => setNewItem({...newItem, unit: e.target.value})}
                    placeholder="Ex: Kg"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Seuil Alerte</label>
                  <input 
                    type="number"
                    value={isNaN(newItem.minThreshold) ? '' : newItem.minThreshold}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setNewItem({...newItem, minThreshold: isNaN(val) ? 0 : val});
                    }}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold border-amber-200 dark:border-amber-900/50"
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
                  className="flex-1 px-6 py-4 bg-amber-600 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-amber-700 transition-all shadow-lg shadow-amber-600/20"
                >
                  Ajouter
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {showTransactionModal && selectedItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => { setShowTransactionModal(false); setSelectedItem(null); }} />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] p-8 relative z-10 shadow-2xl"
          >
            <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-1">Mouvement de Stock</h2>
            <p className="text-xs text-slate-500 font-medium mb-6 uppercase tracking-wider font-mono bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700 inline-block">{selectedItem.name}</p>

            <form onSubmit={handleSubmissionTransaction} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Type de mouvement</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setTransType('in')}
                    className={`py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${
                      transType === 'in' 
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' 
                        : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Entrée Stock (+)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTransType('out')}
                    className={`py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${
                      transType === 'out' 
                        ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20' 
                        : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Sortie Stock (-)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Quantité ({selectedItem.unit})</label>
                  <input 
                    type="number"
                    required
                    min="1"
                    step="any"
                    value={transQuantity || ''}
                    onChange={(e) => setTransQuantity(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Stock Actuel</label>
                  <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-black text-slate-850 dark:text-slate-200">
                    {selectedItem.quantity} {selectedItem.unit}
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Motif / Commentaire</label>
                <input 
                  type="text"
                  required
                  placeholder="Ex: Réassort, consommation, distribution..."
                  value={transDescription}
                  onChange={(e) => setTransDescription(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-805 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold focus:outline-none"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="button" 
                  onClick={() => { setShowTransactionModal(false); setSelectedItem(null); }}
                  className="flex-1 px-6 py-4 border border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all font-sans"
                >
                  Annuler
                </button>
                <button 
                  type="submit"
                  className={`flex-1 px-6 py-4 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl hover:opacity-90 transition-all shadow-lg ${
                    transType === 'in' ? 'bg-emerald-600 shadow-emerald-600/20' : 'bg-amber-600 shadow-amber-600/20'
                  }`}
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
