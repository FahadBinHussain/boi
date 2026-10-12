'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { FiDownload, FiArrowLeft, FiCalendar, FiFileText, FiTag, FiBook, FiUsers, FiLayers, FiStar, FiGlobe, FiHash, FiExternalLink, FiLoader } from 'react-icons/fi';
import { FaGoodreads, FaWikipediaW, FaAmazon } from 'react-icons/fa';
import { SiWikipedia } from 'react-icons/si';
import MotionIcon from '@/components/ui/MotionIcon';
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
      <div className="min-h-screen flex items-center justify-center bg-base-100 text-base-content">
        <div className="text-center">
          <MotionIcon animation="spin" trigger="always" className="inline-block mb-4">
            <FiLoader className="w-12 h-12 text-primary" />
          </MotionIcon>
          <p className="text-base-content/70 font-medium">Loading book details...</p>
        </div>
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-100 text-base-content px-4">
        <div className="text-center card bg-base-200 border border-base-content/10 p-8 max-w-md shadow-xl rounded-3xl">
          <h2 className="text-2xl font-bold text-base-content mb-2">{error || 'Book not found'}</h2>
          <p className="text-base-content/70 mb-6">The book you're looking for doesn't seem to exist.</p>
          <Link 
            href="/books" 
            className="btn btn-primary gap-2"
          >
            <MotionIcon animation="bounce">
              <FiArrowLeft size={16} />
            </MotionIcon>
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
    <div className="min-h-screen bg-base-100 text-base-content py-8 transition-colors">
      <div className="max-w-6xl mx-auto px-4">
        <Link 
          href="/books" 
          className="btn btn-ghost btn-sm gap-2 text-primary mb-6"
        >
          <MotionIcon animation="bounce">
            <FiArrowLeft size={16} />
          </MotionIcon>
          Back to all books
        </Link>
        
        <div className="card bg-base-200/60 border border-base-content/10 shadow-xl rounded-3xl overflow-hidden">
          <div className="md:flex">
            {/* Book Cover */}
            <div className="md:w-1/3 bg-base-300/60 flex items-center justify-center p-8">
              <div className="relative w-full max-w-xs aspect-[2/3] shadow-2xl rounded-2xl overflow-hidden">
                {coverImage ? (
                  <Image
                    src={coverImage}
                    alt={book.title}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-base-300 rounded flex items-center justify-center">
                    <MotionIcon animation="float">
                      <FiBook size={64} className="text-base-content/30" />
                    </MotionIcon>
                  </div>
                )}
              </div>
            </div>
            
            {/* Book Details */}
            <div className="md:w-2/3 p-6 md:p-10 card-body">
              <h1 className="text-3xl font-extrabold text-base-content mb-2">{book.title}</h1>
              
              <div className="mb-4">
                {authors.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-base-content/70">By</span>
                    {authors.map((author, index) => (
                      <span key={author.id}>
                        <Link 
                          href={`/authors/${author.id}`}
                          className="text-primary font-medium hover:underline"
                        >
                          {author.name}
                        </Link>
                        {index < authors.length - 1 && <span className="text-base-content/60">,</span>}
                      </span>
                    ))}
                  </div>
                ) : book.author ? (
                  <div className="text-base-content/70">By {book.author}</div>
                ) : null}
              </div>
              
              {/* Description */}
              <div className="mb-6">
                <h2 className="text-lg font-bold text-base-content mb-2">Description</h2>
                <p className="text-base-content/80 leading-relaxed">{description}</p>
              </div>
              
              {/* Additional Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Series information if available */}
                {book.seriesName && (
                  <div className="flex items-start gap-2">
                    <MotionIcon animation="float">
                      <FiBook className="text-primary mt-1" />
                    </MotionIcon>
                    <div>
                      <h3 className="text-xs font-semibold text-base-content/60 uppercase">Series</h3>
                      <p className="text-base-content font-medium">
                        <Link 
                          href={`/series/${book.seriesId || ''}`}
                          className="text-primary hover:underline"
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
                    <MotionIcon animation="wiggle">
                      <FiHash className="text-primary mt-1" />
                    </MotionIcon>
                    <div>
                      <h3 className="text-xs font-semibold text-base-content/60 uppercase">Position in Series</h3>
                      <p className="text-base-content font-medium">{book.seriesPosition}</p>
                    </div>
                  </div>
                )}
                
                {/* Publication Date */}
                {(book.publicationDate) && (
                  <div className="flex items-start gap-2">
                    <MotionIcon animation="bounce">
                      <FiCalendar className="text-primary mt-1" />
                    </MotionIcon>
                    <div>
                      <h3 className="text-xs font-semibold text-base-content/60 uppercase">Publication Date</h3>
                      <p className="text-base-content font-medium">{book.publicationDate}</p>
                    </div>
                  </div>
                )}
                
                {/* Publisher */}
                {book.publisher && (
                  <div className="flex items-start gap-2">
                    <MotionIcon animation="float">
                      <FiFileText className="text-primary mt-1" />
                    </MotionIcon>
                    <div>
                      <h3 className="text-xs font-semibold text-base-content/60 uppercase">Publisher</h3>
                      <p className="text-base-content font-medium">{book.publisher}</p>
                    </div>
                  </div>
                )}
                
                {/* Language */}
                {book.language && (
                  <div className="flex items-start gap-2">
                    <MotionIcon animation="spin">
                      <FiGlobe className="text-primary mt-1" />
                    </MotionIcon>
                    <div>
                      <h3 className="text-xs font-semibold text-base-content/60 uppercase">Language</h3>
                      <p className="text-base-content font-medium">{book.language}</p>
                    </div>
                  </div>
                )}
                
                {/* Number of Pages */}
                {book.numberOfPages && (
                  <div className="flex items-start gap-2">
                    <MotionIcon animation="bounce">
                      <FiLayers className="text-primary mt-1" />
                    </MotionIcon>
                    <div>
                      <h3 className="text-xs font-semibold text-base-content/60 uppercase">Pages</h3>
                      <p className="text-base-content font-medium">{book.numberOfPages}</p>
                    </div>
                  </div>
                )}
                
                {/* Average Rating */}
                {typeof book.averageRating === 'number' && book.averageRating > 0 && (
                  <div className="flex items-start gap-2">
                    <MotionIcon animation="pulse">
                      <FiStar className="text-warning mt-1" />
                    </MotionIcon>
                    <div>
                      <h3 className="text-xs font-semibold text-base-content/60 uppercase">Rating</h3>
                      <div className="flex items-center">
                        <div className="flex text-warning mr-2">
                          {[...Array(5)].map((_, i) => (
                            <span key={i}>
                              <MotionIcon animation="pulse">
                                {i < Math.floor(book.averageRating || 0) ? (
                                  <FiStar className="fill-current" />
                                ) : i < Math.ceil(book.averageRating || 0) && (book.averageRating || 0) % 1 > 0 ? (
                                  <FiStar className="fill-current opacity-60" />
                                ) : (
                                  <FiStar className="stroke-current fill-transparent" />
                                )}
                              </MotionIcon>
                            </span>
                          ))}
                        </div>
                        <span className="text-base-content font-medium">{(book.averageRating || 0).toFixed(1)} / 5</span>
                        {typeof book.ratings === 'number' && book.ratings > 0 && (
                          <span className="text-base-content/60 ml-1 text-xs">({book.ratings} ratings)</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Format and File Size (legacy fields) */}
                {book.format && (
                  <div className="flex items-start gap-2">
                    <MotionIcon animation="float">
                      <FiFileText className="text-primary mt-1" />
                    </MotionIcon>
                    <div>
                      <h3 className="text-xs font-semibold text-base-content/60 uppercase">Format</h3>
                      <p className="text-base-content font-medium">{book.format}</p>
                    </div>
                  </div>
                )}
                
                {book.fileSize && (
                  <div className="flex items-start gap-2">
                    <MotionIcon animation="float">
                      <FiFileText className="text-primary mt-1" />
                    </MotionIcon>
                    <div>
                      <h3 className="text-xs font-semibold text-base-content/60 uppercase">File Size</h3>
                      <p className="text-base-content font-medium">{book.fileSize}</p>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Characters */}
              {Array.isArray(book.characters) && book.characters.length > 0 && (
                <div className="mb-6">
                  <h2 className="text-sm font-bold text-base-content uppercase tracking-wider mb-2">Characters</h2>
                  <div className="flex flex-wrap gap-2">
                    {book.characters.map((character, index) => (
                      <span 
                        key={index}
                        className="badge badge-outline border-base-content/20 bg-base-100 text-base-content py-2 px-3 text-xs"
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
                  <h2 className="text-sm font-bold text-base-content uppercase tracking-wider mb-2">Genres</h2>
                  <div className="flex flex-wrap gap-2">
                    {genres.map((genre, index) => (
                      <span 
                        key={index}
                        className="badge badge-primary py-2 px-3 text-xs"
                      >
                        {genre}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Download Button */}
              <div className="flex flex-wrap gap-3 mt-4">
                <a
                  href={filesVcDownloadLink}
                  className="btn btn-primary gap-2 shadow-lg"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MotionIcon animation="bounce">
                    <FiDownload size={18} />
                  </MotionIcon>
                  Download Book
                </a>
                
                {book.scraperUrl && (() => {
                  const sourceInfo = getSourceInfo(book.scraperUrl);
                  const SourceIcon = sourceInfo.icon;
                  
                  return (
                    <a
                      href={book.scraperUrl}
                      className="btn btn-outline gap-2 shadow"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MotionIcon animation="wiggle">
                        <SourceIcon size={18} />
                      </MotionIcon>
                      <span>{sourceInfo.name}</span>
                    </a>
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