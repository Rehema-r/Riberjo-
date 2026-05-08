import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  BookOpen, 
  GraduationCap, 
  Calendar, 
  FileText, 
  Clock, 
  User, 
  Download, 
  CheckCircle2,
  TrendingUp,
  CreditCard,
  Plus,
  ArrowRight,
  Book,
  PenTool
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function ClientEducation() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab ] = useState('home');

  return (
    <div className="space-y-12 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-6">
           <div className="w-20 h-20 bg-purple-600 rounded-[2.5rem] flex items-center justify-center text-white shadow-2xl shadow-purple-900/10">
              <GraduationCap size={36} />
           </div>
           <div>
              <h1 className="text-4xl font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-none mb-3">Module Éducation</h1>
              <p className="text-slate-500 dark:text-slate-400 font-medium">Votre espace académique, cours et bulletins de formation.</p>
           </div>
        </div>
        <div className="flex gap-2 bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
           <TabButton active={activeTab === 'home'} onClick={() => setActiveTab('home')} label="Ma Formation" icon={BookOpen} />
           <TabButton active={activeTab === 'courses'} onClick={() => setActiveTab('courses')} label="Cours" icon={Book} />
           <TabButton active={activeTab === 'results'} onClick={() => setActiveTab('results')} label="Bulletins" icon={FileText} />
        </div>
      </div>

      {activeTab === 'home' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
             {/* Progress Cards */}
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <EduStat label="Matricule Étudiant" value={profile?.id || 'N/A'} icon={User} color="purple" />
                <EduStat label="Progression" value="75%" icon={TrendingUp} color="emerald" />
                <EduStat label="Paiement Frais" value="En règle" icon={CheckCircle2} color="blue" />
             </div>

             {/* Recent Assignments / Activities */}
             <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-10 border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/40">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-8">Activités Académiques Récentes</h3>
                <div className="space-y-6">
                   <LessonItem 
                    title="Agronomie Tropicale - Chap. 4" 
                    type="Document" 
                    time="Posté il y a 2h" 
                    status="new"
                   />
                   <LessonItem 
                    title="Examen Mi-Session : Élevage" 
                    type="Quiz" 
                    time="Demain à 10:00" 
                    status="pending"
                   />
                   <LessonItem 
                    title="Bulletin du 1er Trimestre" 
                    type="Bulletin" 
                    time="Disponible" 
                    status="ready"
                   />
                </div>
             </div>

             {/* Learning Spotlight */}
             <div className="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-[3rem] p-12 text-white relative overflow-hidden group shadow-2xl">
                <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full translate-x-1/2 -translate-y-1/2 group-hover:scale-110 transition-transform blur-2xl"></div>
                <div className="relative z-10">
                   <span className="px-3 py-1 bg-white/20 rounded-full text-[8px] font-black uppercase tracking-widest mb-6 inline-block">Prochain Webinaire</span>
                   <h2 className="text-3xl font-black uppercase tracking-tighter mb-4 leading-none">Techniques de Culture Intensive</h2>
                   <p className="text-white/70 font-medium mb-10 max-w-sm">Rejoignez nos agronomes demain soir pour une session exclusive sur le rendement du maïs en climat humide.</p>
                   <button className="px-10 py-5 bg-white text-purple-600 font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-xl hover:-translate-y-1 transition-all">S'inscrire au Webinaire</button>
                </div>
             </div>
          </div>

          <div className="space-y-8">
             {/* Account Summary */}
             <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-slate-100 dark:border-slate-800 shadow-sm">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-8 text-center">État Financier Académique</h3>
                <div className="space-y-6 flex flex-col items-center">
                   <div className="w-24 h-24 bg-purple-50 dark:bg-purple-500/10 rounded-full flex items-center justify-center border-4 border-white dark:border-slate-800 shadow-xl text-purple-600 font-black text-xs">
                      100%
                   </div>
                   <div className="text-center">
                      <p className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Frais Soldés</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Aucun arriéré</p>
                   </div>
                   <button className="w-full py-4 bg-slate-50 dark:bg-slate-800 text-slate-500 font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-brand hover:text-white transition-all flex items-center justify-center gap-2">
                      <Download size={14} /> Historique des Reçus
                   </button>
                </div>
             </div>

             {/* Schedule */}
             <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-slate-100 dark:border-slate-800 shadow-sm">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6">Emploi du temps</h3>
                <div className="space-y-4">
                   <ScheduleSlot time="08:00 - 10:00" subject="Pathologie Animale" room="Sallle 01" />
                   <ScheduleSlot time="10:30 - 12:30" subject="Comptabilité Agricole" room="Laboratoire" />
                </div>
             </div>
          </div>
        </div>
      )}

      {activeTab === 'courses' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
           <CourseCard title="Introduction à l'Agriculture Durable" instructor="Prof. Kabwe" lessons={12} prog={100} />
           <CourseCard title="Gestion Vétérinaire Avancée" instructor="Dr. Mpululu" lessons={8} prog={45} />
           <CourseCard title="Marketing des Produits Locaux" instructor="L. Musampa" lessons={10} prog={10} />
        </div>
      )}

      {activeTab === 'results' && (
        <div className="max-w-4xl mx-auto space-y-8">
           <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-12 border border-slate-100 dark:border-slate-800 shadow-sm">
              <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-10">Bulletin Annuel Intelligent</h2>
              <div className="space-y-4">
                 <BulletinItem label="Moyenne Générale" val="16.5 / 20" rank="1er / 45" />
                 <div className="p-8 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-800">
                    <table className="w-full text-left">
                       <thead>
                          <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 dark:border-slate-700">
                             <th className="pb-4">Matières</th>
                             <th className="pb-4 text-center">Note</th>
                             <th className="pb-4 text-right">Appréciation</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                          <MarkLine subject="Génie Rural" mark="18" app="Excellent" />
                          <MarkLine subject="Botanique" mark="15" app="Très Bien" />
                          <MarkLine subject="Anglais Technique" mark="17" app="Excellent" />
                       </tbody>
                    </table>
                 </div>
                 <button className="w-full py-6 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black uppercase tracking-widest rounded-2xl shadow-xl flex items-center justify-center gap-3">
                    <Download size={20} /> Télécharger mon Bulletin PDF
                 </button>
              </div>
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
        active ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'
      }`}
    >
      <Icon size={16} /> {label}
    </button>
  );
}

function EduStat({ label, value, icon: Icon, color }: any) {
  const colors: any = {
    purple: 'text-purple-500 bg-purple-50 dark:bg-purple-500/10',
    emerald: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10',
    blue: 'text-blue-500 bg-blue-50 dark:bg-blue-500/10',
  };
  return (
    <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm border-b-4 border-b-slate-50 dark:border-b-slate-800">
       <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-6 shadow-sm ${colors[color]}`}>
          <Icon size={20} />
       </div>
       <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
       <h4 className="text-xl font-black text-slate-900 dark:text-white uppercase">{value}</h4>
    </div>
  );
}

function LessonItem({ title, type, time, status }: any) {
  const dots: any = {
    new: 'bg-emerald-500 shadow-emerald-500/50',
    pending: 'bg-yellow-500 shadow-yellow-500/50',
    ready: 'bg-blue-500 shadow-blue-500/50'
  };
  return (
    <div className="flex items-center justify-between p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl hover:bg-slate-100 transition-all cursor-pointer border border-transparent hover:border-slate-200">
       <div className="flex items-center gap-4">
          <div className="relative">
             <div className="w-12 h-12 bg-white dark:bg-slate-900 rounded-2xl flex items-center justify-center text-purple-600 shadow-sm">
                <Book size={20} />
             </div>
             <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 shadow-lg ${dots[status]}`}></div>
          </div>
          <div>
             <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">{title}</h4>
             <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">{type} • {time}</p>
          </div>
       </div>
       <ArrowRight className="text-slate-300" size={18} />
    </div>
  );
}

function ScheduleSlot({ time, subject, room }: any) {
  return (
    <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border-l-4 border-purple-500">
       <p className="text-[8px] font-black text-slate-400 uppercase mb-1">{time}</p>
       <p className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">{subject}</p>
       <p className="text-[9px] text-slate-400 font-bold uppercase">{room}</p>
    </div>
  );
}

function CourseCard({ title, instructor, lessons, prog }: any) {
  return (
    <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm group cursor-pointer hover:shadow-2xl hoverShadowColors transition-all">
       <div className="w-full h-32 bg-slate-50 dark:bg-slate-800 rounded-2xl mb-8 flex items-center justify-center p-6 transition-transform group-hover:scale-[1.02]">
          <BookOpen size={48} className="text-slate-200" />
       </div>
       <h4 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2 group-hover:text-purple-600 transition-colors">{title}</h4>
       <p className="text-[10px] text-slate-400 font-bold uppercase mb-8">{instructor} • {lessons} Leçons</p>
       
       <div className="space-y-4">
          <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest mb-1">
             <span className="text-slate-400">Progression</span>
             <span className="text-purple-600">{prog}%</span>
          </div>
          <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
             <div className="h-full bg-purple-500 transition-all duration-1000" style={{ width: `${prog}%` }}></div>
          </div>
       </div>
    </div>
  );
}

function BulletinItem({ label, val, rank }: any) {
  return (
    <div className="grid grid-cols-2 gap-4">
       <div className="p-6 bg-purple-50 dark:bg-purple-500/10 rounded-3xl text-center">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
          <p className="text-2xl font-black text-purple-600">{val}</p>
       </div>
       <div className="p-6 bg-emerald-50 dark:bg-emerald-500/10 rounded-3xl text-center">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Rang</p>
          <p className="text-2xl font-black text-emerald-600">{rank}</p>
       </div>
    </div>
  );
}

function MarkLine({ subject, mark, app }: any) {
  return (
    <tr className="group">
       <td className="py-4 text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight">{subject}</td>
       <td className="py-4 text-center">
          <span className="px-3 py-1 bg-white dark:bg-slate-800 rounded-lg font-black text-xs shadow-sm">{mark} / 20</span>
       </td>
       <td className="py-4 text-right text-[10px] font-black uppercase tracking-widest text-emerald-600">{app}</td>
    </tr>
  );
}
