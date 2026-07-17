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
  where,
} from "firebase/firestore";
import { UserProfile, Department, RolePermission, AppDocument } from "../types";
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
  User,
  KeyRound,
  Plus,
  Eye,
  Camera,
  Scissors,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "../contexts/AuthContext";
import ImageCropper from "../components/ImageCropper";
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
import * as htmlToImage from "html-to-image";
import { jsPDF } from "jspdf";
import * as XLSX from "xlsx";

import { notificationService } from "../services/notificationService";

export default function Users({ initialActiveTab }: { initialActiveTab?: string }) {
  const { profile } = useAuth();
  const isDGOrHR = profile?.role === 'SUPER_ADMIN' || profile?.role === 'BOARD_MEMBER' || profile?.departmentId === '03';
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
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    userId: string;
    fullName: string;
  } | null>(null);
  const [resetPasswordConfirmation, setResetPasswordConfirmation] = useState<{
    userId: string;
    fullName: string;
    matricule: string;
  } | null>(null);
  const [newCustomPassword, setNewCustomPassword] = useState("");

  const [activeDetailTab, setActiveDetailTab] = useState<'info' | 'card' | 'documents'>('info');
  const [isExporting, setIsExporting] = useState(false);
  const [isCardFlipped, setIsCardFlipped] = useState(false);
  const cardRef = React.useRef<HTMLDivElement>(null);

  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [cropperType, setCropperType] = useState<'cardPhoto' | null>(null);

  const handleCardPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("L'image est trop volumineuse (max 2 Mo).");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setImageToCrop(reader.result as string);
      setCropperType('cardPhoto');
    };
    reader.readAsDataURL(file);
  };

  const onCropComplete = async (croppedImage: string) => {
    if (!selectedUser) return;
    try {
      setIsExporting(true);
      const userRef = doc(db, "users", selectedUser.id);
      await updateDoc(userRef, { cardPhotoUrl: croppedImage });
      
      const updatedUser = { ...selectedUser, cardPhotoUrl: croppedImage };
      setSelectedUser(updatedUser);
      setUsers(users.map(u => u.id === selectedUser.id ? updatedUser : u));

      setShowToast({ show: true, message: "Photo de la carte mise à jour avec succès !" });
      setTimeout(() => setShowToast({ show: false, message: "" }), 3000);
    } catch (err) {
      console.error(err);
      setShowToast({ show: true, message: "Erreur lors de la mise à jour de la photo de la carte." });
      setTimeout(() => setShowToast({ show: false, message: "" }), 3000);
    } finally {
      setIsExporting(false);
      setImageToCrop(null);
      setCropperType(null);
    }
  };

  // States for HR Document Management
  const [userDocs, setUserDocs] = useState<AppDocument[]>([]);
  const [isDocsLoading, setIsDocsLoading] = useState(false);
  const [isDocUploading, setIsDocUploading] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState("");
  const [newDocType, setNewDocType] = useState<"contract" | "avenant">("contract");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentSearchTerm, setDocumentSearchTerm] = useState("");
  const [previewDoc, setPreviewDoc] = useState<AppDocument | null>(null);

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
    gender: "M" as 'M' | 'F',
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
          gender: formData.gender || "M",
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
        gender: "M" as 'M' | 'F',
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
    setActiveDetailTab('info');
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
      gender: user.gender || "M",
    });
    setIsDetailModalOpen(true);
  };

  const handleDownloadCard = async () => {
    const frontEl = document.getElementById('service-card-front-export-user');
    const backEl = document.getElementById('service-card-back-export-user');
    if (!frontEl || !backEl || !selectedUser) return;
    
    setIsExporting(true);
    try {
      const frontDataUrl = await htmlToImage.toPng(frontEl, { 
        quality: 1, 
        pixelRatio: 3,
        backgroundColor: '#ffffff'
      });
      
      const backDataUrl = await htmlToImage.toPng(backEl, { 
        quality: 1, 
        pixelRatio: 3,
        backgroundColor: '#0f172a'
      });
      
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [85.6, 53.98]
      });
      
      pdf.addImage(frontDataUrl, 'PNG', 0, 0, 85.6, 53.98);
      
      pdf.addPage([85.6, 53.98], 'landscape');
      pdf.addImage(backDataUrl, 'PNG', 0, 0, 85.6, 53.98);
      
      pdf.save(`Carte_Service_${selectedUser.fullName}.pdf`);
      
      setShowToast({ show: true, message: "Carte de service exportée avec succès ! (Double-face ID-1)" });
      setTimeout(() => setShowToast({ show: false, message: "" }), 3000);
    } catch (err) {
      console.error(err);
      setShowToast({ show: true, message: "Erreur lors de l'exportation de la carte." });
      setTimeout(() => setShowToast({ show: false, message: "" }), 3000);
    } finally {
      setIsExporting(false);
    }
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

  const handleResetUserPassword = async (userId: string, customNewPassword?: string) => {
    setIsUpdating(userId);
    try {
      const userDoc = users.find((u) => u.id === userId);
      const randomPart = Math.floor(1000 + Math.random() * 9000);
      const generatedPass = customNewPassword?.trim() || `Riberjo${randomPart}!`;

      await updateDoc(doc(db, "users", userId), {
        password: generatedPass,
        passwordChanged: false
      });

      if (userDoc?.role === "CLIENT") {
        await updateDoc(doc(db, "clients", userId), {
          passwordChanged: false
        });
      }

      await notificationService.notify(
        userId,
        "Mot de Passe Réinitialisé",
        `Votre mot de passe a été réinitialisé par la Direction Générale. Nouveau : ${generatedPass}`,
        "critical"
      );

      setResetPasswordConfirmation(null);
      setNewCustomPassword("");
      
      if (selectedUser && selectedUser.id === userId) {
        setSelectedUser({ ...selectedUser, password: generatedPass });
      }

      setCreationSuccess({
        matricule: userDoc?.matricule || "",
        password: generatedPass,
        isReset: true
      } as any);
      
      fetchData();
    } catch (err) {
      console.error(err);
      setShowToast({ show: true, message: "Erreur lors de la réinitialisation du mot de passe." });
      setTimeout(() => setShowToast({ show: false, message: "" }), 3000);
    } finally {
      setIsUpdating(null);
    }
  };

  const fetchUserDocuments = async (matricule: string) => {
    setIsDocsLoading(true);
    try {
      const q = query(
        collection(db, "documents"),
        where("userId", "==", matricule)
      );
      const snap = await getDocs(q);
      const docsList = snap.docs.map(d => ({ id: d.id, ...d.data() } as AppDocument));
      docsList.sort((a, b) => b.createdAt - a.createdAt);
      setUserDocs(docsList);
    } catch (err) {
      console.error("Error fetching user docs:", err);
    } finally {
      setIsDocsLoading(false);
    }
  };

  const handleAddUserDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    if (!newDocTitle.trim()) {
      alert("Veuillez saisir un titre pour le document.");
      return;
    }
    if (!selectedFile) {
      alert("Veuillez sélectionner un fichier.");
      return;
    }

    setIsDocUploading(true);
    try {
      const reader = new FileReader();
      const fileUrl = await new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(selectedFile);
      });

      const newDoc = {
        title: newDocTitle.trim(),
        type: newDocType === 'contract' ? 'contract' : 'other',
        category: newDocType,
        fileUrl: fileUrl,
        userId: selectedUser.matricule,
        departmentId: selectedUser.departmentId || "RH",
        status: "active",
        signed: false,
        createdAt: Date.now()
      };

      await addDoc(collection(db, "documents"), newDoc);

      setNewDocTitle("");
      setSelectedFile(null);
      
      const fileInput = document.getElementById("doc-file-input") as HTMLInputElement;
      if (fileInput) fileInput.value = "";

      fetchUserDocuments(selectedUser.matricule);
      
      setShowToast({ show: true, message: "Document RH ajouté avec succès !" });
      setTimeout(() => setShowToast({ show: false, message: "" }), 3000);
    } catch (err) {
      console.error("Error uploading document:", err);
      alert("Erreur lors de l'ajout du document.");
    } finally {
      setIsDocUploading(false);
    }
  };

  const handleDeleteUserDocument = async (docId: string) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer ce document ?")) return;
    try {
      await deleteDoc(doc(db, "documents", docId));
      if (selectedUser) {
        fetchUserDocuments(selectedUser.matricule);
      }
      setShowToast({ show: true, message: "Document supprimé avec succès." });
      setTimeout(() => setShowToast({ show: false, message: "" }), 3000);
    } catch (err) {
      console.error("Error deleting doc:", err);
    }
  };

  useEffect(() => {
    if (selectedUser && activeDetailTab === 'documents') {
      fetchUserDocuments(selectedUser.matricule);
    }
  }, [selectedUser, activeDetailTab]);



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
                  gender: "M" as 'M' | 'F',
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
                              setResetPasswordConfirmation({
                                userId: user.id,
                                fullName: user.fullName,
                                matricule: user.matricule
                              })
                            }
                            className="p-2.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-500/5 rounded-xl transition-all"
                            title="Réinitialiser le mot de passe"
                          >
                            <KeyRound size={16} />
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
                    onClick={() => openDetailModal(user)}
                    className="flex-grow flex-1 py-3 bg-brand hover:brightness-110 text-white rounded-xl shadow-md active:scale-95 transition-all flex items-center justify-center gap-1.5 text-xs font-black uppercase tracking-wider"
                    title="Ouvrir le dossier"
                  >
                    <FileText size={15} />
                    <span>Dossier de l'employé</span>
                  </button>
                  {profile?.role === "SUPER_ADMIN" && (
                    <button
                      type="button"
                      onClick={() =>
                        setResetPasswordConfirmation({
                          userId: user.id,
                          fullName: user.fullName,
                          matricule: user.matricule
                        })
                      }
                      className="p-3 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-xl transition-all active:scale-95 flex items-center justify-center border border-indigo-500/10"
                      title="Réinitialiser le mot de passe"
                    >
                      <KeyRound size={16} />
                    </button>
                  )}
                  {profile?.role === "SUPER_ADMIN" && (
                    <button
                      type="button"
                      onClick={() => handleDeleteUser(user.id, user.fullName)}
                      className="p-3 bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 text-red-650 dark:text-red-400 rounded-xl transition-all active:scale-95 flex items-center justify-center border border-red-500/10"
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
                {(creationSuccess as any).isReset ? "Mot de passe Réinitialisé !" : "Utilisateur Créé !"}
              </h2>
              <p className="text-slate-500 dark:text-slate-400 mb-8 font-medium">
                {(creationSuccess as any).isReset ? "Veuillez communiquer ces nouveaux accès à l'agent." : "Veuillez copier ces identifiants pour le collaborateur."}
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
                    Sexe / Genre
                  </label>
                  <select
                    required
                    value={formData.gender || "M"}
                    onChange={(e) =>
                      setFormData({ ...formData, gender: e.target.value as 'M' | 'F' })
                    }
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-900 dark:text-white"
                  >
                    <option value="M">Masculin</option>
                    <option value="F">Féminin</option>
                  </select>
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
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-mono text-sm font-bold text-brand">
                        {selectedUser.password || "••••••••"}
                      </p>
                      {profile?.role === "SUPER_ADMIN" && (
                        <button
                          type="button"
                          onClick={() => {
                            setResetPasswordConfirmation({
                              userId: selectedUser.id,
                              fullName: selectedUser.fullName,
                              matricule: selectedUser.matricule
                            });
                          }}
                          className="px-2.5 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/25 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all"
                          title="Réinitialiser"
                        >
                          Réinitialiser
                        </button>
                      )}
                    </div>
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
                      Sexe / Genre
                    </p>
                    <p className="font-bold text-slate-700 dark:text-slate-300">
                      {selectedUser.gender === "F" ? "Féminin (F)" : "Masculin (M)"}
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

              {/* Main Content / Edit Form or Card */}
              <div className="flex-1 p-6 md:p-10 overflow-y-auto">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                      Dossier Employé
                    </h3>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setActiveDetailTab('info')}
                        className={`px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${
                          activeDetailTab === 'info'
                            ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                            : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        Informations
                      </button>
                      {isDGOrHR && (
                        <button
                          type="button"
                          onClick={() => setActiveDetailTab('card')}
                          className={`px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${
                            activeDetailTab === 'card'
                              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          Carte de Service
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setActiveDetailTab('documents')}
                        className={`px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${
                          activeDetailTab === 'documents'
                            ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                            : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        Documents RH
                      </button>
                    </div>
                    <button
                      onClick={() => setIsDetailModalOpen(false)}
                      className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all text-slate-400"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>

                {activeDetailTab === 'info' ? (
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
                    <div>
                      <label className="block text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">
                        Sexe / Genre
                      </label>
                      <select
                        disabled={
                          !(
                            profile?.role === "ADMIN" ||
                            profile?.role === "SUPER_ADMIN"
                          )
                        }
                        value={editData.gender || "M"}
                        onChange={(e) =>
                          setEditData({ ...editData, gender: e.target.value as 'M' | 'F' })
                        }
                        className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-white"
                      >
                        <option value="M">Masculin</option>
                        <option value="F">Féminin</option>
                      </select>
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
                ) : (activeDetailTab === 'card' && isDGOrHR) ? (
                  /* CARTE DE SERVICE PREVIEW AND ACTIONS */
                  <div className="flex flex-col items-center justify-center gap-6 py-4">
                    <div className="flex flex-col sm:flex-row gap-4 w-full">
                       <style>{`
                         @media print {
                           body * { visibility: hidden; }
                           .no-print { display: none !important; }
                           #service-card-front-export-user, #service-card-back-export-user { 
                             visibility: visible; 
                             position: relative;
                             display: block !important;
                             opacity: 1 !important;
                             margin: 30px auto;
                             page-break-inside: avoid;
                           }
                         }
                       `}</style>
                       <button 
                         type="button"
                         onClick={() => window.print()}
                         className="flex-1 flex items-center justify-center gap-3 px-6 py-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-black uppercase tracking-wider rounded-2xl transition-all active:scale-95 shadow-sm"
                         title="Imprimer la carte de service"
                       >
                         <Printer size={16} />
                         <span>Imprimer</span>
                       </button>
                       <button 
                         type="button"
                         onClick={handleDownloadCard}
                         disabled={isExporting}
                         className={`flex-1 flex items-center justify-center gap-3 px-6 py-4 rounded-2xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 shadow-xl shadow-emerald-500/15 ${
                           isExporting 
                             ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 cursor-not-allowed' 
                             : 'bg-emerald-600 hover:bg-emerald-500 text-white hover:shadow-emerald-500/30'
                         }`}
                         title="Exporter la carte en PDF"
                       >
                         {isExporting ? <div className="w-4 h-4 border-2 border-slate-400/30 border-t-emerald-600 rounded-full animate-spin"></div> : <Download size={16} />}
                         <span>{isExporting ? "Exportation..." : "Exporter en PDF"}</span>
                       </button>
                    </div>

                    <div className="flex flex-col items-center justify-center gap-6 bg-slate-50 dark:bg-slate-900/40 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 border-dashed w-full overflow-hidden">
                      <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.25em] flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                        Survolez ou cliquez pour retourner la carte
                      </p>

                      {/* 3D Card Container */}
                      <div 
                        className="relative w-[280px] h-[437px] [perspective:1000px] cursor-pointer group mb-2"
                        onMouseEnter={() => setIsCardFlipped(true)}
                        onMouseLeave={() => setIsCardFlipped(false)}
                        onClick={() => setIsCardFlipped(!isCardFlipped)}
                      >
                        <motion.div
                          className="relative w-full h-full [transform-style:preserve-3d]"
                          animate={{ rotateY: isCardFlipped ? 180 : 0 }}
                          transition={{ duration: 0.6, ease: "easeInOut" }}
                        >
                          {/* Front Side (Recto) */}
                          <div 
                            className="absolute inset-0 w-full h-full bg-white rounded-[2rem] shadow-xl border border-slate-100 flex flex-col pt-6 overflow-hidden text-slate-900"
                            style={{ backfaceVisibility: "hidden" }}
                          >
                            {/* Header Strip */}
                            <div className="absolute top-0 left-0 w-full h-20 bg-slate-900 flex items-center px-6">
                              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-md overflow-hidden p-0.5 shrink-0">
                                <img src={settings?.logoUrl || "https://ais-dev-lqe5yig5k3o26rrfztrtng-160473187408.europe-west2.run.app/favicon-riberjo.png"} alt="Logo" className="w-full h-full object-contain" />
                              </div>
                              <div className="ml-3 text-left">
                                <span className="text-white font-black text-[9px] uppercase tracking-wider leading-none block">{settings?.companyName || "RIBERJO GLOBAL SERVICE"}</span>
                                <span className="text-emerald-400 font-black text-[6px] uppercase tracking-widest mt-1 block">Personnel Autorisé</span>
                              </div>
                            </div>

                            {/* Photo Area */}
                            <div className="mt-20 flex flex-col items-center">
                              <div className="w-28 h-28 bg-slate-50 rounded-[30px] p-1 shadow-md border border-slate-100 relative">
                                <div className="w-full h-full rounded-[24px] overflow-hidden bg-slate-200 flex items-center justify-center">
                                  {selectedUser.cardPhotoUrl ? (
                                    <img src={selectedUser.cardPhotoUrl} alt="Card" className="w-full h-full object-cover animate-fade-in" />
                                  ) : selectedUser.avatarUrl ? (
                                    <img src={selectedUser.avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                                  ) : (
                                    <User size={48} className="text-slate-400" />
                                  )}
                                </div>
                                {isDGOrHR && (
                                  <label 
                                    className="absolute -bottom-1 -right-1 p-2 bg-emerald-600 text-white rounded-xl shadow-lg cursor-pointer hover:bg-emerald-700 transition-all hover:scale-110 active:scale-95 border border-white dark:border-slate-800 flex items-center justify-center" 
                                    title="Prendre/Changer la photo de la carte"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Camera size={14} />
                                    <input 
                                      type="file" 
                                      accept="image/*"
                                      onChange={handleCardPhotoUpload}
                                      className="sr-only"
                                    />
                                  </label>
                                )}
                              </div>
                            </div>

                            {/* Personal Info */}
                            <div className="mt-5 px-6 text-center space-y-0.5">
                              <span className="text-base font-black text-slate-900 uppercase tracking-tight leading-tight truncate block">{selectedUser.fullName}</span>
                              <span className="text-[9px] font-black text-emerald-600 uppercase tracking-[0.2em] block">{selectedUser.role.replace('_', ' ')}</span>
                            </div>

                            {/* Details Table */}
                            <div className="mt-4 px-8 space-y-2 text-left">
                              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                                <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest font-sans">Matricule</span>
                                <span className="text-[10px] font-mono font-black text-slate-900">{selectedUser.matricule}</span>
                              </div>
                              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                                <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest font-sans">Département</span>
                                <span className="text-[9px] font-black text-slate-900 truncate max-w-[110px]" title={DEPARTMENTS.find((d) => d.id === selectedUser.departmentId)?.name || selectedUser.departmentId}>
                                  {DEPARTMENTS.find((d) => d.id === selectedUser.departmentId)?.name || selectedUser.departmentId}
                                </span>
                              </div>
                              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                                <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest font-sans">Service</span>
                                <span className="text-[9px] font-black text-slate-900 truncate max-w-[110px]">
                                  {(() => {
                                    const matchingService = SERVICES_LIST.find(
                                      (s) =>
                                        s.deptId === selectedUser.departmentId &&
                                        s.id === selectedUser.serviceId,
                                    );
                                    if (matchingService) {
                                      return `${matchingService.name}`;
                                    }
                                    return selectedUser.serviceId ? `Service ${selectedUser.serviceId}` : "Général";
                                  })()}
                                </span>
                              </div>
                              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                                <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest font-sans">Validité</span>
                                <span className="text-[10px] font-black text-slate-900">31 DEC 2026</span>
                              </div>
                            </div>

                            {/* Footer QR */}
                            <div className="mt-auto mb-5 px-8 flex items-center justify-between">
                              <div className="flex items-center gap-1.5 leading-none">
                                <div className="bg-slate-50 p-1 rounded-lg border border-slate-100 shadow-inner">
                                  <QRCodeCanvas value={`${window.location.origin}/verify/${selectedUser.matricule.replace(/\//g, '_')}`} size={36} level="M" />
                                </div>
                                <div className="text-left leading-none">
                                  <span className="text-[5px] font-black text-emerald-600 uppercase tracking-wider mb-0.5 block">VÉRIFIER</span>
                                  <span className="text-[4px] font-bold text-slate-400 uppercase tracking-normal leading-tight block">Scanner pour<br/>l'authenticité</span>
                                </div>
                              </div>
                              <div className="text-right relative flex flex-col items-end justify-end w-24 h-12">
                                {/* Seal Stamp Overlay */}
                                {settings?.dgSealUrl ? (
                                  <img src={settings.dgSealUrl} alt="Sceau" className="absolute right-2 bottom-1 w-8 h-8 object-contain pointer-events-none opacity-85 rotate-12" />
                                ) : (
                                  /* Generated seal SVG by default */
                                  <div className="absolute right-2 bottom-1 w-8 h-8 opacity-80 pointer-events-none rotate-12 flex items-center justify-center">
                                    <svg width="32" height="32" viewBox="0 0 100 100" className="text-red-600">
                                      <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="4" />
                                      <circle cx="50" cy="50" r="37" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3,3" />
                                      <path id="sealPathInteractiveUsers" d="M 15 50 A 35 35 0 0 1 85 50" fill="none" stroke="none" />
                                      <text className="text-[10px] font-black fill-red-600 uppercase tracking-widest">
                                        <textPath href="#sealPathInteractiveUsers" startOffset="50%" textAnchor="middle">RIBERJO</textPath>
                                      </text>
                                      <path id="sealPathInteractiveUsersBottom" d="M 85 50 A 35 35 0 0 1 15 50" fill="none" stroke="none" />
                                      <text className="text-[7.5px] font-black fill-red-600 uppercase tracking-tight">
                                        <textPath href="#sealPathInteractiveUsersBottom" startOffset="50%" textAnchor="middle">DIRECTION</textPath>
                                      </text>
                                    </svg>
                                  </div>
                                )}
                                {/* Signature Overlay */}
                                {settings?.dgSignatureUrl ? (
                                  <img src={settings.dgSignatureUrl} alt="Signature DG" className="absolute right-1 bottom-2 h-8 object-contain pointer-events-none max-w-[64px] z-10" />
                                ) : (
                                  <div className="h-6 w-16 border-b border-slate-900 mb-0.5 opacity-20"></div>
                                )}
                                <span className="text-[5px] font-black text-slate-400 uppercase tracking-widest leading-none block z-10 mt-auto">{settings?.dgName || "Signature DG"}</span>
                              </div>
                            </div>
                          </div>

                          {/* Back Side (Verso) */}
                          <div 
                            className="absolute inset-0 w-full h-full bg-slate-900 rounded-[2rem] shadow-xl flex flex-col p-6 text-white text-left"
                            style={{ 
                              backfaceVisibility: "hidden",
                              transform: "rotateY(180deg)"
                            }}
                          >
                            <div className="flex justify-center mb-4 opacity-20">
                              <Briefcase size={36} />
                            </div>
                            
                            <h3 className="text-[8px] font-black uppercase tracking-[0.2em] text-emerald-400 mb-3">Conditions d'Utilisation</h3>
                            <div className="text-[6px] text-slate-400 leading-relaxed uppercase font-bold tracking-wider space-y-2">
                              <p>1. Cette carte est strictement personnelle et incessible.</p>
                              <p>2. Elle demeure la propriété exclusive de {settings?.companyName || "RIBERJO GLOBAL SERVICE"}.</p>
                              <p>3. En cas de perte, le titulaire doit en informer immédiatement la direction.</p>
                              <p>4. Elle doit être portée visiblement lors de l'exercice des fonctions.</p>
                              <p>5. Toute utilisation frauduleuse expose son auteur à des poursuites.</p>
                            </div>

                            <div className="mt-auto space-y-4">
                              <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                                <span className="text-[6px] font-black text-slate-500 uppercase tracking-widest mb-0.5 italic block">Contact d'Urgence</span>
                                <span className="text-[8px] font-black uppercase tracking-widest block">+243 812 345 678</span>
                              </div>
                              
                              <div className="flex flex-col items-center gap-1.5">
                                <div className="w-8 h-0.5 bg-emerald-500 rounded-full"></div>
                                <span className="text-[6px] font-black text-slate-500 uppercase tracking-[0.3em] block">www.riberjo.com</span>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      </div>
                    </div>

                    {/* Hidden export template for this individual user (Strictly ID-1 landscape standard for high-res PDF generation) */}
                    <div className="fixed -top-[2000px] left-0 pointer-events-none opacity-0 z-0">
                      {/* Front Side Export */}
                      <div id="service-card-front-export-user" className="w-[856px] h-[540px] bg-white rounded-[2.5rem] overflow-hidden flex flex-col p-8 text-slate-900 relative">
                        <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_2px,transparent_2px)] [background-size:24px_24px] opacity-40"></div>
                        
                        {/* Header Strip */}
                        <div className="flex items-center justify-between border-b-2 border-slate-100 pb-4 mb-4 z-10">
                          <div className="flex items-center gap-5">
                            <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center p-2 shadow-lg">
                              <img src={settings?.logoUrl || "https://ais-dev-lqe5yig5k3o26rrfztrtng-160473187408.europe-west2.run.app/favicon-riberjo.png"} alt="Logo" className="w-full h-full object-contain" />
                            </div>
                            <div className="text-left">
                              <h1 className="text-slate-900 font-black text-[22px] uppercase tracking-wider leading-none">{settings?.companyName || "RIBERJO GLOBAL SERVICE"}</h1>
                              <p className="text-[13px] font-black text-emerald-600 uppercase tracking-widest mt-2">Identification Officielle • ID-1 Standard</p>
                            </div>
                          </div>
                          <div className="px-4 py-1 bg-emerald-50 text-emerald-700 text-[12px] font-black uppercase tracking-widest rounded-xl border-2 border-emerald-100/60 font-sans">
                            PVC RIGIDE
                          </div>
                        </div>

                        {/* Body content */}
                        <div className="flex gap-8 items-center z-10 flex-1">
                          {/* Left Block: Photo & Chip */}
                          <div className="flex flex-col items-center gap-4 shrink-0">
                            <div className="w-[200px] h-[200px] bg-slate-50 rounded-[2rem] p-2 shadow-xl border-2 border-slate-100 relative overflow-hidden">
                              <div className="w-full h-full rounded-[1.5rem] overflow-hidden bg-slate-100">
                                {selectedUser.cardPhotoUrl ? (
                                  <img src={selectedUser.cardPhotoUrl} alt="Card" className="w-full h-full object-cover" />
                                ) : selectedUser.avatarUrl ? (
                                  <img src={selectedUser.avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-slate-300">
                                    <User size={88} />
                                  </div>
                                )}
                              </div>
                            </div>
                            {/* Metallic Smart Chip */}
                            <div className="w-[72px] h-[50px] bg-gradient-to-br from-amber-200 via-amber-300 to-amber-500 rounded-xl border-2 border-amber-600/30 shadow-inner flex flex-col justify-around p-1">
                              <div className="h-[2px] bg-slate-800/20 w-full"></div>
                              <div className="flex justify-between w-full">
                                <div className="w-[2px] h-6 bg-slate-800/20"></div>
                                <div className="w-[2px] h-6 bg-slate-800/20"></div>
                              </div>
                              <div className="h-[2px] bg-slate-800/20 w-full"></div>
                            </div>
                          </div>

                          {/* Right Block: Personal Info */}
                          <div className="flex-1 text-left flex flex-col h-full justify-between py-2">
                            <div>
                              <span className="text-[14px] font-black text-slate-400 uppercase tracking-widest block leading-none">Nom de l'agent</span>
                              <h2 className="text-[28px] font-black text-slate-900 uppercase tracking-tight leading-none mt-2 truncate max-w-[420px]">{selectedUser.fullName}</h2>
                              
                              <span className="text-[14px] font-black text-slate-400 uppercase tracking-widest block leading-none mt-4">Fonction / Rôle</span>
                              <p className="text-[18px] font-black text-emerald-600 uppercase tracking-wider leading-none mt-2">{selectedUser.role.replace('_', ' ')}</p>
                            </div>

                            {/* Details grid table */}
                            <div className="grid grid-cols-2 gap-x-6 gap-y-3 mt-4 pt-4 border-t-2 border-slate-100">
                              <div>
                                <span className="text-[12px] font-black text-slate-400 uppercase tracking-widest block">Matricule</span>
                                <span className="text-[18px] font-mono font-black text-slate-800 leading-none">{selectedUser.matricule}</span>
                              </div>
                              <div>
                                <span className="text-[12px] font-black text-slate-400 uppercase tracking-widest block">Département</span>
                                <span className="text-[16px] font-black text-slate-800 leading-none block truncate max-w-[200px]">
                                  {DEPARTMENTS.find((d) => d.id === selectedUser.departmentId)?.name || selectedUser.departmentId}
                                </span>
                              </div>
                              <div>
                                <span className="text-[12px] font-black text-slate-400 uppercase tracking-widest block">Unité / Service</span>
                                <span className="text-[15px] font-black text-slate-800 leading-none block truncate max-w-[200px]">
                                  {(() => {
                                    const matchingService = SERVICES_LIST.find(
                                      (s) =>
                                        s.deptId === selectedUser.departmentId &&
                                        s.id === selectedUser.serviceId,
                                    );
                                    if (matchingService) {
                                      return `${matchingService.name}`;
                                    }
                                    return selectedUser.serviceId ? `Service ${selectedUser.serviceId}` : "Général";
                                  })()}
                                </span>
                              </div>
                              <div>
                                <span className="text-[12px] font-black text-slate-400 uppercase tracking-widest block">Validité</span>
                                <span className="text-[16px] font-black text-slate-800 leading-none font-sans">31 DÉCEMBRE 2026</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Back Side Export */}
                      <div id="service-card-back-export-user" className="w-[856px] h-[540px] bg-slate-900 rounded-[2.5rem] overflow-hidden flex flex-col p-8 text-white relative">
                        {/* Top Black Magnetic Band */}
                        <div className="absolute top-8 left-0 w-full h-[72px] bg-slate-950"></div>
                        
                        {/* Content below magnetic band */}
                        <div className="mt-28 flex justify-between gap-8 flex-1 items-start">
                          {/* Conditions, contact */}
                          <div className="flex-1 text-left space-y-3">
                            <h3 className="text-[15px] font-black uppercase tracking-widest text-emerald-400">Conditions d'Utilisation</h3>
                            <p className="text-[11px] text-slate-400 leading-relaxed uppercase font-bold tracking-wider max-w-[420px]">
                              1. Cette carte est strictement personnelle et incessible.<br/>
                              2. Elle demeure la propriété de {settings?.companyName || "RIBERJO GLOBAL SERVICE"}.<br/>
                              3. En cas de perte, aviser immédiatement la direction.<br/>
                              4. Elle doit être portée visiblement lors du service.<br/>
                              5. Toute fraude expose à des sanctions sévères.
                            </p>
                            <div className="bg-white/5 p-3 rounded-2xl border border-white/10 text-left mt-4 max-w-[280px]">
                              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block italic">Contact d'Urgence</span>
                              <span className="text-[15px] font-black uppercase tracking-widest block leading-none mt-1">+243 812 345 678</span>
                            </div>
                          </div>

                          {/* Signature, Seal & QR block */}
                          <div className="flex flex-col items-end gap-4 shrink-0">
                            {/* Signature panel */}
                            <div className="relative w-[280px] h-[80px] bg-slate-50 rounded-xl border border-slate-300 p-2 text-slate-900 flex flex-col justify-end items-center">
                              <span className="absolute left-2 top-1 text-[9px] font-black text-slate-400 uppercase tracking-widest">Signature Direction</span>
                              
                              {/* Stamp/Seal overlay */}
                              {settings?.dgSealUrl ? (
                                <img src={settings.dgSealUrl} alt="Sceau" className="absolute right-4 top-1 w-16 h-16 object-contain opacity-85 rotate-12 pointer-events-none" />
                              ) : (
                                <div className="absolute right-4 top-1 w-16 h-16 opacity-80 pointer-events-none rotate-12 flex items-center justify-center">
                                  <svg width="64" height="64" viewBox="0 0 100 100" className="text-red-600">
                                    <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="4" />
                                    <circle cx="50" cy="50" r="37" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3,3" />
                                    <path id="sealPathBackExportUsers" d="M 15 50 A 35 35 0 0 1 85 50" fill="none" stroke="none" />
                                    <text className="text-[10px] font-black fill-red-600 uppercase tracking-widest">
                                      <textPath href="#sealPathBackExportUsers" startOffset="50%" textAnchor="middle">RIBERJO</textPath>
                                    </text>
                                  </svg>
                                </div>
                              )}
                              
                              {/* Signature overlay */}
                              {settings?.dgSignatureUrl ? (
                                <img src={settings.dgSignatureUrl} alt="Signature DG" className="absolute right-6 bottom-2 h-12 object-contain pointer-events-none max-w-[150px]" />
                              ) : (
                                <div className="h-8 w-40 border-b border-slate-900 mb-1 opacity-20"></div>
                              )}
                              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none z-10">{settings?.dgName || "Directeur Général"}</span>
                            </div>

                            {/* Verification QR Code */}
                            <div className="flex items-center gap-3 mt-1 bg-white p-2 rounded-xl border border-white/10 shrink-0">
                              <QRCodeCanvas value={`${window.location.origin}/verify/${selectedUser.matricule.replace(/\//g, '_')}`} size={64} level="M" />
                              <div className="text-left leading-none text-slate-900">
                                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wider block">VÉRIFIER</span>
                                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-normal leading-tight block">Authenticité<br/>en ligne</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* DOCUMENTS RH BLOCK */
                  <div className="space-y-8 py-4">
                    {/* Document Header & Stats */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 dark:bg-slate-900/40 p-6 rounded-3xl border border-slate-100 dark:border-slate-800">
                      <div>
                        <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
                          Contrats & Avenants de {selectedUser.fullName}
                        </h4>
                        <p className="text-xs text-slate-500 mt-1 uppercase font-semibold tracking-wider">
                          {userDocs.length} document{userDocs.length > 1 ? 's' : ''} enregistré{userDocs.length > 1 ? 's' : ''}
                        </p>
                      </div>
                      
                      {/* Search docs */}
                      <div className="relative w-full sm:w-64">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                          type="text"
                          placeholder="Rechercher un document..."
                          value={documentSearchTerm}
                          onChange={(e) => setDocumentSearchTerm(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-white uppercase tracking-wider"
                        />
                      </div>
                    </div>

                    {/* Upload Section - Only visible to HR department or ADMINS */}
                    {(profile?.role === "ADMIN" || profile?.role === "SUPER_ADMIN" || profile?.departmentId === "RH") && (
                      <form onSubmit={handleAddUserDocument} className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 space-y-4">
                        <div className="flex items-center gap-2 mb-2 text-emerald-600 dark:text-emerald-400">
                          <Plus size={16} />
                          <span className="text-xs font-black uppercase tracking-widest">Ajouter un nouveau document RH</span>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1.5">
                              Titre du Document
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="Ex: Contrat de travail, Avenant de salaire..."
                              value={newDocTitle}
                              onChange={(e) => setNewDocTitle(e.target.value)}
                              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1.5">
                              Type de Document
                            </label>
                            <select
                              value={newDocType}
                              onChange={(e) => setNewDocType(e.target.value as "contract" | "avenant")}
                              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-white"
                            >
                              <option value="contract">Contrat</option>
                              <option value="avenant">Avenant</option>
                            </select>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
                          <div className="w-full">
                            <input
                              type="file"
                              id="doc-file-input"
                              required
                              onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                  setSelectedFile(e.target.files[0]);
                                }
                              }}
                              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                              className="hidden"
                            />
                            <label
                              htmlFor="doc-file-input"
                              className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 rounded-xl text-xs font-bold text-slate-500 hover:text-emerald-600 transition-all cursor-pointer bg-slate-50 dark:bg-slate-800/50"
                            >
                              <FileText size={16} />
                              {selectedFile ? (
                                <span className="text-emerald-600 font-bold truncate max-w-xs">{selectedFile.name}</span>
                              ) : (
                                <span>Choisir un fichier (PDF, image, doc...)</span>
                              )}
                            </label>
                          </div>
                          
                          <button
                            type="submit"
                            disabled={isDocUploading}
                            className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 shrink-0"
                          >
                            {isDocUploading ? (
                              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                              <>
                                <Plus size={14} />
                                <span>Ajouter</span>
                              </>
                            )}
                          </button>
                        </div>
                      </form>
                    )}

                    {/* Document List */}
                    {isDocsLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <div className="w-8 h-8 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin"></div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {userDocs
                          .filter(d => d.title.toLowerCase().includes(documentSearchTerm.toLowerCase()))
                          .length === 0 ? (
                            <div className="text-center py-16 bg-slate-50 dark:bg-slate-900/20 rounded-[2rem] border border-slate-100 dark:border-slate-800 border-dashed">
                              <FileText size={40} className="mx-auto text-slate-300 dark:text-slate-700 mb-3" />
                              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                                Aucun contrat ni avenant enregistré pour cet employé.
                              </p>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {userDocs
                                .filter(d => d.title.toLowerCase().includes(documentSearchTerm.toLowerCase()))
                                .map((docItem) => (
                                  <div
                                    key={docItem.id}
                                    className="bg-white dark:bg-slate-900 p-5 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between hover:shadow-md transition-all group"
                                  >
                                    <div>
                                      <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-2">
                                          <div className={`p-2.5 rounded-xl ${
                                            docItem.category === "contract" 
                                              ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400" 
                                              : "bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400"
                                          }`}>
                                            {docItem.category === "contract" ? <Shield size={16} /> : <FileText size={16} />}
                                          </div>
                                          <div>
                                            <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest ${
                                              docItem.category === "contract" 
                                                ? "bg-blue-100/60 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400" 
                                                : "bg-purple-100/60 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400"
                                            }`}>
                                              {docItem.category === "contract" ? "Contrat" : "Avenant"}
                                            </span>
                                          </div>
                                        </div>
                                        
                                        {(profile?.role === "ADMIN" || profile?.role === "SUPER_ADMIN" || profile?.departmentId === "RH") && (
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteUserDocument(docItem.id)}
                                            className="p-1.5 hover:bg-red-50 hover:text-red-500 rounded-lg text-slate-400 transition-all opacity-0 group-hover:opacity-100"
                                            title="Supprimer ce document"
                                          >
                                            <Trash2 size={14} />
                                          </button>
                                        )}
                                      </div>

                                      <h5 className="text-xs font-black text-slate-950 dark:text-white uppercase tracking-tight mb-1 line-clamp-2">
                                        {docItem.title}
                                      </h5>
                                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-4">
                                        Ajouté le {new Date(docItem.createdAt).toLocaleDateString("fr-FR")}
                                      </p>
                                    </div>

                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        onClick={() => setPreviewDoc(docItem)}
                                        className="flex-1 py-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-black text-[9px] uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-1.5"
                                      >
                                        <Eye size={12} />
                                        <span>Aperçu</span>
                                      </button>
                                      
                                      <a
                                        href={docItem.fileUrl}
                                        download={docItem.title}
                                        className="px-3 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center"
                                        title="Télécharger"
                                      >
                                        <Download size={12} />
                                      </a>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          )}
                      </div>
                    )}

                    {/* Inline PDF / Image Preview Modal inside the Documents RH flow */}
                    {previewDoc && (
                      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                        <div 
                          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
                          onClick={() => setPreviewDoc(null)}
                        />
                        <div className="relative w-full max-w-4xl h-[85vh] bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col z-[121]">
                          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
                            <div>
                              <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
                                Aperçu : {previewDoc.title}
                              </h4>
                              <p className="text-[10px] text-slate-450 dark:text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                                Matricule de l'employé : {previewDoc.userId}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setPreviewDoc(null)}
                              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all text-slate-400"
                            >
                              <X size={20} />
                            </button>
                          </div>
                          
                          <div className="flex-1 bg-slate-100 dark:bg-slate-950 p-6 flex items-center justify-center overflow-auto">
                            {previewDoc.fileUrl.startsWith("data:image/") || previewDoc.fileUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                              <img
                                src={previewDoc.fileUrl}
                                alt={previewDoc.title}
                                className="max-h-full max-w-full object-contain rounded-xl shadow-md"
                              />
                            ) : previewDoc.fileUrl.startsWith("data:application/pdf") ? (
                              <iframe
                                src={previewDoc.fileUrl}
                                title={previewDoc.title}
                                className="w-full h-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white"
                              />
                            ) : (
                              <div className="text-center p-8 bg-white dark:bg-slate-900 rounded-3xl max-w-md shadow-md border border-slate-100 dark:border-slate-800">
                                <FileText size={48} className="mx-auto text-emerald-600 mb-4 animate-bounce" />
                                <p className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2">
                                  Format Aperçu non-interactif
                                </p>
                                <p className="text-xs text-slate-500 mb-6">
                                  Ce type de document ne peut pas être affiché directement en ligne dans l'application. Vous pouvez néanmoins le télécharger pour le consulter localement sur votre ordinateur.
                                </p>
                                <a
                                  href={previewDoc.fileUrl}
                                  download={previewDoc.title}
                                  className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-emerald-900/20"
                                >
                                  <Download size={14} />
                                  Télécharger maintenant
                                </a>
                              </div>
                            )}
                          </div>

                          {/* Sceau et Signature du DG validation footer */}
                          <div className="p-6 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4">
                            <div className="flex items-center gap-3">
                              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl shrink-0">
                                <Check size={18} />
                              </div>
                              <div className="text-left">
                                <p className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">Authentifié & Signé par la Direction Générale</p>
                                <p className="text-[10px] text-slate-450 dark:text-slate-500 font-bold uppercase tracking-wider">Validité contractuelle légale et sceau numérique Riberjo</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-6">
                              {/* Seal stamp */}
                              <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
                                {settings?.dgSealUrl ? (
                                  <img src={settings.dgSealUrl} alt="Sceau Officiel" className="max-h-full max-w-full object-contain rotate-12 opacity-95" />
                                ) : (
                                  <div className="w-12 h-12 text-red-600 rotate-12 flex items-center justify-center">
                                    <svg width="48" height="48" viewBox="0 0 100 100">
                                      <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="4" />
                                      <circle cx="50" cy="50" r="37" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3,3" />
                                      <path id="sealPathPreview" d="M 15 50 A 35 35 0 0 1 85 50" fill="none" stroke="none" />
                                      <text className="text-[10px] font-black fill-red-600 uppercase tracking-widest">
                                        <textPath href="#sealPathPreview" startOffset="50%" textAnchor="middle">RIBERJO</textPath>
                                      </text>
                                      <path id="sealPathPreviewBottom" d="M 85 50 A 35 35 0 0 1 15 50" fill="none" stroke="none" />
                                      <text className="text-[7.5px] font-black fill-red-600 uppercase tracking-tight">
                                        <textPath href="#sealPathPreviewBottom" startOffset="50%" textAnchor="middle">DIRECTION</textPath>
                                      </text>
                                    </svg>
                                  </div>
                                )}
                              </div>
                              {/* Signature */}
                              <div className="text-right flex flex-col items-end relative min-w-[100px]">
                                {settings?.dgSignatureUrl ? (
                                  <img src={settings.dgSignatureUrl} alt="Signature Officielle" className="h-10 object-contain pointer-events-none mb-1 max-w-[120px]" />
                                ) : (
                                  <div className="h-6 w-20 border-b border-slate-300 dark:border-slate-700 mb-1 opacity-40"></div>
                                )}
                                <p className="text-[9px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">{settings?.dgName || "Directeur Général"}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
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

      <AnimatePresence>
        {resetPasswordConfirmation && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setResetPasswordConfirmation(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800 p-8 text-center"
            >
              <div className="w-16 h-16 bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto mb-6 text-indigo-600 dark:text-indigo-400">
                <KeyRound size={32} />
              </div>
              <h3 className="text-lg font-black text-slate-950 dark:text-white uppercase tracking-tight mb-2">
                Réinitialisation de Mot de Passe
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 font-medium">
                Vous allez réinitialiser le mot de passe pour l'agent{" "}
                <span className="font-extrabold text-slate-800 dark:text-slate-200">
                  {resetPasswordConfirmation.fullName}
                </span>{" "}
                ({resetPasswordConfirmation.matricule}).
              </p>

              <div className="mb-6 text-left">
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-2">
                  Définir un mot de passe personnalisé (Optionnel)
                </label>
                <input
                  type="text"
                  placeholder="Laisser vide pour générer aléatoirement"
                  value={newCustomPassword}
                  onChange={(e) => setNewCustomPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600"
                />
              </div>

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setResetPasswordConfirmation(null);
                    setNewCustomPassword("");
                  }}
                  className="flex-grow flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-2xl active:scale-95 transition-all uppercase text-xs tracking-widest"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={isUpdating === resetPasswordConfirmation.userId}
                  onClick={() => handleResetUserPassword(resetPasswordConfirmation.userId, newCustomPassword)}
                  className="flex-grow flex-1 py-4 bg-indigo-600 hover:bg-indigo-550 text-white font-bold rounded-2xl shadow-xl shadow-indigo-900/20 active:scale-95 transition-all uppercase text-xs tracking-widest"
                >
                  {isUpdating === resetPasswordConfirmation.userId ? "En cours..." : "Réinitialiser"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {imageToCrop && cropperType === 'cardPhoto' && (
          <ImageCropper
            image={imageToCrop}
            onCropComplete={onCropComplete}
            onCancel={() => {
              setImageToCrop(null);
              setCropperType(null);
            }}
            aspect={1}
            circular={false}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
