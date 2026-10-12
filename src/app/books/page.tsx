'use client';

import { useState, useEffect } from 'react';
import BookGrid from '@/components/ui/BookGrid';
import { FiSearch, FiLoader, FiAlertCircle } from 'react-icons/fi';
import MotionIcon from '@/components/ui/MotionIcon';
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
    <div className="bg-base-100 text-base-content min-h-screen py-12 transition-colors">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-10">
          <h1 className="text-3xl font-extrabold text-base-content mb-3">Browse Books</h1>
          <p className="text-base text-base-content/70">
            Discover and download free books from our extensive collection
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-8 max-w-2xl">
          <div className="relative">
            <input
              type="text"
              placeholder="Search books by title, author or description..."
              className="input input-bordered w-full pr-12 bg-base-100 text-base-content"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-base-content/50">
              <MotionIcon animation="spin">
                <FiSearch size={18} />
              </MotionIcon>
            </div>
          </div>
        </div>

        {/* Main Content - Book Grid */}
        <div>
          {isLoading ? (
            <div className="flex justify-center items-center h-64 text-base-content">
              <MotionIcon animation="spin" trigger="always">
                <FiLoader className="h-8 w-8 text-primary" />
              </MotionIcon>
              <span className="ml-3 text-base font-medium text-base-content/70">Loading books...</span>
            </div>
          ) : error ? (
            <div className="alert alert-error max-w-xl shadow-lg">
              <MotionIcon animation="wiggle" trigger="always">
                <FiAlertCircle className="h-6 w-6" />
              </MotionIcon>
              <div>
                <h3 className="font-bold">Error</h3>
                <div className="text-sm">{error}</div>
              </div>
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