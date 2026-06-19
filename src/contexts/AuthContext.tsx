import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, getDoc, onSnapshot, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut as firebaseSignOut, signInAnonymously } from 'firebase/auth';
import { db, auth, handleFirestoreError, OperationType, getDocSafe } from '../lib/firebase';
import { UserProfile, RolePermission } from '../types';

interface AuthContextType {
  user: { uid: string } | null;
  profile: UserProfile | null;
  loading: boolean;
  firebaseUser: any | null;
  signIn: (matricule: string, password: string) => Promise<boolean>;
  signInWithGoogle: () => Promise<boolean>;
  signOut: () => Promise<void>;
  changePassword: (newPassword: string) => Promise<boolean>;
  hasPermission: (permission: keyof RolePermission['permissions']) => boolean;
  roleLabel: string;
  simulatedProfile?: UserProfile | null;
  setSimulatedProfile?: (profile: UserProfile | null | undefined) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [matricule, setMatricule] = useState<string | null>(localStorage.getItem('riberjo_matricule'));
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [simulatedProfile, setSimulatedProfile] = useState<UserProfile | null | undefined>(undefined);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(!!localStorage.getItem('riberjo_matricule'));
  const loading = authLoading || profileLoading;
  const [firebaseUser, setFirebaseUser] = useState<any>(null);
  const [rolePermissions, setRolePermissions] = useState<Record<string, RolePermission['permissions']>>({});
  const [roleLabels, setRoleLabels] = useState<Record<string, string>>({});

  const activeProfile = simulatedProfile !== undefined ? simulatedProfile : profile;

  useEffect(() => {
    // Proactively secure and auto-bootstrap Board Member role in Firestore
    const ensureBoardRole = async () => {
       try {
         const ref = doc(db, 'role_permissions', 'BOARD_MEMBER');
         const snap = await getDoc(ref);
         if (!snap.exists()) {
           await setDoc(ref, {
             role: 'BOARD_MEMBER',
             label: "Conseil d'Administration",
             description: 'Accès en lecture seule à tous les départements pour observation.',
             permissions: {
               manageUsers: false, manageDept: false, validateReports: false, manageAssets: false,
               manageProtocols: false, manageSettings: false, viewReports: true, createTasks: false, accessArchive: true
             }
           });
         }
       } catch (e) {
         console.warn("Skip auto-provisioning BOARD_MEMBER:", e);
       }
    };
    ensureBoardRole();

    // Listen to role permissions globally
    const unsubscribe = onSnapshot(collection(db, 'role_permissions'), 
      (snapshot) => {
        const perms: Record<string, RolePermission['permissions']> = {};
        const labels: Record<string, string> = {};
        snapshot.forEach(doc => {
          const data = doc.data() as RolePermission;
          perms[data.role] = data.permissions;
          labels[data.role] = data.label;
        });
        setRolePermissions(perms);
        setRoleLabels(labels);
      },
      (error) => {
        console.warn("Global role permissions snapshot operates in local cache/fallback mode:", error.message);
      }
    );
    return () => unsubscribe();
  }, []);

  const hasPermission = (permission: keyof RolePermission['permissions']): boolean => {
    if (!activeProfile) return false;
    // SUPER_ADMIN always has all permissions
    if (activeProfile.role === 'SUPER_ADMIN') return true;
    
    if (activeProfile.role === 'BOARD_MEMBER') {
      return permission === 'viewReports' || permission === 'accessArchive';
    }
    
    const perms = rolePermissions[activeProfile.role];
    if (!perms) return false;
    
    return perms[permission] === true;
  };

  const roleLabel = activeProfile ? (roleLabels[activeProfile.role] || activeProfile.role.replace('_', ' ')) : '';

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user && !matricule) {
        // Try to find a profile with this authUid
        try {
          const usersRef = collection(db, 'users');
          const q = query(usersRef, where('authUid', '==', user.uid));
          const snap = await getDocs(q);
          if (!snap.empty) {
            const data = snap.docs[0].data() as UserProfile;
            localStorage.setItem('riberjo_matricule', data.matricule);
            setProfileLoading(true);
            setMatricule(data.matricule);
          } else if (user.email) {
            // Check by email as fallback
            const userEmail = user.email.trim().toLowerCase();
            const qEmail = query(usersRef, where('email', '==', userEmail));
            const snapEmail = await getDocs(qEmail);
            if (!snapEmail.empty) {
               const data = snapEmail.docs[0].data() as UserProfile;
               localStorage.setItem('riberjo_matricule', data.matricule);
               setProfileLoading(true);
               setMatricule(data.matricule);
               // Path to update authUid
               await setDoc(doc(db, 'users', snapEmail.docs[0].id), { authUid: user.uid }, { merge: true });
            } else if (userEmail === 'musamakasongo99@gmail.com') {
               // Special fallback for DG if they sign in via Google and no authUid matches yet
               const dgMatricule = '26/RBJ-DG-01';
               const sanitizedId = dgMatricule.replace(/\//g, '_');
               const dgRef = doc(db, 'users', sanitizedId);
               const dgSnap = await getDoc(dgRef);
               
               if (dgSnap.exists()) {
                 const data = dgSnap.data() as UserProfile;
                 localStorage.setItem('riberjo_matricule', data.matricule);
                 setProfileLoading(true);
                 setMatricule(data.matricule);
                 await setDoc(dgRef, { authUid: user.uid, email: 'musamakasongo99@gmail.com' }, { merge: true });
               } else {
                 // Auto-bootstrap DG profile since they signed in with the official DG email
                 const newDgProfile = {
                   id: sanitizedId,
                   fullName: "DG Musama Kasongo",
                   matricule: dgMatricule,
                   role: "SUPER_ADMIN",
                   departmentId: "Direction Générale",
                   status: "active",
                   email: "musamakasongo99@gmail.com",
                   password: "Riberjo202!",
                   passwordChanged: false,
                   authUid: user.uid,
                   createdAt: Date.now()
                 };
                 await setDoc(dgRef, newDgProfile);
                 localStorage.setItem('riberjo_matricule', dgMatricule);
                 setProfileLoading(true);
                 setMatricule(dgMatricule);
               }
            }
          }
        } catch (err) {
          console.warn("Error finding profile by authUid/email:", err);
        }
      }
      
      if (!user) {
        signInAnonymously(auth).catch(err => {
          console.warn("Anonymous auth not available:", err.message);
        });
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, [matricule]);

  useEffect(() => {
    if (!matricule) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    setProfileLoading(true);
    const sanitizedId = matricule.replace(/\//g, '_');
    const docRef = doc(db, 'users', sanitizedId);

    const unsubscribe = onSnapshot(
      docRef,
      async (snapshot: any) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as UserProfile;
          
          // Normalize legacy department IDs/names to official system identifiers
          let normalizedDept = data.departmentId || '';
          const cleanDept = normalizedDept.trim().toLowerCase();
          if (
            cleanDept === '03' ||
            cleanDept === 'rh' || 
            cleanDept === 'rhu' || 
            cleanDept.includes('ressources') || 
            cleanDept.includes('personnel') || 
            cleanDept.includes('human')
          ) {
            normalizedDept = '03';
          } else if (cleanDept === '01' || cleanDept.includes('ferme') || cleanDept.includes('agri')) {
            normalizedDept = '01';
          } else if (cleanDept === '02' || cleanDept.includes('santé') || cleanDept.includes('sante') || cleanDept.includes('médic') || cleanDept.includes('medic')) {
            normalizedDept = '02';
          } else if (cleanDept === '04' || cleanDept.includes('finance') || cleanDept.includes('compta')) {
            normalizedDept = '04';
          } else if (cleanDept === '05' || cleanDept.includes('logis') || cleanDept.includes('stock') || cleanDept.includes('appro')) {
            normalizedDept = '05';
          } else if (cleanDept === '06' || cleanDept.includes('market') || cleanDept.includes('ventes') || cleanDept.includes('commerce') || cleanDept.includes('marché') || cleanDept.includes('marche')) {
            normalizedDept = '06';
          }

          setProfile({ 
            id: snapshot.id, 
            ...data,
            departmentId: normalizedDept
          });

          // Link authUid and migrate departmentId if they differ
          const updates: any = {};
          if (!data.authUid && firebaseUser) {
            updates.authUid = firebaseUser.uid;
          }
          if (normalizedDept !== data.departmentId) {
            updates.departmentId = normalizedDept;
          }

          if (Object.keys(updates).length > 0) {
             try {
               await setDoc(docRef, updates, { merge: true });
             } catch (err) {
               console.warn("Could not update/link profile data:", err);
             }
          }
        } else {
          // If the snapshot says the document doesn't exist but has been loaded from the local cache (offline first emit),
          // do NOT clear the session or log out! Wait until the server authoritative response arrives.
          if (snapshot.metadata.fromCache) {
            console.log("Profile not found in cache yet, waiting for server response...");
            return;
          }
          setProfile(null);
          if (matricule !== "26/RBJ-DG-01") {
            setProfileLoading(false);
            setMatricule(null);
            localStorage.removeItem('riberjo_matricule');
          }
        }
        setProfileLoading(false);
      },
      (error) => {
        if (matricule) {
          console.warn("Profile snapshot error:", error.message);
        }
        setProfileLoading(false);
      }
    );

    return () => unsubscribe();
  }, [matricule, firebaseUser]);

  const signIn = async (inputMatricule: string, inputPassword: string) => {
    setProfileLoading(true);
    const sanitizedId = inputMatricule.replace(/\//g, '_');
    const isDG = inputMatricule === "26/RBJ-DG-01";
    const isDGPwd = inputPassword === "Riberjo202!" || inputPassword === "DG_ACCESS_2026";
    
    try {
      const docRef = doc(db, 'users', sanitizedId);
      const snapshot = await getDocSafe(docRef);

      if (snapshot.exists()) {
        const userData = snapshot.data() as UserProfile & { password?: string };
        
        // Custom logic for DG: if password matches any of the bootstrap passwords, allow it
        if (userData.password === inputPassword || (isDG && isDGPwd)) {
          // Update password or link authUid if needed
          const updates: any = {};
          if (isDG && isDGPwd && userData.password !== inputPassword) {
            updates.password = inputPassword;
          }
          // Link or update the authUid to match the current Firebase Auth user (anonymous or Google)
          // on successful password login, so they are linked and can switch accounts correctly.
          if (firebaseUser && userData.authUid !== firebaseUser.uid) {
            updates.authUid = firebaseUser.uid;
          }
          
          if (Object.keys(updates).length > 0) {
            await setDoc(docRef, updates, { merge: true });
          }
          
          localStorage.setItem('riberjo_matricule', inputMatricule);
          setProfileLoading(true);
          setMatricule(inputMatricule);
          return true;
        }
      } else {
        // Bootstrap Super Admin if it's the first time and the credentials match
        if (isDG && isDGPwd) {
          // Create the document first to avoid snapshot errors
          await setDoc(docRef, {
            fullName: "DG Musama Kasongo",
            matricule: "26/RBJ-DG-01",
            role: "SUPER_ADMIN",
            departmentId: "Direction Générale",
            status: "active",
            password: inputPassword,
            passwordChanged: false,
            authUid: firebaseUser?.uid || null,
            email: "musamakasongo99@gmail.com",
            createdAt: Date.now()
          });
          
          localStorage.setItem('riberjo_matricule', inputMatricule);
          setProfileLoading(true);
          setMatricule(inputMatricule);
          return true;
        }
      }
      setProfileLoading(false);
      return false;
    } catch (error) {
      console.error("Login error:", error);
      setProfileLoading(false);
      return false;
    }
  };

  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      return true;
    } catch (error) {
      console.error("Google sign-in error:", error);
      return false;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (err) {
      console.error("Firebase signOut error:", err);
    }
    localStorage.removeItem('riberjo_matricule');
    setProfile(null);
    setProfileLoading(false);
    setMatricule(null);
  };

  const changePassword = async (newPassword: string) => {
    if (!profile || !matricule) return false;
    const sanitizedId = matricule.replace(/\//g, '_');
    try {
      await setDoc(doc(db, 'users', sanitizedId), {
        password: newPassword,
        passwordChanged: true
      }, { merge: true });
      return true;
    } catch (err) {
      console.error("Error changing password:", err);
      return false;
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user: simulatedProfile !== undefined 
        ? (simulatedProfile ? { uid: simulatedProfile.matricule.replace(/\//g, '_') } : null) 
        : (matricule ? { uid: matricule.replace(/\//g, '_') } : null), 
      profile: activeProfile, 
      loading: simulatedProfile !== undefined ? false : loading, 
      firebaseUser,
      signIn,
      signInWithGoogle,
      signOut,
      changePassword,
      hasPermission,
      roleLabel,
      simulatedProfile,
      setSimulatedProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
