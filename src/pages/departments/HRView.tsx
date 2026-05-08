import React, { useState, useEffect } from 'react';
import { Users, UserPlus, ShieldAlert, Award, FileText, Search, UserCheck, Briefcase, Mail } from 'lucide-react';
import { collection, query, orderBy, onSnapshot, setDoc, doc, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { UserProfile } from '../../types';
import { motion } from 'motion/react';

export default function HRView() {
  const { profile } = useAuth();
  const [employees, setEmployees] = useState<UserProfile[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmployee, setNewEmployee] = useState({
    fullName: '',
    email: '',
    role: 'USER' as any,
    departmentId: 'RH',
    serviceId: '01',
    gender: 'M' as 'M' | 'F',
    function: '',
    birthDate: '',
    civilStatus: 'Célibataire'
  });

  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'users'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setEmployees(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile)));
    });

    return () => unsubscribe();
  }, []);

  const generateMatricule = async (deptId: string, serviceId: string) => {
    const year = new Date().getFullYear().toString().slice(-2);
    // Get count of employees in this dept/service to generate PPP
    const employeesSnapshot = await getDocs(collection(db, 'users'));
    const count = employeesSnapshot.size + 1;
    const ppp = count.toString().padStart(3, '0');
    
    // Format: AA/RBJ-SS-DD-PPP
    return `${year}/RBJ-${serviceId}-${deptId.slice(0, 2).toUpperCase()}-${ppp}`;
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setIsCreating(true);

    try {
      const matricule = await generateMatricule(newEmployee.departmentId, newEmployee.serviceId);
      const sanitizedId = matricule.replace(/\//g, '_');
      
      const employeeData = {
        ...newEmployee,
        matricule,
        password: 'ChangeMe123!', // Temporary password
        status: 'active',
        passwordChanged: false,
        createdAt: Date.now()
      };

      await setDoc(doc(db, 'users', sanitizedId), employeeData);
      setShowAddModal(false);
      setNewEmployee({ 
        fullName: '', email: '', role: 'USER', departmentId: 'RH', 
        serviceId: '01', gender: 'M', function: '', birthDate: '', 
        civilStatus: 'Célibataire' 
      });
      alert(`Employé créé avec succès!\nMatricule: ${matricule}\nMot de passe par défaut: ChangeMe123!`);
    } catch (err) {
      console.error("Error creating employee:", err);
      alert("Erreur lors de la création de l'employé.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Ressources Humaines</h1>
          <p className="text-slate-500 font-medium">Gestion du personnel, recrutement et carrières.</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg active:scale-95"
        >
          <UserPlus size={16} /> Recruter un Employé
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 rounded-2xl flex items-center justify-center mb-6">
            <Users size={24} />
          </div>
          <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Total Effectif</p>
          <p className="text-4xl font-black text-slate-900 dark:text-white">{employees.length}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="w-12 h-12 bg-blue-50 dark:bg-blue-500/10 text-blue-600 rounded-2xl flex items-center justify-center mb-6">
            <UserCheck size={24} />
          </div>
          <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Présence Jour</p>
          <p className="text-4xl font-black text-slate-900 dark:text-white">94%</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="w-12 h-12 bg-amber-50 dark:bg-amber-500/10 text-amber-600 rounded-2xl flex items-center justify-center mb-6">
            <Award size={24} />
          </div>
          <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Certifications</p>
          <p className="text-4xl font-black text-slate-900 dark:text-white">12</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-50 dark:border-slate-800 flex justify-between items-center">
            <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Registre du Personnel</h3>
            <div className="flex gap-4">
               <div className="relative">
                 <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                 <input 
                   type="text" 
                   placeholder="Rechercher par nom ou matricule..." 
                   className="pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none"
                 />
               </div>
            </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/20 border-b border-slate-50 dark:border-slate-800">
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Employé</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Matricule</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Département</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Statut</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50 text-sans">
              {employees.map((emp) => (
                <tr key={emp.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-500 font-bold uppercase border border-white dark:border-slate-700 shadow-inner">
                        {emp.fullName.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{emp.fullName}</p>
                        <p className="text-[10px] text-slate-500 font-medium underline">{emp.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className="text-[10px] font-mono font-black text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg">
                      {emp.matricule}
                    </span>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-2">
                       <Briefcase size={14} className="text-slate-400" />
                       <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">{emp.departmentId}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-tighter ${
                      emp.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {emp.status === 'active' ? 'Actif' : 'Suspendu'}
                    </span>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex justify-center gap-2">
                      <button className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-colors"><FileText size={16} /></button>
                      <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors"><Mail size={16} /></button>
                      <button className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"><ShieldAlert size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {employees.length === 0 && (
            <div className="py-20 text-center flex flex-col items-center gap-2">
              <Users className="text-slate-200 dark:text-slate-800" size={48} />
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest text-sans">Aucun employé dans le registre</p>
            </div>
          )}
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setShowAddModal(false)} />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[2.5rem] p-10 relative z-10 shadow-2xl overflow-y-auto max-h-[90vh]"
          >
            <h2 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-8">Nouveau Recrutement</h2>
            
            <form onSubmit={handleCreateEmployee} className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nom Complet</label>
                  <input 
                    type="text" required
                    value={newEmployee.fullName}
                    onChange={(e) => setNewEmployee({...newEmployee, fullName: e.target.value})}
                    placeholder="Ex: Jean Dupont"
                    className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Professionnel</label>
                  <input 
                    type="email" required
                    value={newEmployee.email}
                    onChange={(e) => setNewEmployee({...newEmployee, email: e.target.value})}
                    placeholder="j.dupont@riberjo.com"
                    className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Département</label>
                  <select 
                    value={newEmployee.departmentId}
                    onChange={(e) => setNewEmployee({...newEmployee, departmentId: e.target.value})}
                    className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold"
                  >
                    <option value="RH">RH</option>
                    <option value="DG">DG</option>
                    <option value="Ferme">Ferme</option>
                    <option value="Santé">Santé</option>
                    <option value="Finance">Finance</option>
                    <option value="Logistique">Logistique</option>
                    <option value="Marketing">Marketing</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Rôle Système</label>
                  <select 
                    value={newEmployee.role}
                    onChange={(e) => setNewEmployee({...newEmployee, role: e.target.value as any})}
                    className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold"
                  >
                    <option value="USER">Travailleur (User)</option>
                    <option value="SUPER_USER">Expert (Super User)</option>
                    <option value="ADMIN">Directeur (Admin)</option>
                    <option value="SUPER_ADMIN">DG (Super Admin)</option>
                  </select>
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Service Code (SS)</label>
                   <input 
                    type="text" required
                    value={newEmployee.serviceId}
                    onChange={(e) => setNewEmployee({...newEmployee, serviceId: e.target.value})}
                    placeholder="Ex: 01"
                    className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-6">
                 <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fonction</label>
                  <input 
                    type="text" required
                    value={newEmployee.function}
                    onChange={(e) => setNewEmployee({...newEmployee, function: e.target.value})}
                    placeholder="Ex: Agronome"
                    className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold"
                  />
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Sexe</label>
                    <div className="flex gap-4 p-1 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                      <button 
                        type="button" 
                        onClick={() => setNewEmployee({...newEmployee, gender: 'M'})}
                        className={`flex-1 py-2 text-[10px] font-black uppercase rounded-xl transition-all ${newEmployee.gender === 'M' ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm' : 'text-slate-400'}`}
                      >
                        Homme
                      </button>
                      <button 
                         type="button"
                         onClick={() => setNewEmployee({...newEmployee, gender: 'F'})}
                         className={`flex-1 py-2 text-[10px] font-black uppercase rounded-xl transition-all ${newEmployee.gender === 'F' ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm' : 'text-slate-400'}`}
                      >
                        Femme
                      </button>
                    </div>
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">État Civil</label>
                    <select 
                      value={newEmployee.civilStatus}
                      onChange={(e) => setNewEmployee({...newEmployee, civilStatus: e.target.value})}
                      className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold"
                    >
                      <option value="Célibataire">Célibataire</option>
                      <option value="Marié(e)">Marié(e)</option>
                      <option value="Divorcé(e)">Divorcé(e)</option>
                      <option value="Veuf/Veuve">Veuf/Veuve</option>
                    </select>
                </div>
              </div>

              <div className="flex gap-4 pt-8">
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-8 py-5 border border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                >
                  Annuler
                </button>
                <button 
                  type="submit"
                  disabled={isCreating}
                  className="flex-1 px-8 py-5 bg-emerald-600 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-500/20 disabled:opacity-50"
                >
                  {isCreating ? 'Traitement...' : 'Finaliser le Recrutement'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
