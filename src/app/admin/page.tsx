"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { FiBook, FiUsers, FiTrendingUp, FiDownload, FiPlusCircle, FiAlertCircle } from "react-icons/fi";
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

// Stat card component
function StatCard({ title, value, icon, color }: { title: string; value: string; icon: React.ReactNode; color: string }) {
  return (
    <div className={`dashboard-card rounded-lg bg-white p-6 shadow-md transition-all duration-300 hover:shadow-lg hover:translate-y-[-2px]`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={`rounded-full p-3 ${color}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const chartRef = useRef<HTMLDivElement>(null);
  const { isAdmin, isLoading } = useAdmin();
  const router = useRouter();
  
  // Redirect regular users to the add book page
  useEffect(() => {
    if (!isLoading && !isAdmin) {
      router.push('/admin/books/new');
    }
  }, [isAdmin, isLoading, router]);
  
  // Animation effects
  useEffect(() => {
    // Only run animations if user is admin and not being redirected
    if (isAdmin && !isLoading) {
      // Animate the dashboard cards
      gsap.fromTo(
        ".dashboard-card",
        { 
          y: 30, 
          opacity: 0 
        },
        { 
          y: 0, 
          opacity: 1, 
          stagger: 0.1,
          duration: 0.7,
          ease: "power2.out"
        }
      );
      
      // Animate the tables
      gsap.fromTo(
        ".dashboard-table",
        { 
          opacity: 0,
          y: 20
        },
        { 
          opacity: 1,
          y: 0,
          duration: 0.7,
          delay: 0.4,
          ease: "power2.out"
        }
      );
      
      // Simple chart animation with GSAP
      if (chartRef.current) {
        const bars = chartRef.current.querySelectorAll(".chart-bar");
        gsap.fromTo(
          bars,
          { height: 0 },
          { 
            height: "100%", 
            duration: 1.5,
            ease: "elastic.out(1, 0.3)",
            stagger: 0.1,
            delay: 0.5
          }
        );
      }
    }
  }, [isAdmin, isLoading]);
  
  // If loading or not admin, don't render the dashboard yet
  if (isLoading || !isAdmin) {
    return null;
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard Overview</h1>
        <div className="flex space-x-2">
          <Link 
            href="/admin/books/new" 
            className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <FiPlusCircle className="mr-2 h-4 w-4" />
            Add Book
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          title="Total Books" 
          value="-" 
          icon={<FiBook className="h-6 w-6 text-white" />} 
          color="bg-blue-500"
        />
        <StatCard 
          title="Total Users" 
          value="-" 
          icon={<FiUsers className="h-6 w-6 text-white" />} 
          color="bg-green-500"
        />
        <StatCard 
          title="Downloads Today" 
          value="-" 
          icon={<FiDownload className="h-6 w-6 text-white" />} 
          color="bg-purple-500"
        />
        <StatCard 
          title="Growth Rate" 
          value="-" 
          icon={<FiTrendingUp className="h-6 w-6 text-white" />} 
          color="bg-orange-500"
        />
      </div>

      {/* Charts Section */}
      <div className="mb-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="dashboard-card rounded-lg bg-white p-6 shadow-md">
          <h2 className="mb-4 text-lg font-medium text-gray-900">Downloads Overview</h2>
          <div className="h-64" ref={chartRef}>
            <div className="flex h-full items-end space-x-6 px-2">
              <div className="flex h-full flex-1 flex-col items-center justify-end">
                <div className="chart-bar w-full rounded-t bg-blue-500" style={{ height: "65%" }}></div>
                <div className="mt-2 text-xs text-gray-500">Mon</div>
              </div>
              <div className="flex h-full flex-1 flex-col items-center justify-end">
                <div className="chart-bar w-full rounded-t bg-blue-500" style={{ height: "40%" }}></div>
                <div className="mt-2 text-xs text-gray-500">Tue</div>
              </div>
              <div className="flex h-full flex-1 flex-col items-center justify-end">
                <div className="chart-bar w-full rounded-t bg-blue-500" style={{ height: "85%" }}></div>
                <div className="mt-2 text-xs text-gray-500">Wed</div>
              </div>
              <div className="flex h-full flex-1 flex-col items-center justify-end">
                <div className="chart-bar w-full rounded-t bg-blue-500" style={{ height: "55%" }}></div>
                <div className="mt-2 text-xs text-gray-500">Thu</div>
              </div>
              <div className="flex h-full flex-1 flex-col items-center justify-end">
                <div className="chart-bar w-full rounded-t bg-blue-500" style={{ height: "75%" }}></div>
                <div className="mt-2 text-xs text-gray-500">Fri</div>
              </div>
              <div className="flex h-full flex-1 flex-col items-center justify-end">
                <div className="chart-bar w-full rounded-t bg-blue-500" style={{ height: "30%" }}></div>
                <div className="mt-2 text-xs text-gray-500">Sat</div>
              </div>
              <div className="flex h-full flex-1 flex-col items-center justify-end">
                <div className="chart-bar w-full rounded-t bg-blue-500" style={{ height: "45%" }}></div>
                <div className="mt-2 text-xs text-gray-500">Sun</div>
              </div>
            </div>
          </div>
        </div>

        <div className="dashboard-card rounded-lg bg-white p-6 shadow-md">
          <h2 className="mb-4 text-lg font-medium text-gray-900">User Activity</h2>
          <div className="flex h-64 items-center justify-center">
            <div className="relative h-48 w-48">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-800">78%</div>
                  <div className="text-sm text-gray-500">Active Users</div>
                </div>
              </div>
              <svg className="h-full w-full" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="#E5E7EB"
                  strokeWidth="10"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="#4F46E5"
                  strokeWidth="10"
                  strokeDasharray="251.2"
                  strokeDashoffset="55.264"
                  transform="rotate(-90 50 50)"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Tables Section */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Recent Books Table */}
        <div className="dashboard-table rounded-lg bg-white shadow-md">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-medium text-gray-900">Recent Books</h2>
          </div>
          <div className="overflow-x-auto">
            {recentBooks.length > 0 ? (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Title</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Author</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Downloads</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {recentBooks.map((book) => (
                    <tr key={book.id} className="transition-colors hover:bg-gray-50">
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{book.title}</div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="text-sm text-gray-500">{book.author}</div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="text-sm text-gray-500">{book.downloads}</div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                          book.status === "active" 
                            ? "bg-green-100 text-green-800" 
                            : "bg-yellow-100 text-yellow-800"
                        }`}>
                          {book.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="py-12 text-center">
                <FiBook className="mx-auto h-12 w-12 text-gray-300" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No books yet</h3>
                <p className="mt-1 text-sm text-gray-500">Get started by adding your first book.</p>
                <div className="mt-6">
                  <Link
                    href="/admin/books/new"
                    className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
                  >
                    <FiPlusCircle className="-ml-0.5 mr-1.5 h-4 w-4" aria-hidden="true" />
                    Add Book
                  </Link>
                </div>
              </div>
            )}
          </div>
          <div className="border-t border-gray-200 px-6 py-4">
            <Link href="/admin/books" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
              View all books
            </Link>
          </div>
        </div>

        {/* Recent Users Table */}
        <div className="dashboard-table rounded-lg bg-white shadow-md">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-medium text-gray-900">Recent Users</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Joined</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Downloads</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {recentUsers.map((user) => (
                  <tr key={user.id} className="transition-colors hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{user.name}</div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="text-sm text-gray-500">{new Date(user.joined).toLocaleDateString()}</div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="text-sm text-gray-500">{user.downloads}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-gray-200 px-6 py-4">
            <Link href="/admin/users" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
              View all users
            </Link>
          </div>
        </div>
      </div>

      {/* System Alerts */}
      <div className="mt-8 rounded-lg bg-yellow-50 p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <FiAlertCircle className="h-5 w-5 text-yellow-400" aria-hidden="true" />
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800">System Notice</h3>
            <div className="mt-2 text-sm text-yellow-700">
              <p>
                Scheduled maintenance planned for June 15, 2023, from 2:00 AM to 4:00 AM UTC. 
                The system may experience brief downtime during this period.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 