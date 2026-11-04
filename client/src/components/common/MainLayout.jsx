import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import { useAuth } from '../../auth/AuthContext';

export default function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // The panel is decided by who signed in; it can no longer be switched from the UI.
  const { role: userRole, user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close navigation"
        />
      )}
      <Sidebar
        userRole={userRole}
        user={user}
        onLogout={logout}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <Navbar onMenuClick={() => setSidebarOpen(true)} userRole={userRole} user={user} onLogout={logout} />
      <main className="px-4 pb-6 pt-20 sm:px-6 lg:pl-72">
        <Outlet context={{ userRole }} />
      </main>
    </div>
  );
}
