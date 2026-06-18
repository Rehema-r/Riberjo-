import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, getDocs, limit, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { AppDocument } from '../types';
import { FileText, Plus, Download, Trash2, Search, Filter, Archive, CheckCircle, Clock, Shield, Lock, Eye, Share2, PenTool } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import SignatureModal from '../components/SignatureModal';
import { logActivity } from '../services/loggingService';

export default function DocumentsPage() {
  const { profile } = useAuth();
  const [documents, setDocuments] = useState<AppDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'contract' | 'report' | 'policy'>('all');

  useEffect(() => {
    if (!profile) return;

    const q = profile.role === 'SUPER_ADMIN' || profile.role === 'ADMIN'
      ? query(collection(db, 'documents'), orderBy('createdAt', 'desc'))
      : query(collection(db, 'documents'), where('userId', '==', profile.matricule), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AppDocument));
      setDocuments(docs);
      setIsLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'documents');
    });

    return () => unsubscribe();
  }, [profile]);

  const handleSign = (docId: string) => {
    setSelectedDocId(docId);
    setIsSignatureModalOpen(true);
  };

  const onSaveSignature = async (signatureDataUrl: string) => {
    if (!selectedDocId || !profile) return;
    try {
      await updateDoc(doc(db, 'documents', selectedDocId), {
        signed: true,
        status: 'active',
        signatureUrl: signatureDataUrl,
        signedAt: Date.now()
      });
      
      await logActivity({
        type: 'document_signed',
        userId: profile.matricule,
        userName: profile.fullName,
        details: `A signé numériquement le document #${selectedDocId}`,
        targetId: selectedDocId,
        departmentId: profile.departmentId
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'documents');
    }
  };

  const filteredDocs = documents.filter(d => 
    (d.title?.toLowerCase().includes(searchTerm.toLowerCase()) || d.type?.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (activeCategory === 'all' || d.category === activeCategory)
  );

  const categories = [
    { id: 'all', label: 'Tous', icon: FileText },
    { id: 'contract', label: 'Contrats', icon: Shield },
    { id: 'report', label: 'Rapports', icon: Clock },
    { id: 'policy', label: 'Règlements', icon: Lock },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Documents</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Gestion et archivage des documents officiels.</p>
        </div>
        <button 
          onClick={() => setIsUploadModalOpen(true)}
          className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-xl shadow-emerald-900/20 transition-all flex items-center justify-center gap-2 group"
        >
          <Plus size={18} className="group-hover:rotate-90 transition-transform" />
          Ajouter un Document
        </button>
      </div>

      {/* Categories */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id as any)}
            className={`px-6 py-3 rounded-2xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all ${
              activeCategory === cat.id 
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' 
                : 'bg-white dark:bg-slate-900 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <cat.icon size={16} />
            {cat.label}
          </button>
        ))}
      </div>

      {/* Search Bar */}
      <div className="relative max-w-xl">
        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <input 
          type="text"
          placeholder="Rechercher un document par nom ou type..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-16 pr-6 py-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2.5rem] text-sm font-medium focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all shadow-sm"
        />
      </div>

      {/* Documents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 text-slate-900 dark:text-white uppercase tracking-tight">
        <AnimatePresence>
          {filteredDocs.map((doc, idx) => (
            <motion.div
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ delay: idx * 0.05 }}
              key={doc.id}
              className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none group"
            >
              <div className="flex justify-between items-start mb-6">
                <div className={`p-4 rounded-2xl ${
                  doc.category === 'contract' ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/10' :
                  doc.category === 'report' ? 'bg-purple-50 text-purple-600 dark:bg-purple-500/10' :
                  'bg-orange-50 text-orange-600 dark:bg-orange-500/10'
                }`}>
                  <FileText size={24} />
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-slate-400"><Share2 size={16} /></button>
                  <button className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-red-400"><Trash2 size={16} /></button>
                </div>
              </div>

              <h3 className="text-sm font-black mb-1 line-clamp-1">{doc.title}</h3>
              <p className="text-[10px] text-slate-400 font-bold mb-4">{doc.type} • Documents Officiels</p>

              <div className="flex items-center gap-2 mb-6">
                <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest ${
                  doc.signed ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-500'
                }`}>
                  {doc.signed ? 'Signé' : 'Brouillon'}
                </span>
                <span className="text-[8px] text-slate-300 font-bold">{new Date(doc.createdAt).toLocaleDateString('fr-FR')}</span>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <button className="flex-1 py-3 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-slate-600 dark:text-slate-300 font-black text-[10px] uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2">
                    <Eye size={14} /> Aperçu
                  </button>
                  <a 
                    href={doc.fileUrl} 
                    download
                    className="p-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-all shadow-lg active:scale-95"
                  >
                    <Download size={14} />
                  </a>
                </div>
                {doc.category === 'contract' && !doc.signed && (
                  <button 
                    onClick={() => handleSign(doc.id)}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-900/10"
                  >
                    <PenTool size={14} /> Signer Numériquement
                  </button>
                )}
                {doc.signed && doc.signatureUrl && (
                  <div className="mt-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2 text-center">Signature Validée</p>
                    <img src={doc.signatureUrl || null} alt="Signature" className="h-10 mx-auto opacity-80" />
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {filteredDocs.length === 0 && (
          <div className="col-span-full py-20 text-center flex flex-col items-center gap-4">
             <FileText size={48} className="text-slate-100 dark:text-slate-800" />
             <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Aucun document trouvé</p>
          </div>
        )}
      </div>

      <SignatureModal 
        isOpen={isSignatureModalOpen}
        onClose={() => setIsSignatureModalOpen(false)}
        onSave={onSaveSignature}
      />

      {/* Upload Modal Skeleton */}
      <AnimatePresence>
        {isUploadModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setIsUploadModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl"
            >
              <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-6">Ajouter un document</h2>
              <div className="border-4 border-dashed border-slate-50 dark:border-slate-800 rounded-[2rem] p-12 flex flex-col items-center gap-4 text-center">
                 <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 rounded-3xl flex items-center justify-center mb-2">
                   <Plus size={32} />
                 </div>
                 <p className="text-sm font-bold text-slate-600 dark:text-slate-400">Glissez-déposez vos fichiers ici</p>
                 <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">PDF, DOCX, JPG (Max 5MB)</p>
                 <button className="mt-4 px-8 py-3 bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-slate-800 transition-all">
                    Parcourir les fichiers
                 </button>
              </div>
              <div className="flex gap-4 mt-8">
                 <button onClick={() => setIsUploadModalOpen(false)} className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold rounded-2xl hover:bg-slate-200 transition-all text-xs uppercase tracking-widest">Annuler</button>
                 <button className="flex-1 py-4 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-500 shadow-xl shadow-emerald-900/10 transition-all text-xs uppercase tracking-widest">Enregistrer</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

