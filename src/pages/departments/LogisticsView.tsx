import React, { useState, useEffect } from 'react';
import { Package, Truck, ShieldAlert, BarChart3, Plus, ArrowRight, CornerDownRight, History, Box, Search } from 'lucide-react';
import { collection, query, orderBy, onSnapshot, limit, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { InventoryItem } from '../../types';
import { motion } from 'motion/react';

export default function LogisticsView() {
  const { profile } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItem, setNewItem] = useState({
    name: '',
    category: 'Général',
    quantity: 0,
    unit: 'Unité',
    minThreshold: 10,
    location: ''
  });

  useEffect(() => {
    const q = query(
      collection(db, 'inventory'),
      orderBy('updatedAt', 'desc'),
      limit(30)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem)));
    });

    return () => unsubscribe();
  }, []);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    try {
      await addDoc(collection(db, 'inventory'), {
        ...newItem,
        lastUpdatedBy: profile.fullName,
        updatedAt: Date.now()
      });
      setShowAddModal(false);
      setNewItem({ name: '', category: 'Général', quantity: 0, unit: 'Unité', minThreshold: 10, location: '' });
    } catch (err) {
      console.error("Error adding item:", err);
    }
  };

  const lowStockItems = items.filter(item => item.quantity <= item.minThreshold);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Logistique & Stocks</h1>
          <p className="text-slate-500 font-medium">Gestion de l'inventaire, flux et approvisionnement.</p>
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
                  className="pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl text-[10px] font-bold uppercase transition-all focus:ring-2 focus:ring-amber-500/20"
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                  {items.map((item) => {
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
                          <span className={`text-xs font-black ${isLow ? 'text-red-600' : 'text-slate-900 dark:text-white'}`}>
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
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {items.length === 0 && (
                <div className="py-20 text-center text-slate-400 font-black text-[10px] uppercase tracking-widest">
                  Inventaire Vide
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
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="w-1 h-10 bg-emerald-500 rounded-full shrink-0"></div>
                <div>
                  <p className="text-xs font-black uppercase">Entrée Stock</p>
                  <p className="text-[10px] text-slate-400 font-medium">+150 Engrais NPK (Silo A)</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-1 h-10 bg-red-500 rounded-full shrink-0"></div>
                <div>
                  <p className="text-xs font-black uppercase">Sortie Stock</p>
                  <p className="text-[10px] text-slate-400 font-medium">-20 Vaccins (Dept Santé)</p>
                </div>
              </div>
            </div>
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
                    value={newItem.quantity}
                    onChange={(e) => setNewItem({...newItem, quantity: parseFloat(e.target.value)})}
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
                    value={newItem.minThreshold}
                    onChange={(e) => setNewItem({...newItem, minThreshold: parseFloat(e.target.value)})}
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
    </div>
  );
}
