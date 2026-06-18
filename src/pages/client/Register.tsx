import React, { useState } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, addDoc, getDocs, query, orderBy, limit, setDoc, doc, where } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { ClientProfile, ClientType, UserProfile } from '../../types';
import { generateClientId, generateClientPassword } from '../../constants';
import { motion, AnimatePresence } from 'motion/react';
import { User, Phone, Mail, MapPin, Briefcase, Globe, Camera, ArrowRight, CheckCircle2, QrCode, ShieldCheck } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { jsPDF } from 'jspdf';

const CLIENT_TYPES: { value: ClientType; label: string }[] = [
  { value: 'STANDARD', label: 'Client Standard' },
  { value: 'PARTNER', label: 'Client Partenaire' },
  { value: 'PREMIUM', label: 'Client Premium' },
  { value: 'ORGANIZATION', label: 'Entreprise / Organisation' },
  { value: 'COOPERATIVE', label: 'Coopérative Agricole' },
  { value: 'PARENT', label: 'Parent d\'élève' },
  { value: 'PATIENT', label: 'Patient Médical' },
];

export default function ClientRegister() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registeredClient, setRegisteredClient] = useState<ClientProfile | null>(null);

  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    address: '',
    gender: 'M' as 'M' | 'F',
    profession: '',
    nationality: 'Congolaise (RDC)',
    type: 'STANDARD' as ClientType,
    photoUrl: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. Check if email already exists
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', formData.email));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        throw new Error("Cet email est déjà utilisé.");
      }

      // 2. Get sequence for client ID
      const clientsSnap = await getDocs(query(usersRef, where('role', '==', 'CLIENT'), orderBy('id', 'desc'), limit(1)));
      let sequence = 1;
      if (!clientsSnap.empty) {
        const lastId = clientsSnap.docs[0].data().id;
        const lastSeq = parseInt(lastId.split('-').pop());
        sequence = lastSeq + 1;
      }

      const clientId = generateClientId(sequence);
      const password = generateClientPassword();
      const qrCodeValue = `${window.location.origin}/verify/${clientId}`;

      // 3. Create Auth User
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, password);
      const authUid = userCredential.user.uid;

      // 4. Create Profile
      const clientProfile: ClientProfile = {
        id: clientId,
        fullName: formData.fullName,
        phone: formData.phone,
        email: formData.email,
        address: formData.address,
        gender: formData.gender,
        profession: formData.profession,
        nationality: formData.nationality,
        type: formData.type,
        qrCode: qrCodeValue,
        registrationDate: Date.now(),
        status: 'active',
        passwordChanged: false,
        authUid: authUid,
        referenceNumber: `RBJ-REF-${Date.now().toString().slice(-6)}`,
        serviceAuthorizations: getInitialServices(formData.type)
      };

      // Also create a entry in 'users' collection for the ERP to recognize them (role: CLIENT)
      const erpProfile: UserProfile & { password?: string } = {
        id: clientId,
        fullName: formData.fullName,
        email: formData.email,
        role: 'CLIENT',
        departmentId: 'CLIENT', 
        matricule: clientId,
        phone: formData.phone,
        address: formData.address,
        gender: formData.gender,
        status: 'active',
        passwordChanged: false,
        password: password, // Store for legacy signIn compatibility
        createdAt: Date.now(),
        authUid: authUid,
        qrCode: qrCodeValue
      };

      await setDoc(doc(db, 'users', clientId), erpProfile);
      // We can also store in a specialized 'clients' collection if we want more metadata
      await setDoc(doc(db, 'clients', clientId), clientProfile);

      setRegisteredClient(clientProfile);
      setStep(3);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Une erreur est survenue lors de l'inscription.");
    } finally {
      setLoading(false);
    }
  };

  const getInitialServices = (type: ClientType): string[] => {
    switch(type) {
      case 'PATIENT': return ['sante', 'assistance'];
      case 'COOPERATIVE': 
      case 'STANDARD': return ['agriculture', 'commerce', 'assistance'];
      case 'PARENT': return ['education', 'assistance'];
      default: return ['agriculture', 'sante', 'education', 'commerce', 'logistique', 'assistance'];
    }
  };

  const downloadCard = () => {
    if (!registeredClient) return;
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: [85.6, 54]
    });

    doc.setFillColor(5, 150, 105);
    doc.rect(0, 0, 85.6, 12, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.text('RIBERJO GLOBAL SERVICE', 10, 8);
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.text(registeredClient.fullName.toUpperCase(), 10, 22);
    
    doc.setFontSize(6);
    doc.text(`ID: ${registeredClient.id}`, 10, 27);
    doc.text(`TYPE: ${registeredClient.type}`, 10, 32);
    doc.text(`INSCRIPTION: ${new Date(registeredClient.registrationDate).toLocaleDateString()}`, 10, 37);

    // QR Code Placeholder
    doc.rect(60, 15, 20, 20);
    doc.setFontSize(4);
    doc.text('QR CODE SCAN', 70, 33, { align: 'center' });

    doc.save(`Carte_Client_${registeredClient.id}.pdf`);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 pb-20">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800">
        <div className="bg-brand p-12 text-white relative">
           <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
           <div className="relative z-10 flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center p-4 shadow-xl mb-6">
                <div className="w-full h-full bg-emerald-600 rounded-xl flex items-center justify-center font-black text-2xl">R</div>
              </div>
              <h1 className="text-3xl font-black uppercase tracking-tighter mb-2">Espace Client RIBERJO</h1>
              <p className="text-white/70 font-medium max-w-md">Rejoignez l'écosystème intelligent de RIBERJO pour accéder à nos services agricoles, médicaux et logistiques.</p>
           </div>
        </div>

        <div className="p-12">
          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div 
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nom Complet</label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                          type="text" 
                          value={formData.fullName}
                          onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                          placeholder="Ex: Jean Mukendi"
                          className="w-full pl-12 pr-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-brand/20 transition-all"
                        />
                      </div>
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Téléphone</label>
                      <div className="relative">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                          type="tel" 
                          value={formData.phone}
                          onChange={(e) => setFormData({...formData, phone: e.target.value})}
                          placeholder="+243 ..."
                          className="w-full pl-12 pr-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-brand/20 transition-all"
                        />
                      </div>
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Email</label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                          type="email" 
                          value={formData.email}
                          onChange={(e) => setFormData({...formData, email: e.target.value})}
                          placeholder="client@mail.com"
                          className="w-full pl-12 pr-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-brand/20 transition-all"
                        />
                      </div>
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Type de Client</label>
                      <select 
                        value={formData.type}
                        onChange={(e) => setFormData({...formData, type: e.target.value as ClientType})}
                        className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-brand/20 transition-all"
                      >
                        {CLIENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                   </div>
                </div>

                <button 
                  onClick={() => setStep(2)}
                  className="w-full py-5 bg-brand text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-brand/20 hover:-translate-y-1 transition-all flex items-center justify-center gap-3"
                >
                  Continuer <ArrowRight size={18} />
                </button>
              </motion.div>
            ) : step === 2 ? (
              <motion.div 
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Adresse Complète</label>
                      <div className="relative">
                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                          type="text" 
                          value={formData.address}
                          onChange={(e) => setFormData({...formData, address: e.target.value})}
                          placeholder="Ville, Quartier, Rue..."
                          className="w-full pl-12 pr-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-brand/20 transition-all"
                        />
                      </div>
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Profession</label>
                      <div className="relative">
                        <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                          type="text" 
                          value={formData.profession}
                          onChange={(e) => setFormData({...formData, profession: e.target.value})}
                          placeholder="Votre métier"
                          className="w-full pl-12 pr-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-brand/20 transition-all"
                        />
                      </div>
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nationalité</label>
                      <div className="relative">
                        <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                          type="text" 
                          value={formData.nationality}
                          onChange={(e) => setFormData({...formData, nationality: e.target.value})}
                          className="w-full pl-12 pr-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-brand/20 transition-all"
                        />
                      </div>
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sexe</label>
                      <div className="flex gap-4">
                        <button 
                          onClick={() => setFormData({...formData, gender: 'M'})}
                          className={`flex-1 py-4 rounded-2xl font-bold transition-all ${formData.gender === 'M' ? 'bg-brand text-white shadow-lg' : 'bg-slate-50 dark:bg-slate-800 text-slate-500'}`}
                        >
                          Homme
                        </button>
                        <button 
                          onClick={() => setFormData({...formData, gender: 'F'})}
                          className={`flex-1 py-4 rounded-2xl font-bold transition-all ${formData.gender === 'F' ? 'bg-brand text-white shadow-lg' : 'bg-slate-50 dark:bg-slate-800 text-slate-500'}`}
                        >
                          Femme
                        </button>
                      </div>
                   </div>
                </div>

                {error && <p className="text-xs font-bold text-red-500 text-center">{error}</p>}

                <div className="flex gap-4">
                  <button 
                    onClick={() => setStep(1)}
                    className="flex-1 py-5 bg-slate-100 dark:bg-slate-800 text-slate-500 font-black uppercase tracking-widest rounded-2xl transition-all"
                  >
                    Retour
                  </button>
                  <button 
                    onClick={handleSubmit}
                    disabled={loading}
                    className="flex-[2] py-5 bg-brand text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-brand/20 hover:-translate-y-1 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    {loading ? "Création du compte..." : "Valider l'inscription"}
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="step3"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center text-center space-y-8"
              >
                 <div className="w-24 h-24 bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 rounded-full flex items-center justify-center shadow-inner">
                    <CheckCircle2 size={48} />
                 </div>
                 <div>
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Bienvenue chez RIBERJO !</h2>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">Votre compte a été créé avec succès.</p>
                 </div>

                 <div className="w-full bg-slate-50 dark:bg-slate-800/50 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 space-y-6">
                    <div className="flex flex-col items-center gap-4">
                       <div className="bg-white p-4 rounded-2xl shadow-lg">
                          <QRCodeCanvas value={registeredClient?.qrCode || ''} size={150} />
                       </div>
                       <p className="text-[10px] font-black text-brand uppercase tracking-[0.3em]">Code Client Unique</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                       <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Identifiant Client</p>
                          <p className="font-mono text-sm font-bold text-slate-900 dark:text-white">{registeredClient?.id}</p>
                       </div>
                       <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Mot de Passe Provisoire</p>
                          <p className="font-mono text-sm font-bold text-emerald-600">RBJ@Client2026</p>
                       </div>
                    </div>

                    <div className="p-4 bg-yellow-50 dark:bg-yellow-500/5 border border-yellow-100 dark:border-yellow-500/20 rounded-2xl flex items-center gap-3 text-left">
                       <ShieldCheck className="text-yellow-600 shrink-0" size={20} />
                       <p className="text-[10px] text-yellow-700 dark:text-yellow-400 font-bold leading-relaxed">
                          Pour votre sécurité, vous devrez changer votre mot de passe lors de votre première connexion.
                       </p>
                    </div>
                 </div>

                 <div className="flex w-full gap-4">
                    <button 
                      onClick={downloadCard}
                      className="flex-1 py-5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black uppercase tracking-widest rounded-2xl hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-xl"
                    >
                      <QrCode size={18} /> Télécharger ma Carte
                    </button>
                    <button 
                      onClick={() => window.location.href = '/login'}
                      className="flex-1 py-5 bg-brand text-white font-black uppercase tracking-widest rounded-2xl hover:brightness-110 transition-all shadow-xl shadow-brand/20"
                    >
                      Aller à la Connexion
                    </button>
                 </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      
      <div className="mt-8 text-center max-w-sm">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">© 2026 RIBERJO GLOBAL SERVICE SARL</p>
        <p className="text-[8px] text-slate-400 font-medium leading-relaxed mt-2 italic px-4">
          En vous inscrivant, vous acceptez nos conditions d'utilisation et notre politique de confidentialité relative à la gestion des données agricoles et sanitaires.
        </p>
      </div>
    </div>
  );
}
