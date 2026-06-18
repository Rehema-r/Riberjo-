import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { Task, Report, UserProfile, Department } from '../types';
import { Archive as ArchiveIcon, FileText, CheckCircle2, Search, FileDown, Download, FileSpreadsheet } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';

export default function Archive() {
  const { profile } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [users, setUsers] = useState<Record<string, string>>({});
  const [depts, setDepts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'tasks' | 'reports'>('all');
  const [search, setSearch] = useState('');

  const exportToPDF = () => {
    const activeType = filter;
    let itemsToExport = [];
    if (activeType === 'all') {
      itemsToExport = [
        ...tasks.map(t => ({ ...t, type: 'task' as const })),
        ...reports.map(r => ({ ...r, type: 'report' as const }))
      ];
    } else if (activeType === 'tasks') {
      itemsToExport = tasks.map(t => ({ ...t, type: 'task' as const }));
    } else {
      itemsToExport = reports.map(r => ({ ...r, type: 'report' as const }));
    }

    // Sort by date desc
    itemsToExport.sort((a, b) => b.createdAt - a.createdAt);

    // Apply front-end search filter
    if (search) {
      itemsToExport = itemsToExport.filter(item => 
        (item.title || '').toLowerCase().includes(search.toLowerCase()) || 
        (item as any).description?.toLowerCase().includes(search.toLowerCase()) ||
        (item as any).content?.toLowerCase().includes(search.toLowerCase())
      );
    }

    const doc = new jsPDF();
    
    // Page Title & Header Branding
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(16, 185, 129); // Emerald color
    doc.text("RIBERJO SPA - ARCHIVES CENTRALES", 14, 22);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Rapport complet d'archive - Généré le ${format(new Date(), 'dd MMMM yyyy à HH:mm', { locale: fr })}`, 14, 29);
    doc.text(`Opérateur : ${profile?.fullName || 'Directeur'}  |  Filtre actif : ${activeType === 'all' ? 'Tous documents' : activeType === 'tasks' ? 'Tâches uniquement' : 'Rapports uniquement'}`, 14, 34);
    
    doc.setDrawColor(226, 232, 240); // slate-200 boundary line
    doc.setLineWidth(0.5);
    doc.line(14, 38, 196, 38);
    
    let y = 46;

    if (itemsToExport.length === 0) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(11);
      doc.setTextColor(148, 163, 184);
      doc.text("Aucun élément d'archive à lister pour cette sélection.", 14, y);
    } else {
      itemsToExport.forEach((item, index) => {
        const detailText = item.type === 'task' 
          ? ((item as Task).description || 'Aucune description.')
          : ((item as Report).content || 'Aucun contenu.');
          
        const cleanText = detailText.replace(/\s+/g, ' ').trim();
        const splitLines = doc.splitTextToSize(cleanText, 172);
        
        // Calculate container height dynamically
        // Header info: 18mm, Each desc line: 4.5mm, Bottom padding: 5mm
        const blockHeight = 22 + (splitLines.length * 4.5);
        
        // Break page if block overflows the bottom limit (280mm)
        if (y + blockHeight > 280) {
          doc.addPage();
          y = 22;
          
          // Header on new pages
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184);
          doc.text("RIBERJO SPA | RAPPORT DE SYNTHÈSE D'ARCHIVES", 14, 12);
          doc.setDrawColor(241, 245, 249);
          doc.line(14, 14, 196, 14);
        }
        
        // Draw container box
        doc.setFillColor(250, 250, 250);
        doc.setDrawColor(230, 235, 240);
        doc.setLineWidth(0.2);
        doc.roundedRect(14, y, 182, blockHeight, 3, 3, "FD");
        
        // Box internal header
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        if (item.type === 'task') {
          doc.setTextColor(37, 99, 235); // Blue
          doc.text("● CLASSIFICATION : TÂCHE", 18, y + 6);
        } else {
          doc.setTextColor(217, 119, 6); // Amber
          doc.text("● CLASSIFICATION : RAPPORT & FORMULAIRE", 18, y + 6);
        }
        
        // Formatted Status Label
        const rawStatus = (item as any).status || '';
        let statusLabel = rawStatus.toUpperCase();
        if (rawStatus === 'pending') statusLabel = 'EN ATTENTE';
        else if (rawStatus === 'in_progress') statusLabel = 'EN COURS';
        else if (rawStatus === 'completed') statusLabel = 'TERMINÉ';
        else if (rawStatus === 'pending_validation') statusLabel = 'ATTENTE VALIDATION';
        else if (rawStatus === 'draft') statusLabel = 'BROUILLON';
        else if (rawStatus === 'validated') statusLabel = 'VALIDÉ / ARCHIVÉ';
        else if (rawStatus === 'rejected') statusLabel = 'REJETÉ / EN REVUE';
        
        doc.setFont("helvetica", "bold");
        doc.setTextColor(100, 116, 139);
        doc.text(`STATUT : ${statusLabel}`, 134, y + 6);
        
        // Document Title
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42); // slate-900
        const titleText = (item.title || 'SANS TITRE').toUpperCase();
        const truncatedTitle = titleText.length > 55 ? titleText.substring(0, 52) + '...' : titleText;
        doc.text(truncatedTitle, 18, y + 12);
        
        // Metadata fields
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(71, 85, 105);
        const docDept = depts[item.departmentId] || 'Département inconnu';
        const docAuthor = users[(item as any).creatorId || (item as any).authorId] || 'Auteur non renseigné';
        const docDate = format(item.createdAt, 'dd/MM/yyyy HH:mm', { locale: fr });
        doc.text(`Département : ${docDept}   |   Saisi par : ${docAuthor}   |   Date : ${docDate}`, 18, y + 17);
        
        // Horizontal separation line
        doc.setDrawColor(241, 245, 249);
        doc.line(18, y + 19, 192, y + 19);
        
        // Dynamic wrapped content details
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(51, 65, 85);
        
        let currentLineY = y + 23;
        splitLines.forEach((line: string) => {
          doc.text(line, 18, currentLineY);
          currentLineY += 4.5;
        });
        
        y += blockHeight + 6; // Separation padding between items
      });
    }
    
    // Download the completed document
    const fileDateStr = format(new Date(), 'yyyy_MM_dd_HHmm');
    doc.save(`archives_riberjo_${activeType}_${fileDateStr}.pdf`);
  };

  const exportToExcel = () => {
    const activeType = filter;
    let itemsToExport = [];
    if (activeType === 'all') {
      itemsToExport = [
        ...tasks.map(t => ({ ...t, type: 'task' as const })),
        ...reports.map(r => ({ ...r, type: 'report' as const }))
      ];
    } else if (activeType === 'tasks') {
      itemsToExport = tasks.map(t => ({ ...t, type: 'task' as const }));
    } else {
      itemsToExport = reports.map(r => ({ ...r, type: 'report' as const }));
    }

    // Sort by date desc
    itemsToExport.sort((a, b) => b.createdAt - a.createdAt);

    // Apply active filter search
    if (search) {
      itemsToExport = itemsToExport.filter(item => 
        (item.title || '').toLowerCase().includes(search.toLowerCase()) || 
        (item as any).description?.toLowerCase().includes(search.toLowerCase()) ||
        (item as any).content?.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Map tasks data to polished column format
    const tasksData = itemsToExport
      .filter(item => item.type === 'task')
      .map(item => {
        const task = item as Task;
        const rawStatus = task.status || '';
        let statusLabel = rawStatus.toUpperCase();
        if (rawStatus === 'pending') statusLabel = 'EN ATTENTE';
        else if (rawStatus === 'in_progress') statusLabel = 'EN COURS';
        else if (rawStatus === 'completed') statusLabel = 'TERMINÉ';

        return {
          'REFERENCE_ID': task.id,
          'TITRE_DOCUMENT': (task.title || '').toUpperCase(),
          'DESCRIPTION_DETAILED': task.description || 'Aucune description.',
          'DEPARTEMENT': (depts[task.departmentId] || 'INCONNU').toUpperCase(),
          'CREATEUR_AUTEUR': (users[(task as any).creatorId || (task as any).authorId] || 'INCONNU').toUpperCase(),
          'TRAVAIL_ESTIME_H': (task as any).estimatedHours || 'N/A',
          'EXIGENCES_REQUIS': (task as any).requirements || 'Aucun',
          'DATE_CREATION': format(task.createdAt, 'dd/MM/yyyy HH:mm', { locale: fr }),
          'DATE_ECHEANCE': (task as any).dueDate ? format(new Date((task as any).dueDate), 'dd/MM/yyyy', { locale: fr }) : 'Non planifiée',
          'PRIORITE_NIVEAU': ((task as any).priority || 'NORMALE').toUpperCase(),
          'STATUT_LOGIQUE': statusLabel
        };
      });

    // Map reports data to polished column format
    const reportsData = itemsToExport
      .filter(item => item.type === 'report')
      .map(item => {
        const r = item as Report;
        const rawStatus = (r.status || '') as string;
        let statusLabel = rawStatus.toUpperCase();
        if (rawStatus === 'draft') statusLabel = 'BROUILLON';
        else if (rawStatus === 'pending_validation') statusLabel = 'ATTENTE VALIDATION';
        else if (rawStatus === 'pending') statusLabel = 'EN ATTENTE';
        else if (rawStatus === 'validated') statusLabel = 'VALIDÉ / ARCHIVÉ';
        else if (rawStatus === 'rejected') statusLabel = 'REJETÉ / EN REVUE';

        return {
          'REFERENCE_ID': r.id,
          'TITRE_DOCUMENT': (r.title || '').toUpperCase(),
          'RAPPORT_CONTENU': r.content || 'Aucun contenu.',
          'DEPARTEMENT': (depts[r.departmentId] || 'INCONNU').toUpperCase(),
          'CREATEUR_AUTEUR': (users[r.authorId || (r as any).creatorId] || 'INCONNU').toUpperCase(),
          'VALIDEUR_RESP': r.validatorId ? (users[r.validatorId] || 'RESPONSABLE').toUpperCase() : 'NON REQUIS / EN ATTENTE',
          'CATEGORIE_RAPPORT': ((r as any).reportType || (r as any).type || 'GÉNÉRAL').toUpperCase(),
          'DATE_CREATION': format(r.createdAt, 'dd/MM/yyyy HH:mm', { locale: fr }),
          'INTELLIGENCE_ARTIFICIELLE_SUM': (r as any).aiSummary ? 'OUI (Rapport Assisté par IA)' : 'NON (Mode Standard)',
          'STATUT_LOGIQUE': statusLabel
        };
      });

    const wb = XLSX.utils.book_new();

    if (tasksData.length > 0) {
      const tasksWs = XLSX.utils.json_to_sheet(tasksData);
      // Auto width calculation
      const tasksWidths = Object.keys(tasksData[0] || {}).map(key => {
        const maxLen = Math.max(
          key.length,
          ...tasksData.map(row => String((row as any)[key] || '').length)
        );
        return { wch: Math.min(Math.max(maxLen + 3, 12), 40) };
      });
      tasksWs['!cols'] = tasksWidths;
      XLSX.utils.book_append_sheet(wb, tasksWs, "TÂCHES CENTRALES");
    }

    if (reportsData.length > 0) {
      const reportsWs = XLSX.utils.json_to_sheet(reportsData);
      // Auto width calculation
      const reportsWidths = Object.keys(reportsData[0] || {}).map(key => {
        const maxLen = Math.max(
          key.length,
          ...reportsData.map(row => String((row as any)[key] || '').length)
        );
        return { wch: Math.min(Math.max(maxLen + 3, 12), 40) };
      });
      reportsWs['!cols'] = reportsWidths;
      XLSX.utils.book_append_sheet(wb, reportsWs, "RAPPORTS CENTRALISÉS");
    }

    // Fallback sheet if both are empty
    if (tasksData.length === 0 && reportsData.length === 0) {
      const emptyWs = XLSX.utils.json_to_sheet([{ MESSAGE: "Aucune documentation d'archive trouvée." }]);
      XLSX.utils.book_append_sheet(wb, emptyWs, "EXPORT VIDE");
    }

    const fileDateStr = format(new Date(), 'yyyy_MM_dd_HHmm');
    XLSX.writeFile(wb, `RIBERJO_ARCHIVES_EXPORT_${fileDateStr}.xlsx`);
  };

  const exportSingleToPDF = (item: any) => {
    const doc = new jsPDF();
    
    // Header Style
    doc.setFillColor(16, 185, 129); // Emerald-500
    doc.rect(0, 0, 210, 40, "F");
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text("RIBERJO SPA - FICHE D'ARCHIVE OFFICIELLE", 14, 20);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("BIBLIOTHÈQUE CENTRALE  •  DOCUMENT UNIQUE ENREGISTRÉ", 14, 28);
    
    // Main Panel container
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(14, 48, 182, 60, 4, 4, "S");
    
    // Labels column 1
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    
    doc.text("TYPE DE DOCUMENT :", 18, 56);
    doc.text("IDENTIFIANT UNIQUE :", 18, 64);
    doc.text("TITRE OFFICIEL :", 18, 72);
    doc.text("DÉPARTEMENT RÉFÉRENT :", 18, 80);
    doc.text("AUTEUR PRINCIPAL :", 18, 88);
    doc.text("DATE D'ENREGISTREMENT :", 18, 96);
    doc.text("STATUT DU TRAITEMENT :", 18, 102);

    // Document types conversion
    const typeLabel = item.type === 'task' ? 'TÂCHE TECHNIQUE' : 'RAPPORT COMMERCIAL / OPERATIONNEL';
    const statusVal = (item as any).status || '';
    let statusLabel = statusVal.toUpperCase();
    if (statusVal === 'pending') statusLabel = 'EN ATTENTE';
    else if (statusVal === 'in_progress') statusLabel = 'EN DE COURS';
    else if (statusVal === 'completed') statusLabel = 'TERMINÉ ET ARCHIVÉ';
    else if (statusVal === 'pending_validation') statusLabel = 'EN ATTENTE DE VALIDATION';
    else if (statusVal === 'draft') statusLabel = 'BROUILLON';
    else if (statusVal === 'validated') statusLabel = 'VALIDÉ';
    else if (statusVal === 'rejected') statusLabel = 'REJETÉ / À CORRIGER';

    const docDept = depts[item.departmentId] || 'Indconnu / Tous départements';
    const docAuthor = users[(item as any).creatorId || (item as any).authorId] || 'Principal';
    const docDate = format(item.createdAt, 'dd MMMM yyyy à HH:mm', { locale: fr });

    // Values Column 2
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42); // slate-900

    doc.text(typeLabel, 70, 56);
    
    doc.setFont("courier", "bold");
    doc.setFontSize(9);
    doc.text(item.id, 70, 64);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    const croppedTitle = (item.title || 'SANS TITRE').toUpperCase();
    doc.text(croppedTitle.substring(0, 56), 70, 72);
    doc.text(docDept.toUpperCase(), 70, 80);
    doc.text(docAuthor.toUpperCase(), 70, 88);
    doc.text(docDate, 70, 96);

    // Status highlighter
    doc.setTextColor(16, 185, 129); // green status
    doc.text(statusLabel, 70, 102);

    // Section Content
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text("CONTENU ET DESCRIPTION DÉTAILLÉE", 14, 120);

    doc.setDrawColor(241, 245, 249);
    doc.line(14, 123, 196, 123);

    // Splitting description text
    const detailsVal = item.type === 'task' ? (item as Task).description : (item as Report).content;
    const cleanDetails = (detailsVal || 'Aucune description disponible pour ce document.').replace(/\s+/g, ' ').trim();
    
    const contentLines = doc.splitTextToSize(cleanDetails, 182);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);

    let contentY = 129;
    contentLines.forEach((line: string) => {
      if (contentY > 275) {
        doc.addPage();
        contentY = 20;
      }
      doc.text(line, 14, contentY);
      contentY += 5;
    });

    // Signature stamp space at bottom
    if (contentY > 240) {
      doc.addPage();
      contentY = 20;
    }
    
    contentY += 15;
    doc.setDrawColor(226, 232, 240);
    doc.line(14, contentY, 196, contentY);
    contentY += 8;

    doc.setFont("helvetica", "italic");
    doc.setFontSize(8.5);
    doc.setTextColor(148, 163, 184);
    doc.text("Secrétariat RIBERJO SPA - Document certifié conforme émis par la Bibliothèque Centrale.", 14, contentY);
    
    // Save Document 
    doc.save(`fiche_archive_${item.type}_${item.id}.pdf`);
  };

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [tasksSnap, reportsSnap, usersSnap, deptsSnap] = await Promise.all([
        getDocs(query(collection(db, 'tasks'), orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'reports'), orderBy('createdAt', 'desc'))),
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'departments'))
      ]);

      setTasks(tasksSnap.docs.map(d => ({ id: d.id, ...d.data() } as Task)));
      setReports(reportsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Report)));
      
      const userMap: Record<string, string> = {};
      usersSnap.docs.forEach(d => {
        const u = d.data() as UserProfile;
        userMap[d.id] = u.fullName;
      });
      setUsers(userMap);

      const deptMap: Record<string, string> = {};
      deptsSnap.docs.forEach(d => {
        const dept = d.data() as Department;
        deptMap[d.id] = dept.name;
      });
      setDepts(deptMap);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const filteredItems = [
    ...(filter === 'all' || filter === 'tasks' ? tasks.map(t => ({ ...t, type: 'task' as const })) : []),
    ...(filter === 'all' || filter === 'reports' ? reports.map(r => ({ ...r, type: 'report' as const })) : [])
  ].sort((a, b) => b.createdAt - a.createdAt)
   .filter(item => 
     (item.title || '').toLowerCase().includes((search || '').toLowerCase()) || 
     (item as any).description?.toLowerCase().includes((search || '').toLowerCase()) ||
     (item as any).content?.toLowerCase().includes((search || '').toLowerCase())
   );

  if (loading) return <div className="h-full flex items-center justify-center text-slate-400 font-bold">Chargement de la bibliothèque...</div>;

  return (
    <div className="max-w-6xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight uppercase flex items-center gap-3">
            <ArchiveIcon size={32} className="text-emerald-600" />
            Bibliothèque Centrale
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">Archives complètes des activités, rapports et tâches de l'entreprise.</p>
        </div>

        <div className="flex bg-white dark:bg-slate-900 p-2 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 items-center gap-2">
           <Search size={18} className="text-slate-400 dark:text-slate-500 ml-2" />
           <input 
             type="text"
             placeholder="Rechercher dans les archives..."
             value={search}
             onChange={(e) => setSearch(e.target.value)}
             className="bg-transparent border-none text-sm font-bold focus:ring-0 w-64 uppercase tracking-tight text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600"
           />
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={exportToPDF}
            className="flex items-center gap-2 px-6 py-3 bg-slate-900 dark:bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-emerald-700 transition-all shadow-lg shadow-slate-200 dark:shadow-none"
          >
            <FileDown size={16} />
            Télécharger PDF
          </button>
          <button 
            onClick={exportToExcel}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-600 dark:bg-slate-800 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 dark:hover:bg-slate-700 transition-all shadow-lg shadow-emerald-200 dark:shadow-none"
          >
            <FileSpreadsheet size={16} />
            Exporter Excel
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-8">
        {(['all', 'tasks', 'reports'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              filter === f 
                ? 'bg-slate-900 dark:bg-emerald-600 text-white shadow-xl shadow-slate-200 dark:shadow-none' 
                : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-800'
            }`}
          >
            {f === 'all' ? 'Tout' : f === 'tasks' ? 'Tâches' : 'Rapports'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredItems.map((item, idx) => (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            key={item.id}
            className="group bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 hover:border-emerald-200 dark:hover:border-emerald-500/50 hover:shadow-xl hover:shadow-emerald-50/50 dark:hover:shadow-none transition-all"
          >
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
              <div className="flex items-center gap-6 flex-1 w-full">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
                  item.type === 'task' ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400'
                }`}>
                  {item.type === 'task' ? <CheckCircle2 size={24} /> : <FileText size={24} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg ${
                      item.type === 'task' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                    }`}>
                      {item.type === 'task' ? 'Tâche' : 'Rapport'}
                    </span>
                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                      {format(item.createdAt, 'PPp', { locale: fr })}
                    </span>
                  </div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors truncate uppercase tracking-tight">
                    {item.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">
                    {item.type === 'task' ? (item as Task).description : (item as Report).content.substring(0, 100)}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between lg:justify-end gap-8 shrink-0 w-full lg:w-auto">
                 <div className="text-left lg:text-right">
                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Département</p>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{depts[item.departmentId] || 'Inconnu'}</p>
                 </div>
                 <div className="text-left lg:text-right">
                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Auteur</p>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{users[(item as any).creatorId || (item as any).authorId] || 'Inconnu'}</p>
                 </div>
                 {(item as any).validatorId && (
                   <div className="text-left lg:text-right">
                      <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">Validé par</p>
                      <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">{users[(item as any).validatorId] || 'Resp.'}</p>
                   </div>
                 )}
                 <button 
                    onClick={() => exportSingleToPDF(item)}
                    className="p-3 bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-xl hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-500 transition-all"
                    title="Télécharger la fiche PDF détaillée"
                  >
                     <Download size={18} />
                  </button>
              </div>
            </div>
          </motion.div>
        ))}

        {filteredItems.length === 0 && (
          <div className="bg-slate-50 dark:bg-slate-900 rounded-3xl p-20 text-center border-2 border-dashed border-slate-200 dark:border-slate-800">
             <ArchiveIcon size={48} className="text-slate-200 dark:text-slate-800 mx-auto mb-4" />
             <p className="text-slate-400 dark:text-slate-600 font-bold">Aucun élément trouvé dans les archives.</p>
          </div>
        )}
      </div>
    </div>
  );
}
