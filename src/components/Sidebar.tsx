import React from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Settings,
  ShieldAlert,
  BookOpen,
  X,
} from "lucide-react";
import { motion } from "motion/react";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const { profile, user } = useAuth();

  if (!user || !profile) return null;

  return (
    <>
      <motion.aside
        initial={{ x: -250 }}
        animate={{ x: 0 }}
        className={`fixed md:static inset-y-0 left-0 z-50 bg-brand-card border-r border-brand-border flex flex-col flex-shrink-0 transform transition-all duration-300 ease-in-out ${isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"} ${isCollapsed ? "w-20" : "w-64"}`}
      >
        <div className="flex flex-col h-full py-6">
          <div className="flex justify-between items-center px-4 mb-4">
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="hidden md:flex p-2 text-brand-text hover:bg-brand-bg rounded-lg ml-auto"
            >
              {isCollapsed ? (
                <ChevronRight className="w-5 h-5" />
              ) : (
                <ChevronLeft className="w-5 h-5" />
              )}
            </button>
            <div className="flex justify-end md:hidden ml-auto">
              <button
                onClick={onClose}
                className="p-2 text-brand-text hover:bg-brand-bg rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <nav className="flex-1 px-4 space-y-2">
            <NavLink
              to={
                profile?.role === "Participant" ||
                profile?.role === "participant"
                  ? "/"
                  : "/admin"
              }
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-bold text-sm ${
                  isActive
                    ? "bg-brand-primary text-white shadow-md"
                    : "text-brand-text hover:bg-brand-bg"
                } ${isCollapsed ? "justify-center px-2" : ""}`
              }
              title="Link"
            >
              <LayoutDashboard className="h-5 w-5 flex-shrink-0" />
              {!isCollapsed && <span>Dashboard</span>}
            </NavLink>

            <NavLink
              to="/settings"
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-bold text-sm ${
                  isActive
                    ? "bg-brand-primary text-white shadow-md"
                    : "text-brand-text hover:bg-brand-bg"
                } ${isCollapsed ? "justify-center px-2" : ""}`
              }
              title="Link"
            >
              <Settings className="h-5 w-5 flex-shrink-0" />
              {!isCollapsed && <span>Settings</span>}
            </NavLink>

            {profile?.role === "super_admin" && (
              <div className="pt-6 mt-6 border-t border-brand-border">
                <NavLink
                  to="/sys-core-panel-x9v2"
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-black text-xs uppercase tracking-wider ${
                      isActive
                        ? "bg-red-600 text-white shadow-md shadow-red-900/20"
                        : "text-red-500 hover:bg-red-500/10 border border-red-500/20"
                    } ${isCollapsed ? "justify-center px-2" : ""}`
                  }
                  title="System Panel"
                >
                  <ShieldAlert className="h-4 w-4 flex-shrink-0" />
                  {!isCollapsed && <span>System Panel</span>}
                </NavLink>
              </div>
            )}
          </nav>

          <div className="px-4 mt-auto">
            <div
              className={`bg-brand-bg border border-brand-border rounded-xl text-center transition-all ${isCollapsed ? "p-2" : "p-4"}`}
            >
              <BookOpen className="h-6 w-6 text-brand-primary mx-auto mb-2" />
              {!isCollapsed && (
                <>
                  <p className="text-xs font-bold text-brand-text truncate">
                    {profile.name}
                  </p>
                  <p className="text-[10px] text-brand-muted mt-1 uppercase tracking-wider truncate">
                    {profile.role}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </motion.aside>

      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}
    </>
  );
};
