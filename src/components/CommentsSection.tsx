import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, limit } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Comment } from '../types';
import { Send, User as UserIcon, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CommentsSectionProps {
  parentId: string;
  parentType: 'reports' | 'tasks';
}

export default function CommentsSection({ parentId, parentType }: CommentsSectionProps) {
  const { profile } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, parentType, parentId, 'comments'),
      orderBy('createdAt', 'asc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      setComments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment)));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [parentId, parentType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !profile) return;

    try {
      await addDoc(collection(db, parentType, parentId, 'comments'), {
        authorId: profile.id,
        authorName: profile.fullName,
        text: newComment.trim(),
        createdAt: Date.now()
      });
      setNewComment('');
    } catch (err) {
      console.error('Failed to add comment:', err);
    }
  };

  return (
    <div className="mt-8 border-t border-slate-100 dark:border-slate-800 pt-8">
      <div className="flex items-center gap-2 mb-6">
        <MessageSquare size={18} className="text-brand" />
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Fil de Discussion</h3>
      </div>

      <div className="space-y-4 mb-6 max-h-[400px] overflow-y-auto scrollbar-hide pr-2">
        <AnimatePresence initial={false}>
          {comments.map((comment) => (
            <motion.div
              key={comment.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className={`flex gap-3 ${comment.authorId === profile?.id ? 'flex-row-reverse' : ''}`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                comment.authorId === profile?.id ? 'bg-brand text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
              }`}>
                <UserIcon size={14} />
              </div>
              <div className={`max-w-[80%] ${comment.authorId === profile?.id ? 'text-right' : ''}`}>
                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-tighter mb-1">
                  {comment.authorName} • {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
                <div className={`p-3 rounded-2xl text-xs font-medium inline-block ${
                  comment.authorId === profile?.id 
                    ? 'bg-brand text-white rounded-tr-none' 
                    : 'bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200 rounded-tl-none border border-slate-100 dark:border-slate-800'
                }`}>
                  {comment.text}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {!loading && comments.length === 0 && (
          <p className="text-center text-[10px] font-bold text-slate-300 dark:text-slate-600 uppercase tracking-widest py-4">Aucun commentaire pour le moment</p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="relative">
        <input
          type="text"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Ajouter une observation ou un commentaire..."
          className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-xs font-bold focus:ring-2 focus:ring-brand/20 outline-none text-slate-900 dark:text-white"
        />
        <button
          type="submit"
          className="absolute right-2 top-2 bottom-2 px-4 bg-brand text-white rounded-xl hover:brightness-110 active:scale-95 transition-all"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
