import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { Task, Report, UserProfile, Department } from '../types';
import { Archive as ArchiveIcon, FileText, CheckCircle2, Search, Filter, Download, FileSpreadsheet } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function Archive() {
  const { profile } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [users, setUsers] = useState<Record<string, string>>({});
  const [depts, setDepts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'tasks' | 'reports'>('all');
  const [search, setSearch] = useState('');

  const exportToCSV = () => {
    const headers = ['Type', 'Titre', 'Date', 'Département', 'Auteur', 'Status'];
    const rows = filteredItems.map(item => [
      item.type,
      item.title,
      format(item.createdAt, 'yyyy-MM-dd HH:mm'),
      depts[item.departmentId] || 'Inconnu',
      users[(item as any).creatorId || (item as any).authorId] || 'Inconnu',
      (item as any).status || 'N/A'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `archives_riberjo_${format(new Date(), 'yyyyMMdd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [tasksSnap, reportsSnap, usersSnap, deptsSnap] = await Promise.all([
        getDocs(query(collection(db, 'tasks'), orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'reports'), orderBy('createdAt', 'desc'))),
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'departments'))
      ]);

      setTasks(tasksSnap.docs.map(d => ({ id: d.id, ...d.data() } as Task)));
      setReports(reportsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Report)));
      
      const userMap: Record<string, string> = {};
      usersSnap.docs.forEach(d => {
        const u = d.data() as UserProfile;
        userMap[d.id] = u.fullName;
      });
      setUsers(userMap);

      const deptMap: Record<string, string> = {};
      deptsSnap.docs.forEach(d => {
        const dept = d.data() as Department;
        deptMap[d.id] = dept.name;
      });
      setDepts(deptMap);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const filteredItems = [
    ...(filter === 'all' || filter === 'tasks' ? tasks.map(t => ({ ...t, type: 'task' as const })) : []),
    ...(filter === 'all' || filter === 'reports' ? reports.map(r => ({ ...r, type: 'report' as const })) : [])
  ].sort((a, b) => b.createdAt - a.createdAt)
   .filter(item => 
     item.title.toLowerCase().includes(search.toLowerCase()) || 
     (item as any).description?.toLowerCase().includes(search.toLowerCase()) ||
     (item as any).content?.toLowerCase().includes(search.toLowerCase())
   );

  if (loading) return <div className="h-full flex items-center justify-center text-slate-400 font-bold">Chargement de la bibliothèque...</div>;

  return (
    <div className="max-w-6xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight uppercase flex items-center gap-3">
            <ArchiveIcon size={32} className="text-emerald-600" />
            Bibliothèque Centrale
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">Archives complètes des activités, rapports et tâches de l'entreprise.</p>
        </div>

        <div className="flex bg-white dark:bg-slate-900 p-2 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 items-center gap-2">
           <Search size={18} className="text-slate-400 dark:text-slate-500 ml-2" />
           <input 
             type="text"
             placeholder="Rechercher dans les archives..."
             value={search}
             onChange={(e) => setSearch(e.target.value)}
             className="bg-transparent border-none text-sm font-bold focus:ring-0 w-64 uppercase tracking-tight text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600"
           />
        </div>
        
        <button 
          onClick={exportToCSV}
          className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 dark:shadow-none"
        >
          <FileSpreadsheet size={16} />
          Exporter CSV
        </button>
      </div>

      <div className="flex items-center gap-4 mb-8">
        {(['all', 'tasks', 'reports'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              filter === f 
                ? 'bg-slate-900 dark:bg-emerald-600 text-white shadow-xl shadow-slate-200 dark:shadow-none' 
                : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-800'
            }`}
          >
            {f === 'all' ? 'Tout' : f === 'tasks' ? 'Tâches' : 'Rapports'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredItems.map((item, idx) => (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            key={item.id}
            className="group bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 hover:border-emerald-200 dark:hover:border-emerald-500/50 hover:shadow-xl hover:shadow-emerald-50/50 dark:hover:shadow-none transition-all"
          >
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
              <div className="flex items-center gap-6 flex-1 w-full">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
                  item.type === 'task' ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400'
                }`}>
                  {item.type === 'task' ? <CheckCircle2 size={24} /> : <FileText size={24} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg ${
                      item.type === 'task' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                    }`}>
                      {item.type}
                    </span>
                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                      {format(item.createdAt, 'PPp', { locale: fr })}
                    </span>
                  </div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors truncate uppercase tracking-tight">
                    {item.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">
                    {item.type === 'task' ? (item as Task).description : (item as Report).content.substring(0, 100)}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between lg:justify-end gap-8 shrink-0 w-full lg:w-auto">
                 <div className="text-left lg:text-right">
                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Département</p>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{depts[item.departmentId] || 'Inconnu'}</p>
                 </div>
                 <div className="text-left lg:text-right">
                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Auteur</p>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{users[(item as any).creatorId || (item as any).authorId] || 'Inconnu'}</p>
                 </div>
                 {(item as any).validatorId && (
                   <div className="text-left lg:text-right">
                      <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">Validé par</p>
                      <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">{users[(item as any).validatorId] || 'Resp.'}</p>
                   </div>
                 )}
                 <button 
                   onClick={() => {
                     const headers = ['Propriété', 'Valeur'];
                     const data = [
                       ['Type', item.type],
                       ['Titre', item.title],
                       ['Date', format(item.createdAt, 'PPp', { locale: fr })],
                       ['Département', depts[item.departmentId] || 'Inconnu'],
                       ['Auteur', users[(item as any).creatorId || (item as any).authorId] || 'Inconnu']
                     ];
                     const csv = data.map(r => r.join(',')).join('\n');
                     const blob = new Blob([csv], { type: 'text/csv' });
                     const url = URL.createObjectURL(blob);
                     const a = document.createElement('a');
                     a.href = url;
                     a.download = `${item.type}_${item.id}.csv`;
                     a.click();
                   }}
                   className="p-3 bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-xl hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-500 transition-all"
                 >
                    <Download size={18} />
                 </button>
              </div>
            </div>
          </motion.div>
        ))}

        {filteredItems.length === 0 && (
          <div className="bg-slate-50 dark:bg-slate-900 rounded-3xl p-20 text-center border-2 border-dashed border-slate-200 dark:border-slate-800">
             <ArchiveIcon size={48} className="text-slate-200 dark:text-slate-800 mx-auto mb-4" />
             <p className="text-slate-400 dark:text-slate-600 font-bold">Aucun élément trouvé dans les archives.</p>
          </div>
        )}
      </div>
    </div>
  );
}
