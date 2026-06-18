import { db } from '../lib/firebase';
import { doc, setDoc, writeBatch, collection, getDocs } from 'firebase/firestore';
import { UserProfile, RolePermission, Department } from '../types';

export const TEST_ACCOUNTS = [
  {
    matricule: "26/RBJ-DG-01",
    fullName: "DG Musama Kasongo",
    role: "SUPER_ADMIN" as const,
    password: "Riberjo202!",
    departmentId: "Direction Générale"
  },
  {
    matricule: "26/RBJ-AD-03-001",
    fullName: "Chef Ressources Humaines",
    role: "ADMIN" as const,
    password: "Riberjo202!",
    departmentId: "03"
  },
  {
    matricule: "26/RBJ-SU-04-001",
    fullName: "Chef Comptabilité & Finance",
    role: "SUPER_USER" as const,
    password: "Riberjo202!",
    departmentId: "04"
  },
  {
    matricule: "26/RBJ-US-01-001",
    fullName: "Agent de Production Agricole",
    role: "USER" as const,
    password: "Riberjo202!",
    departmentId: "01"
  },
  {
    matricule: "CLT-RBJ-000001",
    fullName: "Client Démo Riberjo",
    role: "CLIENT" as const,
    password: "Riberjo202!",
    departmentId: "CLIENT"
  }
];

export const DEPARTMENTS: Department[] = [
  { id: "01", name: "Production Agricole & Elevage", code: "FERME", description: "Gestion des activités agro-pastorales de la ferme Riberjo." },
  { id: "02", name: "Santé & Médecine", code: "SANTE", description: "Services médicaux et cliniques pour le personnel et les patients." },
  { id: "03", name: "Ressources Humaines", code: "RH", description: "Gestion du personnel, contrats, paie et carrières." },
  { id: "04", name: "Finance & Comptabilité", code: "FINANCE", description: "Gestion financière, transactions et audits." },
  { id: "05", name: "Logistique & Approvisionnement", code: "LOG", description: "Gestion des stocks, matériel et transports." },
  { id: "06", name: "Marketing & Ventes", code: "MKT", description: "Commerce, boutique et relations clients." },
  { id: "DG", name: "Direction Générale", code: "DG", description: "Administration centrale et pilotage stratégique." }
];

export const ROLE_PERMISSIONS: RolePermission[] = [
  {
    role: 'SUPER_ADMIN',
    label: 'Directeur Général',
    description: 'Accès total à tous les systèmes et paramètres.',
    permissions: {
      manageUsers: true, manageDept: true, validateReports: true, manageAssets: true,
      manageProtocols: true, manageSettings: true, viewReports: true, createTasks: true, accessArchive: true
    }
  },
  {
    role: 'ADMIN',
    label: 'Administrateur',
    description: 'Gestion administrative et opérationnelle.',
    permissions: {
      manageUsers: true, manageDept: true, validateReports: true, manageAssets: true,
      manageProtocols: true, manageSettings: false, viewReports: true, createTasks: true, accessArchive: true
    }
  },
  {
    role: 'SUPER_USER',
    label: 'Chef de Service',
    description: 'Gestion d\'un département spécifique.',
    permissions: {
      manageUsers: false, manageDept: false, validateReports: true, manageAssets: true,
      manageProtocols: true, manageSettings: false, viewReports: true, createTasks: true, accessArchive: false
    }
  },
  {
    role: 'USER',
    label: 'Agent / Collaborateur',
    description: 'Accès aux outils de travail quotidien.',
    permissions: {
      manageUsers: false, manageDept: false, validateReports: false, manageAssets: false,
      manageProtocols: false, manageSettings: false, viewReports: false, createTasks: false, accessArchive: false
    }
  },
  {
    role: 'CLIENT',
    label: 'Client / Partenaire',
    description: 'Accès à l\'espace client et services.',
    permissions: {
      manageUsers: false, manageDept: false, validateReports: false, manageAssets: false,
      manageProtocols: false, manageSettings: false, viewReports: false, createTasks: false, accessArchive: false
    }
  },
  {
    role: 'BOARD_MEMBER',
    label: 'Conseil d\'Administration',
    description: 'Accès en lecture seule à tous les départements pour observation.',
    permissions: {
      manageUsers: false, manageDept: false, validateReports: false, manageAssets: false,
      manageProtocols: false, manageSettings: false, viewReports: true, createTasks: false, accessArchive: true
    }
  }
];

export async function seedApp() {
  console.log("Starting application seed...");
  const batch = writeBatch(db);

  // 1. Seed Departments
  DEPARTMENTS.forEach(dept => {
    const ref = doc(db, 'departments', dept.id);
    batch.set(ref, dept);
  });

  // 2. Seed Role Permissions
  ROLE_PERMISSIONS.forEach(perm => {
    const ref = doc(db, 'role_permissions', perm.role);
    batch.set(ref, perm);
  });

  // 3. Seed Test Accounts
  TEST_ACCOUNTS.forEach(account => {
    const sanitizedId = account.matricule.replace(/\//g, '_');
    const ref = doc(db, 'users', sanitizedId);
    
    const profile: UserProfile = {
      id: sanitizedId,
      fullName: account.fullName,
      matricule: account.matricule,
      email: account.matricule === "26/RBJ-DG-01" ? "musamakasongo99@gmail.com" : `${sanitizedId.toLowerCase()}@riberjo.com`,
      role: account.role,
      departmentId: account.departmentId,
      status: 'active',
      password: account.password,
      passwordChanged: false,
      createdAt: Date.now()
    };
    
    batch.set(ref, profile);

    // Also seed ClientProfile if it's a client
    if ((account.role as string) === 'CLIENT') {
      const clientRef = doc(db, 'clients', sanitizedId);
      batch.set(clientRef, {
        id: sanitizedId,
        fullName: account.fullName,
        phone: "000000000",
        email: "client@test.com",
        address: "Test Address",
        gender: "M",
        profession: "Test",
        nationality: "Congolaise",
        type: "PREMIUM",
        qrCode: "",
        registrationDate: Date.now(),
        status: "active",
        passwordChanged: false,
        referenceNumber: account.matricule,
        serviceAuthorizations: ['agriculture', 'sante', 'education', 'commerce', 'logistique']
      });
    }
  });

  await batch.commit();
  console.log("Seed completed successfully!");
}
