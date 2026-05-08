import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs } from 'firebase/firestore';
import { NotificationPrefs, AppSettings, RolePermission, UserProfile } from '../types';
import { notificationService } from '../services/notificationService';
import { Save, Settings as SettingsIcon, Palette, Building, UserCheck, CheckCircle2, ShieldCheck, Check, X, User, Phone, MapPin, Camera, Bell, Trash2, ShieldAlert, QrCode } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { deleteDoc } from 'firebase/firestore';
import { QRCodeCanvas } from 'qrcode.react';

const DEFAULT_ROLES: RolePermission[] = [
  {
    role: 'SUPER_ADMIN',
    label: 'Directeur Général',
    description: 'Accès total au système, gestion financière et stratégique.',
    permissions: { 
      manageUsers: true, manageDept: true, validateReports: true, manageAssets: true, 
      manageProtocols: true, manageSettings: true, viewReports: true, 
      createTasks: true, accessArchive: true 
    }
  },
  {
    role: 'ADMIN',
    label: 'Administrateur / Directeur',
    description: 'Gestion des opérations quotidiennes et des rapports de département.',
    permissions: { 
      manageUsers: true, manageDept: true, validateReports: true, manageAssets: true, 
      manageProtocols: true, manageSettings: false, viewReports: true, 
      createTasks: true, accessArchive: true 
    }
  },
  {
    role: 'SUPER_USER',
    label: 'Super Utilisateur / Expert',
    description: 'Accès avancé pour les experts techniques et chefs de service.',
    permissions: { 
      manageUsers: false, manageDept: false, validateReports: true, manageAssets: true, 
      manageProtocols: true, manageSettings: false, viewReports: true, 
      createTasks: true, accessArchive: false 
    }
  },
  {
    role: 'USER',
    label: 'Utilisateur / Employé',
    description: 'Accès standard pour l\'exécution des tâches et rapports simples.',
    permissions: { 
      manageUsers: false, manageDept: false, validateReports: false, manageAssets: false, 
      manageProtocols: false, manageSettings: false, viewReports: false, 
      createTasks: false, accessArchive: false 
    }
  }
];

export default function Settings() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'notifications' | 'system'>('profile');
  const [settings, setSettings] = useState<AppSettings>({
    companyName: 'RIBERJO',
    primaryColor: '#10B981',
    defaultRegistrationRole: 'USER',
    allowSelfRegistration: false,
    updatedAt: Date.now()
  });
  
  // Profile state
  const [profileData, setProfileData] = useState({
    fullName: '',
    phone: '',
    address: '',
    avatarUrl: ''
  });

  // Auto-save drafts
  useEffect(() => {
    const profileDraft = localStorage.getItem('profile_form_draft');
    if (profileDraft) {
      try {
        setProfileData(prev => ({ ...prev, ...JSON.parse(profileDraft) }));
      } catch (e) {}
    }
    const settingsDraft = localStorage.getItem('settings_form_draft');
    if (settingsDraft) {
      try {
        setSettings(prev => ({ ...prev, ...JSON.parse(settingsDraft) }));
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'profile') {
      const timeout = setTimeout(() => {
        localStorage.setItem('profile_form_draft', JSON.stringify(profileData));
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [profileData, activeTab]);

  useEffect(() => {
    if (activeTab === 'system') {
      const timeout = setTimeout(() => {
        localStorage.setItem('settings_form_draft', JSON.stringify(settings));
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [settings, activeTab]);

  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPrefs>({
    newTasks: true,
    reportValidations: true,
    criticalAlerts: true,
    mentions: true,
    departmentUpdates: true
  });

  const [roles, setRoles] = useState<RolePermission[]>(DEFAULT_ROLES);
  const [editingRole, setEditingRole] = useState<RolePermission | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profile) {
      setProfileData({
        fullName: profile.fullName || '',
        phone: profile.phone || '',
        address: profile.address || '',
        avatarUrl: profile.avatarUrl || ''
      });
      if (profile.notificationPrefs) {
        setNotificationPrefs(profile.notificationPrefs);
      }
    }
    fetchData();
  }, [profile]);

  async function fetchData() {
    setLoading(true);
    try {
      const docRef = doc(db, 'settings', 'global');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        setSettings(snap.data() as AppSettings);
      }

      const rolesSnap = await getDocs(collection(db, 'role_permissions'));
      if (!rolesSnap.empty) {
        setRoles(rolesSnap.docs.map(d => d.data() as RolePermission));
      } else {
        // Initialize default roles if not in DB
        for (const r of DEFAULT_ROLES) {
          await setDoc(doc(db, 'role_permissions', r.role), r);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaved(false);
    try {
      await updateDoc(doc(db, 'settings', 'global'), {
        ...settings,
        updatedAt: Date.now()
      });
      localStorage.removeItem('settings_form_draft');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setIsSaving(true);
    setSaved(false);
    try {
      await updateDoc(doc(db, 'users', profile.id), {
        fullName: profileData.fullName,
        phone: profileData.phone,
        address: profileData.address,
        avatarUrl: profileData.avatarUrl
      });
      localStorage.removeItem('profile_form_draft');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveNotificationPrefs = async () => {
    if (!profile) return;
    setIsSaving(true);
    setSaved(false);
    try {
      await updateDoc(doc(db, 'users', profile.id), {
        notificationPrefs: notificationPrefs
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateRole = async (role: RolePermission) => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'role_permissions', role.role), role);
      setRoles(prev => {
        const index = prev.findIndex(r => r.role === role.role);
        if (index > -1) {
          return prev.map(r => r.role === role.role ? role : r);
        }
        return [...prev, role];
      });
      setEditingRole(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la mise à jour du rôle.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (['SUPER_ADMIN', 'ADMIN', 'USER', 'SUPER_USER'].includes(roleId)) {
      alert("Impossible de supprimer les rôles système par défaut.");
      return;
    }
    
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce rôle ? Cette action est irréversible et pourrait affecter les utilisateurs assignés.")) return;

    setIsSaving(true);
    try {
      await deleteDoc(doc(db, 'role_permissions', roleId));
      setRoles(roles.filter(r => r.role !== roleId));
      if (editingRole?.role === roleId) setEditingRole(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la suppression du rôle.");
    } finally {
      setIsSaving(false);
    }
  };

  const canManageSystem = profile?.role === 'SUPER_ADMIN' || profile?.role === 'ADMIN';

  if (loading) {
    return <div className="h-full flex items-center justify-center text-slate-400">Chargement...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight uppercase">Paramètres</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Gérez votre compte et les préférences du système.</p>
        </div>
        
        <div className="flex bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl gap-1">
          <button 
            onClick={() => setActiveTab('profile')}
            className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              activeTab === 'profile' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            Mon Profil
          </button>
          <button 
            onClick={() => setActiveTab('notifications')}
            className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              activeTab === 'notifications' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            Notifications
          </button>
          {canManageSystem && (
            <button 
              onClick={() => setActiveTab('system')}
              className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                activeTab === 'system' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              Système
            </button>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'profile' ? (
          <motion.div 
            key="profile"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-8"
          >
            {/* Profile Section */}
            <form onSubmit={handleSaveProfile} className="space-y-8">
              <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-slate-100 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-8 mb-10">
                  <div className="relative group">
                    <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-[2rem] overflow-hidden border-4 border-white dark:border-slate-700 shadow-lg flex items-center justify-center text-slate-400">
                      {profileData.avatarUrl ? (
                        <img src={profileData.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <User size={40} />
                      )}
                    </div>
                    <label className="absolute -bottom-2 -right-2 p-2 bg-emerald-600 text-white rounded-xl shadow-lg cursor-pointer hover:bg-emerald-700 transition-colors">
                      <Camera size={16} />
                      <input 
                        type="button" 
                        onClick={() => {
                          const url = prompt("Lien de votre photo (ou laissez vide pour une photo aléatoire) :");
                          if (url !== null) {
                            setProfileData({...profileData, avatarUrl: url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile?.id}`});
                          }
                        }}
                        className="sr-only"
                      />
                    </label>
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{profileData.fullName || profile?.fullName}</h2>
                    <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">{profile?.role}</p>
                    <div className="mt-2 flex items-center gap-2">
                       <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Matricule :</span>
                       <code className="text-xs bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-lg text-slate-600 dark:text-slate-300 font-black">{profile?.matricule}</code>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Nom Complet</label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">
                        <User size={18} />
                      </div>
                      <input 
                        type="text" 
                        value={profileData.fullName}
                        onChange={(e) => setProfileData({...profileData, fullName: e.target.value})}
                        className="w-full pl-12 pr-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Télephone</label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">
                        <Phone size={18} />
                      </div>
                      <input 
                        type="tel" 
                        value={profileData.phone}
                        onChange={(e) => setProfileData({...profileData, phone: e.target.value})}
                        className="w-full pl-12 pr-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600"
                      />
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Adresse</label>
                    <div className="relative">
                      <div className="absolute left-4 top-4 text-slate-400 dark:text-slate-500">
                        <MapPin size={18} />
                      </div>
                      <textarea 
                        rows={3}
                        value={profileData.address}
                        onChange={(e) => setProfileData({...profileData, address: e.target.value})}
                        className="w-full pl-12 pr-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600"
                      ></textarea>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end items-center gap-4">
                <AnimatePresence>
                  {saved && (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                      <CheckCircle2 size={18} />
                      <span>Profil mis à jour !</span>
                    </motion.div>
                  )}
                </AnimatePresence>
                <button 
                  type="submit" 
                  disabled={isSaving}
                  className="px-10 py-4 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 shadow-xl shadow-emerald-100 dark:shadow-none flex items-center gap-2 transition-all disabled:opacity-50"
                >
                  <Save size={20} />
                  Enregistrer mes infos
                </button>
              </div>
            </form>

            {/* QR Code Section */}
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-slate-100 dark:border-slate-800 shadow-sm mt-8">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                  <QrCode size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white uppercase tracking-tight">Mon Identité Numérique (QR Code)</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Inclut votre matricule et l'identification de l'entreprise.</p>
                </div>
              </div>

              <div className="flex flex-col md:flex-row items-center gap-8 bg-slate-50 dark:bg-slate-800/30 p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800">
                <div className="bg-white p-6 rounded-3xl shadow-xl border border-slate-100">
                  <QRCodeCanvas 
                    value={`RIBERJO:${profile?.matricule || 'N/A'}`}
                    size={200}
                    level="H"
                    includeMargin={true}
                    imageSettings={{
                      src: settings.logoUrl || "",
                      x: undefined,
                      y: undefined,
                      height: 40,
                      width: 40,
                      excavate: true,
                    }}
                  />
                </div>
                <div className="flex-1 space-y-4">
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Matricule</p>
                    <p className="font-mono text-lg font-bold text-slate-900 dark:text-white">{profile?.matricule}</p>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Entreprise</p>
                    <p className="font-bold text-brand uppercase">{settings.companyName}</p>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium leading-relaxed italic">
                    Scannez ce code pour vérifier instantanément votre identité lors des pointages ou des contrôles de service.
                  </p>
                  <button 
                    onClick={() => {
                      const canvas = document.querySelector('canvas');
                      if (canvas) {
                        const url = canvas.toDataURL("image/png");
                        const link = document.createElement('a');
                        link.download = `QR_${profile?.matricule}.png`;
                        link.href = url;
                        link.click();
                      }
                    }}
                    className="w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-black uppercase tracking-widest rounded-xl hover:brightness-110 shadow-lg transition-all"
                  >
                    Télécharger mon QR Code
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        ) : activeTab === 'notifications' ? (
          <motion.div 
            key="notifications"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-slate-100 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-3 mb-8">
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl">
                        <Bell size={24} />
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Préférences de Notification</h2>
                </div>
                
                <div className="space-y-6">
                    <div className="flex items-center justify-between p-4 bg-emerald-50/50 dark:bg-emerald-500/5 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 mb-4">
                        <div>
                            <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight">Vérifier le système</h3>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium italic">Testez si les notifications et les sons sont bien activés.</p>
                        </div>
                        <div className="flex gap-2">
                             <button 
                                onClick={() => notificationService.requestPermission()}
                                className="px-4 py-2 bg-white dark:bg-slate-800 text-[10px] font-black uppercase rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm"
                             >
                                Autoriser Navigateur
                             </button>
                             <button 
                                onClick={() => notificationService.notify(profile!.id, "Test Système", "Vos notifications fonctionnent correctement !", 'info')}
                                className="px-4 py-2 bg-brand text-white text-[10px] font-black uppercase rounded-xl shadow-lg shadow-brand/20"
                             >
                                Tester
                             </button>
                        </div>
                    </div>

                    {[
                        { id: 'newTasks', label: 'Nouvelles Tâches', desc: 'Recevoir une notification lorsqu\'une tâche vous est assignée.' },
                        { id: 'reportValidations', label: 'Validations de Rapports', desc: 'Être informé quand vos rapports sont validés ou rejetés.' },
                        { id: 'criticalAlerts', label: 'Alertes Critiques', desc: 'Notifications prioritaires pour les urgences et incidents.' },
                        { id: 'mentions', label: 'Mentions & Messages', desc: 'Recevoir une alerte quand on vous mentionne dans le chat.' },
                        { id: 'departmentUpdates', label: 'Mises à jour du Département', desc: 'Activités et annonces spécifiques à votre département.' }
                    ].map((pref) => (
                        <div key={pref.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-transparent hover:border-emerald-500/20 transition-all">
                            <div>
                                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">{pref.label}</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{pref.desc}</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={(notificationPrefs as any)[pref.id]} 
                                    onChange={(e) => setNotificationPrefs({ ...notificationPrefs, [pref.id]: e.target.checked })}
                                    className="sr-only peer" 
                                />
                                <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                            </label>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex justify-end items-center gap-4">
                <AnimatePresence>
                  {saved && (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                      <CheckCircle2 size={18} />
                      <span>Préférences enregistrées !</span>
                    </motion.div>
                  )}
                </AnimatePresence>
                <button 
                  onClick={handleSaveNotificationPrefs}
                  disabled={isSaving}
                  className="px-10 py-4 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 shadow-xl shadow-emerald-100 dark:shadow-none flex items-center gap-2 transition-all disabled:opacity-50"
                >
                  <Save size={20} />
                  Sauvegarder
                </button>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="system"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            {/* System Configuration */}
            <form onSubmit={handleSaveSettings} className="space-y-8">
               <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-slate-100 dark:border-slate-800 shadow-sm">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl">
                      <Palette size={24} />
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Branding & Identité</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <div className="space-y-6">
                        <div>
                           <label className="block text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Nom de l'entreprise</label>
                           <input type="text" value={settings.companyName} onChange={(e) => setSettings({...settings, companyName: e.target.value})} className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-white" />
                        </div>
                        <div>
                           <label className="block text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">URL du Logo</label>
                           <input type="text" value={settings.logoUrl || ''} onChange={(e) => setSettings({...settings, logoUrl: e.target.value})} className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-white" />
                        </div>
                     </div>
                     <div>
                        <label className="block text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Couleur principale</label>
                        <div className="flex gap-4">
                           <input type="color" value={settings.primaryColor} onChange={(e) => setSettings({...settings, primaryColor: e.target.value})} className="w-14 h-14 bg-white dark:bg-slate-800 p-1 rounded-xl cursor-pointer" />
                           <input type="text" value={settings.primaryColor} onChange={(e) => setSettings({...settings, primaryColor: e.target.value})} className="flex-1 px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-white" />
                        </div>
                     </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-slate-100 dark:border-slate-800 shadow-sm">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="p-3 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-2xl">
                      <UserCheck size={24} />
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Politiques d'Accès</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <div>
                        <label className="block text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Rôle par défaut</label>
                        <select value={settings.defaultRegistrationRole} onChange={(e) => setSettings({...settings, defaultRegistrationRole: e.target.value as any})} className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm text-slate-900 dark:text-white">
                           <option value="USER">Ouvrier</option>
                           <option value="SUPER_USER">Expert</option>
                           <option value="ADMIN">Direction</option>
                        </select>
                     </div>
                     <div className="flex items-center gap-3">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" checked={settings.allowSelfRegistration} onChange={(e) => setSettings({...settings, allowSelfRegistration: e.target.checked})} className="sr-only peer" />
                          <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                        </label>
                        <span className="text-sm font-bold text-slate-600 dark:text-slate-400">Autoriser l'auto-inscription</span>
                     </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button type="submit" className="px-10 py-4 bg-slate-900 dark:bg-emerald-600 text-white font-bold rounded-2xl hover:bg-black dark:hover:bg-emerald-700 transition-all shadow-xl dark:shadow-none">Sauvegarder Global</button>
                </div>
            </form>

            {profile?.role === 'SUPER_ADMIN' && (
              <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-slate-100 dark:border-slate-800 shadow-sm mt-8">
                 <div className="flex items-center gap-3 mb-8">
                    <div className="p-3 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-2xl">
                      <ShieldCheck size={24} />
                    </div>
                    <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Administration Direction Générale</h2>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-transparent hover:border-amber-500/20 transition-all group">
                       <h3 className="font-black text-sm text-slate-900 dark:text-white uppercase tracking-tight mb-2">Clôture Financière</h3>
                       <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-6">Archiver l'exercice en cours et verrouiller les écritures comptables passées.</p>
                       <button className="w-full py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 rounded-2xl shadow-sm hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors">
                          Clôturer l'exercice
                       </button>
                    </div>

                    <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-transparent hover:border-red-500/20 transition-all group">
                       <h3 className="font-black text-sm text-slate-900 dark:text-white uppercase tracking-tight mb-2">Gestion Critique</h3>
                       <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-6">Suspendre des comptes ou réinitialiser des accès de sécurité.</p>
                       <div className="flex gap-3">
                          <button 
                            onClick={() => {
                               const m = prompt("Entrez le matricule à suspendre :");
                               if (m) alert(`Utilisateur ${m} suspendu.`);
                            }}
                            className="flex-1 py-4 bg-red-50 dark:bg-red-500/10 text-[10px] font-black uppercase tracking-widest text-red-600 dark:text-red-400 rounded-2xl shadow-sm hover:bg-red-100 transition-colors"
                          >
                             Suspendre
                          </button>
                          <button 
                            onClick={() => {
                               const m = prompt("Entrez le matricule pour réinitialiser le mot de passe :");
                               if (m) alert(`Mot de passe réinitialisé pour ${m}. Nouveau mot de passe temporaire : Riberjo2026`);
                            }}
                            className="flex-1 py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 rounded-2xl shadow-sm hover:bg-slate-50 transition-colors"
                          >
                             Reset PWD
                          </button>
                       </div>
                    </div>
                 </div>
              </div>
            )}
            
            {profile?.role === 'SUPER_ADMIN' && (
              <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-slate-100 dark:border-slate-800 shadow-sm mt-8">
                 <div className="flex justify-between items-center mb-8">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-brand/10 text-brand rounded-2xl">
                        <ShieldCheck size={24} />
                      </div>
                      <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase">Gestion des Rôles & Permissions</h2>
                    </div>
                    <button 
                      onClick={() => {
                        const newRoleId = `ROLE_${Date.now()}`;
                        const newRole: RolePermission = {
                          role: newRoleId,
                          label: 'Nouveau Rôle',
                          description: 'Description du rôle...',
                          permissions: { 
                            manageUsers: false, manageDept: false, validateReports: false, 
                            manageAssets: false, manageProtocols: false, manageSettings: false,
                            viewReports: false, createTasks: false, accessArchive: false
                          }
                        };
                        setEditingRole(newRole);
                      }}
                      className="px-6 py-3 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 dark:shadow-none"
                    >
                      + Créer un Rôle
                    </button>
                 </div>

                 <p className="text-slate-500 dark:text-slate-400 text-xs font-medium mb-6">
                    Définissez les niveaux d'accès pour chaque catégorie de personnel. Les permissions activées ici régissent les fonctionnalités visibles et accessibles dans toute l'interface.
                 </p>

                 <div className="space-y-4">
                    {roles.map(r => (
                      <div key={r.role} className={`flex flex-col bg-slate-50 dark:bg-slate-800/50 rounded-2xl border transition-all ${editingRole?.role === r.role ? 'border-brand shadow-lg ring-4 ring-brand/5' : 'border-transparent'}`}>
                        <div 
                          className="flex items-center justify-between p-5 cursor-pointer group"
                          onClick={() => setEditingRole(editingRole?.role === r.role ? null : r)}
                        >
                           <div className="flex items-center gap-5">
                             <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black transition-all ${editingRole?.role === r.role ? 'bg-brand text-white scale-110 shadow-lg' : 'bg-white dark:bg-slate-800 text-slate-400 group-hover:text-brand'}`}>
                               <ShieldAlert size={20} />
                             </div>
                             <div>
                               <div className="flex items-center gap-2">
                                <p className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">{r.label}</p>
                                {['SUPER_ADMIN', 'ADMIN', 'USER', 'SUPER_USER'].includes(r.role) && (
                                  <span className="text-[8px] px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-md font-black uppercase tracking-tighter">Système</span>
                                )}
                               </div>
                               <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">{r.description}</p>
                             </div>
                           </div>
                           <div className="flex items-center gap-3">
                             {editingRole?.role !== r.role && !['SUPER_ADMIN', 'ADMIN', 'USER', 'SUPER_USER'].includes(r.role) && (
                               <button 
                                 onClick={(e) => { e.stopPropagation(); handleDeleteRole(r.role); }}
                                 className="p-2 text-slate-300 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                               >
                                 <Trash2 size={16} />
                               </button>
                             )}
                             <SettingsIcon size={16} className={`text-slate-300 dark:text-slate-600 transition-transform ${editingRole?.role === r.role ? 'rotate-180 text-brand' : ''}`} />
                           </div>
                        </div>

                        {editingRole?.role === r.role && (
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }} 
                            animate={{ height: 'auto', opacity: 1 }}
                            className="p-8 border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900"
                          >
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                <div>
                                   <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Libellé du Rôle</label>
                                   <input 
                                     type="text" 
                                     value={editingRole.label}
                                     onChange={(e) => setEditingRole({...editingRole, label: e.target.value})}
                                     className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-brand/20 text-slate-900 dark:text-white"
                                     placeholder="ex: Chef de Chantier"
                                   />
                                </div>
                                <div>
                                   <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Description Courte</label>
                                   <input 
                                     type="text" 
                                     value={editingRole.description}
                                     onChange={(e) => setEditingRole({...editingRole, description: e.target.value})}
                                     className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-brand/20 text-slate-900 dark:text-white"
                                     placeholder="Responsabilités associées..."
                                   />
                                </div>
                             </div>

                             <div className="mb-6">
                               <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-4 border-b border-slate-50 dark:border-slate-800 pb-2">Configuration des Permissions</p>
                               <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-6 gap-x-8">
                                  {Object.keys(editingRole.permissions).sort().map((perm) => (
                                    <div key={perm} className="flex items-center justify-between group">
                                       <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 capitalize">
                                          {perm.replace(/([A-Z])/g, ' $1').toLowerCase().replace('manage ', 'Gérer ').replace('view ', 'Voir ').replace('validate ', 'Valider ').replace('create ', 'Créer ').replace('access ', 'Accéder ')}
                                       </span>
                                       <label className="relative inline-flex items-center cursor-pointer">
                                          <input 
                                            type="checkbox"
                                            checked={(editingRole.permissions as any)[perm]}
                                            onChange={(e) => setEditingRole({
                                               ...editingRole,
                                               permissions: { ...editingRole.permissions, [perm]: e.target.checked }
                                            })}
                                            className="sr-only peer"
                                          />
                                          <div className="w-9 h-5 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                                       </label>
                                    </div>
                                  ))}
                               </div>
                             </div>

                             <div className="flex items-center justify-between pt-8 border-t border-slate-50 dark:border-slate-800">
                                <div className="flex gap-4">
                                  <button 
                                    onClick={() => handleUpdateRole(editingRole)}
                                    disabled={isSaving}
                                    className="px-8 py-3 bg-brand text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-brand/20 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
                                  >
                                    <Save size={14} className="inline mr-2" />
                                    Sauvegarder le Rôle
                                  </button>
                                  <button 
                                    onClick={() => setEditingRole(null)}
                                    className="px-8 py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                                  >
                                    Annuler
                                  </button>
                                </div>
                                
                                {!['SUPER_ADMIN', 'ADMIN', 'USER', 'SUPER_USER'].includes(editingRole.role) && (
                                  <button 
                                    onClick={() => handleDeleteRole(editingRole.role)}
                                    className="px-4 py-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
                                  >
                                    <Trash2 size={14} />
                                    Supprimer Rôle
                                  </button>
                                )}
                             </div>
                          </motion.div>
                        )}
                      </div>
                    ))}
                 </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
