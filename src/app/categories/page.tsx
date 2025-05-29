'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { categories } from '@/lib/books';
import Link from 'next/link';
import { FiGrid, FiBookOpen, FiLoader } from 'react-icons/fi';
import { motion } from 'framer-motion';
import Image from 'next/image';
import type { Book } from '@/lib/books';

export default function CategoriesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
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

  // Check if a category is selected from URL params
  useEffect(() => {
    const selected = searchParams.get('selected');
    if (selected && categories.includes(selected)) {
      setActiveCategory(selected);
    }
  }, [searchParams]);

  // Function to handle category click
  const handleCategoryClick = (category: string) => {
    setActiveCategory(category);
    router.push(`/categories?selected=${category}`);
  };

  // Get books for the active category
  const getCategoryBooks = () => {
    if (!activeCategory) return [];
    return books.filter(book => 
      book.categories.includes(activeCategory)
    );
  };

  // Animation variants
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="bg-gray-50 min-h-screen py-12">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Categories</h1>
          <p className="text-lg text-gray-600">
            Browse our extensive collection of books by category
          </p>
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-12">
          {categories.map((category) => (
            <motion.button
              key={category}
              onClick={() => handleCategoryClick(category)}
              className={`p-6 rounded-lg text-center transition-colors ${
                activeCategory === category
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-white border border-gray-200 text-gray-800 hover:bg-indigo-50'
              }`}
              whileHover={{ y: -5 }}
              whileTap={{ scale: 0.95 }}
            >
              <div className="flex flex-col items-center">
                <FiGrid 
                  size={24} 
                  className={`mb-3 ${activeCategory === category ? 'text-white' : 'text-indigo-500'}`} 
                />
                <span className="font-medium">{category}</span>
              </div>
            </motion.button>
          ))}
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center items-center py-12">
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

        {/* Selected Category Books */}
        {!isLoading && !error && activeCategory && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                <span className="text-indigo-600">{activeCategory}</span> Books
              </h2>
              <button 
                onClick={() => {
                  setActiveCategory(null);
                  router.push('/categories');
                }}
                className="text-sm text-gray-600 hover:text-indigo-600"
              >
                Clear selection
              </button>
            </div>

            {/* Books Grid */}
            <motion.div 
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
              variants={container}
              initial="hidden"
              animate="show"
            >
              {getCategoryBooks().map((book) => (
                <motion.div key={book.id} variants={item}>
                  <Link href={`/books/${book.id}`}>
                    <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200 transition-all hover:shadow-md h-full flex flex-col">
                      {/* Cover Image with Aspect Ratio */}
                      <div className="relative w-full pt-[140%]">
                        <div className="absolute inset-0">
                          <Image
                            src={book.coverImage}
                            alt={`${book.title} cover`}
                            fill
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                            className=""
                            style={{ 
                              width: '100%',
                              height: '100%',
                              objectFit: 'fill',
                              objectPosition: 'center'
                            }}
                          />
                        </div>
                      </div>
                      
                      {/* Book Info */}
                      <div className="p-4 flex flex-col flex-grow">
                        <h3 className="font-semibold text-gray-900 mb-1 line-clamp-1">{book.title}</h3>
                        <p className="text-sm text-gray-600 mb-auto">{book.author}</p>
                        
                        <div className="mt-4 flex items-center gap-2 text-indigo-600 text-sm font-medium">
                          <FiBookOpen size={16} />
                          <span>View Details</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </motion.div>

            {getCategoryBooks().length === 0 && (
              <div className="bg-white rounded-lg shadow-sm p-8 text-center">
                <p className="text-gray-600">No books found in this category.</p>
              </div>
            )}
          </div>
        )}

        {/* No Category Selected */}
        {!isLoading && !error && !activeCategory && (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Select a category</h2>
            <p className="text-gray-600">Click on a category above to view related books.</p>
          </div>
        )}
      </div>
    </div>
  );
} 