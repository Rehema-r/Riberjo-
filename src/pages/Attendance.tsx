import React, { useState, useEffect, useRef } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, getDocs, limit, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Attendance } from '../types';
import { Clock, MapPin, Calendar as CalendarIcon, Filter, CheckCircle2, XCircle, AlertCircle, TrendingUp, History, QrCode, ClipboardList, Check, X, Search, UserCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { notificationService } from '../services/notificationService';

type TabType = 'my' | 'admin' | 'scanner';

export default function AttendancePage() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('my');
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [adminAttendance, setAdminAttendance] = useState<Attendance[]>([]);
  const [todayRecord, setTodayRecord] = useState<Attendance | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'late' | 'absent'>('all');
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  const isHR = profile?.role === 'SUPER_ADMIN' || profile?.role === 'BOARD_MEMBER' || profile?.departmentId === 'all' || profile?.departmentId === '03';

  useEffect(() => {
    if (!profile) return;

    // Fetch personal history
    const qSelf = query(
      collection(db, 'attendance'),
      where('userId', '==', profile.matricule),
      orderBy('date', 'desc'),
      limit(30)
    );

    const unsubscribeSelf = onSnapshot(qSelf, 
      (snapshot) => {
        const records = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Attendance));
        setAttendance(records);
        
        const today = new Date().toISOString().split('T')[0];
        const todayRec = records.find(r => r.date === today);
        setTodayRecord(todayRec || null);
        setIsLoading(false);
      },
      (error) => {
        console.warn("Attendance self onSnapshot operates in local cache mode:", error.message);
        setIsLoading(false);
      }
    );

    // Fetch admin history if HR
    let unsubscribeAdmin = () => {};
    if (isHR) {
      const qAdmin = query(
        collection(db, 'attendance'),
        orderBy('date', 'desc'),
        limit(100)
      );

      unsubscribeAdmin = onSnapshot(qAdmin, 
        (snapshot) => {
          const records = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Attendance));
          setAdminAttendance(records);
        },
        (error) => {
          console.warn("Attendance admin onSnapshot operates in local cache mode:", error.message);
        }
      );
    }

    return () => {
      unsubscribeSelf();
      unsubscribeAdmin();
    };
  }, [profile, isHR]);

  // Handle QR Scanner
  useEffect(() => {
    if (activeTab === 'scanner') {
      const timer = setTimeout(() => {
        const element = document.getElementById('qr-reader');
        if (!element) return;

        const scanner = new Html5QrcodeScanner(
          "qr-reader",
          { fps: 10, qrbox: { width: 250, height: 250 } },
          /* verbose= */ false
        );
        scannerRef.current = scanner;

        scanner.render(async (decodedText) => {
          // Expected format: RIBERJO:MATRICULE
          if (decodedText.startsWith('RIBERJO:')) {
            const matricule = decodedText.split(':')[1];
            setScanResult(matricule);
            await processExternalClock(matricule);
            try {
              await scanner.clear();
            } catch (e) {
              console.warn("Scanner clear failed", e);
            }
            setActiveTab('my');
          }
        }, (error) => {
          // Silence errors as they happen constantly during search
        });
      }, 100);

      return () => clearTimeout(timer);
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(e => console.warn("Scanner cleanup failed", e));
        scannerRef.current = null;
      }
    };
  }, [activeTab]);

  const processExternalClock = async (matricule: string) => {
    try {
      // Find user by matricule to get name and dept
      const userQ = query(collection(db, 'users'), where('matricule', '==', matricule));
      const userSnap = await getDocs(userQ);
      
      if (userSnap.empty) {
        alert("Utilisateur non trouvé.");
        return;
      }

      const userData = userSnap.docs[0].data();
      const now = new Date();
      const time = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      const date = now.toISOString().split('T')[0];
      
      // Check if already clocked in today
      const todayQ = query(collection(db, 'attendance'), where('userId', '==', matricule), where('date', '==', date));
      const todaySnap = await getDocs(todayQ);

      if (todaySnap.empty) {
        const isLate = now.getHours() > 8 || (now.getHours() === 8 && now.getMinutes() > 30);
        await addDoc(collection(db, 'attendance'), {
          userId: matricule,
          userName: userData.fullName,
          date,
          clockIn: time,
          status: isLate ? 'late' : 'present',
          approvalStatus: isLate ? 'pending' : 'approved',
          departmentId: userData.departmentId,
          createdAt: Date.now()
        });
        alert(`Arrivée enregistrée pour ${userData.fullName}`);
      } else {
        const docId = todaySnap.docs[0].id;
        const currentData = todaySnap.docs[0].data();
        if (!currentData.clockOut) {
          await updateDoc(doc(db, 'attendance', docId), {
            clockOut: time,
            updatedAt: Date.now()
          });
          alert(`Départ enregistré pour ${userData.fullName}`);
        } else {
          alert(`${userData.fullName} a déjà terminé sa journée.`);
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'attendance');
    }
  };

  const handleClockIn = async () => {
    if (!profile) return;
    try {
      const now = new Date();
      const time = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      const date = now.toISOString().split('T')[0];
      const isLate = now.getHours() > 8 || (now.getHours() === 8 && now.getMinutes() > 30);

      await addDoc(collection(db, 'attendance'), {
        userId: profile.matricule,
        userName: profile.fullName,
        date,
        clockIn: time,
        status: isLate ? 'late' : 'present',
        approvalStatus: isLate ? 'pending' : 'approved',
        departmentId: profile.departmentId,
        createdAt: Date.now()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'attendance');
    }
  };

  const handleClockOut = async () => {
    if (!todayRecord) return;
    try {
      const now = new Date();
      const time = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      
      await updateDoc(doc(db, 'attendance', todayRecord.id), {
        clockOut: time,
        updatedAt: Date.now()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'attendance');
    }
  };

  const handleApproval = async (id: string, approved: boolean) => {
    if (profile?.role === 'BOARD_MEMBER') {
       alert("Le Conseil d'Administration ne dispose que de droits d'accès en lecture seule.");
       return;
    }
    try {
      await updateDoc(doc(db, 'attendance', id), {
        approvalStatus: approved ? 'approved' : 'rejected',
        approvedBy: profile?.matricule,
        updatedAt: Date.now()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'attendance');
    }
  };

  const filteredAdminAttendance = adminAttendance.filter(a => {
    const matchesSearch = (a.userName || '').toLowerCase().includes((searchTerm || '').toLowerCase()) || (a.userId || '').toLowerCase().includes((searchTerm || '').toLowerCase());
    const matchesFilter = statusFilter === 'all' || a.status === statusFilter;
    return matchesSearch && matchesFilter;
  });

  const adminStats = {
    late: adminAttendance.filter(a => a.status === 'late' && a.date === new Date().toISOString().split('T')[0]).length,
    absent: adminAttendance.filter(a => a.status === 'absent' && a.date === new Date().toISOString().split('T')[0]).length,
    pending: adminAttendance.filter(a => a.approvalStatus === 'pending').length
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Présences</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Pointage QR et gestion des retards.</p>
        </div>
        <div className="flex items-center gap-2">
           <div className="bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-100 dark:border-slate-800 flex gap-1">
              <button 
                onClick={() => setActiveTab('my')}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'my' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-emerald-600'}`}
              >
                Mon Pointage
              </button>
              {isHR && (
                <button 
                  onClick={() => setActiveTab('admin')}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'admin' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-blue-600'}`}
                >
                  Gestion RH
                </button>
              )}
              <button 
                onClick={() => setActiveTab('scanner')}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'scanner' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-900'}`}
              >
                Scanner QR
              </button>
           </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'scanner' ? (
          <motion.div 
            key="scanner"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="max-w-2xl mx-auto"
          >
            <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border-4 border-slate-900 shadow-2xl relative overflow-hidden">
               <div className="relative z-10">
                 <div className="flex items-center justify-between mb-8">
                   <div>
                     <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Scanner de Badge</h2>
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Placez le QR code devant la caméra</p>
                   </div>
                   <button onClick={() => setActiveTab('my')} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl"><X size={20} /></button>
                 </div>
                 
                 <div id="qr-reader" className="w-full rounded-2xl overflow-hidden border-4 border-slate-50 dark:border-slate-800" />
                 
                 <div className="mt-8 flex items-center gap-4 p-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl text-emerald-600">
                    <AlertCircle size={20} />
                    <p className="text-xs font-bold leading-relaxed">Le QR code est disponible sur votre carte de service. Le pointage est instantané.</p>
                 </div>
               </div>
               
               <div className="absolute -top-24 -right-24 opacity-5 pointer-events-none">
                 <QrCode size={300} />
               </div>
            </div>
          </motion.div>
        ) : activeTab === 'admin' ? (
          <motion.div 
            key="admin"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="space-y-6"
          >
            {/* HR stats summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Retards Aujourd'hui</p>
                  <p className="text-2xl font-black text-yellow-600 tracking-tight">{adminStats.late}</p>
                </div>
                <div className="w-12 h-12 bg-yellow-50 rounded-2xl flex items-center justify-center text-yellow-600">
                  <AlertCircle size={24} />
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Absences Aujourd'hui</p>
                  <p className="text-2xl font-black text-red-600 tracking-tight">{adminStats.absent}</p>
                </div>
                <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center text-red-600">
                  <XCircle size={24} />
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">En attente de validation</p>
                  <p className="text-2xl font-black text-blue-600 tracking-tight">{adminStats.pending}</p>
                </div>
                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                  <UserCheck size={24} />
                </div>
              </div>
            </div>

            {/* Admin Controls */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text"
                  placeholder="Rechercher par matricule ou nom..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10"
                />
              </div>
              <div className="flex gap-2">
                 {['all', 'late', 'absent'].map((f) => (
                   <button 
                    key={f}
                    onClick={() => setStatusFilter(f as any)}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${statusFilter === f ? 'bg-slate-900 text-white' : 'bg-white dark:bg-slate-900 text-slate-400 border border-slate-100 dark:border-slate-800'}`}
                   >
                     {f === 'all' ? 'Tous' : f === 'late' ? 'Retards' : 'Absences'}
                   </button>
                 ))}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-50 dark:border-slate-800">
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Employé</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Statut / Date</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Heures</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Validation HR</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  {filteredAdminAttendance.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-8 py-5">
                        <p className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">{row.userName}</p>
                        <p className="text-[10px] font-mono text-slate-400">{row.userId}</p>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex flex-col">
                           <span className={`inline-flex w-fit px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest mb-1 ${
                             row.status === 'present' ? 'bg-emerald-50 text-emerald-600' :
                             row.status === 'late' ? 'bg-yellow-50 text-yellow-600' : 'bg-red-50 text-red-600'
                           }`}>
                             {row.status}
                           </span>
                           <span className="text-[10px] font-bold text-slate-500">{new Date(row.date).toLocaleDateString('fr-FR')}</span>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="text-xs font-mono font-black text-slate-600 dark:text-slate-400">
                           {row.clockIn || '--:--'} - {row.clockOut || '--:--'}
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                          row.approvalStatus === 'approved' ? 'bg-emerald-50 text-emerald-600' :
                          row.approvalStatus === 'rejected' ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-400'
                        }`}>
                          {row.approvalStatus || 'pending'}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-right">
                        {profile?.role !== 'BOARD_MEMBER' && (
                          <div className="flex justify-end gap-2">
                             <button 
                              onClick={() => handleApproval(row.id, true)}
                              className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors"
                             >
                               <Check size={16} />
                             </button>
                             <button 
                              onClick={() => handleApproval(row.id, false)}
                              className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                             >
                               <X size={16} />
                             </button>
                          </div>
                        )}
                        {profile?.role === 'BOARD_MEMBER' && (
                          <span className="text-xs text-slate-400 italic font-medium">Lecture seule</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="my"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          >
            {/* Clocking Section (Copied from original) */}
            <motion.div 
              className="lg:col-span-1 bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 relative overflow-hidden"
            >
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 rounded-2xl flex items-center justify-center">
                    <Clock size={24} />
                  </div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Mon Pointage</h2>
                </div>

                <div className="text-center mb-10">
                  <p className="text-4xl font-black text-slate-900 dark:text-white mb-2 tracking-tighter">
                    {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Heure locale actuelle</p>
                </div>

                <div className="space-y-4">
                  {!todayRecord ? (
                    <button 
                      onClick={handleClockIn}
                      className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm rounded-3xl shadow-xl shadow-emerald-900/20 transition-all active:scale-95 uppercase tracking-widest"
                    >
                      Pointer Arrivée
                    </button>
                  ) : !todayRecord.clockOut ? (
                    <button 
                      onClick={handleClockOut}
                      className="w-full py-5 bg-red-600 hover:bg-red-500 text-white font-black text-sm rounded-3xl shadow-xl shadow-red-900/20 transition-all active:scale-95 uppercase tracking-widest"
                    >
                      Pointer Départ
                    </button>
                  ) : (
                    <div className="w-full py-5 bg-slate-100 dark:bg-slate-800 text-slate-400 font-black text-sm rounded-3xl text-center uppercase tracking-widest border border-dashed border-slate-200 dark:border-slate-700">
                      Journée Terminée
                    </div>
                  )}

                  {todayRecord && (
                    <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 space-y-3">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-400 uppercase tracking-widest">Statut</span>
                        <span className={`font-black uppercase tracking-widest px-2 py-1 rounded-lg ${
                          todayRecord.status === 'present' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10' : 
                          todayRecord.status === 'late' ? 'bg-yellow-50 text-yellow-600 dark:bg-yellow-500/10' : 
                          'bg-red-50 text-red-600 dark:bg-red-500/10'
                        }`}>
                          {todayRecord.status}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-400 uppercase tracking-widest">Approbation RH</span>
                        <span className={`px-2 py-1 rounded-lg font-black uppercase tracking-widest ${
                          todayRecord.approvalStatus === 'approved' ? 'bg-emerald-50 text-emerald-600' :
                          todayRecord.approvalStatus === 'rejected' ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-400'
                        }`}>
                          {todayRecord.approvalStatus || 'pending'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>

            {/* History Section */}
            <div className="lg:col-span-2 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History size={20} className="text-slate-400" />
                  <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">Mes 30 derniers jours</h2>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-50 dark:border-slate-800">
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Horaires</th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                    {attendance.map((row) => (
                      <tr key={row.id}>
                        <td className="px-8 py-5 text-sm font-bold">{new Date(row.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</td>
                        <td className="px-8 py-5 font-mono text-xs font-black">{row.clockIn} - {row.clockOut || '--'}</td>
                        <td className="px-8 py-5 text-center">
                           <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                             row.status === 'present' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                           }`}>
                             {row.status}
                           </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


// Icons for the table specifically
function LogIn({ size, className }: { size: number, className: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <polyline points="10 17 15 12 10 7" />
      <line x1="15" y1="12" x2="3" y2="12" />
    </svg>
  );
}

function LogOut({ size, className }: { size: number, className: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
