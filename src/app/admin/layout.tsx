"use client";

import { useAdmin } from "@/lib/hooks/useAdmin";
import { useUserSettings } from "@/hooks/useUserSettings";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { 
  FiHome, 
  FiBook, 
  FiUsers, 
  FiSettings, 
  FiLogOut, 
  FiMenu, 
  FiX,
  FiBarChart2,
  FiDatabase,
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
    // Animation for sidebar elements
    if (!isLoading) {
      gsap.fromTo(
        ".sidebar-item",
        { 
          opacity: 0, 
          x: -20 
        },
        { 
          opacity: 1, 
          x: 0, 
          stagger: 0.1,
          duration: 0.5,
          ease: "power2.out"
        }
      );
      
      gsap.fromTo(
        ".main-content",
        { opacity: 0 },
        { 
          opacity: 1, 
          duration: 0.7,
          delay: 0.3,
          ease: "power2.out"
        }
      );
    }
  }, [isLoading]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-indigo-600"></div>
        <span className="ml-3 font-medium text-gray-700">Loading dashboard...</span>
      </div>
    );
  }

  // Define navigation items based on user role
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
    <div className="flex h-screen bg-gray-50">
      {/* Mobile sidebar toggle */}
      <div className="fixed left-4 top-4 z-50 block md:hidden">
        <button
          className="rounded-md bg-white p-2 text-gray-600 shadow-md hover:bg-gray-50 focus:outline-none"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? <FiX size={24} /> : <FiMenu size={24} />}
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 transform bg-indigo-900 transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          {/* Sidebar header */}
          <div className="flex h-20 items-center justify-center border-b border-indigo-800">
            <Link href="/admin" className="flex items-center">
              <span className="text-2xl font-bold text-white">BookAdmin</span>
            </Link>
            {syncStatus === 'syncing' && (
              <div className="ml-2 flex items-center text-indigo-300">
                <FiRefreshCw className="h-4 w-4 animate-spin" />
              </div>
            )}
          </div>

          {/* User info */}
          <div className="border-b border-indigo-800 p-4">
            <div className="mb-2 flex items-center">
              <div className="h-10 w-10 rounded-full bg-indigo-700 flex items-center justify-center text-white font-bold">
                {user?.name?.charAt(0) || "A"}
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-white">{user?.name || "User"}</p>
                <p className="text-xs text-indigo-300">{user?.email || ""}</p>
                <p className="text-xs text-indigo-300">{isAdmin ? "Admin" : "User"}</p>
              </div>
            </div>
          </div>

          {/* Sidebar navigation */}
          <nav className="flex-1 space-y-1 px-2 py-4">
            {navItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`sidebar-item group mb-1 flex items-center rounded-md px-2 py-2 text-sm font-medium ${
                  pathname === item.href || 
                  (item.href !== "/admin" && pathname?.startsWith(item.href))
                    ? "bg-indigo-800 text-white"
                    : "text-indigo-100 hover:bg-indigo-800 hover:text-white"
                }`}
              >
                <span className="mr-3 text-gray-300">{item.icon}</span>
                {item.name}
              </Link>
            ))}
          </nav>

          {/* Logout button */}
          <div className="border-t border-indigo-800 p-4">
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="sidebar-item group flex w-full items-center rounded-md px-2 py-2 text-sm font-medium text-indigo-100 hover:bg-indigo-800 hover:text-white"
            >
              <FiLogOut className="mr-3 h-5 w-5" aria-hidden="true" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="main-content flex-1 overflow-auto">
        <div className="py-6">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
} 