import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Lock } from 'lucide-react';
import FarmView from './departments/FarmView';
import HealthView from './departments/HealthView';
import FinanceView from './departments/FinanceView';
import LogisticsView from './departments/LogisticsView';
import MarketingView from './departments/MarketingView';
import HRView from './departments/HRView';
import SchoolView from './departments/SchoolView';

export default function DepartmentHub({ departmentId }: { departmentId?: string }) {
  const { profile } = useAuth();
  
  // Choose default space based on role
  const initSpace = (profile?.role === 'ADMIN' || profile?.role === 'SUPER_ADMIN' || profile?.role === 'BOARD_MEMBER') 
    ? 'ADMIN' 
    : (profile?.role === 'SUPER_USER') 
      ? 'SUPER_USER' 
      : 'USER';
    
  const [activeSpace, setActiveSpace] = useState<'USER' | 'SUPER_USER' | 'ADMIN'>(initSpace);

  // Authorization rules
  const canAccessUser = profile?.role === 'USER' || profile?.role === 'ADMIN' || profile?.role === 'SUPER_ADMIN' || profile?.role === 'BOARD_MEMBER';
  const canAccessSuperUser = profile?.role === 'SUPER_USER' || profile?.role === 'ADMIN' || profile?.role === 'SUPER_ADMIN' || profile?.role === 'BOARD_MEMBER';
  const canAccessAdmin = profile?.role === 'ADMIN' || profile?.role === 'SUPER_ADMIN' || profile?.role === 'BOARD_MEMBER';

  useEffect(() => {
    if (profile) {
      const nextSpace = (profile.role === 'ADMIN' || profile.role === 'SUPER_ADMIN' || profile.role === 'BOARD_MEMBER') 
        ? 'ADMIN' 
        : (profile.role === 'SUPER_USER') 
          ? 'SUPER_USER' 
          : 'USER';
      setActiveSpace(nextSpace);
    }
  }, [profile]);
  
  // If no departmentId is passed, use the user's primary department
  const activeDeptId = departmentId || profile?.departmentId;

  const renderDepartment = () => {
    switch (activeDeptId) {
      case '01':
        return <FarmView activeSpace={activeSpace} />;
      case '02':
        return <HealthView activeSpace={activeSpace} />;
      case '03':
        return <HRView activeSpace={activeSpace} />;
      case '04':
        return <FinanceView activeSpace={activeSpace} />;
      case '05':
        return <LogisticsView activeSpace={activeSpace} />;
      case '06':
        return <MarketingView activeSpace={activeSpace} />;
      case '07':
        return <SchoolView activeSpace={activeSpace} />;
      default:
        return (
          <div className="flex flex-col items-center justify-center h-full p-12 text-center">
            <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center text-slate-300 mb-6">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            </div>
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-2">Département non trouvé</h2>
            <p className="text-slate-500 max-w-sm">Vous n'avez pas de département assigné ou le département spécifié n'existe pas dans le système.</p>
          </div>
        );
    }
  };

  // The DG (SUPER_ADMIN) is not allowed to navigate inside specific department workspaces of other members
  if (profile?.role === 'SUPER_ADMIN') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-12 text-center bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-150 dark:border-slate-800 shadow-sm">
        <div className="w-20 h-20 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-3xl flex items-center justify-center mb-6 shadow-sm animate-bounce">
          <Lock size={40} />
        </div>
        <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-2">Accès restreint</h2>
        <p className="text-slate-500 dark:text-slate-400 max-w-md font-medium">
          Le Directeur Général (DG) n'a pas l'autorisation d'accéder aux espaces de travail spécifiques des départements des autres membres.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="h-full">
        {renderDepartment()}
      </div>
    </div>
  );
}
