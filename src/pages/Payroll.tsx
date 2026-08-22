import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, getDocs, limit } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Payroll, UserProfile } from '../types';
import { DollarSign, Download, TrendingUp, TrendingDown, CreditCard, FileText, Calendar as CalendarIcon, CheckCircle2, Search, Printer, ShieldCheck, Calculator, Lock, Sliders, Shield, AlertTriangle, UserCheck, Percent } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export function calculateCongolesePayroll(
  baseSalary: number,
  housingAllowance: number = 0,
  transportAllowance: number = 0,
  primes: number = 0,
  dependentsCount: number = 0,
  customDeductions: number = 0,
  cnssWorkerRate: number = 0.05,
  housingRatePct: number = 0.30
) {
  // En RDC, selon le Code du Travail (Art 138):
  // Logement obligatoire: min 30% du salaire de base si non fourni
  const actualHousing = housingAllowance > 0 ? housingAllowance : Math.round(baseSalary * housingRatePct);
  // Transport: allocation forfaitaire de transport (ex: $2/jour x 22 jours = $44)
  const actualTransport = transportAllowance > 0 ? transportAllowance : 44;
  // Allocations Familiales CNSS (ex: $5 par enfant)
  const familyAllowances = dependentsCount * 5;

  // Salaire Brut Total (Gains + Avantages)
  const grossSalary = baseSalary + actualHousing + actualTransport + primes + familyAllowances;

  // 1. CNSS Travailleur (5% du brut cotisable)
  const cnssWorkerDeduction = Math.round(grossSalary * cnssWorkerRate * 100) / 100;

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

  // Total Déductions & Réductions Travailleur
  const totalDeductions = Math.round((cnssWorkerDeduction + iprDeduction + customDeductions) * 100) / 100;

  // Salaire Net à payer
  const netSalary = Math.round(Math.max(0, grossSalary - totalDeductions) * 100) / 100;

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
    customDeductions,
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
  
  // Strict check: Only Finance Director & Chief Accountant (or Super Admin/DG) can generate payroll, taxes, reductions & benefits
  const isFinanceDirector = 
    profile?.role === 'SUPER_ADMIN' || 
    (profile?.departmentId === '04' && (profile?.role === 'ADMIN' || profile?.role === 'SUPER_USER')) ||
    (profile?.role === 'ADMIN' && profile?.departmentId === 'all') ||
    profile?.matricule === '26/RBJ-SU-04-001' ||
    profile?.matricule?.includes('SU-04') ||
    profile?.matricule?.includes('AD-04') ||
    profile?.matricule === '26/RBJ-DG-01';

  // Batch Payroll Generation Modal States
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState<'period' | 'advantages' | 'taxes' | 'reductions' | 'preview'>('period');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [isGenerating, setIsGenerating] = useState(false);

  // Dynamic Finance Configuration States (Configurable by Finance Director)
  const [housingRatePct, setHousingRatePct] = useState<number>(0.30); // 30% légal
  const [transportRateFlat, setTransportRateFlat] = useState<number>(44); // $44 forfait légal
  const [globalPrimes, setGlobalPrimes] = useState<number>(0); // Primes exceptionnelles
  const [cnssWorkerRate, setCnssWorkerRate] = useState<number>(0.05); // 5% CNSS
  const [globalCustomDeductions, setGlobalCustomDeductions] = useState<number>(0); // Réductions/Acomptes

  // Employees cache for live preview in modal
  const [employeesList, setEmployeesList] = useState<UserProfile[]>([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);

  useEffect(() => {
    if (!profile) return;

    // View scope: Finance & Super Admins see all, employees see only their personal slips
    const q = isFinanceDirector || profile.role === 'BOARD_MEMBER' || profile.role === 'SUPER_ADMIN'
      ? query(collection(db, 'payroll'), orderBy('createdAt', 'desc'), limit(100))
      : query(collection(db, 'payroll'), where('userId', '==', profile.matricule), orderBy('createdAt', 'desc'), limit(20));

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
  }, [profile, isFinanceDirector]);

  const loadEmployeesForModal = async () => {
    setIsLoadingEmployees(true);
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const list = usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as UserProfile));
      setEmployeesList(list);
    } catch (e) {
      console.warn("Could not fetch employees for preview:", e);
    } finally {
      setIsLoadingEmployees(false);
    }
  };

  const handleOpenModal = () => {
    if (!isFinanceDirector) {
      alert("Accès refusé : Seul le Directeur du Département de Finance & Comptabilité peut configurer et générer les paiements, réductions, taxes et avantages.");
      return;
    }
    loadEmployeesForModal();
    setShowGenerateModal(true);
    setActiveModalTab('period');
  };

  const handleBatchGeneratePayroll = async () => {
    if (!isFinanceDirector) {
      alert("Accès restreint à la Direction Finance & Comptabilité.");
      return;
    }

    setIsGenerating(true);
    try {
      const employees = employeesList.length > 0 ? employeesList : (await getDocs(collection(db, 'users'))).docs.map(d => ({ id: d.id, ...d.data() } as UserProfile));

      if (employees.length === 0) {
        alert("Aucun employé trouvé dans la base de données.");
        setIsGenerating(false);
        return;
      }

      let generatedCount = 0;
      for (const emp of employees) {
        const base = emp.baseSalary || 250;
        const housing = emp.housingAllowance || Math.round(base * housingRatePct);
        const transport = emp.transportAllowance || transportRateFlat;
        const dependents = emp.dependentsCount || 0;
        const primes = (emp.primes || 0) + globalPrimes;
        const reductions = globalCustomDeductions;

        const calc = calculateCongolesePayroll(
          base, 
          housing, 
          transport, 
          primes, 
          dependents, 
          reductions, 
          cnssWorkerRate, 
          housingRatePct
        );

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
          customDeductions: calc.customDeductions,
          cnssEmployerContribution: calc.cnssEmployerContribution,
          inppContribution: calc.inppContribution,
          onemContribution: calc.onemContribution,
          deductions: calc.totalDeductions,
          netSalary: calc.netSalary,
          validatedBy: profile?.fullName || 'Directeur Finance & Comptabilité',
          validatorRole: 'Directeur du Département Finance & Comptable',
          status: 'paid',
          paymentDate: Date.now(),
          createdAt: Date.now()
        });
        generatedCount++;
      }

      alert(`Paiement et bulletins du mois ${selectedMonth}/${selectedYear} officiellement ordonnancés et validés par la Direction Finance pour ${generatedCount} collaborateurs (Conforme Code du Travail RDC, DGI & CNSS) !`);
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
    doc.text(`Statut Fiscal: Imposable RDC (DGI)`, 120, 69);
    doc.text(`Date de Paiement: ${new Date(item.paymentDate || item.createdAt).toLocaleDateString('fr-FR')}`, 120, 75);

    // Payroll Calculation Table
    const gross = item.grossSalary || (item.baseSalary + (item.housingAllowance || 0) + (item.transportAllowance || 0) + (item.primes || 0));
    const housing = item.housingAllowance || Math.round(item.baseSalary * 0.30);
    const transport = item.transportAllowance || 44;
    const cnssWorker = item.cnssWorkerDeduction || Math.round(gross * 0.05);
    const ipr = item.iprDeduction || Math.round(item.deductions - cnssWorker);

    autoTable(doc, {
      startY: 82,
      head: [['Désignation de la Rubrique (Avantages / Taxes / Réductions)', 'Base de Calcul', 'Gains ($)', 'Retenues ($)']],
      body: [
        ['Salaire de Base Contractuel', '$' + item.baseSalary.toFixed(2), '$' + item.baseSalary.toFixed(2), '-'],
        ['Indemnité de Logement (Art. 138 Code du Travail)', '30% Base', '$' + housing.toFixed(2), '-'],
        ['Indemnité de Transport (Forfaitaire Légal)', '22 Jours', '$' + transport.toFixed(2), '-'],
        ['Allocations Familiales CNSS', 'Enfants', '$' + (item.familyAllowances || 0).toFixed(2), '-'],
        ['Primes / Gratifications du mois', 'Fixe', '$' + (item.primes || 0).toFixed(2), '-'],
        [{ content: 'TOTAL SALAIRE BRUT IMPOSABLE', styles: { fontStyle: 'bold', fillColor: [240, 253, 244] } }, '-', { content: '$' + gross.toFixed(2), styles: { fontStyle: 'bold', fillColor: [240, 253, 244] } }, '-'],
        ['Cotisation CNSS Travailleur (Branche Pensions)', '5% Brut', '-', '$' + cnssWorker.toFixed(2)],
        ['Impôt sur le Revenu Professionnel (IPR - DGI)', 'Barème RDC', '-', '$' + ipr.toFixed(2)],
        ...(item.customDeductions ? [['Réductions & Déductions Diverses', 'Acomptes', '-', '$' + item.customDeductions.toFixed(2)]] : []),
        [{ content: 'TOTAL DÉDUCTIONS & TAXES', styles: { fontStyle: 'bold', fillColor: [254, 242, 242] } }, '-', '-', { content: '$' + item.deductions.toFixed(2), styles: { fontStyle: 'bold', fillColor: [254, 242, 242] } }],
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

    // Official Finance Seal & Validation
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text('Direction Finance & Comptabilité (Ordonnateur)', 20, finalY + 32);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Validé par : ${item.validatedBy || 'Chef Comptable & Dir. Finance'}`, 20, finalY + 37);

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text('Signature du Travailleur', 140, finalY + 32);

    doc.setFontSize(7);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(120);
    doc.text('Document conforme au Code du Travail RDC (Loi n° 015/2002). Ordonnancé et certifié par la Direction Finance & Comptabilité.', 105, 285, { align: 'center' });
    
    doc.save(`Fiche_Paie_RDC_${item.userId}_${item.month}_${item.year}.pdf`);
  };

  const filteredHistory = payrollHistory.filter(p => 
    p.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.userId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    `${p.month}/${p.year}`.includes(searchTerm)
  );

  // Calculation totals for preview in modal
  const simulatedPayroll = employeesList.map(emp => {
    const base = emp.baseSalary || 250;
    const housing = emp.housingAllowance || Math.round(base * housingRatePct);
    const transport = emp.transportAllowance || transportRateFlat;
    const dependents = emp.dependentsCount || 0;
    const primes = (emp.primes || 0) + globalPrimes;
    const reductions = globalCustomDeductions;
    const calc = calculateCongolesePayroll(base, housing, transport, primes, dependents, reductions, cnssWorkerRate, housingRatePct);
    return {
      emp,
      ...calc
    };
  });

  const totalSimulatedNet = simulatedPayroll.reduce((acc, curr) => acc + curr.netSalary, 0);
  const totalSimulatedGross = simulatedPayroll.reduce((acc, curr) => acc + curr.grossSalary, 0);
  const totalSimulatedTaxes = simulatedPayroll.reduce((acc, curr) => acc + curr.totalDeductions, 0);

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
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Paie & Salaires (RDC)</h1>
            {isFinanceDirector ? (
              <span className="px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full text-[9px] font-black uppercase tracking-wider border border-emerald-500/20 flex items-center gap-1">
                <ShieldCheck size={13} /> Ordonnateur : Direction Finance & Comptable
              </span>
            ) : (
              <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-full text-[9px] font-black uppercase tracking-wider">
                Consultation Salarié
              </span>
            )}
          </div>
          <p className="text-slate-500 dark:text-slate-400 font-medium text-xs">
            Gestion des rémunérations, taxes (IPR/CNSS), avantages légaux et réductions ordonnancés par le Directeur de Finance & Comptabilité.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isFinanceDirector ? (
            <button 
              onClick={handleOpenModal}
              className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <Calculator size={16} /> Générer Paie, Taxes & Avantages
            </button>
          ) : (
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-400 text-[10px] font-bold uppercase tracking-wider">
              <Lock size={13} className="text-amber-500" /> Paiements gérés par la Direction Finance
            </div>
          )}
        </div>
      </div>

      {/* Role Notice Banner */}
      {!isFinanceDirector && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-2xl flex items-center gap-3 text-amber-800 dark:text-amber-300">
          <Shield size={20} className="shrink-0 text-amber-500" />
          <div className="text-xs">
            <span className="font-black uppercase">Sécurité des Rémunérations : </span>
            <span>La génération des paiements, le paramétrage des taxes (IPR, CNSS), des réductions et des avantages relève de la compétence exclusive du <strong>Directeur du Département Finance et Comptable</strong>. Vous pouvez consulter et imprimer vos fiches de paie certifiées ci-dessous.</span>
          </div>
        </div>
      )}

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
          title="Retenues & Taxes (CNSS + IPR)" 
          value={payrollHistory[0] ? `$${payrollHistory[0].deductions}` : '$0'} 
          subtitle="DGI & CNSS RDC"
          icon={TrendingDown}
          trend="-2%"
          color="red"
        />
        <StatCard 
          title="Validation & Conformité" 
          value="DIRECTEUR FINANCE" 
          subtitle="Conforme DGI, CNSS & INPP"
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
              <tr className="border-b border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Période</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Employé & Immatriculation</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Brut & Avantages</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Taxes & Retenues</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Salaire Net</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Visa Finance</th>
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
                  <td className="px-8 py-6">
                    <span className="text-[9px] font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700">
                      {item.validatedBy || 'Directeur Finance'}
                    </span>
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
                  <td colSpan={7} className="px-8 py-20 text-center">
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

      {/* Modal Generation & Paramétrage Direction Finance & Comptabilité */}
      {showGenerateModal && isFinanceDirector && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md" onClick={() => setShowGenerateModal(false)} />

          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-[2.5rem] p-8 relative z-10 shadow-2xl space-y-6 my-8 max-h-[90vh] flex flex-col"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 rounded-2xl flex items-center justify-center">
                  <ShieldCheck size={26} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                    Ordonnancement Paie, Taxes, Réductions & Avantages
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">
                    Espace Réservé : Directeur du Département Finance & Comptable (Code du Travail RDC & DGI)
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowGenerateModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white text-xl font-black"
              >
                ✕
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex flex-wrap gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
              {[
                { id: 'period', label: '1. Période', icon: CalendarIcon },
                { id: 'advantages', label: '2. Avantages & Primes', icon: TrendingUp },
                { id: 'taxes', label: '3. Taxes & Fiscalité (DGI/CNSS)', icon: Percent },
                { id: 'reductions', label: '4. Réductions & Déductions', icon: TrendingDown },
                { id: 'preview', label: `5. Prévisualisation (${employeesList.length})`, icon: Sliders }
              ].map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveModalTab(tab.id as any)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                      activeModalTab === tab.id
                        ? 'bg-emerald-600 text-white shadow-md'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                    }`}
                  >
                    <Icon size={14} /> {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Tab Contents */}
            <div className="overflow-y-auto flex-1 pr-1 space-y-4">
              {activeModalTab === 'period' && (
                <div className="space-y-6">
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-100 dark:border-emerald-800/40 text-xs text-emerald-800 dark:text-emerald-300">
                    <p className="font-black uppercase mb-1">Période d'imposition et d'ordonnancement :</p>
                    <p>Définissez le mois et l'année pour lesquels la direction financière calcule les rémunérations et prélèvements légaux.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mois de Paie</label>
                      <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold"
                      >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                          <option key={m} value={m}>Mois {m} - {new Date(2026, m - 1, 1).toLocaleString('fr-FR', { month: 'long' })}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Année d'Exercice</label>
                      <input 
                        type="number"
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(parseInt(e.target.value) || 2026)}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold"
                      >
                      </input>
                    </div>
                  </div>
                </div>
              )}

              {activeModalTab === 'advantages' && (
                <div className="space-y-6">
                  <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-2xl border border-blue-100 dark:border-blue-800/40 text-xs text-blue-800 dark:text-blue-300">
                    <p className="font-black uppercase mb-1">Avantages & Gains Additionnels (Légaux RDC & Entreprise) :</p>
                    <p>Paramétrez les taux d'indemnité et gratifications qui viennent s'ajouter au salaire de base pour former le salaire brut imposable.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl space-y-2">
                      <label className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase">
                        Indemnité de Logement (Art. 138 Code Travail)
                      </label>
                      <div className="flex items-center gap-2">
                        <input 
                          type="number"
                          step="0.05"
                          min="0.10"
                          max="1.0"
                          value={housingRatePct}
                          onChange={(e) => setHousingRatePct(parseFloat(e.target.value) || 0.30)}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-sm"
                        />
                        <span className="text-xs font-bold text-slate-400">({Math.round(housingRatePct * 100)}% de la Base)</span>
                      </div>
                      <p className="text-[10px] text-slate-400">Minimum légal RDC : 30% du salaire contractuel.</p>
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl space-y-2">
                      <label className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase">
                        Indemnité de Transport Forfaitaire ($)
                      </label>
                      <input 
                        type="number"
                        min="0"
                        value={transportRateFlat}
                        onChange={(e) => setTransportRateFlat(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-sm"
                      />
                      <p className="text-[10px] text-slate-400">Forfait légal mensuel standard (22 jours de transport).</p>
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl space-y-2 sm:col-span-2">
                      <label className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase">
                        Primes & Gratifications Exceptionnelles Générales ($)
                      </label>
                      <input 
                        type="number"
                        min="0"
                        value={globalPrimes}
                        onChange={(e) => setGlobalPrimes(parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-sm"
                      />
                      <p className="text-[10px] text-slate-400">Bonus de performance global appliqué pour ce mois à tous les employés.</p>
                    </div>
                  </div>
                </div>
              )}

              {activeModalTab === 'taxes' && (
                <div className="space-y-6">
                  <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-2xl border border-red-100 dark:border-red-800/40 text-xs text-red-800 dark:text-red-300">
                    <p className="font-black uppercase mb-1">Réglementation Fiscale & Sociale (DGI & CNSS RDC) :</p>
                    <p>Prélèvements obligatoires à la source sur le travailleur et cotisations patronales à la charge de l'entreprise.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl space-y-2">
                      <label className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase">
                        Cotisation CNSS Salarié (%)
                      </label>
                      <input 
                        type="number"
                        step="0.01"
                        min="0"
                        max="0.2"
                        value={cnssWorkerRate}
                        onChange={(e) => setCnssWorkerRate(parseFloat(e.target.value) || 0.05)}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-sm"
                      />
                      <p className="text-[10px] text-slate-400">Taux légal CNSS branche pensions : 5% du brut cotisable.</p>
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl space-y-2">
                      <label className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase">
                        Barème IPR DGI (Impôt Professionnel)
                      </label>
                      <div className="p-2 bg-white dark:bg-slate-900 rounded-xl text-[10px] font-mono text-slate-600 dark:text-slate-300 space-y-0.5">
                        <p>• Tranche &le; 100$ : 3%</p>
                        <p>• 100$ à 300$ : 10%</p>
                        <p>• 300$ à 800$ : 15%</p>
                        <p>• 800$ à 2000$ : 22%</p>
                        <p>• &gt; 2000$ : 30%</p>
                      </div>
                      <p className="text-[10px] text-slate-400">Abattement de 2% par personne à charge (max 18%).</p>
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl space-y-1 sm:col-span-2 text-xs">
                      <p className="font-black text-slate-700 dark:text-slate-200 uppercase mb-1">Charges Patronales Employeur (Informations déclaratives) :</p>
                      <p className="text-slate-500">• CNSS Employeur : 13% du salaire brut</p>
                      <p className="text-slate-500">• INPP : 2% du salaire brut</p>
                      <p className="text-slate-500">• ONEM : 0.2% du salaire brut</p>
                    </div>
                  </div>
                </div>
              )}

              {activeModalTab === 'reductions' && (
                <div className="space-y-6">
                  <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-2xl border border-amber-100 dark:border-amber-800/40 text-xs text-amber-800 dark:text-amber-300">
                    <p className="font-black uppercase mb-1">Réductions Spécifiques & Déductions sur Salaire :</p>
                    <p>Gérez les remboursements d'acomptes, les déductions pour avances sur salaire ou retenues autorisées par la Finance.</p>
                  </div>

                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl space-y-2">
                    <label className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase">
                      Retenue / Déduction Générale d'Avance ($)
                    </label>
                    <input 
                      type="number"
                      min="0"
                      value={globalCustomDeductions}
                      onChange={(e) => setGlobalCustomDeductions(parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-sm"
                    />
                    <p className="text-[10px] text-slate-400">Montant déduit sur chaque fiche au titre d'avance ou cotisation conventionnelle.</p>
                  </div>
                </div>
              )}

              {activeModalTab === 'preview' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-800">
                    <div>
                      <span className="text-[10px] font-black uppercase text-emerald-800 dark:text-emerald-300 tracking-wider">Masse Salariale Nette Totale :</span>
                      <h4 className="text-2xl font-black text-emerald-600 dark:text-emerald-400">${totalSimulatedNet.toFixed(2)}</h4>
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Masse Brute :</span>
                      <h4 className="text-lg font-black text-slate-700 dark:text-slate-300">${totalSimulatedGross.toFixed(2)}</h4>
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase text-rose-500 tracking-wider">Taxes & Retenues Totales :</span>
                      <h4 className="text-lg font-black text-rose-600">-${totalSimulatedTaxes.toFixed(2)}</h4>
                    </div>
                  </div>

                  <div className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden max-h-[280px] overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800 text-[9px] uppercase font-black text-slate-400 sticky top-0">
                        <tr>
                          <th className="p-3">Employé</th>
                          <th className="p-3">Base</th>
                          <th className="p-3">Avantages</th>
                          <th className="p-3">Brut</th>
                          <th className="p-3">Retenues</th>
                          <th className="p-3 text-right">Net à Payer</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                        {simulatedPayroll.map((sim, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                            <td className="p-3">
                              <p className="font-bold text-slate-800 dark:text-slate-200">{sim.emp.fullName}</p>
                              <span className="text-[9px] font-mono text-slate-400">{sim.emp.matricule || sim.emp.id}</span>
                            </td>
                            <td className="p-3">${sim.baseSalary}</td>
                            <td className="p-3 text-emerald-600">+${sim.housingAllowance + sim.transportAllowance + sim.primes + sim.familyAllowances}</td>
                            <td className="p-3 font-bold">${sim.grossSalary}</td>
                            <td className="p-3 text-rose-600">-${sim.totalDeductions}</td>
                            <td className="p-3 text-right font-black text-emerald-600">${sim.netSalary}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions Footer */}
            <div className="flex items-center justify-between gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button 
                type="button"
                onClick={() => setShowGenerateModal(false)}
                className="px-6 py-3 border border-slate-200 dark:border-slate-800 text-slate-500 font-black text-xs uppercase tracking-wider rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Annuler
              </button>
              
              <div className="flex items-center gap-2">
                {activeModalTab !== 'preview' ? (
                  <button
                    type="button"
                    onClick={() => {
                      const tabs: ('period' | 'advantages' | 'taxes' | 'reductions' | 'preview')[] = ['period', 'advantages', 'taxes', 'reductions', 'preview'];
                      const nextIndex = tabs.indexOf(activeModalTab) + 1;
                      if (nextIndex < tabs.length) {
                        setActiveModalTab(tabs[nextIndex]);
                      }
                    }}
                    className="px-6 py-3 bg-slate-900 dark:bg-slate-700 text-white font-black text-xs uppercase tracking-wider rounded-2xl hover:bg-slate-800"
                  >
                    Suivant &rarr;
                  </button>
                ) : (
                  <button 
                    type="button"
                    onClick={handleBatchGeneratePayroll}
                    disabled={isGenerating}
                    className="px-8 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl shadow-emerald-600/30 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                  >
                    <CheckCircle2 size={16} />
                    {isGenerating ? 'Calcul & Ordonnancement...' : 'Valider & Ordonnancer les Paiements (Direction Finance)'}
                  </button>
                )}
              </div>
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

