import React, { useState, useEffect, useRef } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, onSnapshot, orderBy, addDoc, serverTimestamp, doc, getDocs, where, updateDoc, setDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Chat as ChatType, Message, UserProfile, Department } from '../types';
import { Send, Hash, User as UserIcon, MoreVertical, Plus, Search, Paperclip, Smile, X, Image as ImageIcon, FileText, Download, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Chat() {
  const { profile } = useAuth();
  const [chats, setChats] = useState<ChatType[]>([]);
  const [activeChat, setActiveChat] = useState<ChatType | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!profile) return;

    // Fetch all users for private chats
    const usersPath = 'users';
    getDocs(collection(db, usersPath)).then(snap => {
       setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as UserProfile)));
    }).catch(err => {
      handleFirestoreError(err, OperationType.LIST, usersPath);
    });

    // Subscribe to group chats (departments)
    const chatsPath = 'chats';
    const q = query(collection(db, chatsPath), orderBy('updatedAt', 'desc'));
    const unsubscribe = onSnapshot(
      q, 
      (snap) => {
        const chatList = snap.docs.map(d => ({ id: d.id, ...d.data() } as ChatType));
        setChats(chatList);
        if (!activeChat && chatList.length > 0) {
          // Find my department chat if exists
          const myDeptChat = chatList.find(c => c.departmentId === profile.departmentId);
          setActiveChat(myDeptChat || chatList[0]);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, chatsPath);
      }
    );

    return () => unsubscribe();
  }, [profile]);

  useEffect(() => {
    if (!activeChat) return;

    const messagesPath = `chats/${activeChat.id}/messages`;
    const q = query(
      collection(db, 'chats', activeChat.id, 'messages'),
      orderBy('createdAt', 'asc')
    );
    const unsubscribe = onSnapshot(
      q, 
      (snap) => {
        setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as Message)));
        scrollToBottom();
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, messagesPath);
      }
    );

    return () => unsubscribe();
  }, [activeChat]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !selectedFile) || !activeChat || !profile) return;

    const msgText = newMessage.trim();
    const fileToUpload = selectedFile;
    
    setNewMessage('');
    removeFile();

    try {
      let fileUrl = '';
      let messageType: 'text' | 'file' = 'text';

      if (fileToUpload) {
        setIsUploading(true);
        messageType = 'file';
        // Simulation d'upload en base64 pour la démo
        // Note: En production, utilisez Firebase Storage
        const reader = new FileReader();
        fileUrl = await new Promise((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(fileToUpload);
        });
      }

      await addDoc(collection(db, 'chats', activeChat.id, 'messages'), {
        senderId: profile.id,
        senderName: profile.fullName,
        text: msgText,
        type: messageType,
        fileUrl: fileUrl,
        fileName: fileToUpload?.name || '',
        fileSize: fileToUpload?.size || 0,
        createdAt: Date.now()
      });

      // Update last message in chat
      await updateDoc(doc(db, 'chats', activeChat.id), {
        lastMessage: messageType === 'file' ? `📁 Fichier: ${fileToUpload?.name}` : msgText,
        updatedAt: Date.now()
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="h-full flex gap-6 max-w-7xl mx-auto pb-6 transition-colors duration-300">
      {/* Sidebar Channels */}
      <div className="w-80 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col shrink-0 overflow-hidden">
        <div className="p-6 border-b border-slate-50 dark:border-slate-800 shrink-0">
           <h2 className="text-xl font-black text-slate-900 dark:text-white mb-6 uppercase tracking-tight">Messages</h2>
           <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input type="text" placeholder="Rechercher..." className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500/20" />
           </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-hide">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2 mb-2">Canaux Groupes</p>
           {chats.filter(c => c.type === 'group').map(chat => (
             <button
               key={chat.id}
               onClick={() => setActiveChat(chat)}
               className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all group ${
                 activeChat?.id === chat.id 
                   ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 shadow-sm shadow-emerald-100 dark:shadow-none' 
                   : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
               }`}
             >
               <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                 activeChat?.id === chat.id ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 group-hover:bg-slate-200 dark:group-hover:bg-slate-700 group-hover:text-slate-600 dark:group-hover:text-slate-300'
               }`}>
                 <Hash size={18} />
               </div>
               <div className="text-left overflow-hidden">
                 <p className="text-sm font-bold truncate tracking-tight">{chat.name?.toUpperCase()}</p>
                 <p className="text-[10px] opacity-70 truncate font-medium">@{chat.departmentId}</p>
               </div>
             </button>
           ))}

           <div className="mt-8">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2 mb-2">Membres Directs</p>
             {users.filter(u => u.id !== profile?.id).map(user => (
               <button
                 key={user.id}
                 className={`w-full flex items-center gap-3 p-3 rounded-2xl text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all group`}
               >
                 <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-slate-200 dark:group-hover:bg-slate-700 group-hover:text-slate-600 dark:group-hover:text-slate-300 shrink-0">
                   <UserIcon size={18} />
                 </div>
                 <div className="text-left overflow-hidden">
                   <p className="text-sm font-bold truncate tracking-tight text-slate-900 dark:text-slate-100">{user.fullName}</p>
                   <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                      <p className="text-[10px] text-slate-400">En ligne</p>
                   </div>
                 </div>
               </button>
             ))}
           </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col overflow-hidden">
        {activeChat ? (
          <>
            {/* Header */}
            <div className="h-20 px-8 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/20 dark:bg-slate-800/20 backdrop-blur-md">
               <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-100 dark:shadow-none">
                     {activeChat.type === 'group' ? <Hash size={20} /> : <UserIcon size={20} />}
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-tight">{activeChat.name}</h3>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold tracking-widest italic uppercase">
                      {activeChat.type === 'group' ? "Canal de discussion d'entreprise" : "Discussion Privée"}
                    </p>
                  </div>
               </div>
               <button className="p-2 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors">
                  <MoreVertical size={20} />
               </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-8 space-y-6 scrollbar-hide">
              {messages.map((msg) => {
                const isMe = msg.senderId === profile?.id;
                return (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={msg.id} 
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    {!isMe && activeChat.type === 'group' && <span className="text-[10px] font-black text-slate-400 mb-1 ml-4 uppercase tracking-widest">{msg.senderName}</span>}
                    <div className={`max-w-[70%] p-4 rounded-3xl ${
                      isMe 
                        ? 'bg-emerald-600 text-white rounded-tr-none shadow-xl shadow-emerald-100 dark:shadow-black/20' 
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none'
                    }`}>
                      {msg.type === 'file' && msg.fileUrl && (
                        <div className="mb-3 overflow-hidden rounded-2xl bg-black/5 dark:bg-white/5 border border-white/10">
                          {msg.fileUrl.startsWith('data:image/') || msg.fileName?.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                            <img 
                              src={msg.fileUrl} 
                              alt="Joint" 
                              className="w-full h-auto max-h-64 object-cover cursor-pointer hover:opacity-90 transition-opacity" 
                              onClick={() => window.open(msg.fileUrl)}
                            />
                          ) : (
                            <div className="p-4 flex items-center gap-3">
                              <div className="p-2 bg-white/20 rounded-xl">
                                <FileText size={24} />
                              </div>
                              <div className="flex-1 overflow-hidden">
                                <p className="text-xs font-bold truncate">{msg.fileName}</p>
                                <p className="text-[10px] opacity-60">{(msg.fileSize || 0) / 1024 < 1024 ? `${((msg.fileSize || 0) / 1024).toFixed(1)} KB` : `${((msg.fileSize || 0) / 1024 / 1024).toFixed(1)} MB`}</p>
                              </div>
                              <a href={msg.fileUrl} download={msg.fileName} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                                <Download size={18} />
                              </a>
                            </div>
                          )}
                        </div>
                      )}
                      {msg.text && <p className="text-sm font-medium leading-relaxed">{msg.text}</p>}
                      <p className={`text-[9px] mt-2 opacity-50 font-bold ${isMe ? 'text-right' : ''}`}>
                         {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-6 border-t border-slate-50 dark:border-slate-800 bg-slate-50/10 dark:bg-slate-800/10">
               <AnimatePresence>
                 {selectedFile && (
                   <motion.div 
                     initial={{ opacity: 0, y: 10 }}
                     animate={{ opacity: 1, y: 0 }}
                     exit={{ opacity: 0, y: 10 }}
                     className="mb-4 p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-3xl flex items-center gap-4 shadow-sm"
                   >
                     {previewUrl ? (
                        <div className="w-16 h-16 rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800 shadow-inner">
                          <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                        </div>
                     ) : (
                        <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400">
                          <FileText size={32} />
                        </div>
                     )}
                     <div className="flex-1 overflow-hidden">
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{selectedFile.name}</p>
                        <p className="text-[10px] text-slate-400 font-medium tracking-widest uppercase">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                     </div>
                     <button 
                       onClick={removeFile}
                       className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all"
                     >
                       <X size={20} />
                     </button>
                   </motion.div>
                 )}
               </AnimatePresence>

               <form onSubmit={handleSendMessage} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 p-2 pl-6 rounded-3xl flex items-center gap-4 shadow-sm focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all">
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    className="hidden"
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                  />
                  <button 
                    type="button" 
                    onClick={() => fileInputRef.current?.click()}
                    className="text-slate-400 hover:text-emerald-600 transition-colors"
                  >
                    <Paperclip size={20} />
                  </button>
                  <input 
                    type="text" 
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder={selectedFile ? "Ajoutez une légende..." : "Écrivez votre message..."} 
                    className="flex-1 border-none bg-transparent focus:ring-0 text-sm py-3 font-medium text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600"
                  />
                   <button type="button" className="text-slate-400 hover:text-emerald-600">
                    <Smile size={20} />
                  </button>
                  <button 
                    disabled={(!newMessage.trim() && !selectedFile) || isUploading}
                    type="submit" 
                    className="w-12 h-12 bg-emerald-600 text-white rounded-[1.25rem] flex items-center justify-center hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 dark:shadow-none disabled:opacity-50 disabled:shadow-none"
                  >
                    {isUploading ? <RefreshCw size={20} className="animate-spin" /> : <Send size={20} />}
                  </button>
               </form>
            </div>
          </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 gap-4 opacity-50">
               <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center border border-slate-100 dark:border-slate-700 mb-4 scale-125">
                 <MessageSquare size={40} strokeWidth={1.5} />
               </div>
               <p className="text-sm font-black uppercase tracking-[0.2em]">Sélectionnez une discussion...</p>
               <p className="text-xs font-medium max-w-xs text-center leading-relaxed">Accédez à un canal de département ou démarrez une discussion directe avec un membre.</p>
            </div>
          )}
      </div>
    </div>
  );
}

function MessageSquare(props: any) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
}
