import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { CreditCard, ArrowUpRight, ArrowDownLeft, DollarSign, Wallet, FileCheck, Search, Filter, PieChart, BarChart3 } from 'lucide-react';
import { collection, query, orderBy, onSnapshot, limit, addDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { FinanceTransaction } from '../../types';
import { motion } from 'motion/react';

export default function FinanceView({ activeSpace = 'USER' }: { activeSpace?: 'USER' | 'SUPER_USER' | 'ADMIN' }) {
  const { profile } = useAuth();
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTransaction, setNewTransaction] = useState({
    type: 'income',
    category: 'Vente',
    amount: 0,
    description: '',
    status: 'pending'
  });

  // User Space (Claims and advances requests)
  const [claimAmount, setClaimAmount] = useState<number>(0);
  const [claimDesc, setClaimDesc] = useState<string>('');
  const [claimCat, setClaimCat] = useState<string>('Transport');
  const [claimsList, setClaimsList] = useState<any[]>([]);
  const [isSubmittingClaim, setIsSubmittingClaim] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'finance_transactions'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FinanceTransaction)));
    }, (error) => {
      console.warn("FinanceView transactions onSnapshot operates in local cache mode:", error.message);
      handleFirestoreError(error, OperationType.LIST, 'finance_transactions');
    });

    const qClaims = query(
      collection(db, 'finance_claims'),
      orderBy('createdAt', 'desc')
    );
    const unsubscribeClaims = onSnapshot(qClaims, (snapshot) => {
      setClaimsList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.warn("FinanceView claims onSnapshot operates in local cache mode:", error.message);
      handleFirestoreError(error, OperationType.LIST, 'finance_claims');
    });

    return () => {
      unsubscribe();
      unsubscribeClaims();
    };
  }, []);

  const handleClaimReimbursement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setIsSubmittingClaim(true);
    try {
      await addDoc(collection(db, 'finance_claims'), {
        amount: claimAmount,
        description: claimDesc,
        category: claimCat,
        authorName: profile.fullName,
        authorId: profile.id,
        status: 'pending',
        createdAt: Date.now()
      });
      alert("Note de frais soumise avec succès aux comptables !");
      setClaimAmount(0);
      setClaimDesc('');
    } catch (err) {
      console.error("Error creating claim:", err);
    } finally {
      setIsSubmittingClaim(false);
    }
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    try {
      await addDoc(collection(db, 'finance_transactions'), {
        ...newTransaction,
        authorId: profile.id,
        authorName: profile.fullName,
        createdAt: Date.now()
      });
      setShowAddModal(false);
      setNewTransaction({ type: 'income', category: 'Vente', amount: 0, description: '', status: 'pending' });
    } catch (err) {
      console.error("Error adding transaction:", err);
    }
  };

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);

  // Month calculation
  const now = new Date();
  const currentMonthName = now.toLocaleString('fr-FR', { month: 'long' });
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const expenseByCategory = transactions
    .filter(t => {
      const date = new Date(t.createdAt);
      return t.type === 'expense' && date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    })
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);

  const chartData = Object.entries(expenseByCategory).map(([name, amount]) => ({
    name,
    amount
  })).sort((a, b) => b.amount - a.amount);

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {activeSpace === 'USER' ? (
        /* Collaborator / Agent Space */
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Finance & Comptabilité</h1>
            <p className="text-slate-500 font-medium">Espace Collaborateur : Saisie des notes de frais, demandes de remboursement et avances de frais.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              {/* Note de frais request form */}
              <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-8 shadow-sm">
                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight mb-6 flex items-center gap-2">
                  <CreditCard className="text-blue-600" size={24} /> Déclarer une Note de Frais
                </h3>

                <form onSubmit={handleClaimReimbursement} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Montant ($)</label>
                      <input 
                        type="number"
                        required
                        value={claimAmount || ''}
                        onChange={(e) => setClaimAmount(parseFloat(e.target.value) || 0)}
                        placeholder="Ex: 120"
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Catégorie de Frais</label>
                      <select
                        value={claimCat}
                        onChange={(e) => setClaimCat(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold"
                      >
                        <option value="Transport">Transport / Carburant</option>
                        <option value="Repas">Restauration / Mission</option>
                        <option value="Hébergement">Hébergement</option>
                        <option value="Matériel">Petit Outillage / Matériel</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Description / Justification</label>
                    <input 
                      type="text"
                      required
                      value={claimDesc}
                      onChange={(e) => setClaimDesc(e.target.value)}
                      placeholder="Ex: Plein gasoil tracteur lors du transport de semences"
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingClaim}
                    className="flex items-center justify-center gap-2 w-full py-4 bg-slate-900 dark:bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-slate-800 dark:hover:bg-blue-700 transition shadow-lg shadow-blue-600/20"
                  >
                    {isSubmittingClaim ? 'Traitement...' : 'Envoyer ma note de frais'}
                  </button>
                </form>
              </div>

              {/* Claims History logs */}
              <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-8 shadow-sm">
                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight mb-4">Mes Demandes Récentes</h3>
                <p className="text-xs text-slate-400 font-medium mb-6">Consultez l'historique et le statut de remboursement de vos notes de frais.</p>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50/50 dark:bg-slate-800/10 border-b border-slate-100 dark:border-slate-800">
                        <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Justification</th>
                        <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Catégorie</th>
                        <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Montant</th>
                        <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-805">
                      {claimsList.filter(c => c.authorId === profile?.id).map((c) => (
                        <tr key={c.id} className="text-xs">
                          <td className="px-6 py-4 font-bold text-slate-900 dark:text-white uppercase">{c.description}</td>
                          <td className="px-6 py-4 font-bold text-slate-550">{c.category}</td>
                          <td className="px-6 py-4 text-right font-black text-blue-600">${c.amount}</td>
                          <td className="px-6 py-4">
                            <div className="flex justify-center">
                              <span className={`text-[8px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest ${
                                c.status === 'validated' ? 'bg-emerald-100 text-emerald-700' :
                                c.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                              }`}>
                                {c.status === 'validated' ? 'Payé' : c.status === 'rejected' ? 'Refusé' : 'En attente'}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {claimsList.filter(c => c.authorId === profile?.id).length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-10 text-center text-slate-400 font-black text-[9px] uppercase tracking-widest">Aucun remboursement demandé actuellement.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {/* Daily remaining or advances stats card */}
              <div className="bg-blue-950 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl">
                <h3 className="text-lg font-black uppercase tracking-tight mb-4 flex items-center gap-2">
                  <Wallet className="text-blue-400" size={24} /> Avance de Trésorerie
                </h3>
                <p className="text-xs text-slate-400 font-medium leading-relaxed mb-6">
                  Vous pouvez solliciter une avance sur frais de déplacement ou de mission directement auprès du service comptable.
                </p>

                <div className="p-5 bg-white/5 rounded-3xl border border-white/10 mb-6">
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Plafond Autorisé</p>
                  <p className="text-3xl font-black text-white mt-1">$500</p>
                  <p className="text-[9px] text-slate-400 mt-2 font-mono">Renouvelable après validation des justificatifs de la mission précédente.</p>
                </div>

                <button
                  onClick={() => alert("Demande d'avance transférée à votre responsable de service.")}
                  className="w-full py-4 bg-blue-500 text-white hover:bg-blue-600 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-blue-500/10 text-center"
                >
                  Solliciter une Avance de $200
                </button>
                <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl"></div>
              </div>

              {/* Policy note */}
              <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-8 shadow-sm">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Charte de Remboursement</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-sans">
                  Veillez à conserver les photos ou reçus numériques de chaque achat de carburant ou équipement. Les demandes non justifiées seront renvoyées au collaborateur pour précision.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Original Administrative Dashboard */
        <>
          <div className="flex justify-between items-end">
            <div>
              <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Finance & Comptabilité</h1>
              <p className="text-slate-500 font-medium">Espace Expert : Gestion globale des flux monétaires, budgets et validations.</p>
            </div>
            <button 
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-6 py-3 bg-slate-900 dark:bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-emerald-700 transition-all shadow-lg active:scale-95"
            >
              <CreditCard size={16} /> Nouvelle Opération
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-emerald-600 rounded-[2.5rem] p-8 text-white shadow-xl relative overflow-hidden"
          >
            <div className="relative z-10">
              <div className="p-3 bg-white/10 w-fit rounded-2xl mb-8">
                <ArrowUpRight size={24} />
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-1">Revenus Totaux (Période)</p>
              <h2 className="text-4xl font-black">${totalIncome.toLocaleString()}</h2>
              <div className="mt-8 pt-6 border-t border-white/10 flex justify-between items-center">
                <p className="text-[9px] font-bold uppercase tracking-widest">+12.4% vs mois dernier</p>
                <div className="h-2 w-24 bg-white/10 rounded-full">
                  <div className="h-full w-2/3 bg-white rounded-full"></div>
                </div>
              </div>
            </div>
            <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full blur-3xl -mr-24 -mt-24"></div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden"
          >
            <div className="relative z-10">
              <div className="p-3 bg-red-50 dark:bg-red-500/10 w-fit rounded-2xl mb-8 text-red-600 dark:text-red-400">
                <ArrowDownLeft size={24} />
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-1">Dépenses Totales (Période)</p>
              <h2 className="text-4xl font-black text-slate-900 dark:text-white">${totalExpense.toLocaleString()}</h2>
              <div className="mt-8 pt-6 border-t border-slate-50 dark:border-slate-800 flex justify-between items-center">
                <p className="text-[9px] font-bold text-red-500 uppercase tracking-widest">+5.2% vs mois dernier</p>
                <div className="h-2 w-24 bg-slate-100 dark:bg-slate-800 rounded-full">
                  <div className="h-full w-1/3 bg-red-500 rounded-full"></div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-slate-100 dark:border-slate-800 shadow-sm">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center justify-between">
            Solde Net <Wallet size={16} />
          </h3>
          <p className="text-3xl font-black text-slate-900 dark:text-white">${(totalIncome - totalExpense).toLocaleString()}</p>
          <div className="mt-6 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Cash Flow Requis</span>
              <span className="text-[10px] font-black text-slate-900 dark:text-white">$12,000</span>
            </div>
            <div className="w-full h-1.5 bg-slate-50 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full w-3/4"></div>
            </div>
            <p className="text-[9px] text-slate-400 font-medium">"Le solde actuel couvre 75% du budget prévisionnel de maintenance."</p>
          </div>
        </div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-slate-100 dark:border-slate-800 shadow-sm"
      >
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Analyse des Dépenses</h3>
            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">Répartition par catégorie • {currentMonthName} {currentYear}</p>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl text-slate-400">
            <BarChart3 size={20} />
          </div>
        </div>

        <div className="h-[300px] w-full">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 40, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#94a3b8" opacity={0.1} />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 9, fontWeight: 800, fill: '#94a3b8' }}
                  width={100}
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                  contentStyle={{ 
                    backgroundColor: '#0f172a', 
                    border: 'none', 
                    borderRadius: '16px',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    padding: '12px',
                    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'
                  }}
                  itemStyle={{ color: '#fff' }}
                  labelStyle={{ color: '#64748b', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, 'Total']}
                />
                <Bar dataKey="amount" radius={[0, 8, 8, 0]} barSize={32}>
                  {chartData.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-300 dark:text-slate-700 gap-4">
              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-full">
                <PieChart size={40} className="opacity-50" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest">Aucune dépense enregistrée pour {currentMonthName}</p>
            </div>
          )}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-slate-50 dark:border-slate-800 flex justify-between items-center">
              <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Transactions Récentes</h3>
              <div className="flex gap-2">
                <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400"><Search size={18} /></button>
                <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400"><Filter size={18} /></button>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/50 dark:bg-slate-800/30">
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Détails</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Catégorie</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Montant</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                  {transactions.map((t) => (
                    <tr key={t.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-8 py-6">
                        <p className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1 uppercase">{t.description || 'Opération sans libellé'}</p>
                        <p className="text-[9px] text-slate-400 font-medium mt-0.5">{new Date(t.createdAt).toLocaleDateString()} • {t.authorName}</p>
                      </td>
                      <td className="px-8 py-6">
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-md uppercase">
                          {t.category}
                        </span>
                      </td>
                      <td className={`px-8 py-6 text-right font-black text-xs ${t.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {t.type === 'income' ? '+' : '-'}${t.amount.toLocaleString()}
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex justify-center">
                          <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-tighter ${
                            t.status === 'validated' ? 'bg-emerald-100 text-emerald-700' : 
                            t.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {t.status === 'validated' ? 'Validé' : t.status === 'rejected' ? 'Rejeté' : 'En attente'}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {transactions.length === 0 && (
                <div className="py-20 text-center flex flex-col items-center gap-2">
                  <PieChart className="text-slate-200 dark:text-slate-800" size={48} />
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Aucune transaction</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl">
            <div className="relative z-10">
              <FileCheck className="text-emerald-400 mb-6" size={32} />
              <h3 className="text-lg font-black uppercase tracking-tight mb-4">Validations Requises</h3>
              <div className="space-y-3">
                <div className="p-4 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors cursor-pointer group">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Urgent</span>
                    <span className="text-[10px] font-bold">$1,250</span>
                  </div>
                  <p className="text-[11px] font-medium group-hover:text-emerald-400 transition-colors">Achat Engrais Dept. Ferme</p>
                </div>
                <div className="p-4 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors cursor-pointer group">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Standard</span>
                    <span className="text-[10px] font-bold">$450</span>
                  </div>
                  <p className="text-[11px] font-medium group-hover:text-emerald-400 transition-colors">Fournitures Médicales</p>
                </div>
              </div>
            </div>
            <div className="absolute bottom-0 right-0 -mb-8 -mr-8 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl"></div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-8 shadow-sm">
            <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight mb-4">Note du Directeur</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
              "Toutes les dépenses supérieures à $1,000 doivent être accompagnées d'au moins trois devis comparatifs."
            </p>
          </div>
        </div>
      </div>
        </>
      )}


      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setShowAddModal(false)} />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] p-8 relative z-10 shadow-2xl"
          >
            <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-6">Nouvelle Transaction</h2>
            
            <form onSubmit={handleAddTransaction} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Type</label>
                  <select 
                    value={newTransaction.type}
                    onChange={(e) => setNewTransaction({...newTransaction, type: e.target.value as any})}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold"
                  >
                    <option value="income">Entrée (Revenu)</option>
                    <option value="expense">Sortie (Dépense)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Catégorie</label>
                  <select 
                    value={newTransaction.category}
                    onChange={(e) => setNewTransaction({...newTransaction, category: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold"
                  >
                    <option value="Vente">Vente</option>
                    <option value="Salaire">Salaire</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Logistique">Logistique</option>
                    <option value="Achat Stock">Achat Stock</option>
                    <option value="Autre">Autre</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1 text-center py-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Montant (USD)</label>
                <input 
                  type="number"
                  required
                  value={isNaN(newTransaction.amount) ? '' : newTransaction.amount}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setNewTransaction({...newTransaction, amount: isNaN(val) ? 0 : val});
                  }}
                  className="w-full text-5xl font-black text-center bg-transparent text-slate-900 dark:text-white border-b-2 border-slate-100 dark:border-slate-800 focus:border-emerald-500 focus:outline-none py-2"
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Libellé / Description</label>
                <textarea 
                  required
                  rows={2}
                  value={newTransaction.description}
                  onChange={(e) => setNewTransaction({...newTransaction, description: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none"
                  placeholder="Détails de l'opération..."
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-6 py-4 border border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all font-sans"
                >
                  Annuler
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-6 py-4 bg-slate-900 dark:bg-emerald-600 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-slate-800 dark:hover:bg-emerald-700 transition-all shadow-lg shadow-slate-900/20"
                >
                  Confirmer
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
