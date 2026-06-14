"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FiArrowLeft, FiSave, FiImage, FiCalendar, FiUsers, FiBook, FiFileText, FiCheckCircle, FiLink, FiLoader, FiDownload, FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { useUserSettings } from "@/hooks/useUserSettings";
import toast from "react-hot-toast";

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
  series?: string;
  seriesPosition?: number | number[] | string;
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
  const [series, setSeries] = useState("");
  const [seriesPosition, setSeriesPosition] = useState<string>("");
  
  // Add new state variables for metadata URL functionality
  const [metadataUrl, setMetadataUrl] = useState("");
  const [isScrapingMetadata, setIsScrapingMetadata] = useState(false);
  const [scrapingError, setScrapingError] = useState<string | null>(null);

  // Add these state variables for single book upload
  const [singleBookUploadProgress, setSingleBookUploadProgress] = useState<number | null>(null);
  const [singleBookUploadStatus, setSingleBookUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [singleBookPdfUrl, setSingleBookPdfUrl] = useState<string | null>(null);
  const [singleBookUploadError, setSingleBookUploadError] = useState<string | null>(null);

  // Load user settings when component mounts
  useEffect(() => {
    if (!isSettingsLoading && settings) {
      console.log('Settings loaded:', settings);
      
      // No need to show notification for initial settings load
    }
  }, [settings, isSettingsLoading]);
  
  // Monitor sync status for notifications
  useEffect(() => {
    // Only show important notifications (error states)
    if (syncStatus === 'error') {
      toast.error(lastSyncMessage || 'Failed to synchronize settings');
    }
  }, [syncStatus, lastSyncMessage]);

  // Update thumbnail preview when URL changes
  useEffect(() => {
    if (thumbnailUrl && thumbnailUrl.trim() !== "") {
      setThumbnailPreview(thumbnailUrl);
    } else {
      setThumbnailPreview("");
    }
  }, [thumbnailUrl]);

  // Modify validation function to validate all fields at once
  const validateForm = () => {
    let errors: {[key: string]: string} = {};
    
    // Basic info validation
    if (!bookName.trim()) {
      errors.bookName = "Book name is required";
    }
    
    if (authors.length === 0 || authors.some(author => !author.name.trim())) {
      errors.authors = "Please add at least one author with a name";
    }
    
    // Media validation
    if (!thumbnailUrl.trim()) {
      errors.thumbnailUrl = "Thumbnail URL is required";
    }
    
    if (!bookPdfFile && !singleBookPdfUrl) {
      errors.bookPdf = "Please select a PDF file for the book";
    }
    
    // Details validation - publication date is now optional
    if (publicationDate.trim()) {
      // Only validate if a date is provided
      // Validate date format - either YYYY or YYYY-MM-DD
      const yearOnlyPattern = /^\d{4}$/;
      const fullDatePattern = /^\d{4}-\d{2}-\d{2}$/;
      
      if (!yearOnlyPattern.test(publicationDate) && !fullDatePattern.test(publicationDate)) {
        errors.publicationDate = "Please enter a valid year (YYYY) or date (YYYY-MM-DD)";
      } else if (fullDatePattern.test(publicationDate)) {
        // If full date format, validate that it's a reasonable date
        try {
          const date = new Date(publicationDate);
          if (isNaN(date.getTime())) {
            errors.publicationDate = "Please enter a valid date";
          }
        } catch (error) {
          errors.publicationDate = "Please enter a valid date";
        }
      }
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate all fields before submission
    if (!validateForm()) {
      // Show error notification
      toast.error('Please fill in all required fields');
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
      formData.append('summary', summary);
      
      // Add publisher and other metadata if available
      if (publisher) formData.append('publisher', publisher);
      if (genres.length > 0) formData.append('genres', JSON.stringify(genres));
      if (ratings !== undefined) formData.append('ratings', ratings.toString());
      if (averageRating !== undefined) formData.append('averageRating', averageRating.toString());
      if (numberOfPages != null) formData.append('numberOfPages', numberOfPages.toString());
      if (characters.length > 0) formData.append('characters', JSON.stringify(characters));
      if (language) formData.append('language', language);
      if (series) formData.append('series', series);
      
      // Add scraper URL if it was used
      if (metadataUrl) formData.append('scraperUrl', metadataUrl);
      
      // Handle series position data
      if (seriesPosition) {
        console.log("Series position data to send:", seriesPosition);
        formData.append('seriesPosition', seriesPosition);
      }
      
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
      
      toast.success('Book added successfully!');
      router.push('/admin/books');
    } catch (error) {
      console.error("Error submitting form:", error);
      toast.error('Failed to save book. Please try again.');
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
      
      // Add debugging logs
      console.log("Fetched raw metadata:", data);
      console.log("Authors data:", data.authors);

      // Process Goodreads dates properly
      if (urlType === 'goodreads' && data.publicationDate) {
        console.log("Original Goodreads publication date:", data.publicationDate);
        
        // Check if it's already in a standard format we can use
        if (/^\d{4}-\d{2}-\d{2}$/.test(data.publicationDate)) {
          console.log("Already in YYYY-MM-DD format:", data.publicationDate);
        } 
        else if (/^\d{4}$/.test(data.publicationDate)) {
          console.log("Already in YYYY format:", data.publicationDate);
        }
        // Process "Month Day, Year" format (e.g., "January 1, 1998")
        else {
          // Map of month names to their numeric values
          const monthMap: Record<string, string> = {
            "january": "01", "february": "02", "march": "03", "april": "04",
            "may": "05", "june": "06", "july": "07", "august": "08",
            "september": "09", "october": "10", "november": "11", "december": "12"
          };
          
          // This regex handles "Month Day, Year" format
          const goodreadsDateRegex = /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:,|\s+|st|nd|rd|th)\s+(\d{4})\b/i;
          
          const match = data.publicationDate.toLowerCase().match(goodreadsDateRegex);
          
          if (match) {
            const monthName = match[1].toLowerCase();
            const day = String(parseInt(match[2])).padStart(2, '0');
            const year = match[3];
            const month = monthMap[monthName];
            
            if (month) {
              data.publicationDate = `${year}-${month}-${day}`;
              console.log("Successfully converted Goodreads date to:", data.publicationDate);
            } else {
              console.log("Could not map month name to number, using year only:", year);
              data.publicationDate = year;
            }
          } 
          // Handle "Month Year" format (e.g., "January 1998")
          else {
            const monthYearRegex = /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})\b/i;
            const monthYearMatch = data.publicationDate.toLowerCase().match(monthYearRegex);
            
            if (monthYearMatch) {
              const monthName = monthYearMatch[1].toLowerCase();
              const year = monthYearMatch[2];
              const month = monthMap[monthName];
              
              if (month) {
                data.publicationDate = `${year}-${month}-01`; // Default to 1st of month
                console.log("Converted Month Year format to:", data.publicationDate);
              } else {
                console.log("Could not map month name in Month Year format, using year only:", year);
                data.publicationDate = year;
              }
            } 
            // Fallback: Just try to extract a year if all else fails
            else {
              const yearMatch = data.publicationDate.match(/(19|20)\d{2}/);
              if (yearMatch) {
                data.publicationDate = yearMatch[0];
                console.log("Falling back to year only:", data.publicationDate);
              }
            }
          }
        }
      }
      
      // Populate form fields with the scraped data
      populateFormFields(data);
      
      // Only use the notification system for success messages
      if ('title' in data) {
        toast.success(`Book "${data.title}" data imported successfully!`);
      } else {
        toast.success('Book data imported successfully!');
      }
    } catch (error) {
      console.error('Error fetching metadata:', error);
      setScrapingError(error instanceof Error ? error.message : 'Failed to fetch metadata');
      toast.error('Failed to fetch metadata. See error for details.');
    } finally {
      setIsScrapingMetadata(false);
    }
  };
  
  // Function to populate form fields with scraped data
  const populateFormFields = (data: ScrapedBookData) => {
    console.log("Data to populate:", data);
    
    if (data) {
      // Set book name if available
      if (data.title) {
        console.log("Setting book name:", data.title);
        setBookName(data.title);
      }
      
      // Set thumbnail URL if available
      if (data.imageUrl) {
        console.log("Setting thumbnail URL:", data.imageUrl);
        setThumbnailUrl(data.imageUrl);
      }
      
      // Set summary if available
      if (data.summary) {
        console.log("Setting summary:", data.summary);
        setSummary(data.summary);
      }
      
      // Set publication date if available - simplified approach
      if (data.publicationDate) {
        console.log("Setting publication date:", data.publicationDate);
        
        // Already in YYYY-MM-DD format
        if (/^\d{4}-\d{2}-\d{2}$/.test(data.publicationDate)) {
          console.log("Using YYYY-MM-DD format directly");
          setPublicationDate(data.publicationDate);
        }
        // Already in YYYY format
        else if (/^\d{4}$/.test(data.publicationDate)) {
          console.log("Using YYYY format directly");
          setPublicationDate(data.publicationDate);
        }
        // Try to parse it as a date object - handle other formats
        else {
          try {
            const date = new Date(data.publicationDate);
            if (!isNaN(date.getTime())) {
              const formattedDate = date.toISOString().split('T')[0]; // YYYY-MM-DD
              console.log("Parsed as Date object and formatted:", formattedDate);
              setPublicationDate(formattedDate);
            } else {
              // Fallback to year extraction
              const yearMatch = data.publicationDate.match(/(19|20)\d{2}/);
              if (yearMatch) {
                console.log("Extracted year as fallback:", yearMatch[0]);
                setPublicationDate(yearMatch[0]);
              } else {
                console.log("Could not extract date, using as-is:", data.publicationDate);
                setPublicationDate(data.publicationDate);
              }
            }
          } catch (error) {
            // Fallback to year extraction on error
            const yearMatch = data.publicationDate.match(/(19|20)\d{2}/);
            if (yearMatch) {
              console.log("Error parsing date, extracted year as fallback:", yearMatch[0]);
              setPublicationDate(yearMatch[0]);
            } else {
              console.log("Could not extract date, using as-is:", data.publicationDate);
              setPublicationDate(data.publicationDate);
            }
          }
        }
      }
      
      // If authors are available
      if (data.authors) {
        console.log("Authors data type:", typeof data.authors);
        
        // Handle different formats of author data
        let authorsList: string[] = [];
        
        if (Array.isArray(data.authors)) {
          // It's already an array
          authorsList = data.authors;
        } else if (typeof data.authors === 'string') {
          // If it's a string, split by commas
          authorsList = (data.authors as string).split(',').map((a: string) => a.trim());
        } else if (typeof data.authors === 'object') {
          // If it's an object, try to extract values
          authorsList = Object.values(data.authors as Record<string, unknown>).map((a: unknown) => String(a));
        }
        
        console.log("Processed authors list:", authorsList);
        
        if (authorsList.length > 0) {
          const newAuthors = authorsList.map((authorName: string) => {
            console.log("Creating author object for:", authorName);
            return { id: crypto.randomUUID(), name: authorName };
          });
          console.log("New authors array:", newAuthors);
          setAuthors(newAuthors);
        }
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
      
      // Handle series information if available
      if (data.series) {
        setSeries(data.series);
      }
      
      // Handle series position - could be number, array, or string
      if (data.seriesPosition !== undefined) {
        console.log("Series position data:", data.seriesPosition, "type:", typeof data.seriesPosition);
        
        // If it's already an array of numbers
        if (Array.isArray(data.seriesPosition)) {
          console.log("Setting series position from array:", data.seriesPosition);
          setSeriesPosition(data.seriesPosition.join(", "));
        }
        // If it's a single number
        else if (typeof data.seriesPosition === 'number') {
          console.log("Setting series position from single number:", data.seriesPosition);
          setSeriesPosition(data.seriesPosition.toString());
        }
        // If it's a string (e.g., "1,2,3")
        else if (typeof data.seriesPosition === 'string') {
          console.log("Parsing series position from string:", data.seriesPosition);
          setSeriesPosition(data.seriesPosition);
        }
      }
    }
  };
  
  // Metadata URL field handler
  const handleMetadataUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMetadataUrl(e.target.value);
    setScrapingError(null);
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
      // Use XMLHttpRequest instead of fetch to track upload progress
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        // Track upload progress
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 100);
            console.log(`Upload progress: ${percentComplete}%`);
            setSingleBookUploadProgress(percentComplete);
          }
        });
        
        // Handle successful upload
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText);
              if (data && data.fileData && data.fileData.url) {
                setSingleBookPdfUrl(data.fileData.url);
                setSingleBookUploadStatus('success');
                setSingleBookUploadProgress(100);
                resolve(data);
              } else {
                throw new Error('Invalid response format from server');
              }
            } catch (error) {
              reject(error);
            }
          } else {
            try {
              const errorData = JSON.parse(xhr.responseText);
              reject(new Error(errorData.error || `HTTP error ${xhr.status}`));
            } catch {
              reject(new Error(`HTTP error ${xhr.status}`));
            }
          }
        });
        
        // Handle network errors
        xhr.addEventListener('error', () => {
          reject(new Error('Network error occurred during upload'));
        });
        
        // Handle timeout
        xhr.addEventListener('timeout', () => {
          reject(new Error('Upload timed out'));
        });
        
        // Handle abort
        xhr.addEventListener('abort', () => {
          reject(new Error('Upload was aborted'));
        });
        
        // Open and send the request
        xhr.open('POST', '/api/admin/upload', true);
        xhr.send(formData);
      });
    } catch (error) {
      console.error('Error uploading file:', error);
      handleSingleBookUploadError(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  };
  
  // Helper function to handle single book upload errors
  const handleSingleBookUploadError = (errorMessage: string) => {
    setSingleBookUploadStatus('error');
    setSingleBookUploadError(errorMessage);
    toast.error(`Upload failed: ${errorMessage}`);
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
            Enter all details of the book you want to add to the library. Required fields are marked with an asterisk (*).
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-8">
          {/* Auto-fill from web section at the top for better UX */}
          <div className="form-group bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h3 className="text-base font-medium text-gray-900">Quick Fill from Web</h3>
            <p className="mt-1 text-sm text-gray-500">
              Save time by automatically populating book details from Fandom or Goodreads.
            </p>

            <div className="mt-3">
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
                  <path fillRule="evenodd" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" clipRule="evenodd" />
                </svg>
                <span>{scrapingError}</span>
              </div>
            )}
          </div>

          {/* Section 1: Basic Information */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h3>
            <div className="space-y-6">
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
                  placeholder="Enter a brief summary of the book's content"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                />
                {formErrors.summary && (
                  <p className="mt-2 text-sm text-red-600">{formErrors.summary}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">Provide a concise summary or description of the book's content</p>
              </div>
            </div>
          </div>
          
          {/* Section 2: Media */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Media</h3>
            <div className="space-y-6">
              {/* Single Book Thumbnail Input */}
              <div className="form-group">
                <label htmlFor="thumbnailUrl" className="block text-sm font-medium text-gray-700 mb-2">
                  <div className="flex items-center">
                    <FiImage className="mr-2 h-4 w-4 text-indigo-500" />
                    Thumbnail URL <span className="text-red-500 ml-1">*</span>
                  </div>
                </label>
                <div className="flex flex-col md:flex-row md:items-start md:space-x-4">
                  <div className="flex-grow mb-4 md:mb-0">
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
                  
                  <div className="flex-shrink-0 flex justify-center">
                    {thumbnailPreview ? (
                      <BookThumbnail 
                        src={thumbnailPreview} 
                        alt="Thumbnail preview" 
                        onError={() => {
                          setThumbnailPreview("https://via.placeholder.com/120x160?text=Error");
                        }}
                      />
                    ) : (
                      <div className="h-48 w-32 border-2 border-dashed border-gray-300 rounded-md flex flex-col items-center justify-center text-gray-400">
                        <FiImage className="h-10 w-10 mb-2" />
                        <span className="text-xs text-center px-2">Cover preview will appear here</span>
                      </div>
                    )}
                  </div>
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
            </div>
          </div>
          
          {/* Section 3: Publication */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Publication Details</h3>
            <div className="space-y-6">
              {/* Publication Date */}
              <div className="form-group">
                <label htmlFor="publicationDate" className="block text-sm font-medium text-gray-700 mb-2">
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center">
                      <FiCalendar className="mr-2 h-4 w-4 text-indigo-500" />
                      Publication Date
                    </div>
                  </div>
                </label>
                
                <div className="mt-1">
                  <div className="relative rounded-md shadow-sm">
                    <input
                      type="text"
                      id="publicationDate"
                      className={`block w-full rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm
                        ${formErrors.publicationDate ? "border-red-300 text-red-900 placeholder-red-300" : "border-gray-300"}`}
                      placeholder="YYYY or YYYY-MM-DD"
                      value={publicationDate}
                      onChange={(e) => setPublicationDate(e.target.value)}
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">Enter year (YYYY) or full date (YYYY-MM-DD). Auto-filled dates will be formatted automatically.</p>
                </div>
                
                {formErrors.publicationDate && (
                  <p className="mt-2 text-sm text-red-600">{formErrors.publicationDate}</p>
                )}
              </div>
              
              {/* Publisher */}
              <div className="form-group">
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
                <p className="mt-1 text-xs text-gray-500">Enter the name of the publishing company (optional)</p>
              </div>
              
              {/* Language */}
              <div className="form-group">
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
                <p className="mt-1 text-xs text-gray-500">Enter the language of the book (e.g. English, Spanish)</p>
              </div>
            </div>
          </div>
          
          {/* Section 4: Additional Details */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Additional Book Details (Optional)</h3>
            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
              {/* Series Information */}
              <div className="sm:col-span-4">
                <label htmlFor="series" className="block text-sm font-medium text-gray-700">Series</label>
                <div className="mt-1">
                  <input
                    type="text"
                    id="series"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="Series name (e.g. Harry Potter)"
                    value={series}
                    onChange={(e) => setSeries(e.target.value)}
                  />
                  <p className="mt-1 text-xs text-gray-500">If this book is part of a series, enter the series name</p>
                </div>
              </div>
              
              <div className="sm:col-span-2">
                <label htmlFor="seriesPosition" className="block text-sm font-medium text-gray-700">Position in Series</label>
                <div className="mt-1">
                  <input
                    type="text"
                    id="seriesPosition"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="1, 1/1, 2.5, etc."
                    value={seriesPosition}
                    onChange={(e) => setSeriesPosition(e.target.value)}
                  />
                  <p className="mt-1 text-xs text-gray-500">Book's position in the series (can be any format like "1/1" or "2")</p>
                </div>
              </div>
            
              {/* Number of Pages */}
              <div className="sm:col-span-2">
                <label htmlFor="numberOfPages" className="block text-sm font-medium text-gray-700">Number of Pages</label>
                <div className="mt-1">
                  <div className="relative rounded-md shadow-sm">
                    <input
                      type="number"
                      id="numberOfPages"
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      placeholder="Number of pages"
                      value={numberOfPages || ""}
                      onChange={(e) => setNumberOfPages(parseInt(e.target.value) || undefined)}
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Ratings */}
              <div className="sm:col-span-2">
                <label htmlFor="ratings" className="block text-sm font-medium text-gray-700">Ratings</label>
                <div className="mt-1">
                  <div className="relative rounded-md shadow-sm">
                    <input
                      type="number"
                      id="ratings"
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      placeholder="Number of ratings"
                      value={ratings || ""}
                      onChange={(e) => setRatings(parseInt(e.target.value) || undefined)}
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Average Rating */}
              <div className="sm:col-span-2">
                <label htmlFor="averageRating" className="block text-sm font-medium text-gray-700">Average Rating</label>
                <div className="mt-1">
                  <div className="relative rounded-md shadow-sm">
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
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">Average rating out of 5</p>
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
          
          {/* Submit Button */}
          <div className="form-group border-t border-gray-200 pt-6 mt-6">
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting || singleBookUploadStatus === 'uploading'}
                className={`inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors ${
                  (isSubmitting || singleBookUploadStatus === 'uploading') ? "cursor-not-allowed opacity-75" : ""
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
              
              <Link
                href="/admin/books"
                className="ml-4 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
              >
                Cancel
              </Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
} 