import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, getDocs, addDoc, updateDoc, doc, orderBy, where, serverTimestamp, limit } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Report, Department, UserProfile } from '../types';
import { FileText, Plus, Search, Filter, CheckCircle, XCircle, Clock, Eye, AlertTriangle, User, ShieldCheck, Printer, Download, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { notificationService } from '../services/notificationService';
import { activityService } from '../services/activityService';
import CommentsSection from '../components/CommentsSection';
import { jsPDF } from 'jspdf';

export default function Reports() {
  const { profile } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewingReport, setViewingReport] = useState<Report | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'validated' | 'rejected'>('all');
  const [deptFilter, setDeptFilter] = useState<string>('all');

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    departmentId: profile?.departmentId || ''
  });

  useEffect(() => {
    fetchData();
  }, [profile]);

  const getStatusDetails = (status: Report['status']) => {
    switch (status) {
      case 'validated':
        return {
          label: 'Validé (DG)',
          className: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400',
          icon: CheckCircle
        };
      case 'rejected':
        return {
          label: 'Rejeté',
          className: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400',
          icon: XCircle
        };
      case 'pending_expert':
        return {
          label: 'En attente - Expert',
          className: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400',
          icon: Clock
        };
      case 'pending_admin':
        return {
          label: 'En attente - Admin',
          className: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400',
          icon: Clock
        };
      case 'pending_dg':
        return {
          label: 'En attente - DG',
          className: 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400',
          icon: Clock
        };
      default:
        return {
          label: 'En attente',
          className: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400',
          icon: Clock
        };
    }
  };

  const canApproveReport = (report: Report | null) => {
    if (!profile || !report) return false;
    
    // 1. Travailleur (USER) -> Expert (SUPER_USER)
    if (report.status === 'pending_expert') {
      return profile.role === 'SUPER_USER' && profile.departmentId === report.departmentId;
    }
    
    // 2. Expert (SUPER_USER) -> Admin (ADMIN)
    if (report.status === 'pending_admin') {
      return profile.role === 'ADMIN' && (profile.departmentId === 'all' || profile.departmentId === report.departmentId);
    }
    
    // 3. Admin (ADMIN) -> DG (SUPER_ADMIN)
    if (report.status === 'pending_dg') {
      return profile.role === 'SUPER_ADMIN';
    }
    
    // Legacy support
    if (report.status === 'pending') {
      return profile.role === 'SUPER_ADMIN' || (profile.role === 'ADMIN' && (profile.departmentId === 'all' || profile.departmentId === report.departmentId));
    }
    
    return false;
  };

  async function fetchData() {
    if (!profile) return;
    setLoading(true);
    try {
      const reportsPath = 'reports';
      let q = query(collection(db, reportsPath), orderBy('createdAt', 'desc'));
      
      // Role based filtering matching the new three-tier workflow
      if (profile.role === 'USER') {
        // Workers only see their own submitted reports
        q = query(collection(db, reportsPath), where('authorId', '==', profile.id), orderBy('createdAt', 'desc'));
      } else if (profile.role === 'SUPER_USER') {
        // Experts see reports in their own department (to approve those from workers) or their own
        q = query(collection(db, reportsPath), where('departmentId', '==', profile.departmentId), orderBy('createdAt', 'desc'));
      } else if (profile.role === 'ADMIN') {
        if (profile.departmentId === 'all') {
          q = query(collection(db, reportsPath), orderBy('createdAt', 'desc'));
        } else {
          q = query(collection(db, reportsPath), where('departmentId', '==', profile.departmentId), orderBy('createdAt', 'desc'));
        }
      } else {
        // DG (SUPER_ADMIN), BOARD_MEMBER see all reports
        q = query(collection(db, reportsPath), orderBy('createdAt', 'desc'));
      }

      const snap = await getDocs(q).catch(err => {
        handleFirestoreError(err, OperationType.LIST, reportsPath);
        return { docs: [] } as any;
      });
      setReports(snap.docs.map(d => ({ id: d.id, ...d.data() } as Report)));

      const deptsPath = 'departments';
      const deptsSnap = await getDocs(collection(db, deptsPath)).catch(err => {
        handleFirestoreError(err, OperationType.LIST, deptsPath);
        return { docs: [] } as any;
      });
      setDepartments(deptsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Department)));

      // Fetch user names for display
      const usersSnap = await getDocs(collection(db, 'users'));
      const userMap: Record<string, string> = {};
      usersSnap.docs.forEach(d => {
        const data = d.data() as UserProfile;
        userMap[d.id] = data.fullName;
      });
      setUsers(userMap);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const handleAutoGenerate = async () => {
    setLoading(true);
    try {
      // Fetch stats
      const tasksSnap = await getDocs(query(collection(db, 'tasks'), orderBy('createdAt', 'desc')));
      const allTasks = tasksSnap.docs.map(doc => doc.data());
      const pendingTasks = allTasks.filter((t: any) => t.status === 'pending');
      const completedTasks = allTasks.filter((t: any) => t.status === 'completed');
      
      const assetsSnap = await getDocs(query(collection(db, 'assets'), orderBy('name')));
      const assets = assetsSnap.docs.map(doc => doc.data());
      const lowStock = assets.filter((a: any) => a.status === 'low' || a.status === 'out_of_stock');

      let autoContent = "SYNTHÈSE EXÉCUTIVE AUTOMATISÉE - RIBERJO GLOBAL SERVICE\n";
      autoContent += `Généré le : ${new Date().toLocaleString()}\n`;
      autoContent += `Département cible : ${profile?.departmentId}\n\n`;
      
      autoContent += "--- INDICATEURS DE PERFORMANCE (KPIs) ---\n";
      autoContent += `- Tâches totales suivies : ${allTasks.length}\n`;
      autoContent += `- Missions en attente : ${pendingTasks.length}\n`;
      autoContent += `- Taux de complétion : ${allTasks.length > 0 ? Math.round((completedTasks.length / allTasks.length) * 100) : 0}%\n`;
      autoContent += `- Alertes stock critiques : ${lowStock.length}\n\n`;

      autoContent += "--- FOCUS SUR LES MISSIONS RÉCENTES ---\n";
      if (allTasks.length > 0) {
        allTasks.slice(0, 5).forEach((t: any) => {
          autoContent += `• [${t.status.toUpperCase()}] ${t.title} - Priorité: ${t.priority}\n`;
        });
      } else {
        autoContent += "Aucune mission active enregistrée.\n";
      }
      
      autoContent += "\n--- ANALYSE LOGISTIQUE (STOCK & INVENTAIRE) ---\n";
      if (lowStock.length > 0) {
        autoContent += "URGENCES DÉTECTÉES :\n";
        lowStock.forEach((s: any) => {
          autoContent += `!! RÉAPPROVISIONNEMENT REQUIS : ${s.name} (${s.quantity} ${s.unit} restant)\n`;
        });
      } else if (assets.length > 0) {
        autoContent += "Niveaux de stock nominaux. Articles principaux :\n";
        assets.slice(0, 3).forEach((s: any) => autoContent += `- ${s.name}: ${s.quantity} ${s.unit}\n`);
      } else {
        autoContent += "Données d'inventaire indisponibles.\n";
      }

      autoContent += "\n--- RECOMMANDATIONS DU SYSTÈME IA ---\n";
      if (pendingTasks.length > 3) {
        autoContent += "1. Une accumulation de tâches en attente est détectée. Prioriser la validation des rapports de fin de missions.\n";
      }
      if (lowStock.length > 0) {
        autoContent += `2. Engager immédiatement une procédure d'achat pour les ${lowStock.length} articles en alerte.\n`;
      }
      autoContent += "3. Maintenir la surveillance rigoureuse des protocoles de sécurité.\n";

      autoContent += "\n--- CONCLUSIONS ET OBSERVATIONS DU RESPONSABLE ---\n";
      autoContent += "[Saisissez vos observations manuelles ici...]";

      setFormData({
        title: `Rapport Analytique - ${new Date().toLocaleDateString()}`,
        content: autoContent,
        departmentId: profile?.departmentId || 'DG'
      });
      setIsModalOpen(true);
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la génération automatique.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const reportsPath = 'reports';
    try {
      let initialStatus: Report['status'] = 'pending_expert';
      if (profile?.role === 'SUPER_USER') {
        initialStatus = 'pending_admin';
      } else if (profile?.role === 'ADMIN') {
        initialStatus = 'pending_dg';
      } else if (profile?.role === 'SUPER_ADMIN' || profile?.role === 'BOARD_MEMBER') {
        initialStatus = 'validated';
      }

      const newReport = {
        ...formData,
        status: initialStatus,
        authorId: profile?.id,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      await addDoc(collection(db, reportsPath), newReport);
      
      await activityService.log({
        type: 'report_created',
        userId: profile?.id || '',
        userName: profile?.fullName || 'Utilisateur',
        details: `A créé le rapport "${newReport.title}" (Statut initial: ${initialStatus})`,
        departmentId: newReport.departmentId
      });

      setIsModalOpen(false);
      setFormData({ title: '', content: '', departmentId: profile?.departmentId || '' });
      fetchData();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, reportsPath);
    }
  };

  const handleStatusChange = async (reportId: string, action: 'approve' | 'reject') => {
    const reportPath = `reports/${reportId}`;
    try {
      const report = reports.find(r => r.id === reportId);
      if (!report) return;

      let nextStatus: Report['status'] = 'pending';
      const currentUserRole = profile?.role;

      if (action === 'reject') {
        nextStatus = 'rejected';
      } else {
        // Approve action: compute next step
        if (report.status === 'pending_expert') {
          nextStatus = 'pending_admin';
        } else if (report.status === 'pending_admin') {
          nextStatus = 'pending_dg';
        } else if (report.status === 'pending_dg') {
          nextStatus = 'validated';
        } else {
          // Fallback or generic pending
          nextStatus = 'validated';
        }
      }

      await updateDoc(doc(db, 'reports', reportId), {
        status: nextStatus,
        validatorId: profile?.id,
        updatedAt: Date.now()
      });

      // Update current displayed modal state if open
      if (viewingReport && viewingReport.id === reportId) {
        setViewingReport({
          ...viewingReport,
          status: nextStatus,
          validatorId: profile?.id,
          updatedAt: Date.now()
        });
      }

      // Notify and log activity
      await notificationService.notifyReportValidation(report.authorId, report.title, nextStatus);
      
      await activityService.log({
        type: nextStatus === 'rejected' ? 'report_rejected' : 'report_validated',
        userId: profile?.id || '',
        userName: profile?.fullName || 'Utilisateur',
        details: `${action === 'approve' ? 'A approuvé et transmis' : 'A rejeté'} le rapport "${report.title}" (Statut: ${nextStatus})`,
        targetId: reportId,
        departmentId: report.departmentId
      });

      // Dispatch targeted tier notifications
      if (action === 'approve') {
        if (nextStatus === 'pending_admin') {
          await notificationService.notifyRole(
            'ADMIN',
            'Rapport visé par Expert',
            `Le rapport "${report.title}" du département ${report.departmentId} a été visé par l'Expert technique et attend votre approbation en tant qu'Admin.`
          );
        } else if (nextStatus === 'pending_dg') {
          await notificationService.notifyRole(
            'SUPER_ADMIN',
            'Rapport soumis à validation DG',
            `Le rapport "${report.title}" du département ${report.departmentId} a été approuvé par l'Admin et attend votre validation finale de Direction (DG).`
          );
        } else if (nextStatus === 'validated') {
          await notificationService.notifyRole(
            'BOARD_MEMBER',
            'Nouveau rapport validé par la Direction',
            `Le rapport "${report.title}" a reçu la validation finale du DG.`
          );
        }
      }

      fetchData();
      setViewingReport(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, reportPath);
    }
  };

  const generatePDF = (report: Report) => {
    const doc = new jsPDF();
    
    // Set properties
    doc.setProperties({
      title: report.title,
      subject: `Rapport de ${report.departmentId}`,
      author: users[report.authorId] || 'RIBERJO'
    });

    // Header Design
    doc.setFontSize(22);
    doc.setTextColor(16, 185, 129); // Emerald-500
    doc.text("RIBERJO GLOBAL SERVICE", 20, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("SOLUTIONS DE SÉCURITÉ ET LOGISTIQUE", 20, 26);
    
    doc.setDrawColor(200);
    doc.line(20, 30, 190, 30);

    // Report Header Info
    doc.setFontSize(16);
    doc.setTextColor(30);
    doc.text(report.title.toUpperCase(), 20, 45);
    
    doc.setFontSize(9);
    doc.setTextColor(80);
    doc.text(`Identifiant: ${report.id}`, 20, 52);
    
    const reportStatusLabel = getStatusDetails(report.status).label.toUpperCase();
    doc.text(`Statut: ${reportStatusLabel}`, 20, 57);
    doc.text(`Département: ${report.departmentId}`, 20, 62);
    
    // Divider
    doc.setDrawColor(230);
    doc.line(20, 67, 190, 67);
    
    // Meta Data Table
    doc.setFont("helvetica", "bold");
    doc.text("Auteur opérationnel:", 20, 77);
    doc.setFont("helvetica", "normal");
    doc.text(users[report.authorId] || 'Utilisateur inconnu', 70, 77);
    
    doc.setFont("helvetica", "bold");
    doc.text("Date de soumission:", 20, 83);
    doc.setFont("helvetica", "normal");
    doc.text(new Date(report.createdAt || Date.now()).toLocaleString(), 70, 83);
    
    if (report.validatorId) {
      doc.setFont("helvetica", "bold");
      doc.text("Validation administrative:", 20, 89);
      doc.setFont("helvetica", "normal");
      doc.text(users[report.validatorId] || 'Administrateur', 70, 89);
      
      doc.setFont("helvetica", "bold");
      doc.text("Date de décision:", 20, 95);
      doc.setFont("helvetica", "normal");
      doc.text(new Date(report.updatedAt || Date.now()).toLocaleString(), 70, 95);
    }
    
    // Content Section
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("SYNTHÈSE ET OBSERVATIONS", 20, 110);
    doc.line(20, 112, 80, 112);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(50);
    
    const splitContent = doc.splitTextToSize(report.content, 170);
    doc.text(splitContent, 20, 120);
    
    // Footer with pagination
    const pageCount = doc.getNumberOfPages();
    for(let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Document officiel généré par le système RIBERJO AI - Page ${i} / ${pageCount}`, 105, 285, { align: 'center' });
    }

    doc.save(`Rapport_${report.title.replace(/\s+/g, '_')}_${report.id.slice(0,5)}.pdf`);
  };

  const filteredReports = reports.filter(r => {
    let statusMatch = false;
    if (statusFilter === 'all') {
      statusMatch = true;
    } else if (statusFilter === 'pending') {
      statusMatch = r.status === 'pending' || r.status === 'pending_expert' || r.status === 'pending_admin' || r.status === 'pending_dg';
    } else {
      statusMatch = r.status === statusFilter;
    }
    const deptMatch = deptFilter === 'all' ? true : r.departmentId === deptFilter;
    return statusMatch && deptMatch;
  });

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Rapports Opérationnels</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Centralisez et validez les rapports d'activité.</p>
        </div>
        <div className="flex items-center gap-3">
          {(profile?.role === 'ADMIN' || profile?.role === 'SUPER_ADMIN') && (
            <button 
              onClick={() => handleAutoGenerate()}
              disabled={loading}
              className="flex items-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-3 rounded-2xl font-bold hover:brightness-110 transition-all shadow-lg"
            >
              <ShieldCheck size={20} />
              Auto-Générer Rapport
            </button>
          )}
          {(profile?.role === 'USER' || profile?.role === 'SUPER_USER' || profile?.role === 'ADMIN') && (
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg"
            >
              <Plus size={20} />
              Créer un rapport
            </button>
          )}
        </div>
      </div>

      {reports.length > 0 && statusFilter === 'all' && (
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1.5 h-6 bg-brand rounded-full"></div>
            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Rapports Récents</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {reports.slice(0, 3).map((report) => (
              <motion.div 
                key={`recent-${report.id}`}
                whileHover={{ y: -4 }}
                onClick={() => setViewingReport(report)}
                className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-none transition-all cursor-pointer group"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className={`p-3 rounded-xl ${
                    report.status === 'validated' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600' :
                    report.status === 'rejected' ? 'bg-red-50 dark:bg-red-500/10 text-red-600' :
                    'bg-amber-50 dark:bg-amber-500/10 text-amber-600'
                  }`}>
                    <FileText size={20} />
                  </div>
                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded">
                    {report.departmentId}
                  </span>
                </div>
                <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-2 line-clamp-1 group-hover:text-brand transition-colors uppercase tracking-tight">{report.title}</h4>
                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium">
                  <Clock size={10} />
                  <span>{new Date(report.createdAt || Date.now()).toLocaleDateString()}</span>
                  <span>•</span>
                  <span>{users[report.authorId]?.split(' ')[0] || 'Inconnu'}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div className="flex flex-wrap items-center gap-3">
          {(['all', 'pending', 'validated', 'rejected'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                statusFilter === s 
                  ? 'bg-slate-900 dark:bg-white dark:text-slate-900 text-white shadow-xl shadow-slate-200 dark:shadow-none' 
                  : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-800'
              }`}
            >
              {s === 'all' ? 'Tous' : s === 'pending' ? 'En attente' : s === 'validated' ? 'Validés' : 'Rejetés'}
            </button>
          ))}
        </div>

        {(profile?.role === 'ADMIN' || profile?.role === 'SUPER_ADMIN') && (
          <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
            <Filter size={14} className="ml-3 text-slate-400" />
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="bg-transparent border-none text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-white focus:ring-0 pr-8 cursor-pointer"
            >
              <option value="all">Tous les Départements</option>
              {departments.map(dept => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredReports.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800">
            <FileText size={48} className="mx-auto text-slate-200 dark:text-slate-800 mb-4" />
            <p className="text-slate-500 dark:text-slate-400 font-medium italic">Aucun rapport ne correspond à ce filtre.</p>
          </div>
        ) : (
          filteredReports.map((report) => (
            <motion.div 
              key={report.id}
              layout
              className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 group hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-4">
                <div className={`p-4 rounded-2xl ${
                  report.status === 'validated' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                  report.status === 'rejected' ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400' :
                  report.status === 'pending_admin' ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' :
                  report.status === 'pending_dg' ? 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400' :
                  'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400'
                }`}>
                  <FileText size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-lg group-hover:text-brand transition-colors uppercase tracking-tight">{report.title}</h3>
                  <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500 mt-1 font-medium">
                    <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded uppercase">{report.departmentId}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1"><Clock size={12} /> {new Date(report.createdAt || Date.now()).toLocaleDateString()}</span>
                    {report.validatorId && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1 text-emerald-600/70 dark:text-emerald-400/70 italic">
                          <ShieldCheck size={12} /> {users[report.validatorId] || 'Validé'}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 ml-auto md:ml-0">
                <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${getStatusDetails(report.status).className}`}>
                   {React.createElement(getStatusDetails(report.status).icon, { size: 12 })}
                   {getStatusDetails(report.status).label}
                </div>

                {/* Quick Actions for Supervisors */}
                {canApproveReport(report) && (
                  <div className="flex items-center gap-2 border-l border-slate-100 dark:border-slate-800 pl-4">
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleStatusChange(report.id, 'approve'); }}
                      className="p-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-500 transition-all shadow-sm"
                      title="Viser/Approuver"
                    >
                      <CheckCircle size={18} />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleStatusChange(report.id, 'reject'); }}
                      className="p-2 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-600 hover:text-white dark:hover:bg-red-500 transition-all shadow-sm"
                      title="Rejeter"
                    >
                      <XCircle size={18} />
                    </button>
                  </div>
                )}

                <button 
                  onClick={(e) => { e.stopPropagation(); generatePDF(report); }}
                  className="p-2 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl transition-all"
                  title="Télécharger PDF"
                >
                  <Download size={20} />
                </button>

                <button 
                  onClick={() => setViewingReport(report)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-400 rounded-xl transition-all"
                >
                  <Eye size={20} />
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Creation Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => setIsModalOpen(false)}
               className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                 <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase">Nouveau Rapport</h2>
                 <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-slate-400"><XCircle size={24} /></button>
              </div>
              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                 <div>
                   <label className="block text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Titre du rapport</label>
                   <input 
                    required
                    type="text" 
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    placeholder="ex: Rapport Hebdomadaire Ferme S14"
                    className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600"
                   />
                 </div>
                 <div>
                   <label className="block text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Contenu du rapport</label>
                   <textarea 
                    required
                    rows={6}
                    value={formData.content}
                    onChange={(e) => setFormData({...formData, content: e.target.value})}
                    placeholder="Détaillez vos observations, données et analyses ici..."
                    className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600"
                   />
                 </div>
                 <div className="flex justify-end gap-3">
                   <button type="submit" className="px-10 py-4 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 shadow-xl shadow-emerald-100 dark:shadow-none">
                     Soumettre le rapport
                   </button>
                 </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Viewing Modal */}
      <AnimatePresence>
        {viewingReport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setViewingReport(null)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"/>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="relative bg-white dark:bg-slate-900 w-full max-w-3xl rounded-[2.5rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
               <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center shrink-0">
                  <div>
                    <span className="text-[10px] font-black text-brand uppercase tracking-[0.2em]">{viewingReport.departmentId}</span>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{viewingReport.title}</h2>
                  </div>
                  <div className="flex items-center gap-3">
                     <div className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] ${getStatusDetails(viewingReport.status).className}`}>
                       {React.createElement(getStatusDetails(viewingReport.status).icon, { size: 14 })}
                       {getStatusDetails(viewingReport.status).label}
                     </div>
                     <button 
                       onClick={() => generatePDF(viewingReport)}
                       className="p-2 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-emerald-600 hover:text-white transition-all rounded-xl shadow-sm"
                       title="Télécharger PDF"
                     >
                       <Download size={24} />
                     </button>
                     <button onClick={() => setViewingReport(null)} className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all text-slate-400"><XCircle size={24} /></button>
                  </div>
               </div>
               <div className="p-8 overflow-y-auto flex-1 h-full scrollbar-hide">
                  <div className="flex flex-col md:flex-row gap-6 mb-8 p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700">
                    <div className="flex-1 space-y-4">
                      <div className="flex items-center gap-3 text-slate-500">
                        <div className="w-8 h-8 bg-white dark:bg-slate-900 rounded-lg flex items-center justify-center text-slate-400 dark:text-slate-500 group-hover:text-brand transition-colors">
                          <User size={16} />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Auteur</p>
                          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{users[viewingReport.authorId] || 'Utilisateur inconnu'}</p>
                        </div>
                      </div>
                      
                      {viewingReport.validatorId && (
                        <div className="flex items-center gap-3 text-slate-500">
                          <div className="w-8 h-8 bg-white dark:bg-slate-900 rounded-lg flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                            <ShieldCheck size={16} />
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Traité par</p>
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{users[viewingReport.validatorId] || 'Responsable'}</p>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="w-px bg-slate-200 dark:bg-slate-700 hidden md:block"></div>
                    
                    <div className="flex-1 space-y-4">
                      <div className="flex items-center gap-3 text-slate-500">
                        <div className="w-8 h-8 bg-white dark:bg-slate-900 rounded-lg flex items-center justify-center text-slate-400 dark:text-slate-500">
                          <Clock size={16} />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Date de soumission</p>
                          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{new Date(viewingReport.createdAt || Date.now()).toLocaleString()}</p>
                        </div>
                      </div>
 
                      {viewingReport.validatorId && (
                        <div className="flex items-center gap-3 text-slate-500">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${getStatusDetails(viewingReport.status).className}`}>
                            {React.createElement(getStatusDetails(viewingReport.status).icon, { size: 16 })}
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Dernière décision</p>
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{new Date(viewingReport.updatedAt || Date.now()).toLocaleString()}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
 
                  <div className="prose prose-slate dark:prose-invert max-w-none px-2">
                    <p className="whitespace-pre-wrap text-slate-600 dark:text-slate-400 leading-relaxed font-medium">{viewingReport.content}</p>
                  </div>
 
                  <CommentsSection parentId={viewingReport.id} parentType="reports" />
               </div>
               {canApproveReport(viewingReport) && (
                 <div className="p-8 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-4 bg-slate-50/50 dark:bg-slate-800/50 shrink-0">
                    <button 
                      onClick={() => handleStatusChange(viewingReport.id, 'reject')}
                      className="flex-1 py-4 bg-white dark:bg-slate-900 border border-red-100 dark:border-red-900/30 text-red-600 font-bold rounded-2xl hover:bg-red-50 dark:hover:bg-red-500/10 transition-all flex items-center justify-center gap-2"
                    >
                      <XCircle size={20} /> Rejeter
                    </button>
                    <button 
                       onClick={() => handleStatusChange(viewingReport.id, 'approve')}
                       className="flex-1 py-4 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 shadow-xl shadow-emerald-100 dark:shadow-none transition-all flex items-center justify-center gap-2"
                    >
                      <CheckCircle size={20} /> {viewingReport.status === 'pending_dg' ? 'Valider (Décision finale DG)' : 'Approuver & Transmettre'}
                    </button>
                 </div>
               )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
