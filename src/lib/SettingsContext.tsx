import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { AppSettings } from '../types';

interface SettingsContextType {
  settings: AppSettings | null;
  loading: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen to the unique settings document
    const path = 'settings/global';
    const unsub = onSnapshot(
      doc(db, path), 
      (doc) => {
        if (doc.exists()) {
          const data = doc.data() as AppSettings;
          setSettings(data);
          
          // Update CSS Variables for branding
          if (data.primaryColor) {
            document.documentElement.style.setProperty('--primary-brand', data.primaryColor);
          }

          // Update Favicon to match the platform logo
          if (data.logoUrl) {
            const faviconElement = document.getElementById('favicon') as HTMLLinkElement | null;
            if (faviconElement) {
              faviconElement.href = data.logoUrl;
            }
          }
        }
        setLoading(false);
      },
      (error) => {
        // If settings fail to load (e.g. before login if rules were restrictive)
        // we handle it gracefully by letting the app continue with defaults or null
        // We still use handleFirestoreError for logging as per instructions, but we catch the throw
        try {
          handleFirestoreError(error, OperationType.GET, path);
        } catch (e) {
          // Silent catch - handleFirestoreError already logged the formatted error
        }
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, loading }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
