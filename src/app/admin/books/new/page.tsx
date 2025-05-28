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
    <div className="relative h-40 w-28 overflow-hidden rounded border border-gray-200 bg-gray-50 flex items-center justify-center">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent"></div>
        </div>
      )}
      
      {hasError && (
        <div className="flex flex-col items-center justify-center text-center p-2">
          <FiImage className="h-8 w-8 text-gray-400 mb-1" />
          <span className="text-xs text-gray-500">Image not available</span>
        </div>
      )}
      
      <img 
        src={src} 
        alt={alt}
        className={`max-h-full max-w-full object-contain transition-opacity duration-300 ${isLoading || hasError ? 'opacity-0' : 'opacity-100'}`}
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
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center">
          <Link
            href="/admin/books"
            className="mr-4 inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
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
      <div className="mb-4 flex items-center">
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

      <div className="form-card rounded-lg bg-white p-6 shadow-md">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Book Name */}
            <div className="form-field">
              <label htmlFor="bookName" className="mb-1 block text-sm font-medium text-gray-700">
                <div className="flex items-center">
                      <FiBook className="mr-2 h-4 w-4 text-gray-500" />
                      Book Name <span className="text-red-500">*</span>
                </div>
              </label>
                <input
                  type="text"
                  id="bookName"
                  className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
                    formErrors.bookName ? "border-red-500" : ""
                  }`}
                  placeholder="Enter book name"
                  value={bookName}
                  onChange={(e) => setBookName(e.target.value)}
                />
              {formErrors.bookName && (
                <p className="mt-1 text-sm text-red-500">{formErrors.bookName}</p>
              )}
            </div>

          {/* Authors */}
          <div className="form-field">
            <label className="mb-1 block text-sm font-medium text-gray-700">
                  <div className="flex items-center">
                <FiUsers className="mr-2 h-4 w-4 text-gray-500" />
                Authors <span className="text-red-500">*</span>
                    </div>
                              </label>
            {authors.map((author, index) => (
              <div key={author.id} className="mb-2 flex items-center">
                              <input
                                type="text"
                  className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
                    formErrors.authors ? "border-red-500" : ""
                  }`}
                  placeholder={`Author ${index + 1}`}
                  value={author.name}
                  onChange={(e) => updateAuthor(author.id!, e.target.value)}
                />
                {authors.length > 1 && (
                                  <button 
                                    type="button"
                    onClick={() => removeAuthor(author.id!)}
                    className="ml-2 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-500"
                                  >
                    <FiUsers className="h-5 w-5" />
                                  </button>
                )}
                                </div>
            ))}
                                <button
                                  type="button"
              onClick={addAuthor}
              className="mt-2 inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            >
              <FiUsers className="mr-2 h-4 w-4" />
              Add Author
                                </button>
            {formErrors.authors && (
              <p className="mt-1 text-sm text-red-500">{formErrors.authors}</p>
                              )}
                            </div>

          {/* Single Book Thumbnail Input */}
            <div className="form-field">
              <label htmlFor="thumbnailUrl" className="mb-1 block text-sm font-medium text-gray-700">
                <div className="flex items-center">
                  <FiImage className="mr-2 h-4 w-4 text-gray-500" />
                Thumbnail URL <span className="text-red-500">*</span>
                </div>
              </label>
              <input
                type="text"
                id="thumbnailUrl"
                className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
                  formErrors.thumbnailUrl ? "border-red-500" : ""
                }`}
                placeholder="https://example.com/image.jpg"
                value={thumbnailUrl}
                onChange={(e) => setThumbnailUrl(e.target.value)}
              />
              {formErrors.thumbnailUrl && (
                <p className="mt-1 text-sm text-red-500">{formErrors.thumbnailUrl}</p>
              )}
              
              {thumbnailPreview && (
                <div className="mt-2 flex items-center">
                  <BookThumbnail 
                    src={thumbnailPreview} 
                    alt="Thumbnail preview" 
                    onError={() => {
                      setThumbnailPreview("https://via.placeholder.com/120x160?text=Error");
                    }}
                  />
                  <span className="ml-2 text-xs text-gray-500">Thumbnail preview</span>
                </div>
              )}
            </div>

          {/* Book PDF File Input for single book */}
            <div className="form-field">
              <label htmlFor="bookPdf" className="mb-1 block text-sm font-medium text-gray-700">
                <div className="flex items-center">
                  <FiFileText className="mr-2 h-4 w-4 text-gray-500" />
                Book File (PDF) <span className="text-red-500">*</span> <span className="ml-1 text-xs text-gray-500">(Will be uploaded to Files.vc)</span>
                </div>
              </label>
              <input
                type="file"
                id="bookPdf"
                accept=".pdf"
                onChange={handleSingleBookPdfChange}
                className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:rounded-md file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100"
                disabled={singleBookUploadStatus === 'uploading'}
              />
              {bookPdfFile && (
                <p className="mt-1 text-sm text-gray-600">
                  Selected: {bookPdfFile.name} ({(bookPdfFile.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
              
              {/* Add progress bar for uploading single book file */}
              {singleBookUploadStatus === 'uploading' && singleBookUploadProgress !== null && (
                <div className="mt-2">
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-in-out" 
                      style={{ width: `${singleBookUploadProgress}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    Uploading... {singleBookUploadProgress}%
                  </p>
                </div>
              )}
              
              {/* Show success message when upload is complete */}
              {singleBookUploadStatus === 'success' && singleBookPdfUrl && (
                <div className="mt-2 flex items-center text-sm text-green-600">
                  <FiCheckCircle className="mr-1" />
                  <span>Upload complete!</span>
                  <button 
                    type="button"
                    onClick={() => window.open(singleBookPdfUrl, '_blank')}
                    className="ml-2 text-blue-600 hover:text-blue-800 underline text-xs"
                  >
                    View file
                  </button>
                </div>
              )}
              
              {/* Show error message if upload failed */}
              {singleBookUploadStatus === 'error' && singleBookUploadError && (
                <div className="mt-2 text-sm text-red-600">
                  <span>{singleBookUploadError}</span>
                </div>
              )}
              
              {formErrors.bookPdf && (
                <p className="mt-1 text-sm text-red-500">{formErrors.bookPdf}</p>
              )}
            </div>

          {/* Publication Date */}
            <div className="form-field">
              <label htmlFor="publicationDate" className="mb-1 flex items-center justify-between text-sm font-medium text-gray-700">
                <div className="flex items-center">
                  <FiCalendar className="mr-2 h-4 w-4 text-gray-500" />
                  Publication Date <span className="text-red-500">*</span>
                </div>
                <div className="flex items-center">
                  <span className="mr-2 text-xs">
                    {isYearOnly ? "Year only" : "Full date"}
                  </span>
                  <button 
                    type="button"
                    onClick={handleYearToggle}
                    className="text-xs text-indigo-600 hover:text-indigo-800"
                  >
                    Toggle format
                  </button>
                </div>
              </label>
              
              {isYearOnly ? (
                <input
                  type="text"
                  id="publicationDate"
                  placeholder="YYYY"
                  pattern="\d{4}"
                  className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
                    formErrors.publicationDate ? "border-red-500" : ""
                  }`}
                  value={publicationDate}
                  onChange={(e) => setPublicationDate(e.target.value)}
                />
              ) : (
                <input
                  type="date"
                  id="publicationDate"
                  className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
                    formErrors.publicationDate ? "border-red-500" : ""
                  }`}
                  value={publicationDate}
                  onChange={(e) => setPublicationDate(e.target.value)}
                />
              )}
              
              {formErrors.publicationDate && (
                <p className="mt-1 text-sm text-red-500">{formErrors.publicationDate}</p>
              )}
            </div>

          {/* Book Summary Field */}
            <div className="form-field">
              <label htmlFor="summary" className="mb-1 block text-sm font-medium text-gray-700">
                <div className="flex items-center">
                  <FiFileText className="mr-2 h-4 w-4 text-gray-500" />
                  Book Summary
                </div>
              </label>
              <textarea
                id="summary"
                rows={4}
                className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
                  formErrors.summary ? "border-red-500" : ""
                }`}
                placeholder="Enter a brief summary of the book..."
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
              />
              {formErrors.summary && (
                <p className="mt-1 text-sm text-red-500">{formErrors.summary}</p>
              )}
            </div>

          {/* Additional fields for book */}
            <div className="form-field">
              <h3 className="mb-3 text-sm font-medium text-gray-700">Additional Book Details</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Publisher */}
                <div className="mb-4">
                  <label htmlFor="publisher" className="block text-sm font-medium text-gray-600 mb-1">
                    Publisher
                  </label>
                  <input
                    type="text"
                    id="publisher"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    placeholder="Publisher name"
                    value={publisher}
                    onChange={(e) => setPublisher(e.target.value)}
                  />
                </div>
                
                {/* Language */}
                <div className="mb-4">
                  <label htmlFor="language" className="block text-sm font-medium text-gray-600 mb-1">
                    Language
                  </label>
                  <input
                    type="text"
                    id="language"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    placeholder="Language"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                  />
                </div>
                
                {/* Number of Pages */}
                <div className="mb-4">
                  <label htmlFor="numberOfPages" className="block text-sm font-medium text-gray-600 mb-1">
                    Number of Pages
                  </label>
                  <input
                    type="number"
                    id="numberOfPages"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    placeholder="Number of pages"
                    value={numberOfPages || ""}
                    onChange={(e) => setNumberOfPages(parseInt(e.target.value) || undefined)}
                  />
                </div>
                
                {/* Ratings */}
                <div className="mb-4">
                  <label htmlFor="ratings" className="block text-sm font-medium text-gray-600 mb-1">
                    Ratings
                  </label>
                  <input
                    type="number"
                    id="ratings"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    placeholder="Number of ratings"
                    value={ratings || ""}
                    onChange={(e) => setRatings(parseInt(e.target.value) || undefined)}
                  />
                </div>
                
                {/* Average Rating */}
                <div className="mb-4">
                  <label htmlFor="averageRating" className="block text-sm font-medium text-gray-600 mb-1">
                    Average Rating
                  </label>
                  <input
                    type="number"
                    id="averageRating"
                    step="0.01"
                    min="0"
                    max="5"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    placeholder="Average Rating (0-5)"
                    value={averageRating || ""}
                    onChange={(e) => setAverageRating(parseFloat(e.target.value) || undefined)}
                  />
                </div>
                
                {/* Genres - as a comma-separated input */}
                <div className="mb-4 col-span-2">
                  <label htmlFor="genres" className="block text-sm font-medium text-gray-600 mb-1">
                    Genres (comma separated)
                  </label>
                  <input
                    type="text"
                    id="genres"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    placeholder="Fantasy, Adventure, Mystery"
                    value={genres.join(", ")}
                    onChange={(e) => {
                      const genresArray = e.target.value.split(",").map(genre => genre.trim()).filter(genre => genre !== "");
                      setGenres(genresArray);
                    }}
                  />
                </div>
                
                {/* Characters - as a comma-separated input */}
                <div className="mb-4 col-span-2">
                  <label htmlFor="characters" className="block text-sm font-medium text-gray-600 mb-1">
                    Characters (comma separated)
                  </label>
                  <input
                    type="text"
                    id="characters"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    placeholder="Harry Potter, Hermione Granger, Ron Weasley"
                    value={characters.join(", ")}
                    onChange={(e) => {
                      const charactersArray = e.target.value.split(",").map(character => character.trim()).filter(character => character !== "");
                      setCharacters(charactersArray);
                    }}
                  />
                </div>
              </div>
            </div>

          {/* Metadata URL Input */}
            <div className="form-field">
              <label htmlFor="metadataUrl" className="mb-1 block text-sm font-medium text-gray-700">
                <div className="flex items-center">
                  <FiLink className="mr-2 h-4 w-4 text-gray-500" />
                  Metadata URL
                </div>
              </label>
              <div className="mt-1 flex rounded-md shadow-sm">
                <input
                  type="text"
                  id="metadataUrl"
                  className={`block w-full flex-1 rounded-none rounded-l-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
                    scrapingError ? "border-red-500" : ""
                  }`}
                  placeholder="Paste a Fandom or Goodreads URL to auto-fill book details"
                  value={metadataUrl}
                  onChange={handleMetadataUrlChange}
                />
                <button
                  type="button"
                  onClick={handleFetchMetadata}
                  disabled={isScrapingMetadata || !metadataUrl.trim()}
                  className={`inline-flex items-center rounded-r-md border border-l-0 border-gray-300 bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
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
              {scrapingError && (
                <p className="mt-1 text-sm text-red-500">{scrapingError}</p>
              )}
              {metadataSuccess && !scrapingError && (
                <p className="mt-1 text-sm text-green-600 flex items-center">
                  <FiCheckCircle className="mr-1 h-4 w-4" /> {metadataSuccess}
                </p>
              )}
              {!scrapingError && !metadataSuccess && (
                <p className="mt-1 text-xs text-gray-500">Paste a URL from Fandom or Goodreads to automatically fill book details.</p>
              )}
            </div>

          {/* Submit Button */}
          <div className="flex justify-end pt-5">
            <Link
              href="/admin/books"
              className="mr-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                isSubmitting ? "cursor-not-allowed opacity-75" : ""
              }`}
            >
              <FiSave className="mr-2 h-4 w-4" />
              {isSubmitting ? "Saving..." : "Save Book"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 