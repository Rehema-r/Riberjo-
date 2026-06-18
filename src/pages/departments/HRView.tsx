import React, { useState, useEffect } from 'react';
import { Users, UserPlus, ShieldAlert, Award, FileText, Search, UserCheck, Briefcase, Mail, TrendingUp, Calendar, Trash2, Layers, AlertCircle, Sparkles, HelpCircle } from 'lucide-react';
import { collection, query, orderBy, onSnapshot, setDoc, doc, getDocs, addDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { UserProfile } from '../../types';
import { motion } from 'motion/react';
import { DEPARTMENTS, SERVICES_LIST, generateMatricule as getGlobalMatricule } from '../../constants';

const PROD_BENCHMARKS = [
  { departmentId: '01', deptName: 'Ferme & Agriculture', code: 'FE', unit: 'Hectares cultivés', defaultVol: 50, defaultFactor: 5, unitLabel: 'Hectares / Agent / Mois' },
  { departmentId: '02', deptName: 'Santé & Médical', code: 'SA', unit: 'Consultations de patients', defaultVol: 450, defaultFactor: 125, unitLabel: 'Consultations / Praticien / Mois' },
  { departmentId: '03', deptName: 'Ressources Humaines', code: 'RH', unit: 'Employés actifs gérés', defaultVol: 120, defaultFactor: 40, unitLabel: 'Employés / Gestionnaire / Mois' },
  { departmentId: '04', deptName: 'Finance & Comptabilité', code: 'FI', unit: 'Factures & Pièces compta.', defaultVol: 900, defaultFactor: 300, unitLabel: 'Pièces / Comptable / Mois' },
  { departmentId: '05', deptName: 'Logistique & Transport', code: 'LO', unit: 'Expéditions gérées', defaultVol: 600, defaultFactor: 150, unitLabel: 'Expéditions / Agent / Mois' },
  { departmentId: '06', deptName: 'Marketing & Ventes', code: 'MV', unit: 'Chiffre d\'affaires (€)', defaultVol: 25000, defaultFactor: 5000, unitLabel: '€ CA générés / Commercial / Mois' },
];

export default function HRView({ activeSpace = 'USER' }: { activeSpace?: 'USER' | 'SUPER_USER' | 'ADMIN' }) {
  const { profile } = useAuth();
  
  // Custom user dashboard states
  const [clockInState, setClockInState] = useState<'out' | 'in'>('out');
  const [clockTime, setClockTime] = useState<string>('');
  const [leaves, setLeaves] = useState<any[]>([]);
  const [isLoadingLeaves, setIsLoadingLeaves] = useState(false);
  const [newLeave, setNewLeave] = useState({
    startDate: '',
    endDate: '',
    leaveType: 'Congés Payés',
    comments: ''
  });
  const [requestedCourse, setRequestedCourse] = useState('Habilitation Sécurité Pharmaceutique');
  const [skills, setSkills] = useState<{name: string, level: string}[]>([
    { name: 'Contrôle Sanitaire Niv 1', level: 'Intermédiaire' },
    { name: 'Tri Grainier Automatisé', level: 'Expert' }
  ]);

  const [employees, setEmployees] = useState<UserProfile[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmployee, setNewEmployee] = useState({
    fullName: '',
    email: '',
    role: 'USER' as any,
    departmentId: '03',
    serviceId: '01',
    gender: 'M' as 'M' | 'F',
    function: '',
    birthDate: '',
    civilStatus: 'Célibataire'
  });

  const [isCreating, setIsCreating] = useState(false);

  // Tabs: 'registry' for Employee registry, 'forecast' for planning simulation
  const [activeTab, setActiveTab] = useState<'registry' | 'forecast'>('registry');
  const [searchTerm, setSearchTerm] = useState('');

  // Forecast states
  const [selectedDept, setSelectedDept] = useState('01');
  const [targetVolume, setTargetVolume] = useState(50);
  const [productivityFactor, setProductivityFactor] = useState(5);
  const [absenteismRate, setAbsenteismRate] = useState(10);
  const [scenarioName, setScenarioName] = useState('Saison Haute 2026');
  const [isSavingScenario, setIsSavingScenario] = useState(false);
  const [savedForecasts, setSavedForecasts] = useState<any[]>([]);

  const currentBenchmark = PROD_BENCHMARKS.find(b => b.departmentId === selectedDept) || PROD_BENCHMARKS[0];

  useEffect(() => {
    const q = query(
      collection(db, 'users'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setEmployees(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile)));
    });

    const qF = query(
      collection(db, 'hr_forecasts'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeF = onSnapshot(qF, (snapshot) => {
      setSavedForecasts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const qL = query(
      collection(db, 'hr_leaves'),
      orderBy('createdAt', 'desc')
    );
    const unsubscribeL = onSnapshot(qL, (snapshot) => {
      setLeaves(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribe();
      unsubscribeF();
      unsubscribeL();
    };
  }, []);

  useEffect(() => {
    const benchmark = PROD_BENCHMARKS.find(b => b.departmentId === selectedDept);
    if (benchmark) {
      setTargetVolume(benchmark.defaultVol);
      setProductivityFactor(benchmark.defaultFactor);
    }
  }, [selectedDept]);

  const handleSaveScenario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setIsSavingScenario(true);

    try {
      const deptStaffCount = employees.filter(emp => emp.departmentId === selectedDept).length;
      const rawFte = targetVolume / (productivityFactor || 1);
      const projectedFte = Math.ceil(rawFte / (1 - absenteismRate / 100));
      const gap = projectedFte - deptStaffCount;

      await addDoc(collection(db, 'hr_forecasts'), {
        scenarioName,
        departmentId: selectedDept,
        departmentName: currentBenchmark.deptName,
        targetVolume,
        productivityFactor,
        absenteismRate,
        currentStaff: deptStaffCount,
        projectedFte,
        recruitmentGap: gap,
        unit: currentBenchmark.unit,
        unitLabel: currentBenchmark.unitLabel,
        createdBy: profile.fullName,
        createdAt: Date.now()
      });

      alert("Scénario de planification enregistré avec succès !");
      setScenarioName(`Saison Haute ${new Date().getFullYear()}`);
    } catch (err) {
      console.error("Error saving HR forecast scenario:", err);
      alert("Erreur lors de l'enregistrement du scénario.");
    } finally {
      setIsSavingScenario(false);
    }
  };

  const handleDeleteScenario = async (id: string) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer ce scénario de planification ?")) return;
    try {
      await deleteDoc(doc(db, 'hr_forecasts', id));
    } catch (err) {
      console.error("Error deleting scenario:", err);
      alert("Erreur de suppression du scénario.");
    }
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setIsCreating(true);

    try {
      const year = new Date().getFullYear();
      const employeesSnapshot = await getDocs(collection(db, 'users'));
      const count = employeesSnapshot.size + 1;
      const matricule = getGlobalMatricule(
        year,
        newEmployee.role,
        newEmployee.departmentId,
        count
      );
      const sanitizedId = matricule.replace(/\//g, '_');
      
      const employeeData = {
        ...newEmployee,
        matricule,
        password: 'ChangeMe123!', // Temporary password
        status: 'active',
        passwordChanged: false,
        createdAt: Date.now()
      };

      await setDoc(doc(db, 'users', sanitizedId), employeeData);
      setShowAddModal(false);
      setNewEmployee({ 
        fullName: '', email: '', role: 'USER', departmentId: '03', 
        serviceId: '01', gender: 'M', function: '', birthDate: '', 
        civilStatus: 'Célibataire' 
      });
      alert(`Employé créé avec succès!\nMatricule: ${matricule}\nMot de passe par défaut: ChangeMe123!`);
    } catch (err) {
      console.error("Error creating employee:", err);
      alert("Erreur lors de la création de l'employé.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleClockAction = () => {
    if (clockInState === 'out') {
      setClockInState('in');
      setClockTime(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
      alert("Pointage d'entrée enregistré avec succès !");
    } else {
      setClockInState('out');
      setClockTime('');
      alert("Pointage de sortie enregistré avec succès !");
    }
  };

  const handleRequestLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setIsLoadingLeaves(true);
    try {
      await addDoc(collection(db, 'hr_leaves'), {
        ...newLeave,
        fullName: profile.fullName,
        matricule: profile.matricule || 'N/A',
        status: 'En attente',
        createdAt: Date.now()
      });
      alert("Demande d'absence soumise avec succès !");
      setNewLeave({ startDate: '', endDate: '', leaveType: 'Congés Payés', comments: '' });
    } catch (err) {
      console.error("Error submitting leave request:", err);
    } finally {
      setIsLoadingLeaves(false);
    }
  };

  const handleRequestCourse = async (courseName: string) => {
    if (!profile) return;
    try {
      await addDoc(collection(db, 'hr_leaves'), {
        leaveType: 'Formation professionnelle',
        courseName,
        fullName: profile.fullName,
        matricule: profile.matricule || 'N/A',
        comments: `Demande de formation pour - ${courseName}`,
        status: 'En attente',
        createdAt: Date.now()
      });
      alert(`Votre demande d'inscription pour '${courseName}' a été transmise aux ressources humaines.`);
    } catch (err) {
      console.error("Error requesting course:", err);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {activeSpace === 'USER' ? (
        /* Agent/Collaborator Space */
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Ressources Humaines</h1>
            <p className="text-slate-500 font-medium">Espace Collaborateur : Suivi du pointage, demandes d’absence, formations et compétences gérées.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              {/* Absences request form */}
              <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-8 shadow-sm">
                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight mb-6 flex items-center gap-2">
                  <Calendar className="text-emerald-600" size={24} /> Demander une Absence / Congé
                </h3>
                
                <form onSubmit={handleRequestLeave} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Début de l'absence</label>
                      <input 
                        type="date"
                        required
                        value={newLeave.startDate}
                        onChange={(e) => setNewLeave({ ...newLeave, startDate: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold"
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Fin de l'absence (Inclus)</label>
                      <input 
                        type="date"
                        required
                        value={newLeave.endDate}
                        onChange={(e) => setNewLeave({ ...newLeave, endDate: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Motif / Type de Congé</label>
                      <select
                        value={newLeave.leaveType}
                        onChange={(e) => setNewLeave({ ...newLeave, leaveType: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold"
                      >
                        <option value="Congés Payés">Congés Payés</option>
                        <option value="Absence Maladie">Absence Maladie</option>
                        <option value="Régulation Heures">Régulation Heures</option>
                        <option value="Événement Familial">Événement Familial</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Commentaires</label>
                      <input 
                        type="text"
                        placeholder="Ex: Rendez-vous médical annuel, repos..."
                        value={newLeave.comments}
                        onChange={(e) => setNewLeave({ ...newLeave, comments: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold focus:outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoadingLeaves}
                    className="flex items-center justify-center gap-2 w-full py-4 bg-emerald-600 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-emerald-700 transition shadow-lg shadow-emerald-600/20"
                  >
                    {isLoadingLeaves ? 'Envoi...' : 'Soumettre ma demande d’absence'}
                  </button>
                </form>
              </div>

              {/* Training catalog list */}
              <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-8 shadow-sm">
                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight mb-4 flex items-center gap-2">
                  <Award className="text-emerald-600" size={24} /> Formations Professionnelles Disponibles
                </h3>
                <p className="text-xs text-slate-400 font-medium mb-6">Inscrivez-vous à des cours pour certifier de nouvelles compétences techniques.</p>

                <div className="space-y-4">
                  {[
                    { id: '1', name: 'Habilitation Sécurité Pharmaceutique', duration: '14 heures', format: 'Présentiel', desc: 'Protocoles de stérilisation et de manipulation stérile des produits.' },
                    { id: '2', name: 'Tri Grainier Automatisé Niv 2', duration: '8 heures', format: 'E-Learning & Atelier', desc: 'Paramétrage des trieurs optiques de récolte dernière génération.' },
                    { id: '3', name: 'Logistique Multimodale & Export', duration: '20 heures', format: 'Présentiel', desc: 'Gestion administrative des expéditions de récoltes à l’international.' }
                  ].map((course) => (
                    <div key={course.id} className="p-5 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100/40 dark:border-slate-700 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                      <div>
                        <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">{course.name}</h4>
                        <p className="text-xs text-slate-500 mt-1">{course.desc}</p>
                        <div className="flex gap-4 mt-2 text-[10px] text-slate-400 font-medium">
                          <span>Durée: <strong>{course.duration}</strong></span>
                          <span>Format: <strong>{course.format}</strong></span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRequestCourse(course.name)}
                        className="px-4 py-2 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-600 font-black text-[9px] uppercase tracking-widest rounded-xl transition-all self-start sm:self-center cursor-pointer shrink-0"
                      >
                        S'inscrire
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {/* Daily Shift pointage Cockpit */}
              <div className="bg-slate-950 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl">
                <h3 className="text-lg font-black uppercase tracking-tight mb-4 flex items-center gap-2">
                  <UserCheck className="text-emerald-400" size={24} /> Pointage Quotidien
                </h3>
                <p className="text-xs text-slate-400 font-medium leading-relaxed mb-6">
                  Enregistrez vos heures de prise de poste et de fin de service d’un simple clic.
                </p>

                <div className="bg-white/5 rounded-3xl p-6 border border-white/10 text-center mb-6">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Statut de la Session</p>
                  <p className={`text-xl font-black uppercase tracking-tight mt-1 ${clockInState === 'in' ? 'text-emerald-400' : 'text-slate-400'}`}>
                    {clockInState === 'in' ? `Actif (Arrivé à ${clockTime})` : 'Hors Service'}
                  </p>
                </div>

                <button
                  onClick={handleClockAction}
                  className={`w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg text-center cursor-pointer ${
                    clockInState === 'out'
                      ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-500/20'
                      : 'bg-rose-600 text-white hover:bg-rose-700 shadow-rose-600/20'
                  }`}
                >
                  {clockInState === 'out' ? "Pointer l'Heure d'Arrivée" : "Pointer la Fin de Service"}
                </button>
                <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl"></div>
              </div>

              {/* Skills and Certificates list for USER */}
              <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-8 shadow-sm">
                <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight mb-4 flex items-center gap-2">
                  <Award className="text-emerald-600" size={20} /> Mes Aptitudes & Compétences Validées
                </h3>
                
                <div className="space-y-3">
                  {skills.map((skill, index) => (
                    <div key={index} className="p-4 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-850/50 flex justify-between items-center">
                      <div>
                        <p className="text-xs font-black text-slate-950 dark:text-slate-100 uppercase">{skill.name}</p>
                        <p className="text-[9px] text-slate-400 font-mono mt-0.5">Certifié par un inspecteur certifiant</p>
                      </div>
                      <span className="text-[9px] font-mono font-black text-emerald-600 bg-emerald-500/10 px-2.5 py-1 rounded uppercase tracking-wider">
                        {skill.level}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Original HR Super User dashboard */
        <>
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div>
              <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Ressources Humaines</h1>
              <p className="text-slate-500 font-medium">Espace Expert : Gestion globale du personnel, recrutement et planification.</p>
            </div>
            
            {/* Navigation Tabs */}
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
              <div className="bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl flex gap-1 w-full sm:w-auto justify-center shadow-inner">
                <button
                  onClick={() => setActiveTab('registry')}
                  className={`flex items-center gap-2 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all w-1/2 sm:w-auto justify-center ${
                    activeTab === 'registry'
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 font-bold'
                  }`}
                >
                  <Users size={14} /> Registre / Effectif
                </button>
                <button
                  onClick={() => setActiveTab('forecast')}
                  className={`flex items-center gap-2 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all w-1/2 sm:w-auto justify-center ${
                    activeTab === 'forecast'
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                  }`}
                >
                  <TrendingUp size={14} /> Prévision de Personnel
                </button>
              </div>

              {activeTab === 'registry' && (
                <button 
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg active:scale-95 w-full sm:w-auto justify-center cursor-pointer"
                >
                  <UserPlus size={16} /> Recruter un Employé
                </button>
              )}
            </div>
          </div>

          {activeTab === 'registry' ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden group">
              <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500" />
              <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 rounded-2xl flex items-center justify-center mb-6">
                <Users size={24} />
              </div>
              <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Total Effectif</p>
              <p className="text-4xl font-black text-slate-900 dark:text-white">{employees.length}</p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden group">
              <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-24 h-24 bg-blue-500/5 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500" />
              <div className="w-12 h-12 bg-blue-50 dark:bg-blue-500/10 text-blue-600 rounded-2xl flex items-center justify-center mb-6">
                <UserCheck size={24} />
              </div>
              <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Présence Réelle Moyenne</p>
              <p className="text-4xl font-black text-slate-900 dark:text-white">94%</p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden group">
              <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-24 h-24 bg-amber-500/5 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500" />
              <div className="w-12 h-12 bg-amber-50 dark:bg-amber-500/10 text-amber-600 rounded-2xl flex items-center justify-center mb-6">
                <Award size={24} />
              </div>
              <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Certifications Homologuées</p>
              <p className="text-4xl font-black text-slate-900 dark:text-white">12</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-slate-50 dark:border-slate-800 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Registre du Personnel</h3>
                <p className="text-xs text-slate-400 font-medium">Filtres et consultations directes des fiches collaborateur.</p>
              </div>
              <div className="relative w-full sm:w-auto">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Rechercher par nom, matricule, rôle..." 
                  className="w-full sm:w-80 pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/50 dark:bg-slate-800/20 border-b border-slate-50 dark:border-slate-800">
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Employé</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Matricule</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Département</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Statut</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50 text-sans">
                  {employees
                    .filter(emp => {
                      const value = (searchTerm || '').toLowerCase();
                      return (
                        (emp.fullName || '').toLowerCase().includes(value) ||
                        (emp.matricule || '').toLowerCase().includes(value) ||
                        ((emp.function || '').toLowerCase().includes(value)) ||
                        (emp.departmentId || '').toLowerCase().includes(value)
                      );
                    })
                    .map((emp) => (
                      <tr key={emp.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-500 font-bold uppercase border border-white dark:border-slate-700 shadow-inner">
                              {emp.fullName.charAt(0)}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-900 dark:text-white">{emp.fullName}</p>
                              <p className="text-[10px] text-slate-500 font-medium underline">{emp.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <span className="text-[10px] font-mono font-black text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg">
                            {emp.matricule}
                          </span>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-2">
                            <Briefcase size={14} className="text-slate-400" />
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">
                              {DEPARTMENTS.find(d => d.id === emp.departmentId)?.name || `Département ${emp.departmentId}`}
                            </span>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-tighter ${
                            emp.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' : 'bg-red-100 text-red-700'
                          }`}>
                            {emp.status === 'active' ? 'Actif' : 'Suspendu'}
                          </span>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex justify-center gap-2">
                            <button className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-colors"><FileText size={16} /></button>
                            <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors"><Mail size={16} /></button>
                            <button className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"><ShieldAlert size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {employees.length === 0 && (
                <div className="py-20 text-center flex flex-col items-center gap-2">
                  <Users className="text-slate-200 dark:text-slate-800" size={48} />
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest text-sans">Aucun employé dans le registre</p>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        /* Predictive Workforce Planning Module Tab */
        <div className="space-y-8">
          <div className="bg-slate-50 dark:bg-slate-950/40 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
            <div className="space-y-2 max-w-xl">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black bg-emerald-500/10 text-emerald-600 uppercase tracking-widest">
                <Sparkles size={11} /> Planification FTE Prévisionnelle
              </span>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Données Historiques & Productivité</h2>
              <p className="text-sm text-slate-500 leading-relaxed font-sans">
                Ce module utilise la charge de travail ciblée et les standards historiques de productivité mensuelle par agent pour estimer les besoins en effectifs réels de l'entreprise (équivalent temps plein - ETP / FTE), en ajustant avec une marge de tolérance d'absentéisme.
              </p>
            </div>
            
            {/* Visual general benchmark statistics */}
            <div className="grid grid-cols-2 gap-4 w-full lg:w-auto font-mono">
              <div className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Norme Agricole</p>
                <p className="text-base font-black text-slate-900 dark:text-white mt-1">5 Ha / Agent</p>
              </div>
              <div className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Norme Médicale</p>
                <p className="text-base font-black text-slate-900 dark:text-white mt-1">125 Consult. / Doc</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Simulation settings form */}
            <div className="lg:col-span-5 bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm space-y-6">
              <div className="pb-4 border-b border-slate-50 dark:border-slate-800">
                <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">Ajuster la Simulation</h3>
                <p className="text-xs text-slate-400 font-sans mt-1">Variez les volumes opérationnels cibles.</p>
              </div>

              <div className="space-y-4 font-sans">
                {/* Department Selection */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Département d'analyse</label>
                  <select
                    value={selectedDept}
                    onChange={(e) => setSelectedDept(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-800 dark:text-slate-100"
                  >
                    {DEPARTMENTS.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                {/* Target Volume */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center ml-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Volume d'activité ciblé ({currentBenchmark.unit})
                    </label>
                    <span className="text-xs font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-500/15 px-2.5 py-0.5 rounded-lg font-mono">
                      {targetVolume}
                    </span>
                  </div>
                  <input
                    type="number"
                    min="1"
                    value={targetVolume}
                    onChange={(e) => setTargetVolume(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold focus:outline-none"
                  />
                  <input
                    type="range"
                    min="10"
                    max={currentBenchmark.departmentId === '01' ? 200 : currentBenchmark.departmentId === '06' ? 100000 : 2000}
                    step={currentBenchmark.departmentId === '06' ? 5000 : 10}
                    value={targetVolume}
                    onChange={(e) => setTargetVolume(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-600 mt-2"
                  />
                </div>

                {/* Productivity Factor benchmark */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center ml-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Productivité standard historique
                    </label>
                    <span className="text-[9px] font-mono text-slate-400 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-100 dark:border-slate-700">
                      {currentBenchmark.unitLabel}
                    </span>
                  </div>
                  <input
                    type="number"
                    min="1"
                    value={productivityFactor}
                    onChange={(e) => setProductivityFactor(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-400 font-sans italic ml-1">
                    Bâti sur la moyenne de productivité réelle constatée l'an dernier.
                  </p>
                </div>

                {/* Absenteeism rate tolerance */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center ml-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Taux d'absentéisme prévu
                    </label>
                    <span className="text-xs font-black text-rose-600 bg-rose-50 dark:bg-rose-500/10 px-2.5 py-0.5 rounded-lg font-mono">
                      {absenteismRate}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="40"
                    value={absenteismRate}
                    onChange={(e) => setAbsenteismRate(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-500"
                  />
                  <p className="text-[10px] text-slate-400 italic block leading-relaxed ml-1">
                    Augmente proportionnellement le FTE requis pour compenser les congés et arrêts.
                  </p>
                </div>
              </div>

              {/* Quick Save Scenario Form */}
              <form onSubmit={handleSaveScenario} className="pt-6 border-t border-slate-50 dark:border-slate-800 space-y-3 font-sans">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Enregistrer ce scénario</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Nom du scénario (ex: Pic Récolte)"
                    value={scenarioName}
                    onChange={(e) => setScenarioName(e.target.value)}
                    className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-bold"
                  />
                  <button
                    type="submit"
                    disabled={isSavingScenario}
                    className="px-5 py-3 bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isSavingScenario ? '...' : 'Enregistrer'}
                  </button>
                </div>
              </form>
            </div>

            {/* Calculations and visual widgets */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* FTE analysis result dashboard */}
              <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden">
                <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-48 h-48 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
                
                <h3 className="text-sm font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-6">FTE Requis vs Effectif Actuel</h3>
                
                {(() => {
                  const deptStaffCount = employees.filter(emp => emp.departmentId === selectedDept).length;
                  const rawFte = targetVolume / (productivityFactor || 1);
                  const divisor = 1 - (absenteismRate / 100);
                  const finalFteNeeded = Math.max(1, Math.ceil(rawFte / (divisor || 0.01)));
                  const gap = finalFteNeeded - deptStaffCount;

                  return (
                    <div className="space-y-8">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 font-mono">
                        <div className="bg-slate-50/50 dark:bg-slate-800/20 p-5 rounded-2xl border border-slate-50 dark:border-slate-800">
                          <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Effectif Actuel ({currentBenchmark.code})</p>
                          <div className="flex items-baseline gap-1 mt-2">
                            <span className="text-3xl font-black text-slate-800 dark:text-white">{deptStaffCount}</span>
                            <span className="text-xs font-bold text-slate-500">agents</span>
                          </div>
                        </div>

                        <div className="bg-emerald-500/5 dark:bg-emerald-500/10 p-5 rounded-2xl border border-emerald-500/10">
                          <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Besoins Figma (FTE)</p>
                          <div className="flex items-baseline gap-1 mt-2">
                            <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{finalFteNeeded}</span>
                            <span className="text-xs font-bold text-emerald-500">ETP / FTE</span>
                          </div>
                        </div>

                        <div className={`p-5 rounded-2xl border ${
                          gap > 0 
                            ? 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 border-rose-100 dark:border-rose-950/30' 
                            : 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 border-indigo-100 dark:border-indigo-950/30'
                        }`}>
                          <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Écart de Recrutement</p>
                          <div className="flex items-baseline gap-1 mt-2">
                            <span className="text-3xl font-black">
                              {gap > 0 ? `+${gap}` : gap}
                            </span>
                            <span className="text-xs font-bold">{gap > 0 ? 'à recruter' : 'surplus / optimal'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Visual SVG bar charts representing actual vs requirements */}
                      <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Comparaison Graphique des Ressources</p>
                        
                        <div className="space-y-3 font-sans text-xs">
                          {/* Available Bar */}
                          <div>
                            <div className="flex justify-between font-bold text-slate-600 dark:text-slate-300 mb-1">
                              <span>Effectif Actuel disponible</span>
                              <span>{deptStaffCount} FTE</span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-800 h-4 rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(100, (deptStaffCount / (finalFteNeeded || 1)) * 100)}%` }}
                                className="bg-slate-400 dark:bg-slate-500 h-full rounded-full transition-all"
                              />
                            </div>
                          </div>

                          {/* Needed Bar */}
                          <div>
                            <div className="flex justify-between font-bold text-emerald-600 dark:text-emerald-400 mb-1">
                              <span>Effectif FTE cible requis</span>
                              <span>{finalFteNeeded} FTE</span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-800 h-4 rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: '100%' }}
                                className="bg-emerald-500 h-full rounded-full transition-all"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Recommendation Alert message block */}
                      <div className={`p-5 rounded-2xl border flex gap-3.5 ${
                        gap > 0 
                          ? 'bg-amber-50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-300 border-amber-200/60 dark:border-amber-950' 
                          : gap === 0 
                            ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-950'
                            : 'bg-blue-50 dark:bg-blue-950/20 text-blue-900 dark:text-blue-300 border-blue-200/60 dark:border-blue-950'
                      }`}>
                        <div className="mt-0.5 shrink-0">
                          {gap > 0 ? <AlertCircle size={20} className="text-amber-600" /> : <Sparkles size={20} className="text-emerald-600" />}
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-black uppercase tracking-wider">Avis de l'algorithme prévisionnel</p>
                          <p className="text-xs font-sans leading-relaxed opacity-90">
                            {gap > 0 ? (
                              `Alerte: Un sous-effectif de ${gap} FTE est identifié pour couvrir ce niveau d'activité historique. Il est vivement conseillé de lancer des procédures de recrutement ou de réaffecter des effectifs internes.`
                            ) : gap === 0 ? (
                              `Félicitations: Vos effectifs dans le département sont parfaitement dimensionnés pour la productivité visée.`
                            ) : (
                              `Optimisation: Vous disposez de ${Math.abs(gap)} recrues en surcapacité théorique pour cette charge. Idéal pour former temporairement d'autres services ou délester la charge horaire.`
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Scenarios Historiques (History feed) */}
              <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm space-y-6">
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">Scénarios Enregistrés ({savedForecasts.length})</h3>
                  <p className="text-xs text-slate-400 font-sans mt-0.5">Historique des modélisations prévisionnelles de besoins RH.</p>
                </div>

                <div className="space-y-3 max-h-[340px] overflow-y-auto pr-2">
                  {savedForecasts.map((sc) => (
                    <div key={sc.id} className="p-5 bg-slate-50/50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex justify-between items-center group">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-slate-950 dark:text-slate-100">{sc.scenarioName}</span>
                          <span className="text-[9px] font-mono font-black text-slate-400 uppercase tracking-widest bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">
                            {sc.departmentName || `Dépt ${sc.departmentId}`}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium font-sans flex flex-wrap gap-x-3 gap-y-1">
                          <span>Cible: <strong>{sc.targetVolume} {sc.unit}</strong></span>
                          <span>Norme: <strong>{sc.productivityFactor} / agent</strong></span>
                          <span>Taux Abs: <strong>{sc.absenteismRate}%</strong></span>
                        </div>
                        <div className="text-[9px] text-slate-400 font-mono">
                          Calculé par {sc.createdBy} le {new Date(sc.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Écart Recrutement</p>
                          <span className={`text-base font-black ${
                            sc.recruitmentGap > 0 ? 'text-rose-600' : 'text-emerald-600'
                          }`}>
                            {sc.recruitmentGap > 0 ? `+${sc.recruitmentGap} ETP` : sc.recruitmentGap === 0 ? 'Optimal' : `${sc.recruitmentGap} ETP`}
                          </span>
                        </div>
                        <button
                          onClick={() => handleDeleteScenario(sc.id)}
                          className="p-2 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 dark:bg-slate-800 dark:hover:bg-rose-950/20 dark:hover:text-rose-400 text-slate-400 rounded-lg transition-colors cursor-pointer"
                          title="Supprimer ce scénario"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}

                  {savedForecasts.length === 0 && (
                    <div className="py-12 text-center flex flex-col items-center gap-2 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
                      <Layers className="text-slate-200 dark:text-slate-800" size={36} />
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Aucun scénario enregistré</p>
                      <p className="text-[10px] text-slate-400 px-4 max-w-xs leading-relaxed font-sans">Enregistrez vos modulations RH pour d'autres campagnes de production l'an prochain.</p>
                    </div>
                  )}
                </div>
              </div>

            </div>

          </div>
        </div>
      )}
        </>
      )}


      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setShowAddModal(false)} />

          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[2.5rem] p-10 relative z-10 shadow-2xl overflow-y-auto max-h-[90vh]"
          >
            <h2 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-8">Nouveau Recrutement</h2>
            
            <form onSubmit={handleCreateEmployee} className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nom Complet</label>
                  <input 
                    type="text" required
                    value={newEmployee.fullName}
                    onChange={(e) => setNewEmployee({...newEmployee, fullName: e.target.value})}
                    placeholder="Ex: Jean Dupont"
                    className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Professionnel</label>
                  <input 
                    type="email" required
                    value={newEmployee.email}
                    onChange={(e) => setNewEmployee({...newEmployee, email: e.target.value})}
                    placeholder="j.dupont@riberjo.com"
                    className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Département</label>
                  <select 
                    value={newEmployee.departmentId}
                    onChange={(e) => {
                      const deptId = e.target.value;
                      const firstService = SERVICES_LIST.find(s => s.deptId === deptId)?.id || '01';
                      setNewEmployee({
                        ...newEmployee,
                        departmentId: deptId,
                        serviceId: firstService
                      });
                    }}
                    className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-white"
                  >
                    {DEPARTMENTS.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Rôle Système</label>
                  <select 
                    value={newEmployee.role}
                    onChange={(e) => setNewEmployee({...newEmployee, role: e.target.value as any})}
                    className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-white"
                  >
                    <option value="USER">Travailleur (User)</option>
                    <option value="SUPER_USER">Expert (Super User)</option>
                    <option value="ADMIN">Directeur (Admin)</option>
                    <option value="SUPER_ADMIN">DG (Super Admin)</option>
                  </select>
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Service Affecté</label>
                   <select 
                    value={newEmployee.serviceId}
                    onChange={(e) => setNewEmployee({...newEmployee, serviceId: e.target.value})}
                    className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-white"
                  >
                    {SERVICES_LIST.filter(s => s.deptId === newEmployee.departmentId).map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                    {SERVICES_LIST.filter(s => s.deptId === newEmployee.departmentId).length === 0 && (
                      <option value="01">Service Standard (01)</option>
                    )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-6">
                 <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fonction</label>
                  <input 
                    type="text" required
                    value={newEmployee.function}
                    onChange={(e) => setNewEmployee({...newEmployee, function: e.target.value})}
                    placeholder="Ex: Agronome"
                    className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold"
                  />
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Sexe</label>
                    <div className="flex gap-4 p-1 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                      <button 
                        type="button" 
                        onClick={() => setNewEmployee({...newEmployee, gender: 'M'})}
                        className={`flex-1 py-2 text-[10px] font-black uppercase rounded-xl transition-all ${newEmployee.gender === 'M' ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm' : 'text-slate-400'}`}
                      >
                        Homme
                      </button>
                      <button 
                         type="button"
                         onClick={() => setNewEmployee({...newEmployee, gender: 'F'})}
                         className={`flex-1 py-2 text-[10px] font-black uppercase rounded-xl transition-all ${newEmployee.gender === 'F' ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm' : 'text-slate-400'}`}
                      >
                        Femme
                      </button>
                    </div>
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">État Civil</label>
                    <select 
                      value={newEmployee.civilStatus}
                      onChange={(e) => setNewEmployee({...newEmployee, civilStatus: e.target.value})}
                      className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold"
                    >
                      <option value="Célibataire">Célibataire</option>
                      <option value="Marié(e)">Marié(e)</option>
                      <option value="Divorcé(e)">Divorcé(e)</option>
                      <option value="Veuf/Veuve">Veuf/Veuve</option>
                    </select>
                </div>
              </div>

              <div className="flex gap-4 pt-8">
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-8 py-5 border border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                >
                  Annuler
                </button>
                <button 
                  type="submit"
                  disabled={isCreating}
                  className="flex-1 px-8 py-5 bg-emerald-600 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-500/20 disabled:opacity-50"
                >
                  {isCreating ? 'Traitement...' : 'Finaliser le Recrutement'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
