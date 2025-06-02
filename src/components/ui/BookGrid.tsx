'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import BookCard from './BookCard';
import { FiLoader } from 'react-icons/fi';
import type { Book } from '@/lib/books';

interface BookGridProps {
  books: Book[];
  selectedGenres: string[];
  isLoading?: boolean;
  error?: string | null;
  compact?: boolean;
}

const BookGrid = ({ books, selectedGenres, isLoading = false, error = null, compact = false }: BookGridProps) => {
  const [filteredBooks, setFilteredBooks] = useState<Book[]>(books);
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Filter books when selected genres change
  useEffect(() => {
    if (selectedGenres.length === 0) {
      setFilteredBooks(books);
    } else {
      const filtered = books.filter(book => 
        book.genres.some(genre => selectedGenres.includes(genre))
      );
      setFilteredBooks(filtered);
    }
  }, [books, selectedGenres]);

  // Animation for container
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  // Animation for items
  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  if (!mounted) return null;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <FiLoader className="w-10 h-10 text-indigo-500 dark:text-indigo-400 animate-spin mb-4" />
        <p className="text-gray-600 dark:text-gray-400">Loading books...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg max-w-md text-center">
          <p className="font-medium mb-2">Error</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (filteredBooks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 p-6 rounded-lg max-w-md text-center">
          <p className="font-medium mb-2">No books found</p>
          <p className="text-sm">Try adjusting your search or filters.</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      className={`grid gap-6 xl:gap-8 ${
        compact 
          ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'
          : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
      }`}
      variants={container}
      initial="hidden"
      animate="show"
    >
      {filteredBooks.map((book) => (
        <motion.div key={book.id} variants={item}>
          <BookCard book={book} compact={compact} />
        </motion.div>
      ))}
    </motion.div>
  );
};

export default BookGrid; 