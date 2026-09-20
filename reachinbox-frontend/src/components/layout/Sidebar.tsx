import { NavLink } from "react-router-dom";
import { ReactNode } from "react";

interface SidebarProps {
  onCompose: () => void;
  isOpen: boolean;
  onClose: () => void;
}

function NavItem({ to, icon, label }: { to: string; icon: ReactNode; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          isActive ? "bg-brand-50 text-brand-700" : "text-gray-600 hover:bg-gray-100"
        }`
      }
    >
      {icon}
      {label}
    </NavLink>
  );
}

export function Sidebar({ onCompose, isOpen, onClose }: SidebarProps) {
  return (
    <>
      {isOpen && <div className="fixed inset-0 z-20 bg-black/30 md:hidden" onClick={onClose} />}
      <aside
        className={`fixed z-30 h-full w-64 shrink-0 border-r border-gray-200 bg-white p-4 transition-transform md:static md:translate-x-0
          ${isOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <button
          onClick={onCompose}
          className="mb-6 flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm
                     font-medium text-white shadow-sm hover:bg-brand-700"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Compose New Email
        </button>

        <nav className="space-y-1">
          <NavItem
            to="/dashboard/scheduled"
            label="Scheduled Emails"
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
                <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            }
          />
          <NavItem
            to="/dashboard/sent"
            label="Sent Emails"
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M3 12l18-8-7 18-3-7-8-3z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
              </svg>
            }
          />
          <NavItem
            to="/dashboard/search"
            label="Search"
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
                <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            }
          />
          <NavItem
            to="/dashboard/slack"
            label="Connect Slack"
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="4" y="4" width="16" height="16" rx="4" stroke="currentColor" strokeWidth="1.8" />
              </svg>
            }
          />
        </nav>
      </aside>
    </>
  );
}
