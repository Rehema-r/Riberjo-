import React, { useState, useEffect } from "react";
import { db, handleFirestoreError, OperationType, getDocSafe } from "../lib/firebase";
import {
  collection,
  query,
  getDocs,
  addDoc,
  setDoc,
  doc,
  orderBy,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { UserProfile, Department, RolePermission } from "../types";
import {
  UserPlus,
  Search,
  Filter,
  MoreVertical,
  X,
  Check,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Download,
  Trash2,
  IdCard,
  Printer,
  Shield,
  FileText,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "../contexts/AuthContext";
import {
  DEPARTMENTS,
  SERVICES_LIST,
  generateMatricule,
  SERVICE_CODES,
  generatePassword,
  generateClientId,
  generateClientPassword,
} from "../constants";
import { QRCodeCanvas } from "qrcode.react";
import { jsPDF } from "jspdf";
import * as XLSX from "xlsx";

import { notificationService } from "../services/notificationService";

export default function Users({ initialActiveTab }: { initialActiveTab?: string }) {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<RolePermission[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeRoleTab, setActiveRoleTab] = useState<string>(initialActiveTab || "all");

  useEffect(() => {
    if (initialActiveTab) {
      setActiveRoleTab(initialActiveTab);
    }
  }, [initialActiveTab]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [isDetailedView, setIsDetailedView] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [editData, setEditData] = useState<Partial<UserProfile>>({});
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [tempRole, setTempRole] = useState<string>("");
  const [tempDept, setTempDept] = useState<string>("");
  const [showToast, setShowToast] = useState<{
    show: boolean;
    message: string;
  }>({ show: false, message: "" });
  const [creationSuccess, setCreationSuccess] = useState<{
    matricule: string;
    password: string;
  } | null>(null);
  const [showCard, setShowCard] = useState<UserProfile | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    userId: string;
    fullName: string;
  } | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    address: "",
    phone: "",
    recruitmentYear: "2026",
    serviceId: "",
    departmentId: "",
    role: "USER" as any,
    baseSalary: 150,
    password: "",
  });

  const canAddWorker =
    profile?.role === "SUPER_ADMIN" ||
    (profile?.role === "ADMIN" &&
      (profile?.departmentId === "03" || profile?.departmentId === "all"));

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const usersPath = "users";
      const usersSnap = await getDocs(
        query(collection(db, usersPath), orderBy("fullName")),
      ).catch((err) => {
        handleFirestoreError(err, OperationType.LIST, usersPath);
        return { docs: [] } as any;
      });
      setUsers(
        usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as UserProfile),
      );

      const deptsPath = "departments";
      const deptsSnap = await getDocs(collection(db, deptsPath)).catch(
        (err) => {
          handleFirestoreError(err, OperationType.LIST, deptsPath);
          return { docs: [] } as any;
        },
      );
      setDepartments(
        deptsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Department),
      );

      const rolesSnap = await getDocs(collection(db, "role_permissions"));
      if (!rolesSnap.empty) {
        setRoles(rolesSnap.docs.map((d) => d.data() as RolePermission));
      }

      const settingsSnap = await getDocSafe(doc(db, "settings", "global"));
      if (settingsSnap.exists()) {
        setSettings(settingsSnap.data());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const yearStr = formData.recruitmentYear || "2026";
      const yearNum = parseInt(yearStr.slice(-2));
      
      let matricule = "";
      let generatedPass = "";
      
      const customPassword = formData.password ? formData.password.trim() : "";
      
      if (formData.role === "CLIENT") {
        const clientCount = users.filter((u) => u.role === "CLIENT").length;
        matricule = generateClientId(clientCount + 1);
        generatedPass = customPassword || generateClientPassword();
      } else {
        matricule = generateMatricule(
          yearNum,
          formData.role,
          formData.departmentId,
          users.length + 1,
        );
        generatedPass = customPassword || generatePassword(formData.fullName, yearStr);
      }

      const newUser = {
        ...formData,
        matricule,
        password: generatedPass,
        status: "active",
        createdAt: Date.now(),
        passwordChanged: !!customPassword,
        ...(formData.role === "CLIENT" ? { departmentId: "CLIENT", serviceId: "CLIENT" } : {})
      };

      const sanitizedId = matricule.replace(/\//g, "_");
      await setDoc(doc(db, "users", sanitizedId), newUser);

      // If it's a CLIENT, write also to the 'clients' collection with default configurations
      if (formData.role === "CLIENT") {
        const clientProfile = {
          id: sanitizedId,
          fullName: formData.fullName,
          phone: formData.phone || "000000000",
          email: formData.email,
          address: formData.address || "Adresse Non Spécifiée",
          gender: "M",
          profession: "Client",
          nationality: "Congolaise (RDC)",
          type: "STANDARD",
          qrCode: `${window.location.origin}/verify/${matricule}`,
          registrationDate: Date.now(),
          status: "active",
          passwordChanged: !!customPassword,
          referenceNumber: matricule,
          serviceAuthorizations: ['agriculture', 'sante', 'education', 'commerce', 'logistique', 'assistance']
        };
        await setDoc(doc(db, "clients", sanitizedId), clientProfile);
      }

      // Notify the new agent (simulated as we don't have their auth yet, but for history)
      await notificationService.notify(
        sanitizedId,
        "Bienvenue chez RIBERJO",
        `Votre compte a été créé avec succès. Bienvenue dans l'équipe !`,
        "info",
      );

      setIsModalOpen(false);
      setCreationSuccess({ matricule, password: generatedPass });
      
      // Clean and reset form
      setFormData({
        fullName: "",
        email: "",
        address: "",
        phone: "",
        recruitmentYear: "2026",
        serviceId: "",
        departmentId: "",
        role: "USER" as any,
        baseSalary: 150,
        password: "",
      });
      
      fetchData();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "users");
      setShowToast({ show: true, message: "Erreur lors de la création de l'utilisateur." });
      setTimeout(() => setShowToast({ show: false, message: "" }), 3000);
    }
  };

  const handleRoleChange = async (userId: string, newRole: any) => {
    setIsUpdating(userId);
    try {
      await updateDoc(doc(db, "users", userId), {
        role: newRole,
      });

      await notificationService.notify(
        userId,
        "Rôle Mis à Jour",
        `Votre rôle a été modifié en : ${newRole.replace("_", " ")}`,
        "critical",
      );

      setShowToast({ show: true, message: "Rôle mis à jour avec succès" });
      setTimeout(() => setShowToast({ show: false, message: "" }), 3000);
      fetchData();
    } catch (err) {
      console.error(err);
      setShowToast({ show: true, message: "Erreur lors du changement de rôle." });
      setTimeout(() => setShowToast({ show: false, message: "" }), 3000);
    } finally {
      setIsUpdating(null);
    }
  };

  const handleDeptChange = async (userId: string, newDept: string) => {
    setIsUpdating(userId);
    try {
      await updateDoc(doc(db, "users", userId), {
        departmentId: newDept,
      });

      await notificationService.notify(
        userId,
        "Mutation de Département",
        `Vous avez été affecté au département : ${DEPARTMENTS.find((d) => d.id === newDept)?.name || newDept}`,
        "info",
      );

      setShowToast({
        show: true,
        message: "Département mis à jour avec succès",
      });
      setTimeout(() => setShowToast({ show: false, message: "" }), 3000);
      fetchData();
    } catch (err) {
      console.error(err);
      setShowToast({ show: true, message: "Erreur lors du changement de département." });
      setTimeout(() => setShowToast({ show: false, message: "" }), 3000);
    } finally {
      setIsUpdating(null);
    }
  };

  const handleStatusChange = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "suspended" : "active";
    setIsUpdating(userId);
    try {
      await updateDoc(doc(db, "users", userId), {
        status: newStatus,
      });
      fetchData();
    } catch (err) {
      console.error(err);
      setShowToast({ show: true, message: "Erreur lors du changement de statut." });
      setTimeout(() => setShowToast({ show: false, message: "" }), 3000);
    } finally {
      setIsUpdating(null);
    }
  };

  const handleUpdateDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setIsUpdating(selectedUser.id);
    try {
      await updateDoc(doc(db, "users", selectedUser.id), editData);
      setIsDetailModalOpen(false);
      fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdating(null);
    }
  };

  const openDetailModal = (user: UserProfile) => {
    setSelectedUser(user);
    setEditData({
      fullName: user.fullName,
      phone: user.phone || "",
      address: user.address || "",
      recruitmentYear: user.recruitmentYear || "",
      status: user.status,
      role: user.role,
      departmentId: user.departmentId,
      serviceId: user.serviceId || "",
      baseSalary: user.baseSalary || 150,
      password: user.password || "",
    });
    setIsDetailModalOpen(true);
  };

  const handleDeleteUser = (userId: string, fullName: string) => {
    setDeleteConfirmation({ userId, fullName });
  };

  const confirmDeleteUser = async () => {
    if (!deleteConfirmation) return;
    const { userId } = deleteConfirmation;
    setIsUpdating(userId);
    try {
      await deleteDoc(doc(db, "users", userId));
      setDeleteConfirmation(null);
      setShowToast({ show: true, message: "Utilisateur supprimé avec succès" });
      setTimeout(() => setShowToast({ show: false, message: "" }), 3000);
      fetchData();
    } catch (err) {
      console.error(err);
      setShowToast({ show: true, message: "Erreur lors de la suppression de l'utilisateur." });
      setTimeout(() => setShowToast({ show: false, message: "" }), 3000);
    } finally {
      setIsUpdating(null);
    }
  };

  const handlePrintCard = async (user: UserProfile) => {
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: [85.6, 54], // CR80 standard credit card size
    });

    // Get QR Code Data URL from the canvas in the preview modal
    const qrCanvas = document.querySelector(
      "#id-card-riberjo canvas",
    ) as HTMLCanvasElement;
    const qrDataUrl = qrCanvas?.toDataURL("image/png");

    // Background Color
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(0, 0, 85.6, 54, 3, 3, "F");

    // Top Bar
    doc.setFillColor(5, 122, 85); // emerald-700
    doc.rect(0, 0, 85.6, 12, "F");

    // Header Text
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("RIBERJO GLOBAL SERVICE", 5, 7);
    doc.setFontSize(6);
    doc.text("CARTE DE TRAVAIL OFFICIELLE", 55, 7);

    // Profile Photo
    if (user.avatarUrl) {
      try {
        doc.addImage(user.avatarUrl, "JPEG", 5, 17, 20, 20);
      } catch (e) {
        doc.setDrawColor(240, 240, 240);
        doc.setFillColor(245, 245, 245);
        doc.roundedRect(5, 17, 20, 20, 2, 2, "FD");
        doc.setTextColor(200, 200, 200);
        doc.setFontSize(18);
        doc.text(user.fullName.charAt(0), 15, 30, { align: "center" });
      }
    } else {
      doc.setDrawColor(240, 240, 240);
      doc.setFillColor(245, 245, 245);
      doc.roundedRect(5, 17, 20, 20, 2, 2, "FD");
      doc.setTextColor(200, 200, 200);
      doc.setFontSize(18);
      doc.text(user.fullName.charAt(0), 15, 30, { align: "center" });
    }

    // Details logic
    doc.setTextColor(30, 41, 59); // slate-800
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(user.fullName.toUpperCase(), 30, 22);

    doc.setTextColor(16, 185, 129); // emerald-500
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text(user.role.replace("_", " "), 30, 26);

    doc.setTextColor(148, 163, 184); // slate-400
    doc.setFontSize(6);
    doc.setFont("helvetica", "bold");
    doc.text("MATRICULE:", 30, 34);
    doc.text("DEPT:", 30, 38);
    doc.text("RECRUTEMENT:", 30, 42);

    doc.setTextColor(51, 65, 85); // slate-700
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text(user.matricule, 52, 34);
    doc.text(user.departmentId, 52, 38);
    doc.text(user.recruitmentYear || "2026", 52, 42);

    // QR Code
    if (qrDataUrl) {
      doc.addImage(qrDataUrl, "PNG", 65, 17, 15, 15);
    }

    // Footer
    doc.setFillColor(16, 185, 129);
    doc.rect(0, 52, 85.6, 2, "F");

    doc.save(`Carte_Service_${user.matricule.replace(/\//g, "_")}.pdf`);
  };

  const filteredUsers = users.filter(
    (u) =>
      ((u.fullName || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
      (u.matricule || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
      (u.email || '').toLowerCase().includes((searchTerm || '').toLowerCase())) &&
      (activeRoleTab === "all" || u.role === activeRoleTab),
  );

  const exportToCSV = () => {
    const headers = [
      "Matricule",
      "Nom Complet",
      "Email",
      "Role",
      "Departement",
      "Statut",
      "Telephone",
      "Adresse",
      "Annee Recrutement",
    ];
    const data = filteredUsers.map((u) => [
      u.matricule,
      u.fullName,
      u.email,
      u.role,
      u.departmentId,
      u.status,
      u.phone || "",
      u.address || "",
      u.recruitmentYear || "",
    ]);

    const csvContent = [
      headers.join(","),
      ...data.map((row) =>
        row
          .map((cell) => {
            const val =
              cell !== null && cell !== undefined ? cell.toString() : "";
            return `"${val.replace(/"/g, '""')}"`;
          })
          .join(","),
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `liste_utilisateurs_riberjo_${new Date().toISOString().split("T")[0]}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToExcel = () => {
    if (filteredUsers.length === 0) {
      setShowToast({ show: true, message: "Aucune donnée à exporter." });
      setTimeout(() => setShowToast({ show: false, message: "" }), 3000);
      return;
    }

    // Generate data for Excel with cleaner headers
    const data = filteredUsers.map((u) => ({
      "Matricule Agent": u.matricule,
      "Nom et Prénom": u.fullName.toUpperCase(),
      "Sexe/Genre": (u as any).gender || "N/A",
      "Fonction / Rôle": u.role.replace("_", " "),
      Département:
        DEPARTMENTS.find((d) => d.id === u.departmentId)?.name ||
        u.departmentId,
      "Service / Unité": (() => {
        const matchingService = SERVICES_LIST.find(
          (s) => s.deptId === u.departmentId && s.id === u.serviceId,
        );
        if (matchingService) {
          return `${matchingService.name} (${matchingService.id})`;
        }
        return u.serviceId ? `Service ${u.serviceId}` : "Général";
      })(),
      "Email Professionnel": u.email,
      Téléphone: u.phone || "Non renseigné",
      "Adresse de Résidence": u.address || "Non renseignée",
      "Année Recrutement": u.recruitmentYear || "2026",
      "Statut Actuel": u.status === "active" ? "ACTIF" : "SUSPENDU",
      "Salaire de Base ($)": u.baseSalary || 0,
      "Date d'Enregistrement": new Date(u.createdAt).toLocaleDateString(
        "fr-FR",
      ),
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "REGISTRE_RIBERJO");

    // Add Auto-filter to header row
    if (worksheet["!ref"]) {
      const range = XLSX.utils.decode_range(worksheet["!ref"]);
      worksheet["!autofilter"] = { ref: XLSX.utils.encode_range(range) };
    }

    // Advanced Auto-size columns with safety limits
    const colWidths = Object.keys(data[0] || {}).map((key) => {
      const headerLen = key.length;
      const dataLen = Math.max(
        ...data.map((obj) => {
          const val = obj[key as keyof typeof obj];
          return val ? val.toString().length : 0;
        }),
      );
      return { wch: Math.min(Math.max(headerLen, dataLen) + 5, 60) };
    });
    worksheet["!cols"] = colWidths;

    // Export with a formal name
    const timestamp = new Date().toISOString().split("T")[0];
    XLSX.writeFile(workbook, `REGISTRE_MEMBRES_RIBERJO_${timestamp}.xlsx`);
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            {profile?.role === "SUPER_ADMIN"
              ? "Registre Général des Membres"
              : "Gestion des Travailleurs"}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            {profile?.role === "SUPER_ADMIN"
              ? "Consultez et exportez la liste complète des directeurs, techniciens et travailleurs."
              : "Administrez l'ensemble des collaborateurs de RIBERJO."}
          </p>
        </div>
        <div className="flex gap-3">
          {profile?.role === "SUPER_ADMIN" && (
            <button
              onClick={exportToExcel}
              className="flex items-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-3 rounded-2xl font-bold hover:brightness-110 transition-all shadow-lg"
            >
              <FileText size={20} />
              Exporter Liste Excel
            </button>
          )}
          {canAddWorker && (
            <button
              onClick={() => {
                const defaultRole = activeRoleTab === "all" ? "USER" : (activeRoleTab as any);
                const defaultDept = defaultRole === "BOARD_MEMBER" ? "all" : "";
                const defaultService = defaultRole === "BOARD_MEMBER" ? "all" : "";
                setFormData({
                  fullName: "",
                  email: "",
                  address: "",
                  phone: "",
                  recruitmentYear: "2026",
                  serviceId: defaultService,
                  departmentId: defaultDept,
                  role: defaultRole,
                  baseSalary: 150,
                  password: "",
                });
                setIsModalOpen(true);
              }}
              className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 dark:shadow-none"
            >
              <UserPlus size={20} />
              {activeRoleTab === "BOARD_MEMBER" ? "Ajouter membre CA" : "Ajouter un membre"}
            </button>
          )}
        </div>
      </div>

      {profile?.role === "SUPER_ADMIN" && (
        <div className="flex flex-wrap gap-2 mb-8 bg-slate-100/50 dark:bg-slate-800/40 p-1.5 rounded-2xl border border-slate-200/50 dark:border-slate-800 select-none">
          {[
            { id: "all", label: "Tous", count: users.length },
            { id: "BOARD_MEMBER", label: "Conseil d'Administration (CA)", count: users.filter(u => u.role === "BOARD_MEMBER").length },
            { id: "ADMIN", label: "Directeurs", count: users.filter(u => u.role === "ADMIN").length },
            { id: "SUPER_USER", label: "Experts", count: users.filter(u => u.role === "SUPER_USER").length },
            { id: "USER", label: "Travailleurs", count: users.filter(u => u.role === "USER").length },
            { id: "CLIENT", label: "Clients", count: users.filter(u => u.role === "CLIENT").length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveRoleTab(tab.id)}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-200 flex items-center gap-2 ${
                activeRoleTab === tab.id
                  ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
              }`}
            >
              {tab.label}
              <span className={`text-[10px] px-2 py-0.5 rounded-md font-black ${
                activeRoleTab === tab.id
                  ? "bg-emerald-500 text-white"
                  : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden mb-12">
        <div className="p-6 border-b border-slate-50 dark:border-slate-800 flex flex-col md:flex-row gap-4 justify-between">
          <div className="relative max-w-md w-full">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
              size={18}
            />
            <input
              type="text"
              placeholder="Rechercher un matricule, nom, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-900 dark:text-white"
            />
          </div>
          <div className="flex gap-2">
            {profile?.role === "SUPER_ADMIN" && (
              <button
                onClick={() => setIsDetailedView(!isDetailedView)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all border ${
                  isDetailedView
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-500/20"
                    : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-100 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
                }`}
              >
                <Shield size={16} />{" "}
                {isDetailedView ? "Vue Étendue ON" : "Vue Étendue OFF"}
              </button>
            )}
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-all border border-slate-100 dark:border-slate-700"
            >
              <Download size={16} /> Exporter
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-all border border-slate-100 dark:border-slate-700">
              <Filter size={16} /> Filtres
            </button>
          </div>
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-separate border-spacing-0">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 first:rounded-tl-3xl last:rounded-tr-3xl border-b border-slate-100 dark:border-slate-800">
                  Collaborateur
                </th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800">
                  Matricule
                </th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800">
                  Département
                </th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800">
                  Rôle
                </th>
                {(profile?.role === "ADMIN" ||
                  profile?.role === "SUPER_ADMIN") && (
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800">
                    Mot de Passe
                  </th>
                )}
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800">
                  Status
                </th>
                {isDetailedView && profile?.role === "SUPER_ADMIN" && (
                  <>
                    <th className="px-6 py-4 hidden lg:table-cell text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800">
                      Téléphone
                    </th>
                    <th className="px-6 py-4 hidden xl:table-cell text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800">
                      Salaire Base
                    </th>
                  </>
                )}
                <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 first:rounded-tl-3xl last:rounded-tr-3xl border-b border-slate-100 dark:border-slate-800">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td
                    colSpan={
                      (profile?.role === "ADMIN" ||
                      profile?.role === "SUPER_ADMIN"
                        ? 7
                        : 6) +
                      (isDetailedView && profile?.role === "SUPER_ADMIN"
                        ? 2
                        : 0)
                    }
                    className="px-6 py-20 text-center text-slate-400 dark:text-slate-600 font-bold uppercase tracking-widest text-[10px]"
                  >
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800/50 rounded-2xl flex items-center justify-center">
                        <Search size={24} className="opacity-20" />
                      </div>
                      Aucun membre trouvé
                    </div>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    onClick={() => openDetailModal(user)}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-all duration-200 group cursor-pointer"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="relative group/avatar">
                          <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-black text-lg uppercase border border-slate-100 dark:border-slate-700 shrink-0 shadow-sm transition-transform group-hover:scale-105 duration-300">
                            {user.avatarUrl ? (
                              <img
                                src={user.avatarUrl}
                                alt=""
                                className="w-full h-full object-cover rounded-2xl"
                              />
                            ) : (
                              user.fullName.charAt(0)
                            )}
                          </div>
                          <div
                            className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white dark:border-slate-900 transition-colors ${user.status === "active" ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-slate-300 dark:bg-slate-700"}`}
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="font-black text-slate-900 dark:text-white text-sm tracking-tight truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                            {user.fullName}
                          </p>
                          <div className="flex items-center gap-3 mt-0.5">
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500 font-bold">
                              <Mail size={10} className="shrink-0" />{" "}
                              <span className="truncate">{user.email}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-[11px] font-black text-slate-500 dark:text-slate-400 bg-slate-100/50 dark:bg-slate-800/50 px-3 py-1.5 rounded-xl border border-slate-100 dark:border-slate-700">
                        {user.matricule}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {editingDeptId === user.id ? (
                        <div
                          className="flex items-center gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <select
                            value={tempDept}
                            onChange={(e) => setTempDept(e.target.value)}
                            className="text-[10px] font-bold uppercase px-3 py-2 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                          >
                            {(user.role === "ADMIN" || user.role === "SUPER_ADMIN" || user.role === "BOARD_MEMBER") && (
                              <option value="all">TOUS</option>
                            )}
                            {DEPARTMENTS.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.code}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => {
                              handleDeptChange(user.id, tempDept);
                              setEditingDeptId(null);
                            }}
                            className="p-2 bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-500/20"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={() => setEditingDeptId(null)}
                            className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-xl"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col">
                          <span
                            className="text-xs font-black text-slate-900 dark:text-slate-200 uppercase tracking-tight cursor-pointer hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (
                                profile?.role === "SUPER_ADMIN" ||
                                (profile?.role === "ADMIN" &&
                                  (profile?.departmentId === "03" || profile?.departmentId === "all"))
                              ) {
                                setEditingDeptId(user.id);
                                setTempDept(user.departmentId);
                              }
                            }}
                          >
                            {departments.find((d) => d.id === user.departmentId)?.name ||
                              (user.departmentId === "all" ? "Tous les départements" : user.departmentId)}
                          </span>
                          <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.1em] mt-0.5">
                            {(() => {
                              if (user.departmentId === "all" && user.serviceId === "all") {
                                return "Tous les services (Admin)";
                              }
                              const matchingService = SERVICES_LIST.find(
                                (s) =>
                                  s.deptId === user.departmentId &&
                                  s.id === user.serviceId,
                              );
                              if (matchingService) {
                                return `${matchingService.name} (${matchingService.id})`;
                              }
                              return user.serviceId ? `Service ${user.serviceId}` : "Général";
                            })()}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {editingRoleId === user.id ? (
                        <div
                          className="flex items-center gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <select
                            value={tempRole}
                            onChange={(e) => setTempRole(e.target.value)}
                            className="text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                          >
                            {roles.length > 0 ? (
                              roles.map((r) => (
                                <option key={r.role} value={r.role}>
                                  {r.label}
                                </option>
                              ))
                            ) : (
                              <>
                                <option value="USER">Travailleur</option>
                                <option value="SUPER_USER">Expert</option>
                                <option value="ADMIN">Directeur</option>
                                <option value="SUPER_ADMIN">DG</option>
                                <option value="BOARD_MEMBER">Conseil d'Administration</option>
                              </>
                            )}
                          </select>
                          <button
                            onClick={() => {
                              handleRoleChange(user.id, tempRole);
                              setEditingRoleId(null);
                            }}
                            className="p-2 bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-500/20"
                            title="Enregistrer"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={() => setEditingRoleId(null)}
                            className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-xl"
                            title="Annuler"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <div
                          className={`inline-flex items-center px-3 py-1 shadow-sm rounded-lg text-[10px] font-black uppercase tracking-widest border ${
                            user.role === "SUPER_ADMIN"
                              ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20"
                              : user.role === "ADMIN"
                                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                                : user.role === "SUPER_USER"
                                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                                  : user.role === "BOARD_MEMBER"
                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-white border-slate-200 dark:border-slate-700"
                          }`}
                        >
                          {user.role.replace("_", " ")}
                        </div>
                      )}
                    </td>
                    {(profile?.role === "ADMIN" ||
                      profile?.role === "SUPER_ADMIN") && (
                      <td className="px-6 py-4">
                        <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-100 dark:border-slate-700 select-all transition-colors hover:border-emerald-500/30">
                          {user.password || "---"}
                        </span>
                      </td>
                    )}
                    <td className="px-6 py-4">
                      <button
                        disabled={
                          isUpdating === user.id ||
                          !(
                            profile?.role === "ADMIN" ||
                            profile?.role === "SUPER_ADMIN"
                          )
                        }
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStatusChange(user.id, user.status);
                        }}
                        className={`flex items-center gap-2 group/status px-3 py-1.5 rounded-xl border transition-all ${
                          user.status === "active"
                            ? "bg-emerald-500/5 border-emerald-500/10 hover:border-emerald-500/30"
                            : "bg-slate-500/5 border-slate-500/10 hover:border-slate-500/30"
                        }`}
                      >
                        <div
                          className={`w-1.5 h-1.5 rounded-full transition-all ${user.status === "active" ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-slate-400"}`}
                        ></div>
                        <span
                          className={`text-[10px] font-black uppercase tracking-widest transition-colors ${
                            user.status === "active"
                              ? "text-emerald-700 dark:text-emerald-400"
                              : "text-slate-500 dark:text-slate-500"
                          }`}
                        >
                          {user.status}
                        </span>
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div
                        className="flex justify-end gap-1.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {(profile?.role === "ADMIN" ||
                          profile?.role === "SUPER_ADMIN") &&
                          editingRoleId !== user.id && (
                            <button
                              onClick={() => {
                                setEditingRoleId(user.id);
                                setTempRole(user.role);
                              }}
                              className="p-2.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-500/5 rounded-xl transition-all"
                              title="Modifier le rôle"
                            >
                              <Briefcase size={16} />
                            </button>
                          )}
                        {profile?.role === "SUPER_ADMIN" && (
                          <button
                            onClick={() =>
                              handleDeleteUser(user.id, user.fullName)
                            }
                            className="p-2.5 text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/5 rounded-xl transition-all"
                            title="Supprimer l'utilisateur"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowCard(user);
                          }}
                          className="p-2.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-500/5 rounded-xl transition-all"
                          title="Imprimer Carte Service"
                        >
                          <IdCard size={16} />
                        </button>
                        <button className="p-2.5 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all">
                          <MoreVertical size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
          {filteredUsers.length === 0 ? (
            <div className="p-12 text-center text-slate-400 dark:text-slate-600 font-bold uppercase tracking-widest text-[10px]">
              Aucun membre trouvé
            </div>
          ) : (
            filteredUsers.map((user) => (
              <div
                key={user.id}
                onClick={() => openDetailModal(user)}
                className="p-5 hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-all cursor-pointer"
              >
                {/* Header Row: Avatar + Name + Badges */}
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-black text-lg border border-slate-100 dark:border-slate-700 shadow-sm shrink-0">
                    {user.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt=""
                        className="w-full h-full object-cover rounded-2xl"
                      />
                    ) : (
                      user.fullName.charAt(0)
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-slate-900 dark:text-white truncate tracking-tight text-base">
                      {user.fullName}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      <p className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                        {user.matricule}
                      </p>
                      
                      <span
                        className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                          user.role === "SUPER_ADMIN"
                            ? "bg-purple-500/10 text-purple-600 border-purple-500/20 dark:text-purple-400"
                            : user.role === "ADMIN"
                              ? "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400"
                              : user.role === "BOARD_MEMBER"
                                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                        }`}
                      >
                        {user.role.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Info and Account Status Row */}
                <div className="flex flex-col gap-2 mb-4 bg-slate-50/50 dark:bg-slate-800/30 p-3 rounded-xl border border-slate-100/50 dark:border-slate-800/50">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                      Département:
                    </span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {departments.find((d) => d.id === user.departmentId)
                        ?.name || (user.departmentId === "all" ? "Tous les départements" : user.departmentId)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                      État du compte:
                    </span>
                    <button
                      type="button"
                      disabled={
                        isUpdating === user.id ||
                        !(
                          profile?.role === "ADMIN" ||
                          profile?.role === "SUPER_ADMIN"
                        )
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStatusChange(user.id, user.status);
                      }}
                      className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg border transition-all ${
                        user.status === "active"
                          ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                          : "bg-red-500/5 border-red-500/20 text-red-600 dark:text-red-400"
                      }`}
                    >
                      <div
                        className={`w-1.5 h-1.5 rounded-full ${
                          user.status === "active"
                            ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]"
                            : "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]"
                        }`}
                      ></div>
                      <span className="text-[9px] font-black uppercase tracking-wider">
                        {user.status === "active" ? "ACTIF" : "SUSPENDU"}
                      </span>
                    </button>
                  </div>
                  {(profile?.role === "ADMIN" ||
                    profile?.role === "SUPER_ADMIN") &&
                    user.password && (
                      <div className="flex justify-between items-center text-xs pt-1.5 border-t border-slate-100 dark:border-slate-800/50">
                        <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                          Mot de passe:
                        </span>
                        <span className="font-mono text-[10px] text-brand bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 px-2 py-0.5 rounded-md">
                          {user.password}
                        </span>
                      </div>
                    )}
                </div>

                {/* Quick Action Grid */}
                <div
                  className="flex gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => setShowCard(user)}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-755 text-slate-700 dark:text-slate-300 rounded-xl border border-slate-200/50 dark:border-slate-700/50 active:scale-95 transition-all flex items-center justify-center gap-1.5 text-xs font-black uppercase tracking-wider"
                    title="Aperçu Carte"
                  >
                    <IdCard size={15} />
                    <span>Carte ID</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openDetailModal(user)}
                    className="flex-grow flex-1 py-3 bg-brand hover:brightness-110 text-white rounded-xl shadow-md active:scale-95 transition-all flex items-center justify-center gap-1.5 text-xs font-black uppercase tracking-wider"
                    title="Ouvrir le dossier"
                  >
                    <FileText size={15} />
                    <span>Dossier</span>
                  </button>
                  {profile?.role === "SUPER_ADMIN" && (
                    <button
                      type="button"
                      onClick={() => handleDeleteUser(user.id, user.fullName)}
                      className="p-3 bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 rounded-xl transition-all active:scale-95 flex items-center justify-center border border-red-500/10"
                      title="Supprimer"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <AnimatePresence>
        {creationSuccess && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl p-10 text-center"
            >
              <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <Check size={40} />
              </div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2 uppercase tracking-tight">
                Utilisateur Créé !
              </h2>
              <p className="text-slate-500 dark:text-slate-400 mb-8 font-medium">
                Veuillez copier ces identifiants pour le collaborateur.
              </p>

              <div className="space-y-4 mb-8 text-left">
                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                    Matricule (Identifiant)
                  </p>
                  <p className="font-mono text-lg font-bold text-slate-900 dark:text-white">
                    {creationSuccess.matricule}
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                    Mot de passe par défaut
                  </p>
                  <p className="font-mono text-lg font-bold text-brand">
                    {creationSuccess.password}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setCreationSuccess(null)}
                className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black uppercase tracking-widest rounded-2xl hover:brightness-110 transition-all"
              >
                J'ai noté les accès
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white">
                    Nouvel Employé
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium tracking-tight">
                    Le matricule et le mot de passe seront générés
                    automatiquement.
                  </p>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-xl shadow-sm text-slate-400 hover:text-slate-600 dark:hover:text-white transition-all"
                >
                  <X size={24} />
                </button>
              </div>

              <form
                onSubmit={handleSubmit}
                className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto max-h-[70vh]"
              >
                <div>
                  <label className="block text-xs font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-2">
                    Nom Complet
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.fullName}
                    onChange={(e) =>
                      setFormData({ ...formData, fullName: e.target.value })
                    }
                    placeholder="ex: Jean Dupont"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-2">
                    Email Professionnel
                  </label>
                  <input
                    required
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    placeholder="jean.dupont@riberjo.com"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-2">
                    Téléphone
                  </label>
                  <div className="relative">
                    <Phone
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                      size={16}
                    />
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                      placeholder="+243 ..."
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-2">
                    Année Recrutement
                  </label>
                  <input
                    type="text"
                    value={formData.recruitmentYear}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        recruitmentYear: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-900 dark:text-white"
                  />
                </div>
                {formData.role !== "CLIENT" && (
                  <>
                    <div>
                      <label className="block text-xs font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-2">
                        Département
                      </label>
                      <select
                        required
                        value={formData.departmentId}
                        onChange={(e) =>
                          setFormData({ ...formData, departmentId: e.target.value })
                        }
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-900 dark:text-white"
                      >
                        <option value="">Sélectionner</option>
                        {(formData.role === "ADMIN" || formData.role === "SUPER_ADMIN" || formData.role === "BOARD_MEMBER") && (
                          <option value="all">Tous les départements (Général / Admin)</option>
                        )}
                        {DEPARTMENTS.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-2">
                        Service Affecté
                      </label>
                      <div className="relative">
                        <Briefcase
                          className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                          size={16}
                        />
                        <select
                          required
                          value={formData.serviceId}
                          onChange={(e) =>
                            setFormData({ ...formData, serviceId: e.target.value })
                          }
                          className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-900 dark:text-white"
                        >
                          <option value="">Sélectionner un service</option>
                          {formData.departmentId === "all" && (
                            <option value="all">Tous les services (Admin)</option>
                          )}
                          {SERVICES_LIST.filter(
                            (s) => s.deptId === formData.departmentId,
                          ).map((s) => (
                            <option key={`${s.deptId}-${s.id}`} value={s.id}>
                              {s.name} ({s.id})
                            </option>
                          ))}
                          {!formData.departmentId && (
                            <option disabled>
                              Veuillez d'abord choisir un département
                            </option>
                          )}
                          {formData.departmentId &&
                            SERVICES_LIST.filter(
                              (s) => s.deptId === formData.departmentId,
                            ).length === 0 && (
                              <option value="00">Service Général (00)</option>
                            )}
                        </select>
                      </div>
                    </div>
                  </>
                )}
                <div>
                  <label className="block text-xs font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-2">
                    Salaire de Base ($)
                  </label>
                  <input
                    type="number"
                    value={
                      isNaN(formData.baseSalary) ? "" : formData.baseSalary
                    }
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setFormData({
                        ...formData,
                        baseSalary: isNaN(val) ? 0 : val,
                      });
                    }}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-2">
                    Rôle
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) =>
                      setFormData({ ...formData, role: e.target.value as any })
                    }
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-900 dark:text-white"
                  >
                    {roles.length > 0 ? (
                      roles.map((r) => (
                        <option key={r.role} value={r.role}>
                          {r.label}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="USER">Travailleur</option>
                        <option value="SUPER_USER">Expert</option>
                        <option value="ADMIN">Directeur</option>
                        <option value="SUPER_ADMIN">DG</option>
                        <option value="BOARD_MEMBER">Conseil d'Administration</option>
                        <option value="CLIENT">Client</option>
                      </>
                    )}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-2">
                    Mot de passe (Optionnel - Laisser vide pour auto-générer)
                  </label>
                  <input
                    type="text"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    placeholder="Laisser vide pour générer automatiquement"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-2">
                    Adresse
                  </label>
                  <div className="relative">
                    <MapPin
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                      size={16}
                    />
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) =>
                        setFormData({ ...formData, address: e.target.value })
                      }
                      placeholder="Adresse complète"
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600"
                    />
                  </div>
                </div>

                <div className="md:col-span-2 flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-6 py-3 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-2xl font-bold hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-8 py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 shadow-xl shadow-emerald-100 dark:shadow-none flex items-center gap-2"
                  >
                    <Check size={20} /> Confirmer la création
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCard && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCard(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[2rem] sm:rounded-[3.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-5 sm:p-8 border-b border-slate-50 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                <h3 className="text-base sm:text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                  Prévisualisation de la Carte
                </h3>
                <button
                  onClick={() => setShowCard(null)}
                  className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-xl shadow-sm transition-all text-slate-400 hover:text-slate-600"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 sm:p-12 flex flex-col items-center w-full overflow-hidden">
                <div className="w-full max-w-[440px] md:w-[450px] md:h-[280px] bg-white rounded-3xl shadow-2xl relative overflow-hidden border border-slate-100 p-6 md:p-8 flex flex-col sm:flex-row gap-4 sm:gap-6 shrink-0 text-slate-900">
                  <div className="absolute top-0 left-0 w-full h-3 bg-emerald-600"></div>
                  <div className="w-full sm:w-1/3 flex flex-col items-center gap-3 sm:gap-4 shrink-0">
                    <div className="w-20 h-20 md:w-24 md:h-24 bg-slate-100 rounded-2xl flex items-center justify-center text-3xl md:text-4xl font-black text-slate-300 border-2 border-slate-50 shrink-0">
                      {showCard.fullName.charAt(0)}
                    </div>
                    <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-50 shrink-0">
                      <QRCodeCanvas
                        value={`${window.location.origin}/verify/${showCard.matricule.replace(/\//g, "_")}`}
                        size={64}
                      />
                    </div>
                  </div>
                  <div className="flex-1 space-y-3 md:space-y-4 text-center sm:text-left min-w-0">
                    <div className="flex justify-center sm:justify-between items-start">
                      <div>
                        <p className="text-[9px] md:text-[10px] font-black text-emerald-600 uppercase tracking-widest leading-none mb-1">
                          RIBERJO GLOBAL SERVICE
                        </p>
                        <h4 className="text-base md:text-xl font-black text-slate-900 uppercase tracking-tighter leading-tight truncate">
                          {showCard.fullName}
                        </h4>
                      </div>
                    </div>

                    <div className="space-y-3 md:space-y-4">
                      <div>
                        <p className="text-[7px] md:text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">
                          Matricule
                        </p>
                        <p className="font-mono text-xs md:text-sm font-bold text-slate-700">
                          {showCard.matricule}
                        </p>
                      </div>
                      <div>
                        <p className="text-[7px] md:text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">
                          Fonction & Département
                        </p>
                        <p className="text-[11px] md:text-xs font-black text-slate-900 uppercase tracking-tight truncate">
                          {showCard.role.replace("_", " ")} •{" "}
                          {DEPARTMENTS.find((d) => d.id === showCard.departmentId)?.name || showCard.departmentId} ({showCard.departmentId})
                        </p>
                      </div>
                      <div>
                        <p className="text-[7px] md:text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">
                          Service Affecté
                        </p>
                        <p className="text-[11px] md:text-xs font-black text-slate-900 uppercase tracking-tight truncate">
                          {(() => {
                            const matchingService = SERVICES_LIST.find(
                              (s) =>
                                s.deptId === showCard.departmentId &&
                                s.id === showCard.serviceId,
                            );
                            if (matchingService) {
                              return `${matchingService.name} (${matchingService.id})`;
                            }
                            return showCard.serviceId ? `Service ${showCard.serviceId}` : "Général";
                          })()}
                        </p>
                      </div>
                      <div className="flex justify-between items-end pt-3 md:pt-4 border-t border-slate-50">
                        <div className="text-left">
                          <p className="text-[6px] md:text-[7px] font-black text-slate-300 uppercase tracking-widest">
                            Date émission
                          </p>
                          <p className="text-[7px] md:text-[8px] font-bold text-slate-400">
                            {new Date().toLocaleDateString()}
                          </p>
                        </div>
                        <span className="text-[9px] md:text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                          Officiel
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-8 sm:mt-12 flex gap-4 w-full max-w-sm">
                  <button
                    onClick={() => handlePrintCard(showCard)}
                    className="flex-1 py-4 bg-emerald-600 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-emerald-500/20 hover:scale-105 transition-all flex items-center justify-center gap-2 text-xs"
                  >
                    <Printer size={18} /> Télécharger PDF
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isDetailModalOpen && selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDetailModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, x: 20 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.95, x: 20 }}
              className="relative bg-white dark:bg-slate-900 w-full max-w-4xl rounded-[2rem] md:rounded-[3rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] overflow-hidden flex flex-col md:flex-row max-h-[92vh] md:max-h-[90vh]"
            >
              {/* Profile Sidebar */}
              <div className="w-full md:w-80 bg-slate-50 dark:bg-slate-800/50 p-6 md:p-10 border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-800 flex flex-col items-center shrink-0 max-h-[35vh] md:max-h-full overflow-y-auto">
                <div className="w-20 h-20 md:w-32 md:h-32 bg-brand rounded-[2rem] md:rounded-[2.5rem] flex items-center justify-center text-white text-2xl md:text-3xl font-black shadow-2xl shadow-brand/20 mb-4 md:mb-6">
                  {selectedUser.fullName.charAt(0)}
                </div>
                <h2 className="text-lg md:text-xl font-black text-slate-900 dark:text-white text-center mb-1 uppercase tracking-tight leading-tight">
                  {selectedUser.fullName}
                </h2>
                <p className="text-[10px] md:text-xs font-bold text-brand uppercase tracking-widest mb-4 md:mb-6">
                  {selectedUser.role.replace("_", " ")}
                </p>

                <div className="w-full space-y-3 md:space-y-4 overflow-y-auto pr-1 hidden md:block">
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">
                      Mot de Passe
                    </p>
                    <p className="font-mono text-sm font-bold text-brand">
                      {selectedUser.password || "••••••••"}
                    </p>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">
                      Matricule
                    </p>
                    <p className="font-mono text-sm font-bold text-slate-700 dark:text-slate-300">
                      {selectedUser.matricule}
                    </p>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">
                      Recrutement
                    </p>
                    <p className="font-bold text-slate-700 dark:text-slate-300 italic">
                      Année {selectedUser.recruitmentYear || "N/A"}
                    </p>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">
                      Département
                    </p>
                    <p className="font-bold text-slate-700 dark:text-slate-300">
                      {DEPARTMENTS.find((d) => d.id === selectedUser.departmentId)?.name || selectedUser.departmentId} ({selectedUser.departmentId})
                    </p>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">
                      Téléphone
                    </p>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <Phone size={12} className="text-brand" />
                      {selectedUser.phone || "Non renseigné"}
                    </p>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">
                      Email
                    </p>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400 truncate">
                      {selectedUser.email}
                    </p>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">
                      Service Unité
                    </p>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300 truncate">
                      {(() => {
                        const matchingService = SERVICES_LIST.find(
                          (s) =>
                            s.deptId === selectedUser.departmentId &&
                            s.id === selectedUser.serviceId,
                        );
                        if (matchingService) {
                          return `${matchingService.name} (${matchingService.id})`;
                        }
                        return selectedUser.serviceId ? `Service ${selectedUser.serviceId}` : "Général";
                      })()}
                    </p>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">
                      Adresse
                    </p>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400 line-clamp-1">
                      {selectedUser.address || "Non spécifiée"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Main Content / Edit Form */}
              <div className="flex-1 p-6 md:p-10 overflow-y-auto">
                <div className="flex justify-between items-center mb-10">
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                    Dossier Employé
                  </h3>
                  <button
                    onClick={() => setIsDetailModalOpen(false)}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all text-slate-400"
                  >
                    <X size={24} />
                  </button>
                </div>

                <form onSubmit={handleUpdateDetails} className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">
                        Nom Complet
                      </label>
                      <input
                        type="text"
                        disabled={
                          !(
                            profile?.role === "ADMIN" ||
                            profile?.role === "SUPER_ADMIN"
                          )
                        }
                        value={editData.fullName || ""}
                        onChange={(e) =>
                          setEditData({ ...editData, fullName: e.target.value })
                        }
                        className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">
                        Année de recrutement
                      </label>
                      <input
                        type="text"
                        disabled={
                          !(
                            profile?.role === "ADMIN" ||
                            profile?.role === "SUPER_ADMIN"
                          )
                        }
                        value={editData.recruitmentYear || ""}
                        onChange={(e) =>
                          setEditData({
                            ...editData,
                            recruitmentYear: e.target.value,
                          })
                        }
                        className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">
                        Téléphone
                      </label>
                      <input
                        type="text"
                        disabled={
                          !(
                            profile?.role === "ADMIN" ||
                            profile?.role === "SUPER_ADMIN"
                          )
                        }
                        value={editData.phone || ""}
                        onChange={(e) =>
                          setEditData({ ...editData, phone: e.target.value })
                        }
                        className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">
                        Statut Actuel
                      </label>
                      <select
                        disabled={
                          !(
                            profile?.role === "ADMIN" ||
                            profile?.role === "SUPER_ADMIN"
                          )
                        }
                        value={editData.status || "active"}
                        onChange={(e) =>
                          setEditData({ ...editData, status: e.target.value as any })
                        }
                        className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-white"
                      >
                        <option value="active">Actif</option>
                        <option value="suspended">Suspendu</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">
                        Département
                      </label>
                      <select
                        disabled={
                          !(
                            profile?.role === "ADMIN" ||
                            profile?.role === "SUPER_ADMIN"
                          )
                        }
                        value={editData.departmentId || ""}
                        onChange={(e) =>
                          setEditData({
                            ...editData,
                            departmentId: e.target.value,
                            serviceId: "",
                          })
                        }
                        className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-white"
                      >
                        <option value="">Sélectionner</option>
                        {DEPARTMENTS.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">
                        Service Affecté
                      </label>
                      <select
                        disabled={
                          !(
                            profile?.role === "ADMIN" ||
                            profile?.role === "SUPER_ADMIN"
                          )
                        }
                        value={editData.serviceId || ""}
                        onChange={(e) =>
                          setEditData({ ...editData, serviceId: e.target.value })
                        }
                        className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-white"
                      >
                        <option value="">Sélectionner un service</option>
                        {SERVICES_LIST.filter(
                          (s) => s.deptId === editData.departmentId,
                        ).map((s) => (
                          <option key={`${s.deptId}-${s.id}`} value={s.id}>
                            {s.name} ({s.id})
                          </option>
                        ))}
                        {!editData.departmentId && (
                          <option disabled>
                            Veuillez d'abord choisir un département
                          </option>
                        )}
                        {editData.departmentId &&
                          SERVICES_LIST.filter(
                            (s) => s.deptId === editData.departmentId,
                          ).length === 0 && (
                            <option value="00">Service Général (00)</option>
                          )}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">
                        Rôle
                      </label>
                      <select
                        disabled={
                          !(
                            profile?.role === "ADMIN" ||
                            profile?.role === "SUPER_ADMIN"
                          )
                        }
                        value={editData.role || "USER"}
                        onChange={(e) =>
                          setEditData({ ...editData, role: e.target.value as any })
                        }
                        className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-white"
                      >
                        <option value="USER">Travailleur</option>
                        <option value="SUPER_USER">Expert</option>
                        <option value="ADMIN">Directeur</option>
                        <option value="SUPER_ADMIN">DG</option>
                        <option value="BOARD_MEMBER">Conseil d'Administration</option>
                        <option value="CLIENT">Client</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">
                        Salaire de Base ($)
                      </label>
                      <input
                        type="number"
                        disabled={
                          !(
                            profile?.role === "ADMIN" ||
                            profile?.role === "SUPER_ADMIN"
                          )
                        }
                        value={
                          editData.baseSalary !== undefined &&
                          !isNaN(editData.baseSalary)
                            ? editData.baseSalary
                            : ""
                        }
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setEditData({
                            ...editData,
                            baseSalary: isNaN(val) ? 0 : val,
                          });
                        }}
                        className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  {(profile?.role === "ADMIN" || profile?.role === "SUPER_ADMIN") && (
                    <div className="md:col-span-2">
                      <label className="block text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">
                        Modifier le Mot de passe
                      </label>
                      <input
                        type="text"
                        value={editData.password || ""}
                        onChange={(e) =>
                          setEditData({ ...editData, password: e.target.value })
                        }
                        placeholder="Nouveau mot de passe"
                        className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-white"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">
                      Adresse Résidentielle
                    </label>
                    <textarea
                      rows={3}
                      disabled={
                        !(
                          profile?.role === "ADMIN" ||
                          profile?.role === "SUPER_ADMIN"
                        )
                      }
                      value={editData.address || ""}
                      onChange={(e) =>
                        setEditData({ ...editData, address: e.target.value })
                      }
                      className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 resize-none text-slate-900 dark:text-white"
                    ></textarea>
                  </div>

                  {(profile?.role === "ADMIN" ||
                    profile?.role === "SUPER_ADMIN") && (
                    <div className="flex gap-4 pt-6">
                      <button
                        type="button"
                        onClick={() => setIsDetailModalOpen(false)}
                        className="flex-1 px-8 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                      >
                        Fermer
                      </button>
                      <button
                        type="submit"
                        disabled={isUpdating === selectedUser.id}
                        className="flex-1 px-8 py-4 bg-brand text-white font-bold rounded-2xl hover:brightness-110 shadow-xl shadow-brand/20 dark:shadow-none transition-all flex items-center justify-center gap-2"
                      >
                        {isUpdating === selectedUser.id ? (
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                          <>
                            <Check size={20} />
                            Enregistrer
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCard && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCard(null)}
              className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, rotateY: 90 }}
              animate={{ opacity: 1, scale: 1, rotateY: 0 }}
              exit={{ opacity: 0, scale: 0.9, rotateY: -90 }}
              transition={{ type: "spring", damping: 20 }}
              className="relative w-full max-w-sm"
            >
              {/* ID Card Front */}
              <div
                id="id-card-riberjo"
                className="bg-white rounded-[2rem] overflow-hidden shadow-2xl aspect-[1.58/1] relative border-4 border-slate-50"
              >
                {/* Top Bar */}
                <div className="h-14 bg-emerald-700 flex items-center px-6 justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-emerald-700 font-black text-sm shadow-inner">
                      R
                    </div>
                    <span className="text-white font-black text-[10px] tracking-tight uppercase">
                      RIBERJO GLOBAL SERVICE
                    </span>
                  </div>
                  <span className="text-emerald-300 font-black text-[8px] uppercase tracking-widest border border-emerald-500/50 px-2 py-1 rounded">
                    CARTE DE TRAVAIL
                  </span>
                </div>

                {/* Content */}
                <div className="p-6 flex gap-6">
                  <div className="w-24 h-24 bg-slate-100 rounded-2xl flex items-center justify-center border-2 border-slate-50 shadow-inner shrink-0 overflow-hidden">
                    {showCard.avatarUrl ? (
                      <img
                        src={showCard.avatarUrl || null}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-3xl font-black text-slate-300">
                        {showCard.fullName.charAt(0)}
                      </span>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight mb-1">
                          {showCard.fullName}
                        </h3>
                        <p className="text-[10px] font-bold text-emerald-600 mb-4 uppercase tracking-widest">
                          {showCard.role.replace("_", " ")}
                        </p>
                      </div>
                      <div className="bg-white p-1 rounded-lg border border-slate-100 shadow-sm">
                        <QRCodeCanvas
                          value={`${window.location.origin}/verify/${showCard.matricule.replace(/\//g, "_")}`}
                          size={48}
                          level="L"
                          includeMargin={false}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                          Matricule:
                        </span>
                        <span className="text-[10px] font-mono font-bold text-slate-700">
                          {showCard.matricule}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                          Dépt:
                        </span>
                        <span className="text-[10px] font-bold text-slate-700 uppercase">
                          {DEPARTMENTS.find((d) => d.id === showCard.departmentId)?.name || showCard.departmentId} ({showCard.departmentId})
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                          Service:
                        </span>
                        <span className="text-[10px] font-bold text-slate-700 uppercase truncate max-w-[160px]">
                          {(() => {
                            const matchingService = SERVICES_LIST.find(
                              (s) =>
                                s.deptId === showCard.departmentId &&
                                s.id === showCard.serviceId,
                            );
                            if (matchingService) {
                              return `${matchingService.name} (${matchingService.id})`;
                            }
                            return showCard.serviceId ? `Service ${showCard.serviceId}` : "Général";
                          })()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                          Recrutement:
                        </span>
                        <span className="text-[10px] font-bold text-slate-700">
                          {showCard.recruitmentYear || "N/A"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Decoration */}
                <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-brand/10 bg-gradient-to-r from-emerald-500 via-yellow-500 to-emerald-500"></div>

                {/* Watermark Logo */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-[0.03] scale-150">
                  <div className="w-40 h-40 bg-emerald-900 rounded-full flex items-center justify-center text-white font-black text-9xl">
                    R
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-8 flex gap-4">
                <button
                  onClick={() => setShowCard(null)}
                  className="flex-1 py-4 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white font-bold rounded-2xl border border-white/10 transition-all uppercase text-xs tracking-widest"
                >
                  Fermer
                </button>
                <button
                  onClick={() => showCard && handlePrintCard(showCard)}
                  className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl shadow-xl shadow-emerald-900/20 transition-all flex items-center justify-center gap-2 uppercase text-xs tracking-widest"
                >
                  <Printer size={16} /> Imprimer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showToast.show && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] bg-slate-900 dark:bg-emerald-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-white/10"
          >
            <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
              <Check size={14} className="text-white" />
            </div>
            <p className="text-sm font-bold">{showToast.message}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteConfirmation && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirmation(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800 p-8 text-center"
            >
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 size={32} className="text-red-500" />
              </div>
              <h3 className="text-lg font-black text-slate-950 dark:text-white uppercase tracking-tight mb-2">
                Suppression de Compte
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 font-medium">
                Êtes-vous sûr de vouloir supprimer définitivement{" "}
                <span className="font-extrabold text-slate-800 dark:text-slate-200">
                  {deleteConfirmation.fullName}
                </span>{" "}
                ? Cette action est irréversible et supprimera toutes les données associées.
              </p>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmation(null)}
                  className="flex-grow flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-2xl active:scale-95 transition-all uppercase text-xs tracking-widest"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteUser}
                  className="flex-grow flex-1 py-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-2xl shadow-xl shadow-red-900/20 active:scale-95 transition-all uppercase text-xs tracking-widest"
                >
                  Supprimer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
