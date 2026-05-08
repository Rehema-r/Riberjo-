import { useState, useEffect } from 'react';
import React from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, getDocs, setDoc, doc, deleteDoc, updateDoc, addDoc, where } from 'firebase/firestore';
import { Department, UserProfile, Protocol } from '../types';
import { Building2, Plus, Users, Shield, Trash2, ArrowRight, UserPlus, FileText, ChevronRight, X, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { DEPARTMENTS } from '../constants';

export default function Departments() {
  const { profile } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);
  const [showProtocolModal, setShowProtocolModal] = useState(false);
  const [newProtocol, setNewProtocol] = useState({ title: '', content: '' });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedDept) {
      fetchProtocols(selectedDept.id);
    }
  }, [selectedDept]);

  const getMemberCount = (deptId: string) => {
    return usersCount[deptId] || 0;
  };

  const [usersCount, setUsersCount] = useState<Record<string, number>>({});

  async function fetchData() {
    setLoading(true);
    try {
      const deptsPath = 'departments';
      const deptsSnap = await getDocs(collection(db, deptsPath)).catch(err => {
        handleFirestoreError(err, OperationType.LIST, deptsPath);
        return { docs: [] } as any;
      });
      const depts = deptsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Department));
      setDepartments(depts);

      const usersPath = 'users';
      const usersSnap = await getDocs(query(collection(db, usersPath))).catch(err => {
        handleFirestoreError(err, OperationType.LIST, usersPath);
        return { docs: [] } as any;
      });
      
      const uList = usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as UserProfile));
      setAllUsers(uList);

      // Calculate counts
      const counts: Record<string, number> = {};
      uList.forEach(u => {
        if (u.departmentId) {
          counts[u.departmentId] = (counts[u.departmentId] || 0) + 1;
        }
      });
      setUsersCount(counts);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchProtocols(deptId: string) {
    const protocolsPath = 'protocols';
    try {
      const q = query(collection(db, protocolsPath), where('departmentId', '==', deptId));
      const snap = await getDocs(q).catch(err => {
        handleFirestoreError(err, OperationType.LIST, protocolsPath);
        return { docs: [] } as any;
      });
      setProtocols(snap.docs.map(d => ({ id: d.id, ...d.data() } as Protocol)));
    } catch (err) {
      console.error(err);
    }
  }

  const handleAddProtocol = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDept || !profile) return;

    try {
      await addDoc(collection(db, 'protocols'), {
        departmentId: selectedDept.id,
        title: newProtocol.title,
        content: newProtocol.content,
        updatedBy: profile.fullName,
        updatedAt: Date.now()
      });
      setNewProtocol({ title: '', content: '' });
      setShowProtocolModal(false);
      fetchProtocols(selectedDept.id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteProtocol = async (id: string) => {
    if (!confirm('Supprimer cette règle ?')) return;
    try {
      await deleteDoc(doc(db, 'protocols', id));
      if (selectedDept) fetchProtocols(selectedDept.id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleInitDepts = async () => {
    try {
      for (const dept of DEPARTMENTS) {
        await setDoc(doc(db, 'departments', dept.id), {
          name: dept.name,
          description: dept.description,
          createdAt: Date.now()
        });
      }
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateDirector = async (deptId: string, directorId: string) => {
    setIsUpdating(deptId);
    try {
      await updateDoc(doc(db, 'departments', deptId), {
        directorId: directorId
      });
      fetchData();
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la mise à jour du directeur.");
    } finally {
      setIsUpdating(null);
    }
  };

  const canManage = profile?.role === 'ADMIN' || profile?.role === 'SUPER_ADMIN';

  return (
    <div className="max-w-7xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight uppercase">Départements & Entités</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Gérez la ferme, l'hôpital, l'école et les services centraux.</p>
        </div>
        {departments.length === 0 && (
          <button 
            onClick={handleInitDepts}
            className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg"
          >
            <Plus size={20} />
            Initialiser la structure
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {departments.map((dept, i) => (
          <motion.div 
            key={dept.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={`bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border ${
              selectedDept?.id === dept.id ? 'border-emerald-500 shadow-xl shadow-emerald-100 dark:shadow-none' : 'border-slate-100 dark:border-slate-800 shadow-sm'
            } hover:shadow-xl transition-all group relative overflow-hidden cursor-pointer`}
            onClick={() => setSelectedDept(dept)}
          >
            {/* Background Accent */}
            <div className={`absolute -top-12 -right-12 w-32 h-32 ${selectedDept?.id === dept.id ? 'bg-emerald-100 dark:bg-emerald-500/10' : 'bg-emerald-50 dark:bg-emerald-500/5'} rounded-full group-hover:scale-150 transition-transform duration-500 ease-out`}></div>

            <div className="relative z-10">
              <div className="w-16 h-16 bg-emerald-600 rounded-3xl flex items-center justify-center text-white mb-6 shadow-lg shadow-emerald-100 dark:shadow-none transform group-hover:rotate-6 transition-transform">
                <Building2 size={32} />
              </div>

              <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2 truncate uppercase tracking-tight">{dept.name}</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-8 leading-relaxed line-clamp-2">{dept.description}</p>

                <div className="flex flex-col gap-2 pt-6 border-t border-slate-50 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500">
                       <Shield size={16} />
                       <span className="text-xs font-bold uppercase tracking-wider">Directeur</span>
                    </div>
                    {canManage ? (
                      <select 
                        disabled={isUpdating === dept.id}
                        value={dept.directorId || ''}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleUpdateDirector(dept.id, e.target.value);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-md outline-none focus:ring-2 focus:ring-emerald-500/20 max-w-[150px]"
                      >
                        <option value="">Non assigné</option>
                        {allUsers.filter(u => u.role === 'ADMIN' || u.role === 'SUPER_ADMIN').map(director => (
                          <option key={director.id} value={director.id} className="dark:bg-slate-900 dark:text-white">
                            {director.fullName}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 truncate max-w-[150px]">
                        {allUsers.find(d => d.id === dept.directorId)?.fullName || 'Non assigné'}
                      </span>
                    )}
                  </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500">
                     <Users size={16} />
                     <span className="text-xs font-bold uppercase tracking-wider">Membres</span>
                  </div>
                  <span className="text-xs font-black text-slate-700 dark:text-slate-300">{getMemberCount(dept.id)}</span>
                </div>
              </div>

              <button className={`w-full mt-8 flex items-center justify-center gap-2 py-4 ${
                selectedDept?.id === dept.id ? 'bg-emerald-600 text-white' : 'bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white'
              } font-bold rounded-2xl group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-sm`}>
                {selectedDept?.id === dept.id ? 'Sélectionné' : 'Voir les règles'}
                <ArrowRight size={18} className="transform group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Protocols Section */}
      <AnimatePresence>
        {selectedDept && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="mt-16"
          >
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm">
               <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center">
                     <FileText size={24} />
                  </div>
                  <div>
                      <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase">Constitution & Structure : {selectedDept.name}</h2>
                      <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Standards opérationnels et organisation interne du département.</p>
                  </div>
               </div>
               {canManage && (
                 <button 
                  onClick={() => setShowProtocolModal(true)}
                  className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 dark:shadow-none"
                 >
                   <Plus size={20} />
                   Ajouter une règle
                 </button>
               )}
            </div>

            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm mb-8">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-6 bg-brand rounded-full"></div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Structure de Fonctionnement Interne</h3>
                </div>
                {canManage && (
                  <button 
                    onClick={async () => {
                      try {
                        await updateDoc(doc(db, 'departments', selectedDept.id), {
                          internalStructure: selectedDept.internalStructure || ''
                        });
                        alert('Structure mise à jour avec succès');
                      } catch (err) {
                        console.error(err);
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 dark:shadow-none"
                  >
                    <Save size={14} /> Mettre à jour la structure
                  </button>
                )}
              </div>
              <textarea 
                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-6 text-sm font-medium text-slate-700 dark:text-slate-300 min-h-[150px] focus:ring-2 focus:ring-brand/20 outline-none"
                placeholder="Décrivez ici l'organigramme, les missions spécifiques et le fonctionnement interne du département..."
                value={selectedDept.internalStructure || ''}
                readOnly={!canManage}
                onChange={(e) => setSelectedDept({...selectedDept, internalStructure: e.target.value})}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
               {/* Protocols */}
               <div className="space-y-6">
                 <div className="flex items-center gap-2 mb-4">
                    <div className="w-1.5 h-6 bg-blue-500 rounded-full"></div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Règles et Protocoles</h3>
                 </div>
                 {protocols.length > 0 ? (
                   protocols.map((protocol, i) => (
                     <motion.div 
                      key={protocol.id} 
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm relative group"
                     >
                        {canManage && (
                          <button 
                           onClick={() => handleDeleteProtocol(protocol.id)}
                           className="absolute top-6 right-6 p-2 text-slate-300 dark:text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                        <h4 className="text-md font-bold text-slate-900 dark:text-white mb-3 uppercase tracking-tight">{protocol.title}</h4>
                        <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed whitespace-pre-wrap">{protocol.content}</p>
                     </motion.div>
                   ))
                 ) : (
                   <div className="p-8 bg-slate-50 dark:bg-slate-800/30 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 text-center text-slate-400 text-sm">
                     Aucun protocole défini.
                   </div>
                 )}
               </div>

               {/* Internal Structure (Users) */}
               <div className="space-y-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-1.5 h-6 bg-emerald-500 rounded-full"></div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Membres du Département</h3>
                  </div>
                  <div className="bg-white dark:bg-slate-900 overflow-hidden border border-slate-100 dark:border-slate-800 rounded-[2.5rem] shadow-sm">
                    {allUsers.filter(u => u.departmentId === selectedDept.id).length > 0 ? (
                      <div className="divide-y divide-slate-50 dark:divide-slate-800">
                        {allUsers.filter(u => u.departmentId === selectedDept.id).map(user => (
                          <div key={user.id} className="p-4 flex items-center justify-between group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-400 font-bold uppercase border border-slate-50 dark:border-slate-700">
                                {user.fullName.charAt(0)}
                              </div>
                              <div>
                                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{user.fullName}</p>
                                <p className="text-[10px] text-brand font-black uppercase tracking-widest">{user.role.replace('_', ' ')}</p>
                              </div>
                            </div>
                            <span className="text-[10px] font-mono text-slate-400">{user.matricule}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-12 text-center text-slate-400 italic text-sm">
                        Aucun membre assigné.
                      </div>
                    )}
                  </div>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Protocol Modal */}
      <AnimatePresence>
        {showProtocolModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowProtocolModal(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl"
            >
              <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-8 uppercase tracking-tight">Nouvelle Règle Opérationnelle</h2>
              <form onSubmit={handleAddProtocol} className="space-y-6">
                 <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Titre de la règle</label>
                    <input 
                      required
                      type="text" 
                      value={newProtocol.title}
                      onChange={(e) => setNewProtocol({...newProtocol, title: e.target.value})}
                      className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-white"
                    />
                 </div>
                 <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Contenu du protocole</label>
                    <textarea 
                      required
                      rows={6}
                      value={newProtocol.content}
                      onChange={(e) => setNewProtocol({...newProtocol, content: e.target.value})}
                      className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 resize-none text-slate-900 dark:text-white"
                    ></textarea>
                 </div>
                 <div className="flex flex-col sm:flex-row gap-4 pt-4">
                    <button type="button" onClick={() => setShowProtocolModal(false)} className="flex-1 px-8 py-4 text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl">Annuler</button>
                    <button type="submit" className="flex-1 px-8 py-4 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 shadow-xl shadow-emerald-100 dark:shadow-none flex items-center justify-center gap-2">
                       <Save size={18} />
                       Enregistrer la règle
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

