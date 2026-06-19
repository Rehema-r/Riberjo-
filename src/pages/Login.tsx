import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../lib/SettingsContext';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, ShieldCheck, Zap, UserSquare2, ArrowRight, Mail, KeyRound, CheckCircle2, AlertCircle, X, ShieldAlert, Eye, EyeOff } from 'lucide-react';
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, limit, query } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function Login() {
  const { settings } = useSettings();
  const { signIn, signInWithGoogle } = useAuth();
  const [matricule, setMatricule] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [seedStatus, setSeedStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  // Auto-seed database if it is empty on mount
  useEffect(() => {
    let isMounted = true;
    const checkAndAutoSeed = async () => {
      try {
        const adDocRef = doc(db, 'users', '26_RBJ-CA-001');
        const adSnap = await getDoc(adDocRef);
        if (!adSnap.exists() && isMounted) {
          console.log("BOARD_MEMBER account missing, auto-seeding demo accounts...");
          setSeedStatus('loading');
          const { seedApp } = await import('../lib/seeder');
          await seedApp();
          if (isMounted) {
            setSeedStatus('success');
            setTimeout(() => {
                if (isMounted) setSeedStatus('idle');
            }, 5000);
          }
        }
      } catch (err) {
        console.warn("Auto-seed check failed or skipped (may be offline or starting up):", err);
      }
    };
    checkAndAutoSeed();
    return () => {
      isMounted = false;
    };
  }, []);

  // Password reset state
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetStep, setResetStep] = useState(1); // 1: identity, 2: code, 3: new password, 4: success
  const [resetMatricule, setResetMatricule] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [resetCodeInput, setResetCodeInput] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [isResetLoading, setIsResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [demoSandboxWarning, setDemoSandboxWarning] = useState<string | null>(null);

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetMatricule || !resetEmail) return;

    setIsResetLoading(true);
    setResetError(null);
    setDemoSandboxWarning(null);

    const targetMatricule = resetMatricule.trim().toUpperCase();
    const targetEmail = resetEmail.trim().toLowerCase();
    const sanitizedId = targetMatricule.replace(/\//g, '_');

    try {
      const docRef = doc(db, 'users', sanitizedId);
      const snapshot = await getDoc(docRef);

      if (!snapshot.exists()) {
        setResetError("Aucun compte associé à ce numéro matricule.");
        setIsResetLoading(false);
        return;
      }

      const userData = snapshot.data();
      const dbEmail = (userData?.email || '').trim().toLowerCase();

      if (dbEmail !== targetEmail) {
        setResetError("L'adresse e-mail saisie ne correspond pas à celle enregistrée pour ce matricule.");
        setIsResetLoading(false);
        return;
      }

      // Generate 6-digit verification code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedCode(code);

      // Save in Firebase under password_resets
      await setDoc(doc(db, 'password_resets', sanitizedId), {
        matricule: targetMatricule,
        code,
        expiresAt: Date.now() + 15 * 60 * 1000 // 15 mins validity
      });

      // Send Email via real backend API
      try {
        const emailResponse = await fetch('/api/send-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: targetEmail,
            subject: "RIBERJO - Code de réinitialisation de mot de passe",
            body: `Bonjour ${userData.fullName},\n\nVous avez demandé la réinitialisation de votre mot de passe RIBERJO.\n\nVotre code de vérification à 6 chiffres est :\n${code}\n\nCe code expirera dans 15 minutes.\n\nSi vous n'êtes pas à l'origine de cette demande, veuillez ignorer ce message.\n\nCordialement,\nL'équipe administrative RIBERJO`,
          })
        });

        const mailResult = await emailResponse.json();
        
        if (!mailResult.success || mailResult.message === "Email config missing") {
          // SMTP is not configured in this sandbox environment, display a beautiful fallback
          setDemoSandboxWarning("📧 Service de messagerie SMTP non configuré par l'administrateur. En mode démonstration, voici votre code temporaire :");
        }
      } catch (mailErr) {
        console.warn("Mail api call failed, displaying manual code:", mailErr);
        setDemoSandboxWarning("📧 Service de messagerie SMTP hors-ligne ou non configuré. En mode démonstration, voici votre code temporaire :");
      }

      setResetStep(2);
    } catch (err: any) {
      console.error(err);
      setResetError("Une erreur s'est produite lors de la validation. Veuillez réessayer.");
    } finally {
      setIsResetLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetCodeInput) return;

    setIsResetLoading(true);
    setResetError(null);

    const targetMatricule = resetMatricule.trim().toUpperCase();
    const sanitizedId = targetMatricule.replace(/\//g, '_');

    try {
      const resetRef = doc(db, 'password_resets', sanitizedId);
      const resetSnap = await getDoc(resetRef);

      if (!resetSnap.exists()) {
        setResetError("Aucune demande de réinitialisation trouvée ou expirée. Veuillez relancer la procédure.");
        setIsResetLoading(false);
        return;
      }

      const resetData = resetSnap.data();
      if (resetData.code !== resetCodeInput.trim()) {
        setResetError("Code de vérification invalide.");
        setIsResetLoading(false);
        return;
      }

      if (resetData.expiresAt < Date.now()) {
        setResetError("Ce code a expiré (validité 15 min). Veuillez demander un nouveau code.");
        setIsResetLoading(false);
        return;
      }

      setResetStep(3);
    } catch (err) {
      console.error(err);
      setResetError("Erreur de validation du code.");
    } finally {
      setIsResetLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetNewPassword || !resetConfirmPassword) return;

    if (resetNewPassword !== resetConfirmPassword) {
      setResetError("Les mots de passe ne correspondent pas.");
      return;
    }

    if (resetNewPassword.length < 6) {
      setResetError("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }

    setIsResetLoading(true);
    setResetError(null);

    const targetMatricule = resetMatricule.trim().toUpperCase();
    const sanitizedId = targetMatricule.replace(/\//g, '_');

    try {
      // Update in user collection
      await setDoc(doc(db, 'users', sanitizedId), {
        password: resetNewPassword,
        passwordChanged: true
      }, { merge: true });

      // Clean up reset code doc
      try {
        await deleteDoc(doc(db, 'password_resets', sanitizedId));
      } catch (cleanErr) {
        console.warn("Could not delete reset request document:", cleanErr);
      }

      setResetStep(4);
    } catch (err) {
      console.error(err);
      setResetError("Erreur lors de la mise à jour du mot de passe.");
    } finally {
      setIsResetLoading(false);
    }
  };

  const handleCloseResetModal = () => {
    setShowResetModal(false);
    setResetStep(1);
    setResetMatricule('');
    setResetEmail('');
    setResetCodeInput('');
    setGeneratedCode('');
    setResetNewPassword('');
    setResetConfirmPassword('');
    setResetError(null);
    setDemoSandboxWarning(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matricule || !password) return;

    const matriculeTrimmed = matricule.trim().toUpperCase();
    setIsLoading(true);
    setError(null);
    try {
      const success = await signIn(matriculeTrimmed, password);
      if (!success) {
        setError("Matricule ou mot de passe invalide.");
      }
    } catch (err: any) {
      console.error(err);
      setError("Erreur lors de la connexion. Veuillez réessayer.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 flex flex-col md:flex-row font-sans">
      <style>{`
        .bg-brand { background-color: var(--primary-brand, #047857); }
        .text-brand { color: var(--primary-brand, #047857); }
        .shadow-brand-sm { box-shadow: 0 10px 15px -3px color-mix(in srgb, var(--primary-brand, #047857), transparent 80%); }
        .logo-glow { filter: drop-shadow(0 0 15px rgba(255,255,255,0.3)); }
      `}</style>
      
      {/* Left Panel */}
      <div className="flex-1 bg-brand p-12 flex flex-col justify-between relative overflow-hidden hidden md:flex">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white opacity-[0.03] rounded-full -translate-y-1/2 translate-x-1/2 shadow-inner"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-black opacity-[0.05] rounded-full translate-y-1/2 -translate-x-1/2"></div>
        
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-2xl p-1 logo-glow overflow-hidden">
            {settings?.logoUrl ? (
              <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
            ) : (
              <div className="w-full h-full bg-emerald-600 rounded-lg flex items-center justify-center text-white font-black text-xl">R</div>
            )}
          </div>
          <div>
            <h1 className="text-white font-black text-2xl tracking-tighter uppercase leading-none">RIBERJO</h1>
            <p className="text-white/60 text-[10px] font-black uppercase tracking-[0.3em] mt-1">Global Service SARL</p>
          </div>
        </div>

        <div className="relative z-10">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="text-6xl font-black text-white mb-8 leading-[0.9] uppercase tracking-tighter">
              Bâtir demain <br /> avec <span className="text-white/40 italic">excellence.</span>
            </h2>
            <p className="text-white/70 text-lg max-w-sm font-medium leading-relaxed">
              Nourrir la terre, former les hommes, soigner l'avenir. Connectez-vous à votre écosystème de gestion intégré.
            </p>
          </motion.div>
        </div>

        <div className="relative z-10 flex gap-12 border-t border-white/10 pt-8">
          <div className="flex flex-col">
            <span className="text-white font-black text-4xl tracking-tighter">06</span>
            <span className="text-white/40 text-[9px] font-black uppercase tracking-[0.2em] mt-1">Départements</span>
          </div>
          <div className="flex flex-col">
            <span className="text-white font-black text-4xl tracking-tighter">24/7</span>
            <span className="text-white/40 text-[9px] font-black uppercase tracking-[0.2em] mt-1">Monitoring</span>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white dark:bg-slate-900 relative">
        <div className="w-full max-w-sm">
          <div className="md:hidden flex flex-col items-center gap-4 mb-12">
             <div className="w-20 h-20 bg-white rounded-[2rem] flex items-center justify-center shadow-2xl p-2 overflow-hidden">
                {settings?.logoUrl ? (
                  <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <div className="w-full h-full bg-emerald-600 rounded-xl flex items-center justify-center text-white font-black text-3xl shadow-inner">R</div>
                )}
             </div>
             <div className="text-center">
               <h1 className="font-black text-2xl tracking-tighter text-slate-900 dark:text-white uppercase">RIBERJO</h1>
               <p className="text-slate-400 dark:text-slate-500 text-[8px] font-black uppercase tracking-[0.3em]">Global Service SARL</p>
             </div>
          </div>

          <div className="mb-10 text-center md:text-left">
            <h3 className="text-4xl font-black text-slate-900 dark:text-white mb-3 uppercase tracking-tighter">CONNEXION</h3>
            <p className="text-slate-500 dark:text-slate-400 font-medium">Accédez à votre espace ERP ou Client RIBERJO.</p>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-2xl text-xs font-bold mb-6 border border-red-100 dark:border-red-500/20 flex items-center gap-3 shadow-sm"
            >
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              {error}
            </motion.div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-3">Numéro Matricule</label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-600 group-focus-within:text-brand transition-colors">
                  <UserSquare2 size={20} />
                </div>
                <input 
                  type="text"
                  value={matricule}
                  onChange={(e) => setMatricule(e.target.value.toUpperCase())}
                  placeholder="26/RBJ-... OU CLT-RBJ-..."
                  required
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-brand/10 focus:border-brand focus:bg-white dark:focus:bg-slate-900 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600 text-slate-900 dark:text-white uppercase tracking-widest"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-3">Mot de Passe</label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-600 group-focus-within:text-brand transition-colors">
                  <ShieldCheck size={20} />
                </div>
                <input 
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-12 pr-12 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-brand/10 focus:border-brand focus:bg-white dark:focus:bg-slate-900 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600 text-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors focus:outline-none"
                  aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !matricule || !password}
              className="w-full flex items-center justify-center gap-3 bg-brand text-white font-black py-5 px-6 rounded-2xl hover:brightness-110 transition-all shadow-brand-sm hover:-translate-y-1 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-[0.2em] text-[10px]"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  Connecter <ArrowRight size={16} />
                </>
              )}
            </button>



            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-100 dark:border-slate-800"></div>
              </div>
              <div className="relative flex justify-center text-[8px] font-black uppercase tracking-widest">
                <span className="bg-white dark:bg-slate-900 px-4 text-slate-400">Ou activer la session</span>
              </div>
            </div>

            <button
              type="button"
              onClick={signInWithGoogle}
              className="w-full flex items-center justify-center gap-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 font-black py-4 px-6 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm active:scale-95 uppercase tracking-[0.2em] text-[10px]"
            >
               <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
               </svg>
               Activer via Google
            </button>

            <div className="mt-8 text-center bg-emerald-50 dark:bg-emerald-500/5 p-6 rounded-3xl border border-emerald-100 dark:border-emerald-500/20 shadow-inner">
              <p className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-3">
                Nouveau Client chez RIBERJO ?
              </p>
              <button 
                type="button"
                onClick={() => {
                  window.history.pushState({}, '', '/register-client');
                  window.dispatchEvent(new PopStateEvent('popstate'));
                }}
                className="w-full py-3 bg-brand text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:brightness-110 shadow-lg transition-all"
              >
                Créer un compte client
              </button>
            </div>
          </form>

          {/* Espace Démo Section */}
          <div className="mt-10 p-6 bg-slate-50 dark:bg-slate-800/40 rounded-[2rem] border border-slate-100/80 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-2xl bg-emerald-500/10 text-brand flex items-center justify-center animate-pulse">
                <Zap size={18} />
              </div>
              <div className="min-w-0">
                <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">
                  Comptes de Démo (Mode Test/Exploration)
                </h4>
                <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">
                  Cliquez sur un profil pour l'auto-remplir :
                </p>
              </div>
            </div>

            <div className="space-y-3.5 max-h-[290px] overflow-y-auto pr-1">
              {[
                {
                  role: "DG Musama Kasongo",
                  desc: "Directeur Général • Super Bureau",
                  matricule: "26/RBJ-DG-01",
                  password: "Riberjo202!",
                  badge: "Accès Total",
                  badgeColor: "bg-red-500/10 text-red-600 dark:text-red-400"
                },
                {
                  role: "Conseiller Admin Riberjo",
                  desc: "Membre CA • Accès Lecture Seule Tout",
                  matricule: "26/RBJ-CA-001",
                  password: "Riberjo202!",
                  badge: "Conseil d'Admin (CA)",
                  badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                },
                {
                  role: "Chef Ressources Humaines",
                  desc: "Directeur RH • Administration",
                  matricule: "26/RBJ-AD-03-001",
                  password: "Riberjo202!",
                  badge: "Admin RH",
                  badgeColor: "bg-sky-500/10 text-sky-600 dark:text-sky-400"
                },
                {
                  role: "Chef Comptabilité",
                  desc: "Chef de Service Financier & Fiches",
                  matricule: "26/RBJ-SU-04-001",
                  password: "Riberjo202!",
                  badge: "Finance & Paie",
                  badgeColor: "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                },
                {
                  role: "Agent de Production",
                  desc: "Agent Élevages/Ferme • Pointages",
                  matricule: "26/RBJ-US-01-001",
                  password: "Riberjo202!",
                  badge: "Outils Agent",
                  badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                },
                {
                  role: "Client Démo Riberjo",
                  desc: "Commandes, Fiches & QR • Client",
                  matricule: "CLT-RBJ-000001",
                  password: "Riberjo202!",
                  badge: "Espace Client",
                  badgeColor: "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                }
              ].map((account) => (
                <button
                  key={account.matricule}
                  type="button"
                  onClick={() => {
                    setMatricule(account.matricule);
                    setPassword(account.password);
                    setError(null);
                  }}
                  className="w-full text-left p-3.5 bg-white dark:bg-slate-900 hover:bg-emerald-50/50 dark:hover:bg-slate-800/40 border border-slate-100 dark:border-slate-800 hover:border-emerald-200 dark:hover:border-emerald-500/30 rounded-2xl transition-all cursor-pointer flex justify-between items-center group shadow-sm active:scale-[0.98]"
                >
                  <div className="min-w-0 flex-1 pr-3">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-extrabold text-[11px] text-slate-800 dark:text-white truncate">
                        {account.role}
                      </span>
                      <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${account.badgeColor} whitespace-nowrap`}>
                        {account.badge}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium truncate mb-1.5">
                      {account.desc}
                    </p>
                    <div className="flex items-center gap-2.5 font-mono text-[9px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-850 px-2.5 py-0.5 rounded-lg w-max border border-slate-100 dark:border-slate-800/50">
                      <span>ID : <strong className="text-slate-700 dark:text-slate-300 font-bold">{account.matricule}</strong></span>
                      <span className="text-slate-300 dark:text-slate-700">|</span>
                      <span>Pass : <strong className="text-slate-700 dark:text-slate-300 font-bold">{account.password}</strong></span>
                    </div>
                  </div>
                  <div className="text-slate-300 group-hover:text-emerald-600 transition-colors shrink-0">
                    <ArrowRight size={14} />
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-12 space-y-6">
             <div className="flex items-center gap-4 text-slate-300 dark:text-slate-700 group">
                <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center group-hover:bg-brand/5 transition-colors">
                  <ShieldCheck size={18} className="group-hover:text-brand transition-colors" />
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Système Sécurisé</p>
                  <p className="text-[8px] font-bold text-slate-400 dark:text-slate-600 uppercase">Chiffrement de bout en bout</p>
                </div>
             </div>
          </div>
        </div>

        <div className="absolute bottom-8 text-center w-full left-0 pointer-events-none">
           <p className="text-[9px] font-black text-slate-300 dark:text-slate-700 uppercase tracking-[0.4em]">© 2026 RIBERJO GLOBAL SERVICE SARL</p>
        </div>
      </div>

      {/* Password Reset Modal */}
      <AnimatePresence>
        {showResetModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800 p-6 relative"
            >
              {/* Close Button */}
              <button 
                onClick={handleCloseResetModal}
                className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-all focus:outline-none"
              >
                <X size={20} />
              </button>

              <div className="flex flex-col items-center text-center mt-2 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-brand/10 text-brand flex items-center justify-center mb-4">
                  <KeyRound size={24} />
                </div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider">Réinitialiser le Mot de passe</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 px-4">
                  Saisissez les informations demandées pour sécuriser et réinitialiser votre accès.
                </p>
              </div>

              {resetError && (
                <div className="mb-5 p-4 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-2xl flex items-start gap-3">
                  <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
                  <span className="text-xs text-red-600 dark:text-red-400 font-bold">{resetError}</span>
                </div>
              )}

              {/* Step 1: Request Verification Code */}
              {resetStep === 1 && (
                <form onSubmit={handleRequestCode} className="space-y-4">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-1.5">Matricule</label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                        <UserSquare2 size={18} />
                      </div>
                      <input 
                        type="text"
                        required
                        value={resetMatricule}
                        onChange={(e) => setResetMatricule(e.target.value.toUpperCase())}
                        placeholder="Ex: 26/RBJ-SPU-01"
                        className="w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-brand/10 focus:border-brand focus:bg-white dark:focus:bg-slate-900 transition-all text-slate-900 dark:text-white uppercase placeholder:normal-case placeholder:text-slate-300 dark:placeholder:text-slate-600"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-1.5">Adresse Email</label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                        <Mail size={18} />
                      </div>
                      <input 
                        type="email"
                        required
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        placeholder="Ex: expert@riberjo.com"
                        className="w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-brand/10 focus:border-brand focus:bg-white dark:focus:bg-slate-900 transition-all text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isResetLoading || !resetMatricule || !resetEmail}
                    className="w-full flex items-center justify-center gap-2 bg-brand text-white font-black py-4 px-6 rounded-2xl hover:brightness-110 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-[0.2em] text-[10px] mt-2"
                  >
                    {isResetLoading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      <>Envoyer le Code <ArrowRight size={14} /></>
                    )}
                  </button>
                </form>
              )}

              {/* Step 2: Verify Code */}
              {resetStep === 2 && (
                <form onSubmit={handleVerifyCode} className="space-y-4">
                  <div className="bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-500/20 rounded-2xl p-4 text-xs text-emerald-800 dark:text-emerald-400 font-medium">
                    Un e-mail contenant le code de vérification pour le compte <strong>{resetMatricule}</strong> a été envoyé à l'adresse <strong>{resetEmail}</strong>.
                  </div>

                  {demoSandboxWarning && (
                    <div className="p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 rounded-2xl text-xs text-slate-800 dark:text-slate-300">
                      <div className="flex items-center gap-1.5 font-bold text-amber-600 dark:text-amber-500 mb-1">
                        <ShieldAlert size={14} /> Mode Démonstration
                      </div>
                      <p>{demoSandboxWarning}</p>
                      <div className="mt-2 bg-white dark:bg-slate-950 p-3 rounded-xl border border-amber-200 dark:border-slate-800 text-center text-lg font-black tracking-[0.3em] font-mono text-brand selection:bg-brand/20">
                        {generatedCode}
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-1.5">Code de Vérification (6 chiffres)</label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                        <ShieldCheck size={18} />
                      </div>
                      <input 
                        type="text"
                        required
                        maxLength={6}
                        value={resetCodeInput}
                        onChange={(e) => setResetCodeInput(e.target.value.replace(/\D/g, ''))}
                        placeholder="Saisir les 6 chiffres"
                        className="w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl text-sm font-black focus:outline-none focus:ring-4 focus:ring-brand/10 focus:border-brand focus:bg-white dark:focus:bg-slate-900 transition-all text-slate-900 dark:text-white tracking-[0.2em] text-center placeholder:tracking-normal placeholder:font-bold placeholder:text-slate-300 dark:placeholder:text-slate-600"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 mt-4">
                    <button
                      type="button"
                      onClick={() => setResetStep(1)}
                      className="w-1/3 py-4 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 font-black rounded-2xl transition-all active:scale-95 uppercase tracking-[0.15em] text-[10px]"
                    >
                      Retour
                    </button>
                    <button
                      type="submit"
                      disabled={isResetLoading || resetCodeInput.length !== 6}
                      className="w-2/3 flex items-center justify-center gap-2 bg-brand text-white font-black py-4 px-6 rounded-2xl hover:brightness-110 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-[0.2em] text-[10px]"
                    >
                      {isResetLoading ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      ) : (
                        <>Valider le Code <ArrowRight size={14} /></>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* Step 3: Enter New Password */}
              {resetStep === 3 && (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-500/20 rounded-2xl p-4 text-xs text-slate-700 dark:text-slate-300 font-medium">
                    La sécurité de votre compte a été validée. Définissez votre nouveau mot de passe ci-dessous.
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-1.5">Nouveau Mot de Passe</label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                        <ShieldCheck size={18} />
                      </div>
                      <input 
                        type="password"
                        required
                        minLength={6}
                        value={resetNewPassword}
                        onChange={(e) => setResetNewPassword(e.target.value)}
                        placeholder="Au moins 6 caractères"
                        className="w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-brand/10 focus:border-brand focus:bg-white dark:focus:bg-slate-900 transition-all text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-1.5">Confirmer le Mot de Passe</label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                        <ShieldCheck size={18} />
                      </div>
                      <input 
                        type="password"
                        required
                        value={resetConfirmPassword}
                        onChange={(e) => setResetConfirmPassword(e.target.value)}
                        placeholder="Réécrire le mot de passe"
                        className="w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-brand/10 focus:border-brand focus:bg-white dark:focus:bg-slate-900 transition-all text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isResetLoading || !resetNewPassword || !resetConfirmPassword}
                    className="w-full flex items-center justify-center gap-2 bg-brand text-white font-black py-4 px-6 rounded-2xl hover:brightness-110 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-[0.2em] text-[10px]"
                  >
                    {isResetLoading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      <>Enregistrer le Mot de Passe <ArrowRight size={14} /></>
                    )}
                  </button>
                </form>
              )}

              {/* Step 4: Success Message */}
              {resetStep === 4 && (
                <div className="space-y-6 text-center py-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto scale-110">
                    <CheckCircle2 size={36} />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">Mot de Passe Mis À Jour !</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Votre nouveau mot de passe a été enregistré avec succès dans notre base de données.
                    </p>
                  </div>
                  <button
                    onClick={handleCloseResetModal}
                    className="w-full bg-slate-900 dark:bg-slate-100 dark:text-slate-900 text-white font-black py-4 px-6 rounded-2xl hover:brightness-110 transition-all active:scale-95 uppercase tracking-[0.2em] text-[10px]"
                  >
                    Retourner à la Connexion
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
