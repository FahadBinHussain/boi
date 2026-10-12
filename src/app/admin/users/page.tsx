"use client";

import { useState, useEffect } from "react";
import { FiSearch, FiFilter, FiMail, FiEye, FiUserX, FiUserCheck, FiChevronLeft, FiChevronRight, FiEdit2, FiTrash2, FiLoader, FiUsers } from "react-icons/fi";
import MotionIcon from "@/components/ui/MotionIcon";
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

export default function UsersManagement() {
  const [users, setUsers] = useState<User[]>([]); // Start with an empty array
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
        <h1 className="text-2xl font-bold text-base-content">Users Management</h1>
        <p className="mt-2 text-sm text-base-content/70">
          Manage your users, view activity, and control user access.
        </p>
      </div>
      
      {/* Stats */}
      <div className="mb-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <div className="card bg-base-200 border border-base-300 p-5 shadow-sm">
          <div className="flex items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/15 text-success">
              <MotionIcon animation="bounce" trigger="always">
                <FiUserCheck className="h-6 w-6" />
              </MotionIcon>
            </div>
            <div className="ml-4">
              <p className="text-xs font-semibold text-base-content/60 uppercase tracking-wider">Active Users</p>
              <p className="text-2xl font-black text-base-content">{totalActiveUsers}</p>
            </div>
          </div>
        </div>
        
        <div className="card bg-base-200 border border-base-300 p-5 shadow-sm">
          <div className="flex items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-error/15 text-error">
              <MotionIcon animation="wiggle" trigger="always">
                <FiUserX className="h-6 w-6" />
              </MotionIcon>
            </div>
            <div className="ml-4">
              <p className="text-xs font-semibold text-base-content/60 uppercase tracking-wider">Inactive Users</p>
              <p className="text-2xl font-black text-base-content">{totalInactiveUsers}</p>
            </div>
          </div>
        </div>
        
        <div className="card bg-base-200 border border-base-300 p-5 shadow-sm">
          <div className="flex items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <MotionIcon animation="pulse" trigger="always">
                <FiEye className="h-6 w-6" />
              </MotionIcon>
            </div>
            <div className="ml-4">
              <p className="text-xs font-semibold text-base-content/60 uppercase tracking-wider">Admin Users</p>
              <p className="text-2xl font-black text-base-content">{totalAdminUsers}</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Filters and Search */}
      <div className="card bg-base-200 border border-base-300 p-4 shadow-sm mb-6">
        <div className="flex flex-col space-y-4 md:flex-row md:items-center md:space-x-4 md:space-y-0">
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <MotionIcon animation="wiggle" trigger="hover">
                <FiSearch className="h-5 w-5 text-base-content/40" />
              </MotionIcon>
            </div>
            <input
              type="text"
              className="input input-bordered w-full pl-10 bg-base-100 text-base-content"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <div className="inline-flex items-center">
              <MotionIcon animation="wiggle" trigger="hover" className="mr-2">
                <FiFilter className="h-5 w-5 text-base-content/40" />
              </MotionIcon>
              <select
                className="select select-bordered bg-base-100 text-base-content"
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
                className="select select-bordered bg-base-100 text-base-content"
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
      <div className="card bg-base-200 border border-base-300 shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table table-zebra w-full">
            <thead className="bg-base-300/40 text-base-content">
              <tr>
                <th scope="col" className="px-3 py-3.5 text-left">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-primary checkbox-sm"
                    checked={selectedUsers.length === currentUsers.length && currentUsers.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th 
                  scope="col" 
                  className="px-3 py-3.5 text-left text-sm font-bold text-base-content cursor-pointer"
                  onClick={() => handleSort("name")}
                >
                  <div className="group inline-flex items-center">
                    Name
                    <span className="ml-2 text-base-content/50 group-hover:text-base-content">
                      {sort.field === "name" && (
                        sort.direction === "desc" ? "↓" : "↑"
                      )}
                    </span>
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="px-3 py-3.5 text-left text-sm font-bold text-base-content cursor-pointer"
                  onClick={() => handleSort("email")}
                >
                  <div className="group inline-flex items-center">
                    Email
                    <span className="ml-2 text-base-content/50 group-hover:text-base-content">
                      {sort.field === "email" && (
                        sort.direction === "desc" ? "↓" : "↑"
                      )}
                    </span>
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="px-3 py-3.5 text-left text-sm font-bold text-base-content cursor-pointer"
                  onClick={() => handleSort("role")}
                >
                  <div className="group inline-flex items-center">
                    Role
                    <span className="ml-2 text-base-content/50 group-hover:text-base-content">
                      {sort.field === "role" && (
                        sort.direction === "desc" ? "↓" : "↑"
                      )}
                    </span>
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="px-3 py-3.5 text-left text-sm font-bold text-base-content cursor-pointer"
                  onClick={() => handleSort("status")}
                >
                  <div className="group inline-flex items-center">
                    Status
                    <span className="ml-2 text-base-content/50 group-hover:text-base-content">
                      {sort.field === "status" && (
                        sort.direction === "desc" ? "↓" : "↑"
                      )}
                    </span>
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="px-3 py-3.5 text-left text-sm font-bold text-base-content cursor-pointer"
                  onClick={() => handleSort("lastLogin")}
                >
                  <div className="group inline-flex items-center">
                    Last Login
                    <span className="ml-2 text-base-content/50 group-hover:text-base-content">
                      {sort.field === "lastLogin" && (
                        sort.direction === "desc" ? "↓" : "↑"
                      )}
                    </span>
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="px-3 py-3.5 text-left text-sm font-bold text-base-content cursor-pointer"
                  onClick={() => handleSort("joined")}
                >
                  <div className="group inline-flex items-center">
                    Joined
                    <span className="ml-2 text-base-content/50 group-hover:text-base-content">
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
            <tbody>
              {currentUsers.length > 0 ? (
                currentUsers.map((user) => (
                  <tr key={user.id} className="user-table-row hover:bg-base-300/30">
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-primary checkbox-sm"
                        checked={selectedUsers.includes(user.id)}
                        onChange={() => toggleSelectUser(user.id)}
                      />
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                      <div className="font-bold text-base-content">{user.name}</div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-base-content/70">{user.email}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                      <span className={`badge badge-sm font-semibold ${
                        user.role === "admin" 
                          ? "badge-primary" 
                          : "badge-ghost"
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                      <span className={`badge badge-sm font-semibold ${
                        user.status === "active" 
                          ? "badge-success" 
                          : "badge-error"
                      }`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-base-content/60">
                      {new Date(user.lastLogin).toLocaleDateString()}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-base-content/60">
                      {new Date(user.joined).toLocaleDateString()}
                    </td>
                    <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                      <div className="flex items-center justify-end space-x-1">
                        <button
                          onClick={() => sendEmail(user.email)}
                          className="btn btn-ghost btn-circle btn-xs text-primary"
                          title="Send Email"
                        >
                          <MotionIcon animation="bounce" trigger="hover">
                            <FiMail className="h-4 w-4" />
                          </MotionIcon>
                          <span className="sr-only">Email {user.name}</span>
                        </button>
                        <button
                          onClick={() => toggleUserStatus(user.id)}
                          className={`btn btn-ghost btn-circle btn-xs ${user.status === "active" ? "text-error" : "text-success"}`}
                          title={user.status === "active" ? "Deactivate User" : "Activate User"}
                        >
                          {user.status === "active" ? (
                            <MotionIcon animation="wiggle" trigger="hover">
                              <FiUserX className="h-4 w-4" />
                            </MotionIcon>
                          ) : (
                            <MotionIcon animation="bounce" trigger="hover">
                              <FiUserCheck className="h-4 w-4" />
                            </MotionIcon>
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
                  <td colSpan={8} className="px-6 py-12 text-center text-sm text-base-content/60">
                    No users found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-base-300 bg-base-200/50 px-4 py-3 sm:px-6">
            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-base-content/70">
                  Showing <span className="font-semibold text-base-content">{indexOfFirstUser + 1}</span> to{" "}
                  <span className="font-semibold text-base-content">
                    {indexOfLastUser > filteredUsers.length ? filteredUsers.length : indexOfLastUser}
                  </span>{" "}
                  of <span className="font-semibold text-base-content">{filteredUsers.length}</span> results
                </p>
              </div>
              <div>
                <div className="join">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="join-item btn btn-sm btn-ghost border border-base-300"
                  >
                    <span className="sr-only">Previous</span>
                    <MotionIcon animation="bounce" trigger="hover">
                      <FiChevronLeft className="h-4 w-4" aria-hidden="true" />
                    </MotionIcon>
                  </button>
                  
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`join-item btn btn-sm ${
                        page === currentPage
                          ? "btn-primary"
                          : "btn-ghost border border-base-300 text-base-content"
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="join-item btn btn-sm btn-ghost border border-base-300"
                  >
                    <span className="sr-only">Next</span>
                    <MotionIcon animation="bounce" trigger="hover">
                      <FiChevronRight className="h-4 w-4" aria-hidden="true" />
                    </MotionIcon>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 