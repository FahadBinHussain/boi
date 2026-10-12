'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { FiUser, FiBookOpen, FiLoader, FiAlertCircle } from 'react-icons/fi';
import MotionIcon from '@/components/ui/MotionIcon';
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
  publicationDate?: string;
}

function AuthorsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeAuthor, setActiveAuthor] = useState<string | null>(null);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortOption, setSortOption] = useState<'name' | 'date'>('name');

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
    if (activeAuthor === authorId) {
      setActiveAuthor(null);
      router.push('/authors');
    } else {
      setActiveAuthor(authorId);
      router.push(`/authors?id=${authorId}`);
    }
  };

  // Filter books by active author and sort
  const getAuthorBooks = () => {
    if (!activeAuthor) return [];
    
    const filtered = books.filter(book => 
      book.authors.some(a => a.id === activeAuthor)
    );
    
    // Sort books based on selected option
    return filtered.sort((a, b) => {
      if (sortOption === 'name') {
        return a.title.localeCompare(b.title);
      } else {
        // Sort by publication date (newest first)
        const dateA = a.publicationDate ? new Date(a.publicationDate).getTime() : 0;
        const dateB = b.publicationDate ? new Date(b.publicationDate).getTime() : 0;
        return dateB - dateA;
      }
    });
  };

  // Get active author name
  const getActiveAuthorName = () => {
    return authors.find(a => a.id === activeAuthor)?.name || '';
  };

  // Animations
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
    <div className="bg-base-100 text-base-content min-h-screen py-12 transition-colors">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-10">
          <h1 className="text-3xl font-extrabold text-base-content mb-3">Authors</h1>
          <p className="text-base text-base-content/70">
            Browse our collection of books by author
          </p>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center items-center py-16 text-base-content">
            <MotionIcon animation="spin" trigger="always">
              <FiLoader className="h-8 w-8 text-primary" />
            </MotionIcon>
            <span className="ml-3 text-base font-medium text-base-content/70">Loading authors...</span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="alert alert-error max-w-xl shadow-lg my-6">
            <MotionIcon animation="wiggle" trigger="always">
              <FiAlertCircle className="h-6 w-6" />
            </MotionIcon>
            <div>
              <h3 className="font-bold">Error</h3>
              <div className="text-sm">{error}</div>
            </div>
          </div>
        )}

        {!isLoading && !error && (
          <>
            {/* Authors Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-12">
              {authors.map((author) => {
                const isActive = activeAuthor === author.id;
                return (
                  <motion.button
                    key={author.id}
                    onClick={() => handleAuthorClick(author.id)}
                    className={`p-5 rounded-2xl text-center transition-all flex flex-col items-center justify-center gap-2 border ${
                      isActive
                        ? 'btn-primary shadow-lg border-primary'
                        : 'bg-base-200/60 border-base-content/10 text-base-content hover:bg-base-300 hover:border-base-content/20'
                    }`}
                    whileHover={{ y: -4 }}
                    whileTap={{ scale: 0.96 }}
                  >
                    <MotionIcon animation="bounce">
                      <FiUser 
                        size={22} 
                        className={isActive ? 'text-primary-content' : 'text-primary'} 
                      />
                    </MotionIcon>
                    <span className="font-medium text-sm line-clamp-1">{author.name}</span>
                  </motion.button>
                );
              })}
            </div>

            {/* Selected Author Books */}
            {activeAuthor && (
              <div className="mt-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-3 border-b border-base-content/10">
                  <h2 className="text-2xl font-bold text-base-content">
                    Books by <span className="text-primary">{getActiveAuthorName()}</span>
                  </h2>
                  <div className="flex items-center gap-3">
                    <label htmlFor="sort" className="text-xs font-semibold text-base-content/70 uppercase">Sort by:</label>
                    <select
                      id="sort"
                      value={sortOption}
                      onChange={e => setSortOption(e.target.value as 'name' | 'date')}
                      className="select select-bordered select-sm bg-base-100 text-base-content"
                    >
                      <option value="name">Name (A-Z)</option>
                      <option value="date">Publication Date (Newest)</option>
                    </select>
                    <button 
                      onClick={() => {
                        setActiveAuthor(null);
                        router.push('/authors');
                      }}
                      className="btn btn-ghost btn-sm text-primary"
                    >
                      Clear selection
                    </button>
                  </div>
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
                        <div className="card bg-base-100 border border-base-200 shadow-sm hover:shadow-xl overflow-hidden rounded-2xl transition-all h-full flex flex-col group">
                          {/* Cover Image */}
                          <div className="relative w-full pt-[140%] bg-base-200">
                            <div className="absolute inset-0">
                              {book.imageUrl ? (
                                <Image
                                  src={book.imageUrl}
                                  alt={`${book.title} cover`}
                                  fill
                                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-base-300">
                                  <MotionIcon animation="float">
                                    <FiBookOpen size={48} className="text-base-content/30" />
                                  </MotionIcon>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Book Info */}
                          <div className="card-body p-4 flex flex-col flex-grow">
                            <h3 className="card-title text-base font-bold text-base-content mb-1 line-clamp-1 group-hover:text-primary transition-colors">
                              {book.title}
                            </h3>
                            <p className="text-xs text-base-content/70 mb-auto line-clamp-1">
                              {book.authors.map(author => author.name).join(', ')}
                            </p>
                            
                            <div className="mt-4 flex items-center gap-1.5 text-primary text-xs font-semibold">
                              <MotionIcon animation="float" trigger="hover">
                                <FiBookOpen size={14} />
                              </MotionIcon>
                              <span>View Details</span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </motion.div>

                {getAuthorBooks().length === 0 && (
                  <div className="card bg-base-200 border border-base-content/10 p-12 text-center rounded-2xl">
                    <p className="text-base-content/60">No books found by this author.</p>
                  </div>
                )}
              </div>
            )}

            {/* No Author Selected */}
            {!activeAuthor && (
              <div className="card bg-base-200/50 border border-base-content/10 p-12 text-center rounded-2xl">
                <h2 className="text-xl font-bold text-base-content mb-2">Select an author</h2>
                <p className="text-base-content/60">Click on an author above to view their books.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function AuthorsPage() {
  return (
    <Suspense fallback={
      <div className="bg-base-100 text-base-content min-h-screen py-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-10">
            <h1 className="text-3xl font-extrabold text-base-content mb-3">Authors</h1>
            <p className="text-base text-base-content/70">
              Browse our collection of books by author
            </p>
          </div>
          <div className="flex justify-center items-center py-16">
            <MotionIcon animation="spin" trigger="always">
              <FiLoader className="h-8 w-8 text-primary" />
            </MotionIcon>
            <span className="ml-3 text-base text-base-content/70">Loading authors...</span>
          </div>
        </div>
      </div>
    }>
      <AuthorsContent />
    </Suspense>
  );
}