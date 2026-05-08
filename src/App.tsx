import { useEffect, useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from './lib/firebase';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Users from './pages/Users';
import Reports from './pages/Reports';
import Tasks from './pages/Tasks';
import Chat from './pages/Chat';
import Departments from './pages/Departments';
import Settings from './pages/Settings';
import Resources from './pages/Resources';
import Archive from './pages/Archive';
import Attendance from './pages/Attendance';
import Payroll from './pages/Payroll';
import Documents from './pages/Documents';
import Calendar from './pages/Calendar';
import DepartmentHub from './pages/DepartmentHub';
import ClientLayout from './components/ClientLayout';
import ClientDashboard from './pages/client/Dashboard';
import ClientRegister from './pages/client/Register';
import ClientAgriculture from './pages/client/Agriculture';
import ClientHealth from './pages/client/Health';
import ClientEducation from './pages/client/Education';
import PasswordChangeModal from './components/PasswordChangeModal';
import { AnimatePresence, motion } from 'motion/react';
import { notificationService } from './services/notificationService';

export default function App() {
  const { user, profile, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [isInitializing, setIsInitializing] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [isPublicRegister, setIsPublicRegister] = useState(window.location.pathname === '/register-client');

  useEffect(() => {
    // Handle manual URL navigation for public register
    const handlePopState = () => setIsPublicRegister(window.location.pathname === '/register-client');
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (profile?.role === 'CLIENT' && currentPage === 'dashboard') {
      setCurrentPage('client-dashboard');
    }
  }, [profile, currentPage]);

  useEffect(() => {
    // Hide splash screen after 2.5 seconds
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2500);
    notificationService.requestPermission();
    return () => clearTimeout(timer);
  }, []);

  // Initialize Super Admin if its the specific matricule and no profile exists
  useEffect(() => {
    async function initSuperAdmin() {
      // Use matricule from local storage instead of firebase user UID
      const currentMatricule = localStorage.getItem('riberjo_matricule');
      
      if (currentMatricule && !profile && !loading && !isInitializing) {
        setIsInitializing(true);
        const targetMatricule = "26/RBJ-DG-01";
        const sanitizedTarget = targetMatricule.replace(/\//g, '_');
        
        if (currentMatricule === targetMatricule) {
          try {
            const profileRef = doc(db, 'users', sanitizedTarget);
            const snap = await getDoc(profileRef);
            
            if (!snap.exists()) {
              const newProfile = {
                fullName: "DG Musama Kasongo",
                role: 'SUPER_ADMIN',
                departmentId: 'DG',
                matricule: targetMatricule,
                password: 'Riberjo202!',
                status: 'active',
                createdAt: Date.now()
              };
              await setDoc(profileRef, newProfile);
            }
          } catch (err) {
            console.error("Bootstrap error:", err);
          }
        }
        setIsInitializing(false);
      }
    }
    initSuperAdmin();
  }, [profile, loading, isInitializing]);

  if (showSplash) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-white dark:bg-slate-900 overflow-hidden relative font-sans">
        <style>{`
          .gradient-text {
            background: linear-gradient(135deg, #047857 0%, #10B981 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
          }
        `}</style>
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative z-10 flex flex-col items-center"
        >
          <div className="w-32 h-32 bg-emerald-50 dark:bg-slate-800 rounded-[2.5rem] flex items-center justify-center shadow-2xl p-6 mb-8 relative">
            <div className="w-full h-full bg-emerald-600 rounded-[1.5rem] flex items-center justify-center text-white font-black text-6xl shadow-inner uppercase">R</div>
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
              className="absolute -inset-2 border-2 border-dashed border-emerald-200 dark:border-emerald-500/30 rounded-[3rem] opacity-30"
            />
          </div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-center"
          >
            <h1 className="text-4xl font-black gradient-text tracking-tighter uppercase mb-1">RIBERJO</h1>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.4em]">Global Service SARL</p>
          </motion.div>
        </motion.div>

        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: "200px" }}
          transition={{ delay: 1, duration: 1.5 }}
          className="absolute bottom-24 h-1 bg-emerald-50 rounded-full overflow-hidden"
        >
          <motion.div 
            animate={{ x: ["-100%", "100%"] }}
            transition={{ repeat: Infinity, duration: 1, ease: "easeInOut" }}
            className="w-full h-full bg-emerald-600"
          />
        </motion.div>

        <p className="absolute bottom-12 text-[9px] font-black text-slate-300 uppercase tracking-[0.3em]">Excellence et Innovation</p>
      </div>
    );
  }

  if (loading || isInitializing) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin" />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Initialisation du compte...</p>
        </div>
      </div>
    );
  }

  if (isPublicRegister) {
    return <ClientRegister />;
  }

  if (!user) {
    return <Login />;
  }

  if (!profile && !isInitializing) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-white p-6 text-center font-sans">
        <div className="w-20 h-20 bg-red-50 text-red-600 rounded-3xl flex items-center justify-center mb-8">
           <motion.div 
             animate={{ scale: [1, 1.1, 1] }}
             transition={{ repeat: Infinity, duration: 2 }}
           >
             <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
           </motion.div>
        </div>
        <h1 className="text-3xl font-black text-slate-900 mb-4 uppercase tracking-tighter">Accès non autorisé</h1>
        <p className="text-slate-500 font-medium mb-8 max-w-sm mx-auto">Votre matricule est reconnu mais aucun profil actif n'est associé à ce compte. Contactez le département RH.</p>
        <button 
          onClick={() => window.location.reload()}
          className="px-8 py-4 bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-slate-800 transition-all shadow-lg active:scale-95"
        >
          Réessayer la connexion
        </button>
      </div>
    );
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <Dashboard />;
      case 'users': return <Users />;
      case 'departments': return <Departments />;
      case 'reports': return <Reports />;
      case 'tasks': return <Tasks />;
      case 'chat': return <Chat />;
      case 'settings': return <Settings />;
      case 'resources': return <Resources />;
      case 'archive': return <Archive />;
      case 'attendance': return <Attendance />;
      case 'payroll': return <Payroll />;
      case 'documents': return <Documents />;
      case 'calendar': return <Calendar />;
      case 'ferme': return <DepartmentHub departmentId="01" />;
      case 'santé': return <DepartmentHub departmentId="02" />;
      case 'rh': return <DepartmentHub departmentId="03" />;
      case 'finance': return <DepartmentHub departmentId="04" />;
      case 'logistique': return <DepartmentHub departmentId="05" />;
      case 'marketing': return <DepartmentHub departmentId="06" />;
      // Client Pages
      case 'client-dashboard': return <ClientDashboard />;
      case 'client-agriculture': return <ClientAgriculture />;
      case 'client-health': return <ClientHealth />;
      case 'client-education': return <ClientEducation />;
      case 'client-commerce': return <div className="p-12 text-center text-slate-400 font-bold uppercase tracking-widest">Module Boutique en cours de déploiement...</div>;
      case 'client-logistics': return <div className="p-12 text-center text-slate-400 font-bold uppercase tracking-widest">Module Logistique en cours de déploiement...</div>;
      case 'client-payments': return <div className="p-12 text-center text-slate-400 font-bold uppercase tracking-widest">Module Paiements en cours de déploiement...</div>;
      case 'client-support': return <div className="p-12 text-center text-slate-400 font-bold uppercase tracking-widest">Module Support en cours de déploiement...</div>;
      case 'client-chat': return <Chat />;
      default: return profile?.role === 'CLIENT' ? <ClientDashboard /> : <Dashboard />;
    }
  };

  if (profile?.role === 'CLIENT') {
    return (
      <ClientLayout activePage={currentPage} onPageChange={setCurrentPage}>
        <PasswordChangeModal />
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPage}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="h-full"
          >
            {renderPage()}
          </motion.div>
        </AnimatePresence>
      </ClientLayout>
    );
  }

  return (
    <Layout activePage={currentPage} onPageChange={setCurrentPage}>
      <PasswordChangeModal />
      <AnimatePresence mode="wait">
        <motion.div
          key={currentPage}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="h-full"
        >
          {renderPage()}
        </motion.div>
      </AnimatePresence>
    </Layout>
  );
}
