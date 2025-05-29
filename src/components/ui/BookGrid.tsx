'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import BookCard from './BookCard';
import type { Book } from '@/lib/books';

interface BookGridProps {
  books: Book[];
  selectedCategories: string[];
  compact?: boolean;
}

const BookGrid = ({ books, selectedCategories, compact = false }: BookGridProps) => {
  const [filteredBooks, setFilteredBooks] = useState<Book[]>(books);

  // Filter books when selected categories change
  useEffect(() => {
    if (selectedCategories.length === 0) {
      setFilteredBooks(books);
    } else {
      const filtered = books.filter(book => 
        book.categories.some(category => selectedCategories.includes(category))
      );
      setFilteredBooks(filtered);
    }
  }, [books, selectedCategories]);

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

  if (filteredBooks.length === 0) {
    return (
      <div className="h-60 flex items-center justify-center bg-gray-50 rounded-lg border border-gray-200">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-2">No books found</h3>
          <p className="text-gray-600">
            Try selecting different categories or clearing your filters
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