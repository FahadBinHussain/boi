"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { FiPlusCircle, FiSearch, FiEdit2, FiTrash2, FiFilter, FiDownload, FiChevronLeft, FiChevronRight } from "react-icons/fi";
import gsap from "gsap";

// Mock data for books
const mockBooks = [
  { id: 1, title: "The Art of Programming", author: "John Doe", category: "Programming", downloads: 1203, status: "active", createdAt: "2023-04-10" },
  { id: 2, title: "Data Structures Explained", author: "Jane Smith", category: "Computer Science", downloads: 845, status: "active", createdAt: "2023-04-15" },
  { id: 3, title: "Machine Learning Basics", author: "Robert Johnson", category: "AI", downloads: 567, status: "pending", createdAt: "2023-04-22" },
  { id: 4, title: "Web Development Guide", author: "Emily Williams", category: "Web Development", downloads: 421, status: "active", createdAt: "2023-05-01" },
  { id: 5, title: "Python for Beginners", author: "Michael Brown", category: "Programming", downloads: 320, status: "active", createdAt: "2023-05-05" },
  { id: 6, title: "JavaScript Mastery", author: "Sarah Lee", category: "Web Development", downloads: 289, status: "active", createdAt: "2023-05-12" },
  { id: 7, title: "Algorithms and Complexity", author: "David Chen", category: "Computer Science", downloads: 154, status: "pending", createdAt: "2023-05-18" },
  { id: 8, title: "Database Design Principles", author: "Lisa Garcia", category: "Databases", downloads: 132, status: "active", createdAt: "2023-05-25" },
  { id: 9, title: "Mobile App Development", author: "Kevin Wilson", category: "Mobile", downloads: 98, status: "active", createdAt: "2023-06-01" },
  { id: 10, title: "Cloud Computing Essentials", author: "Amanda Taylor", category: "Cloud", downloads: 76, status: "active", createdAt: "2023-06-05" },
  { id: 11, title: "Cybersecurity Fundamentals", author: "James Miller", category: "Security", downloads: 53, status: "pending", createdAt: "2023-06-10" },
  { id: 12, title: "Blockchain Technology", author: "Thomas Anderson", category: "Blockchain", downloads: 42, status: "active", createdAt: "2023-06-15" }
];

export default function BooksManagement() {
  const [books, setBooks] = useState(mockBooks);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedBooks, setSelectedBooks] = useState<number[]>([]);
  const [filter, setFilter] = useState<"all" | "active" | "pending">("all");
  const [sort, setSort] = useState<{ field: string; direction: "asc" | "desc" }>({ field: "createdAt", direction: "desc" });
  
  const booksPerPage = 8;
  
  // Filter and sort books
  const filteredBooks = books
    .filter(book => filter === "all" || book.status === filter)
    .filter(book => 
      book.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
      book.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
      book.category.toLowerCase().includes(searchTerm.toLowerCase())
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
  const totalPages = Math.ceil(filteredBooks.length / booksPerPage);
  const indexOfLastBook = currentPage * booksPerPage;
  const indexOfFirstBook = indexOfLastBook - booksPerPage;
  const currentBooks = filteredBooks.slice(indexOfFirstBook, indexOfLastBook);
  
  // Toggle select all books
  const toggleSelectAll = () => {
    if (selectedBooks.length === currentBooks.length) {
      setSelectedBooks([]);
    } else {
      setSelectedBooks(currentBooks.map(book => book.id));
    }
  };
  
  // Toggle select one book
  const toggleSelectBook = (id: number) => {
    if (selectedBooks.includes(id)) {
      setSelectedBooks(selectedBooks.filter(bookId => bookId !== id));
    } else {
      setSelectedBooks([...selectedBooks, id]);
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
  
  // Delete selected books
  const deleteSelected = () => {
    if (window.confirm(`Are you sure you want to delete ${selectedBooks.length} selected book(s)?`)) {
      setBooks(books.filter(book => !selectedBooks.includes(book.id)));
      setSelectedBooks([]);
    }
  };
  
  // GSAP animations
  useEffect(() => {
    gsap.fromTo(
      ".book-table-row",
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
  }, [currentPage, filter, searchTerm, sort]);
  
  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Books Management</h1>
        <div className="mt-4 sm:mt-0">
          <Link
            href="/admin/books/new"
            className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <FiPlusCircle className="mr-2 h-4 w-4" />
            Add New Book
          </Link>
        </div>
      </div>
      
      {/* Filters and Search */}
      <div className="mb-6 rounded-lg bg-white p-4 shadow-md">
        <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
          <div className="flex flex-1 flex-col space-y-4 md:flex-row md:space-x-4 md:space-y-0">
            <div className="relative flex-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <FiSearch className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                className="block w-full rounded-md border-0 py-1.5 pl-10 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
                placeholder="Search books..."
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
            </div>
          </div>
          
          {selectedBooks.length > 0 && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500">{selectedBooks.length} selected</span>
              <button
                onClick={deleteSelected}
                className="inline-flex items-center rounded-md bg-red-100 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-200"
              >
                <FiTrash2 className="mr-1 h-4 w-4" />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Books Table */}
      <div className="overflow-hidden rounded-lg bg-white shadow">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    checked={selectedBooks.length === currentBooks.length && currentBooks.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th 
                  scope="col" 
                  className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 cursor-pointer"
                  onClick={() => handleSort("title")}
                >
                  <div className="group inline-flex">
                    Title
                    <span className="ml-2 flex-none rounded text-gray-400 group-hover:visible group-hover:text-gray-500">
                      {sort.field === "title" && (
                        sort.direction === "desc" ? "↓" : "↑"
                      )}
                    </span>
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 cursor-pointer"
                  onClick={() => handleSort("author")}
                >
                  <div className="group inline-flex">
                    Author
                    <span className="ml-2 flex-none rounded text-gray-400 group-hover:visible group-hover:text-gray-500">
                      {sort.field === "author" && (
                        sort.direction === "desc" ? "↓" : "↑"
                      )}
                    </span>
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 cursor-pointer"
                  onClick={() => handleSort("category")}
                >
                  <div className="group inline-flex">
                    Category
                    <span className="ml-2 flex-none rounded text-gray-400 group-hover:visible group-hover:text-gray-500">
                      {sort.field === "category" && (
                        sort.direction === "desc" ? "↓" : "↑"
                      )}
                    </span>
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 cursor-pointer"
                  onClick={() => handleSort("downloads")}
                >
                  <div className="group inline-flex">
                    Downloads
                    <span className="ml-2 flex-none rounded text-gray-400 group-hover:visible group-hover:text-gray-500">
                      {sort.field === "downloads" && (
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
                  onClick={() => handleSort("createdAt")}
                >
                  <div className="group inline-flex">
                    Created At
                    <span className="ml-2 flex-none rounded text-gray-400 group-hover:visible group-hover:text-gray-500">
                      {sort.field === "createdAt" && (
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
              {currentBooks.length > 0 ? (
                currentBooks.map((book, index) => (
                  <tr key={book.id} className={`book-table-row ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-gray-100`}>
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        checked={selectedBooks.includes(book.id)}
                        onChange={() => toggleSelectBook(book.id)}
                      />
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                      <div className="font-medium text-gray-900">{book.title}</div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{book.author}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{book.category}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      <div className="flex items-center">
                        <FiDownload className="mr-1 h-4 w-4 text-gray-400" />
                        {book.downloads}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                      <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                        book.status === "active" 
                          ? "bg-green-100 text-green-800" 
                          : "bg-yellow-100 text-yellow-800"
                      }`}>
                        {book.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      {new Date(book.createdAt).toLocaleDateString()}
                    </td>
                    <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                      <div className="flex items-center justify-end space-x-2">
                        <Link
                          href={`/admin/books/edit/${book.id}`}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          <FiEdit2 className="h-4 w-4" />
                          <span className="sr-only">Edit {book.title}</span>
                        </Link>
                        <button
                          onClick={() => {
                            if (window.confirm(`Are you sure you want to delete "${book.title}"?`)) {
                              setBooks(books.filter(b => b.id !== book.id));
                            }
                          }}
                          className="text-red-600 hover:text-red-900"
                        >
                          <FiTrash2 className="h-4 w-4" />
                          <span className="sr-only">Delete {book.title}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-sm text-gray-500">
                    No books found matching your criteria.
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
                  Showing <span className="font-medium">{indexOfFirstBook + 1}</span> to{" "}
                  <span className="font-medium">
                    {indexOfLastBook > filteredBooks.length ? filteredBooks.length : indexOfLastBook}
                  </span>{" "}
                  of <span className="font-medium">{filteredBooks.length}</span> results
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