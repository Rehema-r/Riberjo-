import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, getDocs, addDoc, updateDoc, doc, orderBy, where, serverTimestamp, limit } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Report, Department, UserProfile } from '../types';
import { 
  FileText, 
  Plus, 
  Search, 
  Filter, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Eye, 
  AlertTriangle, 
  User, 
  ShieldCheck, 
  Printer, 
  Download, 
  MessageSquare,
  Share2,
  Calendar,
  Sparkles,
  TrendingUp,
  FileSpreadsheet,
  Check,
  Building
} from 'lucide-react';
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
  const [copiedId, setCopiedId] = useState<string | null>(null);

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

  // Get Current Week Number
  const getWeekNumber = (d: Date = new Date()) => {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return weekNo;
  };

  const handleGenerateWeeklyReport = async () => {
    setLoading(true);
    try {
      const weekNum = getWeekNumber();
      const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

      // 1. Tasks
      const tasksSnap = await getDocs(query(collection(db, 'tasks'), orderBy('createdAt', 'desc')));
      const allTasks = tasksSnap.docs.map(doc => doc.data());
      const weekTasks = allTasks.filter((t: any) => (t.createdAt || 0) >= oneWeekAgo);
      const completedTasks = allTasks.filter((t: any) => t.status === 'completed');
      const pendingTasks = allTasks.filter((t: any) => t.status === 'pending' || t.status === 'in_progress');
      
      // 2. Inventory / Stock
      const assetsSnap = await getDocs(query(collection(db, 'assets'), orderBy('name')));
      const assets = assetsSnap.docs.map(doc => doc.data());
      const lowStock = assets.filter((a: any) => a.status === 'low' || a.status === 'out_of_stock');

      // 3. Transactions / Finances
      const transSnap = await getDocs(collection(db, 'financeTransactions')).catch(() => ({ docs: [] } as any));
      const trans = transSnap.docs.map((d: any) => d.data());
      const totalIncome = trans.filter((t: any) => t.type === 'income').reduce((acc: number, t: any) => acc + (Number(t.amount) || 0), 0);
      const totalExpense = trans.filter((t: any) => t.type === 'expense').reduce((acc: number, t: any) => acc + (Number(t.amount) || 0), 0);

      // Construct Structured Weekly Synthesis
      let weeklyContent = `========================================================================\n`;
      weeklyContent += `RAPPORT HEBDOMADAIRE D'ACTIVITÉ & SYNTHÈSE EXÉCUTIVE\n`;
      weeklyContent += `RIBERJO GLOBAL SERVICE S.A.R.L - DIRECTION GÉNÉRALE\n`;
      weeklyContent += `Semaine N° ${weekNum} | Période du ${new Date(oneWeekAgo).toLocaleDateString('fr-FR')} au ${new Date().toLocaleDateString('fr-FR')}\n`;
      weeklyContent += `========================================================================\n\n`;

      weeklyContent += `1. SYNTHÈSE GLOBALE DES PERFORMANCES\n`;
      weeklyContent += `------------------------------------------------------------------------\n`;
      weeklyContent += `• Missions suivies cette semaine : ${allTasks.length} missions enregistrées au système.\n`;
      weeklyContent += `• Missions achevées / clôturées : ${completedTasks.length} (${allTasks.length > 0 ? Math.round((completedTasks.length / allTasks.length) * 100) : 0}% du total).\n`;
      weeklyContent += `• Missions en cours / en attente : ${pendingTasks.length} opérations actives.\n`;
      weeklyContent += `• Trésorerie & Recettes (si applicable) : Recettes $${totalIncome.toLocaleString()} | Dépenses $${totalExpense.toLocaleString()}.\n`;
      weeklyContent += `• État de la flotte et stocks : ${assets.length} articles répertoriés, ${lowStock.length} alertes de réapprovisionnement.\n\n`;

      weeklyContent += `2. FAITS MARQUANTS & ACTIONS PAR DÉPARTEMENT\n`;
      weeklyContent += `------------------------------------------------------------------------\n`;
      weeklyContent += `[01] Direction Générale & Coordination : Suivi stratégique des filiales et validation des protocoles.\n`;
      weeklyContent += `[02] Agro-Pastorale & Ferme : Production agricole, soins vétérinaires et approvisionnement des dépôts.\n`;
      weeklyContent += `[03] Santé & Soins Médicaux : Consultations cliniques, dispensation de médicaments et suivis préventifs.\n`;
      weeklyContent += `[04] Finance & Comptabilité : Suivi des flux de caisse, réconciliation des paiements M-Pesa/Mobile Money.\n`;
      weeklyContent += `[05] Logistique & Flotte : Gestion du charroi automobile, maintenance préventive et contrôle de stock.\n`;
      weeklyContent += `[06] Marketing & Ventes : Facturation client, prospection partenaires et commandes livrées.\n`;
      weeklyContent += `[07] Éducation & Écoles : Inscriptions, suivi des cours, perception du minerval et tenue des bulletins.\n\n`;

      weeklyContent += `3. ANALYSE CRITIQUE & GESTION DES RISQUES\n`;
      weeklyContent += `------------------------------------------------------------------------\n`;
      if (lowStock.length > 0) {
        weeklyContent += `ALERTE MATÉRIEL & INVENTAIRE :\n`;
        lowStock.forEach((s: any) => {
          weeklyContent += `  * [CRITIQUE] Article "${s.name}" : seuil critique atteint (${s.quantity || 0} ${s.unit || 'unités'} restantes).\n`;
        });
      } else {
        weeklyContent += `• Aucun incident logistique majeur n'a été répertorié au cours de la semaine écoulée.\n`;
      }
      if (pendingTasks.length > 5) {
        weeklyContent += `• Attention : ${pendingTasks.length} missions nécessitent une accélération opérationnelle.\n`;
      }

      weeklyContent += `\n4. RECOMMANDATIONS & ORIENTATIONS POUR LA SEMAINE PROCHAINE (S${weekNum + 1})\n`;
      weeklyContent += `------------------------------------------------------------------------\n`;
      weeklyContent += `1. Consolider la traçabilité des opérations de terrain via les rapports quotidiens d'experts.\n`;
      weeklyContent += `2. Valider le plan de réapprovisionnement pour les articles logistiques sous le seuil minimum.\n`;
      weeklyContent += `3. Poursuivre le déploiement du portail client et les encaissements dématérialisés.\n`;
      weeklyContent += `4. Tenir la réunion de coordination hebdomadaire avec tous les chefs de départements.\n\n`;

      weeklyContent += `5. OBSERVATIONS SPÉCIFIQUES DU RÉDACTEUR\n`;
      weeklyContent += `------------------------------------------------------------------------\n`;
      weeklyContent += `Rapport rédigé et certifié conforme par : ${profile?.fullName || 'Direction Opérationnelle'}\n`;
      weeklyContent += `Mention : Prêt pour visa et diffusion externe aux partenaires et auditeurs.`;

      setFormData({
        title: `Rapport Hebdomadaire S${weekNum} - ${new Date().toLocaleDateString('fr-FR')}`,
        content: weeklyContent,
        departmentId: profile?.departmentId || 'DG'
      });
      setIsModalOpen(true);
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la génération du rapport hebdomadaire.");
    } finally {
      setLoading(false);
    }
  };

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

  /**
   * Generates a high-grade executive PDF document formatted for external sharing
   */
  const generatePDF = (report: Report) => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      const authorName = users[report.authorId] || profile?.fullName || 'Direction RIBERJO';
      const validatorName = report.validatorId ? (users[report.validatorId] || 'Directeur Général') : 'En cours de validation';
      const creationDate = new Date(report.createdAt || Date.now()).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      // Document Properties
      doc.setProperties({
        title: report.title,
        subject: `Rapport Officiel RIBERJO - ${report.departmentId}`,
        author: authorName,
        creator: 'RIBERJO GLOBAL SERVICE ERP'
      });

      // 1. Top Decorative Brand Banner
      doc.setFillColor(15, 23, 42); // Slate 900
      doc.rect(0, 0, 210, 18, 'F');
      
      doc.setFillColor(5, 150, 105); // Emerald 600
      doc.rect(0, 18, 210, 3, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(255, 255, 255);
      doc.text("RIBERJO GLOBAL SERVICE S.A.R.L • DOCUMENT OFFICIEL DE SYNTHÈSE", 15, 12);
      doc.text("CONFIDENTIEL / PARTAGE EXTERNE AUTORISÉ", 195, 12, { align: 'right' });

      // 2. Company Header
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(5, 150, 105); // Emerald
      doc.text("RIBERJO GLOBAL SERVICE", 15, 34);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139); // Slate 500
      doc.text("Multi-Services : Agro-Pastorale | Clinique & Santé | Éducation | Logistique & Commerce", 15, 40);
      doc.text("RDC - Lubumbashi / Kinshasa • Email: contact@riberjoglobal.com • www.riberjoglobal.com", 15, 45);

      // Header Separator
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(15, 49, 195, 49);

      // 3. Report Title & Reference Box
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(15, 53, 180, 24, 3, 3, 'F');
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(15, 53, 180, 24, 3, 3, 'D');

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(report.title.toUpperCase(), 20, 62);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(`Réf. Doc: RBJ-RPT-${report.id.slice(0, 8).toUpperCase()}   |   Département: ${report.departmentId}   |   Émis le: ${creationDate}`, 20, 71);

      // Status Pill
      const statusText = getStatusDetails(report.status).label.toUpperCase();
      doc.setFillColor(report.status === 'validated' ? 220 : 254, report.status === 'validated' ? 252 : 243, report.status === 'validated' ? 231 : 199);
      doc.roundedRect(150, 58, 40, 7, 2, 2, 'F');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(report.status === 'validated' ? 4 : 180, report.status === 'validated' ? 120 : 83, report.status === 'validated' ? 87 : 9);
      doc.text(statusText, 170, 63, { align: 'center' });

      // 4. Meta Information Grid
      doc.setFontSize(9);
      doc.setTextColor(51, 65, 85);

      doc.setFont('helvetica', 'bold');
      doc.text("Rédacteur / Responsable :", 15, 85);
      doc.setFont('helvetica', 'normal');
      doc.text(authorName, 65, 85);

      doc.setFont('helvetica', 'bold');
      doc.text("Validation administrative :", 110, 85);
      doc.setFont('helvetica', 'normal');
      doc.text(validatorName, 155, 85);

      doc.setFont('helvetica', 'bold');
      doc.text("Période / Fréquence :", 15, 91);
      doc.setFont('helvetica', 'normal');
      doc.text(report.title.toLowerCase().includes('hebdo') ? "Synthèse Hebdomadaire" : "Rapport Périodique", 65, 91);

      doc.setFont('helvetica', 'bold');
      doc.text("Audit d'intégrité :", 110, 91);
      doc.setFont('helvetica', 'normal');
      doc.text("Conforme aux normes RIBERJO ERP v2.4", 155, 91);

      doc.setDrawColor(226, 232, 240);
      doc.line(15, 96, 195, 96);

      // 5. Report Content (Synthesized text with auto page breaks)
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(5, 150, 105);
      doc.text("CORPS DU RAPPORT ET OBSERVATIONS OPÉRATIONNELLES", 15, 103);

      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 41, 59);

      let cursorY = 110;
      const splitContent = doc.splitTextToSize(report.content, 180);

      for (let i = 0; i < splitContent.length; i++) {
        // If cursor reaches near bottom of page, create a new page
        if (cursorY > 260) {
          doc.addPage();
          
          // Mini top header for secondary pages
          doc.setFillColor(15, 23, 42);
          doc.rect(0, 0, 210, 12, 'F');
          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(255, 255, 255);
          doc.text(`RIBERJO GLOBAL SERVICE • ${report.title.toUpperCase()} (Suite)`, 15, 8);
          
          cursorY = 25;
        }

        const line = splitContent[i];
        
        // Highlight section titles if they start with numbers, dashes, or capital headers
        if (line.startsWith('---') || line.startsWith('===') || line.match(/^[0-9]\./)) {
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(5, 150, 105);
          cursorY += 2;
        } else if (line.startsWith('•') || line.startsWith('*') || line.startsWith('-')) {
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(51, 65, 85);
        } else {
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(30, 41, 59);
        }

        doc.text(line, 15, cursorY);
        cursorY += 5.2;
      }

      // 6. Signatures and Official Stamp Block
      if (cursorY > 230) {
        doc.addPage();
        cursorY = 30;
      } else {
        cursorY += 10;
      }

      doc.setDrawColor(203, 213, 225);
      doc.line(15, cursorY, 195, cursorY);
      cursorY += 8;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text("VISA DU CHEF DE DÉPARTEMENT", 25, cursorY);
      doc.text("VALIDATION DIRECTION GÉNÉRALE (DG)", 120, cursorY);

      cursorY += 5;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(`Signé électroniquement par : ${authorName}`, 25, cursorY);
      doc.text(`Approbation finale : ${validatorName}`, 120, cursorY);

      // Signature Boxes
      cursorY += 3;
      doc.setDrawColor(226, 232, 240);
      doc.rect(20, cursorY, 70, 22);
      doc.rect(115, cursorY, 70, 22);

      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text("[ Cachet & Signature Électronique ]", 55, cursorY + 12, { align: 'center' });
      doc.text("[ Sceau Officiel RIBERJO ]", 150, cursorY + 12, { align: 'center' });

      // 7. Footers for all pages
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setDrawColor(226, 232, 240);
        doc.line(15, 282, 195, 282);
        
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(148, 163, 184);
        doc.text("RIBERJO GLOBAL SERVICE S.A.R.L • Système Intégré de Gestion ERP v2.4 • Tous droits réservés", 15, 288);
        doc.text(`Page ${i} sur ${pageCount}`, 195, 288, { align: 'right' });
      }

      // Safe filename
      const cleanTitle = report.title
        .replace(/[^a-zA-Z0-9_\-]/g, '_')
        .substring(0, 35);
      const filename = `Rapport_RIBERJO_${cleanTitle}_${new Date().toISOString().slice(0, 10)}.pdf`;
      
      doc.save(filename);
    } catch (err) {
      console.error("Erreur génération PDF:", err);
      alert("Une erreur est survenue lors de l'exportation du fichier PDF.");
    }
  };

  const handleShareExternal = async (report: Report) => {
    generatePDF(report);
    
    // Copy reference link or notification
    const reportRef = `Rapport Officiel RIBERJO: "${report.title}" (Réf: ${report.id.slice(0, 8).toUpperCase()})`;
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(reportRef);
      setCopiedId(report.id);
      setTimeout(() => setCopiedId(null), 3000);
    }
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
    <div className="max-w-7xl mx-auto space-y-8 pb-16">
      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
              <Sparkles size={12} /> Module de Synthèse & Rapports
            </span>
            <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg text-[10px] font-black uppercase tracking-widest">
              Semaine {getWeekNumber()}
            </span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Rapports & Partage Externe</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Centralisez, validez et exportez les rapports hebdomadaires certifiés en PDF.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Quick Weekly Report PDF Generator */}
          <button 
            onClick={handleGenerateWeeklyReport}
            disabled={loading}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white px-6 py-3.5 rounded-2xl font-bold transition-all shadow-lg shadow-emerald-600/20 text-xs uppercase tracking-wider"
            title="Générer et compiler le rapport hebdomadaire complet"
          >
            <Calendar size={18} />
            <span>Rapport Hebdo S{getWeekNumber()}</span>
          </button>

          {(profile?.role === 'ADMIN' || profile?.role === 'SUPER_ADMIN' || profile?.role === 'BOARD_MEMBER') && (
            <button 
              onClick={() => handleAutoGenerate()}
              disabled={loading}
              className="flex items-center justify-center gap-2 bg-slate-900 dark:bg-slate-800 text-white px-5 py-3.5 rounded-2xl font-bold hover:bg-slate-800 dark:hover:bg-slate-700 transition-all text-xs uppercase tracking-wider shadow-sm"
            >
              <ShieldCheck size={18} />
              <span>Auto-Générer</span>
            </button>
          )}

          {(profile?.role === 'USER' || profile?.role === 'SUPER_USER' || profile?.role === 'ADMIN') && (
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white px-5 py-3.5 rounded-2xl font-bold transition-all text-xs uppercase tracking-wider"
            >
              <Plus size={18} />
              <span>Créer</span>
            </button>
          )}
        </div>
      </div>

      {/* Quick Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <FileText size={22} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Rapports</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white">{reports.length}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
            <CheckCircle size={22} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Validés (DG)</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white">
              {reports.filter(r => r.status === 'validated').length}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl">
            <Clock size={22} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">En Circuit Visa</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white">
              {reports.filter(r => r.status.startsWith('pending')).length}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl">
            <Download size={22} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Export PDF Externe</p>
            <p className="text-xs font-bold text-purple-600 dark:text-purple-400 mt-1">Prêt pour diffusion</p>
          </div>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {(['all', 'pending', 'validated', 'rejected'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                statusFilter === s 
                  ? 'bg-slate-900 dark:bg-white dark:text-slate-900 text-white shadow-md' 
                  : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-800'
              }`}
            >
              {s === 'all' ? 'Tous les rapports' : s === 'pending' ? 'En attente' : s === 'validated' ? 'Validés' : 'Rejetés'}
            </button>
          ))}
        </div>

        {(profile?.role === 'ADMIN' || profile?.role === 'SUPER_ADMIN' || profile?.role === 'BOARD_MEMBER') && (
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

      {/* Reports Feed */}
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
              className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 group hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-4 flex-1">
                <div className={`p-4 rounded-2xl shrink-0 ${
                  report.status === 'validated' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                  report.status === 'rejected' ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400' :
                  report.status === 'pending_admin' ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' :
                  report.status === 'pending_dg' ? 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400' :
                  'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400'
                }`}>
                  <FileText size={26} />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-black uppercase px-2 py-0.5 rounded">
                      {report.departmentId}
                    </span>
                    {report.title.toLowerCase().includes('hebdo') && (
                      <span className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-[9px] font-black uppercase px-2 py-0.5 rounded">
                        Hebdomadaire
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-lg group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors uppercase tracking-tight">
                    {report.title}
                  </h3>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 dark:text-slate-500 font-medium">
                    <span className="flex items-center gap-1"><User size={12} /> {users[report.authorId] || 'Auteur inconnu'}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1"><Clock size={12} /> {new Date(report.createdAt || Date.now()).toLocaleDateString('fr-FR')}</span>
                    {report.validatorId && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 italic">
                          <ShieldCheck size={12} /> Validé par {users[report.validatorId] || 'DG'}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Status & Actions */}
              <div className="flex flex-wrap items-center gap-3 ml-auto md:ml-0">
                <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${getStatusDetails(report.status).className}`}>
                   {React.createElement(getStatusDetails(report.status).icon, { size: 12 })}
                   {getStatusDetails(report.status).label}
                </div>

                {/* Direct PDF Export Button */}
                <button 
                  onClick={(e) => { e.stopPropagation(); handleShareExternal(report); }}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-500 dark:hover:text-white text-[11px] font-black uppercase tracking-wider rounded-xl transition-all shadow-sm"
                  title="Exporter ce rapport au format PDF officiel pour partage externe"
                >
                  <Download size={15} />
                  <span>Exporter PDF</span>
                </button>

                {/* Quick Actions for Supervisors */}
                {canApproveReport(report) && (
                  <div className="flex items-center gap-2 border-l border-slate-100 dark:border-slate-800 pl-3">
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleStatusChange(report.id, 'approve'); }}
                      className="p-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-500 transition-all shadow-sm"
                      title="Viser / Approuver"
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
                  onClick={() => setViewingReport(report)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 rounded-xl transition-all"
                  title="Voir les détails"
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
               className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-slate-900 w-full max-w-3xl rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/30">
                 <div>
                   <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Édition de Document</span>
                   <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Nouveau Rapport d'Activité</h2>
                 </div>
                 <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl text-slate-400"><XCircle size={24} /></button>
              </div>
              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                 <div>
                   <label className="block text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Titre du rapport</label>
                   <input 
                    required
                    type="text" 
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    placeholder="ex: Rapport Hebdomadaire Ferme & Production S14"
                    className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 font-medium"
                   />
                 </div>
                 <div>
                   <label className="block text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Contenu et Synthèse</label>
                   <textarea 
                    required
                    rows={10}
                    value={formData.content}
                    onChange={(e) => setFormData({...formData, content: e.target.value})}
                    placeholder="Détaillez vos observations, données chiffrées, réalisations et recommandations..."
                    className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 font-mono text-xs leading-relaxed"
                   />
                 </div>
                 <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                   <button 
                     type="button" 
                     onClick={() => setIsModalOpen(false)}
                     className="px-6 py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-200 text-xs uppercase tracking-wider"
                   >
                     Annuler
                   </button>
                   <button 
                     type="submit" 
                     className="px-8 py-3.5 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 shadow-xl shadow-emerald-600/20 text-xs uppercase tracking-wider flex items-center justify-center gap-2"
                   >
                     <CheckCircle size={16} />
                     Soumettre pour Visa Hiérarchique
                   </button>
                 </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Viewing & PDF Export Modal */}
      <AnimatePresence>
        {viewingReport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setViewingReport(null)} className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"/>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="relative bg-white dark:bg-slate-900 w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
               {/* Modal Header */}
               <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex flex-wrap justify-between items-center gap-4 shrink-0 bg-slate-50/50 dark:bg-slate-800/30">
                  <div>
                    <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-[0.2em]">{viewingReport.departmentId}</span>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{viewingReport.title}</h2>
                  </div>
                  <div className="flex items-center gap-3">
                     <div className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] ${getStatusDetails(viewingReport.status).className}`}>
                       {React.createElement(getStatusDetails(viewingReport.status).icon, { size: 14 })}
                       {getStatusDetails(viewingReport.status).label}
                     </div>

                     {/* Export PDF Button */}
                     <button 
                       onClick={() => generatePDF(viewingReport)}
                       className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 transition-all rounded-xl shadow-lg shadow-emerald-600/20 text-xs font-black uppercase tracking-wider"
                       title="Télécharger la version PDF officielle"
                     >
                       <Download size={16} />
                       <span>Exporter PDF</span>
                     </button>

                     <button onClick={() => setViewingReport(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all text-slate-400"><XCircle size={24} /></button>
                  </div>
               </div>

               {/* Modal Body */}
               <div className="p-8 overflow-y-auto flex-1 h-full scrollbar-hide space-y-6">
                  {/* Meta Information Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white dark:bg-slate-900 rounded-xl flex items-center justify-center text-slate-400">
                        <User size={18} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Auteur / Rédacteur</p>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{users[viewingReport.authorId] || 'Utilisateur'}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white dark:bg-slate-900 rounded-xl flex items-center justify-center text-slate-400">
                        <Clock size={18} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Date d'Émission</p>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{new Date(viewingReport.createdAt || Date.now()).toLocaleString('fr-FR')}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white dark:bg-slate-900 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                        <ShieldCheck size={18} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Validation Finale</p>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{viewingReport.validatorId ? (users[viewingReport.validatorId] || 'Direction') : 'En attente'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Document Content */}
                  <div className="bg-slate-50/50 dark:bg-slate-800/30 p-6 rounded-3xl border border-slate-100 dark:border-slate-800">
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                      <FileText size={16} className="text-emerald-600" />
                      Contenu du Document
                    </h4>
                    <pre className="whitespace-pre-wrap text-slate-700 dark:text-slate-300 font-mono text-xs leading-relaxed overflow-x-auto">
                      {viewingReport.content}
                    </pre>
                  </div>

                  {/* Comments and Audit Trail */}
                  <CommentsSection parentId={viewingReport.id} parentType="reports" />
               </div>

               {/* Modal Approval Footer */}
               {canApproveReport(viewingReport) && (
                 <div className="p-8 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-4 bg-slate-50/50 dark:bg-slate-800/50 shrink-0">
                    <button 
                      onClick={() => handleStatusChange(viewingReport.id, 'reject')}
                      className="flex-1 py-4 bg-white dark:bg-slate-900 border border-red-100 dark:border-red-900/30 text-red-600 font-bold rounded-2xl hover:bg-red-50 dark:hover:bg-red-500/10 transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider"
                    >
                      <XCircle size={18} /> Rejeter le Rapport
                    </button>
                    <button 
                       onClick={() => handleStatusChange(viewingReport.id, 'approve')}
                       className="flex-1 py-4 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 shadow-xl shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider"
                    >
                      <CheckCircle size={18} /> {viewingReport.status === 'pending_dg' ? 'Valider (Décision finale DG)' : 'Approuver & Transmettre au niveau supérieur'}
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

