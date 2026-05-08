import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../lib/SettingsContext';
import { motion } from 'motion/react';
import { LogIn, ShieldCheck, Zap, UserSquare2, ArrowRight } from 'lucide-react';

export default function Login() {
  const { settings } = useSettings();
  const { signIn, signInWithGoogle } = useAuth();
  const [matricule, setMatricule] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matricule || !password) return;

    setIsLoading(true);
    setError(null);
    try {
      const success = await signIn(matricule, password);
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
          <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-2xl p-2 logo-glow">
            <div className="w-full h-full bg-emerald-600 rounded-lg flex items-center justify-center text-white font-black text-xl">R</div>
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
             <div className="w-20 h-20 bg-brand rounded-[2rem] flex items-center justify-center shadow-2xl p-3">
                <div className="w-full h-full bg-white rounded-xl flex items-center justify-center text-emerald-600 font-black text-3xl shadow-inner">R</div>
             </div>
             <div className="text-center">
               <h1 className="font-black text-2xl tracking-tighter text-slate-900 dark:text-white uppercase">RIBERJO</h1>
               <p className="text-slate-400 dark:text-slate-500 text-[8px] font-black uppercase tracking-[0.3em]">Global Service SARL</p>
             </div>
          </div>

          <div className="mb-10 text-center md:text-left">
            <h3 className="text-4xl font-black text-slate-900 dark:text-white mb-3 uppercase tracking-tighter">Connexion</h3>
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
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-brand/10 focus:border-brand focus:bg-white dark:focus:bg-slate-900 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600 text-slate-900 dark:text-white"
                />
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

          <div className="mt-16 space-y-6">
             <div className="flex items-center gap-4 text-slate-300 dark:text-slate-700 group">
                <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center group-hover:bg-brand/5 transition-colors">
                  <ShieldCheck size={18} className="group-hover:text-brand transition-colors" />
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Système Sécurisé</p>
                  <p className="text-[8px] font-bold text-slate-400 dark:text-slate-600 uppercase">Chiffrement de bout en bout</p>
                </div>
             </div>

             <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800/50">
               <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Accès Démo (Direction Générale)</p>
               <div className="flex justify-between items-center text-[11px] font-mono text-slate-600 dark:text-slate-300">
                 <span>MATRICULE: 26/RBJ-DG-01</span>
                 <span className="bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded">PWD: Riberjo202!</span>
               </div>
             </div>
          </div>
        </div>

        <div className="absolute bottom-8 text-center w-full left-0 pointer-events-none">
           <p className="text-[9px] font-black text-slate-300 dark:text-slate-700 uppercase tracking-[0.4em]">© 2026 RIBERJO GLOBAL SERVICE SARL</p>
        </div>
      </div>
    </div>
  );
}
