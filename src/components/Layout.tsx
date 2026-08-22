import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Building2, 
  FileText, 
  CheckSquare, 
  MessageSquare, 
  Bell, 
  LogOut, 
  Menu, 
  Settings,
  Circle,
  Search,
  User as UserIcon,
  Shield,
  Package,
  BookOpen,
  Stethoscope,
  Sprout,
  X,
  Check,
  Archive,
  Info,
  Moon,
  Sun,
  TrendingUp,
  DollarSign,
  Clock,
  Calendar,
  Wifi,
  WifiOff,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../lib/SettingsContext';
import { useTheme } from '../contexts/ThemeContext';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, orderBy, onSnapshot, getDocs, updateDoc, doc, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { AppNotification } from '../types';
import { playMessageChime, playAlertChime } from '../utils/sound';

interface LayoutProps {
  children: React.ReactNode;
  activePage: string;
  onPageChange: (page: string) => void;
}

export default function Layout({ children, activePage, onPageChange }: LayoutProps) {
  const { profile, signOut, roleLabel } = useAuth();
  const { settings } = useSettings();
  const { isDarkMode, toggleTheme } = useTheme();
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState<'all' | 'tasks' | 'messages' | 'alerts'>('all');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof window !== 'undefined' ? navigator.onLine : true);
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  const [toastNotification, setToastNotification] = useState<AppNotification | null>(null);

  const isInitialSnapshotRef = useRef(true);
  const mountTimestampRef = useRef<number>(Date.now());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    const handleResize = () => setWindowWidth(window.innerWidth);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Request browser notification permission once on login
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
    }
  }, []);

  useEffect(() => {
    if (!profile) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', profile.id),
      orderBy('createdAt', 'desc'),
      limit(30)
    );

    const unsubscribe = onSnapshot(q, {
      next: (snapshot) => {
        const notifs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AppNotification));
        setNotifications(notifs);

        // Detect newly arrived notifications in real-time
        if (!isInitialSnapshotRef.current) {
          snapshot.docChanges().forEach(change => {
            if (change.type === 'added') {
              const newNotif = { id: change.doc.id, ...change.doc.data() } as AppNotification;
              if (!newNotif.read && newNotif.createdAt >= mountTimestampRef.current - 5000) {
                // Play chime
                if (newNotif.type === 'critical' || newNotif.isCriticalAlert) {
                  playAlertChime();
                } else {
                  playMessageChime();
                }

                // Show in-app live toast
                setToastNotification(newNotif);

                // Show browser desktop notification if permission granted
                if ('Notification' in window && Notification.permission === 'granted') {
                  try {
                    new Notification(newNotif.title, {
                      body: newNotif.message,
                      icon: settings?.logoUrl || '/logo.png'
                    });
                  } catch (e) {
                    console.warn("Browser notification failed:", e);
                  }
                }
              }
            }
          });
        }

        isInitialSnapshotRef.current = false;
      },
      error: (err) => {
        console.warn("Notifications onSnapshot operates in local cache mode:", err.message);
      }
    });

    return () => unsubscribe();
  }, [profile, settings]);

  // Auto dismiss toast after 6 seconds
  useEffect(() => {
    if (!toastNotification) return;
    const timer = setTimeout(() => {
      setToastNotification(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [toastNotification]);

  const taskNotifications = notifications.filter(n => n.type === 'task' || n.title.toLowerCase().includes('tâche'));
  const messageNotifications = notifications.filter(n => n.type === 'message' || n.chatId || n.title.toLowerCase().includes('message'));
  const alertNotifications = notifications.filter(n => n.type === 'critical' || n.isCriticalAlert);

  const getFilteredNotifications = () => {
    switch (filterCategory) {
      case 'tasks':
        return taskNotifications;
      case 'messages':
        return messageNotifications;
      case 'alerts':
        return alertNotifications;
      case 'all':
      default:
        return notifications;
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;
  const taskUnreadCount = taskNotifications.filter(n => !n.read).length;
  const messageUnreadCount = messageNotifications.filter(n => !n.read).length;
  const alertUnreadCount = alertNotifications.filter(n => !n.read).length;

  const markAsRead = async (notifId: string) => {
    try {
      await updateDoc(doc(db, 'notifications', notifId), { read: true });
    } catch (err) {
      console.error(err);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unread = notifications.filter(n => !n.read);
      for (const n of unread) {
        await updateDoc(doc(db, 'notifications', n.id), { read: true });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleNotificationClick = async (n: AppNotification) => {
    await markAsRead(n.id);
    if (n.type === 'message' || n.chatId || n.title.toLowerCase().includes('message')) {
      if (n.chatId) {
        sessionStorage.setItem('target_chat_id', n.chatId);
        window.dispatchEvent(new CustomEvent('select_chat', { detail: { chatId: n.chatId } }));
      }
      onPageChange('chat');
    } else if (n.type === 'task' || n.title.toLowerCase().includes('tâche')) {
      onPageChange('tasks');
    } else if (n.type === 'report' || n.title.toLowerCase().includes('rapport')) {
      onPageChange('reports');
    } else {
      onPageChange('notifications');
    }
    setIsNotificationsOpen(false);
    setToastNotification(null);
  };

  const menuItems = [
    { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard, roles: ['SUPER_ADMIN', 'ADMIN', 'SUPER_USER', 'USER'] },
    { id: 'profile', label: 'Mon profil', icon: UserIcon, roles: ['SUPER_ADMIN', 'ADMIN', 'SUPER_USER', 'USER'] },
    { id: 'ferme', label: 'Ferme & Agri', icon: Sprout, roles: ['SUPER_ADMIN', 'ADMIN', 'SUPER_USER', 'USER'], dept: '01' },
    { id: 'santé', label: 'Santé & Médical', icon: Stethoscope, roles: ['SUPER_ADMIN', 'ADMIN', 'SUPER_USER', 'USER'], dept: '02' },
    { id: 'users', label: 'Registre', icon: BookOpen, roles: ['SUPER_ADMIN', 'ADMIN'] },
    { id: 'board_members', label: "Conseil d'Administration", icon: Shield, roles: ['SUPER_ADMIN'] },
    { id: 'rh', label: 'Personnel & RH', icon: Users, roles: ['SUPER_ADMIN', 'ADMIN', 'SUPER_USER', 'USER'], dept: '03' },
    { id: 'finance', label: 'Finance & Compta', icon: DollarSign, roles: ['SUPER_ADMIN', 'ADMIN', 'SUPER_USER', 'USER'], dept: '04' },
    { id: 'logistique', label: 'Stock & Logistique', icon: Package, roles: ['SUPER_ADMIN', 'ADMIN', 'SUPER_USER', 'USER'], dept: '05' },
    { id: 'marketing', label: 'Ventes & Marché', icon: TrendingUp, roles: ['SUPER_ADMIN', 'ADMIN', 'SUPER_USER', 'USER'], dept: '06' },
    { id: 'attendance', label: 'Présences', icon: Clock, roles: ['SUPER_ADMIN', 'ADMIN', 'SUPER_USER', 'USER'] },
    { id: 'payroll', label: 'Paie & Salaire', icon: DollarSign, roles: ['SUPER_ADMIN', 'ADMIN', '03', '04'] },
    { id: 'calendar', label: 'Calendrier', icon: Calendar, roles: ['SUPER_ADMIN', 'ADMIN', 'SUPER_USER', 'USER'] },
    { id: 'documents', label: 'Documents', icon: BookOpen, roles: ['SUPER_ADMIN', 'ADMIN', 'SUPER_USER', 'USER'] },
    { id: 'reports', label: 'Rapports', icon: FileText, roles: ['SUPER_ADMIN', 'ADMIN', 'SUPER_USER'] },
    { id: 'tasks', label: 'Tâches', icon: CheckSquare, roles: ['SUPER_ADMIN', 'ADMIN', 'USER'] },
    { id: 'chat', label: 'Messages', icon: MessageSquare, roles: ['SUPER_ADMIN', 'ADMIN', 'SUPER_USER', 'USER'] },
    { id: 'archive', label: 'Archives', icon: Archive, roles: ['SUPER_ADMIN', 'ADMIN'] },
    { id: 'settings', label: 'Système', icon: Settings, roles: ['SUPER_ADMIN'] },
  ];

  const filteredItems = menuItems.filter(item => {
    if (profile?.role === 'BOARD_MEMBER') {
      // Board Member can see all tabs except system setup
      return item.id !== 'settings';
    }

    const roleMatch = item.roles.includes(profile?.role || '');
    if (!roleMatch) return false;
    
    // If it's a specific department page, check if user belongs to it or is super admin or admin with 'all'
    if (item.dept) {
      if (profile?.role === 'SUPER_ADMIN') return false; // Le DG n'a pas le droit de naviguer dans les espaces de travail des autres membres
      if (profile?.role === 'ADMIN' && profile?.departmentId === 'all') return true;
      return profile?.departmentId === item.dept;
    }

    // Restrict Registre (users) to SUPER_ADMIN, or ADMIN belonging to RH (03) or 'all'
    if (item.id === 'users') {
      return profile?.role === 'SUPER_ADMIN' || 
        (profile?.role === 'ADMIN' && (profile?.departmentId === '03' || profile?.departmentId === 'all'));
    }

    // Restrict Paie (payroll) to SUPER_ADMIN, or ADMIN/members belonging to RH (03), Finance (04), or 'all'
    if (item.id === 'payroll') {
      return profile?.role === 'SUPER_ADMIN' || 
        profile?.departmentId === '03' || 
        profile?.departmentId === '04' || 
        profile?.departmentId === 'all';
    }
    
    return true;
  });

  const handlePageChange = (page: string) => {
    onPageChange(page);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC] dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans overflow-hidden relative transition-colors duration-300">
      <style>{`
        .bg-brand { background-color: var(--primary-brand, #10B981); }
        .text-brand { color: var(--primary-brand, #10B981); }
        .border-brand { border-color: var(--primary-brand, #10B981); }
        .ring-brand { --tw-ring-color: var(--primary-brand, #10B981); }
        .bg-brand-light { background-color: color-mix(in srgb, var(--primary-brand, #10B981), white 90%); }
        .dark .bg-brand-light { background-color: color-mix(in srgb, var(--primary-brand, #10B981), black 80%); }
      `}</style>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ 
          width: windowWidth < 1024 ? 280 : (isSidebarOpen ? 280 : 80),
          x: isMobileMenuOpen ? 0 : (windowWidth < 1024 ? -280 : 0)
        }}
        className={`bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col z-50 fixed inset-y-0 left-0 lg:relative transition-[width,transform,background-color] duration-300 ease-in-out`}
      >
        <div className="p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center shadow-xl shadow-slate-200/50 dark:shadow-black/50 p-1 overflow-hidden border border-slate-50 dark:border-slate-700 transition-transform hover:scale-105">
                {settings?.logoUrl ? (
                  <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <div className="w-full h-full bg-emerald-600 rounded-lg flex items-center justify-center text-white font-black text-xl shadow-inner">R</div>
                )}
              </div>
              {(isSidebarOpen || isMobileMenuOpen) && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="overflow-hidden"
                >
                  <h1 className="font-black text-xl tracking-tighter text-slate-900 dark:text-white leading-none uppercase">RIBERJO</h1>
                  <p className="text-brand text-[8px] font-black uppercase tracking-[0.2em] mt-0.5">Global Service</p>
                </motion.div>
              )}
            </div>
            <button className="lg:hidden p-2 text-slate-400 bg-slate-50 dark:bg-slate-800 rounded-xl" onClick={() => setIsMobileMenuOpen(false)}>
              <X size={20} />
            </button>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1 py-4 overflow-y-auto scrollbar-hide">
          {filteredItems.map((item) => {
            const badgeCount = item.id === 'chat' ? messageUnreadCount : item.id === 'tasks' ? taskUnreadCount : 0;
            return (
              <button
                key={item.id}
                onClick={() => handlePageChange(item.id)}
                className={`w-full flex items-center justify-between px-3 py-3 rounded-xl transition-all group relative ${
                  activePage === item.id 
                    ? 'bg-brand-light text-brand' 
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <item.icon size={22} className={activePage === item.id ? 'text-brand' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300'} />
                  {(isSidebarOpen || isMobileMenuOpen) && (
                    <span className="font-medium text-sm whitespace-nowrap">{item.label}</span>
                  )}
                </div>

                {/* Badge alert indicator */}
                {badgeCount > 0 && (
                  <span className={`px-2 py-0.5 text-[10px] font-black rounded-full shadow-sm animate-pulse ${
                    item.id === 'chat' 
                      ? 'bg-emerald-500 text-white' 
                      : 'bg-red-500 text-white'
                  }`}>
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </span>
                )}

                {activePage === item.id && (
                  <motion.div 
                     layoutId="active-pill"
                     className="absolute right-0 w-1 h-6 bg-brand rounded-l-full" 
                  />
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800">
          <button 
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 transition-all group"
          >
            <LogOut size={22} className="text-slate-400 group-hover:text-red-500" />
            {(isSidebarOpen || isMobileMenuOpen) && <span className="font-medium text-sm">Déconnexion</span>}
          </button>
        </div>
      </motion.aside>

      {/* Logout Confirmation Dialog */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <div className="fixed inset-0 flex items-center justify-center z-[100] px-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLogoutConfirm(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-8 shadow-2xl"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center mb-6">
                  <LogOut size={32} className="text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2 uppercase tracking-tight">Déconnexion</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 font-medium">
                  Êtes-vous sûr de vouloir vous déconnecter de votre session ?
                </p>
                
                <div className="flex flex-col w-full gap-3">
                  <button 
                    onClick={() => signOut()}
                    className="w-full bg-red-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-200 dark:shadow-none"
                  >
                    Confirmer la déconnexion
                  </button>
                  <button 
                    onClick={() => setShowLogoutConfirm(false)}
                    className="w-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-20 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 md:px-8 flex items-center justify-between z-10 shrink-0 transition-colors duration-300">
          <div className="flex items-center gap-4 flex-1">
            <button 
              onClick={() => {
                if (windowWidth < 1024) setIsMobileMenuOpen(true);
                else setSidebarOpen(!isSidebarOpen);
              }}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 transition-colors"
            >
              <Menu size={20} />
            </button>
            <div className="max-w-md w-full relative hidden lg:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Rechercher..." 
                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 md:gap-6">
            <button 
              onClick={toggleTheme}
              className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title={isDarkMode ? 'Passer au mode clair' : 'Passer au mode sombre'}
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            <div className="relative">
              <button 
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className="relative p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors group"
              >
                <Bell size={20} className="group-hover:rotate-12 transition-transform" />
                {unreadCount > 0 && (
                  <span className={`absolute -top-1 -right-1 text-white text-[9px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-white dark:border-slate-900 shadow-md ${
                    alertUnreadCount > 0 ? 'bg-red-600 animate-bounce' : 'bg-brand'
                  }`}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {isNotificationsOpen && (
                  <>
                    <div className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-[2px] lg:bg-transparent" onClick={() => setIsNotificationsOpen(false)} />
                    <motion.div 
                      id="notifications-dropdown"
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="fixed inset-x-4 top-20 bottom-4 sm:bottom-auto sm:absolute sm:inset-auto sm:right-0 sm:mt-2 sm:w-[420px] bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-slate-100 dark:border-slate-800 z-50 overflow-hidden flex flex-col"
                    >
                      <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 shrink-0">
                        <div className="flex justify-between items-center mb-3">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-brand/10 rounded-lg text-brand">
                               <Bell size={16} />
                            </div>
                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white">
                              Notifications & Alertes
                            </h3>
                          </div>
                          <div className="flex items-center gap-2">
                            {unreadCount > 0 && (
                              <button 
                                id="mark-all-read"
                                onClick={markAllAsRead}
                                className="text-[10px] font-black uppercase text-brand hover:underline"
                              >
                                Tout marquer lu
                              </button>
                            )}
                            <button 
                              id="close-notifs"
                              onClick={() => setIsNotificationsOpen(false)}
                              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-400"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        </div>

                        {/* Filter Tabs */}
                        <div className="flex gap-1 p-1 bg-slate-200/60 dark:bg-slate-800/60 rounded-xl">
                          <button
                            onClick={() => setFilterCategory('all')}
                            className={`flex-1 py-1 text-[10px] font-black uppercase rounded-lg transition-all ${
                              filterCategory === 'all' 
                                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' 
                                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            Toutes ({notifications.length})
                          </button>
                          <button
                            onClick={() => setFilterCategory('messages')}
                            className={`flex-1 py-1 text-[10px] font-black uppercase rounded-lg transition-all flex items-center justify-center gap-1 ${
                              filterCategory === 'messages' 
                                ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm' 
                                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            💬 Messages {messageUnreadCount > 0 && <span className="w-2 h-2 rounded-full bg-emerald-500"></span>}
                          </button>
                          <button
                            onClick={() => setFilterCategory('tasks')}
                            className={`flex-1 py-1 text-[10px] font-black uppercase rounded-lg transition-all ${
                              filterCategory === 'tasks' 
                                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' 
                                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            Tâches ({taskNotifications.length})
                          </button>
                          <button
                            onClick={() => setFilterCategory('alerts')}
                            className={`flex-1 py-1 text-[10px] font-black uppercase rounded-lg transition-all ${
                              filterCategory === 'alerts' 
                                ? 'bg-white dark:bg-slate-700 text-red-600 dark:text-red-400 shadow-sm' 
                                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            Alertes ({alertNotifications.length})
                          </button>
                        </div>
                      </div>

                      {/* Dropdown Items List */}
                      <div className="flex-1 overflow-y-auto max-h-[380px] scrollbar-hide divide-y divide-slate-100 dark:divide-slate-800">
                        {getFilteredNotifications().length === 0 ? (
                          <div className="h-48 flex flex-col items-center justify-center p-8 text-center">
                            <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800/50 rounded-full flex items-center justify-center mb-3 border border-slate-100 dark:border-slate-800">
                              <Bell size={20} className="text-slate-300 dark:text-slate-600" />
                            </div>
                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                              Aucune notification dans cette vue
                            </p>
                          </div>
                        ) : (
                          getFilteredNotifications().map(n => (
                            <div 
                              key={n.id} 
                              id={`notif-${n.id}`}
                              onClick={() => handleNotificationClick(n)}
                              className={`p-4 cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-slate-800/50 flex items-start gap-3 ${
                                n.read ? 'opacity-70 bg-white dark:bg-slate-900' : 'bg-emerald-50/20 dark:bg-emerald-500/5'
                              }`}
                            >
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                                n.type === 'message' || n.chatId ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' :
                                n.type === 'task' ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400' :
                                n.type === 'report' ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400' :
                                n.type === 'critical' || n.isCriticalAlert ? 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400' :
                                'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                              }`}>
                                {n.type === 'message' || n.chatId ? <MessageSquare size={16} /> :
                                 n.type === 'task' ? <CheckSquare size={16} /> : 
                                 n.type === 'report' ? <FileText size={16} /> : 
                                 n.type === 'critical' || n.isCriticalAlert ? <AlertTriangle size={16} /> :
                                 <Info size={16} />}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 mb-0.5">
                                  <p className="text-xs font-black text-slate-900 dark:text-white truncate">
                                    {n.title}
                                  </p>
                                  {!n.read && (
                                    <span className="w-2 h-2 rounded-full bg-brand shrink-0 animate-pulse" />
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed line-clamp-2">
                                  {n.message}
                                </p>
                                <div className="flex items-center justify-between mt-2">
                                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                                    {new Date(n.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                  {(n.type === 'message' || n.chatId) && (
                                    <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1 hover:underline">
                                      Répondre <ArrowRight size={10} />
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Dropdown Footer */}
                      <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 shrink-0">
                         <button 
                           id="nav-to-history"
                           onClick={() => {
                             onPageChange('notifications');
                             setIsNotificationsOpen(false);
                           }}
                           className="w-full py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-center"
                         >
                           Voir tout le centre de notifications
                         </button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
            
            <div className="flex items-center gap-3 pl-3 md:pl-6 border-l border-slate-100 dark:border-slate-800">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 line-clamp-1">{profile?.fullName}</p>
                <p className="text-[10px] font-bold text-brand uppercase tracking-wider">{roleLabel}</p>
              </div>
              <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-400 overflow-hidden shadow-inner uppercase font-bold border border-white dark:border-slate-700">
                {profile?.avatarUrl ? (
                  <img src={profile.avatarUrl || null} alt="Profil" className="w-full h-full object-cover" />
                ) : (
                  profile?.fullName.charAt(0)
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 scrollbar-hide dark:bg-slate-950 transition-colors duration-300">
          {children}
        </div>

        {/* Real-time Floating Message & Alert Toast Banner */}
        <AnimatePresence>
          {toastNotification && (
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              className="fixed bottom-6 right-6 z-[99] max-w-sm w-full bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border-2 border-emerald-500/30 p-4 backdrop-blur-xl flex items-start gap-3.5"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                toastNotification.type === 'message' || toastNotification.chatId 
                  ? 'bg-emerald-600 text-white' 
                  : toastNotification.type === 'critical' || toastNotification.isCriticalAlert
                  ? 'bg-red-600 text-white'
                  : 'bg-blue-600 text-white'
              }`}>
                {toastNotification.type === 'message' || toastNotification.chatId ? (
                  <MessageSquare size={18} />
                ) : toastNotification.type === 'critical' || toastNotification.isCriticalAlert ? (
                  <AlertTriangle size={18} />
                ) : (
                  <Bell size={18} />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight truncate">
                    {toastNotification.title}
                  </h4>
                  <button 
                    onClick={() => setToastNotification(null)}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
                  >
                    <X size={14} />
                  </button>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 font-medium line-clamp-2 leading-relaxed">
                  {toastNotification.message}
                </p>

                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={() => handleNotificationClick(toastNotification)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-wider rounded-lg shadow-sm flex items-center gap-1.5 transition-colors"
                  >
                    {toastNotification.type === 'message' || toastNotification.chatId ? '💬 Répondre' : 'Consulter'}
                    <ArrowRight size={12} />
                  </button>
                  <button
                    onClick={() => setToastNotification(null)}
                    className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold uppercase rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    Ignorer
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
