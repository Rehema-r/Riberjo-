import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer, enableIndexedDbPersistence, getDoc, getDocFromCache, setLogLevel } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Set Firebase Firestore log level to only log severe errors, preventing false-positive connectivity warnings in standard browser iframe setups.
setLogLevel('error');

// Using initializeFirestore with experimentalForceLongPolling which is more robust in restricted environments
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);

// Enable offline persistence
if (typeof window !== 'undefined') {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn("Persistence failed: Multiple tabs open");
    } else if (err.code === 'unimplemented') {
      console.warn("Persistence is not supported by this browser");
    }
  });
}

export const auth = getAuth(app);

// Safe getDoc that falls back to cache instantly if the server doesn't respond or throws offline error
export async function getDocSafe(docRef: any) {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('TIMEOUT')), 15000);
  });

  try {
    const result = await Promise.race([
      getDoc(docRef),
      timeoutPromise
    ]);
    return result;
  } catch (error: any) {
    console.warn("getDocSafe server fetch failed or timed out, trying cache...", error.message || error);
    try {
      const cachedDoc = await getDocFromCache(docRef);
      if (cachedDoc.exists()) {
        return cachedDoc;
      }
    } catch (cacheError: any) {
      console.warn("getDocSafe cache fetch also failed or document not in cache:", cacheError.message || cacheError);
    }
    
    // If both server fetch and cache fetch failed/timed out, return a mock empty non-existent document snapshot
    // to prevent the application from throwing unhandled exceptions and crashing at startup.
    return {
      exists: () => false,
      id: docRef.id,
      ref: docRef,
      data: () => undefined,
      get: () => undefined,
      metadata: { fromCache: true, hasPendingWrites: false }
    } as any;
  }
}

// Validate connection more gracefully
async function testConnection() {
  try {
    // Attempt a silent fetch to check connectivity
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection successful");
  } catch (error: any) {
    // Only log if it's a persistent error, but don't crash
    console.warn("Firestore connectivity check:", error.message);
  }
}
setTimeout(() => {
  testConnection().catch(() => {});
}, 2000);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const currentUser = auth.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid || null,
      email: currentUser?.email || null,
      emailVerified: currentUser?.emailVerified || null,
      isAnonymous: currentUser?.isAnonymous || null,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
