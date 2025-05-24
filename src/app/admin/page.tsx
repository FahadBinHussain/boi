"use client";

import { useAdmin } from "@/lib/hooks/useAdmin";
import { useState } from "react";
import { signOut } from "next-auth/react";
import Link from "next/link";

export default function AdminDashboard() {
  const { isAdmin, isLoading, user } = useAdmin();
  const [activeTab, setActiveTab] = useState<"books" | "users">("books");

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-indigo-500"></div>
        <span className="ml-2">Loading...</span>
      </div>
    );
  }

  if (!isAdmin) {
    return null; // This will be redirected by the useAdmin hook
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600">
            Welcome back, {user?.name || "Admin"}
          </p>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Sign Out
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-8">
        <nav className="-mb-px flex space-x-8">
          <button
            className={`${
              activeTab === "books"
                ? "border-indigo-500 text-indigo-600"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
            } whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium`}
            onClick={() => setActiveTab("books")}
          >
            Books
          </button>
          <button
            className={`${
              activeTab === "users"
                ? "border-indigo-500 text-indigo-600"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
            } whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium`}
            onClick={() => setActiveTab("users")}
          >
            Users
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white shadow rounded-lg">
        {activeTab === "books" && (
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium text-gray-900">Books</h2>
              <Link
                href="/admin/books/new"
                className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
              >
                Add Book
              </Link>
            </div>
            <div className="mt-6">
              <p className="text-gray-500 italic">Book management features will be displayed here</p>
              {/* Book table would go here */}
            </div>
          </div>
        )}

        {activeTab === "users" && (
          <div className="p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Users</h2>
            <div className="mt-6">
              <p className="text-gray-500 italic">User management features will be displayed here</p>
              {/* User table would go here */}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 