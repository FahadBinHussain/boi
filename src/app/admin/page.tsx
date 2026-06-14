"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from 'framer-motion';
import { FiBook, FiUsers, FiTrendingUp, FiDownload, FiPlusCircle, FiAlertCircle, FiChevronRight } from "react-icons/fi";
import gsap from "gsap";
import { useAdmin } from "@/lib/hooks/useAdmin";
import { useRouter } from "next/navigation";

// Define types for our data
interface Book {
  id: number;
  title: string;
  author: string;
  downloads: number;
  status: string;
}

interface User {
  id: number;
  name: string;
  email: string;
  joined: string;
  downloads: number;
}

// Empty arrays instead of mock data
const recentBooks: Book[] = [];
const recentUsers: User[] = [];

const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1
    }
  }
};

const fadeInUp = {
  hidden: { opacity: 0, y: 24, filter: 'blur(6px)' },
  show: { 
    opacity: 1, 
    y: 0, 
    filter: 'blur(0px)',
    transition: {
      duration: 0.6
    }
  }
};

// Stat card component
function StatCard({ title, value, icon, gradient, accent }: { 
  title: string; 
  value: string | number; 
  icon: React.ReactNode; 
  gradient: string;
  accent: string;
}) {
  return (
    <motion.div
      variants={fadeInUp}
      whileHover={{ y: -4, scale: 1.02 }}
      transition={{ duration: 0.4 }}
      className="dashboard-card relative overflow-hidden rounded-[1.6rem] border border-white/[0.08] bg-white/[0.02] p-6 backdrop-blur-xl shadow-[0_20px_60px_-25px_rgba(0,0,0,0.5)]"
    >
      <div className="absolute top-0 right-0 h-32 w-32 opacity-[0.08] rounded-full blur-2xl" style={{ background: gradient }} />
      <div className="relative">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-white/50">{title}</p>
            <p className="mt-3 font-[var(--font-geist-mono)] text-4xl font-light text-white">{value}</p>
          </div>
          <div className="rounded-xl p-4" style={{ background: `linear-gradient(135deg, ${gradient})` }}>
            {icon}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function AdminDashboard() {
  const chartRef = useRef<HTMLDivElement>(null);
  const { isAdmin, isLoading } = useAdmin();
  const router = useRouter();
  
  const [stats, setStats] = useState({
    totalBooks: '-',
    totalUsers: '-',
    activeUsers: '-',
  });

  useEffect(() => {
    if (!isLoading && !isAdmin) {
      router.push('/admin/books/new');
    }
  }, [isAdmin, isLoading, router]);
  
  useEffect(() => {
    if (isAdmin && !isLoading) {
      gsap.fromTo(
        ".dashboard-card",
        { y: 30, opacity: 0 },
        { y: 0, opacity: 1, stagger: 0.1, duration: 0.7, ease: "power2.out" }
      );
      
      gsap.fromTo(
        ".dashboard-table",
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.7, delay: 0.4, ease: "power2.out" }
      );
      
      if (chartRef.current) {
        const bars = chartRef.current.querySelectorAll(".chart-bar");
        gsap.fromTo(bars, { height: 0 }, { 
          height: "100%", 
          duration: 1.5,
          ease: "elastic.out(1, 0.3)",
          stagger: 0.1,
          delay: 0.5
        });
      }
    }
  }, [isAdmin, isLoading]);
  
  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/admin/dashboard-stats');
        if (res.ok) {
          const data = await res.json();
          setStats({
            totalBooks: data.totalBooks,
            totalUsers: data.totalUsers,
            activeUsers: data.activeUsers,
          });
        }
      } catch (e) {}
    }
    fetchStats();
  }, []);
  
  if (isLoading || !isAdmin) {
    return null;
  }

  const activePercentage = typeof stats.activeUsers === 'number' && typeof stats.totalUsers === 'number' && stats.totalUsers > 0
    ? Math.round((stats.activeUsers / stats.totalUsers) * 100)
    : 0;

  return (
    <div className="bg-[#0a0a0f] min-h-screen text-white">
      {/* Noise overlay */}
      <div className="fixed inset-0 pointer-events-none z-[100] opacity-[0.03] mix-blend-overlay" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
      }} />

      <div className="relative mx-auto max-w-[1480px] px-6 py-12 lg:px-12">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-12 flex items-center justify-between"
        >
          <div>
            <p className="mb-2 text-xs tracking-[0.25em] text-white/40">CONTROL CENTER</p>
            <h1 className="font-[var(--font-geist-sans)] text-3xl font-semibold tracking-tight lg:text-4xl">Dashboard Overview</h1>
          </div>
          <Link 
            href="/admin/books/new" 
            className="group inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-medium text-[#0a0a0f] transition-all duration-500 hover:-translate-y-0.5 hover:shadow-[0_0_60px_-15px_rgba(20,184,166,0.4)]"
          >
            <FiPlusCircle className="transition-transform duration-300 group-hover:scale-110" />
            Add Book
          </Link>
        </motion.div>

        {/* Stats Grid */}
        <motion.div 
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="mb-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4"
        >
          <StatCard 
            title="Total Books" 
            value={stats.totalBooks} 
            icon={<FiBook className="h-6 w-6 text-white" />} 
            gradient="#14b8a6, #0d9488"
            accent="#5eead4"
          />
          <StatCard 
            title="Total Users" 
            value={stats.totalUsers} 
            icon={<FiUsers className="h-6 w-6 text-white" />} 
            gradient="#3b82f6, #1d4ed8"
            accent="#60a5fa"
          />
          <StatCard 
            title="Downloads Today" 
            value="-" 
            icon={<FiDownload className="h-6 w-6 text-white" />} 
            gradient="#a855f7, #7c3aed"
            accent="#c084fc"
          />
          <StatCard 
            title="Growth Rate" 
            value="-" 
            icon={<FiTrendingUp className="h-6 w-6 text-white" />} 
            gradient="#f59e0b, #d97706"
            accent="#fbbf24"
          />
        </motion.div>

        {/* Charts Section */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="mb-12 grid grid-cols-1 gap-6 lg:grid-cols-2"
        >
          {/* Downloads Chart */}
          <div className="dashboard-card relative overflow-hidden rounded-[2rem] border border-white/[0.08] bg-white/[0.02] p-8 backdrop-blur-xl">
            <h2 className="mb-6 text-lg font-medium">Downloads Overview</h2>
            <div className="h-64" ref={chartRef}>
              <div className="flex h-full items-end gap-4 px-2">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => (
                  <div key={day} className="flex h-full flex-1 flex-col items-center justify-end">
                    <div 
                      className="chart-bar w-full rounded-t-lg" 
                      style={{ 
                        height: ['65%', '40%', '85%', '55%', '75%', '30%', '45%'][i],
                        background: 'linear-gradient(to top, #14b8a6, #5eead4)'
                      }}
                    />
                    <div className="mt-3 text-xs text-white/40">{day}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* User Activity */}
          <div className="dashboard-card relative overflow-hidden rounded-[2rem] border border-white/[0.08] bg-white/[0.02] p-8 backdrop-blur-xl">
            <h2 className="mb-6 text-lg font-medium">User Activity</h2>
            <div className="flex h-64 items-center justify-center">
              <div className="relative h-48 w-48">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="font-[var(--font-geist-mono)] text-4xl font-light">
                      {activePercentage > 0 ? `${activePercentage}%` : '-'}
                    </div>
                    <div className="mt-1 text-sm text-white/50">Active Users</div>
                  </div>
                </div>
                <svg className="h-full w-full" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
                  <motion.circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="url(#progressGradient)"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray="251.2"
                    initial={{ strokeDashoffset: 251.2 }}
                    animate={{ strokeDashoffset: 251.2 - (251.2 * activePercentage) / 100 }}
                    transition={{ duration: 1.5, delay: 0.5, ease: "easeOut" }}
                    transform="rotate(-90 50 50)"
                  />
                  <defs>
                    <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#14b8a6" />
                      <stop offset="100%" stopColor="#5eead4" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Tables Section */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Recent Books Table */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5 }}
            className="dashboard-table relative overflow-hidden rounded-[2rem] border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl"
          >
            <div className="border-b border-white/[0.08] px-8 py-6">
              <h2 className="text-lg font-medium">Recent Books</h2>
            </div>
            <div className="overflow-x-auto">
              {recentBooks.length > 0 ? (
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <th className="px-8 py-4 text-left text-xs tracking-[0.2em] text-white/40 uppercase">Title</th>
                      <th className="px-8 py-4 text-left text-xs tracking-[0.2em] text-white/40 uppercase">Author</th>
                      <th className="px-8 py-4 text-left text-xs tracking-[0.2em] text-white/40 uppercase">Downloads</th>
                      <th className="px-8 py-4 text-left text-xs tracking-[0.2em] text-white/40 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentBooks.map((book) => (
                      <tr key={book.id} className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.02]">
                        <td className="whitespace-nowrap px-8 py-5">
                          <div className="text-sm font-medium">{book.title}</div>
                        </td>
                        <td className="whitespace-nowrap px-8 py-5">
                          <div className="text-sm text-white/60">{book.author}</div>
                        </td>
                        <td className="whitespace-nowrap px-8 py-5">
                          <div className="text-sm text-white/60">{book.downloads}</div>
                        </td>
                        <td className="whitespace-nowrap px-8 py-5">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                            book.status === "active" 
                              ? "bg-[#14b8a6]/20 text-[#5eead4]" 
                              : "bg-[#f59e0b]/20 text-[#fbbf24]"
                          }`}>
                            {book.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="py-16 text-center">
                  <FiBook className="mx-auto h-14 w-14 text-white/20" />
                  <h3 className="mt-4 text-sm font-medium">No books yet</h3>
                  <p className="mt-2 text-sm text-white/50">Get started by adding your first book.</p>
                  <div className="mt-8">
                    <Link
                      href="/admin/books/new"
                      className="group inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-3 text-sm font-medium transition-all hover:bg-white/15"
                    >
                      <FiPlusCircle />
                      Add Book
                    </Link>
                  </div>
                </div>
              )}
            </div>
            <div className="border-t border-white/[0.08] px-8 py-5">
              <Link href="/admin/books" className="group flex items-center gap-2 text-sm text-[#5eead4] hover:text-[#2dd4bf]">
                View all books
                <FiChevronRight className="transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </div>
          </motion.div>

          {/* Recent Users Table */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.6 }}
            className="dashboard-table relative overflow-hidden rounded-[2rem] border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl"
          >
            <div className="border-b border-white/[0.08] px-8 py-6">
              <h2 className="text-lg font-medium">Recent Users</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="px-8 py-4 text-left text-xs tracking-[0.2em] text-white/40 uppercase">Name</th>
                    <th className="px-8 py-4 text-left text-xs tracking-[0.2em] text-white/40 uppercase">Email</th>
                    <th className="px-8 py-4 text-left text-xs tracking-[0.2em] text-white/40 uppercase">Joined</th>
                    <th className="px-8 py-4 text-left text-xs tracking-[0.2em] text-white/40 uppercase">Downloads</th>
                  </tr>
                </thead>
                <tbody>
                  {recentUsers.map((user) => (
                    <tr key={user.id} className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.02]">
                      <td className="whitespace-nowrap px-8 py-5">
                        <div className="text-sm font-medium">{user.name}</div>
                      </td>
                      <td className="whitespace-nowrap px-8 py-5">
                        <div className="text-sm text-white/60">{user.email}</div>
                      </td>
                      <td className="whitespace-nowrap px-8 py-5">
                        <div className="text-sm text-white/60">{new Date(user.joined).toLocaleDateString()}</div>
                      </td>
                      <td className="whitespace-nowrap px-8 py-5">
                        <div className="text-sm text-white/60">{user.downloads}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-white/[0.08] px-8 py-5">
              <Link href="/admin/users" className="group flex items-center gap-2 text-sm text-[#5eead4] hover:text-[#2dd4bf]">
                View all users
                <FiChevronRight className="transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </div>
          </motion.div>
        </div>

        {/* System Alerts */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.7 }}
          className="mt-12 relative overflow-hidden rounded-[2rem] border border-[#f59e0b]/20 bg-[#f59e0b]/10 p-6 backdrop-blur-xl"
        >
          <div className="flex gap-4">
            <div className="flex-shrink-0 rounded-full bg-[#f59e0b]/20 p-3">
              <FiAlertCircle className="h-5 w-5 text-[#fbbf24]" />
            </div>
            <div>
              <h3 className="font-medium text-[#fbbf24]">System Notice</h3>
              <p className="mt-2 text-sm text-white/70">
                Scheduled maintenance planned for June 15, 2026, from 2:00 AM to 4:00 AM UTC. 
                The system may experience brief downtime during this period.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
} 
