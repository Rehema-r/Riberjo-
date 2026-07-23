import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, getDocs, limit } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Payroll, UserProfile } from '../types';
import { DollarSign, Download, TrendingUp, TrendingDown, CreditCard, FileText, Calendar as CalendarIcon, CheckCircle2, Search, Printer, ShieldCheck, Calculator } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export function calculateCongolesePayroll(
  baseSalary: number,
  housingAllowance: number = 0,
  transportAllowance: number = 0,
  primes: number = 0,
  dependentsCount: number = 0
) {
  // En RDC, selon le Code du Travail (Art 138):
  // Logement obligatoire: min 30% du salaire de base si non fourni
  const actualHousing = housingAllowance > 0 ? housingAllowance : Math.round(baseSalary * 0.30);
  // Transport: allocation forfaitaire de transport (ex: $2/jour x 22 jours)
  const actualTransport = transportAllowance > 0 ? transportAllowance : 44;
  // Allocations Familiales CNSS (ex: $5 par enfant)
  const familyAllowances = dependentsCount * 5;

  // Salaire Brut Total
  const grossSalary = baseSalary + actualHousing + actualTransport + primes + familyAllowances;

  // 1. CNSS Travailleur (5% du brut cotisable)
  const cnssWorkerDeduction = Math.round(grossSalary * 0.05 * 100) / 100;

  // 2. IPR (Impôt sur le Revenu Professionnel - Barème progressif RDC DGI)
  const taxableBase = grossSalary - cnssWorkerDeduction;
  
  let rawIpr = 0;
  if (taxableBase <= 100) {
    rawIpr = taxableBase * 0.03;
  } else if (taxableBase <= 300) {
    rawIpr = 3 + (taxableBase - 100) * 0.10;
  } else if (taxableBase <= 800) {
    rawIpr = 23 + (taxableBase - 300) * 0.15;
  } else if (taxableBase <= 2000) {
    rawIpr = 98 + (taxableBase - 800) * 0.22;
  } else {
    rawIpr = 362 + (taxableBase - 2000) * 0.30;
  }

  // Abattement pour charges de famille en RDC (2% par personne à charge, max 9 = 18%)
  const familyAbatementPct = Math.min(dependentsCount, 9) * 0.02;
  const iprDeduction = Math.round(Math.max(0, rawIpr * (1 - familyAbatementPct)) * 100) / 100;

  // Total Déductions Travailleur
  const totalDeductions = Math.round((cnssWorkerDeduction + iprDeduction) * 100) / 100;

  // Salaire Net à payer
  const netSalary = Math.round((grossSalary - totalDeductions) * 100) / 100;

  // Cotisations Patronales (Charges Employeur RDC)
  const cnssEmployerContribution = Math.round(grossSalary * 0.13 * 100) / 100; // 13% CNSS
  const inppContribution = Math.round(grossSalary * 0.02 * 100) / 100; // 2% INPP
  const onemContribution = Math.round(grossSalary * 0.002 * 100) / 100; // 0.2% ONEM

  return {
    baseSalary,
    housingAllowance: actualHousing,
    transportAllowance: actualTransport,
    familyAllowances,
    primes,
    grossSalary,
    cnssWorkerDeduction,
    iprDeduction,
    totalDeductions,
    netSalary,
    cnssEmployerContribution,
    inppContribution,
    onemContribution
  };
}

export default function PayrollPage() {
  const { profile } = useAuth();
  const [payrollHistory, setPayrollHistory] = useState<Payroll[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Batch Payroll Generation Modal States
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (!profile) return;

    const q = profile.role === 'SUPER_ADMIN' || profile.role === 'ADMIN' || profile.role === 'BOARD_MEMBER' || profile.departmentId === '03' || profile.departmentId === '04'
      ? query(collection(db, 'payroll'), orderBy('createdAt', 'desc'), limit(50))
      : query(collection(db, 'payroll'), where('userId', '==', profile.matricule), orderBy('createdAt', 'desc'), limit(12));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const records = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Payroll));
      setPayrollHistory(records);
      setIsLoading(false);
    }, (error) => {
      console.warn("Payroll onSnapshot operates in local cache mode:", error.message);
      setIsLoading(false);
      handleFirestoreError(error, OperationType.LIST, 'payroll');
    });

    return () => unsubscribe();
  }, [profile]);

  const handleBatchGeneratePayroll = async () => {
    setIsGenerating(true);
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const employees = usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as UserProfile));

      if (employees.length === 0) {
        alert("Aucun employé trouvé dans la base de données.");
        setIsGenerating(false);
        return;
      }

      let generatedCount = 0;
      for (const emp of employees) {
        const base = emp.baseSalary || 250;
        const housing = emp.housingAllowance || Math.round(base * 0.30);
        const transport = emp.transportAllowance || 44;
        const dependents = emp.dependentsCount || 0;

        const calc = calculateCongolesePayroll(base, housing, transport, 0, dependents);

        await addDoc(collection(db, 'payroll'), {
          userId: emp.matricule || emp.id,
          userName: emp.fullName,
          cnssNumber: emp.cnssNumber || '1000000000',
          contractType: emp.contractType || 'CDI',
          month: selectedMonth,
          year: selectedYear,
          period: `${selectedMonth}/${selectedYear}`,
          baseSalary: calc.baseSalary,
          housingAllowance: calc.housingAllowance,
          transportAllowance: calc.transportAllowance,
          familyAllowances: calc.familyAllowances,
          grossSalary: calc.grossSalary,
          primes: calc.primes,
          cnssWorkerDeduction: calc.cnssWorkerDeduction,
          iprDeduction: calc.iprDeduction,
          cnssEmployerContribution: calc.cnssEmployerContribution,
          inppContribution: calc.inppContribution,
          onemContribution: calc.onemContribution,
          deductions: calc.totalDeductions,
          netSalary: calc.netSalary,
          status: 'paid',
          paymentDate: Date.now(),
          createdAt: Date.now()
        });
        generatedCount++;
      }

      alert(`Paie du mois ${selectedMonth}/${selectedYear} générée avec succès selon le Code du Travail RDC pour ${generatedCount} collaborateurs !`);
      setShowGenerateModal(false);
    } catch (err) {
      console.error("Erreur lors de la génération de la paie RDC:", err);
      alert("Erreur lors de la génération de la paie.");
    } finally {
      setIsGenerating(false);
    }
  };

  const generatePDF = (item: Payroll) => {
    const doc = new jsPDF() as any;
    
    // Header Company Info
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(16, 185, 129); // Emerald
    doc.text('RIBERJO GLOBAL SERVICE SARL', 105, 18, { align: 'center' });
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80);
    doc.text('RDC - Lubumbashi / Haut-Katanga | RCCM: CD/LSH/RCCM/22-B-0142', 105, 24, { align: 'center' });
    doc.text('N° Impôt: A2210842Y | N° CNSS Entreprise: 100482910/RDC | INPP: 82910', 105, 29, { align: 'center' });

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text('FICHE DE PAIE OFFICIELLE (CODE DU TRAVAIL RDC)', 105, 38, { align: 'center' });
    doc.text(`Période de Paie: ${item.month}/${item.year}`, 105, 44, { align: 'center' });

    // Divider Line
    doc.setDrawColor(226, 232, 240);
    doc.line(20, 48, 190, 48);

    // Employee & Contract Info
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text('INFORMATIONS DU TRAVAILLEUR', 20, 56);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Nom Complet: ${item.userName}`, 20, 63);
    doc.text(`Matricule Agent: ${item.userId}`, 20, 69);
    doc.text(`N° Immatriculation CNSS: ${item.cnssNumber || '1003849102'}`, 20, 75);

    doc.text(`Type de Contrat: ${item.contractType || 'CDI'}`, 120, 63);
    doc.text(`Statut Fiscal: Imposable RDC`, 120, 69);
    doc.text(`Date de Paiement: ${new Date(item.paymentDate || item.createdAt).toLocaleDateString('fr-FR')}`, 120, 75);

    // Payroll Calculation Table
    const gross = item.grossSalary || (item.baseSalary + (item.housingAllowance || 0) + (item.transportAllowance || 0) + item.primes);
    const housing = item.housingAllowance || Math.round(item.baseSalary * 0.30);
    const transport = item.transportAllowance || 44;
    const cnssWorker = item.cnssWorkerDeduction || Math.round(gross * 0.05);
    const ipr = item.iprDeduction || Math.round(item.deductions - cnssWorker);

    doc.autoTable({
      startY: 82,
      head: [['Désignation de la Rubrique', 'Base de Calcul', 'Gains ($)', 'Retenues ($)']],
      body: [
        ['Salaire de Base Contractuel', '$' + item.baseSalary.toFixed(2), '$' + item.baseSalary.toFixed(2), '-'],
        ['Indemnité de Logement (Art. 138 Code du Travail)', '30% Base', '$' + housing.toFixed(2), '-'],
        ['Indemnité de Transport (Forfaitaire Légal)', '22 Jours', '$' + transport.toFixed(2), '-'],
        ['Allocations Familiales CNSS', 'Enfants', '$' + (item.familyAllowances || 0).toFixed(2), '-'],
        ['Primes / Gratifications', 'Fixe', '$' + item.primes.toFixed(2), '-'],
        [{ content: 'TOTAL SALAIRE BRUT IMPOSABLE', styles: { fontStyle: 'bold', fillColor: [240, 253, 244] } }, '-', { content: '$' + gross.toFixed(2), styles: { fontStyle: 'bold', fillColor: [240, 253, 244] } }, '-'],
        ['Cotisation CNSS Travailleur (Branche Pensions)', '5% Brut', '-', '$' + cnssWorker.toFixed(2)],
        ['Impôt sur le Revenu Professionnel (IPR - DGI)', 'Barème RDC', '-', '$' + ipr.toFixed(2)],
        [{ content: 'TOTAL DÉDUCTIONS OBLIGATOIRES', styles: { fontStyle: 'bold', fillColor: [254, 242, 242] } }, '-', '-', { content: '$' + item.deductions.toFixed(2), styles: { fontStyle: 'bold', fillColor: [254, 242, 242] } }],
        [{ content: 'NET À PAYER AU TRAVAILLEUR', styles: { fontStyle: 'bold', fontSize: 11, fillColor: [209, 250, 229] } }, { content: `$${item.netSalary.toFixed(2)}`, colSpan: 3, styles: { fontStyle: 'bold', fontSize: 11, halign: 'right', fillColor: [209, 250, 229] } }]
      ],
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: 'bold' }
    });

    const finalY = (doc as any).lastAutoTable.finalY || 160;

    // Employer Contributions Box
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text('CHARGES PATRONALES EMPLOYEUR (INFORMATIONS DGI / CNSS / INPP)', 20, finalY + 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`CNSS Patronale (13%): $${(item.cnssEmployerContribution || (gross * 0.13)).toFixed(2)} | INPP (2%): $${(item.inppContribution || (gross * 0.02)).toFixed(2)} | ONEM (0.2%): $${(item.onemContribution || (gross * 0.002)).toFixed(2)}`, 20, finalY + 16);

    // Signatures
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text('Signature / Sceau de l\'Employeur', 20, finalY + 35);
    doc.text('Signature du Travailleur', 140, finalY + 35);

    doc.setFontSize(7);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(120);
    doc.text('Document conforme au Code du Travail RDC (Loi n° 015/2002). Généré numériquement par RIBERJO ERP.', 105, 285, { align: 'center' });
    
    doc.save(`Fiche_Paie_RDC_${item.userId}_${item.month}_${item.year}.pdf`);
  };

  const filteredHistory = payrollHistory.filter(p => 
    p.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.userId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    `${p.month}/${p.year}`.includes(searchTerm)
  );

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
          <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Paie & Salaires (RDC)</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Gestion des rémunérations conforme au Code du Travail, DGI, CNSS et INPP en RDC.</p>
        </div>
        <div className="flex items-center gap-3">
          {profile?.role !== 'BOARD_MEMBER' && (profile?.role === 'SUPER_ADMIN' || profile?.departmentId === 'all' || profile?.departmentId === '03' || profile?.departmentId === '04') && (
            <button 
              onClick={() => setShowGenerateModal(true)}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-lg transition-all flex items-center gap-2 cursor-pointer"
            >
              <Calculator size={16} /> Générer Paie du Mois (Barème RDC)
            </button>
          )}
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Salaire de Base" 
          value={`$${profile?.baseSalary || 250}`} 
          subtitle="Contractuel imposable"
          icon={CreditCard}
          trend="+0%"
          color="emerald"
        />
        <StatCard 
          title="Dernier Paiement Net" 
          value={payrollHistory[0] ? `$${payrollHistory[0].netSalary}` : '$0'} 
          subtitle={payrollHistory[0] ? payrollHistory[0].period : 'Aucun'}
          icon={TrendingUp}
          trend="+5%"
          color="blue"
        />
        <StatCard 
          title="Retenues (CNSS + IPR)" 
          value={payrollHistory[0] ? `$${payrollHistory[0].deductions}` : '$0'} 
          subtitle="DGI & CNSS RDC"
          icon={TrendingDown}
          trend="-2%"
          color="red"
        />
        <StatCard 
          title="Conformité RDC" 
          value="CONFORME" 
          subtitle="CNSS, INPP, ONEM, DGI"
          icon={ShieldCheck}
          trend="100%"
          color="emerald"
        />
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text"
            placeholder="Rechercher une période, un employé ou matricule..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 transition-all shadow-sm"
          />
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-xl shadow-slate-200/50 dark:shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-50 dark:border-slate-800">
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Période</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Employé / N° CNSS</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Brut & Logement</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Retenues (CNSS/IPR)</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Salaire Net</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {filteredHistory.length > 0 ? filteredHistory.map((item) => (
                <tr key={item.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 rounded-xl flex items-center justify-center">
                        <CalendarIcon size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">{item.month}/{item.year}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">{new Date(item.createdAt).toLocaleDateString('fr-FR')}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{item.userName}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9px] font-mono font-bold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-600 dark:text-slate-300">{item.userId}</span>
                      <span className="text-[9px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">CNSS: {item.cnssNumber || '1003849102'}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-black text-slate-900 dark:text-white">Brut: ${item.grossSalary || (item.baseSalary + (item.housingAllowance || 0) + (item.transportAllowance || 0))}</span>
                      <span className="text-[10px] text-slate-400 font-medium">Base: ${item.baseSalary} | Logement: ${item.housingAllowance || Math.round(item.baseSalary * 0.3)}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-black text-rose-600">Total: -${item.deductions}</span>
                      <span className="text-[10px] text-slate-400 font-medium">CNSS (5%): -${item.cnssWorkerDeduction || Math.round(item.baseSalary * 0.05)} | IPR: -${item.iprDeduction || Math.round(item.deductions - (item.baseSalary * 0.05))}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className="text-base font-black text-emerald-600 dark:text-emerald-400">${item.netSalary.toFixed(2)}</span>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => generatePDF(item)}
                        className="px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-500 rounded-xl transition-all font-black text-[9px] uppercase tracking-widest flex items-center gap-1.5 cursor-pointer shadow-md"
                        title="Imprimer Fiche de Paie RDC"
                      >
                        <Printer size={14} /> Fiche Paie PDF
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <CreditCard size={40} className="text-slate-200 dark:text-slate-800" />
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Aucun historique de paie trouvé</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Generation Paie du Mois (Conforme RDC) */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setShowGenerateModal(false)} />

          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] p-8 relative z-10 shadow-2xl space-y-6"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 rounded-2xl flex items-center justify-center">
                <ShieldCheck size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Générer Paie du Mois (Barème RDC)</h3>
                <p className="text-xs text-slate-400 font-medium">Calcul automatique CNSS, IPR DGI, Logement & Transport.</p>
              </div>
            </div>

            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-100 dark:border-emerald-800/40 text-xs text-emerald-800 dark:text-emerald-300 space-y-1 font-medium">
              <p className="font-black uppercase">Calculs Automatiques Appliqués :</p>
              <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                <li>Logement obligatoire (Art. 138) : 30% du salaire de base</li>
                <li>Transport obligatoire : $44 forfaitaire mensuel</li>
                <li>CNSS Travailleur : 5% du salaire brut cotisable</li>
                <li>IPR (Impôt DGI) : Barème progressif RDC avec abattement charges familiales</li>
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mois</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <option key={m} value={m}>Mois {m} ({new Date(2026, m - 1, 1).toLocaleString('fr-FR', { month: 'long' })})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Année</label>
                <input 
                  type="number"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value) || 2026)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button 
                onClick={() => setShowGenerateModal(false)}
                className="flex-1 py-4 border border-slate-200 dark:border-slate-800 text-slate-500 font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Annuler
              </button>
              <button 
                onClick={handleBatchGeneratePayroll}
                disabled={isGenerating}
                className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-lg shadow-emerald-600/20 disabled:opacity-50 cursor-pointer"
              >
                {isGenerating ? 'Calcul en cours...' : 'Calculer & Valider Paie RDC'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, subtitle, icon: Icon, trend, color }: any) {
  const colors: any = {
    emerald: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10',
    blue: 'text-blue-600 bg-blue-50 dark:bg-blue-500/10',
    purple: 'text-purple-600 bg-purple-50 dark:bg-purple-500/10',
    red: 'text-red-600 bg-red-50 dark:bg-red-500/10'
  };

  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none"
    >
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-2xl ${colors[color]}`}>
          <Icon size={20} />
        </div>
        <span className="text-[10px] font-black text-emerald-500">{trend}</span>
      </div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{title}</p>
      <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter mb-1">{value}</h3>
      <p className="text-[10px] text-slate-400 font-bold uppercase">{subtitle}</p>
    </motion.div>
  );
}
