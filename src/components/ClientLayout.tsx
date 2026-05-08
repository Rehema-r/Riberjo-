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
  MessageSquare
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

  useEffect(() => {
    if (!profile) return;
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', profile.id),
      orderBy('createdAt', 'desc'),
      limit(5)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setNotifications(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AppNotification)));
    });
    return () => unsubscribe();
  }, [profile]);

  const menuItems = [
    { id: 'client-dashboard', label: 'Espace Client', icon: LayoutDashboard },
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
    <div className="flex h-screen bg-[#F8FAFC] dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans overflow-hidden transition-colors duration-300">
      <style>{`
        .bg-brand { background-color: #10B981; }
        .text-brand { color: #10B981; }
      `}</style>
      
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

      <motion.aside 
        initial={false}
        animate={{ 
          width: isSidebarOpen ? 280 : 80,
          x: isMobileMenuOpen ? 0 : (window.innerWidth < 1024 ? -280 : 0)
        }}
        className="bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col z-50 fixed inset-y-0 left-0 lg:relative"
      >
        <div className="p-8">
           <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-xl">R</div>
              {isSidebarOpen && (
                <div>
                  <h1 className="font-black text-xl tracking-tighter uppercase leading-none">Client Portal</h1>
                  <p className="text-emerald-500 text-[8px] font-black uppercase tracking-widest mt-1">RIBERJO SERVICE</p>
                </div>
              )}
           </div>
        </div>

        <nav className="flex-1 px-4 space-y-2 py-4">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => { onPageChange(item.id); setIsMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-4 px-4 py-4 rounded-3xl transition-all relative ${
                activePage === item.id 
                  ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 shadow-sm' 
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <item.icon size={22} />
              {isSidebarOpen && <span className="font-bold text-sm">{item.label}</span>}
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

      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-24 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 px-8 flex items-center justify-between sticky top-0 z-10">
           <div className="flex items-center gap-4">
              <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl lg:hidden"><Menu size={20}/></button>
              <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Bonjour, {profile?.fullName.split(' ')[0]}</h2>
           </div>
           
           <div className="flex items-center gap-6">
              <button onClick={toggleTheme} className="p-3 text-slate-500 dark:text-slate-400">{isDarkMode ? <Sun size={20}/> : <Moon size={20}/>}</button>
              <div className="flex items-center gap-4 pl-6 border-l border-slate-100 dark:border-slate-800">
                 <div className="text-right hidden md:block">
                    <p className="text-sm font-black text-slate-900 dark:text-white">{profile?.fullName}</p>
                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">{profile?.id}</p>
                 </div>
                 <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400 font-bold border-2 border-white dark:border-slate-700 shadow-lg">
                    {profile?.fullName.charAt(0)}
                 </div>
              </div>
           </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 md:p-12">
           {children}
        </div>
      </main>
    </div>
  );
}
