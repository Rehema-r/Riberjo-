import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Search, 
  Filter, 
  Trash2, 
  CheckCheck, 
  Clock, 
  Calendar,
  AlertCircle,
  FileText,
  CheckSquare,
  Info,
  ChevronRight,
  MoreHorizontal,
  ShieldAlert,
  Send,
  Users,
  User,
  AlertTriangle,
  Check,
  Volume2,
  Radio,
  Sparkles,
  Inbox
} from 'lucide-react';
import { collection, query, where, orderBy, onSnapshot, updateDoc, setDoc, addDoc, doc, deleteDoc, writeBatch, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { AppNotification, UserProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';

const DEPARTMENTS_LIST = [
  { id: "01", name: "Production Agricole & Elevage", code: "FERME", color: "from-emerald-500 to-teal-600 bg-emerald-500/10 text-emerald-600" },
  { id: "02", name: "Santé & Médecine", code: "SANTE", color: "from-rose-500 to-pink-600 bg-rose-500/10 text-rose-600" },
  { id: "03", name: "Ressources Humaines", code: "RH", color: "from-violet-500 to-purple-600 bg-violet-500/10 text-violet-600" },
  { id: "04", name: "Finance & Comptabilité", code: "FINANCE", color: "from-amber-500 to-orange-600 bg-amber-500/10 text-amber-600" },
  { id: "05", name: "Logistique & Approvisionnement", code: "LOG", color: "from-blue-500 to-cyan-600 bg-blue-500/10 text-blue-600" },
  { id: "06", name: "Marketing & Ventes", code: "MKT", color: "from-fuchsia-500 to-pink-600 bg-fuchsia-500/10 text-fuchsia-600" },
  { id: "DG", name: "Direction Générale", code: "DG", color: "from-slate-700 to-slate-900 bg-slate-500/10 text-slate-600" }
];

const ROLES_LIST = [
  { id: 'SUPER_ADMIN', label: 'Directeur Général (DG)', desc: 'Accès et contrôle stratégique' },
  { id: 'ADMIN', label: 'Directeur (Admin)', desc: 'Supervision et décisions de département' },
  { id: 'SUPER_USER', label: 'Chef de Service (Expert)', desc: 'Opérationnel et gestion d\'équipe' },
  { id: 'USER', label: 'Agent / Employé', desc: 'Exécution quotidienne sur le terrain' }
];

export default function Notifications() {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'tasks' | 'reports' | 'alerts' | 'send-alert'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Authorized user check
  const isDG = profile?.role === 'SUPER_ADMIN';
  const isHRDirector = profile?.role === 'ADMIN' && profile?.departmentId === '03';
  const canSendAlerts = isDG || isHRDirector;

  // --- States for sending alerts ---
  const [alertTargetType, setAlertTargetType] = useState<'all' | 'department' | 'role' | 'individual'>('all');
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [alertSeverity, setAlertSeverity] = useState<'critical' | 'warning' | 'info'>('critical');
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [diffuseInChat, setDiffuseInChat] = useState(true);
  const [triggerSound, setTriggerSound] = useState(true);
  const [sendingAlert, setSendingAlert] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [userSearchTerm, setUserSearchTerm] = useState('');

  // Fetch users list
  useEffect(() => {
    if (!profile) return;
    const isDG = profile.role === 'SUPER_ADMIN';
    const isHR = profile.role === 'ADMIN' && profile.departmentId === '03';
    if (isDG || isHR) {
      const fetchUsers = async () => {
        try {
          const snap = await getDocs(collection(db, 'users'));
          setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as UserProfile)));
        } catch (err) {
          console.error("Failed to load users for alert console:", err);
        }
      };
      fetchUsers();
    }
  }, [profile]);

  // Helper to find or create group chats for departments
  const getOrCreateGroupChat = async (deptId: string, deptName: string): Promise<string> => {
    const chatsRef = collection(db, 'chats');
    const q = query(chatsRef, where('type', '==', 'group'), where('departmentId', '==', deptId));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs[0].id;
    } else {
      const newChatId = `group_${deptId}`;
      await setDoc(doc(db, 'chats', newChatId), {
        id: newChatId,
        name: deptName,
        type: 'group',
        departmentId: deptId,
        participants: [],
        updatedAt: Date.now(),
        lastMessage: "Canal de diffusion d'entreprise."
      });
      return newChatId;
    }
  };

  // Helper to find or create direct DM chats between sender and recipient
  const getOrCreateDirectChat = async (senderId: string, senderName: string, recipientId: string, recipientName: string): Promise<string> => {
    const chatsRef = collection(db, 'chats');
    const q = query(chatsRef, where('type', '==', 'direct'), where('participants', 'array-contains', senderId));
    const snap = await getDocs(q);
    const existingChat = snap.docs.find(doc => {
      const data = doc.data();
      return data.participants && data.participants.includes(recipientId);
    });
    
    if (existingChat) {
      return existingChat.id;
    } else {
      const newChatId = `direct_${senderId}_${recipientId}`;
      await setDoc(doc(db, 'chats', newChatId), {
        id: newChatId,
        name: recipientName,
        recipientName: senderName,
        type: 'direct',
        participants: [senderId, recipientId],
        updatedAt: Date.now(),
        lastMessage: ""
      });
      return newChatId;
    }
  };

  // Helper to append a system message to a given chat
  const sendChatMessage = async (chatId: string, text: string) => {
    if (!profile) return;
    await addDoc(collection(db, 'chats', chatId, 'messages'), {
      senderId: profile.id,
      senderName: profile.fullName,
      text: text,
      type: 'text',
      createdAt: Date.now()
    });
    
    await updateDoc(doc(db, 'chats', chatId), {
      lastMessage: `⚠️ Alerte: ${alertTitle}`,
      updatedAt: Date.now()
    });
  };

  useEffect(() => {
    if (!profile) return;

    let q = query(
      collection(db, 'notifications'),
      where('userId', '==', profile.id),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        setNotifications(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AppNotification)));
        setLoading(false);

        // Sound trigger for newly added critical alerts in real-time
        try {
          snapshot.docChanges().forEach(change => {
            if (change.type === 'added') {
              const data = change.doc.data();
              if (data.isCriticalAlert && !data.read && data.triggerSound) {
                const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/911/911-preview.mp3'); // Authorities alert tone
                audio.volume = 0.8;
                audio.play().catch(e => console.log('Audio play failed:', e));
              }
            }
          });
        } catch (soundErr) {
          console.warn("Audio chime block skipped due to gesture limits:", soundErr);
        }
      },
      (error) => {
        console.warn("Notifications onSnapshot operates in local cache mode:", error.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [profile]);

  const handleSendAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !alertTitle.trim() || !alertMessage.trim()) return;

    setSendingAlert(true);
    setSendSuccess(false);

    try {
      // 1. Determine target users
      let targetUsers: UserProfile[] = [];

      if (alertTargetType === 'all') {
        targetUsers = users.filter(u => u.id !== profile.id);
      } else if (alertTargetType === 'department') {
        targetUsers = users.filter(u => selectedDepts.includes(u.departmentId || '') && u.id !== profile.id);
      } else if (alertTargetType === 'role') {
        targetUsers = users.filter(u => selectedRoles.includes(u.role) && u.id !== profile.id);
      } else if (alertTargetType === 'individual') {
        targetUsers = users.filter(u => selectedUsers.includes(u.id));
      }

      if (targetUsers.length === 0) {
        alert("Aucun employé ne correspond aux critères de ciblage sélectionnés.");
        setSendingAlert(false);
        return;
      }

      const formattedChatMessage = `🚨 [ALERTE CRITIQUE DE LA DIRECTION] 🚨
-----------------------------------------
SUJET : ${alertTitle.toUpperCase()}
ÉMETTEUR : ${profile.fullName} (${profile.role === 'SUPER_ADMIN' ? 'Direction Générale' : 'Direction RH'})
NIVEAU : ${alertSeverity === 'critical' ? '🔴 CRITIQUE - EXTRÊME' : alertSeverity === 'warning' ? '🟠 IMPORTANT - ALERTE' : '🔵 INFO - ANNONCE'}
DATE : ${new Date().toLocaleString('fr-FR')}

MESSAGE :
${alertMessage}

-----------------------------------------
Veuillez accuser réception de cette notification urgente dans votre Centre de Communications.`;

      const batch = writeBatch(db);

      targetUsers.forEach(recipient => {
        const notifRef = doc(collection(db, 'notifications'));
        batch.set(notifRef, {
          userId: recipient.id,
          title: `⚠️ ${alertTitle}`,
          message: alertMessage,
          read: false,
          type: 'critical',
          alertSeverity: alertSeverity,
          senderId: profile.id,
          senderName: profile.fullName,
          senderRole: profile.role,
          createdAt: Date.now(),
          isCriticalAlert: true,
          triggerSound: triggerSound
        });
      });

      await batch.commit();

      if (diffuseInChat) {
        if (alertTargetType === 'all') {
          for (const dept of DEPARTMENTS_LIST) {
            try {
              const chatId = await getOrCreateGroupChat(dept.id, dept.name);
              await sendChatMessage(chatId, formattedChatMessage);
            } catch (err) {
              console.error(`Failed sending alerts to dept ${dept.id}:`, err);
            }
          }
        } else if (alertTargetType === 'department') {
          for (const deptId of selectedDepts) {
            const deptObj = DEPARTMENTS_LIST.find(d => d.id === deptId);
            if (deptObj) {
              try {
                const chatId = await getOrCreateGroupChat(deptId, deptObj.name);
                await sendChatMessage(chatId, formattedChatMessage);
              } catch (err) {
                console.error(`Failed sending alerts to dept ${deptId}:`, err);
              }
            }
          }
        } else {
          for (const targetUser of targetUsers) {
            try {
              const chatId = await getOrCreateDirectChat(profile.id, profile.fullName, targetUser.id, targetUser.fullName);
              await sendChatMessage(chatId, formattedChatMessage);
            } catch (err) {
              console.error(`Failed sending DM alert to user ${targetUser.id}:`, err);
            }
          }
        }
      }

      setSendSuccess(true);
      setAlertTitle('');
      setAlertMessage('');
      setSelectedUsers([]);
      setSelectedDepts([]);
      setSelectedRoles([]);
      
      // Auto-switch to list alerts filter
      setTimeout(() => {
        setFilter('alerts');
        setSendSuccess(false);
      }, 2000);

    } catch (err) {
      console.error("An error occurred during alert dispatching:", err);
      alert("Une erreur est survenue lors de l'envoi de l'alerte.");
    } finally {
      setSendingAlert(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (err) {
      console.error(err);
    }
  };

  const markAllAsRead = async () => {
    if (!profile) return;
    const batch = writeBatch(db);
    notifications.filter(n => !n.read).forEach(n => {
      batch.update(doc(db, 'notifications', n.id), { read: true });
    });
    await batch.commit();
  };

  const deleteNotification = async (id: string | undefined) => {
    if (!id) return;
    try {
      await deleteDoc(doc(db, 'notifications', id));
    } catch (err) {
      console.error(err);
    }
  };

  const clearAllRead = async () => {
    if (!confirm('Supprimer toutes les notifications lues ?')) return;
    const batch = writeBatch(db);
    notifications.filter(n => n.read).forEach(n => {
      batch.delete(doc(db, 'notifications', n.id));
    });
    await batch.commit();
  };

  const filteredNotifications = notifications.filter(n => {
    const matchesSearch = (n.title || '').toLowerCase().includes((searchTerm || '').toLowerCase()) || 
                         (n.message || '').toLowerCase().includes((searchTerm || '').toLowerCase());
    
    if (filter === 'unread') return matchesSearch && !n.read;
    if (filter === 'tasks') return matchesSearch && (n.type === 'task' || n.title.includes('Tâche'));
    if (filter === 'reports') return matchesSearch && (n.type === 'report' || n.title.includes('Rapport'));
    if (filter === 'alerts') return matchesSearch && (n.type === 'critical' || (n as any).isCriticalAlert);
    return matchesSearch;
  });

  const getIcon = (type: string, title: string) => {
    if (type === 'task' || title.includes('Tâche')) return <CheckSquare className="text-blue-500" size={18} />;
    if (type === 'report' || title.includes('Rapport')) return <FileText className="text-amber-500" size={18} />;
    if (type === 'critical') return <ShieldAlert className="text-red-500" size={18} />;
    return <Info className="text-emerald-500" size={18} />;
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Centre de Communications</h1>
          <p className="text-slate-500 font-medium">Historique complet de vos notifications et alertes système.</p>
        </div>
        <div className="flex gap-2">
           <button 
             id="mark-all-read-btn"
             onClick={markAllAsRead}
             className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm"
           >
             <CheckCheck size={16} /> Tout marquer lu
           </button>
           <button 
             id="clear-read-btn"
             onClick={clearAllRead}
             className="flex items-center gap-2 px-6 py-3 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-500/20 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-red-100 transition-all shadow-sm"
           >
             <Trash2 size={16} /> Nettoyer l'historique
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar Filters */}
        <div className="space-y-6">
           <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm space-y-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 px-2">Filtres rapide</p>
              {[
                { id: 'all', label: 'Toutes', count: notifications.length },
                { id: 'unread', label: 'Non lues', count: notifications.filter(n => !n.read).length },
                { id: 'tasks', label: 'Tâches', count: notifications.filter(n => n.type === 'task' || n.title.includes('Tâche')).length },
                { id: 'reports', label: 'Rapports', count: notifications.filter(n => n.type === 'report' || n.title.includes('Rapport')).length },
                { id: 'alerts', label: '⚠️ Alertes Critiques', count: notifications.filter(n => n.type === 'critical' || (n as any).isCriticalAlert).length },
                ...(canSendAlerts ? [{ id: 'send-alert', label: '📢 Alerter le Personnel', count: 0 }] : [])
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => setFilter(item.id as any)}
                  className={`w-full flex justify-between items-center p-4 rounded-2xl transition-all ${
                    filter === item.id 
                      ? item.id === 'send-alert'
                        ? 'bg-red-600 text-white shadow-xl shadow-red-100 dark:shadow-none'
                        : 'bg-slate-900 dark:bg-emerald-600 text-white shadow-xl' 
                      : item.id === 'send-alert'
                        ? 'bg-red-500/10 dark:bg-red-950/20 text-red-600 dark:text-red-400 hover:bg-red-100/70 border border-red-500/20'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="text-xs font-bold uppercase tracking-tight">{item.label}</span>
                  {item.count > 0 && (
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${filter === item.id ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-800'}`}>
                      {item.count}
                    </span>
                  )}
                </button>
              ))}
           </div>

           <div className="bg-brand rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl">
              <div className="relative z-10">
                <Clock className="mb-4 opacity-50" size={24} />
                <h3 className="text-lg font-black uppercase tracking-tight leading-tight">Configuration des Alertes</h3>
                <p className="text-[10px] text-white/60 font-medium mt-2 leading-relaxed">
                  Vous recevez actuellement des notifications pour les tâches, les rapports et les alertes d'inventaire critique.
                </p>
              </div>
              <div className="absolute -bottom-4 -right-4 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
           </div>
        </div>

        {/* List Content */}
        <div className="lg:col-span-3 space-y-6">
          {filter === 'send-alert' ? (
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2.5rem] p-8 lg:p-10 shadow-sm space-y-8"
            >
              {/* Header */}
              <div className="flex items-center gap-4 border-b border-slate-105 border-slate-100 dark:border-slate-800 pb-6">
                <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-600 flex items-center justify-center">
                  <ShieldAlert size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Console d'Alerte RH & DG</h2>
                  <p className="text-xs text-slate-500 font-medium">Outil de diffusion en temps réel de consignes, alertes de sécurité ou communications d'urgence.</p>
                </div>
              </div>

              {sendSuccess ? (
                <motion.div 
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="p-10 bg-emerald-500/10 rounded-3xl text-center border border-emerald-500/20 py-16 space-y-4"
                >
                  <div className="w-16 h-16 bg-emerald-600 rounded-full flex items-center justify-center text-white mx-auto shadow-lg shadow-emerald-100 dark:shadow-none animate-bounce">
                    <Check size={32} strokeWidth={3} />
                  </div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight font-sans">Alerte diffusée avec succès !</h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Le message a été enregistré dans le système, diffusé en tant que notification prioritaire en temps réel avec alerte sonore, et publié dans la messagerie interne des collaborateurs cibles.
                  </p>
                </motion.div>
              ) : (
                <form onSubmit={handleSendAlert} className="space-y-8">
                  {/* Target Select */}
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-sans">Audience ciblée (Destinataires)</label>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      {[
                        { id: 'all', label: 'Tout RIBERJO', desc: 'Tout le personnel', icon: Radio },
                        { id: 'department', label: 'Par Département', desc: 'Canaux de services', icon: Users },
                        { id: 'role', label: 'Par Rôle/Grade', desc: 'Niveaux d\'accès', icon: ShieldAlert },
                        { id: 'individual', label: 'Agents spécifiques', desc: 'Sélection individuelle', icon: User }
                      ].map(target => {
                        const Icon = target.icon;
                        const active = alertTargetType === target.id;
                        return (
                          <button
                            type="button"
                            key={target.id}
                            onClick={() => setAlertTargetType(target.id as any)}
                            className={`p-5 rounded-2xl border text-left transition-all ${
                              active 
                                ? 'bg-red-500/5 border-red-550 border-red-500/30 text-red-655 text-red-600 dark:text-red-400 ring-2 ring-red-500/10' 
                                : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-900 dark:text-slate-100 hover:border-slate-200'
                            }`}
                          >
                            <Icon size={20} className={`${active ? 'text-red-500' : 'text-slate-400'} mb-3`} />
                            <p className="text-xs font-black uppercase tracking-tight">{target.label}</p>
                            <p className="text-[9px] text-slate-400 mt-1 font-medium leading-relaxed">{target.desc}</p>
                          </button>
                        );
                      })}
                    </div>

                    {/* Target Inputs Details */}
                    <AnimatePresence mode="wait">
                      {alertTargetType === 'department' && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="p-5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800/50 space-y-3"
                        >
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cocher les départements correspondants</p>
                          <div className="flex flex-wrap gap-2">
                            {DEPARTMENTS_LIST.map(dept => {
                              const selected = selectedDepts.includes(dept.id);
                              return (
                                <button
                                  type="button"
                                  key={dept.id}
                                  onClick={() => {
                                    if (selected) {
                                      setSelectedDepts(selectedDepts.filter(id => id !== dept.id));
                                    } else {
                                      setSelectedDepts([...selectedDepts, dept.id]);
                                    }
                                  }}
                                  className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                                    selected 
                                      ? 'bg-red-600 text-white border-transparent shadow-md' 
                                      : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                                  }`}
                                >
                                  {dept.name} (@{dept.code})
                                </button>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}

                      {alertTargetType === 'role' && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="p-5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800/50 space-y-3"
                        >
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sélectionner les grades d'utilisateurs cibles</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {ROLES_LIST.map(role => {
                              const selected = selectedRoles.includes(role.id);
                              return (
                                <button
                                  type="button"
                                  key={role.id}
                                  onClick={() => {
                                    if (selected) {
                                      setSelectedRoles(selectedRoles.filter(id => id !== role.id));
                                    } else {
                                      setSelectedRoles([...selectedRoles, role.id]);
                                    }
                                  }}
                                  className={`p-4 rounded-xl text-left transition-all border flex items-center justify-between ${
                                    selected 
                                      ? 'bg-red-500/5 border-red-500/30 text-red-600 dark:text-red-400' 
                                      : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                                  }`}
                                >
                                  <div>
                                    <p className="text-xs font-black uppercase tracking-tight">{role.label}</p>
                                    <p className="text-[9px] text-slate-400 mt-0.5">{role.desc}</p>
                                  </div>
                                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${selected ? 'bg-red-500 border-transparent text-white' : 'border-slate-200'}`}>
                                    {selected && <Check size={12} />}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}

                      {alertTargetType === 'individual' && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="p-5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800/50 space-y-4"
                        >
                          <div className="flex justify-between items-center">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rechercher et cocher des employés</p>
                            <span className="text-[9px] font-extrabold text-red-500 bg-red-100 dark:bg-red-500/10 px-2 py-0.5 rounded-full">{selectedUsers.length} sélectionnés</span>
                          </div>
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <input 
                              type="text" 
                              placeholder="Rechercher par matricule ou nom..."
                              value={userSearchTerm}
                              onChange={e => setUserSearchTerm(e.target.value)}
                              className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-red-500/20"
                            />
                          </div>
                          <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 space-y-1 pr-1">
                            {users.filter(u => u.id !== profile?.id && (u.fullName.toLowerCase().includes(userSearchTerm.toLowerCase()) || u.matricule.toLowerCase().includes(userSearchTerm.toLowerCase()))).map(usr => {
                              const selected = selectedUsers.includes(usr.id);
                              return (
                                <button
                                  type="button"
                                  key={usr.id}
                                  onClick={() => {
                                    if (selected) {
                                      setSelectedUsers(selectedUsers.filter(id => id !== usr.id));
                                    } else {
                                      setSelectedUsers([...selectedUsers, usr.id]);
                                    }
                                  }}
                                  className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                                    selected ? 'bg-red-50 dark:bg-red-950/10' : 'hover:bg-white dark:hover:bg-slate-800/40'
                                  }`}
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-500 text-[10px]">
                                      {usr.fullName.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div className="text-left">
                                      <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{usr.fullName}</p>
                                      <p className="text-[9px] text-slate-400">Matricule: {usr.matricule} • @{usr.departmentId}</p>
                                    </div>
                                  </div>
                                  <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${selected ? 'bg-red-500 border-transparent text-white' : 'border-slate-200'}`}>
                                    {selected && <Check size={10} />}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Severity Style Choose */}
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-sans">Niveau de Priorité (Badge esthétique)</label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {[
                        { id: 'critical', label: 'Rouge • Alerte Critique', desc: 'Urgence maximale, impact sécuritaire ou opérationnel immédiat.', badge: 'URGENTISSIME', colors: 'border-red-500/30 bg-red-500/5 text-red-600 dark:text-red-450 ring-red-500' },
                        { id: 'warning', label: 'Orange • Important', desc: 'Annonces administratives obligatoires, consignes ou délais cruciaux.', badge: 'IMPORTANT', colors: 'border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-450 ring-amber-500' },
                        { id: 'info', label: 'Bleu • Bulletin standard', desc: 'Communications générales de l\'administration ou notes RH d\'information.', badge: 'GENERAL', colors: 'border-blue-500/30 bg-blue-500/5 text-blue-600 dark:text-blue-450 ring-blue-500' }
                      ].map(sev => {
                        const active = alertSeverity === sev.id;
                        return (
                          <button
                            type="button"
                            key={sev.id}
                            onClick={() => setAlertSeverity(sev.id as any)}
                            className={`p-5 rounded-2xl border text-left transition-all ${
                              active 
                                ? `${sev.colors} ring-2 ring-opacity-20` 
                                : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-700 hover:border-slate-200'
                            }`}
                          >
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[8px] font-black mb-3 ${
                              sev.id === 'critical' ? 'bg-red-650 bg-red-650 text-white bg-red-600' : sev.id === 'warning' ? 'bg-amber-500 text-slate-950' : 'bg-blue-600 text-white'
                            }`}>
                              {sev.badge}
                            </span>
                            <p className="text-xs font-black uppercase tracking-tight">{sev.label}</p>
                            <p className="text-[9px] text-slate-400 mt-1 font-medium leading-relaxed">{sev.desc}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Content Inputs */}
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 font-sans">Sujet de l'Alerte</label>
                      <input 
                        required
                        type="text" 
                        value={alertTitle}
                        onChange={e => setAlertTitle(e.target.value)}
                        placeholder="Ex: SECURITE INTERNE - FERMETURE EXCEPTIONNELLE DES ACCES CLIENT"
                        className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-850 rounded-2xl text-xs font-bold focus:outline-none focus:ring-4 focus:ring-red-500/5 focus:border-red-500 transition-all dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1 font-sans">Corps du Message (Consignes précises)</label>
                      <textarea
                        required
                        rows={6}
                        value={alertMessage}
                        onChange={e => setAlertMessage(e.target.value)}
                        placeholder="Ex: Suite aux directives sanitaires régionales, la clinique invite tous les agents à respecter strictement les mesures barrières répertoriées aux tableaux de services. Tout écart entraînera des sanctions..."
                        className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-850 rounded-2xl text-xs font-bold leading-relaxed focus:outline-none focus:ring-4 focus:ring-red-500/5 focus:border-red-500 transition-all dark:text-white"
                      />
                    </div>
                  </div>

                  {/* Channels selection checkboxes */}
                  <div className="space-y-4 bg-slate-50/50 dark:bg-slate-800/40 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-805 border-slate-100 dark:border-slate-800/80">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pb-2 border-b border-slate-200/40">Options de transport et diffusion</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                      <label className="flex items-start gap-3 cursor-pointer group">
                        <input 
                          type="checkbox" 
                          checked={diffuseInChat}
                          onChange={e => setDiffuseInChat(e.target.checked)}
                          className="mt-1 rounded text-red-650 text-red-600 focus:ring-red-500/10 border-slate-200"
                        />
                        <div>
                          <p className="text-xs font-black text-slate-800 dark:text-slate-100 group-hover:text-red-500 transition-all uppercase tracking-tight">Post dans la messagerie interne (Chat Groupes/DMs)</p>
                          <p className="text-[9px] text-slate-400 font-medium leading-relaxed mt-0.5">Pousser l'alerte sous forme de message d'autorité dans les canaux groupés de vos destinataires.</p>
                        </div>
                      </label>

                      <label className="flex items-start gap-3 cursor-pointer group">
                        <input 
                          type="checkbox" 
                          checked={triggerSound}
                          onChange={e => setTriggerSound(e.target.checked)}
                          className="mt-1 rounded text-red-655 text-red-605 text-red-600 focus:ring-red-500/10 border-slate-200"
                        />
                        <div>
                          <p className="text-xs font-black text-slate-800 dark:text-slate-100 group-hover:text-red-500 transition-all uppercase tracking-tight">Déclencher signal d'Alerte Sonore urgence</p>
                          <p className="text-[9px] text-slate-400 font-medium leading-relaxed mt-0.5">Joue un carillon sonore d'autorité dans les navigateurs actifs des collaborateurs concernés dès réception.</p>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Send Action */}
                  <div className="flex gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setFilter('alerts')}
                      className="px-6 py-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 font-black text-[10px] uppercase tracking-widest transition-all"
                    >
                      Annuler
                    </button>
                    <button
                      disabled={sendingAlert}
                      type="submit"
                      className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-red-600 hover:bg-red-700 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-xl shadow-red-200 dark:shadow-none disabled:opacity-50"
                    >
                      {sendingAlert ? (
                        <>Transmission en cours <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin ml-2" /></>
                      ) : (
                        <><Send size={14} /> Diffuser l'alerte prioritaire au personnel 🚀</>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          ) : (
            <>
              <div className="relative group">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-brand transition-colors" size={20} />
                <input 
                  type="text" 
                  placeholder="Rechercher une notification par mot-clé..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-16 pr-6 py-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] text-sm font-bold shadow-sm focus:outline-none focus:ring-4 focus:ring-brand/5 focus:border-brand transition-all dark:text-white"
                />
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden min-h-[500px] flex flex-col">
                {loading ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="w-8 h-8 border-4 border-slate-100 border-t-brand rounded-full animate-spin" />
                  </div>
                ) : filteredNotifications.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-20 opacity-30 text-slate-400">
                    <Bell size={64} strokeWidth={1} className="mb-6" />
                    <p className="text-sm font-black uppercase tracking-[0.2em]">Aucune notification trouvée</p>
                    <p className="text-[10px] font-bold mt-2">Essayez de modifier vos filtres ou effectuez une autre recherche.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-50 dark:divide-slate-800">
                    {filteredNotifications.map((notif) => (
                      <motion.div 
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        key={notif.id}
                        className={`p-8 flex gap-6 group transition-all relative overflow-hidden ${
                          notif.isCriticalAlert || notif.type === 'critical'
                            ? notif.alertSeverity === 'info'
                              ? 'bg-blue-500/5 dark:bg-blue-500/10 border-l-[6px] border-blue-500'
                              : notif.alertSeverity === 'warning'
                                ? 'bg-amber-500/5 dark:bg-amber-500/10 border-l-[6px] border-amber-500'
                                : 'bg-red-500/5 dark:bg-red-500/10 border-l-[6px] border-red-650 border-red-650 border-red-600'
                            : !notif.read 
                              ? 'bg-brand/5 dark:bg-emerald-500/5' 
                              : 'hover:bg-slate-50 dark:hover:bg-slate-805'
                        }`}
                      >
                        {!notif.read && !(notif.isCriticalAlert || notif.type === 'critical') && (
                          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-brand" />
                        )}
                        
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                          notif.read ? 'bg-slate-100 dark:bg-slate-800 text-slate-400' : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-brand/10 ring-1 ring-slate-100'
                        }`}>
                          {getIcon(notif.type || '', notif.title)}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className={`text-base font-black uppercase tracking-tight ${notif.read ? 'text-slate-500' : 'text-slate-900 dark:text-white'}`}>
                                {notif.title}
                              </h4>
                              {!notif.read && (
                                <span className="px-2 py-0.5 bg-brand text-white text-[8px] font-black uppercase rounded-full">Nouveau</span>
                              )}
                              {(notif.isCriticalAlert || notif.type === 'critical') && (
                                <span className={`px-2.5 py-0.5 text-white text-[8px] font-black uppercase rounded-full ${
                                  notif.alertSeverity === 'info' ? 'bg-blue-600' : notif.alertSeverity === 'warning' ? 'bg-amber-500 text-slate-950 font-black' : 'bg-red-600'
                                }`}>
                                  Alerte {notif.alertSeverity === 'info' ? 'Générale' : notif.alertSeverity === 'warning' ? 'Importante' : 'Critique'}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => deleteNotification(notif.id)}
                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                          <p className={`text-sm leading-relaxed mb-4 ${notif.read ? 'text-slate-400' : 'text-slate-650 text-slate-650 dark:text-slate-300'} font-medium`}>
                            {notif.message}
                          </p>
                          <div className="flex flex-wrap items-center gap-y-2 gap-x-6">
                            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                              <Clock size={12} />
                              {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest border-l border-slate-100 dark:border-slate-800 pl-6">
                              <Calendar size={12} />
                              {new Date(notif.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                            </div>
                            {!notif.read && (
                              <button 
                                onClick={() => markAsRead(notif.id)}
                                className="ml-auto flex items-center gap-2 text-brand text-[10px] font-black uppercase tracking-[0.2em] hover:opacity-80 transition-opacity"
                              >
                                Marquer comme lu <ChevronRight size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
