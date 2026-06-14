'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { FiDownload, FiArrowLeft, FiCalendar, FiFileText, FiTag, FiBook, FiUsers, FiLayers, FiStar, FiGlobe, FiHash, FiExternalLink } from 'react-icons/fi';
import { FaGoodreads, FaWikipediaW, FaAmazon } from 'react-icons/fa';
import { SiWikipedia } from 'react-icons/si';
import { motion } from 'framer-motion';

interface Author {
  id: string;
  name: string;
}

interface Book {
  id: string;
  title: string;
  authors: Author[];
  imageUrl?: string;
  summary?: string;
  publisher?: string;
  genres: string[];
  ratings?: number;
  averageRating?: number;
  numberOfPages?: number;
  characters: string[];
  language?: string;
  pdfUrl?: string;
  seriesName?: string;
  seriesPosition?: string;
  publicationDate?: string;
  seriesId?: string;
  scraperUrl?: string;
  // Legacy fields
  author?: string;
  coverImage?: string;
  description?: string;
  categories?: string[];
  downloadLink?: string;
  fileSize?: string;
  format?: string;
}

// Helper function to determine the source type from URL
const getSourceInfo = (url: string | undefined) => {
  if (!url) return { type: 'unknown', icon: FiExternalLink, color: 'emerald' };
  
  const lowerUrl = url.toLowerCase();
  
  if (lowerUrl.includes('goodreads.com')) {
    return { 
      type: 'goodreads', 
      icon: FaGoodreads, 
      color: 'amber',
      name: 'Goodreads'
    };
  } else if (lowerUrl.includes('fandom.com') || lowerUrl.includes('wikia.com')) {
    return { 
      type: 'fandom', 
      icon: FaWikipediaW, 
      color: 'purple',
      name: 'Fandom'
    };
  } else if (lowerUrl.includes('wikipedia.org')) {
    return { 
      type: 'wikipedia', 
      icon: SiWikipedia, 
      color: 'slate',
      name: 'Wikipedia'
    };
  } else if (lowerUrl.includes('amazon.com') || lowerUrl.includes('amzn.')) {
    return { 
      type: 'amazon', 
      icon: FaAmazon, 
      color: 'orange',
      name: 'Amazon'
    };
  }
  
  return { 
    type: 'unknown', 
    icon: FiExternalLink, 
    color: 'emerald',
    name: 'Source'
  };
};

export default function BookDetailPage() {
  const params = useParams<{ id: string }>();
  const bookId = params?.id;
  const [book, setBook] = useState<Book | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchBookDetails = async () => {
      setIsLoading(true);
      try {
        // Fetch book details from the API using the book ID
        const response = await fetch(`/api/books/${bookId}`);
        
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

    if (bookId) {
      fetchBookDetails();
    }
  }, [bookId]);

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

  // Get the cover image from either imageUrl or coverImage
  const coverImage = book.imageUrl || book.coverImage || '';
  // Get the description from either summary or description
  const description = book.summary || book.description || '';
  
  // Get the download link - convert direct file URL to Files.vc download page URL
  const downloadUrl = book.pdfUrl || book.downloadLink || '#';
  const filesVcDownloadLink = downloadUrl.includes('cdn-1.files.vc') || downloadUrl.includes('cdn-2.files.vc')
    ? `https://files.vc/d/dl?hash=${downloadUrl.split('/').pop()?.split('.')[0] || ''}`
    : downloadUrl;
  
  // Get the authors
  const authors = book.authors || [];
  // Get the genres
  const genres = book.genres || book.categories || [];

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <Link 
          href="/books" 
          className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700 mb-6"
        >
          <FiArrowLeft size={16} />
          Back to all books
        </Link>
        
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="md:flex">
            {/* Book Cover */}
            <div className="md:w-1/3 bg-gray-100 flex items-center justify-center p-8">
              <div className="relative w-full max-w-xs aspect-[2/3] shadow-lg">
                {coverImage ? (
                  <Image
                    src={coverImage}
                    alt={book.title}
                    fill
                    className="object-cover rounded"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-200 rounded flex items-center justify-center">
                    <FiBook size={64} className="text-gray-400" />
                  </div>
                )}
              </div>
            </div>
            
            {/* Book Details */}
            <div className="md:w-2/3 p-6 md:p-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{book.title}</h1>
              
              <div className="mb-4">
                {authors.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-gray-600">By</span>
                    {authors.map((author, index) => (
                      <span key={author.id}>
                        <Link 
                          href={`/authors/${author.id}`}
                          className="text-indigo-600 hover:text-indigo-800"
                        >
                          {author.name}
                        </Link>
                        {index < authors.length - 1 && <span className="text-gray-600">,</span>}
                      </span>
                    ))}
                  </div>
                ) : book.author ? (
                  <div className="text-gray-600">By {book.author}</div>
                ) : null}
              </div>
              
              {/* Description */}
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">Description</h2>
                <p className="text-gray-700 leading-relaxed">{description}</p>
              </div>
              
              {/* Additional Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Series information if available */}
                {book.seriesName && (
                  <div className="flex items-start gap-2">
                    <FiBook className="text-gray-500 mt-1" />
                    <div>
                      <h3 className="text-sm font-medium text-gray-900">Series</h3>
                      <p className="text-gray-700">
                        <Link 
                          href={`/series/${book.seriesId || ''}`}
                          className="text-indigo-600 hover:text-indigo-800"
                        >
                          {book.seriesName}
                        </Link>
                      </p>
                    </div>
                  </div>
                )}
                
                {/* Series Position if available */}
                {book.seriesPosition && (
                  <div className="flex items-start gap-2">
                    <FiHash className="text-gray-500 mt-1" />
                    <div>
                      <h3 className="text-sm font-medium text-gray-900">Position in Series</h3>
                      <p className="text-gray-700">{book.seriesPosition}</p>
                    </div>
                  </div>
                )}
                
                {/* Publication Date */}
                {(book.publicationDate) && (
                  <div className="flex items-start gap-2">
                    <FiCalendar className="text-gray-500 mt-1" />
                    <div>
                      <h3 className="text-sm font-medium text-gray-900">Publication Date</h3>
                      <p className="text-gray-700">{book.publicationDate}</p>
                    </div>
                  </div>
                )}
                
                {/* Publisher */}
                {book.publisher && (
                  <div className="flex items-start gap-2">
                    <FiFileText className="text-gray-500 mt-1" />
                    <div>
                      <h3 className="text-sm font-medium text-gray-900">Publisher</h3>
                      <p className="text-gray-700">{book.publisher}</p>
                    </div>
                  </div>
                )}
                
                {/* Language */}
                {book.language && (
                  <div className="flex items-start gap-2">
                    <FiGlobe className="text-gray-500 mt-1" />
                    <div>
                      <h3 className="text-sm font-medium text-gray-900">Language</h3>
                      <p className="text-gray-700">{book.language}</p>
                    </div>
                  </div>
                )}
                
                {/* Number of Pages */}
                {book.numberOfPages && (
                  <div className="flex items-start gap-2">
                    <FiLayers className="text-gray-500 mt-1" />
                    <div>
                      <h3 className="text-sm font-medium text-gray-900">Pages</h3>
                      <p className="text-gray-700">{book.numberOfPages}</p>
                    </div>
                  </div>
                )}
                
                {/* Average Rating */}
                {typeof book.averageRating === 'number' && book.averageRating > 0 && (
                  <div className="flex items-start gap-2">
                    <FiStar className="text-gray-500 mt-1" />
                    <div>
                      <h3 className="text-sm font-medium text-gray-900">Rating</h3>
                      <div className="flex items-center">
                        <div className="flex text-yellow-400 mr-1">
                          {[...Array(5)].map((_, i) => (
                            <span key={i}>
                              {i < Math.floor(book.averageRating || 0) ? (
                                <FiStar className="fill-current" />
                              ) : i < Math.ceil(book.averageRating || 0) && (book.averageRating || 0) % 1 > 0 ? (
                                <FiStar className="fill-current opacity-60" />
                              ) : (
                                <FiStar className="stroke-current fill-transparent" />
                              )}
                            </span>
                          ))}
                        </div>
                        <span className="text-gray-700">{(book.averageRating || 0).toFixed(1)} / 5</span>
                        {typeof book.ratings === 'number' && book.ratings > 0 && (
                          <span className="text-gray-500 ml-1">({book.ratings} ratings)</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Format and File Size (legacy fields) */}
                {book.format && (
                  <div className="flex items-start gap-2">
                    <FiFileText className="text-gray-500 mt-1" />
                    <div>
                      <h3 className="text-sm font-medium text-gray-900">Format</h3>
                      <p className="text-gray-700">{book.format}</p>
                    </div>
                  </div>
                )}
                
                {book.fileSize && (
                  <div className="flex items-start gap-2">
                    <FiFileText className="text-gray-500 mt-1" />
                    <div>
                      <h3 className="text-sm font-medium text-gray-900">File Size</h3>
                      <p className="text-gray-700">{book.fileSize}</p>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Characters */}
              {Array.isArray(book.characters) && book.characters.length > 0 && (
                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-2">Characters</h2>
                  <div className="flex flex-wrap gap-2">
                    {book.characters.map((character, index) => (
                      <span 
                        key={index}
                        className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-sm"
                      >
                        {character}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Genres/Categories */}
              {genres.length > 0 && (
                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-2">Genres</h2>
                  <div className="flex flex-wrap gap-2">
                    {genres.map((genre, index) => (
                      <span 
                        key={index}
                        className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-sm"
                      >
                        {genre}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Download Button */}
              <div className="flex flex-wrap gap-3">
                <a
                  href={filesVcDownloadLink}
                  className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FiDownload size={18} />
                  Download Book
                </a>
                
                {book.scraperUrl && (() => {
                  const sourceInfo = getSourceInfo(book.scraperUrl);
                  const SourceIcon = sourceInfo.icon;
                  
                  // Define color classes based on the source type
                  const colorClasses = {
                    goodreads: "bg-amber-600 hover:bg-amber-700",
                    fandom: "bg-purple-600 hover:bg-purple-700",
                    wikipedia: "bg-slate-600 hover:bg-slate-700",
                    amazon: "bg-orange-600 hover:bg-orange-700",
                    unknown: "bg-emerald-600 hover:bg-emerald-700"
                  };
                  
                  const buttonColorClass = colorClasses[sourceInfo.type as keyof typeof colorClasses] || colorClasses.unknown;
                  
                  return (
                    <div className="relative group/tooltip">
                      <a
                        href={book.scraperUrl}
                        className={`inline-flex items-center gap-3 ${buttonColorClass} text-white px-6 py-3 rounded-lg font-medium transition-all duration-300 relative overflow-hidden group`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <span className="absolute inset-0 opacity-10 bg-[radial-gradient(circle,_white_1px,_transparent_1px)] bg-[length:8px_8px]"></span>
                        <SourceIcon size={20} className="relative z-10 transform transition-transform duration-300 group-hover:scale-110" />
                        <span className="relative z-10">{sourceInfo.name}</span>
                      </a>
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-800 text-white text-xs rounded-md opacity-0 group-hover/tooltip:opacity-100 transition-opacity duration-300 whitespace-nowrap pointer-events-none">
                        {book.scraperUrl}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 