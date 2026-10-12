"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from 'framer-motion';
import { FiBook, FiUsers, FiTrendingUp, FiDownload, FiPlusCircle, FiAlertCircle, FiChevronRight } from "react-icons/fi";
import MotionIcon from "@/components/ui/MotionIcon";
import gsap from "gsap";
import { useAdmin } from "@/lib/hooks/useAdmin";
import { useRouter } from "next/navigation";

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

function StatCard({ title, value, icon, colorClass = "text-primary bg-primary/10" }: { 
  title: string; 
  value: string | number; 
  icon: React.ReactNode; 
  colorClass?: string;
}) {
  return (
    <motion.div
      variants={fadeInUp}
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ duration: 0.3 }}
      className="dashboard-card card bg-base-200 border border-base-300 p-6 shadow-md rounded-3xl"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-base-content/60">{title}</p>
          <p className="mt-3 font-mono text-4xl font-extrabold text-base-content">{value}</p>
        </div>
        <div className={`rounded-2xl p-3.5 ${colorClass}`}>
          {icon}
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
    <div className="bg-base-100 min-h-screen text-base-content transition-colors">
      <div className="mx-auto max-w-[1480px] px-6 py-10 lg:px-12">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div>
            <p className="mb-1 text-xs font-bold tracking-[0.25em] uppercase text-primary">Control Center</p>
            <h1 className="text-3xl font-extrabold tracking-tight text-base-content lg:text-4xl">Dashboard Overview</h1>
          </div>
          <Link 
            href="/admin/books/new" 
            className="btn btn-primary rounded-full px-6 gap-2 shadow-md hover:shadow-lg self-start sm:self-auto"
          >
            <MotionIcon animation="bounce" trigger="hover">
              <FiPlusCircle size={18} />
            </MotionIcon>
            <span>Add Book</span>
          </Link>
        </motion.div>

        {/* Stats Grid */}
        <motion.div 
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="mb-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4"
        >
          <StatCard 
            title="Total Books" 
            value={stats.totalBooks} 
            icon={
              <MotionIcon animation="float" trigger="always">
                <FiBook className="h-6 w-6 text-primary" />
              </MotionIcon>
            } 
            colorClass="bg-primary/10 text-primary"
          />
          <StatCard 
            title="Total Users" 
            value={stats.totalUsers} 
            icon={
              <MotionIcon animation="bounce" trigger="always">
                <FiUsers className="h-6 w-6 text-secondary" />
              </MotionIcon>
            } 
            colorClass="bg-secondary/10 text-secondary"
          />
          <StatCard 
            title="Downloads Today" 
            value="-" 
            icon={
              <MotionIcon animation="bounce" trigger="always">
                <FiDownload className="h-6 w-6 text-accent" />
              </MotionIcon>
            } 
            colorClass="bg-accent/10 text-accent"
          />
          <StatCard 
            title="Growth Rate" 
            value="-" 
            icon={
              <MotionIcon animation="pulse" trigger="always">
                <FiTrendingUp className="h-6 w-6 text-warning" />
              </MotionIcon>
            } 
            colorClass="bg-warning/10 text-warning"
          />
        </motion.div>

        {/* Charts Section */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="mb-10 grid grid-cols-1 gap-6 lg:grid-cols-2"
        >
          {/* Downloads Chart */}
          <div className="dashboard-card card bg-base-200 border border-base-300 p-6 md:p-8 rounded-3xl shadow-md">
            <h2 className="mb-6 text-lg font-bold text-base-content">Downloads Overview</h2>
            <div className="h-64" ref={chartRef}>
              <div className="flex h-full items-end gap-3 px-2">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => (
                  <div key={day} className="flex h-full flex-1 flex-col items-center justify-end">
                    <div 
                      className="chart-bar w-full rounded-t-lg bg-primary" 
                      style={{ 
                        height: ['65%', '40%', '85%', '55%', '75%', '30%', '45%'][i],
                        opacity: 0.85
                      }}
                    />
                    <div className="mt-3 text-xs font-semibold text-base-content/50 uppercase">{day}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* User Activity */}
          <div className="dashboard-card card bg-base-200 border border-base-300 p-6 md:p-8 rounded-3xl shadow-md">
            <h2 className="mb-6 text-lg font-bold text-base-content">User Activity</h2>
            <div className="flex h-64 items-center justify-center">
              <div className="relative h-48 w-48">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="font-mono text-4xl font-extrabold text-base-content">
                      {activePercentage > 0 ? `${activePercentage}%` : '-'}
                    </div>
                    <div className="mt-1 text-xs font-semibold text-base-content/60 uppercase">Active Users</div>
                  </div>
                </div>
                <svg className="h-full w-full" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" className="text-base-content/10" strokeWidth="10" />
                  <motion.circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="currentColor"
                    className="text-primary"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray="251.2"
                    initial={{ strokeDashoffset: 251.2 }}
                    animate={{ strokeDashoffset: 251.2 - (251.2 * activePercentage) / 100 }}
                    transition={{ duration: 1.5, delay: 0.5, ease: "easeOut" }}
                    transform="rotate(-90 50 50)"
                  />
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
            className="dashboard-table card bg-base-200 border border-base-300 rounded-3xl shadow-md overflow-hidden"
          >
            <div className="border-b border-base-300 px-6 py-5">
              <h2 className="text-base font-bold text-base-content">Recent Books</h2>
            </div>
            <div className="overflow-x-auto">
              {recentBooks.length > 0 ? (
                <table className="table table-zebra table-sm">
                  <thead>
                    <tr className="text-xs uppercase text-base-content/60">
                      <th>Title</th>
                      <th>Author</th>
                      <th>Downloads</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentBooks.map((book) => (
                      <tr key={book.id}>
                        <td className="font-medium">{book.title}</td>
                        <td className="text-base-content/70">{book.author}</td>
                        <td>{book.downloads}</td>
                        <td>
                          <span className={`badge badge-sm font-semibold ${
                            book.status === "active" ? "badge-success" : "badge-warning"
                          }`}>
                            {book.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="py-14 text-center">
                  <MotionIcon animation="float" trigger="always">
                    <FiBook className="mx-auto h-12 w-12 text-base-content/20" />
                  </MotionIcon>
                  <h3 className="mt-3 text-sm font-bold text-base-content">No books yet</h3>
                  <p className="mt-1 text-xs text-base-content/60">Get started by adding your first book.</p>
                  <div className="mt-6">
                    <Link
                      href="/admin/books/new"
                      className="btn btn-outline btn-sm rounded-full gap-2"
                    >
                      <MotionIcon animation="bounce" trigger="hover">
                        <FiPlusCircle />
                      </MotionIcon>
                      Add Book
                    </Link>
                  </div>
                </div>
              )}
            </div>
            <div className="border-t border-base-300 px-6 py-4">
              <Link href="/admin/books" className="btn btn-ghost btn-sm text-primary gap-1">
                <span>View all books</span>
                <MotionIcon animation="float" trigger="hover">
                  <FiChevronRight />
                </MotionIcon>
              </Link>
            </div>
          </motion.div>

          {/* Recent Users Table */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.6 }}
            className="dashboard-table card bg-base-200 border border-base-300 rounded-3xl shadow-md overflow-hidden"
          >
            <div className="border-b border-base-300 px-6 py-5">
              <h2 className="text-base font-bold text-base-content">Recent Users</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="table table-zebra table-sm">
                <thead>
                  <tr className="text-xs uppercase text-base-content/60">
                    <th>Name</th>
                    <th>Email</th>
                    <th>Joined</th>
                    <th>Downloads</th>
                  </tr>
                </thead>
                <tbody>
                  {recentUsers.length > 0 ? (
                    recentUsers.map((user) => (
                      <tr key={user.id}>
                        <td className="font-medium">{user.name}</td>
                        <td className="text-base-content/70">{user.email}</td>
                        <td>{new Date(user.joined).toLocaleDateString()}</td>
                        <td>{user.downloads}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="text-center py-12 text-base-content/50 text-xs">
                        No recent users recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="border-t border-base-300 px-6 py-4">
              <Link href="/admin/users" className="btn btn-ghost btn-sm text-primary gap-1">
                <span>View all users</span>
                <MotionIcon animation="float" trigger="hover">
                  <FiChevronRight />
                </MotionIcon>
              </Link>
            </div>
          </motion.div>
        </div>

        {/* System Notice */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.7 }}
          className="mt-10 alert alert-warning shadow-md rounded-2xl"
        >
          <MotionIcon animation="wiggle" trigger="always">
            <FiAlertCircle className="h-6 w-6 shrink-0" />
          </MotionIcon>
          <div>
            <h3 className="font-bold text-sm">System Notice</h3>
            <p className="mt-1 text-xs">
              Scheduled maintenance planned for June 15, 2026, from 2:00 AM to 4:00 AM UTC. 
              The system may experience brief downtime during this period.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
