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
  Package,
  BookOpen,
  Stethoscope,
  Sprout,
  X,
  Check,
  Archive,
  Moon,
  Sun,
  TrendingUp,
  DollarSign,
  Clock,
  Calendar
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
  const { profile, signOut } = useAuth();
  const { settings } = useSettings();
  const { isDarkMode, toggleTheme } = useTheme();
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  useEffect(() => {
    if (!profile) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', profile.id),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AppNotification));
      setNotifications(notifs);
    });

    return () => unsubscribe();
  }, [profile]);

  const unreadCount = notifications.filter(n => !n.read).length;

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
    { id: 'ferme', label: 'Ferme & Agri', icon: Sprout, roles: ['SUPER_ADMIN', 'ADMIN', 'SUPER_USER', 'USER'], dept: '01' },
    { id: 'santé', label: 'Santé & Médical', icon: Stethoscope, roles: ['SUPER_ADMIN', 'ADMIN', 'SUPER_USER', 'USER'], dept: '02' },
    { id: 'rh', label: 'Personnel & RH', icon: Users, roles: ['SUPER_ADMIN', 'ADMIN'], dept: '03' },
    { id: 'finance', label: 'Finance & Compta', icon: DollarSign, roles: ['SUPER_ADMIN', 'ADMIN', 'SUPER_USER'], dept: '04' },
    { id: 'logistique', label: 'Stock & Logistique', icon: Package, roles: ['SUPER_ADMIN', 'ADMIN', 'SUPER_USER'], dept: '05' },
    { id: 'marketing', label: 'Ventes & Marché', icon: TrendingUp, roles: ['SUPER_ADMIN', 'ADMIN', 'SUPER_USER'], dept: '06' },
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
    const roleMatch = item.roles.includes(profile?.role || '');
    if (!roleMatch) return false;
    
    // If it's a specific department page, check if user belongs to it or is super admin
    if (item.dept && profile?.role !== 'SUPER_ADMIN') {
      return profile?.departmentId === item.dept;
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
          x: isMobileMenuOpen ? 0 : (window.innerWidth < 1024 ? -280 : 0)
        }}
        className={`bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col z-50 fixed inset-y-0 left-0 lg:relative transition-[width,transform,background-color] duration-300 ease-in-out`}
      >
        <div className="p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center shadow-xl shadow-slate-200/50 dark:shadow-black/50 p-2 overflow-hidden border border-slate-50 dark:border-slate-700 transition-transform hover:scale-105">
                <div className="w-full h-full bg-emerald-600 rounded-lg flex items-center justify-center text-white font-black text-xl shadow-inner">R</div>
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
            onClick={() => signOut()}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 transition-all group"
          >
            <LogOut size={22} className="text-slate-400 group-hover:text-red-500" />
            {(isSidebarOpen || isMobileMenuOpen) && <span className="font-medium text-sm">Déconnexion</span>}
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-20 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 md:px-8 flex items-center justify-between z-10 shrink-0 transition-colors duration-300">
          <div className="flex items-center gap-4 flex-1">
            <button 
              onClick={() => {
                if (window.innerWidth < 1024) setIsMobileMenuOpen(true);
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
                className="relative p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 border-2 border-white dark:border-slate-900 rounded-full"></span>
                )}
              </button>

              <AnimatePresence>
                {isNotificationsOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsNotificationsOpen(false)} />
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 z-50 overflow-hidden"
                    >
                      <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Notifications</h3>
                        {unreadCount > 0 && (
                          <button 
                            onClick={markAllAsRead}
                            className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                          >
                            Tout lu
                          </button>
                        )}
                      </div>
                      <div className="max-h-96 overflow-y-auto scrollbar-hide py-2">
                        {notifications.length === 0 ? (
                          <div className="p-8 text-center">
                            <Bell size={24} className="mx-auto text-slate-200 dark:text-slate-800 mb-2" />
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Aucune notification</p>
                          </div>
                        ) : (
                          notifications.map(n => (
                            <div 
                              key={n.id} 
                              onClick={() => markAsRead(n.id)}
                              className={`p-4 border-b border-slate-50 dark:border-slate-800 last:border-0 cursor-pointer transition-colors relative ${n.read ? 'opacity-60 bg-white dark:bg-slate-900' : 'bg-emerald-50/30 dark:bg-emerald-500/10'}`}
                            >
                              {!n.read && <div className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-emerald-500 rounded-full" />}
                              <p className="text-xs font-black text-slate-900 dark:text-slate-100 mb-1 tracking-tight">{n.title}</p>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">{n.message}</p>
                              <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-2 font-mono">
                                {new Date(n.createdAt).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
            
            <div className="flex items-center gap-3 pl-3 md:pl-6 border-l border-slate-100 dark:border-slate-800">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 line-clamp-1">{profile?.fullName}</p>
                <p className="text-[10px] font-bold text-brand uppercase tracking-wider">{profile?.role.replace('_', ' ')}</p>
              </div>
              <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-400 overflow-hidden shadow-inner uppercase font-bold border border-white dark:border-slate-700">
                {profile?.avatarUrl ? (
                  <img src={profile.avatarUrl} alt="Profil" className="w-full h-full object-cover" />
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
