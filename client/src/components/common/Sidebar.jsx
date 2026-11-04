import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronDown, ChevronRight, LogOut, UserRound } from 'lucide-react';
import { panelByRole, roleMenus } from '../../config/navigation';

export default function Sidebar({
  userRole,
  user,
  isOpen = false,
  onClose = () => {},
  onLogout = () => {}
}) {
  const location = useLocation();
  const currentMenuItems = roleMenus[userRole] || [];
  const panel = panelByRole[userRole];
  const activeDropdown = currentMenuItems.findIndex((item) =>
    item.submenus?.some((submenu) => submenu.path === location.pathname)
  );
  const [openDropdown, setOpenDropdown] = useState(activeDropdown);

  useEffect(() => {
    setOpenDropdown(activeDropdown);
  }, [activeDropdown, userRole]);

  const toggleDropdown = (index) => {
    setOpenDropdown((current) => current === index ? null : index);
  };

  return (
    <aside
      className={`fixed left-0 top-0 z-50 flex h-screen w-72 flex-col border-r border-[#24443d] bg-[#102c27] transition-transform duration-300 ${
        isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}
    >
      <div className="flex items-center gap-3 border-b border-[#24443d] px-5 py-5">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-400 text-sm font-black tracking-wide text-[#102c27]">
          T
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-bold tracking-wide text-white">Transport CRM</h1>
          <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.16em] text-emerald-100/60">
            Operations workspace
          </p>
        </div>
      </div>

      <div className="border-b border-[#24443d] px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-100/60">Signed in to</p>
        <p className="mt-1 text-xs font-semibold text-slate-100">{panel?.label}</p>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto p-3">
        <p className="px-3 pb-2 pt-1 text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">
          Workspace
        </p>
        {currentMenuItems.map((item, index) => {
          const Icon = item.icon;
          const hasSubmenu = Boolean(item.submenus?.length);
          const isOpenGroup = openDropdown === index;
          const isMatch = hasSubmenu && item.submenus.some((sub) => sub.path === location.pathname);

          return (
            <div key={item.title}>
              {hasSubmenu ? (
                <button
                  type="button"
                  onClick={() => toggleDropdown(index)}
                  aria-expanded={isOpenGroup}
                  aria-controls={`sidebar-submenu-${userRole}-${index}`}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-[13px] font-semibold transition ${
                    isMatch || isOpenGroup
                      ? 'bg-[#1c443d] text-white'
                      : 'text-slate-300 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <Icon size={17} className="shrink-0 text-emerald-300" />
                    <span className="truncate">{item.title}</span>
                  </span>
                  {isOpenGroup ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
              ) : (
                <NavLink
                  to={item.path}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition ${
                      isActive
                        ? 'bg-emerald-400 text-[#102c27]'
                        : 'text-slate-300 hover:bg-white/5 hover:text-white'
                    }`
                  }
                >
                  <Icon size={17} className="shrink-0" />
                  <span>{item.title}</span>
                </NavLink>
              )}

              {hasSubmenu && isOpenGroup && (
                <div
                  id={`sidebar-submenu-${userRole}-${index}`}
                  className="ml-5 mt-1 space-y-0.5 border-l border-[#365850] py-1 pl-3"
                >
                  {item.submenus.map((submenu) => (
                    <NavLink
                      key={submenu.path}
                      to={submenu.path}
                      onClick={onClose}
                      className={({ isActive }) =>
                        `block rounded-lg px-3 py-2 text-xs transition ${
                          isActive
                            ? 'bg-white/10 font-semibold text-emerald-200'
                            : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                        }`
                      }
                    >
                      {submenu.name}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3 border-t border-[#24443d] px-4 py-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#1c443d] text-emerald-200"><UserRound size={16} /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-white">{user?.name || panel?.title}</p>
          <p className="truncate text-[10px] text-emerald-100/60">{user?.loginId ? `ID: ${user.loginId}` : panel?.title}</p>
        </div>
        <button
          type="button"
          onClick={onLogout}
          aria-label="Logout"
          title="Logout"
          className="rounded-lg p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
        >
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  );
}
