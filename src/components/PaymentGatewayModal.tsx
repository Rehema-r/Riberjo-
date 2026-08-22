import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Smartphone, 
  CreditCard, 
  CheckCircle2, 
  AlertCircle, 
  Receipt, 
  ArrowRight, 
  ShieldCheck, 
  Download, 
  Printer, 
  Lock, 
  Sparkles,
  DollarSign,
  RefreshCw,
  PhoneCall
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';

export interface PaymentGatewayModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  defaultAmount?: number;
  currency?: 'USD' | 'CDF';
  clientName?: string;
  referenceReason?: string;
  category?: 'school' | 'store' | 'health' | 'farm' | 'general';
  studentId?: string;
  studentName?: string;
  className?: string;
  onSuccess?: (paymentData: any) => void;
}

type PaymentMethod = 'MPESA' | 'ORANGE' | 'AIRTEL' | 'CARD';

const EXCHANGE_RATE = 2850; // 1 USD = 2850 CDF

export default function PaymentGatewayModal({
  isOpen,
  onClose,
  title = "Guichet de Paiement Sécurisé",
  defaultAmount = 50,
  currency: initialCurrency = 'USD',
  clientName = '',
  referenceReason = 'Règlement de frais / services',
  category = 'general',
  studentId = '',
  studentName = '',
  className = '',
  onSuccess
}: PaymentGatewayModalProps) {
  const [method, setMethod] = useState<PaymentMethod>('MPESA');
  const [amount, setAmount] = useState<number>(defaultAmount);
  const [currency, setCurrency] = useState<'USD' | 'CDF'>(initialCurrency);
  const [phone, setPhone] = useState('0820000000');
  const [payerName, setPayerName] = useState(clientName || studentName || '');
  const [reason, setReason] = useState(referenceReason);
  
  // Card details
  const [cardNumber, setCardNumber] = useState('4242 •••• •••• 4242');
  const [cardExpiry, setCardExpiry] = useState('12/28');
  const [cardCvc, setCardCvc] = useState('123');

  // Flow State: 'FORM' -> 'PROCESSING' -> 'PIN_PROMPT' -> 'SUCCESS'
  const [step, setStep] = useState<'FORM' | 'PROCESSING' | 'PIN_PROMPT' | 'SUCCESS'>('FORM');
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedPayment, setCompletedPayment] = useState<any>(null);

  if (!isOpen) return null;

  const convertedAmount = currency === 'USD' 
    ? (amount * EXCHANGE_RATE).toLocaleString('fr-CD') + ' FC'
    : '$' + (amount / EXCHANGE_RATE).toFixed(2) + ' USD';

  const handleStartPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || amount <= 0) {
      alert("Veuillez saisir un montant valide.");
      return;
    }
    setStep('PROCESSING');
    setTimeout(() => {
      if (method === 'CARD') {
        processFinalPayment();
      } else {
        setStep('PIN_PROMPT');
      }
    }, 1500);
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length !== 4) {
      setPinError('Le code PIN Mobile Money doit comporter 4 chiffres.');
      return;
    }
    setPinError('');
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      processFinalPayment();
    }, 1800);
  };

  const processFinalPayment = async () => {
    const refCode = `${method.slice(0, 2)}-${Date.now().toString().slice(-6)}`;
    const paymentRecord = {
      referenceCode: refCode,
      payerName: payerName || 'Client / Élève',
      amount: Number(amount),
      currency: currency,
      amountInUSD: currency === 'USD' ? Number(amount) : Number((amount / EXCHANGE_RATE).toFixed(2)),
      amountInCDF: currency === 'CDF' ? Number(amount) : Number(amount * EXCHANGE_RATE),
      method: method,
      phone: method !== 'CARD' ? phone : 'N/A',
      reason: reason,
      category: category,
      studentId: studentId || null,
      studentName: studentName || null,
      className: className || null,
      status: 'PAYÉ',
      createdAt: Date.now(),
      timestamp: new Date().toISOString()
    };

    try {
      await addDoc(collection(db, 'payments'), paymentRecord).catch(err => {
        handleFirestoreError(err, OperationType.CREATE, 'payments');
      });
    } catch (e) {
      console.warn("Saving offline simulation payment record", e);
    }

    setCompletedPayment(paymentRecord);
    setStep('SUCCESS');
    if (onSuccess) {
      onSuccess(paymentRecord);
    }
  };

  const resetModal = () => {
    setStep('FORM');
    setPin('');
    setCompletedPayment(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 sm:p-8 shadow-2xl border border-slate-100 dark:border-slate-800 my-8 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black">
              <Receipt size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{title}</h3>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">RDC Mobile Money & Guichet Interactif</p>
            </div>
          </div>
          <button 
            onClick={resetModal}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl bg-slate-50 dark:bg-slate-800 transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* STEP 1: FORM */}
        {step === 'FORM' && (
          <form onSubmit={handleStartPayment} className="space-y-6 pt-6">
            {/* Method Selector */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                Sélectionner le mode de paiement
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <button
                  type="button"
                  onClick={() => setMethod('MPESA')}
                  className={`p-3 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all ${
                    method === 'MPESA'
                      ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-500/10 text-emerald-600 shadow-md ring-2 ring-emerald-500/20'
                      : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center text-[10px] font-black">
                    M-P
                  </div>
                  <span className="text-[11px] font-black uppercase">M-Pesa</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMethod('ORANGE')}
                  className={`p-3 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all ${
                    method === 'ORANGE'
                      ? 'border-orange-500 bg-orange-50/50 dark:bg-orange-500/10 text-orange-600 shadow-md ring-2 ring-orange-500/20'
                      : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center text-[10px] font-black">
                    OM
                  </div>
                  <span className="text-[11px] font-black uppercase">Orange</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMethod('AIRTEL')}
                  className={`p-3 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all ${
                    method === 'AIRTEL'
                      ? 'border-red-500 bg-red-50/50 dark:bg-red-500/10 text-red-600 shadow-md ring-2 ring-red-500/20'
                      : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-red-700 text-white flex items-center justify-center text-[10px] font-black">
                    AM
                  </div>
                  <span className="text-[11px] font-black uppercase">Airtel</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMethod('CARD')}
                  className={`p-3 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all ${
                    method === 'CARD'
                      ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-500/10 text-indigo-600 shadow-md ring-2 ring-indigo-500/20'
                      : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                  }`}
                >
                  <CreditCard size={20} className="text-indigo-600 dark:text-indigo-400" />
                  <span className="text-[11px] font-black uppercase">Carte</span>
                </button>
              </div>
            </div>

            {/* Payer Name & Reason */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                  Nom du Payeur / Client
                </label>
                <input
                  type="text"
                  required
                  value={payerName}
                  onChange={(e) => setPayerName(e.target.value)}
                  placeholder="Ex: M. MUSA KASONGO"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                  Motif du Paiement
                </label>
                <input
                  type="text"
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ex: Minerval 1er Trimestre"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
            </div>

            {/* Amount & Currency Converter */}
            <div className="p-5 bg-slate-50 dark:bg-slate-800/80 rounded-3xl border border-slate-100 dark:border-slate-700/60 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Montant à régler
                </label>
                <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setCurrency('USD')}
                    className={`px-3 py-1 rounded-lg text-[10px] font-black transition-all ${
                      currency === 'USD' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400'
                    }`}
                  >
                    USD ($)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrency('CDF')}
                    className={`px-3 py-1 rounded-lg text-[10px] font-black transition-all ${
                      currency === 'CDF' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400'
                    }`}
                  >
                    CDF (FC)
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  required
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full text-2xl font-black bg-white dark:bg-slate-900 px-5 py-3 border border-slate-200 dark:border-slate-700 rounded-2xl text-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
                <span className="text-xl font-black text-slate-400 uppercase">{currency}</span>
              </div>

              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 pt-1">
                <span>Équivalent estimé :</span>
                <span className="font-mono font-black text-slate-800 dark:text-slate-200">{convertedAmount}</span>
              </div>
            </div>

            {/* Mobile Money Phone Input */}
            {method !== 'CARD' ? (
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                  Numéro Mobile Money ({method})
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">
                    🇨🇩 +243
                  </span>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="82 000 0000"
                    className="w-full pl-24 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                <p className="text-[10px] text-slate-400 font-medium mt-1.5">
                  Une notification USSD sera envoyée sur ce téléphone pour valider la transaction.
                </p>
              </div>
            ) : (
              /* Card inputs */
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                    Numéro de Carte Bancaire
                  </label>
                  <input
                    type="text"
                    required
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-mono font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                      Expiration
                    </label>
                    <input
                      type="text"
                      required
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(e.target.value)}
                      placeholder="MM/YY"
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-mono font-bold text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                      CVC / CVV
                    </label>
                    <input
                      type="text"
                      required
                      value={cardCvc}
                      onChange={(e) => setCardCvc(e.target.value)}
                      placeholder="123"
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-mono font-bold text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
            >
              <ShieldCheck size={18} />
              Lancer le paiement ({amount} {currency})
            </button>
          </form>
        )}

        {/* STEP 2: PROCESSING */}
        {step === 'PROCESSING' && (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
            <div className="relative w-20 h-20 flex items-center justify-center">
              <RefreshCw size={48} className="text-emerald-500 animate-spin" />
            </div>
            <h4 className="text-lg font-black uppercase text-slate-800 dark:text-white">Connexion au serveur {method}...</h4>
            <p className="text-xs text-slate-400 font-medium max-w-xs">
              Envoi de la demande d'autorisation pour <strong className="text-emerald-600">{payerName}</strong>.
            </p>
          </div>
        )}

        {/* STEP 3: PIN PROMPT SIMULATION */}
        {step === 'PIN_PROMPT' && (
          <form onSubmit={handlePinSubmit} className="py-6 space-y-6 text-center">
            <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-3xl flex items-center justify-center mx-auto shadow-sm">
              <PhoneCall size={32} className="animate-bounce" />
            </div>

            <div>
              <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 text-[10px] font-black uppercase tracking-widest rounded-full">
                Notification USSD Envoyée au +243 {phone}
              </span>
              <h4 className="text-xl font-black uppercase text-slate-900 dark:text-white mt-3">Saisir le Code secret {method}</h4>
              <p className="text-xs text-slate-400 font-medium mt-1">
                Entrez le code PIN Mobile Money pour confirmer le débit de <strong className="text-emerald-600">{amount} {currency}</strong>.
              </p>
            </div>

            <div className="max-w-xs mx-auto">
              <input
                type="password"
                maxLength={4}
                required
                autoFocus
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••"
                className="w-full text-center text-3xl font-mono tracking-[0.5em] px-4 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
              {pinError && <p className="text-xs font-bold text-red-500 mt-2">{pinError}</p>}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep('FORM')}
                className="flex-1 py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black text-xs uppercase tracking-widest rounded-2xl"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-3.5 bg-emerald-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
              >
                {isSubmitting ? <RefreshCw size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                Confirmer
              </button>
            </div>
          </form>
        )}

        {/* STEP 4: SUCCESS RECEIPT */}
        {step === 'SUCCESS' && completedPayment && (
          <div className="py-6 space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-emerald-500 text-white rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/20">
                <CheckCircle2 size={36} />
              </div>
              <h4 className="text-2xl font-black uppercase text-slate-900 dark:text-white">Paiement Effectué !</h4>
              <p className="text-xs text-slate-400 font-medium">Reçu officiel RIBERJO généré en temps réel.</p>
            </div>

            {/* Official Printable Receipt Box */}
            <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 space-y-4 font-sans relative overflow-hidden">
              <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-700 pb-3">
                <div>
                  <h5 className="font-black text-sm uppercase text-slate-900 dark:text-white">RIBERJO Global Service</h5>
                  <p className="text-[10px] font-bold text-emerald-600 uppercase">Récépissé de Paiement Offiiciel</p>
                </div>
                <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 text-[10px] font-black font-mono rounded-lg">
                  {completedPayment.referenceCode}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-400 block">Payeur</span>
                  <span className="font-black text-slate-800 dark:text-white">{completedPayment.payerName}</span>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-400 block">Motif</span>
                  <span className="font-bold text-slate-800 dark:text-white">{completedPayment.reason}</span>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-400 block">Mode</span>
                  <span className="font-bold text-slate-800 dark:text-white">{completedPayment.method}</span>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-400 block">Date</span>
                  <span className="font-mono text-slate-600 dark:text-slate-300">
                    {new Date(completedPayment.createdAt).toLocaleDateString('fr-FR')}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl flex justify-between items-center border border-slate-200 dark:border-slate-700">
                <span className="text-xs font-black uppercase text-slate-500">Montant Reçu</span>
                <span className="text-xl font-black text-emerald-600">
                  {completedPayment.amount} {completedPayment.currency}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-black text-xs uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 hover:bg-slate-200"
              >
                <Printer size={16} />
                Imprimer le Reçu
              </button>
              <button
                type="button"
                onClick={resetModal}
                className="flex-1 py-3.5 bg-emerald-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
              >
                Terminer
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
