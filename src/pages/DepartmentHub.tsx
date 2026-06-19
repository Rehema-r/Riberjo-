import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Users, Shield, Crown, Lock } from 'lucide-react';
import FarmView from './departments/FarmView';
import HealthView from './departments/HealthView';
import FinanceView from './departments/FinanceView';
import LogisticsView from './departments/LogisticsView';
import MarketingView from './departments/MarketingView';
import HRView from './departments/HRView';

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
      {/* Space Selector Banner */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600">
            {activeSpace === 'USER' ? (
              <Users size={20} />
            ) : activeSpace === 'SUPER_USER' ? (
              <Shield size={20} />
            ) : (
              <Crown size={20} className="text-amber-500" />
            )}
          </div>
          <div>
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Mode Espace de Travail</h4>
            <p className="text-sm font-black text-slate-800 dark:text-white uppercase">
              {activeSpace === 'USER' && '👥 Espace Collaborateur & Employé'}
              {activeSpace === 'SUPER_USER' && '🧠 Espace Expert & Superviseur'}
              {activeSpace === 'ADMIN' && '👑 Espace Administrateur & Directeur'}
            </p>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-1.5 bg-slate-100/80 dark:bg-slate-800/80 p-1 rounded-2xl">
          <button
            onClick={() => {
              if (canAccessUser) {
                setActiveSpace('USER');
              }
            }}
            disabled={!canAccessUser}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.1em] transition-all border-none ${
              !canAccessUser
                ? 'text-slate-300 dark:text-slate-600 grayscale opacity-40 cursor-not-allowed'
                : 'cursor-pointer'
            } ${
              activeSpace === 'USER'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : canAccessUser ? 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300' : ''
            }`}
          >
            {canAccessUser ? <Users size={13} /> : <Lock size={12} className="text-red-500" />} Employé
          </button>
          
          <button
            onClick={() => {
              if (canAccessSuperUser) {
                setActiveSpace('SUPER_USER');
              }
            }}
            disabled={!canAccessSuperUser}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.1em] transition-all border-none ${
              !canAccessSuperUser
                ? 'text-slate-300 dark:text-slate-600 grayscale opacity-40 cursor-not-allowed'
                : 'cursor-pointer'
            } ${
              activeSpace === 'SUPER_USER'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : canAccessSuperUser ? 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300' : ''
            }`}
          >
            {canAccessSuperUser ? <Shield size={13} /> : <Lock size={12} className="text-red-500" />} Expert / Super
          </button>
          
          <button
            onClick={() => {
              if (canAccessAdmin) {
                setActiveSpace('ADMIN');
              }
            }}
            disabled={!canAccessAdmin}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.1em] transition-all border-none ${
              !canAccessAdmin
                ? 'text-slate-300 dark:text-slate-600 grayscale opacity-40 cursor-not-allowed'
                : 'cursor-pointer'
            } ${
              activeSpace === 'ADMIN'
                ? 'bg-amber-500 text-white shadow-sm'
                : canAccessAdmin ? 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300' : ''
            }`}
          >
            {canAccessAdmin ? <Crown size={13} /> : <Lock size={12} className="text-red-500" />} Directeur
          </button>
        </div>
      </div>

      <div className="h-full">
        {renderDepartment()}
      </div>
    </div>
  );
}
