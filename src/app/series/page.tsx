'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { FiLayers, FiBookOpen, FiLoader } from 'react-icons/fi';
import { motion } from 'framer-motion';
import Image from 'next/image';

interface Series {
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
  seriesId?: string;
  seriesPosition?: number[];
}

function SeriesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeSeries, setActiveSeries] = useState<string | null>(null);
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch series and books from the API
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Fetch series
        const seriesResponse = await fetch('/api/series');
        
        if (!seriesResponse.ok) {
          throw new Error(`Failed to fetch series: ${seriesResponse.statusText}`);
        }
        
        const seriesData = await seriesResponse.json();
        setSeriesList(seriesData);
        
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

  // Check if a series is selected from URL params
  useEffect(() => {
    const selected = searchParams?.get('id');
    if (selected && seriesList.some(series => series.id === selected)) {
      setActiveSeries(selected);
    }
  }, [searchParams, seriesList]);

  // Function to handle series click
  const handleSeriesClick = (seriesId: string) => {
    setActiveSeries(seriesId);
    router.push(`/series?id=${seriesId}`);
  };

  // Get books for the active series
  const getSeriesBooks = () => {
    if (!activeSeries) return [];
    return books
      .filter(book => book.seriesId === activeSeries)
      .sort((a, b) => {
        // Sort by series position if available
        if (a.seriesPosition?.[0] && b.seriesPosition?.[0]) {
          return a.seriesPosition[0] - b.seriesPosition[0];
        }
        return 0;
      });
  };

  // Get active series name
  const getActiveSeriesName = () => {
    if (!activeSeries) return '';
    const series = seriesList.find(s => s.id === activeSeries);
    return series ? series.name : '';
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
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Series</h1>
          <p className="text-lg text-gray-600">
            Browse our collection of book series
          </p>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center items-center py-12">
            <FiLoader className="animate-spin h-8 w-8 text-indigo-600" />
            <span className="ml-2 text-lg text-gray-600">Loading series...</span>
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
            {/* Series Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-12">
              {seriesList.map((series) => (
                <motion.button
                  key={series.id}
                  onClick={() => handleSeriesClick(series.id)}
                  className={`p-6 rounded-lg text-center transition-colors ${
                    activeSeries === series.id
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-white border border-gray-200 text-gray-800 hover:bg-indigo-50'
                  }`}
                  whileHover={{ y: -5 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <div className="flex flex-col items-center">
                    <FiLayers 
                      size={24} 
                      className={`mb-3 ${activeSeries === series.id ? 'text-white' : 'text-indigo-500'}`} 
                    />
                    <span className="font-medium">{series.name}</span>
                  </div>
                </motion.button>
              ))}
            </div>

            {/* Selected Series Books */}
            {activeSeries && (
              <div className="mt-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">
                    <span className="text-indigo-600">{getActiveSeriesName()}</span> Series
                  </h2>
                  <button 
                    onClick={() => {
                      setActiveSeries(null);
                      router.push('/series');
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
                  {getSeriesBooks().map((book) => (
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
                            <p className="text-sm text-gray-600">
                              {book.authors.map(author => author.name).join(', ')}
                            </p>
                            {book.seriesPosition && book.seriesPosition.length > 0 && (
                              <p className="text-xs text-indigo-600 mt-1">
                                Book #{book.seriesPosition[0]}
                              </p>
                            )}
                            
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

                {getSeriesBooks().length === 0 && (
                  <div className="bg-white rounded-lg shadow-sm p-8 text-center">
                    <p className="text-gray-600">No books found in this series.</p>
                  </div>
                )}
              </div>
            )}

            {/* No Series Selected */}
            {!activeSeries && (
              <div className="bg-white rounded-lg shadow-sm p-8 text-center">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Select a series</h2>
                <p className="text-gray-600">Click on a series above to view books in that collection.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function SeriesPage() {
  return (
    <Suspense fallback={
      <div className="bg-gray-50 min-h-screen py-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-10">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Series</h1>
            <p className="text-lg text-gray-600">
              Browse our collection of book series
            </p>
          </div>
          <div className="flex justify-center items-center py-12">
            <FiLoader className="animate-spin h-8 w-8 text-indigo-600" />
            <span className="ml-2 text-lg text-gray-600">Loading series...</span>
          </div>
        </div>
      </div>
    }>
      <SeriesContent />
    </Suspense>
  );
} 