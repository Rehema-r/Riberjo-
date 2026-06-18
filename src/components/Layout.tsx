import React, { useState, useEffect } from 'react';
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
  WifiOff
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../lib/SettingsContext';
import { useTheme } from '../contexts/ThemeContext';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, orderBy, onSnapshot, getDocs, updateDoc, doc, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { AppNotification } from '../types';

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
  const [filterTasksOnly, setFilterTasksOnly] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof window !== 'undefined' ? navigator.onLine : true);
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

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

  useEffect(() => {
    if (!profile) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', profile.id),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, {
      next: (snapshot) => {
        const notifs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AppNotification));
        setNotifications(notifs);
      },
      error: (err) => {
        console.warn("Notifications onSnapshot operates in local cache mode:", err.message);
      }
    });

    return () => unsubscribe();
  }, [profile]);

  const taskNotifications = notifications.filter(n => n.type === 'task' || n.title.includes('Tâche'));
  const unreadCount = notifications.filter(n => !n.read).length;
  const taskUnreadCount = taskNotifications.filter(n => !n.read).length;

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
      if (profile?.role === 'SUPER_ADMIN') return true;
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
          width: isSidebarOpen ? 280 : 80,
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
          {filteredItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handlePageChange(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all group relative ${
                activePage === item.id 
                  ? 'bg-brand-light text-brand' 
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <item.icon size={22} className={activePage === item.id ? 'text-brand' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300'} />
              {(isSidebarOpen || isMobileMenuOpen) && (
                <span className="font-medium text-sm whitespace-nowrap">{item.label}</span>
              )}
              {activePage === item.id && (
                <motion.div 
                   layoutId="active-pill"
                   className="absolute right-0 w-1 h-6 bg-brand rounded-l-full" 
                />
              )}
            </button>
          ))}
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
                onClick={() => {
                  setIsNotificationsOpen(!isNotificationsOpen);
                  setFilterTasksOnly(true);
                }}
                className="relative p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors group"
              >
                <Bell size={20} className="group-hover:rotate-12 transition-transform" />
                {taskUnreadCount > 0 ? (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black w-4 h-4 flex items-center justify-center rounded-full border-2 border-white dark:border-slate-900 shadow-sm">
                    {taskUnreadCount}
                  </span>
                ) : unreadCount > 0 && (
                  <span className="absolute top-2 right-2 w-2 h-2 bg-blue-500 border-2 border-white dark:border-slate-900 rounded-full"></span>
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
                      className="fixed inset-x-4 top-20 bottom-4 sm:bottom-auto sm:absolute sm:inset-auto sm:right-0 sm:mt-2 sm:w-96 bg-white dark:bg-slate-900 rounded-[2rem] sm:rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 z-50 overflow-hidden flex flex-col"
                    >
                      <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50 shrink-0">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-brand/10 rounded-lg text-brand">
                             <Bell size={14} />
                          </div>
                          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                            {filterTasksOnly ? 'Tâches assignées' : 'Notifications'}
                          </h3>
                        </div>
                        <div className="flex items-center gap-3">
                          {filterTasksOnly && notifications.length > taskNotifications.length && (
                            <button 
                              id="view-all-notifs"
                              onClick={() => setFilterTasksOnly(false)}
                              className="text-[9px] font-black uppercase text-brand hover:underline"
                            >
                              Voir tout
                            </button>
                          )}
                          {unreadCount > 0 && (
                            <button 
                              id="mark-all-read"
                              onClick={markAllAsRead}
                              className="text-[9px] font-black uppercase text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            >
                              Tout lu
                            </button>
                          )}
                          <button 
                            id="close-notifs"
                            onClick={() => setIsNotificationsOpen(false)}
                            className="sm:hidden p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                      <div className="flex-1 overflow-y-auto scrollbar-hide py-2">
                        {(filterTasksOnly ? taskNotifications : notifications).length === 0 ? (
                          <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                            <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800/50 rounded-full flex items-center justify-center mb-4 border border-slate-100 dark:border-slate-800">
                              <Bell size={24} className="text-slate-200 dark:text-slate-700" />
                            </div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                              {filterTasksOnly ? 'Aucune tâche' : 'Aucune notification'}
                            </p>
                          </div>
                        ) : (
                          (filterTasksOnly ? taskNotifications : notifications).map(n => (
                            <div 
                              key={n.id} 
                              id={`notif-${n.id}`}
                              onClick={() => {
                                markAsRead(n.id);
                                if (windowWidth < 640) setIsNotificationsOpen(false);
                              }}
                              className={`p-5 border-b border-slate-50 dark:border-slate-800 last:border-0 cursor-pointer transition-all relative hover:bg-slate-50 dark:hover:bg-slate-800/50 ${n.read ? 'opacity-60' : 'bg-emerald-50/20 dark:bg-emerald-500/5'}`}
                            >
                              <div className="flex gap-4">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                  n.type === 'task' ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600' :
                                  n.type === 'report' ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600' :
                                  'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600'
                                }`}>
                                  {n.type === 'task' ? <CheckSquare size={18} /> : 
                                   n.type === 'report' ? <FileText size={18} /> : <Info size={18} />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex justify-between items-start mb-0.5 gap-2">
                                    <p className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight truncate">{n.title}</p>
                                    {!n.read && <div className="w-2 h-2 bg-brand rounded-full shrink-0 animate-pulse mt-1" />}
                                  </div>
                                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed line-clamp-2">{n.message}</p>
                                  <div className="flex items-center gap-2 mt-2">
                                    <Clock size={10} className="text-slate-300" />
                                    <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                                      {new Date(n.createdAt).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                      <div className="p-4 bg-slate-50/50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 shrink-0">
                         <button 
                           id="nav-to-history"
                           onClick={() => {
                             onPageChange('notifications');
                             setIsNotificationsOpen(false);
                           }}
                           className="w-full py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all font-sans"
                         >
                           Voir l'historique complet
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
      </main>
    </div>
  );
}
