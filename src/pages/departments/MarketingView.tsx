import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, TrendingUp, Users, Target, Plus, Search, Filter, 
  ShoppingCart, Tag, CheckCircle2, Ban, Eye, Printer, 
  Check, X, Shield, Lock, FileText, AlertTriangle, 
  Trash2, RefreshCw, Mail, Phone, MapPin, Globe, CreditCard, 
  ChevronDown, Award, PlusCircle, Key
} from 'lucide-react';
import { 
  collection, query, orderBy, onSnapshot, limit, addDoc, doc, 
  updateDoc, deleteDoc, getDocs, where, setDoc 
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { SaleRecord, ClientOrder, ClientProfile, ClientType, UserProfile } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { QRCodeCanvas } from 'qrcode.react';
import { jsPDF } from 'jspdf';

export default function MarketingView({ activeSpace = 'USER' }: { activeSpace?: 'USER' | 'SUPER_USER' | 'ADMIN' }) {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'ventes' | 'commandes' | 'clients'>('ventes');
  
  // Tab 1: Direct Sales State
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [showAddSaleModal, setShowAddSaleModal] = useState(false);
  const [newSale, setNewSale] = useState({
    productName: '',
    quantity: '',
    price: '',
    clientName: '',
    discount: ''
  });

  // Tab 2: Orders State
  const [orders, setOrders] = useState<ClientOrder[]>([]);
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<ClientOrder | null>(null);
  const [showAddOrderModal, setShowAddOrderModal] = useState(false);
  
  const [manualOrder, setManualOrder] = useState({
    clientId: '',
    productSelection: 'Maïs G1',
    quantity: 1,
    unitPrice: 15,
    paymentMethod: 'manual' as any,
    deliveryAddress: ''
  });

  // Tab 3: Clients State
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [clientTypeFilter, setClientTypeFilter] = useState<string>('all');
  const [clientStatusFilter, setClientStatusFilter] = useState<string>('all');
  const [selectedClient, setSelectedClient] = useState<ClientProfile | null>(null);

  const sampleProducts = [
    { name: 'Maïs G1 (Sac 50kg)', price: 15 },
    { name: 'Engrais Bio Premium (Sac 25kg)', price: 45 },
    { name: 'Semences de Tomates Haraka (Sachet)', price: 10 },
    { name: 'Poussins d\'un jour (Lot de 50)', price: 125 },
    { name: 'Aliments complets Volaille (Sac 25kg)', price: 30 },
    { name: 'Kit Micro-irrigation Standard', price: 120 },
    { name: 'Service d\'Assistance Agronomique', price: 50 }
  ];

  // Load Sales List
  useEffect(() => {
    const q = query(
      collection(db, 'sales'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSales(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SaleRecord)));
    });
    return () => unsubscribe();
  }, []);

  // Load Client Orders Real-time
  useEffect(() => {
    const q = query(
      collection(db, 'client_orders'),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClientOrder)));
    });
    return () => unsubscribe();
  }, []);

  // Load Clients Real-time
  useEffect(() => {
    const q = query(
      collection(db, 'clients'),
      orderBy('registrationDate', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClientProfile)));
    });
    return () => unsubscribe();
  }, []);

  // Sync Unit price on Manual Order Selection
  useEffect(() => {
    const matched = sampleProducts.find(p => p.name.startsWith(manualOrder.productSelection));
    if (matched) {
      setManualOrder(prev => ({ ...prev, unitPrice: matched.price }));
    }
  }, [manualOrder.productSelection]);

  // Handle direct sale addition
  const handleAddSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    const qty = parseFloat(String(newSale.quantity).replace(',', '.'));
    const priceVal = parseFloat(String(newSale.price).replace(',', '.'));
    const discVal = parseFloat(String(newSale.discount || '0').replace(',', '.'));

    const parsedQty = isNaN(qty) ? 0 : qty;
    const parsedPrice = isNaN(priceVal) ? 0 : priceVal;
    const parsedDisc = isNaN(discVal) ? 0 : discVal;
    const finalTotal = Math.max(0, (parsedQty * parsedPrice) - parsedDisc);

    try {
      await addDoc(collection(db, 'sales'), {
        productName: newSale.productName,
        clientName: newSale.clientName,
        quantity: parsedQty,
        price: parsedPrice,
        discount: parsedDisc,
        total: finalTotal,
        sellerId: profile.id,
        sellerName: profile.fullName,
        createdAt: Date.now()
      });
      setShowAddSaleModal(false);
      setNewSale({ productName: '', quantity: '', price: '', clientName: '', discount: '' });
    } catch (err) {
      console.error("Error adding sale:", err);
    }
  };

  // Process & Transition Order status
  const updateOrderStatus = async (orderId: string, newStatus: ClientOrder['status']) => {
    try {
      const orderRef = doc(db, 'client_orders', orderId);
      await updateDoc(orderRef, { status: newStatus });
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder(prev => prev ? { ...prev, status: newStatus } : null);
      }
    } catch (err) {
      console.error("Error updating order status:", err);
    }
  };

  // Toggle Order Payment status
  const toggleOrderPayment = async (orderId: string, currentStatus: 'paid' | 'unpaid') => {
    try {
      const orderRef = doc(db, 'client_orders', orderId);
      const nextStatus = currentStatus === 'paid' ? 'unpaid' : 'paid';
      await updateDoc(orderRef, { paymentStatus: nextStatus });
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder(prev => prev ? { ...prev, paymentStatus: nextStatus } : null);
      }
    } catch (err) {
      console.error("Error toggling order payment status:", err);
    }
  };

  // Delete an order
  const handleDeleteOrder = async (orderId: string) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer définitivement cette commande ?")) return;
    try {
      await deleteDoc(doc(db, 'client_orders', orderId));
      setSelectedOrder(null);
    } catch (err) {
      console.error("Error deleting order:", err);
    }
  };

  // Manual placement of order for a client
  const handleManualOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualOrder.clientId) {
      alert("Veuillez sélectionner un client.");
      return;
    }

    const matchedClient = clients.find(c => c.id === manualOrder.clientId);
    if (!matchedClient) return;

    try {
      const orderId = `CMD-${matchedClient.type.slice(0, 3)}-${Date.now().toString().slice(-6)}`;
      const totalAmount = manualOrder.quantity * manualOrder.unitPrice;

      const orderData: ClientOrder & { clientName: string } = {
        id: orderId,
        clientId: manualOrder.clientId,
        clientName: matchedClient.fullName,
        items: [{
          productId: manualOrder.productSelection.split(' ')[0],
          productName: manualOrder.productSelection,
          quantity: manualOrder.quantity,
          price: manualOrder.unitPrice
        }],
        total: totalAmount,
        status: 'pending',
        paymentStatus: 'unpaid',
        paymentMethod: manualOrder.paymentMethod,
        deliveryAddress: manualOrder.deliveryAddress || matchedClient.address || "Retrait comptoir",
        createdAt: Date.now()
      };

      await setDoc(doc(db, 'client_orders', orderId), orderData);
      setShowAddOrderModal(false);
      setManualOrder({
        clientId: '',
        productSelection: 'Maïs G1',
        quantity: 1,
        unitPrice: 15,
        paymentMethod: 'manual',
        deliveryAddress: ''
      });
    } catch (err) {
      console.error("Error creating manual order:", err);
    }
  };

  // Note: Client creation is now handled through global system registry or public signup. Marketing Director can only see and manage authorizations/status of the lists of clients.

  // Toggle service permission for client
  const handleToggleService = async (service: string) => {
    if (!selectedClient) return;
    try {
      const isAuthorized = selectedClient.serviceAuthorizations.includes(service);
      const updatedServices = isAuthorized 
        ? selectedClient.serviceAuthorizations.filter(s => s !== service)
        : [...selectedClient.serviceAuthorizations, service];

      await updateDoc(doc(db, 'clients', selectedClient.id), {
        serviceAuthorizations: updatedServices
      });

      setSelectedClient(prev => prev ? { ...prev, serviceAuthorizations: updatedServices } : null);
    } catch (err) {
      console.error("Error updating service permission:", err);
    }
  };

  // Change client status
  const handleClientStatusChange = async (itemId: string, currentStatus: ClientProfile['status']) => {
    const nextStatus = currentStatus === 'active' ? 'suspended' : 'active';
    try {
      await updateDoc(doc(db, 'clients', itemId), { status: nextStatus });
      await updateDoc(doc(db, 'users', itemId), { status: nextStatus });
      if (selectedClient && selectedClient.id === itemId) {
        setSelectedClient(prev => prev ? { ...prev, status: nextStatus } : null);
      }
    } catch (err) {
      console.error("Error updating client status:", err);
    }
  };

  // Delete client profile
  const handleDeleteClient = async (itemId: string) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer ce client ? Toutes ses données seront retirées.")) return;
    try {
      await deleteDoc(doc(db, 'clients', itemId));
      await deleteDoc(doc(db, 'users', itemId));
      setSelectedClient(null);
    } catch (err) {
      console.error("Error deleting client:", err);
    }
  };

  // Generate and Download Client PDF Card
  const downloadClientCardPDF = (clt: ClientProfile) => {
    const docPdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: [85.6, 54]
    });

    // Outer Background design
    docPdf.setFillColor(8, 47, 73); // Dark slate blue header background
    docPdf.rect(0, 0, 85.6, 14, 'F');
    
    // Emerald green separator stripe
    docPdf.setFillColor(16, 185, 129);
    docPdf.rect(0, 14, 85.6, 1.5, 'F');

    // Header Texts
    docPdf.setTextColor(255, 255, 255);
    docPdf.setFontSize(8.5);
    docPdf.setFont('helvetica', 'bold');
    docPdf.text('RIBERJO GLOBAL SERVICE', 6, 8.5);
    
    docPdf.setFontSize(5);
    docPdf.text('EXCELLENCE & INNOVATION', 62, 8.5);

    // Body Texts
    docPdf.setTextColor(15, 23, 42); // slate 900
    docPdf.setFontSize(10);
    docPdf.text(clt.fullName.toUpperCase(), 6, 23);
    
    docPdf.setFontSize(5.5);
    docPdf.setTextColor(100, 116, 139); // slate 500
    docPdf.text(`ID CLIENT : ${clt.id}`, 6, 29);
    docPdf.text(`PROFIL : ${clt.type}`, 6, 33);
    docPdf.text(`REF NATIONAL : ${clt.referenceNumber}`, 6, 37);
    docPdf.text(`TÉLÉPHONE : ${clt.phone}`, 6, 41);
    docPdf.text(`CRÉÉ LE : ${new Date(clt.registrationDate).toLocaleDateString('fr-FR')}`, 6, 45);

    // Decorative signature box or seal
    docPdf.setDrawColor(226, 232, 240);
    docPdf.rect(60, 41, 19, 8);
    docPdf.setFontSize(4);
    docPdf.text('SIGNATURE DIRECTION', 61.5, 48.5);

    // Save as client name
    docPdf.save(`RIBERJO_CARTE_${clt.id}.pdf`);
  };

  // Generate and Download Invoice PDF for orders (Validated / Paid or Draft)
  const downloadOrderInvoicePDF = (order: ClientOrder) => {
    const docPdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Color Palette
    const primaryColor = [8, 47, 73]; // Dark Navy (#082f49)
    const accentColor = [16, 185, 129]; // Emerald Green (#10b981)
    const textColorDark = [15, 23, 42]; // Slate 900
    const textColorLight = [100, 116, 139]; // Slate 500

    // Header Background Accent Stripe
    docPdf.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    docPdf.rect(0, 0, 210, 15, 'F');
    docPdf.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
    docPdf.rect(0, 15, 210, 3, 'F');

    // Draw Riberjo Vector Logo Symbol
    docPdf.setFillColor(16, 185, 129); // #10b981 (Emerald)
    docPdf.roundedRect(20, 23, 13, 13, 2.5, 2.5, 'F');

    // Inner white border outline inside logo box
    docPdf.setDrawColor(255, 255, 255);
    docPdf.setLineWidth(0.5);
    docPdf.roundedRect(21, 24, 11, 11, 1.8, 1.8, 'D');

    // Draw stylized letter "R" inside the logo
    docPdf.setTextColor(255, 255, 255);
    docPdf.setFont('helvetica', 'bold');
    docPdf.setFontSize(20);
    docPdf.text('R', 24.5, 32.5);

    // Company Logo / Title
    docPdf.setFont('helvetica', 'bold');
    docPdf.setFontSize(16);
    docPdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    docPdf.text('RIBERJO GLOBAL SERVICE', 37, 28);

    docPdf.setFontSize(7.5);
    docPdf.setFont('helvetica', 'bold');
    docPdf.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
    docPdf.text('EXCELLENCE, OPPORTUNITES & IMPACT SOCIAL', 37, 32.5);

    docPdf.setFontSize(7);
    docPdf.setFont('helvetica', 'normal');
    docPdf.setTextColor(textColorLight[0], textColorLight[1], textColorLight[2]);
    docPdf.text('Lubumbashi, Province du Haut-Katanga, RDC', 37, 36.5);
    docPdf.text('Contact: info@riberjo.com | +243 999 123 456', 37, 40.5);

    // Document Title & Info Line Right Aligned
    docPdf.setFont('helvetica', 'bold');
    docPdf.setFontSize(22);
    docPdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    docPdf.text('FACTURE', 140, 29);

    docPdf.setFontSize(8.5);
    docPdf.setFont('helvetica', 'normal');
    docPdf.setTextColor(textColorDark[0], textColorDark[1], textColorDark[2]);
    docPdf.text(`Facture N° : ${order.id}`, 140, 36);
    docPdf.text(`Date : ${new Date(order.createdAt).toLocaleDateString('fr-FR')}`, 140, 41);
    
    // Solid thin separator
    docPdf.setDrawColor(226, 232, 240); // Slate 200
    docPdf.setLineWidth(0.4);
    docPdf.line(20, 48, 190, 48);

    // Bill To & Vendor Columns
    docPdf.setFont('helvetica', 'bold');
    docPdf.setFontSize(9.5);
    docPdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    docPdf.text('FACTURÉ À :', 20, 58);

    docPdf.setFont('helvetica', 'normal');
    docPdf.setFontSize(8.5);
    docPdf.setTextColor(textColorDark[0], textColorDark[1], textColorDark[2]);
    
    const clientName = (order as any).clientName || "Client Riberjo";
    docPdf.text(`Client : ${clientName.toUpperCase()}`, 20, 63.5);
    docPdf.text(`ID Client : ${order.clientId}`, 20, 68);
    docPdf.text(`Adresse : ${order.deliveryAddress || 'Retrait comptoir'}`, 20, 72.5);
    docPdf.text(`Mode de Paiement : ${order.paymentMethod === 'mobile_money' ? 'Mobile Money' : order.paymentMethod === 'bank_transfer' ? 'Virement Bancaire' : 'Cash / Guichet'}`, 20, 77);

    // Receipt details block right
    docPdf.setFont('helvetica', 'bold');
    docPdf.text('ÉMETTEUR :', 120, 58);
    docPdf.setFont('helvetica', 'normal');
    docPdf.text('Riberjo Global Service SARL', 120, 63.5);
    docPdf.text('Dép. Commercial et Ventes', 120, 68);
    docPdf.text('Lubumbashi, RDC', 120, 72.5);

    // Payment Status badge
    const isPaid = order.paymentStatus === 'paid';
    docPdf.setFillColor(isPaid ? 209 : 254, isPaid ? 250 : 242, isPaid ? 229 : 242); // bg-emerald-100 or bg-amber-100
    docPdf.roundedRect(120, 77, 45, 7, 1, 1, 'F');
    docPdf.setTextColor(isPaid ? 6 : 146, isPaid ? 95 : 64, isPaid ? 70 : 14); // text-emerald-800 or text-amber-800
    docPdf.setFont('helvetica', 'bold');
    docPdf.setFontSize(7.5);
    docPdf.text(`STATUT : ${isPaid ? 'PAYÉE (LIQUIDÉE)' : 'ATTENTE ENCAISSEMENT'}`, 122, 81.5);

    // Table Header
    const tableTop = 93;
    docPdf.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    docPdf.rect(20, tableTop, 170, 8, 'F');
    
    docPdf.setFont('helvetica', 'bold');
    docPdf.setFontSize(8);
    docPdf.setTextColor(255, 255, 255);
    docPdf.text('Description de l\'article', 24, tableTop + 5.5);
    docPdf.text('Qté', 115, tableTop + 5.5);
    docPdf.text('Prix unitaire', 135, tableTop + 5.5);
    docPdf.text('Total', 165, tableTop + 5.5);

    // Table Body
    let currentY = tableTop + 8;
    docPdf.setFont('helvetica', 'normal');
    docPdf.setFontSize(8.5);
    docPdf.setTextColor(textColorDark[0], textColorDark[1], textColorDark[2]);

    if (order.items && order.items.length > 0) {
      order.items.forEach((item, index) => {
        // Zebra striping background
        if (index % 2 === 1) {
          docPdf.setFillColor(248, 250, 252); // slate 50
          docPdf.rect(20, currentY, 170, 9, 'F');
        }
        // Border bottom for line
        docPdf.setDrawColor(241, 245, 249); // slate 100
        docPdf.line(20, currentY + 9, 190, currentY + 9);

        docPdf.setTextColor(textColorDark[0], textColorDark[1], textColorDark[2]);
        docPdf.text(item.productName || 'Produit Riberjo', 24, currentY + 6);
        docPdf.text(String(item.quantity), 115, currentY + 6);
        docPdf.text(`$${Number(item.price).toFixed(2)}`, 135, currentY + 6);
        docPdf.text(`$${(item.quantity * item.price).toFixed(2)}`, 165, currentY + 6);
        currentY += 9;
      });
    } else {
      // Manual/Fallback single item order list
      docPdf.text('Commande Riberjo', 24, currentY + 6);
      docPdf.text('1', 115, currentY + 6);
      docPdf.text(`$${Number(order.total).toFixed(2)}`, 135, currentY + 6);
      docPdf.text(`$${Number(order.total).toFixed(2)}`, 165, currentY + 6);
      docPdf.setDrawColor(241, 245, 249);
      docPdf.line(20, currentY + 9, 190, currentY + 9);
      currentY += 9;
    }

    // Calculations Summary Box
    const billingY = currentY + 8;
    docPdf.setFont('helvetica', 'normal');
    docPdf.setFontSize(8.5);
    docPdf.setTextColor(textColorLight[0], textColorLight[1], textColorLight[2]);
    docPdf.text('Total Net HT :', 120, billingY);
    docPdf.text('TVA (0% / Exempté) :', 120, billingY + 4.5);
    
    docPdf.setFont('helvetica', 'bold');
    docPdf.setFontSize(9.5);
    docPdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    docPdf.text('MONTANT TOTAL TTC :', 120, billingY + 10.5);

    docPdf.setFont('helvetica', 'normal');
    docPdf.setFontSize(8.5);
    docPdf.setTextColor(textColorDark[0], textColorDark[1], textColorDark[2]);
    docPdf.text(`$${Number(order.total).toFixed(2)}`, 165, billingY);
    docPdf.text('$0.00', 165, billingY + 4.5);

    docPdf.setFont('helvetica', 'bold');
    docPdf.setFontSize(9.5);
    docPdf.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
    docPdf.text(`$${Number(order.total).toFixed(2)}`, 165, billingY + 10.5);

    // Signature and stamps
    const signY = billingY + 20;

    // Stamp & Certificate Vector on bottom left
    docPdf.setFillColor(240, 253, 250); // very soft emerald green background
    docPdf.roundedRect(20, signY, 75, 22, 2, 2, 'F');
    docPdf.setDrawColor(16, 185, 129); // emerald border
    docPdf.setLineWidth(0.25);
    docPdf.roundedRect(20, signY, 75, 22, 2, 2, 'D');

    // Security badge text
    docPdf.setFont('helvetica', 'bold');
    docPdf.setFontSize(6.5);
    docPdf.setTextColor(6, 95, 70); // deep emerald text
    docPdf.text('AUTHENTICITÉ GARANTIE PAR RIBERJO ERP', 23, signY + 5);
    docPdf.setFont('helvetica', 'normal');
    docPdf.setFontSize(6);
    docPdf.setTextColor(16, 185, 129);
    docPdf.text(`Signature Électronique : SEC-STAMP-${order.id.slice(0, 8).toUpperCase()}`, 23, signY + 9.5);
    docPdf.text('Document validé et certifié conforme pour valeur légale.', 23, signY + 13.5);
    docPdf.text('Système Central RIBERJO SARL vERP2.5', 23, signY + 17.5);

    // Terms
    docPdf.setFont('helvetica', 'bold');
    docPdf.setFontSize(8);
    docPdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    docPdf.text('CONDITIONS & DIRECTIVES', 20, signY + 28);
    
    docPdf.setFont('helvetica', 'normal');
    docPdf.setFontSize(7);
    docPdf.setTextColor(textColorLight[0], textColorLight[1], textColorLight[2]);
    docPdf.text('1. Cette facture officielle certifie l\'achat ou la réservation de produits auprès de Riberjo.', 20, signY + 32.5);
    docPdf.text('2. Les marchandises livrées ou retirées ne sont ni reprises ni échangées.', 20, signY + 36.5);
    docPdf.text('3. Rapprochez-vous du guichet de distribution muni de votre facture ou carte digitale.', 20, signY + 40.5);

    // Authorized Signature Box right
    docPdf.setDrawColor(226, 232, 240);
    docPdf.rect(130, signY, 50, 18);
    docPdf.setFontSize(6.5);
    docPdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    docPdf.setFont('helvetica', 'bold');
    docPdf.text('SIGNATURE POUR LA DIRECTION', 133, signY + 4);
    
    // Draw stylized vector digital signature
    docPdf.setDrawColor(8, 47, 73);
    docPdf.setLineWidth(0.4);
    docPdf.line(135, signY + 11, 142, signY + 7);
    docPdf.line(142, signY + 7, 148, signY + 13);
    docPdf.line(148, signY + 13, 160, signY + 8);
    docPdf.line(160, signY + 8, 175, signY + 12);

    docPdf.setFont('helvetica', 'normal');
    docPdf.setFontSize(5.5);
    docPdf.setTextColor(textColorLight[0], textColorLight[1], textColorLight[2]);
    docPdf.text('Direction Générale RIBERJO', 133, signY + 16);

    // Footer lines
    docPdf.setDrawColor(241, 245, 249);
    docPdf.line(20, 275, 190, 275);
    
    docPdf.setFontSize(7.5);
    docPdf.setTextColor(textColorLight[0], textColorLight[1], textColorLight[2]);
    docPdf.text('Riberjo Global Service SARL • Lubumbashi, RDC • CD/LSH/RCCM/22-B-0129 • NIF A225091Y', 20, 281);
    docPdf.text('Page 1/1 - Document généré par le système ERP de RIBERJO', 135, 281);

    // Save
    docPdf.save(`FACTURE_RIBERJO_${order.id}.pdf`);
  };

  // Generate and Download Ticket/Receipt PDF for Direct Sales
  const downloadDirectSaleInvoicePDF = (sale: SaleRecord) => {
    const docPdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const primaryColor = [8, 47, 73]; 
    const accentColor = [225, 29, 72]; // Rose/Pink
    const textColorDark = [15, 23, 42]; 
    const textColorLight = [100, 116, 139]; 

    // Header Background Accent Stripe
    docPdf.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    docPdf.rect(0, 0, 210, 15, 'F');
    docPdf.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
    docPdf.rect(0, 15, 210, 3, 'F');

    // Draw Riberjo Vector Logo Symbol
    docPdf.setFillColor(16, 185, 129); // #10b981 (Emerald)
    docPdf.roundedRect(20, 23, 13, 13, 2.5, 2.5, 'F');

    // Inner white border outline inside logo box
    docPdf.setDrawColor(255, 255, 255);
    docPdf.setLineWidth(0.5);
    docPdf.roundedRect(21, 24, 11, 11, 1.8, 1.8, 'D');

    // Draw stylized letter "R" inside the logo
    docPdf.setTextColor(255, 255, 255);
    docPdf.setFont('helvetica', 'bold');
    docPdf.setFontSize(20);
    docPdf.text('R', 24.5, 32.5);

    // Company Logo / Title
    docPdf.setFont('helvetica', 'bold');
    docPdf.setFontSize(16);
    docPdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    docPdf.text('RIBERJO GLOBAL SERVICE', 37, 28);

    docPdf.setFontSize(7.5);
    docPdf.setFont('helvetica', 'bold');
    docPdf.setTextColor(16, 185, 129); 
    docPdf.text('EXCELLENCE, OPPORTUNITES & IMPACT SOCIAL', 37, 32.5);

    docPdf.setFontSize(7);
    docPdf.setFont('helvetica', 'normal');
    docPdf.setTextColor(textColorLight[0], textColorLight[1], textColorLight[2]);
    docPdf.text('Lubumbashi, Province du Haut-Katanga, RDC', 37, 36.5);
    docPdf.text('Contact: info@riberjo.com | +243 999 123 456', 37, 40.5);

    // Document Title & Info Line Right Aligned
    docPdf.setFont('helvetica', 'bold');
    docPdf.setFontSize(22);
    docPdf.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
    docPdf.text('REÇU DE CAISSE', 110, 29);

    docPdf.setFontSize(8.5);
    docPdf.setFont('helvetica', 'normal');
    docPdf.setTextColor(textColorDark[0], textColorDark[1], textColorDark[2]);
    docPdf.text(`Réf Vente : SAL-${String(sale.id).slice(0, 8).toUpperCase()}`, 110, 36);
    docPdf.text(`Date : ${sale.createdAt ? new Date(sale.createdAt).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR')}`, 110, 41);
    
    // Solid thin separator
    docPdf.setDrawColor(226, 232, 240);
    docPdf.setLineWidth(0.4);
    docPdf.line(20, 48, 190, 48);

    // Customer & Seller
    docPdf.setFont('helvetica', 'bold');
    docPdf.setFontSize(9.5);
    docPdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    docPdf.text('CLIENT ACQUÉREUR :', 20, 58);

    docPdf.setFont('helvetica', 'normal');
    docPdf.setFontSize(8.5);
    docPdf.setTextColor(textColorDark[0], textColorDark[1], textColorDark[2]);
    docPdf.text(`Client : ${sale.clientName.toUpperCase()}`, 20, 63.5);
    docPdf.text(`Vente émise par : ${sale.sellerName}`, 20, 68);

    docPdf.setFont('helvetica', 'bold');
    docPdf.text('ÉMETTEUR :', 120, 58);
    docPdf.setFont('helvetica', 'normal');
    docPdf.text('Riberjo Global Service SARL', 120, 63.5);
    docPdf.text('Dép. Commercial et Ventes', 120, 68);

    // Payment Status badge for sale (always paid)
    docPdf.setFillColor(209, 250, 229); 
    docPdf.roundedRect(120, 75, 45, 7, 1, 1, 'F');
    docPdf.setTextColor(6, 95, 70); 
    docPdf.setFont('helvetica', 'bold');
    docPdf.setFontSize(7.5);
    docPdf.text('STATUT : COMPTANT PAYÉ', 122, 79.5);

    const tableTop = 93;
    docPdf.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    docPdf.rect(20, tableTop, 170, 8, 'F');
    
    docPdf.setFont('helvetica', 'bold');
    docPdf.setFontSize(8);
    docPdf.setTextColor(255, 255, 255);
    docPdf.text('Description du produit', 24, tableTop + 5.5);
    docPdf.text('Quantité', 115, tableTop + 5.5);
    docPdf.text('Prix unitaire', 135, tableTop + 5.5);
    docPdf.text('Total', 165, tableTop + 5.5);

    const currentY = tableTop + 8;
    docPdf.setFont('helvetica', 'normal');
    docPdf.setFontSize(8.5);
    docPdf.setTextColor(textColorDark[0], textColorDark[1], textColorDark[2]);

    docPdf.setDrawColor(241, 245, 249);
    docPdf.line(20, currentY + 10, 190, currentY + 10);

    docPdf.text(sale.productName, 24, currentY + 6);
    docPdf.text(String(sale.quantity), 115, currentY + 6);
    docPdf.text(`$${Number(sale.price).toFixed(2)}`, 135, currentY + 6);
    docPdf.text(`$${Number(sale.total || sale.quantity * sale.price).toFixed(2)}`, 165, currentY + 6);

    const subtotal = sale.quantity * sale.price;
    const discount = sale.discount || 0;
    const finalTotal = sale.total !== undefined ? sale.total : Math.max(0, subtotal - discount);

    const billingY = currentY + 15;
    docPdf.setFont('helvetica', 'normal');
    docPdf.setFontSize(8.5);
    docPdf.setTextColor(textColorLight[0], textColorLight[1], textColorLight[2]);
    docPdf.text('Total Net HT :', 120, billingY);
    docPdf.text('Réduction :', 120, billingY + 4.5);
    docPdf.text('TVA (Exempté) :', 120, billingY + 9);
    
    docPdf.setFont('helvetica', 'bold');
    docPdf.setFontSize(9.5);
    docPdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    docPdf.text('MONTANT TOTAL REÇU :', 120, billingY + 15);

    docPdf.setFont('helvetica', 'normal');
    docPdf.setFontSize(8.5);
    docPdf.setTextColor(textColorDark[0], textColorDark[1], textColorDark[2]);
    docPdf.text(`$${Number(subtotal).toFixed(2)}`, 165, billingY);
    docPdf.text(`-$${Number(discount).toFixed(2)}`, 165, billingY + 4.5);
    docPdf.text('$0.00', 165, billingY + 9);

    docPdf.setFont('helvetica', 'bold');
    docPdf.setFontSize(9.5);
    docPdf.setTextColor(16, 185, 129); 
    docPdf.text(`$${Number(finalTotal).toFixed(2)}`, 165, billingY + 15);

    // Dynamic sign and badge details
    const signY = billingY + 25;

    // Stamp & Certificate Vector on bottom left
    docPdf.setFillColor(240, 253, 250); // soft emerald green background
    docPdf.roundedRect(20, signY, 75, 22, 2, 2, 'F');
    docPdf.setDrawColor(16, 185, 129); // emerald border
    docPdf.setLineWidth(0.25);
    docPdf.roundedRect(20, signY, 75, 22, 2, 2, 'D');

    // Security badge text
    docPdf.setFont('helvetica', 'bold');
    docPdf.setFontSize(6.5);
    docPdf.setTextColor(6, 95, 70); 
    docPdf.text('CAISSE RIBERJO SECURITY SEAL', 23, signY + 5);
    docPdf.setFont('helvetica', 'normal');
    docPdf.setFontSize(6);
    docPdf.setTextColor(16, 185, 129);
    docPdf.text(`Transaction hash : TX-${String(sale.id).slice(0, 8).toUpperCase()}`, 23, signY + 9.5);
    docPdf.text('Reçu officiel acquitté libératoirement auprès de nos guichets.', 23, signY + 13.5);
    docPdf.text('Riberjo Global Service SARL vERP2.5', 23, signY + 17.5);

    docPdf.setFont('helvetica', 'bold');
    docPdf.setFontSize(8);
    docPdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    docPdf.text('NOTICE FINANCIÈRE', 20, signY + 28);
    
    docPdf.setFont('helvetica', 'normal');
    docPdf.setFontSize(7);
    docPdf.setTextColor(textColorLight[0], textColorLight[1], textColorLight[2]);
    docPdf.text('1. Ce ticket certifie le paiement libératoire instantané au comptoir de RIBERJO.', 20, signY + 32.5);
    docPdf.text('2. La livraison des articles a été validée le jour même de la transaction.', 20, signY + 36.5);

    // Authorized Signature Box right
    docPdf.setDrawColor(226, 232, 240);
    docPdf.rect(130, signY, 50, 18);
    docPdf.setFontSize(6.5);
    docPdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    docPdf.setFont('helvetica', 'bold');
    docPdf.text('SIGNATURE POUR LA DIRECTION', 133, signY + 4);
    
    // Draw stylized vector digital signature
    docPdf.setDrawColor(8, 47, 73);
    docPdf.setLineWidth(0.4);
    docPdf.line(135, signY + 11, 142, signY + 7);
    docPdf.line(142, signY + 7, 148, signY + 13);
    docPdf.line(148, signY + 13, 160, signY + 8);
    docPdf.line(160, signY + 8, 175, signY + 12);

    docPdf.setFont('helvetica', 'normal');
    docPdf.setFontSize(5.5);
    docPdf.setTextColor(textColorLight[0], textColorLight[1], textColorLight[2]);
    docPdf.text('Caisse Centrale RIBERJO', 133, signY + 16);

    docPdf.setDrawColor(241, 245, 249);
    docPdf.line(20, 275, 190, 275);
    
    docPdf.setFontSize(7.5);
    docPdf.setTextColor(textColorLight[0], textColorLight[1], textColorLight[2]);
    docPdf.text('Riberjo Global Service SARL • Lubumbashi, RDC • CD/LSH/RCCM/22-B-0129', 20, 281);

    docPdf.save(`RECU_VENTE_RIBERJO_${String(sale.id).slice(0, 8).toUpperCase()}.pdf`);
  };

  // Sum volume calculations
  const totalSalesVolume = sales.reduce((acc, sale) => acc + sale.total, 0);
  const pendingOrdersCount = orders.filter(o => o.status === 'pending').length;
  const activeClientsCount = clients.filter(c => c.status === 'active').length;

  const stats = [
    { label: 'Volume Ventes Directes', value: `$${totalSalesVolume.toLocaleString()}`, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
    { label: 'Commandes en attente', value: String(pendingOrdersCount), icon: ShoppingBag, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-500/10' },
    { label: 'Clients Actifs Soumissionnaires', value: String(activeClientsCount), icon: Users, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-500/10' },
    { label: 'Taux conversion lead', value: '18%', icon: Target, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-500/10' },
  ];

  // Filtering Logic
  const filteredOrders = orders.filter(order => {
    const term = (orderSearch || '').toLowerCase();
    const idMatches = (order.id || '').toLowerCase().includes(term);
    const clientMatches = (order.clientId || '').toLowerCase().includes(term) || (order as any).clientName?.toLowerCase().includes(term);
    const statusMatches = orderStatusFilter === 'all' || order.status === orderStatusFilter;
    return (idMatches || clientMatches) && statusMatches;
  });

  const filteredClients = clients.filter(client => {
    const term = (clientSearch || '').toLowerCase();
    const nameMatches = (client.fullName || '').toLowerCase().includes(term) || (client.id || '').toLowerCase().includes(term) || (client.phone || '').includes(term);
    const typeMatches = clientTypeFilter === 'all' || client.type === clientTypeFilter;
    const statusMatches = clientStatusFilter === 'all' || client.status === clientStatusFilter;
    return nameMatches && typeMatches && statusMatches;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500 font-sans p-6 max-w-7xl mx-auto pb-24">
      {/* Title block */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 p-6 bg-slate-900 text-white rounded-[2.5rem] relative overflow-hidden shadow-2xl">
        <div className="relative z-10 space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black uppercase tracking-[0.25em] bg-rose-600 text-white px-3 py-1 rounded-full">
              {activeSpace === 'USER' ? "Service Commercial — Collaborateur" : "Espace Commercial & Ventes — Expert"}
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tighter">
            {activeSpace === 'USER' ? "Marketing & Ventes" : "Directeur Marketing et Vente"}
          </h1>
          <p className="text-slate-400 font-medium text-sm max-w-xl">
            {activeSpace === 'USER' 
              ? "Saisie de vente directe, bons de commandes au comptoir et consultation du fichier clients."
              : "Gestion complète du portefeuille clients, validation de commandes et suivi de la croissance commerciale de RIBERJO."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 relative z-10 shrink-0">
          <button 
            type="button"
            onClick={() => setShowAddSaleModal(true)}
            className="flex items-center gap-2 px-5 py-3.5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg active:scale-95 border-none"
          >
            <ShoppingCart size={14} /> Vente Directe
          </button>
          <button 
            type="button"
            onClick={() => setShowAddOrderModal(true)}
            className="flex items-center gap-2 px-5 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg active:scale-95 border-none"
          >
            <PlusCircle size={14} /> Saisir Commande
          </button>
        </div>
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-56 h-56 bg-rose-500/10 rounded-full blur-3xl"></div>
      </div>

      {/* Tabs list */}
      <div className="flex border-b border-slate-250 dark:border-slate-800 gap-2 overflow-x-auto pb-1 scrollbar-hide">
        <button
          onClick={() => setActiveTab('ventes')}
          className={`px-6 py-4 border-b-2 text-xs font-black uppercase tracking-widest transition-all shrink-0 ${
            activeTab === 'ventes'
              ? 'border-rose-600 text-rose-600 font-black'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800'
          }`}
        >
          📊 Direct Ventes & Objectifs
        </button>
        <button
          onClick={() => setActiveTab('commandes')}
          className={`px-6 py-4 border-b-2 text-xs font-black uppercase tracking-widest transition-all shrink-0 flex items-center gap-2 ${
            activeTab === 'commandes'
              ? 'border-emerald-600 text-emerald-600 font-black'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800'
          }`}
        >
          📦 Commandes Clients ({orders.length})
          {pendingOrdersCount > 0 && (
            <span className="bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full animate-pulse">
              {pendingOrdersCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('clients')}
          className={`px-6 py-4 border-b-2 text-xs font-black uppercase tracking-widest transition-all shrink-0 ${
            activeTab === 'clients'
              ? 'border-blue-600 text-blue-600 font-black'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800'
          }`}
        >
          👥 Gestion de Clients ({clients.length})
        </button>
      </div>

      {/* Stats Cards Rows */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-850 shadow-sm"
          >
            <div className={`w-12 h-12 ${stat.bg} ${stat.color} rounded-2xl flex items-center justify-center mb-4`}>
              <stat.icon size={22} />
            </div>
            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{stat.label}</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Actual tab views */}
      <div>
        {/* ==================================== TAB 1 ==================================== */}
        {activeTab === 'ventes' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-850 shadow-sm overflow-hidden">
                <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/20">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Registre des Ventes directes</h3>
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50/50 dark:bg-slate-800/20 border-b border-slate-100 dark:border-slate-800">
                        <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Produit</th>
                        <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Client</th>
                        <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Montant</th>
                        <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center font-mono">Date</th>
                        <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Pièce Justificative</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                      {sales.map((sale) => (
                        <tr key={sale.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-rose-50 dark:bg-rose-500/10 rounded-lg flex items-center justify-center text-rose-600">
                                <Tag size={13} />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-slate-900 dark:text-white uppercase">{sale.productName}</p>
                                <p className="text-[9px] text-slate-400 font-medium">{sale.quantity} unités soldées</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-5">
                            <p className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase">{sale.clientName}</p>
                            <p className="text-[9px] text-slate-400 font-medium">Par: {sale.sellerName}</p>
                          </td>
                          <td className="px-8 py-5 text-right font-black text-xs text-rose-600 dark:text-rose-400">
                            <div className="flex flex-col items-end">
                              <span>${(sale.total !== undefined ? sale.total : (sale.quantity * sale.price - (sale.discount || 0))).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              {sale.discount ? (
                                <span className="text-[9px] font-extrabold text-emerald-500 mt-0.5 tracking-wider bg-emerald-500/10 px-1.5 py-0.5 rounded-md">
                                  RÉD. -${Number(sale.discount).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-8 py-5 text-center text-[10px] text-slate-400 font-semibold">
                            {sale.createdAt ? new Date(sale.createdAt).toLocaleDateString('fr-FR') : "N/A"}
                          </td>
                          <td className="px-8 py-5 text-right">
                            <button
                              onClick={() => downloadDirectSaleInvoicePDF(sale)}
                              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold rounded-xl uppercase tracking-widest transition-all flex items-center gap-2 border-none ml-auto"
                            >
                              <FileText size={11} /> Reçu PDF
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {sales.length === 0 && (
                    <div className="py-20 text-center flex flex-col items-center gap-2">
                      <ShoppingBag className="text-slate-200 dark:text-slate-800 animate-pulse" size={48} />
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Aucune vente directe enregistrée</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-gradient-to-br from-rose-600 to-pink-700 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl">
                <h3 className="text-lg font-black uppercase tracking-tight mb-4 relative z-10">Objectifs du Département</h3>
                <div className="space-y-6 relative z-10">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Rendement Vente Mensuel</span>
                      <span className="text-[10px] font-black bg-white/20 px-2 py-0.5 rounded">75%</span>
                    </div>
                    <div className="h-2 w-full bg-white/20 rounded-full overflow-hidden">
                      <div className="h-full w-3/4 bg-white rounded-full"></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Acquisition Coopératives</span>
                      <span className="text-[10px] font-black bg-white/20 px-2 py-0.5 rounded">90%</span>
                    </div>
                    <div className="h-2 w-full bg-white/20 rounded-full overflow-hidden">
                      <div className="h-full w-[90%] bg-emerald-400 rounded-full"></div>
                    </div>
                  </div>
                  <p className="text-[11px] font-medium opacity-85 leading-relaxed italic">
                    "La croissance de nos solutions d'agro-élevage passe par l'adhésion de grands groupements économiques en RDC."
                  </p>
                </div>
                <div className="absolute top-0 right-0 -mr-12 -mt-12 w-48 h-48 bg-white/10 rounded-full blur-3xl"></div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-850 p-8 shadow-sm">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center justify-between">
                  Prospection grands comptes <Target size={16} className="text-rose-500 animate-bounce" />
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <div className="w-8 h-8 bg-blue-100 dark:bg-blue-500/10 text-blue-600 rounded-lg flex items-center justify-center shrink-0">
                      <Users size={15} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white uppercase line-clamp-1">Coopérative Elikya</p>
                      <p className="text-[10px] text-slate-500 font-medium">Contrat d'engrais B2B • En attente validation</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <div className="w-8 h-8 bg-amber-100 dark:bg-amber-500/10 text-amber-600 rounded-lg flex items-center justify-center shrink-0">
                      <ShoppingCart size={15} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white uppercase line-clamp-1">Minoteries du Katanga</p>
                      <p className="text-[10px] text-slate-500 font-medium">Évaluation d'échantillons Maïs G1</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================================== TAB 2 ==================================== */}
        {activeTab === 'commandes' && (
          <div className="space-y-6">
            {/* Search and Filters */}
            <div className="flex flex-col md:flex-row gap-4 bg-white dark:bg-slate-900 p-4 rounded-[2rem] border border-slate-100 dark:border-slate-850 shadow-sm">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-3.5 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Rechercher par commande, Client ou Matricule..."
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/50 border-none rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
              <div className="flex gap-2 shrink-0">
                <div className="relative">
                  <select
                    value={orderStatusFilter}
                    onChange={(e) => setOrderStatusFilter(e.target.value)}
                    className="pl-4 pr-10 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-300 appearance-none cursor-pointer"
                  >
                    <option value="all">Tous les Statuts</option>
                    <option value="pending">En attente (Pending)</option>
                    <option value="processing">Traitement (Processing)</option>
                    <option value="shipped">Expédié (Shipped)</option>
                    <option value="delivered">Livré (Delivered)</option>
                    <option value="cancelled">Annulé</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-4 text-slate-400 pointer-events-none" size={14} />
                </div>
              </div>
            </div>

            {/* Orders Table Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-850 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/10 border-b border-slate-100 dark:border-slate-800">
                          <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">ID Commande</th>
                          <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Client</th>
                          <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Montant Total</th>
                          <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Statut Commande</th>
                          <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Paiement</th>
                          <th className="px-6 py-4 text-[10px] font-black text-slate-400 tracking-wider"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                        {filteredOrders.map(order => (
                          <tr key={order.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                            <td className="px-6 py-4 font-mono font-bold text-xs text-slate-900 dark:text-white">
                              #{order.id}
                            </td>
                            <td className="px-6 py-4">
                              <p className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase line-clamp-1">
                                {(order as any).clientName || "Client Riberjo"}
                              </p>
                              <p className="text-[9px] text-slate-400 font-bold">{order.clientId}</p>
                            </td>
                            <td className="px-6 py-4 text-right font-black text-xs text-slate-900 dark:text-white">
                              ${order.total?.toFixed(2)}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className={`inline-block px-3 py-1 text-[9px] font-black uppercase tracking-wider rounded-lg border ${
                                order.status === 'delivered' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 border-emerald-100 dark:border-emerald-900/30' :
                                order.status === 'processing' ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 border-blue-100 dark:border-blue-900/30' :
                                order.status === 'shipped' ? 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 border-purple-100 dark:border-purple-900/30' :
                                order.status === 'cancelled' ? 'bg-red-50 dark:bg-red-500/10 text-red-600 border-red-100 dark:border-red-900/30' :
                                'bg-amber-50 dark:bg-amber-500/10 text-amber-600 border-amber-100 dark:border-amber-900/30'
                              }`}>
                                {order.status === 'pending' ? 'Attente' : 
                                 order.status === 'processing' ? 'Traitée' : 
                                 order.status === 'shipped' ? 'Expédiée' : 
                                 order.status === 'delivered' ? 'Livrée' : 'Annulée'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className={`inline-block px-3 py-1 text-[9px] font-black uppercase tracking-wider rounded-lg border ${
                                order.paymentStatus === 'paid' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-400/20' : 'bg-rose-500/10 text-rose-600 border-rose-400/20'
                              }`}>
                                {order.paymentStatus === 'paid' ? 'Payé' : 'Impayé'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button
                                onClick={() => setSelectedOrder(order)}
                                className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg transition-colors"
                              >
                                <Eye size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {filteredOrders.length === 0 && (
                      <div className="py-20 text-center flex flex-col items-center gap-2">
                        <ShoppingBag className="text-slate-200 dark:text-slate-800" size={48} />
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Aucune commande trouvée</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Order validation details Panel */}
              <div className="lg:col-span-1">
                {selectedOrder ? (
                  <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-850 p-6 shadow-sm space-y-6 sticky top-6">
                    <div className="flex justify-between items-center">
                      <h3 className="font-mono text-sm font-black text-slate-800 dark:text-white">Détail Commande #{selectedOrder.id}</h3>
                      <button onClick={() => setSelectedOrder(null)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400">
                        <X size={16} />
                      </button>
                    </div>

                    <div className="space-y-4">
                      {/* Client info */}
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Client Propriétaire :</p>
                        <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">{(selectedOrder as any).clientName || "Client Riberjo"}</p>
                        <p className="text-[10px] font-mono text-slate-500 font-bold">{selectedOrder.clientId}</p>
                      </div>

                      {/* Items loop */}
                      <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Articles Commandés :</p>
                        <div className="space-y-3">
                          {selectedOrder.items?.map((item, idx) => (
                            <div key={idx} className="flex justify-between text-xs">
                              <div>
                                <p className="font-bold text-slate-900 dark:text-white uppercase">{item.productName}</p>
                                <p className="text-[10px] text-slate-500">{item.quantity} x ${item.price}</p>
                              </div>
                              <span className="font-bold text-slate-850 dark:text-slate-200">${(item.quantity * item.price).toFixed(2)}</span>
                            </div>
                          ))}
                          <div className="border-t border-slate-200/50 dark:border-slate-700/50 pt-3 flex justify-between items-center text-xs">
                            <span className="font-black uppercase text-[10px] text-slate-400 tracking-wider">Total :</span>
                            <span className="text-sm font-black text-emerald-600">${selectedOrder.total?.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Info lines */}
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-400 font-medium">Adresse Livraison:</span>
                          <span className="font-bold text-slate-700 dark:text-slate-300 max-w-[150px] truncate text-right" title={selectedOrder.deliveryAddress}>
                            {selectedOrder.deliveryAddress || "N/A"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400 font-medium">Mode Règlement:</span>
                          <span className="font-bold text-slate-700 dark:text-slate-300 uppercase">{selectedOrder.paymentMethod || "Non spécifié"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400 font-medium">Création:</span>
                          <span className="font-bold text-slate-700 dark:text-slate-300 font-mono">
                            {new Date(selectedOrder.createdAt).toLocaleDateString('fr-FR')}
                          </span>
                        </div>
                      </div>

                      {/* Validation & Processing Action triggers */}
                      <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Actions Administrateur :</p>

                        <div className="grid grid-cols-2 gap-2">
                          {selectedOrder.status === 'pending' && (
                            <button
                              onClick={() => updateOrderStatus(selectedOrder.id, 'processing')}
                              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider"
                            >
                              <Check size={12} /> Traiter
                            </button>
                          )}
                          {selectedOrder.status === 'processing' && (
                            <button
                              onClick={() => updateOrderStatus(selectedOrder.id, 'shipped')}
                              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider"
                            >
                              <CheckCircle2 size={12} /> Expédier
                            </button>
                          )}
                          {selectedOrder.status === 'shipped' && (
                            <button
                              onClick={() => updateOrderStatus(selectedOrder.id, 'delivered')}
                              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider"
                            >
                              <CheckCircle2 size={12} /> Livrer
                            </button>
                          )}
                          {(selectedOrder.status === 'pending' || selectedOrder.status === 'processing') && (
                            <button
                              onClick={() => updateOrderStatus(selectedOrder.id, 'cancelled')}
                              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-wider"
                            >
                              <Ban size={12} /> Annuler
                            </button>
                          )}
                        </div>

                        <button
                          onClick={() => toggleOrderPayment(selectedOrder.id, selectedOrder.paymentStatus)}
                          className={`w-full flex items-center justify-center gap-1.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-200 dark:border-slate-700 mt-2`}
                        >
                          <CreditCard size={12} /> 
                          {selectedOrder.paymentStatus === 'paid' ? "Marquer NON PAYÉ" : "Valider Encaissement (PAYÉ)"}
                        </button>

                        <button
                          onClick={() => downloadOrderInvoicePDF(selectedOrder)}
                          className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest mt-2 border-none transition-all shadow-md"
                        >
                          <FileText size={12} /> Télécharger la Facture PDF
                        </button>

                        <button
                          onClick={() => handleDeleteOrder(selectedOrder.id)}
                          className="w-full flex items-center justify-center gap-1.5 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/15 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-transparent mt-4"
                        >
                          <Trash2 size={12} /> Supprimer commande
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-50 dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-10 text-center text-slate-400">
                    <FileText size={36} className="mx-auto mb-4 text-slate-300" />
                    <p className="text-xs font-black uppercase tracking-wider">Détails d'administration</p>
                    <p className="text-[10px] mt-1">Sélectionnez une commande à gauche pour examiner l'adresse, les articles et coordonner la logistique de livraison.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================================== TAB 3 ==================================== */}
        {activeTab === 'clients' && (
          <div className="space-y-6">
            {/* Search and Filter Blocks */}
            <div className="flex flex-col md:flex-row gap-4 bg-white dark:bg-slate-900 p-4 rounded-[2rem] border border-slate-100 dark:border-slate-850 shadow-sm">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-3.5 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Rechercher par nom, code de carte, email ou téléphone..."
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/50 border-none rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="relative">
                  <select
                    value={clientTypeFilter}
                    onChange={(e) => setClientTypeFilter(e.target.value)}
                    className="pl-4 pr-10 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-300 appearance-none cursor-pointer"
                  >
                    <option value="all">Type Client (Tous)</option>
                    <option value="STANDARD">Standard</option>
                    <option value="PREMIUM">Premium</option>
                    <option value="PARTNER">Partenaire</option>
                    <option value="COOPERATIVE">Coopérative</option>
                    <option value="PARENT">Parent d'élève</option>
                    <option value="PATIENT">Patient Médical</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-4 text-slate-400 pointer-events-none" size={14} />
                </div>

                <div className="relative">
                  <select
                    value={clientStatusFilter}
                    onChange={(e) => setClientStatusFilter(e.target.value)}
                    className="pl-4 pr-10 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-300 appearance-none cursor-pointer"
                  >
                    <option value="all">Compte (Tous)</option>
                    <option value="active">Actif</option>
                    <option value="pending">En attente</option>
                    <option value="suspended">Suspendu</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-4 text-slate-400 pointer-events-none" size={14} />
                </div>
              </div>
            </div>

            {/* Client tables split */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-850 shadow-sm overflow-hidden animate-in fade-in duration-300">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/10 border-b border-slate-100 dark:border-slate-800">
                          <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Matricule Client</th>
                          <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nom Complet</th>
                          <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Type / Profil</th>
                          <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">État ERP</th>
                          <th className="px-6 py-4 text-[10px] font-black text-slate-400 tracking-wider"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                        {filteredClients.map(clt => (
                          <tr key={clt.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                            <td className="px-6 py-4 text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                              {clt.id}
                            </td>
                            <td className="px-6 py-4">
                              <p className="text-xs font-black text-slate-900 dark:text-white uppercase">{clt.fullName}</p>
                              <div className="flex items-center gap-2 text-[9px] text-slate-400 font-bold">
                                {clt.phone && <span className="flex items-center gap-1"><Phone size={8} /> {clt.phone}</span>}
                                {clt.email && <span className="flex items-center gap-1"><Mail size={8} /> {clt.email}</span>}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-[9px] font-black uppercase tracking-wider bg-blue-500/10 text-blue-500 dark:text-blue-400 px-2 py-0.5 rounded-md border border-blue-500/10">
                                {clt.type}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className={`inline-block px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-md border ${
                                clt.status === 'active' 
                                  ? 'bg-emerald-500/10 border-emerald-400/20 text-emerald-600 dark:text-emerald-400' 
                                  : 'bg-rose-500/10 border-rose-400/20 text-rose-500'
                              }`}>
                                {clt.status === 'active' ? 'ACTIF' : clt.status === 'suspended' ? 'SUSPENDU' : 'ATTENTE'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button
                                onClick={() => setSelectedClient(clt)}
                                className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 text-slate-600 dark:text-slate-300 rounded-lg transition-colors"
                              >
                                <Eye size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {filteredClients.length === 0 && (
                      <div className="py-20 text-center flex flex-col items-center gap-2">
                        <Users className="text-slate-200 dark:text-slate-800" size={48} />
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Aucun client enregistré</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Client detailed overlay */}
              <div className="lg:col-span-1">
                {selectedClient ? (
                  <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-850 p-6 shadow-sm space-y-6 sticky top-6">
                    <div className="flex justify-between items-center">
                      <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Dossier Client</h3>
                      <button onClick={() => setSelectedClient(null)} className="p-1 hover:bg-slate-105 dark:hover:bg-slate-800 rounded-lg text-slate-400 border-none bg-transparent">
                        <X size={15} />
                      </button>
                    </div>

                    {/* Member physical Card Mockup representation */}
                    <div className="bg-gradient-to-r from-emerald-800 to-emerald-950 p-5 rounded-[2rem] text-white flex flex-col justify-between shadow-2xl min-h-[160px] relative overflow-hidden border border-emerald-500/20">
                      <div className="flex justify-between items-start relative z-10">
                        <div>
                          <p className="text-[10px] font-black tracking-widest opacity-80 uppercase">RIBERJO GLOBAL</p>
                          <p className="text-[6px] font-mono tracking-wider opacity-60">MEMBRE PRIVILÉGIÉ</p>
                        </div>
                        <div className="bg-white/10 p-1.5 rounded-lg border border-white/10">
                          <QRCodeCanvas value={selectedClient.qrCode} size={30} />
                        </div>
                      </div>

                      <div className="pt-4 relative z-10">
                        <p className="text-xs font-black uppercase tracking-wide truncate">{selectedClient.fullName}</p>
                        <div className="flex justify-between items-end mt-2">
                          <div>
                            <p className="text-[7px] font-mono text-white/50">MATRICULE CLIENT</p>
                            <p className="text-[10px] font-mono font-bold tracking-tight text-emerald-400">{selectedClient.id}</p>
                          </div>
                          <span className="text-[8px] font-bold uppercase tracking-wider bg-white/15 px-2 py-0.5 rounded">
                            {selectedClient.type}
                          </span>
                        </div>
                      </div>
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>
                    </div>

                    {/* Card Actions */}
                    <button
                      onClick={() => downloadClientCardPDF(selectedClient)}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md hover:shadow-emerald-600/10 transition-all border-none"
                    >
                      <Printer size={13} /> Exporter Carte en PDF
                    </button>

                    <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-4">
                      {/* Form Details */}
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-400 font-medium">Téléphone:</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{selectedClient.phone || "N/A"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400 font-medium">Email:</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200 lowercase">{selectedClient.email || "N/A"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400 font-medium">Région/Adresse:</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[150px]">{selectedClient.address || "N/A"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400 font-medium">Nation / Civil:</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{selectedClient.nationality} ({selectedClient.gender})</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400 font-medium">Secteur:</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200 uppercase">{selectedClient.profession || "N/A"}</span>
                        </div>
                        <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-850 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                          <span className="text-slate-400 font-medium flex items-center gap-1"><Lock size={12} /> Mot de passe :</span>
                          <span className="font-mono font-bold text-[10px] text-emerald-600 bg-white dark:bg-slate-900 border px-2 py-0.5 rounded">
                            {selectedClient.email ? `Riberjo${selectedClient.id.split('-').pop()}` : "Riberjo2026!"}
                          </span>
                        </div>
                      </div>

                      {(activeSpace === 'SUPER_USER' || activeSpace === 'ADMIN') && (
                        <>
                          {/* Authorized Services manager checkbox list */}
                          <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center justify-between">
                              <span>Accès & Autorisations :</span>
                              <Shield size={12} className="text-emerald-500" />
                            </p>
                            <div className="space-y-2 text-xs">
                              {[
                                { id: 'agriculture', name: 'Agriculture & Élevage' },
                                { id: 'sante', name: 'Santé, Clinique & Soins' },
                                { id: 'education', name: 'Éducation & Formation' },
                                { id: 'commerce', name: 'Commerce & Boutique' },
                                { id: 'logistique', name: 'Logistique & Transit' }
                              ].map(srv => {
                                const isAuthorized = selectedClient.serviceAuthorizations?.includes(srv.id);
                                return (
                                  <label key={srv.id} className="flex items-center gap-2 cursor-pointer py-1.5 hover:bg-slate-100/30 rounded px-1 transition-colors">
                                    <input
                                      type="checkbox"
                                      checked={isAuthorized || false}
                                      onChange={() => handleToggleService(srv.id)}
                                      className="rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 w-4 h-4 cursor-pointer"
                                    />
                                    <span className={`font-semibold ${isAuthorized ? 'text-slate-900 dark:text-white' : 'text-slate-400 line-through'}`}>
                                      {srv.name}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>

                          {/* Director modifications actions */}
                          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Gérer l'accès :</p>
                            
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleClientStatusChange(selectedClient.id, selectedClient.status)}
                                className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border ${
                                  selectedClient.status === 'active' 
                                    ? 'bg-rose-50 border-rose-100 hover:bg-rose-100 text-rose-600' 
                                    : 'bg-emerald-50 border-emerald-100 hover:bg-emerald-100 text-emerald-600'
                                }`}
                              >
                                {selectedClient.status === 'active' ? "Suspendre l'accès" : "Réactiver le client"}
                              </button>
                              
                              <button
                                onClick={() => handleDeleteClient(selectedClient.id)}
                                className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl transition-all border border-transparent"
                                title="Supprimer définitivement"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-50 dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-10 text-center text-slate-400">
                    <Users size={36} className="mx-auto mb-4 text-slate-300" />
                    <p className="text-xs font-black uppercase tracking-wider">Administration du Portefeuille</p>
                    <p className="text-[10px] mt-1">Cliquez sur un client pour afficher sa carte d'identité, exporter la fiche d'inscription ou modifier les accès aux modules sectoriels de RIBERJO.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================================= */}
      {/* ADD SALE MODAL */}
      <AnimatePresence>
        {showAddSaleModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setShowAddSaleModal(false)} />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] p-8 relative z-10 shadow-2xl"
            >
              <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-6">Enregistrer une Vente Directe</h2>
              
              <form onSubmit={handleAddSale} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nom du Produit</label>
                  <input 
                    type="text"
                    required
                    placeholder="ex: Engrais Bio Premium, Maïs"
                    value={newSale.productName}
                    onChange={(e) => setNewSale({...newSale, productName: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nom du Client</label>
                  <input 
                    type="text"
                    required
                    placeholder="ex: Coopérative de Goma, Dr Marc"
                    value={newSale.clientName}
                    onChange={(e) => setNewSale({...newSale, clientName: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Quantité</label>
                    <input 
                      type="text"
                      required
                      placeholder="ex: 5 ou 1.5"
                      value={newSale.quantity}
                      onChange={(e) => setNewSale({...newSale, quantity: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Prix Unitaire ($)</label>
                    <input 
                      type="text"
                      required
                      placeholder="ex: 15 ou 0.5"
                      value={newSale.price}
                      onChange={(e) => setNewSale({...newSale, price: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Réduction ($) <span className="text-emerald-500 font-extrabold">(Optionnel)</span></label>
                  <input 
                    type="text"
                    placeholder="ex: 2.50 ou 0"
                    value={newSale.discount}
                    onChange={(e) => setNewSale({...newSale, discount: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                  />
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl flex justify-between items-center mt-4">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Transaction :</span>
                  <span className="text-xl font-black text-rose-600">
                    ${(() => {
                      const q = parseFloat(String(newSale.quantity).replace(',', '.'));
                      const p = parseFloat(String(newSale.price).replace(',', '.'));
                      const d = parseFloat(String(newSale.discount || '0').replace(',', '.'));
                      const qty = isNaN(q) ? 0 : q;
                      const prc = isNaN(p) ? 0 : p;
                      const dsc = isNaN(d) ? 0 : d;
                      return Math.max(0, (qty * prc) - dsc).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    })()}
                  </span>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button" 
                    onClick={() => setShowAddSaleModal(false)}
                    className="flex-1 px-6 py-4 border border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 id-cancel-btn font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all font-sans"
                  >
                    Annuler
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-6 py-4 bg-rose-600 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-rose-700 transition-all shadow-lg shadow-rose-600/20 border-none"
                  >
                    Enregistrer Vente
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================================= */}
      {/* MANUAL ORDER MODAL */}
      <AnimatePresence>
        {showAddOrderModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setShowAddOrderModal(false)} />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] p-8 relative z-10 shadow-2xl"
            >
              <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-4">Saisir une commande Client</h2>
              <p className="text-slate-400 text-xs mb-6">Utilisez ce formulaire pour enregistrer les commandes reçues manuellement (par WhatsApp ou téléphone).</p>

              <form onSubmit={handleManualOrderSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Sélectionner le Client</label>
                  <select
                    required
                    value={manualOrder.clientId}
                    onChange={(e) => setManualOrder({...manualOrder, clientId: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="">Sélectionner un client...</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.fullName} ({c.id})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Produit de notre Catalogue</label>
                  <select
                    value={manualOrder.productSelection}
                    onChange={(e) => setManualOrder({...manualOrder, productSelection: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                    {sampleProducts.map((p, idx) => (
                      <option key={idx} value={p.name}>{p.name} - ${p.price}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Quantité commandée</label>
                    <input 
                      type="number"
                      required
                      min="1"
                      value={manualOrder.quantity}
                      onChange={(e) => setManualOrder({...manualOrder, quantity: parseInt(e.target.value) || 1})}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Prix de vente unitaire ($)</label>
                    <input 
                      type="number"
                      required
                      value={manualOrder.unitPrice}
                      onChange={(e) => setManualOrder({...manualOrder, unitPrice: parseFloat(e.target.value) || 0})}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Adresse de livraison</label>
                  <input 
                    type="text"
                    placeholder="Laisser vide pour retrait en agence"
                    value={manualOrder.deliveryAddress}
                    onChange={(e) => setManualOrder({...manualOrder, deliveryAddress: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Méthode de paiement</label>
                  <select
                    value={manualOrder.paymentMethod}
                    onChange={(e) => setManualOrder({...manualOrder, paymentMethod: e.target.value as any})}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="manual">Cash / Guichet</option>
                    <option value="mobile_money">Mobile Money (Airtel, M-Pesa, Orange)</option>
                    <option value="bank_transfer">Virement Bancaire</option>
                  </select>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl flex justify-between items-center mt-4">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Facturé :</span>
                  <span className="text-xl font-black text-emerald-600">${(manualOrder.quantity * manualOrder.unitPrice).toFixed(2)}</span>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button" 
                    onClick={() => setShowAddOrderModal(false)}
                    className="flex-1 px-6 py-4 border border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all font-sans"
                  >
                    Annuler
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-6 py-4 bg-emerald-600 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-emerald-700 transition-all shadow-lg border-none animate-pulse"
                  >
                    Valider la commande
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ADD CLIENT MODAL REMOVED FOR SECURITY & ROLE COHERENCE */}
    </div>
  );
}
