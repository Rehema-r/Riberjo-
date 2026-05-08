import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, getDoc, onSnapshot, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut as firebaseSignOut, signInAnonymously } from 'firebase/auth';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { UserProfile } from '../types';

interface AuthContextType {
  user: { uid: string } | null;
  profile: UserProfile | null;
  loading: boolean;
  firebaseUser: any | null;
  signIn: (matricule: string, password: string) => Promise<boolean>;
  signInWithGoogle: () => Promise<boolean>;
  signOut: () => Promise<void>;
  changePassword: (newPassword: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [matricule, setMatricule] = useState<string | null>(localStorage.getItem('riberjo_matricule'));
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [firebaseUser, setFirebaseUser] = useState<any>(null);

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
            setMatricule(data.matricule);
          } else if (user.email) {
            // Check by email as fallback
            const qEmail = query(usersRef, where('email', '==', user.email));
            const snapEmail = await getDocs(qEmail);
            if (!snapEmail.empty) {
               const data = snapEmail.docs[0].data() as UserProfile;
               localStorage.setItem('riberjo_matricule', data.matricule);
               setMatricule(data.matricule);
               // Path to update authUid
               await setDoc(doc(db, 'users', snapEmail.docs[0].id), { authUid: user.uid }, { merge: true });
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
      setLoading(false);
    });
    return () => unsubscribe();
  }, [matricule]);

  useEffect(() => {
    if (!matricule) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const sanitizedId = matricule.replace(/\//g, '_');
    const docRef = doc(db, 'users', sanitizedId);

    const unsubscribe = onSnapshot(
      docRef,
      async (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as UserProfile;
          setProfile({ id: snapshot.id, ...data });

          // Link authUid if not linked and we have a firebase user
          if (!data.authUid && firebaseUser) {
             try {
               await setDoc(docRef, { authUid: firebaseUser.uid }, { merge: true });
             } catch (err) {
               console.warn("Could not link authUid:", err);
             }
          }
        } else {
          setProfile(null);
          if (matricule !== "26/RBJ-DG-01") {
            setMatricule(null);
            localStorage.removeItem('riberjo_matricule');
          }
        }
        setLoading(false);
      },
      (error) => {
        if (matricule) {
          console.warn("Profile snapshot error:", error.message);
        }
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [matricule, firebaseUser]);

  const signIn = async (inputMatricule: string, inputPassword: string) => {
    setLoading(true);
    const sanitizedId = inputMatricule.replace(/\//g, '_');
    
    try {
      const docRef = doc(db, 'users', sanitizedId);
      const snapshot = await getDoc(docRef);

      if (snapshot.exists()) {
        const userData = snapshot.data() as UserProfile & { password?: string };
        if (userData.password === inputPassword) {
          localStorage.setItem('riberjo_matricule', inputMatricule);
          setMatricule(inputMatricule);
          return true;
        }
      } else {
        // Bootstrap Super Admin if it's the first time and the credentials match
        if (inputMatricule === "26/RBJ-DG-01" && inputPassword === "Riberjo202!") {
          // Create the document first to avoid snapshot errors
          await setDoc(docRef, {
            fullName: "Directeur Général (Bootstrap)",
            matricule: "26/RBJ-DG-01",
            role: "SUPER_ADMIN",
            departmentId: "Direction Générale",
            status: "active",
            password: "Riberjo202!",
            passwordChanged: false,
            createdAt: Date.now()
          });
          
          localStorage.setItem('riberjo_matricule', inputMatricule);
          setMatricule(inputMatricule);
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error("Login error:", error);
      return false;
    } finally {
      setLoading(false);
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
    localStorage.removeItem('riberjo_matricule');
    setMatricule(null);
    setProfile(null);
    try {
      await firebaseSignOut(auth);
    } catch (err) {
      console.error("Firebase signOut error:", err);
    }
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
      user: matricule ? { uid: matricule.replace(/\//g, '_') } : null, 
      profile, 
      loading, 
      firebaseUser,
      signIn,
      signInWithGoogle,
      signOut,
      changePassword
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
