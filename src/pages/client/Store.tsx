import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../lib/firebase';
import { collection, query, where, onSnapshot, addDoc, getDocs } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShoppingCart, 
  Search, 
  Filter, 
  Package, 
  Check, 
  Plus, 
  Minus, 
  Trash2, 
  Sparkles, 
  ArrowRight, 
  Clock, 
  Tag, 
  ShoppingBag, 
  X, 
  AlertCircle,
  PlusCircle,
  ShieldCheck
} from 'lucide-react';
import { notificationService } from '../../services/notificationService';

interface StoreItem {
  id: string;
  name: string;
  description?: string;
  type?: string;
  category?: string;
  sellingPrice?: number;
  price?: number;
  quantity?: number;
  unit?: string;
  commercialPitch?: string;
  status?: string;
  workflowStatus?: string;
}

interface CartItem {
  product: StoreItem;
  quantity: number;
}

export default function ClientStore() {
  const { profile } = useAuth();
  const [items, setItems] = useState<StoreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  // Shopping Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isOrdering, setIsOrdering] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);

  // Direct Add Modal (for Admin/DG/Marketing)
  const [showDirectAddModal, setShowDirectAddModal] = useState(false);
  const [directForm, setDirectForm] = useState({
    name: '',
    category: 'Agricole',
    sellingPrice: 10,
    quantity: 100,
    unit: 'Kg',
    description: '',
    commercialPitch: ''
  });

  // Load published items from 'assets' and 'inventory'
  useEffect(() => {
    // 1. Subscribe to published assets
    const qAssets = query(collection(db, 'assets'));
    const unsubscribeAssets = onSnapshot(qAssets, (snapshot) => {
      const assetItems: StoreItem[] = [];
      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        const isPublished = data.status === 'in_stock' || data.workflowStatus === 'published' || data.sellingPrice > 0;
        if (isPublished && data.name) {
          assetItems.push({
            id: docSnap.id,
            name: data.name,
            description: data.description,
            category: data.type || data.category || 'Général',
            sellingPrice: data.sellingPrice || data.price || 0,
            quantity: data.quantity || 10,
            unit: data.unit || 'Unité',
            commercialPitch: data.commercialPitch,
            status: data.status,
            workflowStatus: data.workflowStatus
          });
        }
      });
      setItems(assetItems);
      setLoading(false);
    }, (err) => {
      console.warn("ClientStore onSnapshot assets error:", err.message);
      setLoading(false);
    });

    return () => unsubscribeAssets();
  }, []);

  // Filtered Items
  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          (item.category && item.category.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = Array.from(new Set(items.map(i => i.category || 'Général'))).filter(Boolean);

  // Cart operations
  const addToCart = (product: StoreItem) => {
    setCart(prev => {
      const existing = prev.find(ci => ci.product.id === product.id);
      if (existing) {
        return prev.map(ci => ci.product.id === product.id ? { ...ci, quantity: ci.quantity + 1 } : ci);
      }
      return [...prev, { product, quantity: 1 }];
    });
    setIsCartOpen(true);
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const newQty = item.quantity + delta;
        return newQty > 0 ? { ...item, quantity: newQty } : item;
      }
      return item;
    }));
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(ci => ci.product.id !== productId));
  };

  const cartTotal = cart.reduce((sum, item) => sum + ((item.product.sellingPrice || 0) * item.quantity), 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Submit Order
  const handleCheckout = async () => {
    if (!profile || cart.length === 0) return;
    setIsOrdering(true);

    try {
      const orderId = `CMD-${Date.now()}`;
      const orderItems = cart.map(ci => ({
        id: ci.product.id,
        name: ci.product.name,
        quantity: ci.quantity,
        unitPrice: ci.product.sellingPrice || 0,
        totalPrice: (ci.product.sellingPrice || 0) * ci.quantity
      }));

      const orderData = {
        id: orderId,
        clientId: profile.id,
        clientName: profile.fullName,
        items: orderItems,
        totalAmount: cartTotal,
        status: 'pending',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await addDoc(collection(db, 'client_orders'), orderData);

      // Notify Marketing, Finances & DG
      await notificationService.notifyNewOrder(orderId, profile.fullName, cartTotal);

      setCart([]);
      setIsOrdering(false);
      setOrderSuccess(true);
      setTimeout(() => setOrderSuccess(false), 5000);
    } catch (err) {
      console.error("Error creating order:", err);
      alert("Erreur lors de la validation de votre commande.");
      setIsOrdering(false);
    }
  };

  // Direct Add handler for Admin/DG/Marketing
  const handleDirectAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    try {
      await addDoc(collection(db, 'assets'), {
        name: directForm.name,
        description: directForm.description,
        departmentId: '04', // Marketing
        quantity: directForm.quantity,
        unit: directForm.unit,
        type: directForm.category,
        sellingPrice: directForm.sellingPrice,
        commercialPitch: directForm.commercialPitch,
        status: 'in_stock',
        workflowStatus: 'published',
        publishedBy: profile.fullName,
        publishedAt: Date.now(),
        lastRefill: Date.now()
      });

      alert(`Article "${directForm.name}" publié directement en Boutique !`);
      setShowDirectAddModal(false);
      setDirectForm({
        name: '',
        category: 'Agricole',
        sellingPrice: 10,
        quantity: 100,
        unit: 'Kg',
        description: '',
        commercialPitch: ''
      });
    } catch (err) {
      console.error("Error direct adding:", err);
      alert("Erreur lors de l'ajout en boutique.");
    }
  };

  const isAdminOrMarketing = profile?.role === 'SUPER_ADMIN' || profile?.role === 'BOARD_MEMBER' || profile?.role === 'ADMIN' || profile?.departmentId === '04';

  return (
    <div className="space-y-8 pb-20">
      {/* Header Banner */}
      <div className="p-8 md:p-12 bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-900 text-white rounded-[3rem] shadow-2xl relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="flex items-center gap-2">
            <span className="bg-emerald-500/20 text-emerald-300 font-black text-[9px] uppercase tracking-widest px-3 py-1 rounded-full border border-emerald-500/30">
              Boutique Officielle RIBERJO
            </span>
            {isAdminOrMarketing && (
              <span className="bg-purple-500/20 text-purple-300 font-black text-[9px] uppercase tracking-widest px-3 py-1 rounded-full border border-purple-500/30">
                Mode Gestionnaire
              </span>
            )}
          </div>
          <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tight">
            Produits & Intrants Validés
          </h1>
          <p className="text-emerald-100 text-xs md:text-sm font-medium leading-relaxed">
            Commandez vos semences, engrais, équipements et intrants certifiés. Tous les articles sont étudiés par notre service Marketing et validés par la Direction Générale.
          </p>
        </div>

        <div className="relative z-10 flex gap-3">
          {isAdminOrMarketing && (
            <button
              onClick={() => setShowDirectAddModal(true)}
              className="px-6 py-4 bg-purple-600 hover:bg-purple-700 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg transition-all flex items-center gap-2 border-none cursor-pointer"
            >
              <PlusCircle size={18} /> Publier un Article
            </button>
          )}

          <button
            onClick={() => setIsCartOpen(true)}
            className="px-6 py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl transition-all flex items-center gap-3 border-none cursor-pointer relative"
          >
            <ShoppingCart size={20} />
            <span>Mon Panier</span>
            {cartCount > 0 && (
              <span className="bg-white text-emerald-800 font-black text-[10px] w-6 h-6 rounded-full flex items-center justify-center shadow">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Order Success Banner */}
      <AnimatePresence>
        {orderSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="p-6 bg-emerald-500 text-white rounded-3xl shadow-xl flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-white">
                <Check size={28} />
              </div>
              <div>
                <h3 className="font-black text-lg uppercase tracking-tight">Commande transmise avec succès !</h3>
                <p className="text-xs text-emerald-100 font-medium">
                  Votre commande a été enregistrée. Notre service commercial et la Direction ont été notifiés pour le traitement.
                </p>
              </div>
            </div>
            <button onClick={() => setOrderSuccess(false)} className="text-white hover:opacity-80 border-none bg-transparent cursor-pointer">
              <X size={20} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search & Categories Toolbar */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
        {/* Search Input */}
        <div className="relative w-full md:w-96">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher un produit, semence, matériel..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto no-scrollbar py-1">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shrink-0 transition-all cursor-pointer border-none ${
              selectedCategory === 'all'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100'
            }`}
          >
            Tous les articles ({items.length})
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shrink-0 transition-all cursor-pointer border-none ${
                selectedCategory === cat
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Product Grid */}
      {loading ? (
        <div className="py-20 text-center text-slate-400">
          <Package size={48} className="mx-auto mb-3 animate-bounce text-emerald-500" />
          <p className="text-xs font-black uppercase tracking-widest">Chargement de la boutique...</p>
        </div>
      ) : filteredItems.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredItems.map(product => (
            <div
              key={product.id}
              className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-6 shadow-sm hover:shadow-xl transition-all flex flex-col justify-between group relative overflow-hidden"
            >
              {/* Top Category Badge */}
              <div className="flex justify-between items-start mb-4">
                <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                  {product.category || 'Agronomie'}
                </span>
                <span className="text-[10px] font-mono text-slate-400 font-bold">
                  En Stock: {product.quantity} {product.unit}
                </span>
              </div>

              {/* Icon / Image Placeholder */}
              <div className="w-full aspect-video bg-gradient-to-br from-slate-50 to-emerald-50/30 dark:from-slate-800/60 dark:to-emerald-950/20 rounded-2xl mb-4 flex items-center justify-center group-hover:scale-[1.02] transition-transform">
                <Package size={48} className="text-emerald-600/40 dark:text-emerald-400/40" />
              </div>

              {/* Item Info */}
              <div className="space-y-2 mb-6">
                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight line-clamp-1">
                  {product.name}
                </h3>
                {product.commercialPitch ? (
                  <p className="text-xs text-emerald-800 dark:text-emerald-300 italic line-clamp-2 bg-emerald-50/50 dark:bg-emerald-950/30 p-2 rounded-xl border border-emerald-100 dark:border-emerald-900/40">
                    "{product.commercialPitch}"
                  </p>
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                    {product.description || 'Produit certifié et contrôlé par RIBERJO Sarl.'}
                  </p>
                )}
              </div>

              {/* Price & Action */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Prix Unitaire</span>
                  <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                    ${(product.sellingPrice || product.price || 0).toFixed(2)}
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold ml-1">/ {product.unit || 'unit'}</span>
                </div>

                <button
                  onClick={() => addToCart(product)}
                  className="px-5 py-3 bg-slate-900 hover:bg-emerald-600 text-white dark:bg-slate-800 dark:hover:bg-emerald-600 font-black text-[10px] uppercase tracking-widest rounded-2xl transition-all shadow-md flex items-center gap-2 border-none cursor-pointer"
                >
                  <Plus size={16} /> Ajouter
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="py-20 bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-100 dark:border-slate-800 text-center max-w-2xl mx-auto p-12 space-y-4">
          <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-2">
            <ShoppingBag size={40} />
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
            Aucun article disponible pour le moment
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
            Les articles de stock sont proposés par la <strong>Logistique</strong>, évalués par le département <strong>Marketing</strong>, et validés par le <strong>Directeur Général (DG)</strong> avant d'apparaître ici en boutique.
          </p>

          {isAdminOrMarketing && (
            <button
              onClick={() => setShowDirectAddModal(true)}
              className="mt-4 px-8 py-4 bg-purple-600 hover:bg-purple-700 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg transition-all inline-flex items-center gap-2 border-none cursor-pointer"
            >
              <PlusCircle size={18} /> Ajouter directement un produit
            </button>
          )}
        </div>
      )}

      {/* SHOPPING CART MODAL / DRAWER */}
      <AnimatePresence>
        {isCartOpen && (
          <div className="fixed inset-0 z-[100] flex justify-end">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsCartOpen(false)} />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="bg-white dark:bg-slate-900 w-full max-w-md h-full shadow-2xl relative z-10 flex flex-col justify-between p-8 overflow-y-auto"
            >
              <div>
                <div className="flex justify-between items-center mb-8 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <ShoppingCart className="text-emerald-600" size={24} />
                    <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Mon Panier</h2>
                  </div>
                  <button onClick={() => setIsCartOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 border-none bg-transparent cursor-pointer">
                    <X size={20} />
                  </button>
                </div>

                {cart.length > 0 ? (
                  <div className="space-y-4">
                    {cart.map(item => (
                      <div key={item.product.id} className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-700 flex justify-between items-center gap-4">
                        <div className="flex-1">
                          <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">{item.product.name}</h4>
                          <span className="text-xs text-emerald-600 font-bold">${(item.product.sellingPrice || 0).toFixed(2)} / unit</span>
                        </div>

                        {/* Quantity Controls */}
                        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                          <button onClick={() => updateQuantity(item.product.id, -1)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300 border-none bg-transparent cursor-pointer">
                            <Minus size={14} />
                          </button>
                          <span className="text-xs font-black px-2">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.product.id, 1)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300 border-none bg-transparent cursor-pointer">
                            <Plus size={14} />
                          </button>
                        </div>

                        <button onClick={() => removeFromCart(item.product.id)} className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl border-none bg-transparent cursor-pointer">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-16 text-center text-slate-400 space-y-2">
                    <ShoppingCart size={40} className="mx-auto text-slate-300" />
                    <p className="text-xs font-black uppercase tracking-wider">Votre panier est vide</p>
                  </div>
                )}
              </div>

              {/* Checkout Section */}
              {cart.length > 0 && (
                <div className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
                  <div className="flex justify-between items-center text-lg font-black">
                    <span className="text-slate-500 dark:text-slate-400 uppercase text-xs">Total à Payer :</span>
                    <span className="text-2xl text-emerald-600">${cartTotal.toFixed(2)}</span>
                  </div>

                  <button
                    onClick={handleCheckout}
                    disabled={isOrdering}
                    className="w-full py-5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl transition-all border-none cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isOrdering ? "Validation en cours..." : "Confirmer ma Commande"} <ArrowRight size={18} />
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DIRECT ADD MODAL FOR ADMIN / MARKETING */}
      <AnimatePresence>
        {showDirectAddModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setShowDirectAddModal(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] p-8 relative z-10 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-4">
                <span className="text-[10px] font-black uppercase tracking-widest bg-purple-100 text-purple-800 px-3 py-1 rounded-full">
                  Publication Directe Boutique
                </span>
                <button onClick={() => setShowDirectAddModal(false)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 border-none bg-transparent cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-6">
                Ajouter un Article en Boutique
              </h2>

              <form onSubmit={handleDirectAdd} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nom de l'Article</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Semences Maïs Hybride 10kg"
                    value={directForm.name}
                    onChange={(e) => setDirectForm({ ...directForm, name: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-xs font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Prix Vente ($)</label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      value={directForm.sellingPrice}
                      onChange={(e) => setDirectForm({ ...directForm, sellingPrice: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-xs font-bold text-emerald-600"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Quantité Stock</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={directForm.quantity}
                      onChange={(e) => setDirectForm({ ...directForm, quantity: parseInt(e.target.value) || 1 })}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-xs font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Catégorie</label>
                    <select
                      value={directForm.category}
                      onChange={(e) => setDirectForm({ ...directForm, category: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-xs font-bold"
                    >
                      <option value="Semences">Semences</option>
                      <option value="Fertilisants">Fertilisants & Engrais</option>
                      <option value="Équipements">Équipements & Outillage</option>
                      <option value="Élevage">Secteur Élevage</option>
                      <option value="Santé & Pharmacie">Santé & Pharmacie</option>
                      <option value="Général">Général</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Unité</label>
                    <input
                      type="text"
                      placeholder="Sac, Kg, Flacon, Unité..."
                      value={directForm.unit}
                      onChange={(e) => setDirectForm({ ...directForm, unit: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-xs font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Pitch Commercial</label>
                  <input
                    type="text"
                    placeholder="Accroche pour la boutique client..."
                    value={directForm.commercialPitch}
                    onChange={(e) => setDirectForm({ ...directForm, commercialPitch: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-xs font-bold"
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowDirectAddModal(false)}
                    className="flex-1 px-6 py-4 border border-slate-100 text-slate-500 font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-slate-50 cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-6 py-4 bg-purple-600 hover:bg-purple-700 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-lg border-none cursor-pointer"
                  >
                    Publier en Boutique
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
