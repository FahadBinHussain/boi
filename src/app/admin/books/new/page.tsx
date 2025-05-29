"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FiArrowLeft, FiSave, FiImage, FiCalendar, FiUsers, FiBook, FiFileText, FiCheckCircle, FiLink, FiLoader, FiDownload } from "react-icons/fi";
import gsap from "gsap";
import { useUserSettings } from "@/hooks/useUserSettings";
import { useNotification } from "@/contexts/NotificationContext";

interface Author {
  name: string;
  id?: string; // Make id optional since we're creating new authors
}

// Add these interface definitions for upload results
interface UploadResult {
  success: boolean;
  message: string;
  fileData: {
    url: string;
    name: string;
    size: number;
    [key: string]: any;
  };
}

// Add interfaces for the scraped data
interface ScrapedBookData {
  title: string;
  imageUrl?: string;
  summary?: string;
  publicationDate?: string;
  authors?: string[];
  publisher?: string;
  genres?: string[];
  ratings?: number;
  averageRating?: number;
  numberOfPages?: number;
  characters?: string[];
  language?: string;
}

// Add this component at the top of the file, before the AddNewBook function
const BookThumbnail = ({ 
  src, 
  alt, 
  onError 
}: { 
  src: string; 
  alt: string; 
  onError?: () => void;
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  
  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };
  
  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
    if (onError) onError();
  };
  
  return (
    <div className="relative h-48 w-32 overflow-hidden rounded-md border border-gray-200 bg-gray-50 flex items-center justify-center shadow-sm">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <svg className="animate-spin h-6 w-6 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      )}
      
      {hasError && (
        <div className="flex flex-col items-center justify-center text-center p-2">
          <svg className="h-8 w-8 text-gray-400 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>
          <span className="text-xs text-gray-500">Image not available</span>
        </div>
      )}
      
      <img 
        src={src} 
        alt={alt}
        className={`max-h-full max-w-full object-cover transition-opacity duration-300 ${isLoading || hasError ? 'opacity-0' : 'opacity-100'}`}
        onLoad={handleLoad}
        onError={handleError}
      />
    </div>
  );
};

export default function AddNewBook() {
  const router = useRouter();
  const { settings, isLoading: isSettingsLoading, syncStatus, lastSyncMessage } = useUserSettings();
  const { showNotification } = useNotification();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<{
    bookName?: string;
    authors?: string;
    thumbnailUrl?: string;
    publicationDate?: string;
    bookPdf?: string; // For single book PDF error
    summary?: string; // Add this for summary field errors
    metadataUrl?: string;
  }>({});

  // Form state for single book
  const [bookName, setBookName] = useState("");
  const [authors, setAuthors] = useState<Author[]>([{ id: crypto.randomUUID(), name: "" }]);
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [publicationDate, setPublicationDate] = useState("");
  const [thumbnailPreview, setThumbnailPreview] = useState("");
  const [bookPdfFile, setBookPdfFile] = useState<File | null>(null);
  const [summary, setSummary] = useState("");
  const [publisher, setPublisher] = useState("");
  const [genres, setGenres] = useState<string[]>([]);
  const [ratings, setRatings] = useState<number | undefined>(undefined);
  const [averageRating, setAverageRating] = useState<number | undefined>(undefined);
  const [numberOfPages, setNumberOfPages] = useState<number | undefined>(undefined);
  const [characters, setCharacters] = useState<string[]>([]);
  const [language, setLanguage] = useState("");
  
  // Use user's preferred date format from settings or default to year-only
  const [isYearOnly, setIsYearOnly] = useState(true);

  // Add new state variables for metadata URL functionality
  const [metadataUrl, setMetadataUrl] = useState("");
  const [isScrapingMetadata, setIsScrapingMetadata] = useState(false);
  const [scrapingError, setScrapingError] = useState<string | null>(null);
  const [metadataSuccess, setMetadataSuccess] = useState<string | null>(null);

  // Add these state variables for single book upload
  const [singleBookUploadProgress, setSingleBookUploadProgress] = useState<number | null>(null);
  const [singleBookUploadStatus, setSingleBookUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [singleBookPdfUrl, setSingleBookPdfUrl] = useState<string | null>(null);
  const [singleBookUploadError, setSingleBookUploadError] = useState<string | null>(null);

  // Load user settings when component mounts
  useEffect(() => {
    if (!isSettingsLoading && settings) {
      // Apply the user's publication date format preference
      setIsYearOnly(settings.preferYearOnlyDateFormat ?? true);
      
      // No need to show notification for initial settings load
    }
  }, [settings, isSettingsLoading]);
  
  // Monitor sync status for notifications
  useEffect(() => {
    // Only show important notifications (error states)
    if (syncStatus === 'error') {
      showNotification('error', lastSyncMessage || 'Failed to synchronize settings');
    }
  }, [syncStatus, lastSyncMessage, showNotification]);

  // Update thumbnail preview when URL changes
  useEffect(() => {
    if (thumbnailUrl && thumbnailUrl.trim() !== "") {
      setThumbnailPreview(thumbnailUrl);
    } else {
      setThumbnailPreview("");
    }
  }, [thumbnailUrl]);

  // Validate form including checking publication date based on format
  const validateForm = () => {
    const errors: {
      bookName?: string;
      authors?: string;
      thumbnailUrl?: string;
      publicationDate?: string;
      bookPdf?: string; // For single book PDF error
      summary?: string; // Add this for summary field errors
      metadataUrl?: string;
    } = {};
    
    // Validate authors
    if (authors.length === 0 || authors.some(author => !author.name.trim())) {
      errors.authors = "Please add at least one author with a name";
    }
    
      // Single book validation
      if (!bookName.trim()) {
        errors.bookName = "Book name is required";
      }
      
      if (!thumbnailUrl.trim()) {
        errors.thumbnailUrl = "Thumbnail URL is required";
      }
      
      if (!publicationDate.trim()) {
        errors.publicationDate = "Publication date is required";
      }
      
      // Only require PDF if it's not already uploaded
      if (!bookPdfFile && !singleBookPdfUrl) {
        errors.bookPdf = "Please select a PDF file for the book";
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const formData = new FormData();
      
      // Add authors
      for (const author of authors) {
        formData.append('authors', author.name);
      }
      
      // Single book data
        formData.append('bookName', bookName);
        formData.append('thumbnailUrl', thumbnailUrl);
        formData.append('publicationDate', publicationDate);
        formData.append('isYearOnly', isYearOnly.toString());
        formData.append('summary', summary);
        
        // Add publisher and other metadata if available
        if (publisher) formData.append('publisher', publisher);
        if (genres.length > 0) formData.append('genres', JSON.stringify(genres));
        if (ratings !== undefined) formData.append('ratings', ratings.toString());
        if (averageRating !== undefined) formData.append('averageRating', averageRating.toString());
        if (numberOfPages !== undefined) formData.append('numberOfPages', numberOfPages.toString());
        if (characters.length > 0) formData.append('characters', JSON.stringify(characters));
        if (language) formData.append('language', language);
        
        // For single book mode, use the already uploaded PDF URL if available
        if (singleBookPdfUrl) {
          formData.append('pdfUrl', singleBookPdfUrl);
        } 
        // Otherwise, attach the PDF file directly if we have one
        else if (bookPdfFile) {
          formData.append('pdf', bookPdfFile);
      }
      
      // Make API call to save the form data
      const response = await fetch('/api/admin/books/create', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to save: ${response.statusText}`);
      }
      
      showNotification('success', 'Book added successfully!');
      router.push('/admin/books');
    } catch (error) {
      console.error("Error submitting form:", error);
      showNotification('error', 'Failed to save book. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Function to upload PDF to Files.vc
  const uploadPdfToFilesVc = async (file: File): Promise<UploadResult | null> => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Upload failed:', errorData);
        return null;
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error uploading to Files.vc:', error);
      return null;
    }
  };

  // Helper function to detect URL type
  const detectUrlType = (url: string): 'fandom' | 'goodreads' | null => {
    try {
      const parsedUrl = new URL(url);
      const hostname = parsedUrl.hostname.toLowerCase();
      
      if (hostname.includes('fandom.com')) {
        return 'fandom';
      } else if (hostname.includes('goodreads.com')) {
        return 'goodreads';
      }
      
      return null;
    } catch (error) {
      console.error('Invalid URL:', error);
      return null;
    }
  };

  // Function to fetch metadata from the appropriate scraper
  const fetchMetadata = async (url: string): Promise<void> => {
    if (!url.trim()) {
      setScrapingError("Please enter a URL");
      return;
    }
    
    const urlType = detectUrlType(url);
    if (!urlType) {
      setScrapingError("Unsupported URL type. Currently supports: Fandom, Goodreads");
      return;
    }
    
    setIsScrapingMetadata(true);
    setScrapingError(null);
    setMetadataSuccess(null);
    
    try {
      // Call the generic scraper API endpoint
      const response = await fetch('/api/scrapers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to fetch metadata: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Populate form fields with the scraped data
      populateFormFields(data);
      
      // Set success message
      if ('title' in data) {
        setMetadataSuccess(`Book "${data.title}" data imported successfully!`);
      } else {
        setMetadataSuccess(`Book data imported successfully!`);
      }
      
      showNotification('success', 'Metadata successfully fetched and applied!');
    } catch (error) {
      console.error('Error fetching metadata:', error);
      setScrapingError(error instanceof Error ? error.message : 'Failed to fetch metadata');
      showNotification('error', 'Failed to fetch metadata. See error for details.');
    } finally {
      setIsScrapingMetadata(false);
    }
  };
  
  // Function to populate form fields with scraped data
  const populateFormFields = (data: ScrapedBookData) => {
    // Single book mode - check if it has title
    if ('title' in data) {
        if (data.title) {
          setBookName(data.title);
        }
        
        if (data.imageUrl) {
          setThumbnailUrl(data.imageUrl);
        }
        
        if (data.summary) {
          setSummary(data.summary);
        }
        
        if (data.publicationDate) {
          // Check if it's a full date or just a year
          const yearOnlyMatch = /^\d{4}$/.test(data.publicationDate);
          const fullDateMatch = /^\d{4}-\d{2}-\d{2}$/.test(data.publicationDate);
          
          if (yearOnlyMatch) {
            setPublicationDate(data.publicationDate);
            setIsYearOnly(true);
          } else if (fullDateMatch) {
            setPublicationDate(data.publicationDate);
            setIsYearOnly(false);
          }
        }
        
        // If authors are available
        if (data.authors && Array.isArray(data.authors) && data.authors.length > 0) {
        const newAuthors = data.authors.map((authorName: string) => ({ id: crypto.randomUUID(), name: authorName }));
          setAuthors(newAuthors);
        }
        
        // Populate additional fields
        if (data.publisher) {
          setPublisher(data.publisher);
        }
        
        if (data.genres && Array.isArray(data.genres)) {
          setGenres(data.genres);
        }
        
        if (data.ratings !== undefined) {
          setRatings(data.ratings);
        }
        
        if (data.averageRating !== undefined) {
          setAverageRating(data.averageRating);
        }
        
        if (data.numberOfPages !== undefined) {
          setNumberOfPages(data.numberOfPages);
        }
        
        if (data.characters && Array.isArray(data.characters)) {
          setCharacters(data.characters);
        }
        
        if (data.language) {
          setLanguage(data.language);
      }
    }
  };
  
  // Metadata URL field handler
  const handleMetadataUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMetadataUrl(e.target.value);
    setScrapingError(null);
    setMetadataSuccess(null);
  };
  
  // Handle fetch metadata button click
  const handleFetchMetadata = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    await fetchMetadata(metadataUrl);
  };

  // Add author field
  const addAuthor = () => {
    setAuthors([...authors, { id: crypto.randomUUID(), name: "" }]);
  };

  // Remove author field
  const removeAuthor = (id: string) => {
    if (authors.length > 1) {
      setAuthors(authors.filter(author => author.id !== id));
    }
  };

  // Update author field
  const updateAuthor = (id: string, name: string) => {
    setAuthors(authors.map(author => 
      author.id === id ? { ...author, name } : author
    ));
  };

  // Update handleYearToggle to just handle the format conversion but not save to settings
  const handleYearToggle = () => {
    const newIsYearOnly = !isYearOnly;
    
    if (newIsYearOnly && publicationDate) {
      // Extract year from full date
      const yearMatch = publicationDate.match(/^\d{4}/);
      const year = yearMatch ? yearMatch[0] : new Date().getFullYear().toString();
      setPublicationDate(year);
    } else if (!newIsYearOnly && publicationDate) {
      // Convert year to full date
      setPublicationDate(`${publicationDate}-01-01`);
    }
    
    // Update local state only
    setIsYearOnly(newIsYearOnly);
  };

  const handleSingleBookPdfChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files && event.target.files[0] ? event.target.files[0] : null;
    setBookPdfFile(file);
    
    // If file is selected, start upload immediately
    if (file) {
      uploadSingleBookWithProgress(file);
    } else {
      // Reset upload state if no file is selected
      setSingleBookUploadProgress(null);
      setSingleBookUploadStatus('idle');
      setSingleBookPdfUrl(null);
      setSingleBookUploadError(null);
    }
  };

  // Function to upload single book PDF with progress tracking
  const uploadSingleBookWithProgress = async (file: File) => {
    setSingleBookUploadStatus('uploading');
    setSingleBookUploadProgress(0);
    setSingleBookUploadError(null);
    
    if (!settings?.filesVcApiKey || !settings?.filesVcAccountId) {
      let errorMessage = 'Files.vc configuration incomplete: ';
      if (!settings?.filesVcApiKey) errorMessage += 'API Key missing';
      if (!settings?.filesVcApiKey && !settings?.filesVcAccountId) errorMessage += ' and ';
      if (!settings?.filesVcAccountId) errorMessage += 'Account ID missing';
      errorMessage += '. Please update your settings.';
      
      handleSingleBookUploadError(errorMessage);
      return;
    }
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData,
        // Don't set Content-Type header, let the browser set it with the boundary
      });
      
      // Check if the request was successful
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data && data.fileData && data.fileData.url) {
        setSingleBookPdfUrl(data.fileData.url);
        setSingleBookUploadStatus('success');
        setSingleBookUploadProgress(100);
      } else {
        throw new Error('Invalid response format from server');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      handleSingleBookUploadError(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  };
  
  // Helper function to handle single book upload errors
  const handleSingleBookUploadError = (errorMessage: string) => {
    setSingleBookUploadStatus('error');
    setSingleBookUploadError(errorMessage);
    showNotification('error', `Upload failed: ${errorMessage}`);
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center">
          <Link
            href="/admin/books"
            className="mr-4 inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
          >
            <FiArrowLeft className="mr-2 h-4 w-4" />
            Back to Books
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">
            Add New Book
          </h1>
        </div>
      </div>

      {/* Files.vc integration status indicator */}
      <div className="mb-4 flex items-center bg-white rounded-lg p-3 shadow-sm">
        <span className="text-sm font-medium mr-2">Files.vc:</span>
        {settings?.filesVcApiKey && settings?.filesVcAccountId ? (
          <span className="inline-flex items-center">
            <span className="h-3 w-3 rounded-full bg-green-500 mr-1" aria-hidden="true"></span>
            <span className="text-sm text-green-700">Active</span>
          </span>
        ) : (
          <span className="inline-flex items-center">
            <span className="h-3 w-3 rounded-full bg-red-500 mr-1" aria-hidden="true"></span>
            <span className="text-sm text-red-700">
              {settings?.filesVcApiKey ? "Account ID not configured" : 
               settings?.filesVcAccountId ? "API Key not configured" : "Not configured"}
            </span>
          </span>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="border-b border-gray-200 bg-gray-50 p-4 sm:p-6">
          <h2 className="text-lg font-medium text-gray-900">Book Information</h2>
          <p className="mt-1 text-sm text-gray-600">
            Enter the details of the book you want to add to the library.
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-6">
          {/* Book Name */}
            <div className="form-group">
              <label htmlFor="bookName" className="block text-sm font-medium text-gray-700 mb-2">
                <div className="flex items-center">
                  <FiBook className="mr-2 h-4 w-4 text-indigo-500" />
                  Book Name <span className="text-red-500 ml-1">*</span>
                </div>
              </label>
              <input
                type="text"
                id="bookName"
                className={`block w-full rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm
                  ${formErrors.bookName ? "border-red-300 text-red-900 placeholder-red-300 focus:outline-none focus:ring-red-500 focus:border-red-500" : "border-gray-300"}`}
                placeholder="Enter book name"
                value={bookName}
                onChange={(e) => setBookName(e.target.value)}
              />
              {formErrors.bookName && (
                <p className="mt-2 text-sm text-red-600">{formErrors.bookName}</p>
              )}
            </div>

          {/* Authors */}
          <div className="form-group">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <div className="flex items-center">
                <FiUsers className="mr-2 h-4 w-4 text-indigo-500" />
                Authors <span className="text-red-500 ml-1">*</span>
              </div>
            </label>
            <div className="space-y-3">
              {authors.map((author, index) => (
                <div key={author.id} className="flex items-center">
                  <input
                    type="text"
                    className={`block w-full rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm
                      ${formErrors.authors ? "border-red-300 text-red-900 placeholder-red-300" : "border-gray-300"}`}
                    placeholder={`Author ${index + 1}`}
                    value={author.name}
                    onChange={(e) => updateAuthor(author.id!, e.target.value)}
                  />
                  {authors.length > 1 && (
                    <button 
                      type="button"
                      onClick={() => removeAuthor(author.id!)}
                      className="ml-2 p-1.5 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      aria-label="Remove author"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addAuthor}
              className="mt-3 inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="-ml-0.5 mr-2 h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Add Author
            </button>
            {formErrors.authors && (
              <p className="mt-2 text-sm text-red-600">{formErrors.authors}</p>
            )}
          </div>

          {/* Single Book Thumbnail Input */}
          <div className="form-group">
            <label htmlFor="thumbnailUrl" className="block text-sm font-medium text-gray-700 mb-2">
              <div className="flex items-center">
                <FiImage className="mr-2 h-4 w-4 text-indigo-500" />
                Thumbnail URL <span className="text-red-500 ml-1">*</span>
              </div>
            </label>
            <div className="flex items-start space-x-4">
              <div className="flex-grow">
                <input
                  type="text"
                  id="thumbnailUrl"
                  className={`block w-full rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm
                    ${formErrors.thumbnailUrl ? "border-red-300 text-red-900 placeholder-red-300" : "border-gray-300"}`}
                  placeholder="https://example.com/image.jpg"
                  value={thumbnailUrl}
                  onChange={(e) => setThumbnailUrl(e.target.value)}
                />
                {formErrors.thumbnailUrl && (
                  <p className="mt-2 text-sm text-red-600">{formErrors.thumbnailUrl}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">Enter a URL for the book cover image</p>
              </div>
              
              {thumbnailPreview && (
                <div className="flex-shrink-0">
                  <BookThumbnail 
                    src={thumbnailPreview} 
                    alt="Thumbnail preview" 
                    onError={() => {
                      setThumbnailPreview("https://via.placeholder.com/120x160?text=Error");
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Book PDF File Input for single book */}
          <div className="form-group">
            <label htmlFor="bookPdf" className="block text-sm font-medium text-gray-700 mb-2">
              <div className="flex items-center">
                <FiFileText className="mr-2 h-4 w-4 text-indigo-500" />
                Book File (PDF) <span className="text-red-500 ml-1">*</span>
              </div>
            </label>
            <div className="mt-1 bg-gray-50 border border-gray-300 border-dashed rounded-md p-4">
              <div className="flex justify-center">
                <div className="space-y-2 text-center">
                  <svg className="mx-auto h-10 w-10 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                    <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H8m36-12h-4m4 0H20" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <div className="flex text-sm text-gray-600">
                    <label htmlFor="bookPdf" className="relative cursor-pointer rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
                      <span>Upload a PDF file</span>
                      <input
                        id="bookPdf"
                        name="bookPdf"
                        type="file"
                        accept=".pdf"
                        className="sr-only"
                        onChange={handleSingleBookPdfChange}
                        disabled={singleBookUploadStatus === 'uploading'}
                      />
                    </label>
                    <p className="pl-1">or drag and drop</p>
                  </div>
                  <p className="text-xs text-gray-500">PDF up to 100MB</p>
                </div>
              </div>
              
              {/* Selected file info */}
              {bookPdfFile && (
                <div className="mt-4 flex items-center justify-between bg-white p-3 rounded-md border border-gray-200">
                  <div className="flex items-center">
                    <svg className="h-8 w-8 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                    </svg>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-900">{bookPdfFile.name}</p>
                      <p className="text-sm text-gray-500">{(bookPdfFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBookPdfFile(null)}
                    className="text-gray-400 hover:text-gray-500"
                    disabled={singleBookUploadStatus === 'uploading'}
                  >
                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
            
            {/* Upload progress indicators */}
            {singleBookUploadStatus === 'uploading' && singleBookUploadProgress !== null && (
              <div className="mt-3">
                <div className="relative pt-1">
                  <div className="flex mb-2 items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold inline-block text-indigo-600">
                        Uploading...
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-semibold inline-block text-indigo-600">
                        {singleBookUploadProgress}%
                      </span>
                    </div>
                  </div>
                  <div className="overflow-hidden h-2 text-xs flex rounded bg-indigo-200">
                    <div 
                      className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-indigo-500 transition-all duration-300 ease-in-out"
                      style={{ width: `${singleBookUploadProgress}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Success message */}
            {singleBookUploadStatus === 'success' && singleBookPdfUrl && (
              <div className="mt-3 flex items-center rounded-md bg-green-50 p-3 text-green-700">
                <FiCheckCircle className="mr-2 h-5 w-5" />
                <div>
                  <span className="font-medium">Upload successful!</span>
                  <button 
                    type="button"
                    onClick={() => window.open(singleBookPdfUrl, '_blank')}
                    className="ml-2 text-green-800 underline"
                  >
                    View file
                  </button>
                </div>
              </div>
            )}
            
            {/* Error message */}
            {singleBookUploadStatus === 'error' && singleBookUploadError && (
              <div className="mt-3 flex items-center rounded-md bg-red-50 p-3 text-red-700">
                <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span>{singleBookUploadError}</span>
              </div>
            )}
            
            {formErrors.bookPdf && (
              <p className="mt-2 text-sm text-red-600">{formErrors.bookPdf}</p>
            )}
          </div>

          {/* Publication Date */}
          <div className="form-group">
            <label htmlFor="publicationDate" className="block text-sm font-medium text-gray-700 mb-2">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center">
                  <FiCalendar className="mr-2 h-4 w-4 text-indigo-500" />
                  Publication Date <span className="text-red-500 ml-1">*</span>
                </div>
                <div className="flex items-center">
                  <span className="mr-2 text-xs text-gray-500">
                    {isYearOnly ? "Year only" : "Full date"}
                  </span>
                  <button 
                    type="button"
                    onClick={handleYearToggle}
                    className="text-xs text-indigo-600 hover:text-indigo-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 rounded-md px-2 py-1"
                  >
                    Toggle format
                  </button>
                </div>
              </div>
            </label>
            
            <div className="mt-1">
              {isYearOnly ? (
                <input
                  type="text"
                  id="publicationDate"
                  placeholder="YYYY"
                  pattern="\d{4}"
                  className={`block w-full rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm
                    ${formErrors.publicationDate ? "border-red-300 text-red-900 placeholder-red-300" : "border-gray-300"}`}
                  value={publicationDate}
                  onChange={(e) => setPublicationDate(e.target.value)}
                />
              ) : (
                <input
                  type="date"
                  id="publicationDate"
                  className={`block w-full rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm
                    ${formErrors.publicationDate ? "border-red-300 text-red-900 placeholder-red-300" : "border-gray-300"}`}
                  value={publicationDate}
                  onChange={(e) => setPublicationDate(e.target.value)}
                />
              )}
            </div>
            
            {formErrors.publicationDate && (
              <p className="mt-2 text-sm text-red-600">{formErrors.publicationDate}</p>
            )}
          </div>

          {/* Book Summary Field */}
          <div className="form-group">
            <label htmlFor="summary" className="block text-sm font-medium text-gray-700 mb-2">
              <div className="flex items-center">
                <FiFileText className="mr-2 h-4 w-4 text-indigo-500" />
                Book Summary
              </div>
            </label>
            <textarea
              id="summary"
              rows={4}
              className={`block w-full rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm
                ${formErrors.summary ? "border-red-300 text-red-900 placeholder-red-300" : "border-gray-300"}`}
              placeholder="Enter a brief summary of the book..."
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
            {formErrors.summary && (
              <p className="mt-2 text-sm text-red-600">{formErrors.summary}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">Provide a concise summary or description of the book's content</p>
          </div>

          {/* Additional fields for book */}
          <div className="form-group">
            <div className="border-t border-gray-200 pt-4 mb-4">
              <h3 className="text-base font-medium text-gray-900">Additional Book Details</h3>
              <p className="mt-1 text-sm text-gray-500">Optional information to enhance the book's metadata.</p>
            </div>
            
            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
              {/* Publisher */}
              <div className="sm:col-span-3">
                <label htmlFor="publisher" className="block text-sm font-medium text-gray-700">Publisher</label>
                <div className="mt-1">
                  <input
                    type="text"
                    id="publisher"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="Publisher name"
                    value={publisher}
                    onChange={(e) => setPublisher(e.target.value)}
                  />
                </div>
              </div>
              
              {/* Language */}
              <div className="sm:col-span-3">
                <label htmlFor="language" className="block text-sm font-medium text-gray-700">Language</label>
                <div className="mt-1">
                  <input
                    type="text"
                    id="language"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="Language"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                  />
                </div>
              </div>
              
              {/* Number of Pages */}
              <div className="sm:col-span-2">
                <label htmlFor="numberOfPages" className="block text-sm font-medium text-gray-700">Number of Pages</label>
                <div className="mt-1">
                  <input
                    type="number"
                    id="numberOfPages"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="Number of pages"
                    value={numberOfPages || ""}
                    onChange={(e) => setNumberOfPages(parseInt(e.target.value) || undefined)}
                  />
                </div>
              </div>
              
              {/* Ratings */}
              <div className="sm:col-span-2">
                <label htmlFor="ratings" className="block text-sm font-medium text-gray-700">Ratings</label>
                <div className="mt-1">
                  <input
                    type="number"
                    id="ratings"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="Number of ratings"
                    value={ratings || ""}
                    onChange={(e) => setRatings(parseInt(e.target.value) || undefined)}
                  />
                </div>
              </div>
              
              {/* Average Rating */}
              <div className="sm:col-span-2">
                <label htmlFor="averageRating" className="block text-sm font-medium text-gray-700">Average Rating</label>
                <div className="mt-1">
                  <input
                    type="number"
                    id="averageRating"
                    step="0.01"
                    min="0"
                    max="5"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="Average Rating (0-5)"
                    value={averageRating || ""}
                    onChange={(e) => setAverageRating(parseFloat(e.target.value) || undefined)}
                  />
                </div>
              </div>
              
              {/* Genres - as a comma-separated input */}
              <div className="sm:col-span-6">
                <label htmlFor="genres" className="block text-sm font-medium text-gray-700">Genres</label>
                <div className="mt-1">
                  <input
                    type="text"
                    id="genres"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="Fantasy, Adventure, Mystery"
                    value={genres.join(", ")}
                    onChange={(e) => {
                      const genresArray = e.target.value.split(",").map(genre => genre.trim()).filter(genre => genre !== "");
                      setGenres(genresArray);
                    }}
                  />
                  <p className="mt-1 text-xs text-gray-500">Separate genres with commas</p>
                </div>
              </div>
              
              {/* Characters - as a comma-separated input */}
              <div className="sm:col-span-6">
                <label htmlFor="characters" className="block text-sm font-medium text-gray-700">Characters</label>
                <div className="mt-1">
                  <input
                    type="text"
                    id="characters"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="Harry Potter, Hermione Granger, Ron Weasley"
                    value={characters.join(", ")}
                    onChange={(e) => {
                      const charactersArray = e.target.value.split(",").map(character => character.trim()).filter(character => character !== "");
                      setCharacters(charactersArray);
                    }}
                  />
                  <p className="mt-1 text-xs text-gray-500">Separate character names with commas</p>
                </div>
              </div>
            </div>
          </div>

          {/* Metadata URL Input */}
          <div className="form-group">
            <div className="border-t border-gray-200 pt-4 mb-4">
              <h3 className="text-base font-medium text-gray-900">Auto-fill from Web</h3>
              <p className="mt-1 text-sm text-gray-500">
                Automatically populate book details from a Fandom or Goodreads URL.
              </p>
            </div>

            <div className="mt-1">
              <div className="flex rounded-md shadow-sm">
                <div className="relative flex flex-grow items-stretch focus-within:z-10">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <FiLink className="h-5 w-5 text-gray-400" aria-hidden="true" />
                  </div>
                  <input
                    type="text"
                    id="metadataUrl"
                    className={`block w-full rounded-none rounded-l-md border-gray-300 pl-10 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
                      scrapingError ? "border-red-300 text-red-900 placeholder-red-300" : ""
                    }`}
                    placeholder="Paste a Fandom or Goodreads URL to auto-fill book details"
                    value={metadataUrl}
                    onChange={handleMetadataUrlChange}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleFetchMetadata}
                  disabled={isScrapingMetadata || !metadataUrl.trim()}
                  className={`relative -ml-px inline-flex items-center rounded-r-md border border-gray-300 bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                    (isScrapingMetadata || !metadataUrl.trim()) ? "cursor-not-allowed opacity-75" : ""
                  }`}
                >
                  {isScrapingMetadata ? (
                    <>
                      <FiLoader className="mr-2 h-4 w-4 animate-spin" />
                      Fetching...
                    </>
                  ) : (
                    <>
                      <FiDownload className="mr-2 h-4 w-4" />
                      Fetch Data
                    </>
                  )}
                </button>
              </div>
            </div>
            
            {scrapingError && (
              <div className="mt-3 flex items-center rounded-md bg-red-50 p-3 text-red-700">
                <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span>{scrapingError}</span>
              </div>
            )}
            
            {metadataSuccess && !scrapingError && (
              <div className="mt-3 flex items-center rounded-md bg-green-50 p-3 text-green-700">
                <FiCheckCircle className="mr-2 h-5 w-5" />
                <span>{metadataSuccess}</span>
              </div>
            )}
            
            {!scrapingError && !metadataSuccess && (
              <p className="mt-2 text-sm text-gray-500">
                Paste a URL from Fandom or Goodreads to automatically fill book details.
              </p>
            )}
          </div>

          {/* Submit Button */}
          <div className="form-group border-t border-gray-200 pt-6">
            <div className="flex justify-end">
              <Link
                href="/admin/books"
                className="mr-4 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={isSubmitting}
                className={`inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors ${
                  isSubmitting ? "cursor-not-allowed opacity-75" : ""
                }`}
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </>
                ) : (
                  <>
                    <FiSave className="mr-2 h-4 w-4" />
                    Save Book
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
} 