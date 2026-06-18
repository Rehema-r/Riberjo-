import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Report, Task, UserProfile, Asset } from '../types';
import { getExecutiveAdvice } from '../services/geminiService';
import { 
  TrendingUp, 
  Users, 
  FileCheck, 
  AlertCircle, 
  ChevronRight,
  Plus,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  CheckSquare,
  Sprout,
  Stethoscope,
  BookOpen,
  Package,
  Bell,
  Cpu,
  BrainCircuit,
  ShoppingBag,
  DollarSign
} from 'lucide-react';
import { motion } from 'motion/react';
import ActivityFeed from '../components/ActivityFeed';
import { 
  AreaChart,
  Area,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  Legend
} from 'recharts';
import { DEPARTMENTS, SERVICES_LIST } from '../constants';

export default function Dashboard() {
  const { profile } = useAuth();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [stats, setStats] = useState({
    totalEmployees: 0,
    pendingReports: 0,
    activeTasks: 0,
    urgentAlerts: 0,
    completedTasks: 0,
    validatedReports: 0
  });
  const [departmentsStatus, setDepartmentsStatus] = useState<Record<string, any>>({});
  const [recentReports, setRecentReports] = useState<Report[]>([]);
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [deptEmployees, setDeptEmployees] = useState<UserProfile[]>([]);
  const [newsFeed, setNewsFeed] = useState<any[]>([]);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [serviceAnalytics, setServiceAnalytics] = useState<any[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };
    checkDarkMode();
    
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (profile?.role === 'ADMIN' && profile?.departmentId) {
      setSelectedDeptId(profile.departmentId);
    } else {
      setSelectedDeptId('all');
    }
  }, [profile]);

  const [trendData, setTrendData] = useState<{name: string, val: number}[]>([]);
  const [attendanceTrend, setAttendanceTrend] = useState<{name: string, rate: number}[]>([]);
  const [submissionTrend, setSubmissionTrend] = useState<{name: string, rate: number}[]>([]);

  useEffect(() => {
    async function fetchDashboardData() {
      if (!profile) return;
      setLoading(true);

      try {
        const usersPath = 'users';
        const reportsPath = 'reports';
        const tasksPath = 'tasks';

        const usersSnap = await getDocs(collection(db, 'users'));

        // Base data fetching based on role
        if (profile.role === 'SUPER_ADMIN') {
          // DG View: Global stats
          const [reportsSnap, tasksSnap, farmSnap, medSnap, financeSnap, salesSnap] = await Promise.all([
            getDocs(collection(db, 'reports')),
            getDocs(collection(db, 'tasks')),
            getDocs(collection(db, 'farm_activities')),
            getDocs(collection(db, 'medical_records')),
            getDocs(collection(db, 'finance_transactions')),
            getDocs(collection(db, 'sales'))
          ]);

          const reports = reportsSnap.docs.map(d => d.data() as Report);
          const tasks = tasksSnap.docs.map(d => d.data() as Task);
          const finance = financeSnap.docs.map(d => d.data() as any);

          setStats({
            totalEmployees: usersSnap.size,
            pendingReports: reports.filter(r => r.status === 'pending').length,
            activeTasks: tasks.filter(t => t.status !== 'completed').length,
            urgentAlerts: reports.filter(r => r.status === 'pending').length > 5 ? 3 : 1,
            completedTasks: tasks.filter(t => t.status === 'completed').length,
            validatedReports: reports.filter(r => r.status === 'validated').length
          });

          // Custom state for DG overview
          const totalIncome = finance.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
          const totalEx = finance.filter(t => t.type === 'expense').reduce((acc, t) => acc + (t.amount || 0), 0);

          setDepartmentsStatus({
            'Ferme': { count: farmSnap.size, label: 'Activités', trend: 'Ferme' },
            'Santé': { count: medSnap.size, label: 'Dossiers', trend: 'Santé' },
            'Finance': { count: `$${(totalIncome - totalEx).toLocaleString()}`, label: 'Solde Net', trend: 'Finance' },
            'Ventes': { count: salesSnap.size, label: 'Transactions', trend: 'Marketing' }
          });

          // Recent reports (Global)
          setRecentReports(reportsSnap.docs
            .map(d => ({ id: d.id, ...d.data() } as Report))
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, 5));

        } else if (profile.role === 'ADMIN') {
          // Director View: Department stats
          const deptUsersQuery = profile.departmentId === 'all' 
            ? query(collection(db, usersPath)) 
            : query(collection(db, usersPath), where('departmentId', '==', profile.departmentId));
          const deptReportsQuery = profile.departmentId === 'all' 
            ? query(collection(db, reportsPath)) 
            : query(collection(db, reportsPath), where('departmentId', '==', profile.departmentId));
          const deptTasksQuery = profile.departmentId === 'all' 
            ? query(collection(db, tasksPath)) 
            : query(collection(db, tasksPath), where('departmentId', '==', profile.departmentId));

          const [deptUsersSnap, deptReportsSnap, deptTasksSnap] = await Promise.all([
            getDocs(deptUsersQuery),
            getDocs(deptReportsQuery),
            getDocs(deptTasksQuery)
          ]);

          const reports = deptReportsSnap.docs.map(d => d.data() as Report);
          const tasks = deptTasksSnap.docs.map(d => d.data() as Task);

          setStats({
            totalEmployees: deptUsersSnap.size,
            pendingReports: reports.filter(r => r.status === 'pending').length,
            activeTasks: tasks.filter(t => t.status !== 'completed').length,
            urgentAlerts: reports.filter(r => r.status === 'pending').length > 3 ? 2 : 0,
            completedTasks: tasks.filter(t => t.status === 'completed').length,
            validatedReports: reports.filter(r => r.status === 'validated').length
          });

          setRecentReports(deptReportsSnap.docs
            .map(d => ({ id: d.id, ...d.data() } as Report))
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, 5));
          
          setDeptEmployees(deptUsersSnap.docs.map(d => ({ id: d.id, ...d.data() } as UserProfile)));

        } else {
          // Expert/Worker View: Personal stats
          const [myReportsSnap, myTasksSnap] = await Promise.all([
            getDocs(query(collection(db, reportsPath), where('authorId', '==', profile.id))),
            getDocs(query(collection(db, tasksPath), where('assigneeId', '==', profile.id)))
          ]);

          const reports = myReportsSnap.docs.map(d => d.data() as Report);
          const tasks = myTasksSnap.docs.map(d => d.data() as Task);

          setStats({
            totalEmployees: 0,
            pendingReports: reports.filter(r => r.status === 'pending').length,
            activeTasks: tasks.filter(t => t.status !== 'completed').length,
            urgentAlerts: reports.filter(r => r.status === 'rejected').length > 0 ? 1 : 0,
            completedTasks: tasks.filter(t => t.status === 'completed').length,
            validatedReports: reports.filter(r => r.status === 'validated').length
          });

          setRecentReports(myReportsSnap.docs
            .map(d => ({ id: d.id, ...d.data() } as Report))
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, 5));
          
          setMyTasks(myTasksSnap.docs
            .map(d => ({ id: d.id, ...d.data() } as Task))
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, 5));
        }

        const [assetsSnap, allTasksSnap, fetchedDeptsSnap, allReportsSnap] = await Promise.all([
          getDocs(collection(db, 'assets')),
          getDocs(collection(db, 'tasks')),
          getDocs(collection(db, 'departments')),
          getDocs(collection(db, 'reports'))
        ]);
        
        const assets = assetsSnap.docs.map(d => d.data() as Asset);
        const allTasks = allTasksSnap.docs.map(d => d.data() as Task);
        const allReports = allReportsSnap.docs.map(d => ({ ...d.data(), id: d.id } as Report));
        const fetchedDepts = fetchedDeptsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

        // Trend calculation for validated reports
        const last7Days = Array.from({ length: 7 }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (6 - i));
          return d.toISOString().split('T')[0];
        });

        const trend = last7Days.map(dateStr => {
          const count = allReports.filter(r => {
            const rDate = new Date(r.updatedAt || r.createdAt).toISOString().split('T')[0];
            return r.status === 'validated' && rDate === dateStr;
          }).length;
          return {
            name: new Date(dateStr).toLocaleDateString('fr-FR', { weekday: 'short' }),
            val: count
          };
        });
        setTrendData(trend);

        // Attendance Trend Calculation
        const attendanceSnap = await getDocs(collection(db, 'attendance'));
        const allAttendance = attendanceSnap.docs.map(d => d.data());
        const totalEmployees = usersSnap.size || 1;

        const attendTrend = last7Days.map(dateStr => {
          const presentCount = allAttendance.filter(a => a.date === dateStr).length;
          const rate = totalEmployees > 0 ? Math.round((presentCount / totalEmployees) * 100) : 0;
          return {
            name: new Date(dateStr).toLocaleDateString('fr-FR', { weekday: 'short' }),
            rate: isNaN(rate) ? 0 : rate
          };
        });
        setAttendanceTrend(attendTrend);

        // Submission Rate Calculation (Reports per day vs some target or just counts)
        const subTrend = last7Days.map(dateStr => {
          const count = allReports.filter(r => {
             const rDate = new Date(r.createdAt).toISOString().split('T')[0];
             return rDate === dateStr;
          }).length;
          // Assume target is totalEmployees for now or some constant
          const rate = totalEmployees > 0 ? Math.min(100, Math.round((count / (totalEmployees * 0.5)) * 100)) : 0; 
          return {
            name: new Date(dateStr).toLocaleDateString('fr-FR', { weekday: 'short' }),
            rate: isNaN(rate) ? 0 : rate
          };
        });
        setSubmissionTrend(subTrend);

        // Get AI Advice
        const advice = await getExecutiveAdvice({
          completedTasks: allTasks.filter(t => t.status === 'completed').length,
          pendingReports: allReports.filter(r => r.status === 'pending').length,
          stockLevel: Math.round((assets.filter(a => a.status === 'in_stock').length / assets.length) * 100) || 0,
          alerts: assets.filter(a => a.status === 'out_of_stock').length
        });
        setAiAdvice(advice);

        const status: Record<string, any> = {};
        fetchedDepts.forEach(dept => {
          const deptAssets = assets.filter(a => a.departmentId === dept.id);
          const deptTasks = allTasks.filter(t => t.departmentId === dept.id);
          const completedTasks = deptTasks.filter(t => t.status === 'completed').length;
          const completionRate = deptTasks.length > 0 ? Math.round((completedTasks / deptTasks.length) * 100) : 0;

          status[dept.id] = {
            name: dept.name,
            count: deptAssets.length,
            low: deptAssets.filter(a => a.status !== 'in_stock').length,
            completionRate
          };
        });
        setDepartmentsStatus(status);

        // Compute service analytics
        const allUsers: UserProfile[] = usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as UserProfile));
        const computedServiceAnalytics = SERVICES_LIST.map(service => {
          const serviceUsers = allUsers.filter(u => u.departmentId === service.deptId && u.serviceId === service.id);
          const serviceUserIds = new Set(serviceUsers.map(u => u.id));

          // Filter tasks assigned to users in this service
          const serviceTasks = allTasks.filter(t => t.assigneeId && serviceUserIds.has(t.assigneeId));

          const totalTasks = serviceTasks.length;
          const completedTasks = serviceTasks.filter(t => t.status === 'completed').length;
          const activeTasks = serviceTasks.filter(t => t.status !== 'completed').length;
          
          let totalProgress = 0;
          serviceTasks.forEach(t => {
            totalProgress += t.progress || 0;
          });
          const avgProgress = totalTasks > 0 ? Math.round(totalProgress / totalTasks) : 0;
          
          const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
          const productivityScore = totalTasks > 0 ? Math.round((completionRate + avgProgress) / 2) : 0;

          const deptName = DEPARTMENTS.find(d => d.id === service.deptId)?.name || 'Inconnu';

          return {
            serviceId: service.id,
            serviceName: service.name,
            deptId: service.deptId,
            deptName,
            totalTasks,
            completedTasks,
            activeTasks,
            avgProgress,
            productivityScore,
            usersCount: serviceUsers.length
          };
        });

        // Add a "Général" service representation for each department
        const computedDepts = DEPARTMENTS.map(dept => {
          const generalUsers = allUsers.filter(u => u.departmentId === dept.id && (!u.serviceId || u.serviceId === 'Général' || u.serviceId === ''));
          const generalUserIds = new Set(generalUsers.map(u => u.id));

          const generalTasks = allTasks.filter(t => {
            if (t.departmentId === dept.id) {
              if (!t.assigneeId) return true;
              const assignee = allUsers.find(u => u.id === t.assigneeId);
              return !assignee || !assignee.serviceId || assignee.serviceId === 'Général' || assignee.serviceId === '';
            }
            return false;
          });

          const totalTasks = generalTasks.length;
          const completedTasks = generalTasks.filter(t => t.status === 'completed').length;
          const activeTasks = generalTasks.filter(t => t.status !== 'completed').length;

          let totalProgress = 0;
          generalTasks.forEach(t => {
            totalProgress += t.progress || 0;
          });
          const avgProgress = totalTasks > 0 ? Math.round(totalProgress / totalTasks) : 0;
          
          const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
          const productivityScore = totalTasks > 0 ? Math.round((completionRate + avgProgress) / 2) : 0;

          return {
            serviceId: 'Général',
            serviceName: 'Général',
            deptId: dept.id,
            deptName: dept.name,
            totalTasks,
            completedTasks,
            activeTasks,
            avgProgress,
            productivityScore,
            usersCount: generalUsers.length
          };
        });

        const fullAnalytics = [...computedServiceAnalytics, ...computedDepts];
        setServiceAnalytics(fullAnalytics);

        // News Feed logic
        const [notifsSnap, validatedReportsSnap] = await Promise.all([
          getDocs(query(collection(db, 'notifications'), where('userId', '==', profile.id), limit(10))),
          getDocs(query(collection(db, 'reports'), where('status', '==', 'validated'), limit(10)))
        ]);

        const feedItems = [
          ...notifsSnap.docs.map(d => ({ ...d.data(), id: d.id, feedType: 'notification' })),
          ...validatedReportsSnap.docs.map(d => ({ ...d.data(), id: d.id, feedType: 'report' }))
        ].sort((a: any, b: any) => (b.createdAt || b.updatedAt || 0) - (a.createdAt || a.updatedAt || 0))
         .slice(0, 5);
        
        setNewsFeed(feedItems);

      } catch (err) {
        console.error("Dashboard data fetch error:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, [profile]);

  const chartData = [
    { name: 'Lun', val: 400 },
    { name: 'Mar', val: 300 },
    { name: 'Mer', val: 600 },
    { name: 'Jeu', val: 800 },
    { name: 'Ven', val: 500 },
    { name: 'Sam', val: 200 },
    { name: 'Dim', val: 300 },
  ];

  const renderStats = () => {
    const roleStats: any[] = [];
    
    if (profile?.role === 'SUPER_ADMIN') {
      roleStats.push(
        { label: 'Employés totaux', value: stats.totalEmployees, icon: Users, color: 'emerald', trend: '+12%' },
        { label: 'Rapports en attente', value: stats.pendingReports, icon: FileCheck, color: 'blue', trend: stats.pendingReports > 0 ? 'Urgent' : 'OK' },
        { label: 'Tâches globales', value: stats.activeTasks, icon: Clock, color: 'amber', trend: stats.activeTasks > 10 ? 'Flux élevé' : 'Stable' },
        { label: 'Rapports Validés', value: stats.validatedReports, icon: TrendingUp, color: 'brand', trend: 'Global' }
      );
    } else if (profile?.role === 'ADMIN') {
      roleStats.push(
        { label: 'Mon Département', value: stats.totalEmployees, icon: Users, color: 'emerald', trend: 'Membres' },
        { label: 'Rapports en attente', value: stats.pendingReports, icon: FileCheck, color: 'blue', trend: 'Action rec.' },
        { label: 'Tâches en cours', value: stats.activeTasks, icon: Clock, color: 'amber', trend: 'Service' },
        { label: 'KPI Performance', value: '88%', icon: TrendingUp, color: 'brand', trend: '+4%' }
      );
    } else if (profile?.role === 'SUPER_USER') {
      roleStats.push(
        { label: 'Mes Rapports', value: stats.pendingReports + stats.validatedReports, icon: FileCheck, color: 'brand', trend: 'Soumis' },
        { label: 'Rapports Validés', value: stats.validatedReports, icon: CheckSquare, color: 'emerald', trend: 'Succès' },
        { label: 'En attente', value: stats.pendingReports, icon: Clock, color: 'amber', trend: 'Action DG' },
        { label: 'Notifications', value: stats.urgentAlerts, icon: AlertCircle, color: 'rose', trend: 'Alertes' }
      );
    } else {
      roleStats.push(
        { label: 'Mes Tâches', value: stats.activeTasks, icon: Clock, color: 'amber', trend: 'À faire' },
        { label: 'Tâches Terminées', value: stats.completedTasks, icon: CheckSquare, color: 'emerald', trend: 'Bravo' },
        { label: 'Notifications', value: 3, icon: AlertCircle, color: 'brand', trend: 'Nouveau' },
        { label: 'Messages', value: 5, icon: FileCheck, color: 'blue', trend: 'Non lus' }
      );
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {roleStats.map((stat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow group focus-within:ring-2 focus-within:ring-brand/20 transition-all"
          >
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-2xl ${
                stat.color === 'emerald' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                stat.color === 'blue' ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' :
                stat.color === 'amber' ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                stat.color === 'brand' ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' :
                'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400'
              } group-hover:scale-110 transition-transform`}>
                <stat.icon size={24} />
              </div>
              <div className={`text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-widest ${stat.trend.includes('+') || stat.trend === 'OK' || stat.trend === 'Succès' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                {stat.trend}
              </div>
            </div>
            <p className="text-slate-400 dark:text-slate-500 text-[10px] font-black mb-1 uppercase tracking-[0.2em]">{stat.label}</p>
            <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{stat.value}</h3>
          </motion.div>
        ))}
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto pb-20 px-4 sm:px-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight uppercase">Dashboard : RIBERJO</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Console de gestion intégrée : <span className="text-emerald-600 dark:text-emerald-400 font-bold">Ferme • Hôpital • École</span></p>
        </div>
        <div className="flex w-full md:w-auto gap-3">
          <button className="flex-1 md:flex-none px-6 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm">
            Stats
          </button>
          <button className="flex-1 md:flex-none px-6 py-3 bg-brand text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all shadow-xl shadow-brand/20">
            <Plus size={20} /> Rapport
          </button>
        </div>
      </div>

      {renderStats()}

      {/* Row with role-specific views */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* Entity Overview / Team Overview / News Feed */}
        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-8 shadow-sm lg:col-span-1 flex flex-col h-full">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight uppercase">
              {profile?.role === 'SUPER_ADMIN' ? 'Performance Départements' : 
               profile?.role === 'ADMIN' ? 'Mon Équipe' : 'Fil d\'actualité'}
            </h3>
            { (profile?.role !== 'SUPER_ADMIN' && profile?.role !== 'ADMIN') && <TrendingUp size={20} className="text-brand animate-pulse" /> }
          </div>
          
          <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-1">
            {profile?.role === 'SUPER_ADMIN' && (
              Object.entries(departmentsStatus).map(([id, data]) => {
                const deptData = data as any;
                
                // Simple icon mapping or fallback
                const Icon = id === 'Ferme' ? Sprout : id === 'Santé' ? Stethoscope : id === 'Finance' ? DollarSign : id === 'Ventes' ? ShoppingBag : Package;
                const colorClass = id === 'Ferme' ? 'text-emerald-600' : id === 'Santé' ? 'text-blue-600' : id === 'Finance' ? 'text-amber-600' : 'text-pink-600';
                const bgClass = id === 'Ferme' ? 'bg-emerald-50 dark:bg-emerald-500/10' : id === 'Santé' ? 'bg-blue-50 dark:bg-blue-500/10' : id === 'Finance' ? 'bg-amber-50 dark:bg-amber-500/10' : 'bg-pink-50 dark:bg-pink-500/10';

                return (
                  <div key={id} className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all group">
                    <div className={`w-10 h-10 ${bgClass} ${colorClass} rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                      <Icon size={20} />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight">{id}</p>
                      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{deptData.count || 0} {deptData.label}</p>
                    </div>
                    <div className="text-right">
                       <span className="text-[10px] font-black text-slate-500 uppercase">{deptData.trend}</span>
                    </div>
                  </div>
                );
              })
            )}

            {profile?.role === 'ADMIN' && (
              deptEmployees.length === 0 ? (
                <p className="text-slate-400 dark:text-slate-500 italic text-sm py-4">Aucun employé dans votre équipe.</p>
              ) : (
                deptEmployees.slice(0, 5).map(emp => (
                  <div key={emp.id} className="flex items-center gap-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                    <div className="w-8 h-8 bg-brand rounded-lg flex items-center justify-center text-white text-xs font-bold">
                      {emp.fullName.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{emp.fullName}</p>
                      <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase">{emp.matricule}</p>
                    </div>
                  </div>
                ))
              )
            )}

            {(profile?.role !== 'SUPER_ADMIN' && profile?.role !== 'ADMIN') && (
              <ActivityFeed />
            )}
          </div>

          {(profile?.role === 'SUPER_ADMIN' || profile?.role === 'ADMIN') && (
             <div className="mt-8 pt-8 border-t border-slate-50 dark:border-slate-800 flex-1 overflow-y-auto pr-2 scrollbar-hide">
                <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">Flux d'Activité Global</h4>
                <ActivityFeed />
             </div>
          )}
        </div>

          <div className="min-h-[450px] sm:h-80 w-full lg:col-span-2 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-6 sm:p-8 shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
              <div>
                <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight uppercase">Performance Opérationnelle</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Présences et Rapports (7j)</p>
              </div>
              <div className="flex items-center gap-6 sm:gap-4">
                <div className="flex items-center gap-2">
                   <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                   <span className="text-[10px] font-black uppercase text-slate-400">Présences</span>
                </div>
                <div className="flex items-center gap-2">
                   <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                   <span className="text-[10px] font-black uppercase text-slate-400">Rapports</span>
                </div>
              </div>
            </div>
            <div className="h-[280px] sm:h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={attendanceTrend.map((a, i) => ({
                    name: a.name,
                    attendance: a.rate,
                    submission: submissionTrend[i]?.rate || 0
                }))}>
                  <defs>
                    <linearGradient id="colorAttend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorSub" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366F1" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? "#1e293b" : "#F1F5F9"} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: isDarkMode ? '#64748b' : '#94A3B8', fontSize: 10, fontWeight: 700}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: isDarkMode ? '#64748b' : '#94A3B8', fontSize: 10, fontWeight: 700}} />
                  <Tooltip 
                    contentStyle={{backgroundColor: isDarkMode ? '#0f172a' : '#fff', borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                    labelStyle={{fontSize: '10px', color: '#94A3B8', textTransform: 'uppercase', fontWeight: 900}}
                  />
                  <Area type="monotone" dataKey="attendance" stroke="#10B981" strokeWidth={3} fillOpacity={1} fill="url(#colorAttend)" />
                  <Area type="monotone" dataKey="submission" stroke="#6366F1" strokeWidth={3} fillOpacity={1} fill="url(#colorSub)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
      </div>

      {/* SECTION DU TABLEAU DE BORD DE LA PRODUCTIVITÉ PAR SERVICE */}
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-8 shadow-sm mb-8">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8">
          <div>
            <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase">
              Analyse de la Productivité par Service
            </h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-1">
              Répartition des tâches et performance opérationnelle par unité
            </p>
          </div>

          {/* Filtre de Département */}
          <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/80 p-1 rounded-2xl border border-slate-100 dark:border-slate-700/50">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-3">
              Département :
            </span>
            <select
              value={selectedDeptId}
              onChange={(e) => setSelectedDeptId(e.target.value)}
              disabled={profile?.role === 'ADMIN'}
              className="bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-slate-200 py-2 px-4 rounded-xl border border-slate-200/50 dark:border-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand/20 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {profile?.role !== 'ADMIN' && (
                <option value="all">Tous les Départements</option>
              )}
              {DEPARTMENTS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {(() => {
          // Filtered services based on selection
          const filteredServices = serviceAnalytics.filter(
            (s) => selectedDeptId === 'all' || s.deptId === selectedDeptId
          );

          // Get stats for highlights
          const servicesWithTasks = filteredServices.filter((s) => s.totalTasks > 0);
          const topService = servicesWithTasks.reduce(
            (max, s) => (s.productivityScore > max.productivityScore ? s : max),
            { serviceName: 'Aucun', productivityScore: 0, deptName: 'N/A' } as any
          );
          const totalActiveTasks = filteredServices.reduce((sum, s) => sum + s.activeTasks, 0);
          const totalCompletedTasks = filteredServices.reduce((sum, s) => sum + s.completedTasks, 0);
          const totalTasksInScope = filteredServices.reduce((sum, s) => sum + s.totalTasks, 0);
          const overallProgress = totalTasksInScope > 0
            ? Math.round(filteredServices.reduce((sum, s) => sum + (s.avgProgress * s.totalTasks), 0) / totalTasksInScope)
            : 0;

          return (
            <>
              {/* Highlight Cards Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-500/5 dark:to-purple-500/5 p-6 rounded-3xl border border-indigo-100/50 dark:border-indigo-500/10">
                  <p className="text-[10px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-widest mb-1">
                    Service le plus Performant
                  </p>
                  <h4 className="text-lg font-black text-indigo-950 dark:text-indigo-200 truncate uppercase tracking-tight">
                    {topService.serviceName}
                  </h4>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                      {topService.productivityScore}%
                    </span>
                    <span className="text-[9px] font-black bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full uppercase tracking-widest">
                      {topService.deptName}
                    </span>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-500/5 dark:to-teal-500/5 p-6 rounded-3xl border border-emerald-100/50 dark:border-emerald-500/10">
                  <p className="text-[10px] font-black text-emerald-500 dark:text-emerald-400 uppercase tracking-widest mb-1">
                    Avancement Moyen des Tâches
                  </p>
                  <h4 className="text-lg font-black text-emerald-950 dark:text-emerald-200 uppercase tracking-tight">
                    Productivité Globale
                  </h4>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                      {overallProgress}%
                    </span>
                    <span className="text-[9px] font-black bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full uppercase tracking-widest">
                      {totalCompletedTasks} Terminées / {totalTasksInScope} Totales
                    </span>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-500/5 dark:to-orange-500/5 p-6 rounded-3xl border border-amber-100/50 dark:border-amber-500/10">
                  <p className="text-[10px] font-black text-amber-500 dark:text-amber-400 uppercase tracking-widest mb-1">
                    Flux Global Actif
                  </p>
                  <h4 className="text-lg font-black text-amber-950 dark:text-amber-200 uppercase tracking-tight">
                    Tâches en Cours d'Exécution
                  </h4>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
                      {totalActiveTasks}
                    </span>
                    <span className="text-[9px] font-black bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full uppercase tracking-widest">
                      Réparties sur {filteredServices.length} Services
                    </span>
                  </div>
                </div>
              </div>

              {/* Chart and Details row */}
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                {/* Productivity Chart */}
                <div className="lg:col-span-3 bg-slate-50 dark:bg-slate-800/20 rounded-3xl border border-slate-100 dark:border-slate-800/80 p-6 flex flex-col h-[380px]">
                  <div className="mb-4">
                    <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                      Productivité des Services (%) vs Volume de Tâches
                    </h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5 font-sans">
                      Analyse visuelle croisée
                    </p>
                  </div>
                  <div className="flex-1 min-h-0 w-full">
                    {servicesWithTasks.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-slate-450 dark:text-slate-500 italic text-sm text-center">
                        Aucune tâche enregistrée dans ce filtre pour effectuer l'analyse graphique.
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={servicesWithTasks.map((s) => ({
                            name: s.serviceName.length > 20 ? `${s.serviceName.slice(0, 18)}...` : s.serviceName,
                            'Volume Tâches': s.totalTasks,
                            'Score Productivité': s.productivityScore,
                          }))}
                          margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? "#1e293b" : "#F1F5F9"} />
                          <XAxis
                            dataKey="name"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: isDarkMode ? '#64748b' : '#94A3B8', fontSize: 8, fontWeight: 700 }}
                          />
                          <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: isDarkMode ? '#64748b' : '#94A3B8', fontSize: 8, fontWeight: 700 }}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: isDarkMode ? '#0f172a' : '#fff',
                              borderRadius: '16px',
                              border: 'none',
                              boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                            }}
                            labelStyle={{ fontSize: '10px', color: '#94A3B8', textTransform: 'uppercase', fontWeight: 900 }}
                          />
                          <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} />
                          <Bar dataKey="Score Productivité" fill="#6366F1" radius={[4, 4, 0, 0]} name="Productivité %" />
                          <Bar dataKey="Volume Tâches" fill="#10B981" radius={[4, 4, 0, 0]} name="Volume Tâches" />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                {/* Services List Breakdown */}
                <div className="lg:col-span-2 flex flex-col justify-between">
                  <div className="bg-slate-50 dark:bg-slate-800/20 rounded-3xl border border-slate-100 dark:border-slate-800/80 p-6 h-[380px] flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                          Détails des Unités
                        </h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">
                          Taux de réussite et effectifs
                        </p>
                      </div>
                      <span className="text-[9px] font-black text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-1 rounded-lg uppercase tracking-widest">
                        {filteredServices.length} Services
                      </span>
                    </div>

                    <div className="space-y-3 overflow-y-auto flex-1 pr-1 custom-scrollbar">
                      {filteredServices.map((service, idx) => {
                        let badgeColor = 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-455';
                        let badgeText = 'En attente';

                        if (service.totalTasks > 0) {
                          if (service.productivityScore > 75) {
                            badgeColor = 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400';
                            badgeText = 'Haute Perf';
                          } else if (service.productivityScore > 40) {
                            badgeColor = 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400';
                            badgeText = 'En Progrès';
                          } else {
                            badgeColor = 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400';
                            badgeText = 'Attention';
                          }
                        }

                        return (
                          <div
                            key={`${service.deptId}_${service.serviceId}_${idx}`}
                            className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/40 rounded-xl p-3 shadow-none hover:shadow-sm"
                          >
                            <div className="flex justify-between items-start gap-4 mb-2">
                              <div>
                                <h5 className="text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight leading-snug">
                                  {service.serviceName}
                                </h5>
                                <p className="text-[8px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                  {service.deptName} • {service.usersCount} collaborateur{service.usersCount !== 1 ? 's' : ''}
                                </p>
                              </div>
                              <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full shrink-0 ${badgeColor}`}>
                                {badgeText}
                              </span>
                            </div>

                            <div className="flex items-center gap-3">
                              <div className="flex-1 bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className="bg-indigo-600 dark:bg-indigo-500 h-full rounded-full"
                                  style={{ width: `${service.productivityScore}%` }}
                                ></div>
                              </div>
                              <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 font-mono">
                                {service.productivityScore}%
                              </span>
                            </div>

                            <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-50 dark:border-slate-800/50 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                              <span>Tâches: <strong>{service.totalTasks}</strong></span>
                              <span>Finies: <strong className="text-emerald-600 dark:text-emerald-400">{service.completedTasks}</strong></span>
                              <span>En cours: <strong className="text-amber-600 dark:text-amber-400">{service.activeTasks}</strong></span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </>
          );
        })()}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* Action List / Mes Tâches */}
        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-8 shadow-sm overflow-hidden flex flex-col">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight uppercase">Mes Tâches</h3>
            <button className="text-brand hover:text-emerald-700 p-1">
              <ChevronRight size={20} />
            </button>
          </div>
          
          <div className="space-y-6 flex-1 max-h-[300px] overflow-y-auto scrollbar-hide">
            {(profile?.role === 'SUPER_ADMIN' || profile?.role === 'ADMIN') ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-300 dark:text-slate-700 py-12">
                <CheckSquare size={48} strokeWidth={1} className="mb-4 opacity-10" />
                <p className="text-[10px] font-black uppercase tracking-widest text-center">Utilisez la page Tâches pour la gestion globale</p>
              </div>
            ) : myTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-300 dark:text-slate-700 py-12">
                <CheckSquare size={48} strokeWidth={1} className="mb-4 opacity-10" />
                <p className="text-[10px] font-black uppercase tracking-widest">Tranquille... pas de tâche</p>
              </div>
            ) : (
              myTasks.map((task) => (
                <div key={task.id} className="flex gap-4 group cursor-pointer">
                  <div className="mt-1">
                    <div className="w-5 h-5 rounded-lg border-2 border-slate-100 dark:border-slate-800 group-hover:border-emerald-500 transition-all bg-white dark:bg-slate-900 flex items-center justify-center text-white dark:text-slate-900">
                       {task.status === 'completed' && <div className="w-2 h-2 bg-emerald-500 rounded-sm"></div>}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-black text-slate-800 dark:text-slate-200 text-sm group-hover:text-emerald-600 transition-colors uppercase tracking-tight truncate">{task.title}</h4>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">{task.status}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-8 pt-8 border-t border-slate-50 dark:border-slate-800">
             <motion.div 
               whileHover={{ scale: 1.02 }}
               className="flex flex-col gap-4 p-6 bg-slate-900 dark:bg-emerald-600 rounded-[1.5rem] group cursor-pointer shadow-xl relative overflow-hidden"
             >
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center backdrop-blur-md">
                      <BrainCircuit size={18} className="text-emerald-400" />
                    </div>
                    <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Conseiller IA RIBERJO</p>
                  </div>
                  <p className="text-sm font-bold text-white leading-snug italic">
                    "{aiAdvice || "Analyse opérationnelle en cours... Vérification des protocoles de sécurité."}"
                  </p>
                </div>
                {/* Background Decoration */}
                <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-emerald-500/20 rounded-full blur-2xl"></div>
             </motion.div>
          </div>
        </div>

        {/* Global Recent Reports */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-8 shadow-sm overflow-hidden">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight uppercase">Rapports Récents</h3>
            <button className="text-[10px] font-black text-brand hover:underline uppercase tracking-widest">Tout voir</button>
          </div>
          <div className="overflow-x-auto scrollbar-hide">
            <table className="w-full text-left min-w-[500px]">
              <thead>
                <tr className="text-slate-400 dark:text-slate-500 text-[9px] uppercase tracking-[0.2em] font-black border-b border-slate-50 dark:border-slate-800">
                  <th className="pb-4">Rapport</th>
                  <th className="pb-4">Entité</th>
                  <th className="pb-4">Status</th>
                  <th className="pb-4 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {recentReports.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-300 dark:text-slate-700 italic text-sm">Silence radio... aucun rapport.</td>
                  </tr>
                ) : (
                  recentReports.map(report => (
                    <tr key={report.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group">
                      <td className="py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-slate-50 dark:bg-slate-800 rounded-lg flex items-center justify-center text-slate-400 dark:text-slate-600 group-hover:bg-white dark:group-hover:bg-slate-700 group-hover:shadow-sm transition-all">
                            <Package size={14} />
                          </div>
                          <div>
                            <p className="font-black text-slate-900 dark:text-slate-200 text-xs uppercase tracking-tight">{report.title}</p>
                            <p className="text-[8px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">{new Date(report.createdAt || Date.now()).toLocaleDateString()}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4">
                        <span className="text-[9px] font-black text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded uppercase tracking-widest">{report.departmentId}</span>
                      </td>
                      <td className="py-4">
                        <span className={`flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${
                          report.status === 'validated' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                          report.status === 'rejected' ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400' :
                          'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400'
                        }`}>
                          {report.status === 'validated' ? <FileCheck size={10} /> : 
                           report.status === 'rejected' ? <AlertCircle size={10} /> : 
                           <Clock size={10} />}
                          {report.status === 'pending' ? 'en attente' : report.status === 'validated' ? 'validé' : 'rejeté'}
                        </span>
                      </td>
                      <td className="py-4 text-right">
                        <button className="p-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg text-slate-200 dark:text-slate-700 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all">
                          <ChevronRight size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}


function FileTextIcon(props: any) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>;
}
