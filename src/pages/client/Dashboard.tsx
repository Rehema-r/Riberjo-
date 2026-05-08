import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { ClientProfile, ClientAppointment, ClientOrder } from '../../types';
import { motion } from 'motion/react';
import { 
  QrCode, 
  Download, 
  Calendar, 
  ShoppingBag, 
  MessageSquare, 
  ShieldCheck, 
  ArrowUpRight, 
  ArrowRight,
  Sprout,
  Stethoscope,
  BookOpen,
  Truck
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { jsPDF } from 'jspdf';

export default function ClientDashboard() {
  const { profile } = useAuth();
  const [appointments, setAppointments] = useState<ClientAppointment[]>([]);
  const [orders, setOrders] = useState<ClientOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    
    async function fetchData() {
      try {
        const appointSnap = await getDocs(query(
          collection(db, 'client_appointments'), 
          where('clientId', '==', profile.id),
          orderBy('date', 'desc'),
          limit(3)
        ));
        setAppointments(appointSnap.docs.map(d => ({ id: d.id, ...d.data() } as ClientAppointment)));

        const orderSnap = await getDocs(query(
          collection(db, 'client_orders'),
          where('clientId', '==', profile.id),
          orderBy('createdAt', 'desc'),
          limit(3)
        ));
        setOrders(orderSnap.docs.map(d => ({ id: d.id, ...d.data() } as ClientOrder)));
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [profile]);

  const downloadClientCard = () => {
    if (!profile) return;
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: [85.6, 54]
    });

    // Design-wise: Emerald gradient look
    doc.setFillColor(5, 122, 85);
    doc.rect(0, 0, 85.6, 15, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('RIBERJO GLOBAL SERVICE', 10, 10);
    doc.setFontSize(6);
    doc.text('CARTE CLIENT NUMÉRIQUE', 65, 10);

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(12);
    doc.text(profile.fullName.toUpperCase(), 10, 25);
    
    doc.setFontSize(7);
    doc.setTextColor(100);
    doc.text(`ID: ${profile.id}`, 10, 31);
    doc.text(`TYPE: ${profile.role}`, 10, 36);
    doc.text(`INSCRIPTION: ${new Date(profile.createdAt).toLocaleDateString()}`, 10, 41);

    // Footer line
    doc.setDrawColor(16, 185, 129);
    doc.setLineWidth(1);
    doc.line(0, 52, 85.6, 52);

    doc.save(`Carte_RIBERJO_Client_${profile.id}.pdf`);
  };

  const services = [
    { id: 'agriculture', title: 'Agriculture & Élevage', icon: Sprout, color: 'emerald', desc: 'Gestion de vos cultures et bétail.' },
    { id: 'health', title: 'Santé & Bien-être', icon: Stethoscope, color: 'blue', desc: 'Vos rendez-vous et dossier médical.' },
    { id: 'education', title: 'Éducation & Formation', icon: BookOpen, color: 'purple', desc: 'Suivi académique et cours.' },
    { id: 'commerce', title: 'Commerce & Logistique', icon: Truck, color: 'orange', desc: 'Suivi de vos commandes et livraisons.' },
  ];

  return (
    <div className="space-y-12">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
           <h1 className="text-4xl font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-none mb-3">Votre Portail Intelligent</h1>
           <p className="text-slate-500 dark:text-slate-400 font-medium">Gérez tous vos services RIBERJO en un seul endroit.</p>
        </div>
        <div className="flex gap-3">
           <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 rounded-full border border-emerald-100 dark:border-emerald-500/20">
              <ShieldCheck size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">Connecté en mode sécurisé</span>
           </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Digital Card */}
        <div className="lg:col-span-1 space-y-8">
           <div className="bg-slate-900 dark:bg-black rounded-[3rem] p-8 text-white relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
              
              <div className="relative z-10 flex flex-col items-center">
                 <div className="flex items-center gap-3 mb-10 w-full">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center p-2">
                       <div className="w-full h-full bg-emerald-600 rounded-md flex items-center justify-center font-black text-sm">R</div>
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Carte de Service Digitale</p>
                 </div>

                 <div className="bg-white p-4 rounded-3xl mb-8 shadow-xl">
                    <QRCodeCanvas value={`RIBERJO:${profile?.id}`} size={160} />
                 </div>

                 <div className="text-center space-y-1 mb-8">
                    <h2 className="text-xl font-black uppercase tracking-tight">{profile?.fullName}</h2>
                    <p className="text-emerald-500 font-mono text-sm font-bold">{profile?.id}</p>
                    <p className="text-white/40 text-[10px] font-black uppercase tracking-widest pt-2">Client Partenaire</p>
                 </div>

                 <button 
                  onClick={downloadClientCard}
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2"
                 >
                    <Download size={16} /> Télécharger la Carte PDF
                 </button>
              </div>
           </div>

           <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-slate-100 dark:border-slate-800 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                 <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Rendez-vous à venir</h3>
                 <Calendar className="text-slate-300" size={18} />
              </div>
              <div className="space-y-4">
                 {appointments.length > 0 ? appointments.map(app => (
                    <div key={app.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                       <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-white dark:bg-slate-900 rounded-xl flex items-center justify-center text-emerald-500 shadow-sm font-black text-sm">
                             {new Date(app.date).getDate()}
                          </div>
                          <div>
                             <p className="text-[10px] font-black uppercase tracking-tight text-slate-900 dark:text-white">{app.serviceType}</p>
                             <p className="text-[9px] text-slate-400 font-bold uppercase">{new Date(app.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                          </div>
                       </div>
                       <div className={`w-2 h-2 rounded-full ${app.status === 'confirmed' ? 'bg-emerald-500' : 'bg-yellow-500'}`}></div>
                    </div>
                 )) : (
                   <p className="text-center text-[10px] font-bold text-slate-400 py-4 italic">Aucun rendez-vous prévu.</p>
                 )}
                 <button className="w-full py-3 text-[10px] font-black text-emerald-600 uppercase tracking-widest hover:bg-emerald-50 rounded-xl transition-all">
                    Prendre un rendez-vous
                 </button>
              </div>
           </div>
        </div>

        {/* Right Column: Service Hub */}
        <div className="lg:col-span-2 space-y-8">
           {/* Quick Actions */}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {services.map((svc) => (
                 <motion.div 
                  key={svc.id}
                  whileHover={{ y: -5 }}
                  className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none transition-all flex flex-col justify-between group cursor-pointer"
                 >
                    <div>
                       <div className={`w-14 h-14 rounded-3xl flex items-center justify-center mb-6 shadow-xl ${
                         svc.color === 'emerald' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600' :
                         svc.color === 'blue' ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600' :
                         svc.color === 'purple' ? 'bg-purple-50 dark:bg-purple-500/10 text-purple-600' :
                         'bg-orange-50 dark:bg-orange-500/10 text-orange-600'
                       }`}>
                          <svc.icon size={28} />
                       </div>
                       <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2">{svc.title}</h3>
                       <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed mb-8">{svc.desc}</p>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-black text-brand uppercase tracking-[0.2em] group-hover:gap-4 transition-all">
                       Accéder au module <ArrowRight size={16} />
                    </div>
                 </motion.div>
              ))}
           </div>

           {/* Recent Orders */}
           <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-slate-100 dark:border-slate-800 shadow-sm">
              <div className="flex justify-between items-center mb-10">
                 <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Vos Commandes récentes</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Suivi de vos achats et livraisons</p>
                 </div>
                 <ShoppingBag className="text-slate-200" size={32} />
              </div>
              
              <div className="space-y-6">
                 {orders.length > 0 ? orders.map(order => (
                    <div key={order.id} className="flex flex-col md:flex-row md:items-center justify-between p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-800 transition-hover hover:border-emerald-500/30">
                       <div className="flex items-center gap-4 mb-4 md:mb-0">
                          <div className="w-12 h-12 bg-white dark:bg-slate-900 rounded-2xl flex items-center justify-center text-slate-900 dark:text-white shadow-sm">
                             <ShoppingCart size={20} />
                          </div>
                          <div>
                             <p className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">#{order.id}</p>
                             <p className="text-[10px] text-slate-400 font-bold uppercase">{new Date(order.createdAt).toLocaleDateString()}</p>
                          </div>
                       </div>
                       <div className="flex flex-wrap items-center gap-6">
                          <div className="text-right">
                             <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Total</p>
                             <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">${order.total.toFixed(2)}</p>
                          </div>
                          <div className={`px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest ${
                            order.status === 'delivered' ? 'bg-emerald-100 text-emerald-700' : 
                            order.status === 'processing' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-600'
                          }`}>
                             {order.status}
                          </div>
                          <button className="p-3 bg-white dark:bg-slate-900 rounded-xl text-slate-400 hover:text-brand transition-all shadow-sm">
                             <ArrowUpRight size={18} />
                          </button>
                       </div>
                    </div>
                 )) : (
                   <div className="text-center py-12">
                      <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                         <ShoppingBag className="text-slate-200" size={24} />
                      </div>
                      <p className="text-xs font-black text-slate-300 uppercase tracking-[0.2em]">Aucune commande trouvée</p>
                      <button className="mt-4 px-6 py-3 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl">Boutique RIBERJO</button>
                   </div>
                 )}
              </div>
           </div>
        </div>
      </div>
      
      {/* Footer Support Banner */}
      <div className="bg-brand p-12 rounded-[3.5rem] text-white flex flex-col md:flex-row items-center gap-8 shadow-2xl shadow-emerald-900/20 relative overflow-hidden">
         <div className="absolute top-0 left-0 w-full h-full bg-black/5"></div>
         <div className="relative z-10 w-20 h-20 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center">
            <MessageSquare size={32} />
         </div>
         <div className="relative z-10 flex-1 text-center md:text-left">
            <h3 className="text-2xl font-black uppercase tracking-tight mb-2">Besoin d'assistance ?</h3>
            <p className="text-white/80 font-medium">Nos experts dans chaque département sont là pour vous accompagner 24h/24.</p>
         </div>
         <button className="relative z-10 px-8 py-5 bg-white text-emerald-600 font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl hover:scale-105 transition-all shadow-xl">
            Contacter le support
         </button>
      </div>
    </div>
  );
}
