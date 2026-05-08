import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Sprout, 
  MapPin, 
  Droplets, 
  ClipboardCheck, 
  Bug, 
  Activity, 
  ShoppingCart, 
  ArrowRight,
  Plus,
  Calendar,
  AlertTriangle,
  History,
  Activity
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function ClientAgriculture() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab ] = useState('home');

  return (
    <div className="space-y-12 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-6">
           <div className="w-20 h-20 bg-emerald-600 rounded-[2.5rem] flex items-center justify-center text-white shadow-2xl shadow-emerald-900/40">
              <Sprout size={36} />
           </div>
           <div>
              <h1 className="text-4xl font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-none mb-3">Module Agriculture</h1>
              <p className="text-slate-500 dark:text-slate-400 font-medium">Gestion intelligente de vos activités agronomiques et pastorales.</p>
           </div>
        </div>
        <div className="flex gap-2 bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
           <TabButton active={activeTab === 'home'} onClick={() => setActiveTab('home')} label="Aperçu" icon={Activity} />
           <TabButton active={activeTab === 'requests'} onClick={() => setActiveTab('requests')} label="Demandes" icon={Plus} />
           <TabButton active={activeTab === 'market'} onClick={() => setActiveTab('market')} label="Boutique" icon={ShoppingCart} />
        </div>
      </div>

      {activeTab === 'home' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Feed */}
          <div className="lg:col-span-2 space-y-8">
             {/* Stats */}
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <AgrStat label="Analyses de Sol" value="02" color="emerald" />
                <AgrStat label="Suivis Terrain" value="05" color="blue" />
                <AgrStat label="Alertes Météo" value="Active" color="orange" />
             </div>

             {/* Recent Activities */}
             <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none">
                <div className="flex justify-between items-center mb-8">
                   <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Activités Récentes</h3>
                   <History className="text-slate-200" size={20} />
                </div>
                <div className="space-y-6">
                   <ActivityItem 
                    title="Analyse de Sol Validée" 
                    desc="Votre analyse du secteur Nord-2 a été complétée avec recommandations." 
                    time="Hier" 
                    status="completed"
                   />
                   <ActivityItem 
                    title="Rendez-vous Vétérinaire" 
                    desc="Visite confirmée pour le contrôle de vaccination du bétail." 
                    time="Dans 2 jours" 
                    status="pending"
                   />
                </div>
             </div>

             {/* Guidance Banner */}
             <div className="bg-indigo-600 rounded-[3rem] p-10 text-white relative overflow-hidden group shadow-2xl shadow-indigo-900/20">
                <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full translate-x-1/3 -translate-y-1/3 group-hover:scale-110 transition-transform"></div>
                <div className="relative z-10 max-w-lg">
                   <h2 className="text-2xl font-black uppercase tracking-tight mb-4">Recommandation du mois</h2>
                   <p className="text-indigo-100 font-medium mb-8">La saison des pluies approche en RDC. Pensez à vérifier vos systèmes de drainage et à commander vos semences de maïs hybride RIBERJO.</p>
                   <button className="px-8 py-4 bg-white text-indigo-600 font-black text-[10px] uppercase tracking-widest rounded-2xl hover:scale-105 transition-all">Consulter le calendrier</button>
                </div>
             </div>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-8">
             <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-slate-100 dark:border-slate-800 shadow-sm">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6">Services Rapides</h3>
                <div className="space-y-3">
                   <QuickService icon={MapPin} label="Demander visite terrain" color="emerald" />
                   <QuickService icon={Droplets} label="Analyse de sol" color="blue" />
                   <QuickService icon={Activity} label="Urgence vétérinaire" color="red" />
                   <QuickService icon={ClipboardCheck} label="Consultation agronomique" color="purple" />
                </div>
             </div>

             <div className="bg-orange-50 dark:bg-orange-500/10 border border-orange-100 dark:border-orange-500/20 rounded-[2.5rem] p-8">
                <div className="flex items-center gap-3 mb-4">
                   <AlertTriangle className="text-orange-600" size={24} />
                   <h3 className="text-xs font-black uppercase tracking-widest text-orange-900 dark:text-orange-400">Alerte Météo Agricole</h3>
                </div>
                <p className="text-[10px] font-bold text-orange-800 dark:text-orange-500/80 leading-relaxed">
                   Risque de fortes précipitations sur la zone d'exploitation dans les prochaines 48h. Sécurisez vos récoltes stockées en plein air.
                </p>
             </div>
          </div>
        </div>
      )}

      {activeTab === 'requests' && (
        <div className="max-w-3xl mx-auto space-y-8">
           <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-12 border border-slate-100 dark:border-slate-800 shadow-sm">
              <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-8">Nouvelle Demande de Service</h2>
              <form className="space-y-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Type de Service</label>
                    <select className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl font-bold text-sm">
                       <option>Visite de terrain agronomique</option>
                       <option>Analyse physico-chimique du sol</option>
                       <option>Diagnostic vétérinaire</option>
                       <option>Planification de culture</option>
                    </select>
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Description du besoin</label>
                    <textarea 
                      rows={4}
                      placeholder="Décrivez votre problème ou besoin en détail..."
                      className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl font-bold text-sm resize-none"
                    ></textarea>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Date souhaitée</label>
                       <input type="date" className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl font-bold text-sm" />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Urgence</label>
                       <div className="flex gap-2">
                          {['Faible', 'Moyenne', 'Critique'].map(lvl => (
                            <button key={lvl} type="button" className="flex-1 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl text-[10px] font-black uppercase hover:bg-emerald-50 hover:text-emerald-600 transition-all">{lvl}</button>
                          ))}
                       </div>
                    </div>
                 </div>
                 <button className="w-full py-5 bg-brand text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-brand/20 hover:scale-[1.02] active:scale-95 transition-all">
                    Envoyer ma demande aux experts
                 </button>
              </form>
           </div>
        </div>
      )}

      {activeTab === 'market' && (
        <div className="space-y-8">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <ProductCard name="Semences Maïs Hybride" price="$25/kg" category="Semences" />
              <ProductCard name="Engrais NPK 17-17-17" price="$45/sac" category="Fertilisants" />
              <ProductCard name="Pulvérisateur 16L" price="$60/unit" category="Matériel" />
              <ProductCard name="Aliment Volailles" price="$35/sac" category="Élevage" />
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
        active ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'
      }`}
    >
      <Icon size={16} /> {label}
    </button>
  );
}

function AgrStat({ label, value, color }: any) {
  const colors: any = {
    emerald: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10',
    blue: 'text-blue-500 bg-blue-50 dark:bg-blue-500/10',
    orange: 'text-orange-500 bg-orange-50 dark:bg-orange-500/10',
  };
  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm border-b-4 border-b-slate-100 dark:border-b-slate-800">
       <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-4 ${colors[color]}`}>
          <Sprout size={16} />
       </div>
       <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
       <h4 className="text-xl font-black text-slate-900 dark:text-white uppercase">{value}</h4>
    </div>
  );
}

function ActivityItem({ title, desc, time, status }: any) {
  return (
    <div className="flex gap-4 group">
       <div className="flex flex-col items-center">
          <div className={`w-3 h-3 rounded-full mt-1.5 ${status === 'completed' ? 'bg-emerald-500' : 'bg-blue-500'}`}></div>
          <div className="w-0.5 h-full bg-slate-100 dark:bg-slate-800 my-1 group-last:hidden"></div>
       </div>
       <div className="flex-1 pb-6">
          <div className="flex justify-between items-start mb-1">
             <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">{title}</h4>
             <span className="text-[8px] font-black text-slate-400 uppercase">{time}</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">{desc}</p>
       </div>
    </div>
  );
}

function QuickService({ icon: Icon, label, color }: any) {
  const colors: any = {
    emerald: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600',
    blue: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600',
    red: 'bg-red-50 dark:bg-red-500/10 text-red-600',
    purple: 'bg-purple-50 dark:bg-purple-500/10 text-purple-600',
  };
  return (
    <button className="w-full flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700">
       <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${colors[color]}`}>
          <Icon size={18} />
       </div>
       <span className="text-xs font-bold text-slate-700 dark:text-slate-300 text-left">{label}</span>
    </button>
  );
}

function ProductCard({ name, price, category }: any) {
  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm group">
       <div className="w-full aspect-square bg-slate-50 dark:bg-slate-800 rounded-2xl mb-4 flex items-center justify-center group-hover:scale-[1.02] transition-all">
          <ShoppingCart className="text-slate-200" size={48} />
       </div>
       <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest mb-1">{category}</p>
       <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight mb-4">{name}</h4>
       <div className="flex justify-between items-center">
          <span className="text-lg font-black text-brand tracking-tighter">{price}</span>
          <button className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl hover:bg-brand hover:text-white transition-all">
             <Plus size={16} />
          </button>
       </div>
    </div>
  );
}
