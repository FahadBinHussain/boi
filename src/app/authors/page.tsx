'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { FiUser, FiBookOpen, FiLoader } from 'react-icons/fi';
import { motion } from 'framer-motion';
import Image from 'next/image';

interface Author {
  id: string;
  name: string;
}

interface Book {
  id: string;
  title: string;
  imageUrl?: string;
  authors: Author[];
}

export default function AuthorsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeAuthor, setActiveAuthor] = useState<string | null>(null);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch authors and books from the API
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Fetch authors
        const authorsResponse = await fetch('/api/authors');
        
        if (!authorsResponse.ok) {
          throw new Error(`Failed to fetch authors: ${authorsResponse.statusText}`);
        }
        
        const authorsData = await authorsResponse.json();
        setAuthors(authorsData);
        
        // Fetch books
        const booksResponse = await fetch('/api/books');
        
        if (!booksResponse.ok) {
          throw new Error(`Failed to fetch books: ${booksResponse.statusText}`);
        }
        
        const booksData = await booksResponse.json();
        setBooks(booksData);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load data. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, []);

  // Check if an author is selected from URL params
  useEffect(() => {
    const selected = searchParams?.get('id');
    if (selected && authors.some(author => author.id === selected)) {
      setActiveAuthor(selected);
    }
  }, [searchParams, authors]);

  // Function to handle author click
  const handleAuthorClick = (authorId: string) => {
    setActiveAuthor(authorId);
    router.push(`/authors?id=${authorId}`);
  };

  // Get books for the active author
  const getAuthorBooks = () => {
    if (!activeAuthor) return [];
    return books.filter(book => 
      book.authors.some(author => author.id === activeAuthor)
    );
  };

  // Get active author name
  const getActiveAuthorName = () => {
    if (!activeAuthor) return '';
    const author = authors.find(author => author.id === activeAuthor);
    return author ? author.name : '';
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
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Authors</h1>
          <p className="text-lg text-gray-600">
            Browse our collection of books by author
          </p>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center items-center py-12">
            <FiLoader className="animate-spin h-8 w-8 text-indigo-600" />
            <span className="ml-2 text-lg text-gray-600">Loading authors...</span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 p-4 rounded-lg border border-red-200 text-red-700">
            <p className="font-medium">{error}</p>
            <p className="mt-1 text-sm">Please try refreshing the page or contact support if the problem persists.</p>
          </div>
        )}

        {!isLoading && !error && (
          <>
            {/* Authors Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-12">
              {authors.map((author) => (
                <motion.button
                  key={author.id}
                  onClick={() => handleAuthorClick(author.id)}
                  className={`p-6 rounded-lg text-center transition-colors ${
                    activeAuthor === author.id
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-white border border-gray-200 text-gray-800 hover:bg-indigo-50'
                  }`}
                  whileHover={{ y: -5 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <div className="flex flex-col items-center">
                    <FiUser 
                      size={24} 
                      className={`mb-3 ${activeAuthor === author.id ? 'text-white' : 'text-indigo-500'}`} 
                    />
                    <span className="font-medium">{author.name}</span>
                  </div>
                </motion.button>
              ))}
            </div>

            {/* Selected Author Books */}
            {activeAuthor && (
              <div className="mt-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">
                    Books by <span className="text-indigo-600">{getActiveAuthorName()}</span>
                  </h2>
                  <button 
                    onClick={() => {
                      setActiveAuthor(null);
                      router.push('/authors');
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
                  {getAuthorBooks().map((book) => (
                    <motion.div key={book.id} variants={item}>
                      <Link href={`/books/${book.id}`}>
                        <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200 transition-all hover:shadow-md h-full flex flex-col">
                          {/* Cover Image with Aspect Ratio */}
                          <div className="relative w-full pt-[140%]">
                            <div className="absolute inset-0">
                              {book.imageUrl ? (
                                <Image
                                  src={book.imageUrl}
                                  alt={`${book.title} cover`}
                                  fill
                                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                                  className="object-cover"
                                />
                              ) : (
                                <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                                  <FiBookOpen size={48} className="text-gray-400" />
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Book Info */}
                          <div className="p-4 flex flex-col flex-grow">
                            <h3 className="font-semibold text-gray-900 mb-1 line-clamp-1">{book.title}</h3>
                            <p className="text-sm text-gray-600 mb-auto">
                              {book.authors.map(author => author.name).join(', ')}
                            </p>
                            
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

                {getAuthorBooks().length === 0 && (
                  <div className="bg-white rounded-lg shadow-sm p-8 text-center">
                    <p className="text-gray-600">No books found by this author.</p>
                  </div>
                )}
              </div>
            )}

            {/* No Author Selected */}
            {!activeAuthor && (
              <div className="bg-white rounded-lg shadow-sm p-8 text-center">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Select an author</h2>
                <p className="text-gray-600">Click on an author above to view their books.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
} 