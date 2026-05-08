import React, { useState, useEffect } from 'react';
import { ShoppingBag, TrendingUp, Users, Target, Plus, Search, Filter, ShoppingCart, Tag, CheckCircle2 } from 'lucide-react';
import { collection, query, orderBy, onSnapshot, limit, addDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { SaleRecord } from '../../types';
import { motion } from 'motion/react';

export default function MarketingView() {
  const { profile } = useAuth();
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSale, setNewSale] = useState({
    productName: '',
    quantity: 0,
    price: 0,
    clientName: ''
  });

  useEffect(() => {
    const q = query(
      collection(db, 'sales'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSales(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SaleRecord)));
    });

    return () => unsubscribe();
  }, []);

  const handleAddSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    try {
      await addDoc(collection(db, 'sales'), {
        ...newSale,
        total: newSale.quantity * newSale.price,
        sellerId: profile.id,
        sellerName: profile.fullName,
        createdAt: Date.now()
      });
      setShowAddModal(false);
      setNewSale({ productName: '', quantity: 0, price: 0, clientName: '' });
    } catch (err) {
      console.error("Error adding sale:", err);
    }
  };

  const totalSalesVolume = sales.reduce((acc, sale) => acc + sale.total, 0);

  const stats = [
    { label: 'Volume Ventes', value: `$${totalSalesVolume.toLocaleString()}`, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Nouveaux Clients', value: '24', icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Taux Conversion', value: '18%', icon: Target, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Top Produit', value: 'Maïs G1', icon: ShoppingBag, color: 'text-amber-600', bg: 'bg-amber-50' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Marketing & Ventes</h1>
          <p className="text-slate-500 font-medium">Gestion commerciale, prospection et suivi des ventes.</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-6 py-3 bg-pink-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-pink-700 transition-all shadow-lg active:scale-95"
        >
          <ShoppingCart size={16} /> Enregistrer une Vente
        </button>
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
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-slate-50 dark:border-slate-800 flex justify-between items-center">
              <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Registre des Ventes</h3>
              <div className="flex gap-2">
                <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 border border-slate-50 dark:border-slate-800"><Search size={18} /></button>
                <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 border border-slate-50 dark:border-slate-800"><Filter size={18} /></button>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/50 dark:bg-slate-800/20 border-b border-slate-50 dark:border-slate-800">
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Produit</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Client</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Montant</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                  {sales.map((sale) => (
                    <tr key={sale.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-pink-50 dark:bg-pink-500/10 rounded-lg flex items-center justify-center text-pink-600">
                            <Tag size={14} />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-900 dark:text-white uppercase">{sale.productName}</p>
                            <p className="text-[9px] text-slate-400 font-medium">{sale.quantity} unités soldées</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <p className="text-[10px] font-black text-slate-500 uppercase">{sale.clientName}</p>
                        <p className="text-[9px] text-slate-400 font-medium">Vendeur: {sale.sellerName}</p>
                      </td>
                      <td className="px-8 py-6 text-right font-black text-xs text-slate-900 dark:text-white">
                        ${sale.total?.toLocaleString() || (sale.quantity * sale.price).toLocaleString()}
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex justify-center">
                          <span className="flex items-center gap-1 text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-tight bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1 rounded-full">
                            <CheckCircle2 size={12} /> Complété
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {sales.length === 0 && (
                <div className="py-20 text-center flex flex-col items-center gap-2">
                  <ShoppingBag className="text-slate-200 dark:text-slate-800" size={48} />
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Aucune vente enregistrée</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-pink-600 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl">
            <h3 className="text-lg font-black uppercase tracking-tight mb-4 relative z-10">Objectifs de Vente</h3>
            <div className="space-y-6 relative z-10">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Mensuel</span>
                  <span className="text-[10px] font-black">75%</span>
                </div>
                <div className="h-2 w-full bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full w-3/4 bg-white rounded-full"></div>
                </div>
              </div>
              <p className="text-[11px] font-medium opacity-80 leading-relaxed italic">
                "Nous sommes sur la bonne voie pour dépasser les objectifs du trimestre grâce à la campagne maïs."
              </p>
            </div>
            <div className="absolute top-0 right-0 -mr-12 -mt-12 w-48 h-48 bg-white/10 rounded-full blur-3xl"></div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-8 shadow-sm">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center justify-between">
              Prospection Actuelle <Target size={16} className="text-pink-500" />
            </h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-500/10 text-blue-600 rounded-lg flex items-center justify-center shrink-0">
                  <Users size={16} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white uppercase line-clamp-1">Groupe Aliment</p>
                  <p className="text-[10px] text-slate-500 font-medium">Contrat B2B • En négo</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700">
                <div className="w-8 h-8 bg-amber-100 dark:bg-amber-500/10 text-amber-600 rounded-lg flex items-center justify-center shrink-0">
                  <ShoppingCart size={16} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white uppercase line-clamp-1">Distributeur Nord</p>
                  <p className="text-[10px] text-slate-500 font-medium">Test échantillon</p>
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
            <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-6">Enregistrer une Vente</h2>
            
            <form onSubmit={handleAddSale} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nom du Produit</label>
                <input 
                  type="text"
                  required
                  value={newSale.productName}
                  onChange={(e) => setNewSale({...newSale, productName: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-pink-500/20"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Client</label>
                <input 
                  type="text"
                  required
                  value={newSale.clientName}
                  onChange={(e) => setNewSale({...newSale, clientName: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-pink-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Quantité</label>
                  <input 
                    type="number"
                    required
                    value={newSale.quantity}
                    onChange={(e) => setNewSale({...newSale, quantity: parseFloat(e.target.value)})}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Prix Unitaire ($)</label>
                  <input 
                    type="number"
                    required
                    value={newSale.price}
                    onChange={(e) => setNewSale({...newSale, price: parseFloat(e.target.value)})}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold"
                  />
                </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl flex justify-between items-center mt-4">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Transaction</span>
                <span className="text-xl font-black text-pink-600">${(newSale.quantity * newSale.price).toLocaleString()}</span>
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-6 py-4 border border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all font-sans"
                >
                  Annuler
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-6 py-4 bg-pink-600 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-pink-700 transition-all shadow-lg shadow-pink-600/20"
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
