import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import FarmView from './departments/FarmView';
import HealthView from './departments/HealthView';
import FinanceView from './departments/FinanceView';
import LogisticsView from './departments/LogisticsView';
import MarketingView from './departments/MarketingView';
import HRView from './departments/HRView';

export default function DepartmentHub({ departmentId }: { departmentId?: string }) {
  const { profile } = useAuth();
  
  // If no departmentId is passed, use the user's primary department
  const activeDeptId = departmentId || profile?.departmentId;

  const renderDepartment = () => {
    switch (activeDeptId) {
      case '01':
        return <FarmView />;
      case '02':
        return <HealthView />;
      case '03':
        return <HRView />;
      case '04':
        return <FinanceView />;
      case '05':
        return <LogisticsView />;
      case '06':
        return <MarketingView />;
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

  return (
    <div className="h-full">
      {renderDepartment()}
    </div>
  );
}
