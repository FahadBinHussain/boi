'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { FiGrid, FiBookOpen, FiLoader } from 'react-icons/fi';
import { motion } from 'framer-motion';
import Image from 'next/image';

interface Genre {
  id: string;
  name: string;
}

interface Author {
  id: string;
  name: string;
}

interface Book {
  id: string;
  title: string;
  imageUrl?: string;
  authors: Author[];
  genres: string[];
}

export default function GenresPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeGenre, setActiveGenre] = useState<string | null>(null);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch genres and books from the API
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Fetch genres
        const genresResponse = await fetch('/api/genres');
        
        if (!genresResponse.ok) {
          throw new Error(`Failed to fetch genres: ${genresResponse.statusText}`);
        }
        
        const genresData = await genresResponse.json();
        setGenres(genresData);
        
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

  // Check if a genre is selected from URL params
  useEffect(() => {
    const selected = searchParams?.get('id');
    if (selected && genres.some(genre => genre.id === selected)) {
      setActiveGenre(selected);
    }
  }, [searchParams, genres]);

  // Function to handle genre click
  const handleGenreClick = (genreId: string) => {
    setActiveGenre(genreId);
    router.push(`/genres?id=${genreId}`);
  };

  // Get books for the active genre
  const getGenreBooks = () => {
    if (!activeGenre) return [];
    
    const activeGenreName = genres.find(g => g.id === activeGenre)?.name || '';
    
    return books.filter(book => 
      book.genres.includes(activeGenreName)
    );
  };

  // Get active genre name
  const getActiveGenreName = () => {
    if (!activeGenre) return '';
    const genre = genres.find(g => g.id === activeGenre);
    return genre ? genre.name : '';
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
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Genres</h1>
          <p className="text-lg text-gray-600">
            Browse our extensive collection of books by genre
          </p>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center items-center py-12">
            <FiLoader className="animate-spin h-8 w-8 text-indigo-600" />
            <span className="ml-2 text-lg text-gray-600">Loading genres...</span>
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
            {/* Genres Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-12">
              {genres.map((genre) => (
                <motion.button
                  key={genre.id}
                  onClick={() => handleGenreClick(genre.id)}
                  className={`p-6 rounded-lg text-center transition-colors ${
                    activeGenre === genre.id
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-white border border-gray-200 text-gray-800 hover:bg-indigo-50'
                  }`}
                  whileHover={{ y: -5 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <div className="flex flex-col items-center">
                    <FiGrid 
                      size={24} 
                      className={`mb-3 ${activeGenre === genre.id ? 'text-white' : 'text-indigo-500'}`} 
                    />
                    <span className="font-medium">{genre.name}</span>
                  </div>
                </motion.button>
              ))}
            </div>

            {/* Selected Genre Books */}
            {activeGenre && (
              <div className="mt-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">
                    <span className="text-indigo-600">{getActiveGenreName()}</span> Books
                  </h2>
                  <button 
                    onClick={() => {
                      setActiveGenre(null);
                      router.push('/genres');
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
                  {getGenreBooks().map((book) => (
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

                {getGenreBooks().length === 0 && (
                  <div className="bg-white rounded-lg shadow-sm p-8 text-center">
                    <p className="text-gray-600">No books found in this genre.</p>
                  </div>
                )}
              </div>
            )}

            {/* No Genre Selected */}
            {!activeGenre && (
              <div className="bg-white rounded-lg shadow-sm p-8 text-center">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Select a genre</h2>
                <p className="text-gray-600">Click on a genre above to view related books.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
} 