'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FiDownload, FiInfo } from 'react-icons/fi';
import type { Book } from '@/lib/books';

interface BookCardProps {
  book: Book;
}

const BookCard = ({ book }: BookCardProps) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      className="group bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200 transition-all duration-300 h-full flex flex-col"
      whileHover={{ 
        y: -5,
        boxShadow: '0 10px 20px rgba(0, 0, 0, 0.1)',
        borderColor: '#e5e7eb'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Cover Image Container */}
      <div className="relative aspect-[2/3] w-full overflow-hidden">
        <Image
          src={book.coverImage}
          alt={`${book.title} cover`}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover transform group-hover:scale-105 transition-transform duration-300"
          priority={false}
        />
        
        {/* Overlay on hover */}
        <motion.div 
          className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          initial={{ opacity: 0 }}
          animate={{ opacity: isHovered ? 1 : 0 }}
        >
          <div className="flex flex-col gap-3">
            <Link href={`/books/${book.id}`}>
              <button className="flex items-center gap-2 bg-white text-gray-900 px-4 py-2 rounded-full text-sm font-medium hover:bg-gray-100 transition-colors">
                <FiInfo size={16} />
                Details
              </button>
            </Link>
            <a 
              href={book.downloadLink} 
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              <FiDownload size={16} />
              Download
            </a>
          </div>
        </motion.div>
      </div>

      {/* Book Info */}
      <div className="p-4 flex flex-col flex-grow">
        <h3 className="font-semibold text-gray-900 mb-1 line-clamp-1">{book.title}</h3>
        <p className="text-sm text-gray-600 mb-2">{book.author}</p>
        
        {/* Categories */}
        <div className="flex flex-wrap gap-1 mt-auto pt-2">
          {book.categories.slice(0, 2).map((category) => (
            <span 
              key={category} 
              className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full"
            >
              {category}
            </span>
          ))}
          {book.categories.length > 2 && (
            <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full">
              +{book.categories.length - 2}
            </span>
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="px-4 py-3 bg-gray-50 text-xs text-gray-500 flex items-center justify-between">
        <span>{book.format}</span>
        <span>{book.fileSize}</span>
      </div>
    </motion.div>
  );
};

export default BookCard; 