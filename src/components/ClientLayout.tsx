import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Sprout, 
  Stethoscope, 
  BookOpen, 
  ShoppingCart, 
  Truck, 
  HelpCircle, 
  CreditCard, 
  LogOut, 
  Menu, 
  Bell, 
  User as UserIcon,
  X,
  Moon,
  Sun,
  MessageSquare,
  Wifi,
  WifiOff
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../lib/SettingsContext';
import { useTheme } from '../contexts/ThemeContext';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { AppNotification } from '../types';

interface ClientLayoutProps {
  children: React.ReactNode;
  activePage: string;
  onPageChange: (page: string) => void;
}

export default function ClientLayout({ children, activePage, onPageChange }: ClientLayoutProps) {
  const { profile, signOut } = useAuth();
  const { settings } = useSettings();
  const { isDarkMode, toggleTheme } = useTheme();
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
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
      limit(5)
    );
    const unsubscribe = onSnapshot(q, {
      next: (snapshot) => {
        setNotifications(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AppNotification)));
      },
      error: (err) => {
        console.warn("ClientNotifications onSnapshot operates in local cache mode:", err.message);
      }
    });
    return () => unsubscribe();
  }, [profile]);

  const menuItems = [
    { id: 'client-dashboard', label: 'Espace Client', icon: LayoutDashboard },
    { id: 'client-profile', label: 'Mon profil', icon: UserIcon },
    { id: 'client-agriculture', label: 'Agriculture', icon: Sprout },
    { id: 'client-health', label: 'Santé', icon: Stethoscope },
    { id: 'client-education', label: 'Éducation', icon: BookOpen },
    { id: 'client-commerce', label: 'Boutique', icon: ShoppingCart },
    { id: 'client-logistics', label: 'Logistique', icon: Truck },
    { id: 'client-payments', label: 'Factures', icon: CreditCard },
    { id: 'client-support', label: 'Assistance', icon: HelpCircle },
    { id: 'client-chat', label: 'Messages', icon: MessageSquare },
  ];

  return (
    <div className="flex h-screen bg-[#F8FAFC] dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans overflow-hidden transition-colors duration-300 relative">
      <style>{`
        .bg-brand { background-color: #10B981; }
        .text-brand { color: #10B981; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
      
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] lg:hidden"
          />
        )}
      </AnimatePresence>

      <motion.aside 
        initial={false}
        animate={{ 
          width: isSidebarOpen ? 280 : 80,
          x: isMobileMenuOpen ? 0 : (windowWidth < 1024 ? -280 : 0)
        }}
        className="bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col z-[70] fixed inset-y-0 left-0 lg:relative transition-[width,transform] duration-300"
      >
        <div className="p-6 md:p-8 shrink-0">
           <div className="flex items-center justify-between lg:justify-start gap-4">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-xl p-1 overflow-hidden border border-slate-100 dark:border-slate-800 transition-transform hover:scale-105">
                   {settings?.logoUrl ? (
                     <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                   ) : (
                     <div className="w-full h-full bg-emerald-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-inner">R</div>
                   )}
                 </div>
                 {(isSidebarOpen || isMobileMenuOpen) && (
                   <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                     <h1 className="font-black text-xl tracking-tighter uppercase leading-none">Client Portal</h1>
                     <p className="text-emerald-500 text-[8px] font-black uppercase tracking-widest mt-1">RIBERJO SERVICE</p>
                   </motion.div>
                 )}
              </div>
              <button className="lg:hidden p-2 text-slate-400" onClick={() => setIsMobileMenuOpen(false)}>
                <X size={20} />
              </button>
           </div>
        </div>

        <nav className="flex-1 px-4 space-y-2 py-4 overflow-y-auto no-scrollbar">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => { onPageChange(item.id); setIsMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-4 px-4 py-3 md:py-4 rounded-3xl transition-all relative ${
                activePage === item.id 
                  ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 shadow-sm' 
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <item.icon size={22} className="shrink-0" />
              {(isSidebarOpen || isMobileMenuOpen) && <span className="font-bold text-sm whitespace-nowrap">{item.label}</span>}
              {activePage === item.id && (
                <div className="absolute right-0 w-1.5 h-8 bg-emerald-500 rounded-l-full" />
              )}
            </button>
          ))}
        </nav>

        <div className="p-6">
           <button 
             onClick={() => signOut()}
             className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all"
           >
              <LogOut size={22} />
              {isSidebarOpen && <span className="font-bold text-sm">Déconnexion</span>}
           </button>
        </div>
      </motion.aside>

      <main className="flex-1 flex flex-col min-w-0 relative">
        <header className="h-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 px-4 md:px-8 flex items-center justify-between sticky top-0 z-50">
           <div className="flex items-center gap-4">
              <button 
                onClick={() => {
                  if (windowWidth < 1024) setIsMobileMenuOpen(true);
                  else setSidebarOpen(!isSidebarOpen);
                }} 
                className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl"
              >
                <Menu size={20}/>
              </button>
              <h2 className="text-sm md:text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight truncate max-w-[150px] md:max-w-none">
                Bonjour, {profile?.fullName.split(' ')[0]}
              </h2>
           </div>
           
           <div className="flex items-center gap-3 md:gap-6">
              <button onClick={toggleTheme} className="hidden">
              </button>
              
               <button onClick={toggleTheme} className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors">
                {isDarkMode ? <Sun size={20}/> : <Moon size={20}/>}
              </button>
              <div className="flex items-center gap-3 pl-3 md:pl-6 border-l border-slate-100 dark:border-slate-800">
                 <div className="text-right hidden sm:block">
                    <p className="text-sm font-black text-slate-900 dark:text-white line-clamp-1">{profile?.fullName}</p>
                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">{profile?.id}</p>
                 </div>
                 <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 font-bold border border-white dark:border-slate-700 shadow-inner shrink-0 uppercase overflow-hidden">
                    {profile?.avatarUrl ? (
                      <img src={profile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      profile?.fullName.charAt(0)
                    )}
                 </div>
              </div>
           </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-12 no-scrollbar">
           {children}
        </div>
      </main>
    </div>
  );
}
