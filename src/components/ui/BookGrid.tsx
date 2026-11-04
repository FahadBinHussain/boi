'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import BookCard from './BookCard';
import { FiLoader, FiInbox, FiAlertCircle } from 'react-icons/fi';
import MotionIcon from './MotionIcon';
import type { Book } from '@/lib/books';
import { useEntranceAnimation } from '@/hooks/useEntranceAnimation';

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

  const controls = useEntranceAnimation('hidden', 'show');

  if (!mounted) return null;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-base-content">
        <MotionIcon animation="spin" trigger="always" className="mb-4">
          <FiLoader className="w-10 h-10 text-primary" />
        </MotionIcon>
        <p className="text-base-content/75 font-medium">Loading books…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="alert alert-error max-w-md shadow-lg">
          <MotionIcon animation="wiggle" trigger="always">
            <FiAlertCircle className="w-6 h-6" />
          </MotionIcon>
          <div>
            <h3 className="font-bold">{error}</h3>
            <div className="text-xs">Check your connection and try again.</div>
          </div>
        </div>
      </div>
    );
  }

  if (filteredBooks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="card bg-base-200 border border-base-content/10 p-8 max-w-md text-center rounded-2xl shadow-sm">
          <div className="flex justify-center mb-3">
            <MotionIcon animation="float" trigger="always">
              <FiInbox className="w-10 h-10 text-base-content/75" />
            </MotionIcon>
          </div>
          <h3 className="font-bold text-base-content text-lg mb-1">
            {selectedGenres.length > 0 ? 'No books in these genres' : 'No books match your search'}
          </h3>
          <p className="text-sm text-base-content/75">
            {selectedGenres.length > 0
              ? 'Clear the filters to see the whole catalog.'
              : 'Try a different title or author.'}
          </p>
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
      initial={false}
      animate={controls}
    >
      {filteredBooks.map((book) => (
        <motion.div key={book.id} variants={item} className="min-w-0">
          <BookCard book={book} compact={compact} />
        </motion.div>
      ))}
    </motion.div>
  );
};

export default BookGrid;