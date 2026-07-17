import React, { useState, useEffect } from 'react';
import { db, getDocSafe } from '../lib/firebase';
import { doc } from 'firebase/firestore';
import { UserProfile } from '../types';
import { ShieldCheck, ShieldAlert, CheckCircle2, Building, User, Calendar, Briefcase, Hash } from 'lucide-react';
import { motion } from 'motion/react';
import { SERVICES_LIST } from '../constants';

interface VerifyProps {
  id?: string;
}

export default function Verify({ id: propId }: VerifyProps) {
  // Use id from props or extract from URL if not provided
  const id = propId || (window.location.pathname.startsWith('/verify/') ? window.location.pathname.split('/verify/')[1] : null);
  const [loading, setLoading] = useState(true);
  const [agent, setAgent] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function verifyAgent() {
      if (!id) return;
      setLoading(true);
      try {
        // The id in URL could be the matricule (sanitized)
        const docSnap = await getDocSafe(doc(db, 'users', id));
        if (docSnap.exists()) {
          setAgent({ id: docSnap.id, ...(docSnap.data() as any) } as UserProfile);
        } else {
          setError("Agent non trouvé ou matricule invalide.");
        }
      } catch (err) {
        console.error(err);
        setError("Une erreur est survenue lors de la vérification.");
      } finally {
        setLoading(false);
      }
    }
    verifyAgent();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-600/30 border-t-emerald-600 rounded-full animate-spin"></div>
          <p className="text-slate-500 font-bold animate-pulse uppercase tracking-[0.2em] text-[10px]">Vérification en cours...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6 font-sans">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl shadow-emerald-500/5 overflow-hidden border border-slate-100 dark:border-slate-800"
      >
        {/* Header Decor */}
        <div className={`h-4 ${error ? 'bg-red-500' : 'bg-emerald-600'}`}></div>

        <div className="p-10">
          <div className="flex items-center gap-3 mb-10">
             <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white font-black text-xs">R</div>
             <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">RIBERJO GLOBAL SERVICE</p>
                <h1 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight leading-none">Système de Vérification Authentique</h1>
             </div>
          </div>

          {error ? (
            <div className="text-center py-10">
               <div className="w-20 h-20 bg-red-50 dark:bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <ShieldAlert size={40} />
               </div>
               <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2 uppercase">ALERTE : CARTE INVALIDE</h2>
               <p className="text-slate-500 dark:text-slate-400 font-medium mb-8">{error}</p>
               <div className="p-6 bg-red-50 dark:bg-red-500/5 rounded-3xl border border-red-100 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm font-bold">
                  Cette carte ne semble pas être répertoriée dans notre base de données officielle. Veuillez contacter la direction de RIBERJO immédiatement.
               </div>
            </div>
          ) : agent ? (
            <div className="space-y-8">
               <div className="flex items-center gap-6">
                  <div className="relative shrink-0">
                     <div className="w-24 h-24 bg-emerald-50 dark:bg-emerald-500/10 rounded-[2rem] flex items-center justify-center border-4 border-emerald-100 dark:border-emerald-500/20 overflow-hidden" title="Photo officielle de la carte">
                        {agent.cardPhotoUrl ? (
                            <img src={agent.cardPhotoUrl} alt="Photo Carte" className="w-full h-full object-cover animate-fade-in" />
                        ) : agent.avatarUrl ? (
                            <img src={agent.avatarUrl} alt="Photo Profil" className="w-full h-full object-cover" />
                        ) : (
                            <User size={40} className="text-emerald-600" />
                        )}
                     </div>
                     {agent.cardPhotoUrl && agent.avatarUrl && (
                        <div 
                          className="absolute -bottom-1 -right-1 w-10 h-10 rounded-[12px] overflow-hidden border-2 border-white dark:border-slate-900 shadow-lg"
                          title="Photo de profil de l'agent"
                        >
                          <img src={agent.avatarUrl} alt="Photo Profil" className="w-full h-full object-cover" />
                        </div>
                     )}
                  </div>
                  <div>
                     <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${
                           agent.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                        }`}>
                           {agent.status === 'active' ? 'Statut : ACTIF' : 'Statut : SUSPENDU'}
                        </span>
                        <div className="flex items-center gap-1 text-[8px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2 py-0.5 rounded-full">
                           <ShieldCheck size={10} /> Authentifié
                        </div>
                     </div>
                     <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{agent.fullName}</h2>
                     <p className="text-xs font-bold text-brand uppercase tracking-widest">{agent.role.replace('_', ' ')}</p>
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                     <div className="flex items-center gap-2 text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                        <Hash size={10} /> Matricule
                     </div>
                     <p className="font-mono text-sm font-bold text-slate-700 dark:text-slate-200">{agent.matricule}</p>
                  </div>
                  <div className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                     <div className="flex items-center gap-2 text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                        <Briefcase size={10} /> Département
                     </div>
                     <p className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase">{agent.departmentId}</p>
                  </div>
                  <div className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                     <div className="flex items-center gap-2 text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                        <Calendar size={10} /> Recrutement
                     </div>
                     <p className="text-sm font-bold text-slate-700 dark:text-slate-200 italic">Année {agent.recruitmentYear || '2026'}</p>
                  </div>
                  <div className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                     <div className="flex items-center gap-2 text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                        <Building size={10} /> Service
                     </div>
                     <p className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-tighter">{(() => {
                          const matchingService = SERVICES_LIST.find(
                            (s) =>
                              s.deptId === agent?.departmentId &&
                              s.id === agent?.serviceId,
                          );
                          if (matchingService) {
                            return `${matchingService.name} (${matchingService.id})`;
                          }
                          return agent?.serviceId ? `Service ${agent?.serviceId}` : "Général";
                        })()}</p>
                  </div>
               </div>

               <div className="p-6 bg-emerald-50 dark:bg-emerald-500/5 rounded-3xl border border-emerald-100 dark:border-emerald-500/20 flex gap-4 items-start">
                  <div className="w-10 h-10 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center text-emerald-600 shrink-0 shadow-sm">
                     <CheckCircle2 size={24} />
                  </div>
                  <div>
                     <h4 className="text-sm font-black text-emerald-900 dark:text-emerald-400 uppercase">IDENTITÉ VÉRIFIÉE</h4>
                     <p className="text-xs text-emerald-700 dark:text-emerald-500/80 font-medium leading-relaxed">
                        Cette personne est officiellement reconnue comme agent de RIBERJO GLOBAL SERVICE. Cette vérification numérique garantit l'authenticité de la carte de service présentée.
                     </p>
                  </div>
               </div>
            </div>
          ) : null}

          <div className="mt-10 pt-10 border-t border-slate-100 dark:border-slate-800 text-center">
             <a href="/" className="text-[10px] font-black text-slate-400 hover:text-brand uppercase tracking-[0.2em] transition-colors">
                Retour à l'accueil RIBERJO
             </a>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
