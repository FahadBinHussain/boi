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
  FiPlusCircle
} from "react-icons/fi";
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
        { opacity: 1, x: 0, stagger: 0.1, duration: 0.5, ease: "power2.out" }
      );
      
      gsap.fromTo(
        ".main-content",
        { opacity: 0 },
        { opacity: 1, duration: 0.7, delay: 0.3, ease: "power2.out" }
      );
    }
  }, [isLoading]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/10 border-t-[#14b8a6]"></div>
        <span className="ml-4 font-medium text-white/60">Loading dashboard...</span>
      </div>
    );
  }

  const navItems = isAdmin 
    ? [
        { name: "Dashboard", href: "/admin", icon: <FiHome className="h-5 w-5" /> },
        { name: "Books", href: "/admin/books", icon: <FiBook className="h-5 w-5" /> },
        { name: "Users", href: "/admin/users", icon: <FiUsers className="h-5 w-5" /> },
        { name: "Settings", href: "/admin/settings", icon: <FiSettings className="h-5 w-5" /> },
      ]
    : [
        { name: "Add Book", href: "/admin/books/new", icon: <FiPlusCircle className="h-5 w-5" /> },
      ];

  return (
    <div className="flex h-screen bg-[#0a0a0f] text-white">
      {/* Mobile sidebar toggle */}
      <div className="fixed left-4 top-4 z-50 block md:hidden">
        <button
          className="rounded-xl bg-white/[0.06] border border-white/[0.1] p-3 text-white/80 backdrop-blur-xl hover:bg-white/[0.1] transition-all"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? <FiX size={20} /> : <FiMenu size={20} />}
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 transform transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] md:relative ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col border-r border-white/[0.08] bg-[#0f1118]/80 backdrop-blur-2xl">
          {/* Sidebar header */}
          <div className="flex h-24 items-center justify-between px-8 border-b border-white/[0.08]">
            <Link href="/admin" className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#14b8a6] to-[#0d9488] flex items-center justify-center">
                <FiBook className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-semibold">Admin</span>
            </Link>
            {syncStatus === 'syncing' && (
              <div className="flex items-center text-[#5eead4]">
                <FiRefreshCw className="h-4 w-4 animate-spin" />
              </div>
            )}
          </div>

          {/* User info */}
          <div className="border-b border-white/[0.08] p-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-[#a855f7] to-[#7c3aed] flex items-center justify-center text-white font-bold text-lg">
                {user?.name?.charAt(0) || "A"}
              </div>
              <div>
                <p className="font-medium">{user?.name || "User"}</p>
                <p className="text-xs text-white/50">{user?.email || ""}</p>
                <p className="text-xs text-[#5eead4] mt-0.5">{isAdmin ? "Administrator" : "Contributor"}</p>
              </div>
            </div>
          </div>

          {/* Sidebar navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== "/admin" && pathname?.startsWith(item.href));
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`sidebar-item group relative flex items-center gap-4 rounded-xl px-4 py-3.5 text-sm font-medium transition-all duration-300 ${
                    isActive
                      ? "bg-white/[0.08] text-white"
                      : "text-white/60 hover:bg-white/[0.04] hover:text-white"
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeNav"
                      className="absolute left-0 top-0 bottom-0 w-1 rounded-r-full bg-gradient-to-b from-[#5eead4] to-[#14b8a6]"
                    />
                  )}
                  <span className={isActive ? "text-[#5eead4]" : "text-white/50 group-hover:text-white/70"}>{item.icon}</span>
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Logout button */}
          <div className="border-t border-white/[0.08] p-4">
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="sidebar-item group flex w-full items-center gap-4 rounded-xl px-4 py-3.5 text-sm font-medium text-white/60 hover:bg-white/[0.04] hover:text-white transition-all duration-300"
            >
              <FiLogOut className="h-5 w-5 text-white/50 group-hover:text-white/70" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="main-content flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
} 