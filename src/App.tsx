/**
 * Cafe Lupe Centralized Sales Report and Transaction Gateway System
 * Root Application Container (Revision 002)
 */

import React, { useState, useEffect } from 'react';
import { User, OutletSlug } from './types';
import { store } from './db/store';
import { LoginView } from './components/auth/LoginView';
import { PendingApprovalView } from './components/auth/PendingApprovalView';
import { OutletWorkspace } from './components/outlets/OutletWorkspace';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AccountantDashboard } from './components/accountant/AccountantDashboard';
import { ProfileModal } from './components/common/ProfileModal';
import { ArrowLeft, ChevronDown } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('cafelupe_current_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  const [prefillLoginEmail, setPrefillLoginEmail] = useState('');
  const [activeFrontDeskOutletSlug, setActiveFrontDeskOutletSlug] = useState<OutletSlug | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);

  useEffect(() => {
    const unsub = store.subscribe(() => {
      if (currentUser) {
        const fresh = store.getUsers().find((u) => u.id === currentUser.id);
        if (fresh && fresh.approvalStatus !== currentUser.approvalStatus) {
          setCurrentUser(fresh);
          localStorage.setItem('cafelupe_current_user', JSON.stringify(fresh));
        }
      }
    });
    return () => unsub();
  }, [currentUser]);

  const handleLoginSuccess = (user: User) => {
    setPrefillLoginEmail('');
    setCurrentUser(user);
    setActiveFrontDeskOutletSlug(null);
    localStorage.setItem('cafelupe_current_user', JSON.stringify(user));
  };

  const handleLogout = (prefillEmail?: string) => {
    setPrefillLoginEmail(typeof prefillEmail === 'string' ? prefillEmail : '');
    setCurrentUser(null);
    setActiveFrontDeskOutletSlug(null);
    localStorage.removeItem('cafelupe_current_user');
  };

  if (!currentUser) {
    return <LoginView onLoginSuccess={handleLoginSuccess} initialEmail={prefillLoginEmail} />;
  }

  if (currentUser.approvalStatus === 'pending') {
    return (
      <PendingApprovalView
        user={currentUser}
        onLogout={handleLogout}
        onApproved={(approvedUser) => handleLoginSuccess(approvedUser)}
      />
    );
  }

  if (currentUser.approvalStatus === 'rejected') {
    return (
      <div className="min-h-[100dvh] flex flex-col md:flex-row bg-[#F7F7F7] text-[#1A1A1A]">
        <div className="md:w-1/2 bg-[#FFE27A] px-8 py-12 md:px-16 flex flex-col justify-center">
          <div className="max-w-md">
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#1A1A1A]">
              Cafe Lupe
            </h1>
            <p className="text-sm sm:text-base font-medium text-[#1A1A1A]/80 mt-2">
              Centralized sales report and transaction gateway for every outlet.
            </p>
          </div>
        </div>
        <div className="md:w-1/2 flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-2xl p-8 border border-gray-200 space-y-4">
            <h2 className="text-xl font-extrabold text-[#1A1A1A]">Registration declined</h2>
            <p className="text-xs text-gray-500">
              Your staff account request was declined by Front-Desk (Admin).
            </p>
            <button
              type="button"
              onClick={() => handleLogout()}
              className="w-full py-2.5 px-4 rounded-xl bg-[#FF5252] text-[#1A1A1A] font-bold text-xs cursor-pointer"
            >
              Back to log in
            </button>
          </div>
        </div>
      </div>
    );
  }

  const userOutlet =
    store.getOutlets().find((o) => o.id === currentUser.outletId) || store.getOutlets()[0];

  const activeFrontDeskOutlet =
    currentUser.role === 'admin' && activeFrontDeskOutletSlug
      ? store.getOutletBySlug(activeFrontDeskOutletSlug)
      : null;

  const frontDeskOutlets = store.getFrontDeskOutlets();

  const frontDeskSidebarOutletSelector =
    currentUser.role === 'admin' && activeFrontDeskOutlet ? (
      <div className="px-1 pt-0.5 space-y-2">
        <div className="px-2.5 text-[10px] font-extrabold uppercase tracking-wider text-[#1A1A1A]/60">
          Outlet Selector
        </div>
        <div className="relative">
          <select
            value={activeFrontDeskOutlet.slug}
            onChange={(e) => setActiveFrontDeskOutletSlug(e.target.value as OutletSlug)}
            aria-label="Outlet Selector"
            className="w-full px-3.5 py-2.5 pr-8 rounded-xl bg-white/90 hover:bg-white text-[#1A1A1A] font-bold text-xs appearance-none cursor-pointer outline-none border border-[#1A1A1A]/10 shadow-2xs"
          >
            {frontDeskOutlets.map((o) => (
              <option key={o.id} value={o.slug} className="bg-white text-[#1A1A1A]">
                {o.name}
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-[#1A1A1A] absolute right-2.5 top-2.5 pointer-events-none" />
        </div>
        <button
          type="button"
          onClick={() => setActiveFrontDeskOutletSlug(null)}
          className="w-full px-3.5 py-2 rounded-xl bg-white/60 hover:bg-white text-[#1A1A1A] text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Front-Desk
        </button>
      </div>
    ) : undefined;

  return (
    <>
      {activeFrontDeskOutlet ? (
        <OutletWorkspace
          outlet={activeFrontDeskOutlet}
          user={currentUser}
          onOpenProfile={() => setShowProfileModal(true)}
          onLogout={handleLogout}
          sidebarExtra={frontDeskSidebarOutletSelector}
        />
      ) : currentUser.role === 'admin' ? (
        <AdminDashboard
          adminUser={currentUser}
          onSelectOutlet={(slug) => setActiveFrontDeskOutletSlug(slug)}
          onOpenProfile={() => setShowProfileModal(true)}
          onLogout={handleLogout}
        />
      ) : currentUser.role === 'accountant' ? (
        <AccountantDashboard
          user={currentUser}
          onOpenProfile={() => setShowProfileModal(true)}
          onLogout={handleLogout}
        />
      ) : (
        <OutletWorkspace
          outlet={userOutlet}
          user={currentUser}
          onOpenProfile={() => setShowProfileModal(true)}
          onLogout={handleLogout}
        />
      )}

      {showProfileModal && (
        <ProfileModal
          user={currentUser}
          onClose={() => setShowProfileModal(false)}
          onLogout={handleLogout}
        />
      )}
    </>
  );
}
