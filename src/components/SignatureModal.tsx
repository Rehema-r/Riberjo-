import React, { useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { X, Trash2, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (signatureDataUrl: string) => void;
  title?: string;
}

export default function SignatureModal({ isOpen, onClose, onSave, title = "Signature Numérique" }: SignatureModalProps) {
  const sigCanvas = useRef<SignatureCanvas>(null);

  const clear = () => {
    sigCanvas.current?.clear();
  };

  const save = () => {
    if (sigCanvas.current?.isEmpty()) {
      alert("Veuillez signer avant d'enregistrer.");
      return;
    }
    const dataUrl = sigCanvas.current?.getTrimmedCanvas().toDataURL('image/png');
    if (dataUrl) {
      onSave(dataUrl);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl overflow-hidden"
          >
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{title}</h2>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Authentification Garantie</p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400">
                <X size={20} />
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800 rounded-3xl border-4 border-dashed border-slate-100 dark:border-slate-700 overflow-hidden mb-6 h-64 relative">
              <SignatureCanvas 
                ref={sigCanvas}
                penColor="black"
                canvasProps={{
                  className: "signature-canvas w-full h-full",
                  style: { width: '100%', height: '100%' }
                }}
              />
              <div className="absolute bottom-4 right-4 pointer-events-none opacity-10">
                 <CheckCircle size={100} className="text-emerald-500" />
              </div>
            </div>

            <div className="flex gap-4">
              <button 
                onClick={clear}
                className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 font-black rounded-2xl hover:bg-slate-200 transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-2"
              >
                <Trash2 size={16} /> Effacer
              </button>
              <button 
                onClick={save}
                className="flex-[2] py-4 bg-emerald-600 text-white font-black rounded-2xl hover:bg-emerald-500 shadow-xl shadow-emerald-900/10 transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-2"
              >
                <CheckCircle size={16} /> Valider la Signature
              </button>
            </div>
            
            <p className="mt-6 text-[10px] text-center font-bold text-slate-400 uppercase tracking-[0.2em] px-8">
              En signant ce document, vous reconnaissez l'authenticité et l'intégrité des informations fournies.
            </p>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
