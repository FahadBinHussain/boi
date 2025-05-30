"use client";

import { useState, useEffect } from "react";
import { FiSearch, FiFilter, FiMail, FiEye, FiUserX, FiUserCheck, FiChevronLeft, FiChevronRight, FiEdit2, FiTrash2, FiLoader, FiUsers } from "react-icons/fi";
import gsap from "gsap";
import { useAdmin } from "@/lib/hooks/useAdmin";
import { useRouter } from "next/navigation";

// Define User type
interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  lastLogin: string;
  joined: string;
  downloads: number;
}

// Mock data for users
const mockUsers = [
  { id: "1", name: "Alex Johnson", email: "alex@example.com", role: "user", status: "active", lastLogin: "2023-06-20", joined: "2023-05-15", downloads: 28 },
  { id: "2", name: "Sarah Miller", email: "sarah@example.com", role: "user", status: "active", lastLogin: "2023-06-18", joined: "2023-05-18", downloads: 12 },
  { id: "3", name: "David Clark", email: "david@example.com", role: "user", status: "inactive", lastLogin: "2023-06-01", joined: "2023-05-22", downloads: 5 },
  { id: "4", name: "Emily Williams", email: "emily@example.com", role: "admin", status: "active", lastLogin: "2023-06-21", joined: "2023-04-10", downloads: 42 },
  { id: "5", name: "Michael Brown", email: "michael@example.com", role: "user", status: "active", lastLogin: "2023-06-15", joined: "2023-05-05", downloads: 18 },
  { id: "6", name: "Jessica Davis", email: "jessica@example.com", role: "user", status: "active", lastLogin: "2023-06-19", joined: "2023-05-28", downloads: 9 },
  { id: "7", name: "Robert Wilson", email: "robert@example.com", role: "user", status: "inactive", lastLogin: "2023-05-30", joined: "2023-04-22", downloads: 3 },
  { id: "8", name: "Amanda Martinez", email: "amanda@example.com", role: "user", status: "active", lastLogin: "2023-06-17", joined: "2023-06-01", downloads: 7 },
  { id: "9", name: "Thomas Taylor", email: "thomas@example.com", role: "user", status: "active", lastLogin: "2023-06-20", joined: "2023-06-10", downloads: 2 },
  { id: "10", name: "Jennifer Garcia", email: "jennifer@example.com", role: "user", status: "active", lastLogin: "2023-06-16", joined: "2023-05-20", downloads: 15 },
  { id: "11", name: "Kevin Rodriguez", email: "kevin@example.com", role: "user", status: "inactive", lastLogin: "2023-05-25", joined: "2023-05-10", downloads: 4 },
  { id: "12", name: "Lisa Smith", email: "lisa@example.com", role: "user", status: "active", lastLogin: "2023-06-18", joined: "2023-06-05", downloads: 8 }
];

export default function UsersManagement() {
  const [users, setUsers] = useState<User[]>(mockUsers); // Initialize with mock data
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [filter, setFilter] = useState<"all" | "active" | "pending">("all");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "user">("all");
  const [sort, setSort] = useState<{ field: string; direction: "asc" | "desc" }>({ field: "createdAt", direction: "desc" });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isAdmin, isLoading: isAdminLoading } = useAdmin();
  const router = useRouter();
  
  // Redirect regular users to the add book page
  useEffect(() => {
    if (!isAdminLoading && !isAdmin) {
      router.push('/admin/books/new');
    }
  }, [isAdmin, isAdminLoading, router]);
  
  // GSAP animations
  useEffect(() => {
    if (isAdmin && !isAdminLoading) {
      gsap.fromTo(
        ".user-table-row",
        { 
          opacity: 0,
          y: 20
        },
        { 
          opacity: 1,
          y: 0,
          stagger: 0.05,
          duration: 0.5,
          ease: "power2.out"
        }
      );
    }
  }, [currentPage, filter, roleFilter, searchTerm, sort, isAdmin, isAdminLoading]);
  
  // If loading or not admin, don't render the page yet
  if (isAdminLoading || !isAdmin) {
    return null;
  }
  
  const usersPerPage = 8;
  
  // Filter and sort users
  const filteredUsers = users
    .filter(user => filter === "all" || user.status === filter)
    .filter(user => roleFilter === "all" || user.role === roleFilter)
    .filter(user => 
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      const fieldA = a[sort.field as keyof typeof a];
      const fieldB = b[sort.field as keyof typeof b];
      
      if (typeof fieldA === "string" && typeof fieldB === "string") {
        return sort.direction === "asc" 
          ? fieldA.localeCompare(fieldB) 
          : fieldB.localeCompare(fieldA);
      }
      
      return sort.direction === "asc" 
        ? Number(fieldA) - Number(fieldB) 
        : Number(fieldB) - Number(fieldA);
    });
  
  // Pagination
  const totalPages = Math.ceil(filteredUsers.length / usersPerPage);
  const indexOfLastUser = currentPage * usersPerPage;
  const indexOfFirstUser = indexOfLastUser - usersPerPage;
  const currentUsers = filteredUsers.slice(indexOfFirstUser, indexOfLastUser);
  
  // Toggle select all users
  const toggleSelectAll = () => {
    if (selectedUsers.length === currentUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(currentUsers.map(user => user.id));
    }
  };
  
  // Toggle select one user
  const toggleSelectUser = (id: string) => {
    if (selectedUsers.includes(id)) {
      setSelectedUsers(selectedUsers.filter(userId => userId !== id));
    } else {
      setSelectedUsers([...selectedUsers, id]);
    }
  };
  
  // Handle sort change
  const handleSort = (field: string) => {
    if (sort.field === field) {
      setSort({ ...sort, direction: sort.direction === "asc" ? "desc" : "asc" });
    } else {
      setSort({ field, direction: "desc" });
    }
  };
  
  // Toggle user status
  const toggleUserStatus = (id: string) => {
    setUsers(
      users.map(user => 
        user.id === id 
          ? { ...user, status: user.status === "active" ? "pending" : "active" } 
          : user
      )
    );
  };
  
  // Send email to user (mock function)
  const sendEmail = (email: string) => {
    alert(`Email would be sent to ${email}`);
  };
  
  // User stats
  const totalActiveUsers = users.filter(user => user.status === "active").length;
  const totalInactiveUsers = users.filter(user => user.status === "inactive").length;
  const totalAdminUsers = users.filter(user => user.role === "admin").length;
  
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Users Management</h1>
        <p className="mt-2 text-sm text-gray-600">
          Manage your users, view activity, and control user access.
        </p>
      </div>
      
      {/* Stats */}
      <div className="mb-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg bg-white p-5 shadow-md">
          <div className="flex items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <FiUserCheck className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Active Users</p>
              <p className="text-2xl font-bold text-gray-900">{totalActiveUsers}</p>
            </div>
          </div>
        </div>
        
        <div className="rounded-lg bg-white p-5 shadow-md">
          <div className="flex items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <FiUserX className="h-6 w-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Inactive Users</p>
              <p className="text-2xl font-bold text-gray-900">{totalInactiveUsers}</p>
            </div>
          </div>
        </div>
        
        <div className="rounded-lg bg-white p-5 shadow-md">
          <div className="flex items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100">
              <FiEye className="h-6 w-6 text-indigo-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Admin Users</p>
              <p className="text-2xl font-bold text-gray-900">{totalAdminUsers}</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Filters and Search */}
      <div className="mb-6 rounded-lg bg-white p-4 shadow-md">
        <div className="flex flex-col space-y-4 md:flex-row md:items-center md:space-x-4 md:space-y-0">
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <FiSearch className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full rounded-md border-0 py-1.5 pl-10 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <div className="inline-flex items-center">
              <FiFilter className="mr-2 h-5 w-5 text-gray-400" />
              <select
                className="rounded-md border-0 py-1.5 pl-2 pr-8 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
                value={filter}
                onChange={(e) => setFilter(e.target.value as "all" | "active" | "pending")}
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
              </select>
            </div>
            
            <div className="inline-flex items-center">
              <select
                className="rounded-md border-0 py-1.5 pl-2 pr-8 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as "all" | "admin" | "user")}
              >
                <option value="all">All Roles</option>
                <option value="admin">Admins</option>
                <option value="user">Users</option>
              </select>
            </div>
          </div>
        </div>
      </div>
      
      {/* Users Table */}
      <div className="overflow-hidden rounded-lg bg-white shadow">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    checked={selectedUsers.length === currentUsers.length && currentUsers.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th 
                  scope="col" 
                  className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 cursor-pointer"
                  onClick={() => handleSort("name")}
                >
                  <div className="group inline-flex">
                    Name
                    <span className="ml-2 flex-none rounded text-gray-400 group-hover:visible group-hover:text-gray-500">
                      {sort.field === "name" && (
                        sort.direction === "desc" ? "↓" : "↑"
                      )}
                    </span>
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 cursor-pointer"
                  onClick={() => handleSort("email")}
                >
                  <div className="group inline-flex">
                    Email
                    <span className="ml-2 flex-none rounded text-gray-400 group-hover:visible group-hover:text-gray-500">
                      {sort.field === "email" && (
                        sort.direction === "desc" ? "↓" : "↑"
                      )}
                    </span>
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 cursor-pointer"
                  onClick={() => handleSort("role")}
                >
                  <div className="group inline-flex">
                    Role
                    <span className="ml-2 flex-none rounded text-gray-400 group-hover:visible group-hover:text-gray-500">
                      {sort.field === "role" && (
                        sort.direction === "desc" ? "↓" : "↑"
                      )}
                    </span>
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 cursor-pointer"
                  onClick={() => handleSort("status")}
                >
                  <div className="group inline-flex">
                    Status
                    <span className="ml-2 flex-none rounded text-gray-400 group-hover:visible group-hover:text-gray-500">
                      {sort.field === "status" && (
                        sort.direction === "desc" ? "↓" : "↑"
                      )}
                    </span>
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 cursor-pointer"
                  onClick={() => handleSort("lastLogin")}
                >
                  <div className="group inline-flex">
                    Last Login
                    <span className="ml-2 flex-none rounded text-gray-400 group-hover:visible group-hover:text-gray-500">
                      {sort.field === "lastLogin" && (
                        sort.direction === "desc" ? "↓" : "↑"
                      )}
                    </span>
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 cursor-pointer"
                  onClick={() => handleSort("joined")}
                >
                  <div className="group inline-flex">
                    Joined
                    <span className="ml-2 flex-none rounded text-gray-400 group-hover:visible group-hover:text-gray-500">
                      {sort.field === "joined" && (
                        sort.direction === "desc" ? "↓" : "↑"
                      )}
                    </span>
                  </div>
                </th>
                <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {currentUsers.length > 0 ? (
                currentUsers.map((user, index) => (
                  <tr key={user.id} className={`user-table-row ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-gray-100`}>
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        checked={selectedUsers.includes(user.id)}
                        onChange={() => toggleSelectUser(user.id)}
                      />
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                      <div className="font-medium text-gray-900">{user.name}</div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{user.email}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                      <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                        user.role === "admin" 
                          ? "bg-indigo-100 text-indigo-800" 
                          : "bg-gray-100 text-gray-800"
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                      <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                        user.status === "active" 
                          ? "bg-green-100 text-green-800" 
                          : "bg-red-100 text-red-800"
                      }`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      {new Date(user.lastLogin).toLocaleDateString()}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      {new Date(user.joined).toLocaleDateString()}
                    </td>
                    <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => sendEmail(user.email)}
                          className="text-indigo-600 hover:text-indigo-900"
                          title="Send Email"
                        >
                          <FiMail className="h-4 w-4" />
                          <span className="sr-only">Email {user.name}</span>
                        </button>
                        <button
                          onClick={() => toggleUserStatus(user.id)}
                          className={`${user.status === "active" ? "text-red-600 hover:text-red-900" : "text-green-600 hover:text-green-900"}`}
                          title={user.status === "active" ? "Deactivate User" : "Activate User"}
                        >
                          {user.status === "active" ? (
                            <FiUserX className="h-4 w-4" />
                          ) : (
                            <FiUserCheck className="h-4 w-4" />
                          )}
                          <span className="sr-only">
                            {user.status === "active" ? "Deactivate" : "Activate"} {user.name}
                          </span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-sm text-gray-500">
                    No users found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing <span className="font-medium">{indexOfFirstUser + 1}</span> to{" "}
                  <span className="font-medium">
                    {indexOfLastUser > filteredUsers.length ? filteredUsers.length : indexOfLastUser}
                  </span>{" "}
                  of <span className="font-medium">{filteredUsers.length}</span> results
                </p>
              </div>
              <div>
                <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className={`relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 ${
                      currentPage === 1 ? "cursor-not-allowed" : "hover:text-gray-500"
                    }`}
                  >
                    <span className="sr-only">Previous</span>
                    <FiChevronLeft className="h-5 w-5" aria-hidden="true" />
                  </button>
                  
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                        page === currentPage
                          ? "z-10 bg-indigo-600 text-white focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                          : "text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0"
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className={`relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 ${
                      currentPage === totalPages ? "cursor-not-allowed" : "hover:text-gray-500"
                    }`}
                  >
                    <span className="sr-only">Next</span>
                    <FiChevronRight className="h-5 w-5" aria-hidden="true" />
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 