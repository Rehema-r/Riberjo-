import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, getDocs, addDoc, setDoc, doc, orderBy, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { UserProfile, Department, RolePermission } from '../types';
import { UserPlus, Search, Filter, MoreVertical, X, Check, Mail, Phone, MapPin, Briefcase, Download, Trash2, IdCard, Printer, Shield, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { DEPARTMENTS, generateMatricule, SERVICE_CODES, generatePassword } from '../constants';
import { QRCodeCanvas } from 'qrcode.react';
import { jsPDF } from 'jspdf';

import { notificationService } from '../services/notificationService';

export default function Users() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<RolePermission[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [editData, setEditData] = useState<Partial<UserProfile>>({});
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [tempRole, setTempRole] = useState<string>('');
  const [tempDept, setTempDept] = useState<string>('');
  const [showToast, setShowToast] = useState<{show: boolean, message: string}>({show: false, message: ''});
  const [creationSuccess, setCreationSuccess] = useState<{matricule: string, password: string} | null>(null);
  const [showCard, setShowCard] = useState<UserProfile | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    address: '',
    phone: '',
    recruitmentYear: '2026',
    password: '',
    serviceId: '',
    departmentId: '',
    role: 'USER' as any,
    baseSalary: 150
  });

  const canAddWorker = profile?.role === 'SUPER_ADMIN' || (profile?.role === 'ADMIN' && profile?.departmentId === 'RHU');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const usersPath = 'users';
      const usersSnap = await getDocs(query(collection(db, usersPath), orderBy('fullName'))).catch(err => {
        handleFirestoreError(err, OperationType.LIST, usersPath);
        return { docs: [] } as any;
      });
      setUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as UserProfile)));

      const deptsPath = 'departments';
      const deptsSnap = await getDocs(collection(db, deptsPath)).catch(err => {
        handleFirestoreError(err, OperationType.LIST, deptsPath);
        return { docs: [] } as any;
      });
      setDepartments(deptsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Department)));

      const rolesSnap = await getDocs(collection(db, 'role_permissions'));
      if (!rolesSnap.empty) {
        setRoles(rolesSnap.docs.map(d => d.data() as RolePermission));
      }

      const settingsSnap = await getDoc(doc(db, 'settings', 'global'));
      if (settingsSnap.exists()) {
        setSettings(settingsSnap.data());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const yearStr = formData.recruitmentYear || '2026';
      const yearNum = parseInt(yearStr.slice(-2));
      const matricule = generateMatricule(yearNum, formData.role, formData.departmentId, users.length + 1);
      const generatedPass = generatePassword(formData.fullName, yearStr);
      
      const newUser = {
        ...formData,
        matricule,
        password: generatedPass,
        status: 'active',
        createdAt: Date.now(),
        passwordChanged: false
      };

      const sanitizedId = matricule.replace(/\//g, '_');
      await setDoc(doc(db, 'users', sanitizedId), newUser);

      // Notify the new agent (simulated as we don't have their auth yet, but for history)
      await notificationService.notify(
        sanitizedId,
        'Bienvenue chez RIBERJO',
        `Votre compte a été créé avec succès. Bienvenue dans l'équipe !`,
        'info'
      );
      
      setIsModalOpen(false);
      setCreationSuccess({ matricule, password: generatedPass });
      fetchData();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'users');
      alert("Erreur lors de la création de l'utilisateur.");
    }
  };

  const handleRoleChange = async (userId: string, newRole: any) => {
    setIsUpdating(userId);
    try {
      await updateDoc(doc(db, 'users', userId), {
        role: newRole
      });
      
      await notificationService.notify(
        userId, 
        'Rôle Mis à Jour', 
        `Votre rôle a été modifié en : ${newRole.replace('_', ' ')}`,
        'critical'
      );

      setShowToast({show: true, message: 'Rôle mis à jour avec succès'});
      setTimeout(() => setShowToast({show: false, message: ''}), 3000);
      fetchData();
    } catch (err) {
      console.error(err);
      alert("Erreur lors du changement de rôle.");
    } finally {
      setIsUpdating(null);
    }
  };

  const handleDeptChange = async (userId: string, newDept: string) => {
    setIsUpdating(userId);
    try {
      await updateDoc(doc(db, 'users', userId), {
        departmentId: newDept
      });
      
      await notificationService.notify(
        userId, 
        'Mutation de Département', 
        `Vous avez été affecté au département : ${DEPARTMENTS.find(d => d.id === newDept)?.name || newDept}`,
        'info'
      );

      setShowToast({show: true, message: 'Département mis à jour avec succès'});
      setTimeout(() => setShowToast({show: false, message: ''}), 3000);
      fetchData();
    } catch (err) {
      console.error(err);
      alert("Erreur lors du changement de département.");
    } finally {
      setIsUpdating(null);
    }
  };

  const handleStatusChange = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    setIsUpdating(userId);
    try {
      await updateDoc(doc(db, 'users', userId), {
        status: newStatus
      });
      fetchData();
    } catch (err) {
      console.error(err);
      alert("Erreur lors du changement de statut.");
    } finally {
      setIsUpdating(null);
    }
  };

  const handleUpdateDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setIsUpdating(selectedUser.id);
    try {
      await updateDoc(doc(db, 'users', selectedUser.id), editData);
      setIsDetailModalOpen(false);
      fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdating(null);
    }
  };

  const openDetailModal = (user: UserProfile) => {
    setSelectedUser(user);
    setEditData({
      fullName: user.fullName,
      phone: user.phone || '',
      address: user.address || '',
      recruitmentYear: user.recruitmentYear || ''
    });
    setIsDetailModalOpen(true);
  };

  const handleDeleteUser = async (userId: string, fullName: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer définitivement ${fullName} ? Cette action est irréversible.`)) {
      return;
    }
    
    setIsUpdating(userId);
    try {
      await deleteDoc(doc(db, 'users', userId));
      setShowToast({show: true, message: 'Utilisateur supprimé avec succès'});
      setTimeout(() => setShowToast({show: false, message: ''}), 3000);
      fetchData();
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la suppression de l'utilisateur.");
    } finally {
      setIsUpdating(null);
    }
  };

  const handlePrintCard = (user: UserProfile) => {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: [85.6, 54] // CR80 standard credit card size
    });

    // Get QR Code Data URL from the canvas in the modal
    const qrCanvas = document.querySelector('#service-card-capture canvas') as HTMLCanvasElement;
    const qrDataUrl = qrCanvas?.toDataURL('image/png');

    // Background Color
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(0, 0, 85.6, 54, 3, 3, 'F');

    // Top Bar
    doc.setFillColor(5, 122, 85); // emerald-700
    doc.rect(0, 0, 85.6, 10, 'F');
    
    // Header Text
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('RIBERJO GLOBAL SERVICE', 5, 6.5);
    doc.setFontSize(5);
    doc.text('CARTE DE SERVICE OFFICIELLE', 60, 6.5);

    // Profile Box Placeholder (Letter)
    doc.setDrawColor(240, 240, 240);
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(5, 15, 20, 20, 2, 2, 'FD');
    doc.setTextColor(200, 200, 200);
    doc.setFontSize(18);
    doc.text(user.fullName.charAt(0), 15, 28, { align: 'center' });

    // Details logic
    doc.setTextColor(30, 41, 59); // slate-800
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(user.fullName.toUpperCase(), 30, 20);
    
    doc.setTextColor(5, 150, 105); // emerald-600
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.text(user.role.replace('_', ' '), 30, 24);

    doc.setTextColor(148, 163, 184); // slate-400
    doc.setFontSize(5);
    doc.setFont('helvetica', 'black');
    doc.text('MATRICULE:', 30, 32);
    doc.text('DEPARTEMENT:', 30, 36);
    doc.text('RECRUTEMENT:', 30, 40);

    doc.setTextColor(51, 65, 85); // slate-700
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.text(user.matricule, 50, 32);
    doc.text(user.departmentId, 50, 36);
    doc.text(user.recruitmentYear || '2026', 50, 40);

    // QR Code
    if (qrDataUrl) {
      doc.addImage(qrDataUrl, 'PNG', 65, 15, 15, 15);
    } else {
      doc.setDrawColor(230, 230, 230);
      doc.rect(65, 15, 15, 15);
      doc.setFontSize(4);
      doc.text('QR SECURE', 72.5, 23, { align: 'center' });
    }

    // Footer
    doc.setFillColor(16, 185, 129);
    doc.rect(0, 52, 85.6, 2, 'F');

    doc.save(`Carte_Service_${user.matricule.replace(/\//g, '_')}.pdf`);
  };

  const filteredUsers = users.filter(u => 
    u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.matricule.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const exportToCSV = () => {
    const headers = ['Matricule', 'Nom Complet', 'Email', 'Role', 'Departement', 'Statut', 'Telephone', 'Adresse', 'Annee Recrutement'];
    const data = filteredUsers.map(u => [
      u.matricule,
      u.fullName,
      u.email,
      u.role,
      u.departmentId,
      u.status,
      u.phone || '',
      u.address || '',
      u.recruitmentYear || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...data.map(row => row.map(cell => {
          const val = cell !== null && cell !== undefined ? cell.toString() : '';
          return `"${val.replace(/"/g, '""')}"`;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `liste_utilisateurs_riberjo_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Gestion des Travailleurs</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Administrez l'ensemble des collaborateurs de RIBERJO.</p>
        </div>
        {canAddWorker && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 dark:shadow-none"
          >
            <UserPlus size={20} />
            Ajouter un travailleur
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50 dark:border-slate-800 flex flex-col md:flex-row gap-4 justify-between">
          <div className="relative max-w-md w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
            <input 
              type="text" 
              placeholder="Rechercher un matricule, nom, email..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-900 dark:text-white"
            />
          </div>
          <div className="flex gap-2">
             <button 
                onClick={exportToCSV}
                className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-all border border-slate-100 dark:border-slate-700"
              >
                <Download size={16} /> Exporter
             </button>
             <button className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-all border border-slate-100 dark:border-slate-700">
                <Filter size={16} /> Filtres
             </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
             <thead>
                <tr className="text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-[0.2em] font-black border-b border-slate-50 dark:border-slate-800">
                   <th className="px-6 py-4">Collaborateur</th>
                   <th className="px-6 py-4">Matricule</th>
                   <th className="px-6 py-4">Département</th>
                   <th className="px-6 py-4">Rôle</th>
                   <th className="px-6 py-4">Status</th>
                   <th className="px-6 py-4 text-right">Actions</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400 dark:text-slate-600 italic">Aucun travailleur trouvé</td>
                  </tr>
                ) : (
                  filteredUsers.map(user => (
                    <tr 
                      key={user.id} 
                      onClick={() => openDetailModal(user)}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group cursor-pointer"
                    >
                       <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                             <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold uppercase border border-white dark:border-slate-700 shrink-0 group-hover:bg-emerald-50 dark:group-hover:bg-emerald-500/10 transition-colors">
                                {user.fullName.charAt(0)}
                             </div>
                             <div>
                                <p className="font-bold text-slate-800 dark:text-slate-200 text-sm group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">{user.fullName}</p>
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                                     <Mail size={10} /> {user.email}
                                  </div>
                                  <div className="flex items-center gap-2 text-[9px] font-black text-brand uppercase tracking-widest">
                                     <Briefcase size={9} /> Service {user.serviceId || 'N/A'}
                                  </div>
                                </div>
                             </div>
                          </div>
                       </td>
                       <td className="px-6 py-5">
                          <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg">
                             {user.matricule}
                          </span>
                       </td>
                       <td className="px-6 py-5">
                          {editingDeptId === user.id ? (
                             <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                <select 
                                  value={tempDept}
                                  onChange={(e) => setTempDept(e.target.value)}
                                  className="text-[10px] font-bold uppercase px-2 py-1 rounded-md outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                                >
                                  {DEPARTMENTS.map(d => <option key={d.id} value={d.id}>{d.code}</option>)}
                                </select>
                                <button 
                                  onClick={() => {
                                    handleDeptChange(user.id, tempDept);
                                    setEditingDeptId(null);
                                  }}
                                  className="p-1 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg"
                                >
                                  <Check size={12} />
                                </button>
                                <button onClick={() => setEditingDeptId(null)} className="p-1 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-lg">
                                  <X size={12} />
                                </button>
                             </div>
                          ) : (
                            <span 
                              className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:text-brand"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (profile?.role === 'SUPER_ADMIN' || (profile?.role === 'ADMIN' && profile?.departmentId === 'RHU')) {
                                  setEditingDeptId(user.id);
                                  setTempDept(user.departmentId);
                                }
                              }}
                            >
                              {departments.find(d => d.id === user.departmentId)?.name || user.departmentId}
                            </span>
                          )}
                       </td>
                       <td className="px-6 py-5">
                          {editingRoleId === user.id ? (
                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                              <select 
                                value={tempRole}
                                onChange={(e) => setTempRole(e.target.value)}
                                className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                              >
                                {roles.length > 0 ? (
                                  roles.map(r => (
                                    <option key={r.role} value={r.role}>{r.label}</option>
                                  ))
                                ) : (
                                  <>
                                    <option value="USER">Travailleur</option>
                                    <option value="SUPER_USER">Expert</option>
                                    <option value="ADMIN">Directeur</option>
                                    <option value="SUPER_ADMIN">DG</option>
                                  </>
                                )}
                              </select>
                              <button 
                                onClick={() => {
                                  handleRoleChange(user.id, tempRole);
                                  setEditingRoleId(null);
                                }}
                                className="p-1.5 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg hover:bg-emerald-200 dark:hover:bg-emerald-500/30 transition-all"
                                title="Enregistrer"
                              >
                                <Check size={14} />
                              </button>
                              <button 
                                onClick={() => setEditingRoleId(null)}
                                className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                                title="Annuler"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${
                              user.role === 'SUPER_ADMIN' ? 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400' :
                              user.role === 'ADMIN' ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' :
                              user.role === 'SUPER_USER' ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                              'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                            }`}>
                               {user.role.replace('_', ' ')}
                            </span>
                          )}
                       </td>
                       <td className="px-6 py-5">
                          <button 
                            disabled={isUpdating === user.id || !(profile?.role === 'ADMIN' || profile?.role === 'SUPER_ADMIN')}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatusChange(user.id, user.status);
                            }}
                            className="flex items-center gap-2 group/status"
                          >
                             <div className={`w-2 h-2 rounded-full transition-all ${user.status === 'active' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-300 dark:bg-slate-700'}`}></div>
                             <span className={`text-xs font-bold capitalize transition-colors ${
                               user.status === 'active' ? 'text-slate-600 dark:text-slate-400' : 'text-slate-400 dark:text-slate-600'
                             } group-hover/status:text-emerald-600 dark:group-hover/status:text-emerald-400`}>
                               {user.status}
                             </span>
                          </button>
                       </td>
                       <td className="px-6 py-5 text-right">
                          <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                            {(profile?.role === 'ADMIN' || profile?.role === 'SUPER_ADMIN') && editingRoleId !== user.id && (
                              <button 
                                onClick={() => {
                                  setEditingRoleId(user.id);
                                  setTempRole(user.role);
                                }}
                                className="p-2 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 bg-slate-50 dark:bg-slate-800 rounded-lg transition-all"
                                title="Modifier le rôle"
                              >
                                <Briefcase size={16} />
                              </button>
                            )}
                            {profile?.role === 'SUPER_ADMIN' && (
                              <button 
                                onClick={() => handleDeleteUser(user.id, user.fullName)}
                                className="p-2 text-slate-400 hover:text-red-500 dark:hover:text-red-400 bg-slate-50 dark:bg-slate-800 rounded-lg transition-all"
                                title="Supprimer l'utilisateur"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowCard(user);
                              }}
                              className="p-2 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 bg-slate-50 dark:bg-slate-800 rounded-lg transition-all"
                              title="Imprimer Carte Service"
                            >
                              <IdCard size={16} />
                            </button>
                            <button className="p-2 text-slate-300 dark:text-slate-700 hover:text-slate-600 dark:hover:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all">
                               <MoreVertical size={18} />
                            </button>
                          </div>
                       </td>
                    </tr>
                  ))
                )}
             </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {creationSuccess && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl p-10 text-center"
            >
              <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <Check size={40} />
              </div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2 uppercase tracking-tight">Utilisateur Créé !</h2>
              <p className="text-slate-500 dark:text-slate-400 mb-8 font-medium">Veuillez copier ces identifiants pour le collaborateur.</p>
              
              <div className="space-y-4 mb-8 text-left">
                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Matricule (Identifiant)</p>
                  <p className="font-mono text-lg font-bold text-slate-900 dark:text-white">{creationSuccess.matricule}</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Mot de passe par défaut</p>
                  <p className="font-mono text-lg font-bold text-brand">{creationSuccess.password}</p>
                </div>
              </div>

              <button 
                onClick={() => setCreationSuccess(null)}
                className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black uppercase tracking-widest rounded-2xl hover:brightness-110 transition-all"
              >
                J'ai noté les accès
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => setIsModalOpen(false)}
               className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white">Nouvel Employé</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium tracking-tight">Le matricule et le mot de passe seront générés automatiquement.</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-xl shadow-sm text-slate-400 hover:text-slate-600 dark:hover:text-white transition-all">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto max-h-[70vh]">
                <div>
                  <label className="block text-xs font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-2">Nom Complet</label>
                  <input 
                    required
                    type="text" 
                    value={formData.fullName}
                    onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                    placeholder="ex: Jean Dupont"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-2">Email Professionnel</label>
                  <input 
                    required
                    type="email" 
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    placeholder="jean.dupont@riberjo.com"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-2">Téléphone</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={16} />
                    <input 
                      type="text" 
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      placeholder="+243 ..."
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-2">Année Recrutement</label>
                  <input 
                    type="text" 
                    value={formData.recruitmentYear}
                    onChange={(e) => setFormData({...formData, recruitmentYear: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-2">Département</label>
                  <select 
                    required
                    value={formData.departmentId}
                    onChange={(e) => setFormData({...formData, departmentId: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-900 dark:text-white"
                  >
                    <option value="">Sélectionner</option>
                    {DEPARTMENTS.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-2">Service ID</label>
                  <div className="relative">
                    <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={16} />
                    <input 
                      type="text" 
                      value={formData.serviceId}
                      onChange={(e) => setFormData({...formData, serviceId: e.target.value})}
                      placeholder="ex: 01"
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-2">Salaire de Base ($)</label>
                  <input 
                    type="number" 
                    value={formData.baseSalary}
                    onChange={(e) => setFormData({...formData, baseSalary: parseFloat(e.target.value)})}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-2">Rôle</label>
                  <select 
                    value={formData.role}
                    onChange={(e) => setFormData({...formData, role: e.target.value as any})}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-900 dark:text-white"
                  >
                    {roles.length > 0 ? (
                      roles.map(r => (
                        <option key={r.role} value={r.role}>{r.label}</option>
                      ))
                    ) : (
                      <>
                        <option value="USER">Travailleur</option>
                        <option value="SUPER_USER">Expert</option>
                        <option value="ADMIN">Directeur</option>
                        <option value="SUPER_ADMIN">DG</option>
                      </>
                    )}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-2">Adresse</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={16} />
                    <input 
                      type="text" 
                      value={formData.address}
                      onChange={(e) => setFormData({...formData, address: e.target.value})}
                      placeholder="Adresse complète"
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600"
                    />
                  </div>
                </div>

                <div className="md:col-span-2 flex justify-end gap-3 pt-4">
                   <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-6 py-3 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-2xl font-bold hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    Annuler
                  </button>
                   <button 
                    type="submit"
                    className="px-8 py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 shadow-xl shadow-emerald-100 dark:shadow-none flex items-center gap-2"
                  >
                    <Check size={20} /> Confirmer la création
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCard && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => setShowCard(null)}
               className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[3.5rem] shadow-2xl overflow-hidden"
            >
               <div className="p-8 border-b border-slate-50 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                  <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Prévisualisation de la Carte</h3>
                  <button onClick={() => setShowCard(null)} className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-xl shadow-sm transition-all text-slate-400 hover:text-slate-600">
                     <X size={24} />
                  </button>
               </div>

               <div className="p-12 flex flex-col items-center">
                  <div className="w-[450px] h-[280px] bg-white rounded-3xl shadow-2xl relative overflow-hidden border border-slate-100 p-8 flex gap-6">
                     <div className="absolute top-0 left-0 w-full h-3 bg-emerald-600"></div>
                     <div className="w-1/3 flex flex-col items-center gap-4">
                        <div className="w-24 h-24 bg-slate-100 rounded-2xl flex items-center justify-center text-4xl font-black text-slate-300 border-2 border-slate-50">
                           {showCard.fullName.charAt(0)}
                        </div>
                        <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-50">
                           <QRCodeCanvas value={`RBJ:${showCard.matricule}`} size={80} />
                        </div>
                     </div>
                     <div className="flex-1 space-y-4">
                        <div className="flex justify-between items-start">
                           <div>
                              <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest leading-none mb-1">RIBERJO GLOBAL SERVICE</p>
                              <h4 className="text-xl font-black text-slate-900 uppercase tracking-tighter leading-none">{showCard.fullName}</h4>
                           </div>
                        </div>

                        <div className="space-y-4">
                           <div>
                              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Matricule</p>
                              <p className="font-mono text-sm font-bold text-slate-700">{showCard.matricule}</p>
                           </div>
                           <div>
                              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Fonction & Département</p>
                              <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{showCard.role.replace('_', ' ')} • {showCard.departmentId}</p>
                           </div>
                           <div className="flex justify-between items-end pt-4 border-t border-slate-50">
                              <div>
                                 <p className="text-[7px] font-black text-slate-300 uppercase tracking-widest">Date émission</p>
                                 <p className="text-[8px] font-bold text-slate-400">{new Date().toLocaleDateString()}</p>
                              </div>
                              <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Officiel</span>
                           </div>
                        </div>
                     </div>
                  </div>

                  <div className="mt-12 flex gap-4 w-full max-w-sm">
                     <button 
                        onClick={() => handlePrintCard(showCard)}
                        className="flex-1 py-4 bg-emerald-600 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-emerald-500/20 hover:scale-105 transition-all flex items-center justify-center gap-2"
                     >
                        <Printer size={20} /> Télécharger PDF
                     </button>
                  </div>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isDetailModalOpen && selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => setIsDetailModalOpen(false)}
               className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, x: 20 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.95, x: 20 }}
              className="relative bg-white dark:bg-slate-900 w-full max-w-4xl rounded-[3rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] overflow-hidden flex flex-col md:flex-row max-h-[90vh]"
            >
              {/* Profile Sidebar */}
              <div className="w-full md:w-80 bg-slate-50 dark:bg-slate-800/50 p-6 md:p-10 border-r border-slate-100 dark:border-slate-800 flex flex-col items-center">
                 <div className="w-24 h-24 md:w-32 md:h-32 bg-brand rounded-[2.5rem] flex items-center justify-center text-white text-3xl md:text-4xl font-black shadow-2xl shadow-brand/20 mb-6">
                    {selectedUser.fullName.charAt(0)}
                 </div>
                 <h2 className="text-xl font-black text-slate-900 dark:text-white text-center mb-1 uppercase tracking-tight">{selectedUser.fullName}</h2>
                 <p className="text-xs font-bold text-brand uppercase tracking-widest mb-6">{selectedUser.role.replace('_', ' ')}</p>
                 
                  <div className="w-full space-y-3 md:space-y-4 overflow-y-auto pr-1">
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                       <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Matricule</p>
                       <p className="font-mono text-sm font-bold text-slate-700 dark:text-slate-300">{selectedUser.matricule}</p>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                       <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Recrutement</p>
                       <p className="font-bold text-slate-700 dark:text-slate-300 italic">Année {selectedUser.recruitmentYear || 'N/A'}</p>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                       <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Département</p>
                       <p className="font-bold text-slate-700 dark:text-slate-300">{selectedUser.departmentId}</p>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                       <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Téléphone</p>
                       <p className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                         <Phone size={12} className="text-brand" />
                         {selectedUser.phone || 'Non renseigné'}
                       </p>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                       <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Email</p>
                       <p className="text-sm font-medium text-slate-600 dark:text-slate-400 truncate">{selectedUser.email}</p>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                       <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Adresse</p>
                       <p className="text-sm font-medium text-slate-600 dark:text-slate-400 line-clamp-1">{selectedUser.address || 'Non spécifiée'}</p>
                    </div>
                  </div>
              </div>

              {/* Main Content / Edit Form */}
              <div className="flex-1 p-6 md:p-10 overflow-y-auto">
                 <div className="flex justify-between items-center mb-10">
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Dossier Employé</h3>
                    <button onClick={() => setIsDetailModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all text-slate-400">
                       <X size={24} />
                    </button>
                 </div>

                 <form onSubmit={handleUpdateDetails} className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       <div>
                          <label className="block text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Nom Complet</label>
                          <input 
                            type="text" 
                            disabled={!(profile?.role === 'ADMIN' || profile?.role === 'SUPER_ADMIN')}
                            value={editData.fullName || ''}
                            onChange={(e) => setEditData({...editData, fullName: e.target.value})}
                            className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-white"
                          />
                       </div>
                       <div>
                          <label className="block text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Année de recrutement</label>
                          <input 
                            type="text" 
                            disabled={!(profile?.role === 'ADMIN' || profile?.role === 'SUPER_ADMIN')}
                            value={editData.recruitmentYear || ''}
                            onChange={(e) => setEditData({...editData, recruitmentYear: e.target.value})}
                            className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-white"
                          />
                       </div>
                       <div>
                          <label className="block text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Téléphone</label>
                          <input 
                            type="text" 
                            disabled={!(profile?.role === 'ADMIN' || profile?.role === 'SUPER_ADMIN')}
                            value={editData.phone || ''}
                            onChange={(e) => setEditData({...editData, phone: e.target.value})}
                            className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-white"
                          />
                       </div>
                       <div>
                          <label className="block text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Statut Actuel</label>
                          <div className={`px-6 py-4 rounded-2xl text-sm font-black uppercase tracking-widest ${
                            selectedUser.status === 'active' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400'
                          }`}>
                             {selectedUser.status}
                          </div>
                       </div>
                    </div>

                    <div>
                       <label className="block text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Adresse Résidentielle</label>
                       <textarea 
                         rows={3}
                         disabled={!(profile?.role === 'ADMIN' || profile?.role === 'SUPER_ADMIN')}
                         value={editData.address || ''}
                         onChange={(e) => setEditData({...editData, address: e.target.value})}
                         className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 resize-none text-slate-900 dark:text-white"
                       ></textarea>
                    </div>

                    {(profile?.role === 'ADMIN' || profile?.role === 'SUPER_ADMIN') && (
                      <div className="flex gap-4 pt-6">
                         <button 
                           type="button" 
                           onClick={() => setIsDetailModalOpen(false)}
                           className="flex-1 px-8 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                         >
                           Fermer
                         </button>
                         <button 
                           type="submit" 
                           disabled={isUpdating === selectedUser.id}
                           className="flex-1 px-8 py-4 bg-brand text-white font-bold rounded-2xl hover:brightness-110 shadow-xl shadow-brand/20 dark:shadow-none transition-all flex items-center justify-center gap-2"
                         >
                           {isUpdating === selectedUser.id ? (
                             <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                           ) : (
                             <>
                               <Check size={20} />
                               Enregistrer
                             </>
                           )}
                         </button>
                      </div>
                    )}
                 </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCard && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => setShowCard(null)}
               className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"
            />
            <motion.div 
               initial={{ opacity: 0, scale: 0.9, rotateY: 90 }}
               animate={{ opacity: 1, scale: 1, rotateY: 0 }}
               exit={{ opacity: 0, scale: 0.9, rotateY: -90 }}
               transition={{ type: "spring", damping: 20 }}
               className="relative w-full max-w-sm"
            >
              {/* ID Card Front */}
              <div id="id-card-riberjo" className="bg-white rounded-[2rem] overflow-hidden shadow-2xl aspect-[1.58/1] relative border-4 border-slate-50">
                 {/* Top Bar */}
                 <div className="h-14 bg-emerald-700 flex items-center px-6 justify-between">
                    <div className="flex items-center gap-2">
                       <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-emerald-700 font-black text-sm shadow-inner">R</div>
                       <span className="text-white font-black text-[10px] tracking-tight uppercase">RIBERJO GLOBAL SERVICE</span>
                    </div>
                    <span className="text-emerald-300 font-black text-[8px] uppercase tracking-widest border border-emerald-500/50 px-2 py-1 rounded">CARTE DE TRAVAIL</span>
                 </div>

                 {/* Content */}
                 <div className="p-6 flex gap-6">
                    <div className="w-24 h-24 bg-slate-100 rounded-2xl flex items-center justify-center border-2 border-slate-50 shadow-inner shrink-0 overflow-hidden">
                       {showCard.avatarUrl ? (
                         <img src={showCard.avatarUrl} alt="" className="w-full h-full object-cover" />
                       ) : (
                         <span className="text-3xl font-black text-slate-300">{showCard.fullName.charAt(0)}</span>
                       )}
                    </div>
                    <div className="flex-1">
                       <div className="flex justify-between items-start">
                         <div>
                           <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight mb-1">{showCard.fullName}</h3>
                           <p className="text-[10px] font-bold text-emerald-600 mb-4 uppercase tracking-widest">{showCard.role.replace('_', ' ')}</p>
                         </div>
                         <div className="bg-white p-1 rounded-lg border border-slate-100 shadow-sm">
                           <QRCodeCanvas 
                             value={`${settings?.companyName || 'RIBERJO'}:${showCard.matricule}`}
                             size={48}
                             level="L"
                             includeMargin={false}
                           />
                         </div>
                       </div>
                       
                       <div className="space-y-1">
                          <div className="flex items-center gap-2">
                             <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Matricule:</span>
                             <span className="text-[10px] font-mono font-bold text-slate-700">{showCard.matricule}</span>
                          </div>
                          <div className="flex items-center gap-2">
                             <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Dépt:</span>
                             <span className="text-[10px] font-bold text-slate-700 uppercase">{showCard.departmentId}</span>
                          </div>
                          <div className="flex items-center gap-2">
                             <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Recrutement:</span>
                             <span className="text-[10px] font-bold text-slate-700">{showCard.recruitmentYear || 'N/A'}</span>
                          </div>
                       </div>
                    </div>
                 </div>

                 {/* Footer Decoration */}
                 <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-brand/10 bg-gradient-to-r from-emerald-500 via-yellow-500 to-emerald-500"></div>
                 
                 {/* Watermark Logo */}
                 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-[0.03] scale-150">
                    <div className="w-40 h-40 bg-emerald-900 rounded-full flex items-center justify-center text-white font-black text-9xl">R</div>
                 </div>
              </div>

              {/* Actions */}
              <div className="mt-8 flex gap-4">
                 <button 
                  onClick={() => setShowCard(null)}
                  className="flex-1 py-4 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white font-bold rounded-2xl border border-white/10 transition-all uppercase text-xs tracking-widest"
                 >
                   Fermer
                 </button>
                 <button 
                  onClick={() => showCard && handlePrintCard(showCard)}
                  className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl shadow-xl shadow-emerald-900/20 transition-all flex items-center justify-center gap-2 uppercase text-xs tracking-widest"
                 >
                   <Printer size={16} /> Imprimer
                 </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showToast.show && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] bg-slate-900 dark:bg-emerald-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-white/10"
          >
            <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
              <Check size={14} className="text-white" />
            </div>
            <p className="text-sm font-bold">{showToast.message}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
