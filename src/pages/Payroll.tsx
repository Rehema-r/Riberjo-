import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, getDocs, limit, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Payroll } from '../types';
import { DollarSign, Download, TrendingUp, TrendingDown, CreditCard, PieChart, FileText, Calendar as CalendarIcon, CheckCircle2, Search, Printer } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function PayrollPage() {
  const { profile } = useAuth();
  const [payrollHistory, setPayrollHistory] = useState<Payroll[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!profile) return;

    // Use matricule for users, or fetch all for admins/board members
    const q = profile.role === 'SUPER_ADMIN' || profile.role === 'ADMIN' || profile.role === 'BOARD_MEMBER' || profile.departmentId === '03' || profile.departmentId === '04'
      ? query(collection(db, 'payroll'), orderBy('createdAt', 'desc'), limit(50))
      : query(collection(db, 'payroll'), where('userId', '==', profile.matricule), orderBy('createdAt', 'desc'), limit(12));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const records = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Payroll));
      setPayrollHistory(records);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [profile]);

  const generatePDF = (item: Payroll) => {
    const doc = new jsPDF() as any;
    
    // Header
    doc.setFontSize(22);
    doc.setTextColor(16, 185, 129); // Emerald
    doc.text('RIBERJO - FICHE DE PAIE', 105, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Période: ${item.month}/${item.year}`, 105, 30, { align: 'center' });
    
    // Employee Info
    doc.setTextColor(0);
    doc.setFontSize(12);
    doc.text('INFORMATIONS EMPLOYÉ', 20, 50);
    doc.setFontSize(10);
    doc.text(`Nom Complet: ${item.userName}`, 20, 60);
    doc.text(`Matricule: ${item.userId}`, 20, 65);
    
    // Table
    doc.autoTable({
      startY: 80,
      head: [['Désignation', 'Gains ($)', 'Retenues ($)']],
      body: [
        ['Salaire de Base', item.baseSalary.toFixed(2), '0.00'],
        ['Primes', item.primes.toFixed(2), '0.00'],
        ['Déductions', '0.00', item.deductions.toFixed(2)],
        [{ content: 'NET À PAYER', styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }, 
         { content: `$${item.netSalary.toFixed(2)}`, colSpan: 2, styles: { fontStyle: 'bold', halign: 'right', fillColor: [240, 240, 240] } }]
      ],
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129] }
    });
    
    // Footer
    const finalY = (doc as any).lastAutoTable.finalY || 150;
    doc.setFontSize(8);
    doc.text('Signature de la Direction', 20, finalY + 30);
    doc.text('Signature de l\'Employé', 150, finalY + 30);
    doc.text('Document généré numériquement par le système RIBERJO ERP.', 105, 280, { align: 'center' });
    
    doc.save(`Fiche_Paie_${item.userId}_${item.month}_${item.year}.pdf`);
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
          <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Paie & Salaires</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Gestion des rémunérations et fiches de paie.</p>
        </div>
        <div className="flex items-center gap-3">
          {profile?.role !== 'BOARD_MEMBER' && (profile?.role === 'SUPER_ADMIN' || profile?.departmentId === 'all' || profile?.departmentId === '03' || profile?.departmentId === '04') && (
            <button className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-lg transition-all flex items-center gap-2">
              <DollarSign size={16} /> Générer Paie du Mois
            </button>
          )}
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Salaire de Base" 
          value={`$${profile?.baseSalary || 150}`} 
          subtitle="Montant contractuel"
          icon={CreditCard}
          trend="+0%"
          color="emerald"
        />
        <StatCard 
          title="Dernier Paiement" 
          value={payrollHistory[0] ? `$${payrollHistory[0].netSalary}` : '$0'} 
          subtitle={payrollHistory[0] ? payrollHistory[0].period : 'Aucun'}
          icon={TrendingUp}
          trend="+5%"
          color="blue"
        />
        <StatCard 
          title="Total Déductions" 
          value={payrollHistory[0] ? `$${payrollHistory[0].deductions}` : '$0'} 
          subtitle="Retenues diverses"
          icon={TrendingDown}
          trend="-2%"
          color="red"
        />
        <StatCard 
          title="Statut de Paie" 
          value="EN RÈGLE" 
          subtitle="Prochaine: 25 Mai"
          icon={CheckCircle2}
          trend=""
          color="emerald"
        />
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text"
            placeholder="Rechercher une période ou un employé..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 transition-all shadow-sm"
          />
        </div>
        <div className="flex gap-2">
          <button className="p-4 bg-white dark:bg-slate-900 rounded-[1.5rem] border border-slate-100 dark:border-slate-800 text-slate-400 hover:text-emerald-600 transition-all shadow-sm">
            <Filter size={20} />
          </button>
          <button className="p-4 bg-white dark:bg-slate-900 rounded-[1.5rem] border border-slate-100 dark:border-slate-800 text-slate-400 hover:text-emerald-600 transition-all shadow-sm">
            <Download size={20} />
          </button>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-xl shadow-slate-200/50 dark:shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-50 dark:border-slate-800">
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Période</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Employé</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Salaire Net</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Éléments</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Statut</th>
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
                    <p className="text-xs font-mono text-slate-400">{item.userId}</p>
                  </td>
                  <td className="px-8 py-6">
                    <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">${item.netSalary.toFixed(2)}</span>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-slate-500">Base: ${item.baseSalary}</span>
                      <span className="text-[10px] font-bold text-blue-500">Primes: +${item.primes}</span>
                      <span className="text-[10px] font-bold text-red-500">Déduc: -${item.deductions}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      item.status === 'paid' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10' : 'bg-yellow-50 text-yellow-600 dark:bg-yellow-500/10'
                    }`}>
                      {item.status === 'paid' ? 'Payé' : 'En attente'}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => generatePDF(item)}
                        className="p-3 bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-emerald-600 rounded-xl transition-all"
                        title="Imprimer Fiche de Paie"
                      >
                        <Printer size={18} />
                      </button>
                      <button className="p-3 bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-emerald-600 rounded-xl transition-all">
                        <FileText size={18} />
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

function Filter({ size, className }: { size: number, className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}
