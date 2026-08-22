import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  GraduationCap, 
  Users, 
  CreditCard, 
  FileText, 
  Plus, 
  Search, 
  Filter, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Download, 
  Printer, 
  DollarSign, 
  BookOpen, 
  Award, 
  Calendar, 
  Building2, 
  Sparkles, 
  PhoneCall, 
  Receipt, 
  UserPlus, 
  ShieldCheck, 
  AlertTriangle,
  ChevronRight,
  TrendingUp,
  Percent
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, query, getDocs, addDoc, updateDoc, doc, where } from 'firebase/firestore';
import PaymentGatewayModal from '../../components/PaymentGatewayModal';

export interface Student {
  id: string;
  matricule: string;
  fullName: string;
  dateOfBirth?: string;
  gender: 'M' | 'F';
  className: string; // Maternelle, 1ère Primaire, 6ème des Humanités Math-Physique, etc.
  parentName: string;
  parentPhone: string;
  parentEmail?: string;
  tuitionStatus: 'PAYÉ' | 'PARTIEL' | 'ARRIÉRÉ';
  tuitionPaid: number;
  tuitionTotal: number;
  generalAverage?: number;
  status: 'ACTIF' | 'SUSPENDU' | 'DIPLÔMÉ';
  createdAt: number;
}

export interface PaymentRecord {
  id?: string;
  referenceCode: string;
  payerName: string;
  amount: number;
  currency: string;
  method: string;
  reason: string;
  studentId?: string;
  studentName?: string;
  className?: string;
  status: string;
  createdAt: number;
}

export interface ReportCard {
  id?: string;
  studentId: string;
  studentName: string;
  className: string;
  term: '1er Trimestre' | '2ème Trimestre' | '3ème Trimestre';
  marks: { subject: string; score: number; maxScore: number }[];
  percentage: number;
  rank: string;
  teacherComment: string;
  createdAt: number;
}

const DEFAULT_CLASSES = [
  'Maternelle - Petite Section',
  'Maternelle - Grande Section',
  '1ère Primaire',
  '2ème Primaire',
  '3ème Primaire',
  '4ème Primaire',
  '5ème Primaire',
  '6ème Primaire',
  '1ère Humanités Scientifiques',
  '2ème Humanités Scientifiques',
  '3ème Humanités Scientifiques',
  '4ème Humanités Math-Physique',
  '4ème Humanités Biologie-Chimie',
  '4ème Humanités Commerciale'
];

export default function SchoolView({ activeSpace }: { activeSpace: 'USER' | 'SUPER_USER' | 'ADMIN' }) {
  const [activeTab, setActiveTab] = useState<'overview' | 'students' | 'payments' | 'reportcards' | 'attendance'>('overview');
  
  // Data state
  const [students, setStudents] = useState<Student[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [reportCards, setReportCards] = useState<ReportCard[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState('ALL');
  const [selectedTuitionFilter, setSelectedTuitionFilter] = useState('ALL');

  // Modals
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showReportCardModal, setShowReportCardModal] = useState(false);

  // Payment Target State
  const [paymentTargetStudent, setPaymentTargetStudent] = useState<Student | null>(null);

  // New Student Form
  const [newStudent, setNewStudent] = useState({
    fullName: '',
    gender: 'M' as 'M' | 'F',
    className: DEFAULT_CLASSES[2],
    parentName: '',
    parentPhone: '0820000000',
    tuitionTotal: 450,
    tuitionPaid: 0
  });

  // New Report Card Form
  const [selectedStudentForReport, setSelectedStudentForReport] = useState<Student | null>(null);
  const [reportTerm, setReportTerm] = useState<'1er Trimestre' | '2ème Trimestre' | '3ème Trimestre'>('1er Trimestre');
  const [reportMarks, setReportMarks] = useState([
    { subject: 'Mathématiques', score: 18, maxScore: 20 },
    { subject: 'Français & Rédaction', score: 16, maxScore: 20 },
    { subject: 'Physique - Chimie', score: 15, maxScore: 20 },
    { subject: 'Sciences Naturelles', score: 17, maxScore: 20 },
    { subject: 'Informatique & Tech', score: 19, maxScore: 20 },
    { subject: 'Histoire - Géographie', score: 14, maxScore: 20 }
  ]);
  const [teacherComment, setTeacherComment] = useState('Très bon élève, discipliné et assidu.');

  useEffect(() => {
    fetchSchoolData();
  }, []);

  const fetchSchoolData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Students
      const studentsSnap = await getDocs(collection(db, 'students')).catch(err => {
        handleFirestoreError(err, OperationType.LIST, 'students');
        return { docs: [] } as any;
      });
      const studentList = studentsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Student));
      
      // If empty, seed mock students for immediate testing
      if (studentList.length === 0) {
        const mockStudents: Omit<Student, 'id'>[] = [
          {
            matricule: 'ELV-2026-001',
            fullName: 'Ephraïm MUKENDI',
            gender: 'M',
            className: '4ème Humanités Math-Physique',
            parentName: 'M. Mukendi Jean',
            parentPhone: '0812345678',
            tuitionStatus: 'PAYÉ',
            tuitionPaid: 450,
            tuitionTotal: 450,
            generalAverage: 82.5,
            status: 'ACTIF',
            createdAt: Date.now() - 86400000 * 30
          },
          {
            matricule: 'ELV-2026-002',
            fullName: 'Bénédicte KABONGO',
            gender: 'F',
            className: '4ème Humanités Biologie-Chimie',
            parentName: 'Mme Kabongo Sarah',
            parentPhone: '0829876543',
            tuitionStatus: 'PARTIEL',
            tuitionPaid: 250,
            tuitionTotal: 450,
            generalAverage: 76.0,
            status: 'ACTIF',
            createdAt: Date.now() - 86400000 * 20
          },
          {
            matricule: 'ELV-2026-003',
            fullName: 'David KASANGA',
            gender: 'M',
            className: '1ère Primaire',
            parentName: 'M. Kasanga Pierre',
            parentPhone: '0991122334',
            tuitionStatus: 'ARRIÉRÉ',
            tuitionPaid: 0,
            tuitionTotal: 300,
            generalAverage: 68.0,
            status: 'ACTIF',
            createdAt: Date.now() - 86400000 * 10
          }
        ];

        for (const s of mockStudents) {
          const docRef = await addDoc(collection(db, 'students'), s);
          studentList.push({ id: docRef.id, ...s });
        }
      }

      setStudents(studentList);

      // 2. Fetch Payments
      const paymentsSnap = await getDocs(collection(db, 'payments')).catch(err => {
        handleFirestoreError(err, OperationType.LIST, 'payments');
        return { docs: [] } as any;
      });
      const paymentList = paymentsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() } as PaymentRecord));
      setPayments(paymentList);

      // 3. Fetch Report Cards
      const reportsSnap = await getDocs(collection(db, 'report_cards')).catch(err => {
        handleFirestoreError(err, OperationType.LIST, 'report_cards');
        return { docs: [] } as any;
      });
      const reportList = reportsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() } as ReportCard));
      setReportCards(reportList);

    } catch (err) {
      console.error("Error fetching school data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    const matricule = `ELV-2026-${(students.length + 1).toString().padStart(3, '0')}`;
    const paid = Number(newStudent.tuitionPaid);
    const total = Number(newStudent.tuitionTotal);
    const status: 'PAYÉ' | 'PARTIEL' | 'ARRIÉRÉ' = 
      paid >= total ? 'PAYÉ' : paid > 0 ? 'PARTIEL' : 'ARRIÉRÉ';

    const studentRecord: Omit<Student, 'id'> = {
      matricule,
      fullName: newStudent.fullName,
      gender: newStudent.gender,
      className: newStudent.className,
      parentName: newStudent.parentName,
      parentPhone: newStudent.parentPhone,
      tuitionStatus: status,
      tuitionPaid: paid,
      tuitionTotal: total,
      status: 'ACTIF',
      createdAt: Date.now()
    };

    try {
      const docRef = await addDoc(collection(db, 'students'), studentRecord);
      setStudents(prev => [{ id: docRef.id, ...studentRecord }, ...prev]);
      setShowAddStudentModal(false);
      setNewStudent({
        fullName: '',
        gender: 'M',
        className: DEFAULT_CLASSES[2],
        parentName: '',
        parentPhone: '0820000000',
        tuitionTotal: 450,
        tuitionPaid: 0
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenPaymentForStudent = (student: Student) => {
    setPaymentTargetStudent(student);
    setShowPaymentModal(true);
  };

  const handlePaymentSuccess = async (paymentRecord: any) => {
    if (paymentTargetStudent) {
      const newPaid = Number(paymentTargetStudent.tuitionPaid || 0) + Number(paymentRecord.amountInUSD || paymentRecord.amount);
      const newStatus = newPaid >= paymentTargetStudent.tuitionTotal ? 'PAYÉ' : 'PARTIEL';

      try {
        await updateDoc(doc(db, 'students', paymentTargetStudent.id), {
          tuitionPaid: newPaid,
          tuitionStatus: newStatus
        });
        setStudents(prev => prev.map(s => s.id === paymentTargetStudent.id ? { ...s, tuitionPaid: newPaid, tuitionStatus: newStatus } : s));
      } catch (err) {
        console.error(err);
      }
    }
    fetchSchoolData();
  };

  const handleCreateReportCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentForReport) return;

    const totalScore = reportMarks.reduce((acc, m) => acc + m.score, 0);
    const totalMax = reportMarks.reduce((acc, m) => acc + m.maxScore, 0);
    const percentage = Number(((totalScore / totalMax) * 100).toFixed(1));

    const newReport: Omit<ReportCard, 'id'> = {
      studentId: selectedStudentForReport.id,
      studentName: selectedStudentForReport.fullName,
      className: selectedStudentForReport.className,
      term: reportTerm,
      marks: reportMarks,
      percentage,
      rank: percentage > 80 ? '1er / 35' : percentage > 70 ? '5ème / 35' : '12ème / 35',
      teacherComment,
      createdAt: Date.now()
    };

    try {
      const docRef = await addDoc(collection(db, 'report_cards'), newReport);
      setReportCards(prev => [{ id: docRef.id, ...newReport }, ...prev]);
      
      // Update student's general average
      await updateDoc(doc(db, 'students', selectedStudentForReport.id), {
        generalAverage: percentage
      });
      setStudents(prev => prev.map(s => s.id === selectedStudentForReport.id ? { ...s, generalAverage: percentage } : s));

      setShowReportCardModal(false);
      setSelectedStudentForReport(null);
    } catch (err) {
      console.error(err);
    }
  };

  // Filtered Students
  const filteredStudents = students.filter(student => {
    const matchesSearch = student.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          student.matricule.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          student.parentName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesClass = selectedClassFilter === 'ALL' || student.className === selectedClassFilter;
    const matchesTuition = selectedTuitionFilter === 'ALL' || student.tuitionStatus === selectedTuitionFilter;
    return matchesSearch && matchesClass && matchesTuition;
  });

  // Calculate KPIs
  const totalStudents = students.length;
  const totalTuitionExpected = students.reduce((sum, s) => sum + s.tuitionTotal, 0);
  const totalTuitionCollected = students.reduce((sum, s) => sum + s.tuitionPaid, 0);
  const recoveryRate = totalTuitionExpected > 0 ? ((totalTuitionCollected / totalTuitionExpected) * 100).toFixed(1) : 0;
  const paidCount = students.filter(s => s.tuitionStatus === 'PAYÉ').length;

  return (
    <div className="space-y-10 pb-20">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 bg-purple-600 rounded-[2rem] flex items-center justify-center text-white shadow-xl shadow-purple-900/40">
              <GraduationCap size={40} />
            </div>
            <div>
              <span className="px-3 py-1 bg-purple-500/20 text-purple-300 text-[10px] font-black uppercase tracking-widest rounded-full">
                Département Éducation & Écoles
              </span>
              <h1 className="text-3xl font-black uppercase tracking-tight mt-1">Complexe Scolaire RIBERJO</h1>
              <p className="text-slate-300 text-xs font-medium">Gestion académique, minerval, guichet Mobile Money et bulletins intelligents.</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setShowAddStudentModal(true)}
              className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg transition-all flex items-center gap-2"
            >
              <UserPlus size={18} /> Inscrire un Élève
            </button>
            <button
              onClick={() => {
                setPaymentTargetStudent(null);
                setShowPaymentModal(true);
              }}
              className="px-6 py-3.5 bg-purple-600 hover:bg-purple-500 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg transition-all flex items-center gap-2"
            >
              <CreditCard size={18} /> Guichet Minerval (M-Pesa)
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
            activeTab === 'overview' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600 dark:hover:text-white'
          }`}
        >
          <Building2 size={16} /> Tableau de Bord
        </button>
        <button
          onClick={() => setActiveTab('students')}
          className={`px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
            activeTab === 'students' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600 dark:hover:text-white'
          }`}
        >
          <Users size={16} /> Élèves & Inscriptions ({students.length})
        </button>
        <button
          onClick={() => setActiveTab('payments')}
          className={`px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
            activeTab === 'payments' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600 dark:hover:text-white'
          }`}
        >
          <Receipt size={16} /> Guichet Caisse & Reçus ({payments.length})
        </button>
        <button
          onClick={() => setActiveTab('reportcards')}
          className={`px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
            activeTab === 'reportcards' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600 dark:hover:text-white'
          }`}
        >
          <Award size={16} /> Bulletins de Notes ({reportCards.length})
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Élèves Inscrits</span>
                <div className="w-10 h-10 bg-purple-50 dark:bg-purple-500/10 text-purple-600 rounded-xl flex items-center justify-center">
                  <Users size={20} />
                </div>
              </div>
              <h3 className="text-3xl font-black text-slate-900 dark:text-white">{totalStudents}</h3>
              <p className="text-xs text-emerald-600 font-bold mt-2">100% Validés en Base</p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Taux de Recouvrement</span>
                <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 rounded-xl flex items-center justify-center">
                  <Percent size={20} />
                </div>
              </div>
              <h3 className="text-3xl font-black text-emerald-600">{recoveryRate}%</h3>
              <p className="text-xs text-slate-400 font-medium mt-2">{totalTuitionCollected} $ sur {totalTuitionExpected} $ prévus</p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Élèves Ordre de Minerval</span>
                <div className="w-10 h-10 bg-blue-50 dark:bg-blue-500/10 text-blue-600 rounded-xl flex items-center justify-center">
                  <CheckCircle2 size={20} />
                </div>
              </div>
              <h3 className="text-3xl font-black text-slate-900 dark:text-white">{paidCount} / {totalStudents}</h3>
              <p className="text-xs text-blue-600 font-bold mt-2">Accès examens autorisé</p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Classes Actives</span>
                <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 rounded-xl flex items-center justify-center">
                  <BookOpen size={20} />
                </div>
              </div>
              <h3 className="text-3xl font-black text-slate-900 dark:text-white">14 Classes</h3>
              <p className="text-xs text-slate-400 font-medium mt-2">Maternelle à Humanité</p>
            </div>
          </div>

          {/* Quick Payment Banner */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-[2.5rem] p-8 text-white flex flex-col md:flex-row justify-between items-center gap-6 shadow-xl">
            <div className="space-y-2 text-center md:text-left">
              <span className="px-3 py-1 bg-white/20 text-white text-[10px] font-black uppercase tracking-widest rounded-full">
                Guichet Mobile Money Intégré
              </span>
              <h3 className="text-2xl font-black uppercase tracking-tight">Encaissement Minerval Rapide</h3>
              <p className="text-white/80 text-xs font-medium max-w-lg">
                Proposez aux parents un paiement instantané via M-Pesa, Orange Money, Airtel Money ou Carte bancaire avec reçu imprimable immédiatement.
              </p>
            </div>
            <button
              onClick={() => {
                setPaymentTargetStudent(null);
                setShowPaymentModal(true);
              }}
              className="px-8 py-4 bg-white text-emerald-700 hover:bg-slate-100 font-black text-xs uppercase tracking-widest rounded-2xl shadow-2xl transition-all flex items-center gap-2 whitespace-nowrap"
            >
              <CreditCard size={18} /> Ouvrir le Guichet
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: STUDENTS */}
      {activeTab === 'students' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-100 dark:border-slate-800">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Rechercher élève, matricule ou parent..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <select
                value={selectedClassFilter}
                onChange={(e) => setSelectedClassFilter(e.target.value)}
                className="px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-900 dark:text-white"
              >
                <option value="ALL">Toutes les Classes</option>
                {DEFAULT_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>

              <select
                value={selectedTuitionFilter}
                onChange={(e) => setSelectedTuitionFilter(e.target.value)}
                className="px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-900 dark:text-white"
              >
                <option value="ALL">Tous les Statuts Minerval</option>
                <option value="PAYÉ">PAYÉ</option>
                <option value="PARTIEL">PARTIEL</option>
                <option value="ARRIÉRÉ">ARRIÉRÉ</option>
              </select>
            </div>
          </div>

          {/* Students Table */}
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <th className="p-5">Élève & Matricule</th>
                    <th className="p-5">Classe</th>
                    <th className="p-5">Parent & Contact</th>
                    <th className="p-5">Minerval Règlement</th>
                    <th className="p-5 text-center">Moyenne</th>
                    <th className="p-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200">
                  {filteredStudents.map((student) => (
                    <tr key={student.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="p-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-purple-100 dark:bg-purple-500/20 text-purple-600 flex items-center justify-center font-black">
                            {student.fullName.charAt(0)}
                          </div>
                          <div>
                            <p className="font-black text-slate-900 dark:text-white">{student.fullName}</p>
                            <span className="text-[10px] font-mono text-slate-400 uppercase">{student.matricule} • {student.gender}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-5">
                        <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-[10px] font-black uppercase">
                          {student.className}
                        </span>
                      </td>
                      <td className="p-5">
                        <p className="font-bold">{student.parentName}</p>
                        <p className="text-[10px] font-mono text-slate-400">{student.parentPhone}</p>
                      </td>
                      <td className="p-5">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px] font-black">
                            <span className={`px-2.5 py-0.5 rounded-full ${
                              student.tuitionStatus === 'PAYÉ' ? 'bg-emerald-100 text-emerald-700' :
                              student.tuitionStatus === 'PARTIEL' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {student.tuitionStatus}
                            </span>
                            <span className="font-mono">{student.tuitionPaid} $ / {student.tuitionTotal} $</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${student.tuitionStatus === 'PAYÉ' ? 'bg-emerald-500' : 'bg-amber-500'}`}
                              style={{ width: `${Math.min(100, (student.tuitionPaid / student.tuitionTotal) * 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="p-5 text-center">
                        <span className="px-3 py-1 bg-purple-50 dark:bg-purple-500/10 text-purple-600 font-black rounded-xl text-xs">
                          {student.generalAverage ? `${student.generalAverage}%` : 'N/A'}
                        </span>
                      </td>
                      <td className="p-5 text-right space-x-2">
                        <button
                          onClick={() => handleOpenPaymentForStudent(student)}
                          className="px-3 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-emerald-700"
                        >
                          Payer Minerval
                        </button>
                        <button
                          onClick={() => {
                            setSelectedStudentForReport(student);
                            setShowReportCardModal(true);
                          }}
                          className="px-3 py-2 bg-purple-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-purple-700"
                        >
                          Générer Bulletin
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredStudents.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-12 text-center text-slate-400 italic">
                        Aucun élève trouvé pour ces critères.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PAYMENTS / GUICHET */}
      {activeTab === 'payments' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-slate-100 dark:border-slate-800 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Historique de la Caisse Scolaire</h3>
                <p className="text-xs text-slate-400 font-medium">Tous les reçus de minerval et frais d'inscription encaissés.</p>
              </div>
              <button
                onClick={() => {
                  setPaymentTargetStudent(null);
                  setShowPaymentModal(true);
                }}
                className="px-6 py-3 bg-emerald-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-emerald-700 flex items-center gap-2"
              >
                <Plus size={16} /> Nouveau Paiement Caisse
              </button>
            </div>

            <div className="space-y-4">
              {payments.map((payment) => (
                <div key={payment.id || payment.referenceCode} className="p-5 bg-slate-50 dark:bg-slate-800 rounded-3xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border border-slate-100 dark:border-slate-700">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 rounded-2xl flex items-center justify-center font-black">
                      <Receipt size={24} />
                    </div>
                    <div>
                      <h4 className="font-black text-sm uppercase text-slate-900 dark:text-white">{payment.payerName}</h4>
                      <p className="text-xs text-slate-400 font-medium">{payment.reason} • Mode: <strong className="text-emerald-600">{payment.method}</strong></p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <span className="text-lg font-black text-emerald-600 block">{payment.amount} {payment.currency}</span>
                      <span className="text-[10px] font-mono text-slate-400 uppercase">Réf: {payment.referenceCode}</span>
                    </div>
                    <button
                      onClick={() => window.print()}
                      className="p-3 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 rounded-2xl hover:bg-slate-200 transition-all border border-slate-200 dark:border-slate-700"
                    >
                      <Printer size={18} />
                    </button>
                  </div>
                </div>
              ))}
              {payments.length === 0 && (
                <div className="p-12 text-center text-slate-400 italic">
                  Aucun paiement enregistré pour l'instant.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: REPORT CARDS */}
      {activeTab === 'reportcards' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reportCards.map((rc) => (
              <div key={rc.id} className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="px-3 py-1 bg-purple-100 dark:bg-purple-500/20 text-purple-600 text-[10px] font-black uppercase tracking-widest rounded-full">
                      {rc.term}
                    </span>
                    <h4 className="text-lg font-black uppercase text-slate-900 dark:text-white mt-2">{rc.studentName}</h4>
                    <p className="text-xs text-slate-400 font-bold">{rc.className}</p>
                  </div>
                  <span className="text-2xl font-black text-purple-600">{rc.percentage}%</span>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl space-y-2">
                  <span className="text-[10px] font-black uppercase text-slate-400 block">Notes Principales</span>
                  <div className="divide-y divide-slate-200 dark:divide-slate-700 text-xs font-bold">
                    {rc.marks.slice(0, 4).map((m, idx) => (
                      <div key={idx} className="py-1.5 flex justify-between">
                        <span className="text-slate-600 dark:text-slate-300">{m.subject}</span>
                        <span className="font-mono text-purple-600">{m.score} / {m.maxScore}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <p className="text-xs text-slate-500 italic">"{rc.teacherComment}"</p>

                <button
                  onClick={() => window.print()}
                  className="w-full py-3 bg-purple-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-purple-700 flex items-center justify-center gap-2"
                >
                  <Printer size={16} /> Imprimer Bulletin PDF
                </button>
              </div>
            ))}
            {reportCards.length === 0 && (
              <div className="col-span-full p-12 text-center text-slate-400 italic bg-white dark:bg-slate-900 rounded-[2.5rem]">
                Aucun bulletin généré. Allez dans la liste des élèves et cliquez sur "Générer Bulletin".
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: ADD STUDENT */}
      <AnimatePresence>
        {showAddStudentModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl space-y-6"
            >
              <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Inscription d'un Élève</h3>
                <button onClick={() => setShowAddStudentModal(false)} className="text-slate-400 hover:text-slate-600">
                  <XCircle size={24} />
                </button>
              </div>

              <form onSubmit={handleCreateStudent} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Nom Complet de l'Élève</label>
                  <input
                    type="text"
                    required
                    value={newStudent.fullName}
                    onChange={(e) => setNewStudent({ ...newStudent, fullName: e.target.value })}
                    placeholder="Ex: Jean-Baptiste LUSAMBA"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Genre</label>
                    <select
                      value={newStudent.gender}
                      onChange={(e) => setNewStudent({ ...newStudent, gender: e.target.value as any })}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-900 dark:text-white"
                    >
                      <option value="M">Masculin (M)</option>
                      <option value="F">Féminin (F)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Classe d'Affectation</label>
                    <select
                      value={newStudent.className}
                      onChange={(e) => setNewStudent({ ...newStudent, className: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-900 dark:text-white"
                    >
                      {DEFAULT_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Nom du Parent/Tuteur</label>
                    <input
                      type="text"
                      required
                      value={newStudent.parentName}
                      onChange={(e) => setNewStudent({ ...newStudent, parentName: e.target.value })}
                      placeholder="M. Lusamba"
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Téléphone Parent</label>
                    <input
                      type="text"
                      required
                      value={newStudent.parentPhone}
                      onChange={(e) => setNewStudent({ ...newStudent, parentPhone: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-mono font-bold text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Frais Annuel Total ($)</label>
                    <input
                      type="number"
                      required
                      value={newStudent.tuitionTotal}
                      onChange={(e) => setNewStudent({ ...newStudent, tuitionTotal: Number(e.target.value) })}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Acompte Initial ($)</label>
                    <input
                      type="number"
                      required
                      value={newStudent.tuitionPaid}
                      onChange={(e) => setNewStudent({ ...newStudent, tuitionPaid: Number(e.target.value) })}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-4 bg-emerald-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg hover:bg-emerald-700"
                >
                  Valider l'Inscription
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: REPORT CARD CREATOR */}
      <AnimatePresence>
        {showReportCardModal && selectedStudentForReport && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl space-y-6 my-8"
            >
              <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Édition du Bulletin scolaire</h3>
                  <p className="text-xs text-purple-600 font-bold">{selectedStudentForReport.fullName} • {selectedStudentForReport.className}</p>
                </div>
                <button onClick={() => setShowReportCardModal(false)} className="text-slate-400 hover:text-slate-600">
                  <XCircle size={24} />
                </button>
              </div>

              <form onSubmit={handleCreateReportCard} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Période / Trimestre</label>
                  <select
                    value={reportTerm}
                    onChange={(e) => setReportTerm(e.target.value as any)}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-900 dark:text-white"
                  >
                    <option value="1er Trimestre">1er Trimestre</option>
                    <option value="2ème Trimestre">2ème Trimestre</option>
                    <option value="3ème Trimestre">3ème Trimestre</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Notes par Matière (sur 20)</label>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                    {reportMarks.map((m, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{m.subject}</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            max={20}
                            min={0}
                            value={m.score}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setReportMarks(prev => prev.map((item, i) => i === idx ? { ...item, score: val } : item));
                            }}
                            className="w-16 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-center text-xs font-black text-purple-600"
                          />
                          <span className="text-xs font-bold text-slate-400">/ 20</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Appréciation de l'Enseignant</label>
                  <textarea
                    rows={3}
                    value={teacherComment}
                    onChange={(e) => setTeacherComment(e.target.value)}
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-4 bg-purple-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg hover:bg-purple-700"
                >
                  Enregistrer & Générer Bulletin
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* UNIVERSAL PAYMENT GATEWAY MODAL */}
      <PaymentGatewayModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        title={paymentTargetStudent ? `Paiement Minerval - ${paymentTargetStudent.fullName}` : "Guichet Caisse Scolaire"}
        defaultAmount={paymentTargetStudent ? (paymentTargetStudent.tuitionTotal - paymentTargetStudent.tuitionPaid) || 50 : 50}
        clientName={paymentTargetStudent ? paymentTargetStudent.parentName : ''}
        referenceReason={paymentTargetStudent ? `Minerval (${paymentTargetStudent.className})` : 'Minerval / Frais Scolaires'}
        category="school"
        studentId={paymentTargetStudent?.id}
        studentName={paymentTargetStudent?.fullName}
        className={paymentTargetStudent?.className}
        onSuccess={handlePaymentSuccess}
      />
    </div>
  );
}
