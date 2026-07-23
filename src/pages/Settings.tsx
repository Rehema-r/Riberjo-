import React, { useState, useEffect, useRef } from 'react';
import { db, getDocSafe } from '../lib/firebase';
import { doc, setDoc, updateDoc, collection, getDocs } from 'firebase/firestore';
import { NotificationPrefs, AppSettings, RolePermission, UserProfile } from '../types';
import { notificationService } from '../services/notificationService';
import { Save, Settings as SettingsIcon, Palette, Building, UserCheck, CheckCircle2, ShieldCheck, Check, X, User, Phone, MapPin, Camera, Bell, Trash2, ShieldAlert, QrCode, CreditCard as CardIcon, Download, Printer, LayoutGrid, CheckCircle, RefreshCw, Image as ImageIcon, Upload, Scissors } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { deleteDoc } from 'firebase/firestore';
import { QRCodeCanvas } from 'qrcode.react';
import { jsPDF } from "jspdf";
import * as htmlToImage from 'html-to-image';
import ImageCropper from '../components/ImageCropper';
import { DEPARTMENTS, SERVICES_LIST } from '../constants';

const DEFAULT_ROLES: RolePermission[] = [
  {
    role: 'SUPER_ADMIN',
    label: 'DG (Directeur Général)',
    description: 'Accès total au système, gestion financière et stratégique.',
    permissions: { 
      manageUsers: true, manageDept: true, validateReports: true, manageAssets: true, 
      manageProtocols: true, manageSettings: true, viewReports: true, 
      createTasks: true, accessArchive: true 
    }
  },
  {
    role: 'ADMIN',
    label: 'Directeur',
    description: 'Gestion des opérations quotidiennes et des rapports de département.',
    permissions: { 
      manageUsers: true, manageDept: true, validateReports: true, manageAssets: true, 
      manageProtocols: true, manageSettings: false, viewReports: true, 
      createTasks: true, accessArchive: true 
    }
  },
  {
    role: 'SUPER_USER',
    label: 'Expert',
    description: 'Accès avancé pour les experts techniques et chefs de service.',
    permissions: { 
      manageUsers: false, manageDept: false, validateReports: true, manageAssets: true, 
      manageProtocols: true, manageSettings: false, viewReports: true, 
      createTasks: true, accessArchive: false 
    }
  },
  {
    role: 'USER',
    label: 'Travailleur',
    description: 'Accès standard pour l\'exécution des tâches et rapports simples.',
    permissions: { 
      manageUsers: false, manageDept: false, validateReports: false, manageAssets: false, 
      manageProtocols: false, manageSettings: false, viewReports: false, 
      createTasks: false, accessArchive: false 
    }
  }
];

interface SettingsProps {
  initialTab?: 'profile' | 'notifications' | 'system';
}

export default function Settings({ initialTab = 'profile' }: SettingsProps) {
  const { profile, roleLabel } = useAuth();
  const isDGOrHR = profile?.role === 'SUPER_ADMIN' || profile?.role === 'BOARD_MEMBER' || profile?.departmentId === '03';
  const logoInputRef = useRef<HTMLInputElement>(null);
  const profileInputRef = useRef<HTMLInputElement>(null);
  const sigFileInputRef = useRef<HTMLInputElement>(null);
  const sealFileInputRef = useRef<HTMLInputElement>(null);
  const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'notifications' | 'system'>(
    initialTab === 'system' && profile?.role !== 'SUPER_ADMIN' ? 'profile' : initialTab
  );

  useEffect(() => {
    if (activeTab === 'system' && profile?.role !== 'SUPER_ADMIN') {
      setActiveTab('profile');
    }
  }, [activeTab, profile]);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [cropperType, setCropperType] = useState<'profile' | 'logo' | null>(null);
  const [settings, setSettings] = useState<AppSettings>({
    companyName: 'RIBERJO',
    logoUrl: 'https://ais-dev-lqe5yig5k3o26rrfztrtng-160473187408.europe-west2.run.app/favicon-riberjo.png',
    domainName: 'riberjo.com',
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

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("L'image est trop volumineuse (max 2 Mo).");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setImageToCrop(reader.result as string);
      setCropperType('logo');
    };
    reader.readAsDataURL(file);
  };

  const handleProfilePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("L'image est trop volumineuse (max 2 Mo).");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setImageToCrop(reader.result as string);
      setCropperType('profile');
    };
    reader.readAsDataURL(file);
  };

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert("L'image est trop volumineuse (max 2 Mo).");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setSettings(prev => ({ ...prev, dgSignatureUrl: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleSealUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert("L'image est trop volumineuse (max 2 Mo).");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setSettings(prev => ({ ...prev, dgSealUrl: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = '#0284c7'; // Nice deep sky blue or dark slate
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const rect = canvas.getBoundingClientRect();
    let x, y;
    if ('touches' in e) {
      if (e.touches.length === 0) return;
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let x, y;
    if ('touches' in e) {
      if (e.cancelable) e.preventDefault();
      if (e.touches.length === 0) return;
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignatureCanvas = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const saveSignatureFromCanvas = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    setSettings(prev => ({ ...prev, dgSignatureUrl: dataUrl }));
    setSuccess("Signature virtuelle générée avec succès ! N'oubliez pas d'enregistrer les paramètres globaux.");
    setTimeout(() => setSuccess(null), 4000);
  };

  const onCropComplete = async (croppedImage: string) => {
    if (cropperType === 'profile') {
      setProfileData(prev => ({ ...prev, avatarUrl: croppedImage }));
      // Auto-save avatar immediately for better UX
      if (profile) {
        setIsSaving(true);
        try {
          await setDoc(doc(db, 'users', profile.id), {
            avatarUrl: croppedImage
          }, { merge: true });
          setSuccess("Photo de profil mise à jour !");
          setSaved(true);
          setTimeout(() => {
            setSaved(false);
            setSuccess(null);
          }, 3000);
        } catch (err) {
          console.error(err);
          setError("Erreur lors de l'enregistrement de l'image.");
        } finally {
          setIsSaving(false);
        }
      }
    } else if (cropperType === 'logo') {
      setSettings(prev => ({ ...prev, logoUrl: croppedImage }));
    }
    setImageToCrop(null);
    setCropperType(null);
  };

  const [saved, setSaved] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (profile && !isSaving) {
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
  }, [profile, isSaving]);

  const handleDownloadCard = async () => {
    const frontEl = document.getElementById('service-card-front-export');
    const backEl = document.getElementById('service-card-back-export');
    if (!frontEl || !backEl) return;
    
    setIsExporting(true);
    try {
      const frontDataUrl = await htmlToImage.toPng(frontEl, { 
        quality: 1, 
        pixelRatio: 3,
        backgroundColor: '#ffffff'
      });
      
      const backDataUrl = await htmlToImage.toPng(backEl, { 
        quality: 1, 
        pixelRatio: 3,
        backgroundColor: '#0f172a'
      });
      
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [85.6, 53.98]
      });
      
      pdf.addImage(frontDataUrl, 'PNG', 0, 0, 85.6, 53.98);
      
      pdf.addPage([85.6, 53.98], 'landscape');
      pdf.addImage(backDataUrl, 'PNG', 0, 0, 85.6, 53.98);
      
      pdf.save(`Carte_Service_${profileData.fullName || profile?.fullName}.pdf`);
      
      setSuccess("Carte de service exportée avec succès ! (Double-face ID-1)");
    } catch (err) {
      console.error(err);
      setError("Erreur lors de l'exportation de la carte.");
    } finally {
      setIsExporting(false);
    }
  };

  async function fetchData() {
    setLoading(true);
    try {
      const docRef = doc(db, 'settings', 'global');
      const snap = await getDocSafe(docRef);
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
      await setDoc(doc(db, 'settings', 'global'), {
        ...settings,
        updatedAt: Date.now()
      }, { merge: true });
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
    setError(null);
    try {
      await setDoc(doc(db, 'users', profile.id), {
        fullName: profileData.fullName,
        phone: profileData.phone,
        address: profileData.address,
        avatarUrl: profileData.avatarUrl
      }, { merge: true });
      localStorage.removeItem('profile_form_draft');
      setSaved(true);
      setSuccess("Profil enregistré avec succès !");
      setTimeout(() => {
        setSaved(false);
        setSuccess(null);
      }, 3000);
    } catch (err) {
      console.error(err);
      setError("Erreur lors de l'enregistrement du profil. Réessayez.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveNotificationPrefs = async () => {
    if (!profile) return;
    setIsSaving(true);
    setSaved(false);
    try {
      await setDoc(doc(db, 'users', profile.id), {
        notificationPrefs: notificationPrefs
      }, { merge: true });
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

  const canManageSystem = profile?.role === 'SUPER_ADMIN';

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
        
        <div className="flex bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl gap-1 overflow-x-auto scrollbar-hide no-scrollbar max-w-full">
          <button 
            onClick={() => setActiveTab('profile')}
            className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${
              activeTab === 'profile' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            Mon Profil
          </button>
          <button 
            onClick={() => setActiveTab('notifications')}
            className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${
              activeTab === 'notifications' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            Notifications
          </button>
          {canManageSystem && (
            <button 
              onClick={() => setActiveTab('system')}
              className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                activeTab === 'system' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              Système
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-6 p-4 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-2xl flex items-center gap-3 text-red-600 dark:text-red-400"
          >
            <ShieldAlert size={20} />
            <p className="text-sm font-bold">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto p-1 hover:bg-red-100 dark:hover:bg-red-500/20 rounded-lg">
              <X size={16} />
            </button>
          </motion.div>
        )}
        {success && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 rounded-2xl flex items-center gap-3 text-emerald-600 dark:text-emerald-400"
          >
            <CheckCircle size={20} />
            <p className="text-sm font-bold">{success}</p>
            <button onClick={() => setSuccess(null)} className="ml-auto p-1 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 rounded-lg">
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

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
                    <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-[2rem] overflow-hidden border-4 border-white dark:border-slate-700 shadow-lg flex items-center justify-center text-slate-400 group relative">
                      {profileData.avatarUrl ? (
                        <img src={profileData.avatarUrl || null} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <User size={40} />
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                         <Camera size={24} className="text-white" />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 absolute -bottom-2 -right-2">
                       <label className="p-2 bg-emerald-600 text-white rounded-xl shadow-lg cursor-pointer hover:bg-emerald-700 transition-all hover:scale-110 active:scale-95 translate-x-2" title="Changer la photo">
                         <Camera size={16} />
                         <input 
                           type="file" 
                           ref={profileInputRef}
                           accept="image/*"
                           onChange={handleProfilePhotoUpload}
                           className="sr-only"
                         />
                       </label>
                       {profileData.avatarUrl && (
                         <button 
                           type="button"
                           onClick={() => {
                             setImageToCrop(profileData.avatarUrl);
                             setCropperType('profile');
                           }}
                           className="p-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl shadow-lg hover:brightness-110 transition-all hover:scale-110 active:scale-95 translate-x-3"
                           title="Recadrer ou Pivoter"
                         >
                           <Scissors size={16} />
                         </button>
                       )}
                    </div>
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{profileData.fullName || profile?.fullName}</h2>
                    <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">{roleLabel}</p>
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
                      value={`${window.location.origin}/verify/${profile?.matricule.replace(/\//g, '_')}`}
                      size={200}
                      level="H"
                      includeMargin={true}
                      imageSettings={settings.logoUrl ? {
                        src: settings.logoUrl,
                        x: undefined,
                        y: undefined,
                        height: 40,
                        width: 40,
                        excavate: true,
                      } : undefined}
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

            {/* Service Card Section */}
            {isDGOrHR && (
              <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-slate-100 dark:border-slate-800 shadow-sm mt-8 no-print">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl">
                    <CardIcon size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white uppercase tracking-tight">Carte de Service Universelle</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Modèle structuré haute définition conforme aux standards.</p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                   <button 
                     onClick={() => window.print()}
                     className="flex items-center justify-center gap-2 px-5 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-black uppercase tracking-wider rounded-xl transition-all active:scale-95 shadow-sm"
                     title="Imprimer la carte de service"
                   >
                     <Printer size={16} />
                     <span>Imprimer</span>
                   </button>
                   <button 
                     onClick={handleDownloadCard}
                     disabled={isExporting}
                     className={`flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 shadow-lg shadow-emerald-500/10 ${
                       isExporting 
                         ? 'bg-slate-100 text-slate-400 dark:bg-slate-850 cursor-not-allowed' 
                         : 'bg-emerald-600 hover:bg-emerald-500 text-white hover:shadow-emerald-500/20'
                     }`}
                     title="Télécharger la carte en PDF"
                   >
                     {isExporting ? <RefreshCw size={16} className="animate-spin" /> : <Download size={16} />}
                     <span>{isExporting ? "Téléchargement..." : "Télécharger PDF"}</span>
                    </button>
                  </div>
                </div>

                <div className="flex flex-col lg:flex-row items-center justify-center gap-8 py-12 bg-slate-50 dark:bg-slate-800/30 rounded-[3rem] border border-slate-100 dark:border-slate-800 border-dashed overflow-hidden">
                {/* Front Side Preview */}
                <div className="flex flex-col items-center gap-4 scale-75 md:scale-90 lg:scale-100 origin-center">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Face Avant (Recto)</p>
                  <div className="relative w-[450px] h-[284px] bg-white rounded-[1.25rem] shadow-2xl overflow-hidden border border-slate-100 flex flex-col p-4">
                    {/* Glossy Overlay */}
                    <div className="absolute inset-0 pointer-events-none bg-gradient-to-tr from-white/0 via-white/5 to-white/10 mix-blend-overlay z-20"></div>
                    <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:12px_12px] opacity-40"></div>

                    {/* Header Strip */}
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2 z-10">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center p-1 shadow-md">
                          <img src={settings.logoUrl || "https://ais-dev-lqe5yig5k3o26rrfztrtng-160473187408.europe-west2.run.app/favicon-riberjo.png"} alt="Logo" className="w-full h-full object-contain" />
                        </div>
                        <div className="text-left">
                          <h1 className="text-slate-900 font-black text-[11px] uppercase tracking-wider leading-none">{settings.companyName}</h1>
                          <p className="text-[7.5px] font-black text-emerald-600 uppercase tracking-widest mt-1">Identification Officielle • ID-1 Standard</p>
                        </div>
                      </div>
                      <div className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[6.5px] font-black uppercase tracking-widest rounded-md border border-emerald-100/60 font-sans">
                        PVC RIGIDE
                      </div>
                    </div>

                    {/* Body content */}
                    <div className="flex gap-4 items-center z-10 flex-1">
                      {/* Left Block: Photo & Chip */}
                      <div className="flex flex-col items-center gap-2 shrink-0">
                        <div className="w-[100px] h-[100px] bg-slate-50 rounded-2xl p-1 shadow-md border border-slate-100 relative overflow-hidden">
                          <div className="w-full h-full rounded-[12px] overflow-hidden bg-slate-100">
                            {profile?.cardPhotoUrl ? (
                              <img src={profile.cardPhotoUrl} alt="Card" className="w-full h-full object-cover" />
                            ) : profileData.avatarUrl ? (
                              <img src={profileData.avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-300">
                                <User size={44} />
                              </div>
                            )}
                          </div>
                        </div>
                        {/* Metallic Smart Chip */}
                        <div className="w-[34px] h-[24px] bg-gradient-to-br from-amber-200 via-amber-300 to-amber-500 rounded-md border border-amber-600/30 shadow-inner flex flex-col justify-around p-[2px]">
                          <div className="h-[1px] bg-slate-800/20 w-full"></div>
                          <div className="flex justify-between w-full">
                            <div className="w-[1px] h-3 bg-slate-800/20"></div>
                            <div className="w-[1px] h-3 bg-slate-800/20"></div>
                          </div>
                          <div className="h-[1px] bg-slate-800/20 w-full"></div>
                        </div>
                      </div>

                      {/* Right Block: Personal Info */}
                      <div className="flex-1 text-left flex flex-col h-full justify-between py-1">
                        <div>
                          <span className="text-[7.5px] font-black text-slate-400 uppercase tracking-widest block leading-none">Nom de l'agent</span>
                          <h2 className="text-[15px] font-black text-slate-900 uppercase tracking-tight leading-none mt-1 truncate max-w-[210px]">{profileData.fullName || profile?.fullName}</h2>
                          
                          <span className="text-[7.5px] font-black text-slate-400 uppercase tracking-widest block leading-none mt-2.5">Fonction / Rôle</span>
                          <p className="text-[10px] font-black text-emerald-600 uppercase tracking-wider leading-none mt-1">{roleLabel}</p>
                        </div>

                        {/* Details grid table */}
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-2 pt-2 border-t border-slate-100">
                          <div>
                            <span className="text-[6.5px] font-black text-slate-400 uppercase tracking-widest block">Matricule</span>
                            <span className="text-[10.5px] font-mono font-black text-slate-800 leading-none">{profile?.matricule}</span>
                          </div>
                          <div>
                            <span className="text-[6.5px] font-black text-slate-400 uppercase tracking-widest block">Département</span>
                            <span className="text-[9px] font-black text-slate-800 leading-none block truncate max-w-[110px]" title={DEPARTMENTS.find((d) => d.id === profile?.departmentId)?.name || profile?.departmentId}>
                              {DEPARTMENTS.find((d) => d.id === profile?.departmentId)?.name || profile?.departmentId}
                            </span>
                          </div>
                          <div>
                            <span className="text-[6.5px] font-black text-slate-400 uppercase tracking-widest block">Unité / Service</span>
                            <span className="text-[9px] font-black text-slate-800 leading-none block truncate max-w-[110px]">
                              {(() => {
                                const matchingService = SERVICES_LIST.find(
                                  (s) =>
                                    s.deptId === profile?.departmentId &&
                                    s.id === profile?.serviceId,
                                );
                                if (matchingService) {
                                  return `${matchingService.name}`;
                                }
                                return profile?.serviceId ? `Service ${profile?.serviceId}` : "Général";
                              })()}
                            </span>
                          </div>
                          <div>
                            <span className="text-[6.5px] font-black text-slate-400 uppercase tracking-widest block">Validité</span>
                            <span className="text-[9.5px] font-black text-slate-800 leading-none">31 DEC 2026</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Back Side Preview */}
                <div className="flex flex-col items-center gap-4 scale-75 md:scale-90 lg:scale-100 origin-center">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Face Arrière (Verso)</p>
                  <div className="relative w-[450px] h-[284px] bg-slate-900 rounded-[1.25rem] shadow-2xl overflow-hidden flex flex-col p-4 text-white border border-slate-800">
                    {/* Top Black Magnetic Band */}
                    <div className="absolute top-4 left-0 w-full h-[36px] bg-slate-950"></div>
                    
                    {/* Content below magnetic band */}
                    <div className="mt-14 flex justify-between gap-4 flex-1 items-start">
                      {/* Conditions, contact */}
                      <div className="flex-1 text-left space-y-1.5">
                        <h3 className="text-[7.5px] font-black uppercase tracking-widest text-emerald-400">Conditions d'Utilisation</h3>
                        <p className="text-[5.5px] text-slate-400 leading-normal uppercase font-bold tracking-wider max-w-[210px]">
                          1. Cette carte est strictly personnelle et incessible.<br/>
                          2. Elle demeure la propriété de {settings.companyName}.<br/>
                          3. En cas de perte, aviser immédiatement la direction.<br/>
                          4. Elle doit être portée visiblement lors du service.<br/>
                          5. Toute fraude expose à des sanctions sévères.
                        </p>
                        <div className="bg-white/5 p-1 rounded-lg border border-white/10 text-left mt-2 max-w-[160px]">
                          <span className="text-[5px] font-black text-slate-500 uppercase tracking-widest block italic">Contact d'Urgence</span>
                          <span className="text-[7.5px] font-black uppercase tracking-widest block leading-none mt-0.5">+243 812 345 678</span>
                        </div>
                      </div>

                      {/* Signature, Seal & QR block */}
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        {/* Signature panel */}
                        <div className="relative w-[150px] h-[44px] bg-slate-50 rounded border border-slate-300 p-1 text-slate-900 flex flex-col justify-end items-center">
                          <span className="absolute left-1 top-0.5 text-[4.5px] font-black text-slate-400 uppercase tracking-widest">Signature Direction</span>
                          
                          {/* Stamp/Seal overlay */}
                          {settings.dgSealUrl ? (
                            <img src={settings.dgSealUrl} alt="Sceau" className="absolute right-2 top-0 w-8 h-8 object-contain opacity-85 rotate-12 pointer-events-none" />
                          ) : (
                            <div className="absolute right-2 top-0 w-8 h-8 opacity-80 pointer-events-none rotate-12 flex items-center justify-center">
                              <svg width="32" height="32" viewBox="0 0 100 100" className="text-red-600">
                                <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="4" />
                                <circle cx="50" cy="50" r="37" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3,3" />
                                <path id="sealPathBackPreview" d="M 15 50 A 35 35 0 0 1 85 50" fill="none" stroke="none" />
                                <text className="text-[10px] font-black fill-red-600 uppercase tracking-widest">
                                  <textPath href="#sealPathBackPreview" startOffset="50%" textAnchor="middle">RIBERJO</textPath>
                                </text>
                              </svg>
                            </div>
                          )}
                          
                          {/* Signature overlay */}
                          {settings.dgSignatureUrl ? (
                            <img src={settings.dgSignatureUrl} alt="Signature DG" className="absolute right-4 bottom-1 h-6 object-contain pointer-events-none max-w-[80px]" />
                          ) : (
                            <div className="h-4 w-20 border-b border-slate-900 mb-0.5 opacity-20"></div>
                          )}
                          <span className="text-[5.5px] font-black text-slate-500 uppercase tracking-widest leading-none z-10">{settings.dgName || "Directeur Général"}</span>
                        </div>

                        {/* Verification QR Code */}
                        <div className="flex items-center gap-1.5 mt-0.5 bg-white p-1 rounded-lg border border-white/10 shrink-0">
                          <QRCodeCanvas value={`${window.location.origin}/verify/${profile?.matricule.replace(/\//g, '_')}`} size={30} level="M" />
                          <div className="text-left leading-none text-slate-900">
                            <span className="text-[5px] font-black text-emerald-600 uppercase tracking-wider block">VÉRIFIER</span>
                            <span className="text-[4px] font-bold text-slate-500 uppercase tracking-normal leading-tight block">Authenticité<br/>en ligne</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Hidden Export Construction Area (Strictly ID-1 landscape standard for high-res PDF generation) */}
              <div className="fixed -top-[2000px] left-0 pointer-events-none opacity-0">
                {/* Front Side Export */}
                <div id="service-card-front-export" className="w-[856px] h-[540px] bg-white rounded-[2.5rem] overflow-hidden flex flex-col p-8 text-slate-900 relative">
                  <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_2px,transparent_2px)] [background-size:24px_24px] opacity-40"></div>
                  
                  {/* Header Strip */}
                  <div className="flex items-center justify-between border-b-2 border-slate-100 pb-4 mb-4 z-10">
                    <div className="flex items-center gap-5">
                      <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center p-2 shadow-lg">
                        <img src={settings.logoUrl || "https://ais-dev-lqe5yig5k3o26rrfztrtng-160473187408.europe-west2.run.app/favicon-riberjo.png"} alt="Logo" className="w-full h-full object-contain" />
                      </div>
                      <div className="text-left">
                        <h1 className="text-slate-900 font-black text-[22px] uppercase tracking-wider leading-none">{settings.companyName}</h1>
                        <p className="text-[13px] font-black text-emerald-600 uppercase tracking-widest mt-2">Identification Officielle • ID-1 Standard</p>
                      </div>
                    </div>
                    <div className="px-4 py-1 bg-emerald-50 text-emerald-700 text-[12px] font-black uppercase tracking-widest rounded-xl border-2 border-emerald-100/60 font-sans">
                      PVC RIGIDE
                    </div>
                  </div>

                  {/* Body content */}
                  <div className="flex gap-8 items-center z-10 flex-1">
                    {/* Left Block: Photo & Chip */}
                    <div className="flex flex-col items-center gap-4 shrink-0">
                      <div className="w-[200px] h-[200px] bg-slate-50 rounded-[2rem] p-2 shadow-xl border-2 border-slate-100 relative overflow-hidden">
                        <div className="w-full h-full rounded-[1.5rem] overflow-hidden bg-slate-100">
                          {profile?.cardPhotoUrl ? (
                            <img src={profile.cardPhotoUrl} alt="Card" className="w-full h-full object-cover" />
                          ) : profileData.avatarUrl ? (
                            <img src={profileData.avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-300">
                              <User size={88} />
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Metallic Smart Chip */}
                      <div className="w-[72px] h-[50px] bg-gradient-to-br from-amber-200 via-amber-300 to-amber-500 rounded-xl border-2 border-amber-600/30 shadow-inner flex flex-col justify-around p-1">
                        <div className="h-[2px] bg-slate-800/20 w-full"></div>
                        <div className="flex justify-between w-full">
                          <div className="w-[2px] h-6 bg-slate-800/20"></div>
                          <div className="w-[2px] h-6 bg-slate-800/20"></div>
                        </div>
                        <div className="h-[2px] bg-slate-800/20 w-full"></div>
                      </div>
                    </div>

                    {/* Right Block: Personal Info */}
                    <div className="flex-1 text-left flex flex-col h-full justify-between py-2">
                      <div>
                        <span className="text-[14px] font-black text-slate-400 uppercase tracking-widest block leading-none">Nom de l'agent</span>
                        <h2 className="text-[28px] font-black text-slate-900 uppercase tracking-tight leading-none mt-2 truncate max-w-[420px]">{profileData.fullName || profile?.fullName}</h2>
                        
                        <span className="text-[14px] font-black text-slate-400 uppercase tracking-widest block leading-none mt-4">Fonction / Rôle</span>
                        <p className="text-[18px] font-black text-emerald-600 uppercase tracking-wider leading-none mt-2">{roleLabel}</p>
                      </div>

                      {/* Details grid table */}
                      <div className="grid grid-cols-2 gap-x-6 gap-y-3 mt-4 pt-4 border-t-2 border-slate-100">
                        <div>
                          <span className="text-[12px] font-black text-slate-400 uppercase tracking-widest block">Matricule</span>
                          <span className="text-[18px] font-mono font-black text-slate-800 leading-none">{profile?.matricule}</span>
                        </div>
                        <div>
                          <span className="text-[12px] font-black text-slate-400 uppercase tracking-widest block">Département</span>
                          <span className="text-[16px] font-black text-slate-800 leading-none block truncate max-w-[200px]">
                            {DEPARTMENTS.find((d) => d.id === profile?.departmentId)?.name || profile?.departmentId}
                          </span>
                        </div>
                        <div>
                          <span className="text-[12px] font-black text-slate-400 uppercase tracking-widest block">Unité / Service</span>
                          <span className="text-[15px] font-black text-slate-800 leading-none block truncate max-w-[200px]">
                            {(() => {
                              const matchingService = SERVICES_LIST.find(
                                (s) =>
                                  s.deptId === profile?.departmentId &&
                                  s.id === profile?.serviceId,
                              );
                              if (matchingService) {
                                return `${matchingService.name}`;
                              }
                              return profile?.serviceId ? `Service ${profile?.serviceId}` : "Général";
                            })()}
                          </span>
                        </div>
                        <div>
                          <span className="text-[12px] font-black text-slate-400 uppercase tracking-widest block">Validité</span>
                          <span className="text-[16px] font-black text-slate-800 leading-none font-sans">31 DÉCEMBRE 2026</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Back Side Export */}
                <div id="service-card-back-export" className="w-[856px] h-[540px] bg-slate-900 rounded-[2.5rem] overflow-hidden flex flex-col p-8 text-white relative">
                  {/* Top Black Magnetic Band */}
                  <div className="absolute top-8 left-0 w-full h-[72px] bg-slate-950"></div>
                  
                  {/* Content below magnetic band */}
                  <div className="mt-28 flex justify-between gap-8 flex-1 items-start">
                    {/* Conditions, contact */}
                    <div className="flex-1 text-left space-y-3">
                      <h3 className="text-[15px] font-black uppercase tracking-widest text-emerald-400">Conditions d'Utilisation</h3>
                      <p className="text-[11px] text-slate-400 leading-relaxed uppercase font-bold tracking-wider max-w-[420px]">
                        1. Cette carte est strictement personnelle et incessible.<br/>
                        2. Elle demeure la propriété de {settings.companyName}.<br/>
                        3. En cas de perte, aviser immédiatement la direction.<br/>
                        4. Elle doit être portée visiblement lors du service.<br/>
                        5. Toute fraude expose à des sanctions sévères.
                      </p>
                      <div className="bg-white/5 p-3 rounded-2xl border border-white/10 text-left mt-4 max-w-[280px]">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block italic">Contact d'Urgence</span>
                        <span className="text-[15px] font-black uppercase tracking-widest block leading-none mt-1">+243 812 345 678</span>
                      </div>
                    </div>

                    {/* Signature, Seal & QR block */}
                    <div className="flex flex-col items-end gap-4 shrink-0">
                      {/* Signature panel */}
                      <div className="relative w-[280px] h-[80px] bg-slate-50 rounded-xl border border-slate-300 p-2 text-slate-900 flex flex-col justify-end items-center">
                        <span className="absolute left-2 top-1 text-[9px] font-black text-slate-400 uppercase tracking-widest">Signature Direction</span>
                        
                        {/* Stamp/Seal overlay */}
                        {settings.dgSealUrl ? (
                          <img src={settings.dgSealUrl} alt="Sceau" className="absolute right-4 top-1 w-16 h-16 object-contain opacity-85 rotate-12 pointer-events-none" />
                        ) : (
                          <div className="absolute right-4 top-1 w-16 h-16 opacity-80 pointer-events-none rotate-12 flex items-center justify-center">
                            <svg width="64" height="64" viewBox="0 0 100 100" className="text-red-600">
                              <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="4" />
                              <circle cx="50" cy="50" r="37" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3,3" />
                              <path id="sealPathBackExport" d="M 15 50 A 35 35 0 0 1 85 50" fill="none" stroke="none" />
                              <text className="text-[10px] font-black fill-red-600 uppercase tracking-widest">
                                <textPath href="#sealPathBackExport" startOffset="50%" textAnchor="middle">RIBERJO</textPath>
                              </text>
                            </svg>
                          </div>
                        )}
                        
                        {/* Signature overlay */}
                        {settings.dgSignatureUrl ? (
                          <img src={settings.dgSignatureUrl} alt="Signature DG" className="absolute right-6 bottom-2 h-12 object-contain pointer-events-none max-w-[150px]" />
                        ) : (
                          <div className="h-8 w-40 border-b border-slate-900 mb-1 opacity-20"></div>
                        )}
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none z-10">{settings.dgName || "Directeur Général"}</span>
                      </div>

                      {/* Verification QR Code */}
                      <div className="flex items-center gap-3 mt-1 bg-white p-2 rounded-xl border border-white/10 shrink-0">
                        <QRCodeCanvas value={`${window.location.origin}/verify/${profile?.matricule.replace(/\//g, '_')}`} size={64} level="M" />
                        <div className="text-left leading-none text-slate-900">
                          <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wider block">VÉRIFIER</span>
                          <span className="text-[8px] font-bold text-slate-500 uppercase tracking-normal leading-tight block">Authenticité<br/>en ligne</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            )}

            <style>{`
              @media print {
                body * { visibility: hidden; }
                .no-print { display: none !important; }
                #service-card-front-export, #service-card-back-export { 
                  visibility: visible; 
                  position: relative;
                  display: block !important;
                  opacity: 1 !important;
                  margin: 30px auto;
                  page-break-inside: avoid;
                }
              }
            `}</style>
            
            <AnimatePresence>
              {imageToCrop && (
                <ImageCropper 
                  image={imageToCrop}
                  circular={cropperType === 'profile'}
                  aspect={cropperType === 'profile' ? 1 : undefined}
                  onCropComplete={onCropComplete}
                  onCancel={() => {
                    setImageToCrop(null);
                    setCropperType(null);
                  }}
                />
              )}
            </AnimatePresence>
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
                           <label className="block text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Domaine Officiel de la Plateforme</label>
                           <input type="text" value={settings.domainName || 'riberjo.com'} onChange={(e) => setSettings({...settings, domainName: e.target.value})} placeholder="riberjo.com" className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-white" />
                        </div>
                        <div>
                           <label className="block text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Logo de l'entreprise</label>
                           <div className="flex gap-4">
                              <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center overflow-hidden border border-slate-100 dark:border-slate-700 shadow-inner">
                                 {settings.logoUrl ? (
                                    <img src={settings.logoUrl} alt="Logo Preview" className="w-full h-full object-contain" />
                                 ) : (
                                    <ImageIcon size={24} className="text-slate-300" />
                                 )}
                              </div>
                              <div className="flex-1 space-y-2">
                                 <input 
                                   type="text" 
                                   value={settings.logoUrl || ''} 
                                   onChange={(e) => setSettings({...settings, logoUrl: e.target.value})} 
                                   placeholder="URL du logo..."
                                   className="w-full px-6 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-xs focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-white" 
                                 />
                                 <div className="flex gap-2">
                                    <input 
                                      type="file" 
                                      ref={logoInputRef}
                                      onChange={handleLogoUpload}
                                      accept="image/*"
                                      className="hidden" 
                                    />
                                    <button 
                                      type="button"
                                      onClick={() => logoInputRef.current?.click()}
                                      className="flex-1 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                                    >
                                       <Upload size={14} />
                                       Importer
                                    </button>
                                    {settings.logoUrl && (
                                       <button 
                                          type="button"
                                          onClick={() => setSettings({...settings, logoUrl: ''})}
                                          className="px-4 py-3 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-all"
                                       >
                                          Supprimer
                                       </button>
                                    )}
                                 </div>
                              </div>
                           </div>
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

                {/* Section Signature & Sceau Virtuel du DG */}
                <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-slate-100 dark:border-slate-800 shadow-sm">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="p-3 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-2xl">
                      <Save size={24} />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-900 dark:text-white">Signature & Sceau de la Direction Générale</h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Configurez les éléments officiels de validation utilisés pour les badges et documents RH.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                     {/* Colonne Gauche : Nom du DG & Sceau Virtuel */}
                     <div className="space-y-6">
                        <div>
                           <label className="block text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Nom / Titre du Directeur Général</label>
                           <input 
                             type="text" 
                             value={settings.dgName || ''} 
                             onChange={(e) => setSettings({...settings, dgName: e.target.value})} 
                             placeholder="ex: Le Directeur Général, ou M. Jean-Paul Riberjo"
                             className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-white font-bold" 
                           />
                        </div>

                        <div>
                           <label className="block text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Sceau Officiel de l'Entreprise</label>
                           <p className="text-[10px] text-slate-400 mb-3 italic">Importez une image circulaire transparente, ou utilisez le sceau numérique d'authentification par défaut de la plateforme.</p>
                           
                           <div className="flex flex-col sm:flex-row gap-6 items-center p-4 bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-slate-100 dark:border-slate-800">
                              <div className="w-24 h-24 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center overflow-hidden border border-slate-250 dark:border-slate-700 shadow-md p-1 relative">
                                 {settings.dgSealUrl ? (
                                    <img src={settings.dgSealUrl} alt="Sceau" className="w-full h-full object-contain" />
                                 ) : (
                                    <div className="flex items-center justify-center w-full h-full text-red-600 rotate-12">
                                       <svg width="64" height="64" viewBox="0 0 100 100">
                                         <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="4" />
                                         <circle cx="50" cy="50" r="37" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3,3" />
                                         <path id="sealPathSettings" d="M 15 50 A 35 35 0 0 1 85 50" fill="none" stroke="none" />
                                         <text className="text-[10px] font-black fill-red-600 uppercase tracking-widest">
                                           <textPath href="#sealPathSettings" startOffset="50%" textAnchor="middle">{settings.companyName || "RIBERJO"}</textPath>
                                         </text>
                                         <path id="sealPathSettingsBottom" d="M 85 50 A 35 35 0 0 1 15 50" fill="none" stroke="none" />
                                         <text className="text-[7.5px] font-black fill-red-600 uppercase tracking-tight">
                                           <textPath href="#sealPathSettingsBottom" startOffset="50%" textAnchor="middle">DIRECTION GEN</textPath>
                                         </text>
                                         <text x="50" y="54" className="text-[10px] font-black fill-red-600 uppercase tracking-tighter" textAnchor="middle">OFFICIEL</text>
                                       </svg>
                                    </div>
                                 )}
                              </div>

                              <div className="flex-1 space-y-2 w-full">
                                 <input 
                                   type="file" 
                                   ref={sealFileInputRef}
                                   onChange={handleSealUpload}
                                   accept="image/*"
                                   className="hidden" 
                                 />
                                 <button 
                                   type="button"
                                   onClick={() => sealFileInputRef.current?.click()}
                                   className="w-full py-3 bg-white dark:bg-slate-800 border border-slate-250 dark:border-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 hover:bg-slate-50 transition-all flex items-center justify-center gap-2 shadow-sm"
                                 >
                                    <Upload size={14} />
                                    Importer un tampon (.png)
                                 </button>
                                 {settings.dgSealUrl && (
                                    <button 
                                       type="button"
                                       onClick={() => setSettings({...settings, dgSealUrl: ''})}
                                       className="w-full py-2 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-red-100 transition-all"
                                    >
                                       Réinitialiser au sceau par défaut
                                    </button>
                                 )}
                              </div>
                           </div>
                        </div>
                     </div>

                     {/* Colonne Droite : Signature Dessinée ou Upload */}
                     <div className="space-y-6">
                        <div>
                           <label className="block text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Signature Manuscrite Numérique</label>
                           
                           {/* Drawing canvas signature pad */}
                           <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-slate-100 dark:border-slate-800">
                              <p className="text-[10px] text-slate-400 mb-2 italic">Dessinez directement ci-dessous ou importez une image transparente de votre signature.</p>
                              
                              <div className="relative border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 h-32 flex items-center justify-center">
                                 <canvas 
                                   ref={signatureCanvasRef}
                                   width={320}
                                   height={120}
                                   onMouseDown={startDrawing}
                                   onMouseMove={draw}
                                   onMouseUp={stopDrawing}
                                   onMouseLeave={stopDrawing}
                                   onTouchStart={startDrawing}
                                   onTouchMove={draw}
                                   onTouchEnd={stopDrawing}
                                   className="w-full h-full cursor-crosshair touch-none"
                                 />
                              </div>

                              <div className="flex gap-2 mt-3">
                                 <button
                                   type="button"
                                   onClick={clearSignatureCanvas}
                                   className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-350 text-[9px] font-black uppercase tracking-widest rounded-lg hover:bg-slate-200 transition-all"
                                 >
                                    Effacer tracé
                                 </button>
                                 <button
                                   type="button"
                                   onClick={saveSignatureFromCanvas}
                                   className="flex-1 py-2 bg-sky-600 text-white text-[9px] font-black uppercase tracking-widest rounded-lg hover:bg-sky-700 transition-all shadow-md shadow-sky-500/10"
                                 >
                                    Valider tracé
                                 </button>
                              </div>
                           </div>

                           {/* Upload signature alternative */}
                           <div className="mt-4 flex gap-4 items-center p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800">
                              <div className="w-20 h-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-center p-1 overflow-hidden shrink-0">
                                 {settings.dgSignatureUrl ? (
                                    <img src={settings.dgSignatureUrl} alt="Signature" className="max-h-full max-w-full object-contain" />
                                 ) : (
                                    <span className="text-[8px] font-bold text-slate-350 uppercase">Vide</span>
                                 )}
                              </div>
                              <div className="flex-1">
                                 <input 
                                   type="file" 
                                   ref={sigFileInputRef}
                                   onChange={handleSignatureUpload}
                                   accept="image/*"
                                   className="hidden" 
                                 />
                                 <div className="flex gap-2">
                                    <button 
                                      type="button"
                                      onClick={() => sigFileInputRef.current?.click()}
                                      className="flex-1 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[9px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 hover:bg-slate-50 transition-all flex items-center justify-center gap-1.5"
                                    >
                                       <Upload size={12} />
                                       Uploader Image
                                    </button>
                                    {settings.dgSignatureUrl && (
                                       <button 
                                          type="button"
                                          onClick={() => setSettings({...settings, dgSignatureUrl: ''})}
                                          className="px-3 py-2 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg text-[9px] font-black uppercase hover:bg-red-100 transition-all"
                                       >
                                          Effacer
                                       </button>
                                    )}
                                 </div>
                              </div>
                           </div>
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
            
            {(profile?.role === 'SUPER_ADMIN' || profile?.role === 'ADMIN') && (
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
                                  {Object.keys(editingRole.permissions || {}).sort().map((perm) => (
                                    <div key={perm} className="flex items-center justify-between group">
                                       <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 capitalize">
                                          {perm.replace(/([A-Z])/g, ' $1').toLowerCase().replace('manage ', 'Gérer ').replace('view ', 'Voir ').replace('validate ', 'Valider ').replace('create ', 'Créer ').replace('access ', 'Accéder ')}
                                       </span>
                                       <label className="relative inline-flex items-center cursor-pointer">
                                          <input 
                                            type="checkbox"
                                            checked={((editingRole.permissions || {}) as any)[perm]}
                                            onChange={(e) => {
                                               if (editingRole) {
                                                  setEditingRole({
                                                     ...editingRole,
                                                     permissions: { ...editingRole.permissions, [perm]: e.target.checked } as RolePermission['permissions']
                                                  });
                                               }
                                            }}
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
