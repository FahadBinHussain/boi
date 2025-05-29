'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { FiDownload, FiArrowLeft, FiCalendar, FiFileText, FiTag } from 'react-icons/fi';
import { motion } from 'framer-motion';
import type { Book } from '@/lib/books';

export default function BookDetailPage() {
  const { id } = useParams();
  const [book, setBook] = useState<Book | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchBookDetails = async () => {
      setIsLoading(true);
      try {
        // Fetch book details from the API using the book ID
        const response = await fetch(`/api/books/${id}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            setError('Book not found');
          } else {
            throw new Error(`Failed to fetch book: ${response.statusText}`);
          }
          return;
        }
        
        const bookData = await response.json();
        setBook(bookData);
      } catch (err) {
        console.error('Error fetching book details:', err);
        setError('Failed to load book details');
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      fetchBookDetails();
    }
  }, [id]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading book details...</p>
        </div>
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{error || 'Book not found'}</h2>
          <p className="text-gray-600 mb-6">The book you're looking for doesn't seem to exist.</p>
          <Link 
            href="/books" 
            className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700"
          >
            <FiArrowLeft size={16} />
            Back to all books
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen py-12">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back button */}
        <div className="mb-8">
          <Link href="/books" className="inline-flex items-center gap-2 text-gray-600 hover:text-indigo-600 transition-colors">
            <FiArrowLeft size={16} />
            Back to all books
          </Link>
        </div>

        {/* Book Details */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4">
            {/* Book Cover */}
            <div className="p-6 flex items-center justify-center md:border-r border-gray-100">
              <motion.div 
                className="relative w-48 h-72 overflow-hidden rounded-lg shadow-lg"
                whileHover={{ scale: 1.03 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <Image
                  src={book.coverImage}
                  alt={`${book.title} cover`}
                  fill
                  className=""
                  style={{ 
                    width: '100%',
                    height: '100%',
                    objectFit: 'fill',
                    objectPosition: 'center'
                  }}
                  sizes="(max-width: 768px) 100vw, 300px"
                  priority
                />
              </motion.div>
            </div>

            {/* Book Info */}
            <div className="p-6 md:p-8 md:col-span-2 lg:col-span-3">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{book.title}</h1>
              <p className="text-xl text-gray-600 mb-4">by {book.author}</p>

              <div className="mt-6 mb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">About the Book</h2>
                <p className="text-gray-700 leading-relaxed">{book.description}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {/* Publication Date */}
                <div className="flex items-start gap-3">
                  <div className="text-indigo-500">
                    <FiCalendar size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Publication Date</h3>
                    <p className="text-gray-900">{book.publicationDate}</p>
                  </div>
                </div>

                {/* File Format */}
                <div className="flex items-start gap-3">
                  <div className="text-indigo-500">
                    <FiFileText size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Format</h3>
                    <p className="text-gray-900">{book.format}</p>
                  </div>
                </div>

                {/* File Size */}
                <div className="flex items-start gap-3">
                  <div className="text-indigo-500">
                    <FiDownload size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">File Size</h3>
                    <p className="text-gray-900">{book.fileSize}</p>
                  </div>
                </div>
              </div>

              {/* Categories */}
              <div className="flex items-start gap-3 mb-8">
                <div className="text-indigo-500 mt-1">
                  <FiTag size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Categories</h3>
                  <div className="flex flex-wrap gap-2">
                    {book.categories.map(category => (
                      <Link 
                        key={category} 
                        href={`/categories?selected=${category}`}
                        className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm hover:bg-indigo-100 transition-colors"
                      >
                        {category}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>

              {/* Download Button */}
              <div className="mt-8">
                <a 
                  href={book.downloadLink}
                  className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  <FiDownload size={18} />
                  Download Book
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 