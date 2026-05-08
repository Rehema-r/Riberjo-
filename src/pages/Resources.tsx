import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, getDocs, addDoc, updateDoc, doc, deleteDoc, orderBy, where } from 'firebase/firestore';
import { Asset, Department } from '../types';
import { 
  Package, 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  ArrowUpRight, 
  ArrowDownRight, 
  AlertTriangle,
  Sprout,
  Stethoscope,
  BookOpen,
  Trash2,
  Edit2,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { notificationService } from '../services/notificationService';

export default function Resources() {
  const { profile } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDept, setFilterDept] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    imageUrl: '',
    departmentId: '',
    quantity: 0,
    unit: '',
    status: 'in_stock' as const
  });
  const [viewingAsset, setViewingAsset] = useState<Asset | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const assetsPath = 'assets';
      const assetsSnap = await getDocs(query(collection(db, assetsPath), orderBy('name'))).catch(err => {
        handleFirestoreError(err, OperationType.LIST, assetsPath);
        return { docs: [] } as any;
      });

      const deptsPath = 'departments';
      const deptsSnap = await getDocs(collection(db, deptsPath)).catch(err => {
        handleFirestoreError(err, OperationType.LIST, deptsPath);
        return { docs: [] } as any;
      });
      
      setAssets(assetsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Asset)));
      setDepartments(deptsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Department)));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const handleAddAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const assetPath = 'assets';
      const docRef = await addDoc(collection(db, assetPath), {
        ...formData,
        lastRefill: Date.now()
      });

      // Auto-generate report for new asset addition
      const reportPath = 'reports';
      await addDoc(collection(db, reportPath), {
        title: `Inventaire : Nouvel arrivage - ${formData.name}`,
        content: `AUTOMATIQUE: Nouvel article ajouté à l'inventaire.\n\n` +
                 `Article: ${formData.name}\n` +
                 `Quantité: ${formData.quantity} ${formData.unit}\n` +
                 `Département: ${departments.find(d => d.id === formData.departmentId)?.name || formData.departmentId}\n` +
                 `Description: ${formData.description || 'Non fournie'}\n` +
                 `Date: ${new Date().toLocaleString()}\n` +
                 `Statut initial: ${formData.status}`,
        status: 'pending',
        authorId: profile?.id,
        departmentId: formData.departmentId,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });

      setShowAddModal(false);
      setFormData({ name: '', description: '', imageUrl: '', departmentId: '', quantity: 0, unit: '', status: 'in_stock' });
      fetchData();
      
      notificationService.notify(
        profile?.id || '',
        'Inventaire mis à jour',
        `L'article "${formData.name}" a été ajouté et un rapport a été généré.`,
        'info'
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'assets');
    }
  };

  const handleUpdateQuantity = async (id: string, newQty: number) => {
    const assetPath = `assets/${id}`;
    try {
      const asset = assets.find(a => a.id === id);
      const status = newQty <= 0 ? 'out_of_stock' : newQty < 10 ? 'low' : 'in_stock';
      await updateDoc(doc(db, 'assets', id), {
        quantity: newQty,
        status,
        lastRefill: Date.now()
      });

      if (asset && status !== asset.status) {
         if (status === 'out_of_stock') {
            // Notify admins of this department
            const admins = await getDocs(query(collection(db, 'users'), where('role', 'in', ['ADMIN', 'SUPER_ADMIN']), where('departmentId', '==', asset.departmentId)));
            for (const adminDoc of admins.docs) {
               await notificationService.notify(
                 adminDoc.id,
                 'Rupture de Stock !',
                 `L'article "${asset.name}" est en rupture de stock dans le département ${asset.departmentId}.`,
                 'critical'
               );
            }
         } else if (status === 'low') {
            const admins = await getDocs(query(collection(db, 'users'), where('role', 'in', ['ADMIN', 'SUPER_ADMIN']), where('departmentId', '==', asset.departmentId)));
            for (const adminDoc of admins.docs) {
               await notificationService.notify(
                 adminDoc.id,
                 'Stock Faible',
                 `Le stock de "${asset.name}" est bas (${newQty} ${asset.unit}).`
               );
            }
         }
      }

      fetchData();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, assetPath);
    }
  };

  const handleDeleteAsset = async (id: string) => {
    if (!confirm('Supprimer cet article ?')) return;
    const assetPath = `assets/${id}`;
    try {
      await deleteDoc(doc(db, 'assets', id));
      fetchData();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, assetPath);
    }
  };

  const getDeptIcon = (deptId: string) => {
    if (deptId.includes('ferme')) return <Sprout className="text-emerald-500" size={16} />;
    if (deptId.includes('sante') || deptId.includes('hopital')) return <Stethoscope className="text-blue-500" size={16} />;
    if (deptId.includes('ecole') || deptId.includes('education')) return <BookOpen className="text-amber-500" size={16} />;
    return <Package className="text-slate-400" size={16} />;
  };

  const filteredAssets = assets.filter(a => {
    const matchesSearch = a.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = filterDept === 'all' || a.departmentId === filterDept;
    return matchesSearch && matchesDept;
  });

  const canManage = profile?.role === 'ADMIN' || profile?.role === 'SUPER_ADMIN' || profile?.role === 'SUPER_USER';

  return (
    <div className="max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight uppercase">Inventaire & Stocks</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Gérez les ressources de la ferme, de l'hôpital et de l'école.</p>
        </div>
        {canManage && (
          <button 
            onClick={() => setShowAddModal(true)}
            className="px-6 py-3 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 shadow-xl shadow-emerald-100 dark:shadow-none flex items-center gap-2 transition-all"
          >
            <Plus size={20} />
            Nouvel Article
          </button>
        )}
      </div>

      {/* Stats Quick View */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
         {[
           { label: 'Total Articles', value: assets.length, icon: Package, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10' },
           { label: 'Stock Faible', value: assets.filter(a => a.status === 'low').length, icon: AlertTriangle, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10' },
           { label: 'Rupture', value: assets.filter(a => a.status === 'out_of_stock').length, icon: X, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-500/10' },
           { label: 'Unités en Stock', value: assets.reduce((acc, curr) => acc + curr.quantity, 0), icon: ArrowUpRight, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
         ].map((stat, i) => (
           <div key={i} className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                 <div className={`p-3 rounded-2xl ${stat.bg} ${stat.color}`}>
                    <stat.icon size={20} />
                 </div>
              </div>
              <h4 className="text-2xl font-black text-slate-900 dark:text-white">{stat.value}</h4>
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{stat.label}</p>
           </div>
         ))}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm mb-8 flex flex-col md:flex-row gap-4 items-center">
         <div className="flex-1 relative w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
            <input 
              type="text" 
              placeholder="Rechercher un article..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600"
            />
         </div>
         <div className="flex items-center gap-2 w-full md:w-auto">
            <Filter size={18} className="text-slate-400 dark:text-slate-500" />
            <select 
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
              className="flex-1 md:w-48 px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold text-slate-600 dark:text-slate-400 outline-none"
            >
               <option value="all">Tous les départements</option>
               {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
         </div>
      </div>

      {/* Assets Table */}
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
         <div className="overflow-x-auto scrollbar-hide">
            <table className="w-full text-left border-collapse">
               <thead>
                  <tr className="bg-slate-50/50 dark:bg-slate-800/50">
                     <th className="px-8 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Article</th>
                     <th className="px-8 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Département</th>
                     <th className="px-8 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Quantité</th>
                     <th className="px-8 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Statut</th>
                     <th className="px-8 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Actions</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  {filteredAssets.map(asset => (
                       <tr 
                        key={asset.id} 
                        onClick={() => setViewingAsset(asset)}
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group cursor-pointer"
                      >
                         <td className="px-8 py-5">
                            <div className="flex items-center gap-3">
                               <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center overflow-hidden border border-slate-100 dark:border-slate-800">
                                  {asset.imageUrl ? (
                                    <img src={asset.imageUrl} alt={asset.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                  ) : (
                                    getDeptIcon(asset.departmentId)
                                  )}
                               </div>
                               <div>
                                  <p className="text-sm font-black text-slate-900 dark:text-white tracking-tight uppercase">{asset.name}</p>
                                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase truncate max-w-[150px]">{asset.description || `Ref: ${asset.id.slice(0,6)}`}</p>
                               </div>
                            </div>
                         </td>
                         <td className="px-8 py-5">
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                              {departments.find(d => d.id === asset.departmentId)?.name || asset.departmentId}
                            </span>
                         </td>
                         <td className="px-8 py-5">
                            <div className="flex items-center gap-3">
                               <span className="text-sm font-black text-slate-700 dark:text-slate-300">{asset.quantity} {asset.unit}</span>
                               {canManage && (
                                 <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={(e) => { e.stopPropagation(); handleUpdateQuantity(asset.id, asset.quantity + 1); }} className="p-1.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-500/20"><ArrowUpRight size={14} /></button>
                                    <button onClick={(e) => { e.stopPropagation(); handleUpdateQuantity(asset.id, Math.max(0, asset.quantity - 1)); }} className="p-1.5 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-500/20"><ArrowDownRight size={14} /></button>
                                 </div>
                               )}
                            </div>
                         </td>
                         <td className="px-8 py-5">
                            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${
                              asset.status === 'in_stock' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                               asset.status === 'low' ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                               'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400'
                            }`}>
                               {asset.status.replace('_', ' ')}
                            </span>
                         </td>
                         <td className="px-8 py-5 text-right">
                            <div className="flex justify-end gap-2">
                               {canManage && (
                                 <button 
                                   onClick={(e) => { e.stopPropagation(); handleDeleteAsset(asset.id); }}
                                   className="p-2 text-slate-300 dark:text-slate-700 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all"
                                 >
                                   <Trash2 size={18} />
                                 </button>
                               )}
                            </div>
                         </td>
                      </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>

      {/* Add Modal */}
      {/* Detail Modal */}
      <AnimatePresence>
        {viewingAsset && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setViewingAsset(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[3rem] overflow-hidden shadow-2xl border border-white/20 dark:border-slate-800"
            >
              <div className="relative h-64 bg-slate-100 dark:bg-slate-800">
                {viewingAsset.imageUrl ? (
                  <img src={viewingAsset.imageUrl} alt={viewingAsset.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300 dark:text-slate-700">
                    <Package size={80} strokeWidth={1} />
                  </div>
                )}
                <button 
                  onClick={() => setViewingAsset(null)}
                  className="absolute top-6 right-6 p-2 bg-black/20 hover:bg-black/40 backdrop-blur-md text-white rounded-xl transition-all"
                >
                  <X size={20} />
                </button>
                <div className="absolute bottom-6 left-6">
                   <div className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest backdrop-blur-md border border-white/20 ${
                     viewingAsset.status === 'in_stock' ? 'bg-emerald-500/80 text-white' :
                     viewingAsset.status === 'low' ? 'bg-amber-500/80 text-white' :
                     'bg-red-500/80 text-white'
                   }`}>
                     {viewingAsset.status.replace('_', ' ')}
                   </div>
                </div>
              </div>

              <div className="p-10">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{viewingAsset.name}</h3>
                    <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mt-1">
                      {departments.find(d => d.id === viewingAsset.departmentId)?.name || viewingAsset.departmentId}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-4xl font-black text-slate-900 dark:text-white">{viewingAsset.quantity}</p>
                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{viewingAsset.unit}</p>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-2xl mb-8">
                  <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Description & Notes</p>
                  <p className="text-slate-600 dark:text-slate-400 font-medium leading-relaxed italic">
                    {viewingAsset.description || "Aucune description détaillée enregistrée pour cet article."}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl text-center">
                      <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Dernier approv.</p>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">{new Date(viewingAsset.lastRefill).toLocaleDateString()}</p>
                   </div>
                   <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl text-center">
                      <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">ID Inventaire</p>
                      <p className="text-xs font-bold text-slate-900 dark:text-white font-mono">{viewingAsset.id.slice(0, 8).toUpperCase()}</p>
                   </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl border border-slate-100 dark:border-slate-800"
            >
              <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-8 uppercase tracking-tight">Ajouter un article</h2>
              
              <form onSubmit={handleAddAsset} className="space-y-6">
                 <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Nom de l'article</label>
                    <input 
                      required
                      type="text" 
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600"
                    />
                 </div>

                 <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Description</label>
                    <textarea 
                      rows={2}
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      placeholder="Spécifications techniques..."
                      className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600"
                    />
                 </div>

                 <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">URL de la Photo</label>
                    <input 
                      type="url" 
                      value={formData.imageUrl}
                      onChange={(e) => setFormData({...formData, imageUrl: e.target.value})}
                      placeholder="https://..."
                      className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600"
                    />
                 </div>

                 <div className="grid grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Département</label>
                        <select 
                          required
                          value={formData.departmentId}
                          onChange={(e) => setFormData({...formData, departmentId: e.target.value})}
                          className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-white"
                        >
                           <option value="">Sélectionner</option>
                           {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Quantité Initiale</label>
                        <input 
                          required
                          type="number" 
                          value={formData.quantity}
                          onChange={(e) => setFormData({...formData, quantity: parseInt(e.target.value)})}
                          className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-white"
                        />
                    </div>
                 </div>

                 <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Unité (ex: kg, boîtes, litres)</label>
                    <input 
                      required
                      type="text" 
                      value={formData.unit}
                      onChange={(e) => setFormData({...formData, unit: e.target.value})}
                      className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600"
                    />
                 </div>

                 <div className="flex gap-4 pt-4">
                    <button 
                      type="button" 
                      onClick={() => setShowAddModal(false)}
                      className="flex-1 px-8 py-4 text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-all"
                    >
                      Annuler
                    </button>
                    <button 
                      type="submit" 
                      className="flex-1 px-8 py-4 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 shadow-xl shadow-emerald-100 dark:shadow-none transition-all font-sans"
                    >
                      Ajouter au stock
                    </button>
                 </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
