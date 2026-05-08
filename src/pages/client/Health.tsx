import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Stethoscope, 
  Search, 
  Calendar, 
  FileText, 
  Clock, 
  Video, 
  Pill, 
  AlertCircle,
  Thermometer,
  Activity,
  Heart,
  Plus,
  ChevronRight,
  User
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function ClientHealth() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab ] = useState('home');

  return (
    <div className="space-y-12 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-6">
           <div className="w-20 h-20 bg-blue-600 rounded-[2.5rem] flex items-center justify-center text-white shadow-2xl shadow-blue-900/10">
              <Stethoscope size={36} />
           </div>
           <div>
              <h1 className="text-4xl font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-none mb-3">Module Santé</h1>
              <p className="text-slate-500 dark:text-slate-400 font-medium">Votre dossier médical intelligent et prise de rendez-vous.</p>
           </div>
        </div>
        <div className="flex gap-2 bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
           <TabButton active={activeTab === 'home'} onClick={() => setActiveTab('home')} label="Dossier" icon={Activity} />
           <TabButton active={activeTab === 'appoint'} onClick={() => setActiveTab('appoint')} label="Rendez-vous" icon={Calendar} />
           <TabButton active={activeTab === 'tele'} onClick={() => setActiveTab('tele')} label="Téléconsultation" icon={Video} />
        </div>
      </div>

      {activeTab === 'home' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
             {/* Vitals */}
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <VitalCard label="Groupe Sanguin" value="O+" icon={Heart} color="red" />
                <VitalCard label="Dernière Visite" value="12 Avr" icon={Clock} color="blue" />
                <VitalCard label="Traitements" value="01 Actif" icon={Pill} color="emerald" />
             </div>

             {/* Medical History */}
             <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/40">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-8">Historique Médical</h3>
                <div className="space-y-4">
                   <RecordItem 
                    title="Consultation Générale" 
                    doctor="Dr. Kabasele" 
                    date="12/04/2026" 
                    diagnosis="Légère fatigue saisonnière"
                   />
                   <RecordItem 
                    title="Examen de Sang" 
                    doctor="Labo Central" 
                    date="10/04/2026" 
                    diagnosis="Résultats normaux"
                   />
                </div>
             </div>

             {/* Prescription Center */}
             <div className="bg-slate-900 rounded-[3rem] p-10 text-white flex flex-col md:flex-row items-center gap-8 overflow-hidden relative">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
                <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center shrink-0">
                   <Pill size={32} className="text-blue-400" />
                </div>
                <div className="flex-1">
                   <h3 className="text-xl font-black uppercase tracking-tight mb-2">Ordonnances Numériques</h3>
                   <p className="text-white/60 text-xs font-medium leading-relaxed">
                      Accédez à vos prescriptions en tout temps. Présentez le QR code au pharmacien partenaire.
                   </p>
                </div>
                <button className="px-6 py-4 bg-white text-slate-900 font-black text-[10px] uppercase tracking-widest rounded-xl shadow-xl whitespace-nowrap">
                   Voir mes ordonnances
                </button>
             </div>
          </div>

          <div className="space-y-8">
             <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-slate-100 dark:border-slate-800 shadow-sm">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6">Informations Vitales</h3>
                <div className="space-y-4">
                   <InfoBadge label="Allergies" val="Pénicilline" color="red" />
                   <InfoBadge label="Maladies Chroniques" val="Aucune" color="emerald" />
                   <InfoBadge label="Assurance" val="RIBERJO Care" color="blue" />
                </div>
             </div>

             <div className="bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-[2.5rem] p-8 text-center">
                <AlertCircle size={32} className="text-red-500 mx-auto mb-4" />
                <h4 className="text-xs font-black uppercase tracking-widest text-red-900 dark:text-red-400 mb-2">Urgence ?</h4>
                <p className="text-[10px] font-bold text-red-800 dark:text-red-400/80 leading-relaxed mb-6">
                   Notre équipe d'assistance médicale est disponible 24/7 pour toute urgence critique.
                </p>
                <button className="w-full py-4 bg-red-600 text-white font-black text-[10px] uppercase tracking-widest rounded-xl shadow-lg">Appeler l'assistance</button>
             </div>
          </div>
        </div>
      )}

      {activeTab === 'appoint' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
           <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-10 border border-slate-100 dark:border-slate-800 shadow-sm">
              <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-8">Réserver une consultation</h2>
              <form className="space-y-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Spécialité</label>
                    <select className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl font-bold text-sm">
                       <option>Médecine Générale</option>
                       <option>Dentisterie</option>
                       <option>Gynécologie</option>
                       <option>Pédiatrie</option>
                       <option>Ophtalmologie</option>
                    </select>
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Choisir un Médecin (Optionnel)</label>
                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                       {[1,2,3].map(i => (
                          <div key={i} className="flex-shrink-0 w-32 p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border-2 border-transparent hover:border-blue-500 cursor-pointer transition-all text-center">
                             <div className="w-12 h-12 bg-slate-200 rounded-xl mx-auto mb-2 flex items-center justify-center"><User size={20}/></div>
                             <p className="text-[10px] font-black uppercase tracking-tight">Dr. Smith</p>
                             <p className="text-[8px] text-slate-400 uppercase font-bold">Généraliste</p>
                          </div>
                       ))}
                    </div>
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Date et Heure</label>
                    <input type="datetime-local" className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl font-bold text-sm" />
                 </div>
                 <button className="w-full py-5 bg-blue-600 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-blue-900/20">Confirmer la réservation</button>
              </form>
           </div>

           <div className="space-y-6">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 pl-4">Mes Rendez-vous</h3>
              <div className="p-8 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center text-center">
                 <Calendar size={48} className="text-slate-100 mb-4" />
                 <p className="text-xs font-black text-slate-300 uppercase tracking-widest">Aucun rendez-vous actif</p>
              </div>
           </div>
        </div>
      )}

      {activeTab === 'tele' && (
        <div className="max-w-4xl mx-auto">
           <div className="bg-slate-100 dark:bg-slate-900 rounded-[3.5rem] p-16 flex flex-col items-center text-center space-y-10 border border-slate-100 dark:border-slate-800">
              <div className="w-24 h-24 bg-blue-600 rounded-[2.5rem] flex items-center justify-center text-white shadow-3xl shadow-blue-500/30">
                 <Video size={40} />
              </div>
              <div>
                 <h2 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-4">Téléconsultation Médicale</h2>
                 <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto font-medium leading-relaxed">
                    Discutez en direct avec un professionnel de santé depuis le confort de votre domicile via notre système de vidéo sécurisé.
                 </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
                 <Feature icon={Video} label="Vidéo HD" />
                 <Feature icon={Clock} label="Disponible 24/7" />
                 <Feature icon={FileText} label="Ordonnance Immédiate" />
              </div>
              <button className="px-12 py-6 bg-blue-600 text-white font-black uppercase tracking-widest rounded-2xl shadow-2xl shadow-blue-500/40 hover:-translate-y-1 transition-all">
                 Lancer une téléconsultation
              </button>
           </div>
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, label, icon: Icon }: any) {
  return (
    <button 
      onClick={onClick}
      className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${
        active ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'
      }`}
    >
      <Icon size={16} /> {label}
    </button>
  );
}

function VitalCard({ label, value, icon: Icon, color }: any) {
  const colors: any = {
    red: 'text-red-500 bg-red-50 dark:bg-red-500/10',
    blue: 'text-blue-500 bg-blue-50 dark:bg-blue-500/10',
    emerald: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10',
  };
  return (
    <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm">
       <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-6 shadow-sm ${colors[color]}`}>
          <Icon size={18} />
       </div>
       <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
       <h4 className="text-2xl font-black text-slate-900 dark:text-white uppercase">{value}</h4>
    </div>
  );
}

function RecordItem({ title, doctor, date, diagnosis }: any) {
  return (
    <div className="flex items-center justify-between p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl group cursor-pointer hover:bg-slate-100 transition-all border border-transparent hover:border-slate-200">
       <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white dark:bg-slate-900 rounded-2xl flex items-center justify-center text-blue-500 shadow-sm font-black uppercase text-xs tracking-tighter">
             PDF
          </div>
          <div>
             <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">{title}</h4>
             <p className="text-[10px] text-slate-400 font-bold uppercase">{doctor} • {date}</p>
          </div>
       </div>
       <div className="text-right flex items-center gap-4">
          <p className="text-[10px] text-slate-500 font-medium italic hidden md:block">{diagnosis}</p>
          <ChevronRight className="text-slate-300" size={18} />
       </div>
    </div>
  );
}

function InfoBadge({ label, val, color }: any) {
  const dots: any = {
    red: 'bg-red-500',
    emerald: 'bg-emerald-500',
    blue: 'bg-blue-500',
  };
  return (
    <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl flex justify-between items-center">
       <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
       <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${dots[color]}`}></div>
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{val}</span>
       </div>
    </div>
  );
}

function Feature({ icon: Icon, label }: any) {
  return (
    <div className="p-6 bg-white dark:bg-slate-800 rounded-3xl flex flex-col items-center gap-3 shadow-sm">
       <Icon size={24} className="text-blue-500" />
       <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}
