"use client";

import { useAdmin } from "@/lib/hooks/useAdmin";
import { useUserSettings } from "@/hooks/useUserSettings";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { motion } from 'framer-motion';
import { 
  FiHome, 
  FiBook, 
  FiUsers, 
  FiSettings, 
  FiLogOut, 
  FiMenu, 
  FiX,
  FiRefreshCw,
  FiPlusCircle,
  FiLoader
} from "react-icons/fi";
import MotionIcon from "@/components/ui/MotionIcon";
import ThemeToggle from "@/components/theme/ThemeToggle";
import gsap from "gsap";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAdmin, isLoading, user } = useAdmin();
  const { syncStatus } = useUserSettings();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const pathname = usePathname();
  
  useEffect(() => {
    if (!isLoading) {
      gsap.fromTo(
        ".sidebar-item",
        { opacity: 0, x: -20 },
        { opacity: 1, x: 0, stagger: 0.08, duration: 0.4, ease: "power2.out" }
      );
      
      gsap.fromTo(
        ".main-content",
        { opacity: 0 },
        { opacity: 1, duration: 0.5, delay: 0.2, ease: "power2.out" }
      );
    }
  }, [isLoading]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base-100 text-base-content">
        <MotionIcon animation="spin" trigger="always">
          <FiLoader className="h-10 w-10 text-primary" />
        </MotionIcon>
        <span className="ml-4 font-medium text-base-content/70">Loading dashboard...</span>
      </div>
    );
  }

  const navItems = isAdmin 
    ? [
        { name: "Dashboard", href: "/admin", icon: <MotionIcon animation="bounce" trigger="hover"><FiHome className="h-5 w-5" /></MotionIcon> },
        { name: "Books", href: "/admin/books", icon: <MotionIcon animation="float" trigger="hover"><FiBook className="h-5 w-5" /></MotionIcon> },
        { name: "Users", href: "/admin/users", icon: <MotionIcon animation="wiggle" trigger="hover"><FiUsers className="h-5 w-5" /></MotionIcon> },
        { name: "Settings", href: "/admin/settings", icon: <MotionIcon animation="spin" trigger="hover"><FiSettings className="h-5 w-5" /></MotionIcon> },
      ]
    : [
        { name: "Add Book", href: "/admin/books/new", icon: <MotionIcon animation="bounce" trigger="hover"><FiPlusCircle className="h-5 w-5" /></MotionIcon> },
      ];

  return (
    <div className="flex h-screen bg-base-100 text-base-content transition-colors">
      {/* Mobile sidebar toggle */}
      <div className="fixed left-4 top-4 z-50 block md:hidden">
        <button
          className="btn btn-circle btn-sm bg-base-200 border border-base-300 text-base-content shadow-lg"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? (
            <MotionIcon animation="spin" trigger="hover"><FiX size={18} /></MotionIcon>
          ) : (
            <MotionIcon animation="wiggle" trigger="hover"><FiMenu size={18} /></MotionIcon>
          )}
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 transform transition-transform duration-300 md:relative ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col border-r border-base-300 bg-base-200">
          {/* Sidebar header */}
          <div className="flex h-20 items-center justify-between px-6 border-b border-base-300">
            <Link href="/admin" className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary text-primary-content flex items-center justify-center shadow-md">
                <MotionIcon animation="float" trigger="always">
                  <FiBook className="h-5 w-5" />
                </MotionIcon>
              </div>
              <span className="text-xl font-extrabold text-base-content">Admin</span>
            </Link>
            <div className="flex items-center gap-2">
              {syncStatus === 'syncing' && (
                <div className="flex items-center text-primary">
                  <FiRefreshCw className="h-4 w-4 animate-spin" />
                </div>
              )}
              <ThemeToggle />
            </div>
          </div>

          {/* User info */}
          <div className="border-b border-base-300 p-5">
            <div className="card bg-base-100 border border-base-300 p-4 rounded-2xl flex-row items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-lg shrink-0">
                {user?.name?.charAt(0) || "A"}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-sm truncate text-base-content">{user?.name || "User"}</p>
                <p className="text-xs text-base-content/60 truncate">{user?.email || ""}</p>
                <span className="badge badge-primary badge-xs mt-1 font-semibold">{isAdmin ? "Admin" : "Contributor"}</span>
              </div>
            </div>
          </div>

          {/* Sidebar navigation */}
          <nav className="flex-1 px-4 py-5 space-y-1.5 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== "/admin" && pathname?.startsWith(item.href));
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`sidebar-item group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                    isActive
                      ? "bg-primary text-primary-content shadow-md font-semibold"
                      : "text-base-content/70 hover:bg-base-300 hover:text-base-content"
                  }`}
                >
                  <span className={isActive ? "text-primary-content" : "text-base-content/60 group-hover:text-primary"}>
                    {item.icon}
                  </span>
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* Logout button */}
          <div className="border-t border-base-300 p-4">
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="sidebar-item btn btn-ghost btn-block justify-start text-error hover:bg-error/10 gap-3"
            >
              <MotionIcon animation="float" trigger="hover">
                <FiLogOut className="h-5 w-5" />
              </MotionIcon>
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="main-content flex-1 overflow-auto bg-base-100">
        {children}
      </div>
    </div>
  );
}