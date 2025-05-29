'use client';

import { useState, useEffect } from 'react';
import BookGrid from '@/components/ui/BookGrid';
import { FiSearch, FiLoader } from 'react-icons/fi';
import type { Book } from '@/lib/books';

export default function BooksPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [books, setBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch books from the API
  useEffect(() => {
    const fetchBooks = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const response = await fetch('/api/books');
        
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

  // Filter books based on search query
  const filteredBooks = books.filter(book => {
    const matchesSearch = searchQuery === '' || 
      book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      book.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
      book.description.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesSearch;
  });

  return (
    <div className="bg-gray-50 min-h-screen py-12">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Browse Books</h1>
          <p className="text-lg text-gray-600">
            Discover and download free books from our extensive collection
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-8 max-w-3xl">
          <div className="relative">
            <input
              type="text"
              placeholder="Search books by title, author or description..."
              className="w-full px-5 py-3 pr-12 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500">
              <FiSearch size={20} />
            </div>
          </div>
        </div>

        {/* Main Content - Book Grid */}
        <div>
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <FiLoader className="animate-spin h-8 w-8 text-indigo-600" />
              <span className="ml-2 text-lg text-gray-600">Loading books...</span>
            </div>
          ) : error ? (
            <div className="bg-red-50 p-4 rounded-lg border border-red-200 text-red-700">
              <p className="font-medium">{error}</p>
              <p className="mt-1 text-sm">Please try refreshing the page or contact support if the problem persists.</p>
            </div>
          ) : (
            <BookGrid 
              books={filteredBooks}
              selectedGenres={[]} 
            />
          )}
        </div>
      </div>
    </div>
  );
} 