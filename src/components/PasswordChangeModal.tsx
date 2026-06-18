import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ShieldCheck, Lock, ArrowRight, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function PasswordChangeModal() {
  const { profile, changePassword } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  if (!profile || (profile.passwordChanged && !success)) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    if (newPassword.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const ok = await changePassword(newPassword);
      if (ok) {
        setSuccess(true);
      } else {
        setError("Erreur lors du changement de mot de passe.");
      }
    } catch (err) {
      setError("Une erreur est survenue.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-xl" />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[3rem] p-10 relative z-10 shadow-2xl border border-white/10"
      >
        {!success ? (
          <>
            <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 rounded-[2.5rem] flex items-center justify-center mb-8 mx-auto shadow-inner">
              <ShieldCheck size={40} />
            </div>
            
            <div className="text-center mb-8">
              <h2 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-2">Sécurisez votre compte</h2>
              <p className="text-slate-500 dark:text-slate-400 font-medium">Pour votre première connexion, vous devez définir un nouveau mot de passe personnel.</p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-500/10 text-red-600 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-red-100 dark:border-red-500/20">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nouveau mot de passe</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type={showNewPassword ? "text" : "password"}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-12 pr-12 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors focus:outline-none"
                  >
                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Confirmer le mot de passe</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-12 pr-12 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors focus:outline-none"
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-5 bg-emerald-600 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
              >
                {isLoading ? 'Mise à jour...' : <><ShieldCheck size={18} /> Activer mon compte <ArrowRight size={16} /></>}
              </button>
            </form>
          </>
        ) : (
          <div className="text-center py-8">
            <div className="w-20 h-20 bg-emerald-500 text-white rounded-[2.5rem] flex items-center justify-center mb-8 mx-auto shadow-2xl">
              <CheckCircle2 size={40} />
            </div>
            <h2 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-4">Compte Actif !</h2>
            <p className="text-slate-500 dark:text-slate-400 font-medium mb-8">Votre mot de passe a été mis à jour avec succès. Bienvenue dans l'écosystème RIBERJO.</p>
            <button 
              onClick={() => setSuccess(false)}
              className="w-full py-5 bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-slate-800 transition-all font-sans"
            >
              Accéder à mon Espace de Travail
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
