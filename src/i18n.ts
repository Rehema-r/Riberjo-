import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
  fr: {
    translation: {
      "Dashboard": "Tableau de Bord",
      "Attendance": "Présences",
      "Payroll": "Paie & Salaires",
      "Departments": "Départements",
      "Settings": "Paramètres",
      "Logout": "Déconnexion",
      "Welcome": "Bienvenue",
      "Users": "Utilisateurs"
    }
  },
  en: {
    translation: {
      "Dashboard": "Dashboard",
      "Attendance": "Attendance",
      "Payroll": "Payroll",
      "Departments": "Departments",
      "Settings": "Settings",
      "Logout": "Logout",
      "Welcome": "Welcome",
      "Users": "Users"
    }
  },
  sw: {
    translation: {
      "Dashboard": "Dashibodi",
      "Attendance": "Mahudhurio",
      "Payroll": "Mshahara",
      "Departments": "Idara",
      "Settings": "Mipangilio",
      "Logout": "Ondoka",
      "Welcome": "Karibu",
      "Users": "Watumiaji"
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'fr',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
