"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { FiPlusCircle, FiSearch, FiEdit2, FiTrash2, FiFilter, FiDownload, FiChevronLeft, FiChevronRight, FiBook, FiLoader } from "react-icons/fi";
import MotionIcon from "@/components/ui/MotionIcon";
import gsap from "gsap";
import toast from "react-hot-toast";
import { useAdmin } from "@/lib/hooks/useAdmin";
import { useRouter } from "next/navigation";

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
  const { isAdmin, isLoading: isAdminLoading } = useAdmin();
  const router = useRouter();
  
  // Redirect regular users to the add book page
  useEffect(() => {
    if (!isAdminLoading && !isAdmin) {
      router.push('/admin/books/new');
    }
  }, [isAdmin, isAdminLoading, router]);
  
  // Fetch books from the API
  useEffect(() => {
    // Only fetch books if user is admin and not being redirected
    if (isAdmin && !isAdminLoading) {
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
    }
  }, [isAdmin, isAdminLoading]);
  
  // GSAP animations
  useEffect(() => {
    if (isAdmin && !isAdminLoading) {
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
    }
  }, [currentPage, filter, searchTerm, sort, isAdmin, isAdminLoading]);
  
  // If loading or not admin, don't render the page yet
  if (isAdminLoading || !isAdmin) {
    return null;
  }
  
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
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bookIds: selectedBooks }),
      });
      
      const result = await response.json().catch(() => null);
      
      if (!response.ok) {
        throw new Error(result?.error || result?.details || 'Failed to delete books');
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
  
  return (
    <div className="p-6 lg:p-8 bg-base-100 min-h-screen text-base-content transition-colors">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-base-content">Books Management</h1>
          <p className="text-xs text-base-content/60 mt-1">Manage and organize all books in the catalog</p>
        </div>
        <div>
          <Link
            href="/admin/books/new"
            className="btn btn-primary btn-sm rounded-full px-5 gap-2 shadow-md"
          >
            <MotionIcon animation="bounce" trigger="hover">
              <FiPlusCircle className="h-4 w-4" />
            </MotionIcon>
            <span>Add New Book</span>
          </Link>
        </div>
      </div>
      
      {/* Filters and Search */}
      <div className="mb-6 card bg-base-200 border border-base-300 p-4 rounded-2xl shadow-sm">
        <div className="flex flex-col space-y-3 md:flex-row md:items-center md:justify-between md:space-y-0 gap-4">
          <div className="flex flex-1 flex-col space-y-3 md:flex-row md:space-x-3 md:space-y-0">
            <div className="relative flex-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <MotionIcon animation="wiggle" trigger="hover">
                  <FiSearch className="h-4 w-4 text-base-content/40" />
                </MotionIcon>
              </div>
              <input
                type="text"
                className="input input-bordered input-sm w-full pl-9 bg-base-100 text-base-content"
                placeholder="Search books..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <div className="inline-flex items-center gap-1.5">
                <MotionIcon animation="wiggle" trigger="hover">
                  <FiFilter className="h-4 w-4 text-base-content/40" />
                </MotionIcon>
                <select
                  className="select select-bordered select-sm bg-base-100 text-base-content"
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
              <span className="text-xs text-base-content/70">{selectedBooks.length} selected</span>
              <button
                onClick={deleteSelected}
                className="btn btn-error btn-sm gap-1.5"
              >
                <MotionIcon animation="wiggle" trigger="hover">
                  <FiTrash2 className="h-4 w-4" />
                </MotionIcon>
                <span>Delete</span>
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Loading State */}
      {isLoading && (
        <div className="flex justify-center items-center h-64 text-base-content">
          <MotionIcon animation="spin" trigger="always">
            <FiLoader className="h-8 w-8 text-primary" />
          </MotionIcon>
          <span className="ml-3 text-base text-base-content/70 font-medium">Loading books...</span>
        </div>
      )}
      
      {/* Error State */}
      {error && (
        <div className="alert alert-error max-w-xl shadow-lg my-6">
          <MotionIcon animation="wiggle" trigger="always">
            <FiTrash2 className="h-5 w-5" />
          </MotionIcon>
          <div>
            <h3 className="font-bold">Error</h3>
            <div className="text-xs">{error}</div>
          </div>
        </div>
      )}
      
      {/* Books Table or Empty State */}
      {!isLoading && !error && (
        books.length > 0 ? (
          <div className="card bg-base-200 border border-base-300 rounded-2xl shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table table-zebra table-sm">
                <thead>
                  <tr className="text-xs uppercase text-base-content/60">
                    <th scope="col" className="w-10">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-primary checkbox-xs"
                        checked={selectedBooks.length === currentBooks.length && currentBooks.length > 0}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th 
                      scope="col" 
                      className="cursor-pointer"
                      onClick={() => handleSort("title")}
                    >
                      <div className="inline-flex items-center gap-1 font-bold">
                        Title
                        {sort.field === "title" && (
                          <span className="text-primary font-bold">{sort.direction === "desc" ? "↓" : "↑"}</span>
                        )}
                      </div>
                    </th>
                    <th 
                      scope="col" 
                      className="cursor-pointer"
                      onClick={() => handleSort("author")}
                    >
                      <div className="inline-flex items-center gap-1 font-bold">
                        Author
                        {sort.field === "author" && (
                          <span className="text-primary font-bold">{sort.direction === "desc" ? "↓" : "↑"}</span>
                        )}
                      </div>
                    </th>
                    <th 
                      scope="col" 
                      className="cursor-pointer"
                      onClick={() => handleSort("category")}
                    >
                      <div className="inline-flex items-center gap-1 font-bold">
                        Category
                        {sort.field === "category" && (
                          <span className="text-primary font-bold">{sort.direction === "desc" ? "↓" : "↑"}</span>
                        )}
                      </div>
                    </th>
                    <th 
                      scope="col" 
                      className="cursor-pointer"
                      onClick={() => handleSort("downloads")}
                    >
                      <div className="inline-flex items-center gap-1 font-bold">
                        Downloads
                        {sort.field === "downloads" && (
                          <span className="text-primary font-bold">{sort.direction === "desc" ? "↓" : "↑"}</span>
                        )}
                      </div>
                    </th>
                    <th 
                      scope="col" 
                      className="cursor-pointer"
                      onClick={() => handleSort("status")}
                    >
                      <div className="inline-flex items-center gap-1 font-bold">
                        Status
                        {sort.field === "status" && (
                          <span className="text-primary font-bold">{sort.direction === "desc" ? "↓" : "↑"}</span>
                        )}
                      </div>
                    </th>
                    <th scope="col" className="text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {currentBooks.map((book) => (
                    <tr key={book.id} className="book-table-row hover">
                      <td>
                        <input
                          type="checkbox"
                          className="checkbox checkbox-primary checkbox-xs"
                          checked={selectedBooks.includes(book.id)}
                          onChange={() => toggleSelectBook(book.id)}
                        />
                      </td>
                      <td className="font-semibold text-base-content">
                        {book.title}
                      </td>
                      <td className="text-base-content/70">{book.author}</td>
                      <td>
                        <span className="badge badge-outline border-base-content/20 badge-sm text-xs">
                          {book.category}
                        </span>
                      </td>
                      <td className="font-mono text-xs">{book.downloads}</td>
                      <td>
                        <span className={`badge badge-sm font-semibold ${
                          book.status === "active" 
                            ? "badge-success text-success-content" 
                            : "badge-warning text-warning-content"
                        }`}>
                          {book.status}
                        </span>
                      </td>
                      <td className="text-right">
                        <div className="flex justify-end gap-1">
                          <Link
                            href={`/admin/books/${book.id}`}
                            className="btn btn-ghost btn-circle btn-xs text-primary"
                            title="Edit"
                          >
                            <MotionIcon animation="float" trigger="hover">
                              <FiEdit2 className="h-3.5 w-3.5" />
                            </MotionIcon>
                          </Link>
                          <button
                            onClick={async () => {
                              if (window.confirm(`Are you sure you want to delete "${book.title}"?`)) {
                                try {
                                  const response = await fetch(`/api/admin/books/${book.id}/delete`, {
                                    method: 'DELETE',
                                  });
                                  
                                  const result = await response.json().catch(() => null);
                                  
                                  if (!response.ok) {
                                    throw new Error(
                                      result?.error || result?.details || `Failed to delete book: ${response.statusText}`
                                    );
                                  }
                                  
                                  setBooks(prevBooks => prevBooks.filter(b => b.id !== book.id));
                                  toast.success(`"${book.title}" deleted successfully.`);
                                } catch (error) {
                                  console.error('Error deleting book:', error);
                                  toast.error(error instanceof Error ? error.message : 'Failed to delete book. Please try again.');
                                }
                              }
                            }}
                            className="btn btn-ghost btn-circle btn-xs text-error"
                            title="Delete"
                          >
                            <MotionIcon animation="wiggle" trigger="hover">
                              <FiTrash2 className="h-3.5 w-3.5" />
                            </MotionIcon>
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
              <div className="flex flex-col sm:flex-row items-center justify-between border-t border-base-300 bg-base-200/50 px-4 py-3 gap-3">
                <p className="text-xs text-base-content/70">
                  Showing <span className="font-bold">{indexOfFirstBook + 1}</span> to{" "}
                  <span className="font-bold">
                    {indexOfLastBook > filteredBooks.length
                      ? filteredBooks.length
                      : indexOfLastBook}
                  </span>{" "}
                  of <span className="font-bold">{filteredBooks.length}</span> results
                </p>
                <div className="join">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className={`btn btn-outline btn-xs join-item ${currentPage === 1 ? "btn-disabled opacity-40" : ""}`}
                  >
                    <MotionIcon animation="bounce" trigger="hover">
                      <FiChevronLeft className="h-3.5 w-3.5" />
                    </MotionIcon>
                  </button>
                  
                  {[...Array(totalPages)].map((_, index) => (
                    <button
                      key={index + 1}
                      onClick={() => setCurrentPage(index + 1)}
                      className={`btn btn-xs join-item ${
                        currentPage === index + 1
                          ? "btn-primary"
                          : "btn-outline"
                      }`}
                    >
                      {index + 1}
                    </button>
                  ))}
                  
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className={`btn btn-outline btn-xs join-item ${currentPage === totalPages ? "btn-disabled opacity-40" : ""}`}
                  >
                    <MotionIcon animation="bounce" trigger="hover">
                      <FiChevronRight className="h-3.5 w-3.5" />
                    </MotionIcon>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="card bg-base-200 border border-base-300 p-12 text-center rounded-2xl shadow-sm">
            <MotionIcon animation="float" trigger="always">
              <FiBook className="mx-auto h-12 w-12 text-base-content/30" />
            </MotionIcon>
            <h3 className="mt-3 text-base font-bold text-base-content">No books yet</h3>
            <p className="mt-1 text-xs text-base-content/60">Get started by adding your first book to your collection.</p>
            <div className="mt-6">
              <Link
                href="/admin/books/new"
                className="btn btn-primary rounded-full px-6 btn-sm gap-2"
              >
                <MotionIcon animation="bounce" trigger="hover">
                  <FiPlusCircle className="h-4 w-4" />
                </MotionIcon>
                Add New Book
              </Link>
            </div>
          </div>
        )
      )}
    </div>
  );
}
 
