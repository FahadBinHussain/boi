"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { FiPlusCircle, FiSearch, FiEdit2, FiTrash2, FiFilter, FiDownload, FiChevronLeft, FiChevronRight, FiBook, FiLoader } from "react-icons/fi";
import gsap from "gsap";
import toast from "react-hot-toast";

// Define book type
interface Book {
  id: string;
  title: string;
  author: string;
  category: string;
  downloads: number;
  status: "active" | "pending";
  createdAt: string;
}

export default function BooksManagement() {
  const [books, setBooks] = useState<Book[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedBooks, setSelectedBooks] = useState<string[]>([]);
  const [filter, setFilter] = useState<"all" | "active" | "pending">("all");
  const [sort, setSort] = useState<{ field: string; direction: "asc" | "desc" }>({ field: "createdAt", direction: "desc" });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch books from the API
  useEffect(() => {
    const fetchBooks = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const response = await fetch('/api/admin/books');
        
        if (!response.ok) {
          throw new Error(`Failed to fetch books: ${response.statusText}`);
        }
        
        const data = await response.json();
        setBooks(data);
      } catch (err) {
        console.error('Error fetching books:', err);
        setError('Failed to load books. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchBooks();
  }, []);
  
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
  const toggleSelectBook = (id: string) => {
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
  const deleteSelected = async () => {
    if (selectedBooks.length === 0) return;

    const confirmDelete = window.confirm(`Are you sure you want to delete ${selectedBooks.length} book(s)?`);
    if (!confirmDelete) return;

    setIsLoading(true);
    
    try {
      // Use the bulk delete endpoint for multiple books
      const response = await fetch('/api/admin/books/bulk-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bookIds: selectedBooks }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete books');
      }
      
      // Update local state
      setBooks(prevBooks => prevBooks.filter(book => !selectedBooks.includes(book.id)));
      setSelectedBooks([]);
      
      toast.success(`${result.count} book(s) deleted successfully.`);
    } catch (error) {
      console.error('Error deleting books:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete books');
    } finally {
      setIsLoading(false);
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
      
      {/* Loading State */}
      {isLoading && (
        <div className="flex justify-center items-center h-64">
          <FiLoader className="animate-spin h-8 w-8 text-indigo-600" />
          <span className="ml-2 text-lg text-gray-600">Loading books...</span>
        </div>
      )}
      
      {/* Error State */}
      {error && (
        <div className="bg-red-50 p-4 rounded-lg border border-red-200 text-red-700">
          <p className="font-medium">{error}</p>
          <p className="mt-1 text-sm">Please try refreshing the page or contact support if the problem persists.</p>
        </div>
      )}
      
      {/* Books Table or Empty State */}
      {!isLoading && !error && (
        books.length > 0 ? (
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
                    <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {currentBooks.map((book) => (
                    <tr key={book.id} className="book-table-row">
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          checked={selectedBooks.includes(book.id)}
                          onChange={() => toggleSelectBook(book.id)}
                        />
                      </td>
                      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                        {book.title}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{book.author}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{book.category}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{book.downloads}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                          book.status === "active" 
                            ? "bg-green-100 text-green-800" 
                            : "bg-yellow-100 text-yellow-800"
                        }`}>
                          {book.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          <Link
                            href={`/admin/books/${book.id}`}
                            className="rounded bg-blue-100 p-1.5 text-blue-600 hover:bg-blue-200 focus:outline-none"
                          >
                            <FiEdit2 className="h-4 w-4" />
                            <span className="sr-only">Edit</span>
                          </Link>
                          <button
                            onClick={async () => {
                              if (window.confirm(`Are you sure you want to delete "${book.title}"?`)) {
                                try {
                                  const response = await fetch(`/api/admin/book-delete`, {
                                    method: 'POST',
                                    headers: {
                                      'Content-Type': 'application/json',
                                    },
                                    body: JSON.stringify({ bookId: book.id }),
                                  });
                                  
                                  if (!response.ok) {
                                    throw new Error(`Failed to delete book: ${response.statusText}`);
                                  }
                                  
                                  // Update local state
                                  setBooks(books.filter(b => b.id !== book.id));
                                  toast.success(`"${book.title}" deleted successfully.`);
                                } catch (error) {
                                  console.error('Error deleting book:', error);
                                  toast.error('Failed to delete book. Please try again.');
                                }
                              }
                            }}
                            className="rounded bg-red-100 p-1.5 text-red-600 hover:bg-red-200 focus:outline-none"
                          >
                            <FiTrash2 className="h-4 w-4" />
                            <span className="sr-only">Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
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
                        {indexOfLastBook > filteredBooks.length
                          ? filteredBooks.length
                          : indexOfLastBook}
                      </span>{" "}
                      of <span className="font-medium">{filteredBooks.length}</span> results
                    </p>
                  </div>
                  <div>
                    <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className={`relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 ${
                          currentPage === 1 ? "cursor-not-allowed" : ""
                        }`}
                      >
                        <span className="sr-only">Previous</span>
                        <FiChevronLeft className="h-5 w-5" aria-hidden="true" />
                      </button>
                      
                      {/* Page numbers */}
                      {[...Array(totalPages)].map((_, index) => (
                        <button
                          key={index + 1}
                          onClick={() => setCurrentPage(index + 1)}
                          className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                            currentPage === index + 1
                              ? "z-10 bg-indigo-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                              : "text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0"
                          }`}
                        >
                          {index + 1}
                        </button>
                      ))}
                      
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className={`relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 ${
                          currentPage === totalPages ? "cursor-not-allowed" : ""
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
        ) : (
          <div className="py-12 text-center bg-white rounded-lg shadow-md">
            <FiBook className="mx-auto h-12 w-12 text-gray-300" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No books yet</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by adding your first book to your collection.</p>
            <div className="mt-6">
              <Link
                href="/admin/books/new"
                className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
              >
                <FiPlusCircle className="-ml-0.5 mr-1.5 h-4 w-4" aria-hidden="true" />
                Add New Book
              </Link>
            </div>
          </div>
        )
      )}
    </div>
  );
} 