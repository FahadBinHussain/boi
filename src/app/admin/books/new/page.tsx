"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FiPlus, FiX, FiArrowLeft, FiSave, FiImage, FiCalendar, FiUsers, FiBook, FiLayers, FiFileText, FiCheckCircle, FiBookmark, FiUpload, FiTrash2, FiLink, FiLoader, FiDownload } from "react-icons/fi";
import gsap from "gsap";
import { useUserSettings } from "@/hooks/useUserSettings";
import { useNotification } from "@/contexts/NotificationContext";

interface Author {
  name: string;
  id?: string; // Make id optional since we're creating new authors
}

// Add an interface for series thumbnails
interface SeriesThumbnail {
  bookNumber: number;
  url: string;
  publicationDate: string;
  isYearOnly: boolean;
  customName?: string;
  summary?: string;
  preview?: string;
  metadataUrl?: string; // Add this field to store metadata URL for each book
  isLoading: boolean; // Add this field to store loading state
  errorMessage?: string; // Add this field to store error messages
  successMessage?: string; // Add this field to store success messages
  publisher?: string;
  genres?: string[];
  ratings?: number;
  averageRating?: number;
  numberOfPages?: number;
  characters?: string[];
  language?: string;
  uploadProgress?: number; // Add upload progress field
  pdfUrl?: string; // Add PDF URL field after successful upload
}

// Interface for book PDF files in a series
interface SeriesBookPdf {
  bookNumber: number;
  file: File | null;
  isUploading?: boolean; // Add upload status
  uploadProgress?: number; // Add upload progress
  pdfUrl?: string; // Add URL after successful upload
}

// Add these interface definitions at the top of the file with the other interfaces
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

interface SeriesUploadResult {
  bookNumber: number;
  fileData: UploadResult['fileData'];
}

// Add a new interface for approved books
interface ApprovedBook {
  bookNumber: number;
  isApproved: boolean;
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

interface ScrapedSeriesData {
  seriesTitle: string;
  books?: ScrapedBookData[];
}

export default function AddNewBook() {
  const router = useRouter();
  const { settings, isLoading: isSettingsLoading, syncStatus, lastSyncMessage } = useUserSettings();
  const { showNotification } = useNotification();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSeries, setIsSeries] = useState(false);
  const [useDifferentNames, setUseDifferentNames] = useState(false);
  const [formErrors, setFormErrors] = useState<{
    bookName?: string;
    authors?: string;
    thumbnailUrl?: string;
    publicationDate?: string;
    seriesStart?: string;
    seriesEnd?: string;
    seriesThumbnails?: string; // For general series thumbnail errors
    bookPdf?: string; // For single book PDF error
    seriesBookPdfs?: string; // For series PDF errors
    summary?: string; // Add this for summary field errors
    seriesBookNames?: string; // Add this for custom book name errors
    metadataUrl?: string;
  }>({});

  // Form state for single book
  const [bookName, setBookName] = useState("");
  const [authors, setAuthors] = useState<Author[]>([{ id: crypto.randomUUID(), name: "" }]);
  const [thumbnailUrl, setThumbnailUrl] = useState(""); // Used for single book mode
  const [publicationDate, setPublicationDate] = useState("");
  const [thumbnailPreview, setThumbnailPreview] = useState(""); // Used for single book mode
  const [bookPdfFile, setBookPdfFile] = useState<File | null>(null); // For single book PDF
  const [summary, setSummary] = useState("");  // Add this after line 65 with other single book state
  const [publisher, setPublisher] = useState(""); // For single book publisher
  const [genres, setGenres] = useState<string[]>([]); // For single book genres
  const [ratings, setRatings] = useState<number | undefined>(undefined); // For single book ratings
  const [averageRating, setAverageRating] = useState<number | undefined>(undefined); // For single book average rating
  const [numberOfPages, setNumberOfPages] = useState<number | undefined>(undefined); // For single book page count
  const [characters, setCharacters] = useState<string[]>([]); // For single book characters
  const [language, setLanguage] = useState(""); // For single book language
  
  // Use user's preferred date format from settings or default to year-only
  const [isYearOnly, setIsYearOnly] = useState(true);

  // Additional form state for series
  const [seriesBaseName, setSeriesBaseName] = useState("");
  const [seriesStart, setSeriesStart] = useState(1);
  const [seriesEnd, setSeriesEnd] = useState(10);
  const [seriesThumbnails, setSeriesThumbnails] = useState<SeriesThumbnail[]>([]); // For series mode
  const [seriesBookPdfs, setSeriesBookPdfs] = useState<SeriesBookPdf[]>([]); // For series PDFs

  // Add state for approved books
  const [approvedBooks, setApprovedBooks] = useState<ApprovedBook[]>([]);

  // Add new state variables for metadata URL functionality
  const [metadataUrl, setMetadataUrl] = useState("");
  const [isScrapingMetadata, setIsScrapingMetadata] = useState(false);
  const [scrapingError, setScrapingError] = useState<string | null>(null);
  const [metadataSuccess, setMetadataSuccess] = useState<string | null>(null);

  // Update the state to track the active book tab
  const [activeBookTab, setActiveBookTab] = useState<number>(0);

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

  // Number conversion functions
  const getFormattedSeriesNumber = (num: number): string => {
    return num.toString();
  };

  // Update thumbnail preview when URL changes (single book mode)
  useEffect(() => {
    if (!isSeries && thumbnailUrl && thumbnailUrl.trim() !== "") {
      setThumbnailPreview(thumbnailUrl);
    } else if (!isSeries) {
      setThumbnailPreview("");
    }
  }, [thumbnailUrl, isSeries]);

  // Update the useEffect that initializes seriesThumbnails to include publicationDate, isYearOnly, and customName
  useEffect(() => {
    if (isSeries) {
      const newThumbnails: SeriesThumbnail[] = [];
      const newBookPdfs: SeriesBookPdf[] = [];
      const newApprovedBooks: ApprovedBook[] = []; // Initialize approved books state
      const currentTotalBooks = Math.max(0, seriesEnd - seriesStart + 1);
      for (let i = 0; i < currentTotalBooks; i++) {
        const bookNumber = seriesStart + i;
        // Try to preserve existing URL if book number matches
        const existingThumbnail = seriesThumbnails.find(st => st.bookNumber === bookNumber);
        const existingPdf = seriesBookPdfs.find(sp => sp.bookNumber === bookNumber);
        const existingApproval = approvedBooks.find(ab => ab.bookNumber === bookNumber);
        
        newThumbnails.push({
          bookNumber: bookNumber,
          url: existingThumbnail?.url || "",
          preview: existingThumbnail?.preview || "",
          publicationDate: existingThumbnail?.publicationDate || publicationDate, // Use existing or current global date
          isYearOnly: existingThumbnail?.isYearOnly !== undefined ? existingThumbnail.isYearOnly : true, // Default to year-only
          summary: existingThumbnail?.summary || "", // Preserve existing summary or set empty
          customName: existingThumbnail?.customName || "", // Preserve existing custom name or set empty
          metadataUrl: existingThumbnail?.metadataUrl || "", // Preserve existing metadata URL
          isLoading: false, // Add loading state
          errorMessage: existingThumbnail?.errorMessage, // Add error message
          successMessage: existingThumbnail?.successMessage, // Add success message
          publisher: existingThumbnail?.publisher,
          genres: existingThumbnail?.genres,
          ratings: existingThumbnail?.ratings,
          averageRating: existingThumbnail?.averageRating,
          numberOfPages: existingThumbnail?.numberOfPages,
          characters: existingThumbnail?.characters,
          language: existingThumbnail?.language,
          uploadProgress: existingThumbnail?.uploadProgress, // Add upload progress
          pdfUrl: existingThumbnail?.pdfUrl, // Add PDF URL
        });
        newBookPdfs.push({
          bookNumber: bookNumber,
          file: existingPdf?.file || null,
          isUploading: existingPdf?.isUploading, // Add upload status
          uploadProgress: existingPdf?.uploadProgress, // Add upload progress
          pdfUrl: existingPdf?.pdfUrl, // Add URL after successful upload
        });
        newApprovedBooks.push({
          bookNumber: bookNumber,
          isApproved: existingApproval?.isApproved || false,
        });
      }
      setSeriesThumbnails(newThumbnails);
      setSeriesBookPdfs(newBookPdfs);
      setApprovedBooks(newApprovedBooks);
    } else {
      setSeriesThumbnails([]); // Clear when not in series mode
      setSeriesBookPdfs([]);
      setApprovedBooks([]);
    }
  }, [isSeries, seriesStart, seriesEnd]);
  
  // Update individual series thumbnail preview
  const updateSeriesThumbnailPreview = (index: number, url: string) => {
    setSeriesThumbnails(prev => 
      prev.map((thumbnail, i) => 
        i === index ? { ...thumbnail, url, preview: url.trim() !== "" ? url : "" } : thumbnail
      )
    );
  };

  // Add function to update publication date for a specific book in the series
  const updateSeriesBookPublicationDate = (index: number, date: string) => {
    setSeriesThumbnails(prev => 
      prev.map((thumbnail, i) => 
        i === index ? { ...thumbnail, publicationDate: date } : thumbnail
      )
    );
  };

  // Add function to toggle between year-only and full date format
  const toggleSeriesBookYearOnly = (index: number) => {
    setSeriesThumbnails(prev => {
      const updated = [...prev];
      if (index >= 0 && index < updated.length) {
        const thumbnail = updated[index];
        // Toggle the isYearOnly flag
        const newIsYearOnly = !thumbnail.isYearOnly;
        
        // When toggling from full date to year-only, extract just the year
        if (newIsYearOnly && thumbnail.publicationDate) {
          const yearMatch = thumbnail.publicationDate.match(/^\d{4}/);
          const year = yearMatch ? yearMatch[0] : new Date().getFullYear().toString();
          updated[index] = { 
            ...thumbnail, 
            isYearOnly: true,
            publicationDate: year
          };
        } 
        // When toggling from year-only to full date, convert to YYYY-MM-DD format
        else if (!newIsYearOnly) {
          const year = thumbnail.publicationDate || new Date().getFullYear().toString();
          updated[index] = { 
            ...thumbnail, 
            isYearOnly: false,
            publicationDate: `${year}-01-01` // Default to January 1st of the year
          };
        }
        
        // No need to show notification for each toggle
      }
      return updated;
    });
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
    try {
      // Set upload status to uploading
      setSingleBookUploadStatus('uploading');
      setSingleBookUploadProgress(0);
      setSingleBookUploadError(null);
      
      // Create FormData
      const formData = new FormData();
      formData.append('file', file);
      
      // Use XMLHttpRequest for progress tracking
      const xhr = new XMLHttpRequest();
      
      // Track upload progress
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          setSingleBookUploadProgress(progress);
        }
      });
      
      // Handle completion
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          // Success
          try {
            const response = JSON.parse(xhr.responseText);
            
            if (response.success && response.fileData && response.fileData.url) {
              setSingleBookUploadStatus('success');
              setSingleBookPdfUrl(response.fileData.url);
              showNotification('success', 'File uploaded successfully!');
            } else {
              handleSingleBookUploadError('Upload failed: Invalid response from server');
            }
          } catch (parseError) {
            handleSingleBookUploadError('Upload failed: Could not parse server response');
          }
        } else {
          // HTTP error
          handleSingleBookUploadError(`Upload failed with status ${xhr.status}`);
        }
      });
      
      // Handle network errors
      xhr.addEventListener('error', () => {
        handleSingleBookUploadError('Network error during upload');
      });
      
      // Handle aborted uploads
      xhr.addEventListener('abort', () => {
        handleSingleBookUploadError('Upload was aborted');
      });
      
      // Open and send the request
      xhr.open('POST', '/api/admin/upload', true);
      xhr.send(formData);
      
    } catch (error) {
      handleSingleBookUploadError('Error preparing upload');
      console.error('Error uploading file:', error);
    }
  };
  
  // Helper function to handle single book upload errors
  const handleSingleBookUploadError = (errorMessage: string) => {
    setSingleBookUploadStatus('error');
    setSingleBookUploadError(errorMessage);
    showNotification('error', `Upload failed: ${errorMessage}`);
  };

  const handleSeriesBookPdfChange = (index: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files && event.target.files[0] ? event.target.files[0] : null;
    
    // First update the PDF file in state
    setSeriesBookPdfs(prev => {
      const updated = prev.map((pdfItem, i) => 
        i === index ? { 
          ...pdfItem, 
          file,
          isUploading: !!file,
          uploadProgress: file ? 0 : undefined,
          pdfUrl: undefined // Reset URL when new file is selected
        } : pdfItem
      );
      
      // If we have a file, start the upload immediately
      if (file) {
        // Get the book number for this index
        const bookNumber = updated[index].bookNumber;
        
        // Start upload in the background
        uploadFileWithProgress(file, index, bookNumber);
      }
      
      return updated;
    });
  };

  // New function to upload files with progress tracking
  const uploadFileWithProgress = async (file: File, index: number, bookNumber: number) => {
    try {
      // Create FormData
      const formData = new FormData();
      formData.append('file', file);
      
      // Update the thumbnail to show loading state
      setSeriesThumbnails(prev => 
        prev.map((thumbnail, i) => 
          thumbnail.bookNumber === bookNumber ? { 
            ...thumbnail, 
            isLoading: true,
            errorMessage: undefined,
            successMessage: undefined,
            uploadProgress: 0
          } : thumbnail
        )
      );
      
      // Use XMLHttpRequest for progress tracking
      const xhr = new XMLHttpRequest();
      
      // Track upload progress
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          
          // Update progress in both states
          setSeriesBookPdfs(prev => 
            prev.map((pdf) => 
              pdf.bookNumber === bookNumber ? { ...pdf, uploadProgress: progress } : pdf
            )
          );
          
          setSeriesThumbnails(prev => 
            prev.map((thumbnail) => 
              thumbnail.bookNumber === bookNumber ? { ...thumbnail, uploadProgress: progress } : thumbnail
            )
          );
        }
      });
      
      // Handle completion
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          // Success
          try {
            const response = JSON.parse(xhr.responseText);
            
            if (response.success && response.fileData && response.fileData.url) {
              // Update PDF URL in both states
              setSeriesBookPdfs(prev => 
                prev.map((pdf) => 
                  pdf.bookNumber === bookNumber ? { 
                    ...pdf, 
                    isUploading: false,
                    pdfUrl: response.fileData.url 
                  } : pdf
                )
              );
              
              setSeriesThumbnails(prev => 
                prev.map((thumbnail) => 
                  thumbnail.bookNumber === bookNumber ? { 
                    ...thumbnail, 
                    isLoading: false,
                    successMessage: 'Upload successful!',
                    pdfUrl: response.fileData.url
                  } : thumbnail
                )
              );
              
              // Show success notification
              showNotification('success', `File for book ${getFormattedSeriesNumber(bookNumber)} uploaded successfully!`);
            } else {
              handleUploadError(bookNumber, 'Upload failed: Invalid response from server');
            }
          } catch (parseError) {
            handleUploadError(bookNumber, 'Upload failed: Could not parse server response');
          }
        } else {
          // HTTP error
          handleUploadError(bookNumber, `Upload failed with status ${xhr.status}`);
        }
      });
      
      // Handle network errors
      xhr.addEventListener('error', () => {
        handleUploadError(bookNumber, 'Network error during upload');
      });
      
      // Handle aborted uploads
      xhr.addEventListener('abort', () => {
        handleUploadError(bookNumber, 'Upload was aborted');
      });
      
      // Open and send the request
      xhr.open('POST', '/api/admin/upload', true);
      xhr.send(formData);
      
    } catch (error) {
      handleUploadError(bookNumber, 'Error preparing upload');
      console.error('Error uploading file:', error);
    }
  };

  // Helper function to handle upload errors
  const handleUploadError = (bookNumber: number, errorMessage: string) => {
    setSeriesBookPdfs(prev => 
      prev.map((pdf) => 
        pdf.bookNumber === bookNumber ? { ...pdf, isUploading: false } : pdf
      )
    );
    
    setSeriesThumbnails(prev => 
      prev.map((thumbnail) => 
        thumbnail.bookNumber === bookNumber ? { 
          ...thumbnail, 
          isLoading: false,
          errorMessage: errorMessage
        } : thumbnail
      )
    );
    
    showNotification('error', `Upload failed for book ${getFormattedSeriesNumber(bookNumber)}: ${errorMessage}`);
  };

  // GSAP animations
  useEffect(() => {
    gsap.fromTo(
      ".form-card",
      { y: 20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.6, ease: "power2.out" }
    );

    gsap.fromTo(
      ".form-field",
      { x: -20, opacity: 0 },
      { x: 0, opacity: 1, stagger: 0.1, duration: 0.4, delay: 0.3, ease: "power2.out" }
    );
  }, []);
  
  // Animation for series toggle
  useEffect(() => {
    if (isSeries) {
      gsap.fromTo(
        ".series-fields",
        { height: 0, opacity: 0 },
        { height: "auto", opacity: 1, duration: 0.5, ease: "power2.out" }
      );
      gsap.fromTo(
        ".series-thumbnail-section",
        { height: 0, opacity: 0 },
        { height: "auto", opacity: 1, duration: 0.5, ease: "power2.out", delay: 0.1 }
      );
      gsap.fromTo(
        ".series-pdf-section",
        { height: 0, opacity: 0 },
        { height: "auto", opacity: 1, duration: 0.5, ease: "power2.out", delay: 0.2 }
      );
    } else {
      gsap.set(".series-fields, .series-thumbnail-section, .series-pdf-section", { height: 0, opacity: 0 });
    }
  }, [isSeries]);

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

  // Generate book series preview - update to respect different names mode
  const generateSeriesPreview = (): string[] => {
    const preview: string[] = [];
    if (useDifferentNames) {
      // For different names, show actual names if provided
      const maxDisplay = 5; // Show at most 5 items in preview
      const total = getTotalBooksInSeries();
      
      // Show first few items
      for (let i = 0; i < Math.min(3, total); i++) {
        const bookIndex = i;
        const book = seriesThumbnails[bookIndex];
        const bookName = book?.customName?.trim() 
          ? book.customName 
          : `Book ${getFormattedSeriesNumber(book?.bookNumber || (seriesStart + i))}`;
        preview.push(bookName);
      }
      
      // If more than maxDisplay items, show ellipsis
      if (total > maxDisplay && total > 3) {
        preview.push("...");
      }
      
      // Show last item if there are more than 3 items
      if (total > 3) {
        const lastBookIndex = seriesThumbnails.length - 1;
        const lastBook = seriesThumbnails[lastBookIndex];
        const lastBookName = lastBook?.customName?.trim()
          ? lastBook.customName
          : `Book ${getFormattedSeriesNumber(lastBook?.bookNumber || seriesEnd)}`;
        
        if (preview.length < maxDisplay || !preview.includes(lastBookName)) {
          preview.push(lastBookName);
        }
      }
    } else {
      // Original logic for base name
      if (!seriesBaseName) return preview;
      
      const maxDisplay = 5; // Show at most 5 items in preview
      const total = getTotalBooksInSeries();
      
      // Show first few items
      for (let i = seriesStart; i < seriesStart + Math.min(3, total); i++) {
        preview.push(`${seriesBaseName} ${getFormattedSeriesNumber(i)}`);
      }
      
      // If more than maxDisplay items, show ellipsis
      if (total > maxDisplay && total > 3) { // ensure ellipsis is only added if there are actually more items
        preview.push("...");
      }
      
      // Show last item if there are more than 3 items and it's different from the already added ones
      if (total > 3) {
         if (preview.length < maxDisplay || !preview.includes(`${seriesBaseName} ${getFormattedSeriesNumber(seriesEnd)}`)){
           preview.push(`${seriesBaseName} ${getFormattedSeriesNumber(seriesEnd)}`);
         }
      }
    }
    
    return preview.slice(0, 5); // Ensure we don't exceed maxDisplay
  };
  
  // Get count of total books in series
  const getTotalBooksInSeries = (): number => {
    return Math.max(0, seriesEnd - seriesStart + 1);
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
    
    // No notification needed for this UI interaction
  };

  // Validate form including checking publication date based on format
  const validateForm = () => {
    const errors: {
      bookName?: string;
      authors?: string;
      thumbnailUrl?: string;
      publicationDate?: string;
      seriesStart?: string;
      seriesEnd?: string;
      seriesThumbnails?: string;
      bookPdf?: string; // For single book PDF error
      seriesBookPdfs?: string; // For series PDF errors
      summary?: string; // Add this for summary field errors
      seriesBookNames?: string; // Add this for custom book name errors
      metadataUrl?: string;
    } = {};
    
    // Validate authors
    if (authors.length === 0 || authors.some(author => !author.name.trim())) {
      errors.authors = "Please add at least one author with a name";
    }
    
    if (!isSeries) {
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
    } else {
      // Series validation
      if (!seriesBaseName.trim()) {
        errors.bookName = "Series base name is required";
      }
      
      if (seriesStart < 1) {
        errors.seriesStart = "Series start must be at least 1";
      }
      
      if (seriesEnd < seriesStart) {
        errors.seriesEnd = "Series end must be greater than or equal to series start";
      }
      
      // Check if all thumbnails have URLs
      const missingThumbnails = seriesThumbnails.filter(t => !t.url.trim());
      if (missingThumbnails.length > 0) {
        errors.seriesThumbnails = `Missing thumbnail URLs for ${missingThumbnails.length} book(s)`;
      }
      
      // Check if all books have publication dates
      const missingDates = seriesThumbnails.filter(t => !t.publicationDate.trim());
      if (missingDates.length > 0) {
        errors.publicationDate = `Missing publication dates for ${missingDates.length} book(s)`;
      }
      
      // Check if all books have custom names when using different names
      if (useDifferentNames) {
        const missingNames = seriesThumbnails.filter(t => !t.customName?.trim());
        if (missingNames.length > 0) {
          errors.seriesBookNames = `Missing custom names for ${missingNames.length} book(s)`;
        }
      }
      
      // Check if all books have PDFs (either file or URL)
      const missingPdfs = seriesThumbnails.filter(t => {
        const pdfData = seriesBookPdfs.find(p => p.bookNumber === t.bookNumber);
        return !pdfData?.file && !pdfData?.pdfUrl;
      });
      
      if (missingPdfs.length > 0) {
        errors.seriesBookPdfs = `Missing PDF files for ${missingPdfs.length} book(s)`;
      }
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
      
      // Common fields for both single book and series
      for (const author of authors) {
        formData.append('authors', author.name);
      }
      
      // Add isSeries flag
      formData.append('isSeries', isSeries.toString());
      
      if (!isSeries) {
        // Single book mode
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
      } else {
        // Series mode
        formData.append('seriesName', seriesBaseName);
        formData.append('seriesStart', seriesStart.toString());
        formData.append('seriesEnd', seriesEnd.toString());
        formData.append('useDifferentNames', useDifferentNames.toString());
        
        // Add each book's information
        for (let i = 0; i < seriesThumbnails.length; i++) {
          const book = seriesThumbnails[i];
          const pdfData = seriesBookPdfs.find(p => p.bookNumber === book.bookNumber);
          
          // Use the already uploaded PDF URL if available
          if (pdfData?.pdfUrl) {
            formData.append(`pdfUrl_${book.bookNumber}`, pdfData.pdfUrl);
          }
          // Otherwise, attach the PDF file directly if we have one
          else if (pdfData?.file) {
            formData.append(`pdf_${book.bookNumber}`, pdfData.file);
          }
          
          // Add seriesName (base name) for all books in the series
          formData.append(`seriesName_${book.bookNumber}`, seriesBaseName);
          
          // Add custom book name if we're using different names
          if (useDifferentNames && book.customName) {
            formData.append(`bookName_${book.bookNumber}`, book.customName);
          }
          
          // Always include the position in series
          formData.append(`positionInSeries_${book.bookNumber}`, book.bookNumber.toString());
          
          formData.append(`thumbnail_${book.bookNumber}`, book.url);
          formData.append(`publicationDate_${book.bookNumber}`, book.publicationDate);
          formData.append(`isYearOnly_${book.bookNumber}`, book.isYearOnly.toString());
          formData.append(`summary_${book.bookNumber}`, book.summary || '');
        }
      }
      
      // Simulate server response for now
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      showNotification('success', isSeries ? 'Book series added successfully!' : 'Book added successfully!');
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

  // Update the handleApproveBook function to check publication date format based on isYearOnly
  const handleApproveBook = async (bookNumber: number) => {
    // Find the book in our series
    const bookIndex = seriesThumbnails.findIndex(t => t.bookNumber === bookNumber);
    if (bookIndex === -1) {
      alert(`Book ${bookNumber} not found in the series`);
      return;
    }
    
    // Find the PDF for this book
    const pdfIndex = seriesBookPdfs.findIndex(p => p.bookNumber === bookNumber);
    if (pdfIndex === -1 || !seriesBookPdfs[pdfIndex].file) {
      alert(`No PDF file selected for book ${seriesBaseName} ${getFormattedSeriesNumber(bookNumber)}. Please select a PDF file first.`);
      return;
    }
    
    const pdfFile = seriesBookPdfs[pdfIndex].file;
    
    // Check if the PDF is already uploaded
    if (seriesBookPdfs[pdfIndex].pdfUrl) {
      // PDF is already uploaded, just mark it as approved
      setApprovedBooks(prev => 
        prev.map(book => 
          book.bookNumber === bookNumber ? { ...book, isApproved: true } : book
        )
      );
      
      showNotification('success', `Book ${seriesBaseName} ${getFormattedSeriesNumber(bookNumber)} was approved!`);
      
      // Open in a new tab to test URL
      window.open(seriesBookPdfs[pdfIndex].pdfUrl, '_blank');
      return;
    }
    
    // If not already uploaded, start the upload process
    try {
      // Show progress message
      showNotification('info', `Uploading PDF for book ${seriesBaseName} ${getFormattedSeriesNumber(bookNumber)}. Please wait...`);
      
      // Start the upload
      uploadFileWithProgress(pdfFile, pdfIndex, bookNumber);
      
      // The upload progress and completion will be handled by the uploadFileWithProgress function
      // which will update the UI accordingly
    } catch (error) {
      console.error('Error during book approval:', error);
      showNotification('error', `An error occurred while approving book ${seriesBaseName} ${getFormattedSeriesNumber(bookNumber)}. Please try again.`);
    }
  };

  // Add function to update summary for a specific book in the series
  const updateSeriesBookSummary = (index: number, summaryText: string) => {
    setSeriesThumbnails(prev => 
      prev.map((thumbnail, i) => 
        i === index ? { ...thumbnail, summary: summaryText } : thumbnail
      )
    );
  };

  // Add function to update custom name for a specific book in the series
  const updateSeriesBookName = (index: number, name: string) => {
    setSeriesThumbnails(prev => 
      prev.map((thumbnail, i) => 
        i === index ? { ...thumbnail, customName: name } : thumbnail
      )
    );
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
      
      // Set success message based on the data received
      if ('seriesTitle' in data) {
        setMetadataSuccess(`Series "${data.seriesTitle}" data imported successfully${data.books ? ` with ${data.books.length} books` : ''}!`);
      } else {
        setMetadataSuccess(`Book "${data.title}" data imported successfully!`);
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
  const populateFormFields = (data: ScrapedSeriesData | ScrapedBookData) => {
    // Populate different fields based on whether we're in series or single book mode
    if (isSeries) {
      // Check if it's series data
      if ('seriesTitle' in data) {
        // If it's a series, populate the series name
        if (data.seriesTitle) {
          setSeriesBaseName(data.seriesTitle);
        }
        
        // If there are multiple books in the scraped data and we're in different names mode
        if (data.books && Array.isArray(data.books)) {
          // Update the series start and end if needed
          if (data.books.length > 0) {
            // Adjust series start and end to match the number of books
            setSeriesStart(1); // Assuming books are 1-indexed
            setSeriesEnd(data.books.length);
            
            // Update thumbnail information for each book
            const newThumbnails: SeriesThumbnail[] = data.books.map((book, index) => {
              const bookNumber = index + 1;
              return {
                bookNumber,
                url: book.imageUrl || '',
                customName: book.title || `${seriesBaseName} ${getFormattedSeriesNumber(bookNumber)}`,
                publicationDate: book.publicationDate || '',
                isYearOnly: true,
                summary: book.summary || '',
                preview: '',
                metadataUrl: book.imageUrl || '',
                isLoading: false,
                errorMessage: undefined,
                successMessage: undefined,
                publisher: book.publisher || '',
                genres: book.genres || [],
                ratings: book.ratings,
                averageRating: book.averageRating,
                numberOfPages: book.numberOfPages,
                characters: book.characters,
                language: book.language,
                uploadProgress: undefined, // Add upload progress
                pdfUrl: undefined, // Add PDF URL
              };
            });
            
            setSeriesThumbnails(newThumbnails);
            
            // If authors are available from the first book, apply to all books in the series
            if (data.books[0]?.authors && data.books[0].authors.length > 0) {
              const newAuthors = data.books[0].authors.map((authorName: string) => ({ name: authorName }));
              setAuthors(newAuthors);
            }
          }
        }
      }
    } else {
      // Single book mode - check if it has title and not seriesTitle
      if ('title' in data && !('seriesTitle' in data)) {
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
          const newAuthors = data.authors.map((authorName: string) => ({ name: authorName }));
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

  // Add a function to update the metadata URL for a specific book in the series
  const updateSeriesBookMetadataUrl = (index: number, url: string) => {
    setSeriesThumbnails(prev => 
      prev.map((thumbnail, i) => 
        i === index ? { ...thumbnail, metadataUrl: url } : thumbnail
      )
    );
  };

  // Add a new implementation of fetchBookMetadata
  const fetchBookMetadata = async (index: number, url: string): Promise<void> => {
    if (!url.trim()) {
      // Update the specific book's error state
      setSeriesThumbnails(prev => {
        const updated = [...prev];
        if (index >= 0 && index < updated.length) {
          updated[index] = { 
            ...updated[index], 
            errorMessage: "Please enter a URL",
            successMessage: undefined
          };
        }
        return updated;
      });
      showNotification('error', "Please enter a URL");
      return;
    }
    
    const urlType = detectUrlType(url);
    if (!urlType) {
      // Update the specific book's error state
      setSeriesThumbnails(prev => {
        const updated = [...prev];
        if (index >= 0 && index < updated.length) {
          updated[index] = { 
            ...updated[index], 
            errorMessage: "Unsupported URL type. Currently supports: Fandom, Goodreads",
            successMessage: undefined
          };
        }
        return updated;
      });
      showNotification('error', "Unsupported URL type. Currently supports: Fandom, Goodreads");
      return;
    }
    
    // Set loading state
    setSeriesThumbnails(prev => {
      const updated = [...prev];
      if (index >= 0 && index < updated.length) {
        updated[index] = { 
          ...updated[index], 
          isLoading: true,
          errorMessage: undefined,
          successMessage: undefined
        };
      }
      return updated;
    });
    
    try {
      // Call the metadata API
      const response = await fetch('/api/scrapers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch metadata: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Check if we got valid data
      if (!data) {
        throw new Error('No data returned from the metadata API');
      }
      
      // Handle the response based on whether it's a series or single book
      if ('title' in data && !('seriesTitle' in data)) {
        // Apply the changes to just this book
        setSeriesThumbnails(prev => {
          const updated = [...prev];
          
          if (index >= 0 && index < updated.length) {
            // Update book details with scraped data
            updated[index] = {
              ...updated[index],
              customName: data.title || updated[index].customName,
              url: data.imageUrl || updated[index].url,
              preview: data.imageUrl || updated[index].preview,
              summary: data.summary || updated[index].summary,
              publicationDate: data.publicationDate || updated[index].publicationDate,
              publisher: data.publisher || updated[index].publisher,
              genres: data.genres || updated[index].genres,
              ratings: data.ratings || updated[index].ratings,
              averageRating: data.averageRating || updated[index].averageRating,
              numberOfPages: data.numberOfPages || updated[index].numberOfPages,
              characters: data.characters || updated[index].characters,
              language: data.language || updated[index].language,
              successMessage: `"${data.title}" data imported successfully!`,
              errorMessage: undefined,
              isLoading: false
            };
          }
          
          return updated;
        });

        // If this is the first book and it has authors, update the global authors
        if (index === 0 && data.authors && Array.isArray(data.authors) && data.authors.length > 0) {
          const newAuthors = data.authors.map((authorName: string) => ({ id: crypto.randomUUID(), name: authorName }));
          setAuthors(newAuthors);
        }

        showNotification('success', `Book "${data.title}" data imported successfully!`);
      } else if ('seriesTitle' in data && data.books && Array.isArray(data.books)) {
        // If it returns series data, extract just this book's data based on index
        const bookData = data.books[index];
        if (bookData) {
          setSeriesThumbnails(prev => {
            const updated = [...prev];
            
            if (index >= 0 && index < updated.length) {
              // Update book details with scraped data
              updated[index] = {
                ...updated[index],
                customName: bookData.title || updated[index].customName,
                url: bookData.imageUrl || updated[index].url,
                preview: bookData.imageUrl || updated[index].preview,
                summary: bookData.summary || updated[index].summary,
                publicationDate: bookData.publicationDate || updated[index].publicationDate,
                publisher: bookData.publisher || updated[index].publisher,
                genres: bookData.genres || updated[index].genres,
                ratings: bookData.ratings || updated[index].ratings,
                averageRating: bookData.averageRating || updated[index].averageRating,
                numberOfPages: bookData.numberOfPages || updated[index].numberOfPages,
                characters: bookData.characters || updated[index].characters,
                language: bookData.language || updated[index].language,
                successMessage: `"${bookData.title}" data imported successfully!`,
                errorMessage: undefined,
                isLoading: false
              };
            }
            
            return updated;
          });

          showNotification('success', `Book "${bookData.title}" data imported successfully!`);
        }
      }
    } catch (error) {
      console.error('Error fetching metadata for book:', error);
      
      // Set error message for this book
      setSeriesThumbnails(prev => {
        const updated = [...prev];
        if (index >= 0 && index < updated.length) {
          updated[index] = { 
            ...updated[index], 
            isLoading: false,
            errorMessage: error instanceof Error ? error.message : 'Failed to fetch metadata',
            successMessage: undefined
          };
        }
        return updated;
      });
      
      showNotification('error', error instanceof Error ? error.message : 'Failed to fetch metadata');
    }
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
            {isSeries ? "Add Book Series" : "Add New Book"}
          </h1>
        </div>
      </div>

      {/* Replace the existing Files.vc integration status box with a simpler indicator */}
      <div className="mb-4 flex items-center">
        <span className="text-sm font-medium mr-2">Files.vc:</span>
        {/* Dynamic indicator based on whether the API key exists in settings */}
        {settings?.filesVcApiKey ? (
          <span className="inline-flex items-center">
            <span className="h-3 w-3 rounded-full bg-green-500 mr-1" aria-hidden="true"></span>
            <span className="text-sm text-green-700">Active</span>
          </span>
        ) : (
          <span className="inline-flex items-center">
            <span className="h-3 w-3 rounded-full bg-red-500 mr-1" aria-hidden="true"></span>
            <span className="text-sm text-red-700">Not configured</span>
          </span>
        )}
      </div>

      <div className="form-card rounded-lg bg-white p-6 shadow-md">
        {/* Toggle between single book and series mode */}
        <div className="mb-6 flex items-center justify-end">
          <div className="relative flex items-center">
            <div className="mr-3 text-sm font-medium text-gray-900">Single Book</div>
            <div className="relative inline-block h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-gray-200 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              onClick={() => setIsSeries(!isSeries)}
            >
              <span
                className={`${
                  isSeries ? "translate-x-5" : "translate-x-0"
                } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
              />
            </div>
            <div className="ml-3 text-sm font-medium text-gray-900">Book Series</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Book Name / Series Name */}
          {!isSeries || isSeries ? (
            <div className="form-field">
              <label htmlFor="bookName" className="mb-1 block text-sm font-medium text-gray-700">
                <div className="flex items-center">
                  {isSeries ? (
                    <>
                      <FiLayers className="mr-2 h-4 w-4 text-gray-500" />
                      Series Name <span className="text-red-500">*</span>
                    </>
                  ) : (
                    <>
                      <FiBook className="mr-2 h-4 w-4 text-gray-500" />
                      Book Name <span className="text-red-500">*</span>
                    </>
                  )}
                </div>
              </label>
              {!isSeries ? (
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
              ) : (
                <input
                  type="text"
                  id="seriesBaseName"
                  className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
                    formErrors.bookName ? "border-red-500" : ""
                  }`}
                  placeholder="Enter series name (e.g. 'Harry Potter')"
                  value={seriesBaseName}
                  onChange={(e) => setSeriesBaseName(e.target.value)}
                />
              )}
              {formErrors.bookName && (
                <p className="mt-1 text-sm text-red-500">{formErrors.bookName}</p>
              )}
            </div>
          ) : null}

          {/* Series Configuration - only shown when in series mode */}          
          {isSeries && (
            <div className="space-y-8">
              {/* Step 1: Basic Series Configuration */}
              <div className="series-fields rounded-lg border border-gray-100 bg-white p-6 shadow-sm">
                <div className="border-b border-gray-100 pb-4 mb-6">
                  <div className="flex items-center">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 mr-3">
                      <span className="font-medium">1</span>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900">Series Information</h3>
                  </div>
                  <p className="mt-1 text-sm text-gray-500 ml-11">Define the basic information about your book series</p>
                </div>
                
                {/* Series Range - Simplified to Total Books */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Total Books in Series</label>
                  <div className="mt-3">
                    <div className="group">
                      <div className="mt-1 relative rounded-md">
                        <input
                          type="number"
                          id="seriesEnd"
                          min={1}
                          className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
                            formErrors.seriesEnd ? "border-red-500" : ""
                          }`}
                          value={seriesEnd}
                          onChange={(e) => {
                            setSeriesStart(1);
                            setSeriesEnd(parseInt(e.target.value) || 1);
                          }}
                        />
                        {formErrors.seriesEnd && (
                          <p className="mt-1 text-sm text-red-500">{formErrors.seriesEnd}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 2: Book Details */}
              <div className="series-thumbnail-section rounded-lg border border-gray-100 bg-white p-6 shadow-sm">
                <div className="border-b border-gray-100 pb-4 mb-6">
                  <div className="flex items-center">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 mr-3">
                      <span className="font-medium">2</span>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900">Book Details</h3>
                  </div>
                  <p className="mt-1 text-sm text-gray-500 ml-11">Add details for each book in the series</p>
                </div>

                {/* Book Tabs Interface */}
                <div className="mt-4">
                  <div className="mb-4 border-b border-gray-200">
                    <ul className="flex flex-wrap -mb-px text-sm font-medium text-center overflow-x-auto" role="tablist">
                      {Array.from({ length: getTotalBooksInSeries() }, (_, i) => {
                        const bookNumber = seriesStart + i;
                        const isActive = i === activeBookTab;
                        return (
                          <li className="mr-2" key={bookNumber} role="presentation">
                            <button
                              type="button"
                              onClick={() => setActiveBookTab(i)}
                              className={`inline-block p-3 rounded-t-lg border-b-2 ${
                                isActive 
                                  ? 'border-indigo-600 text-indigo-600' 
                                  : 'border-transparent hover:text-gray-600 hover:border-gray-300'
                              }`}
                              role="tab"
                            >
                              Book {bookNumber}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  {/* Individual Book Forms - For simplicity, just showing the first book by default */}
                  {Array.from({ length: getTotalBooksInSeries() }, (_, i) => {
                    const bookNumber = seriesStart + i;
                    const thumbnailIndex = seriesThumbnails.findIndex(t => t.bookNumber === bookNumber);
                    const pdfIndex = seriesBookPdfs.findIndex(p => p.bookNumber === bookNumber);
                    const isApproved = approvedBooks.find(book => book.bookNumber === bookNumber)?.isApproved || false;
                    
                    // Only show the active tab
                    if (i !== activeBookTab) return null;
                    
                    return (
                      <div key={bookNumber} className="p-4 bg-gray-50 rounded-md">
                        <div className="flex flex-col md:flex-row md:gap-8">
                          <div className="mb-6 md:mb-0 md:w-1/3">
                            <h4 className="font-medium text-lg mb-2">
                              {useDifferentNames 
                                ? `Book ${getFormattedSeriesNumber(bookNumber)}`
                                : `${seriesBaseName || "Book"} ${getFormattedSeriesNumber(bookNumber)}`
                              }
                            </h4>
                            
                            {/* Book Name Field (always shown, but required only when using different names) */}
                            <div className="mb-4">
                              <label className="block text-sm font-medium text-gray-600 mb-1">
                                Book Name {useDifferentNames && <span className="text-red-500">*</span>}
                              </label>
                              <input
                                type="text"
                                className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
                                  formErrors.seriesBookNames && thumbnailIndex !== -1 && useDifferentNames && !seriesThumbnails[thumbnailIndex].customName?.trim() ? "border-red-500" : ""
                                }`}
                                placeholder="Enter name for this book"
                                value={thumbnailIndex !== -1 ? seriesThumbnails[thumbnailIndex].customName || "" : ""}
                                onChange={(e) => updateSeriesBookName(thumbnailIndex, e.target.value)}
                                required={useDifferentNames}
                              />
                            </div>
                            
                            {/* Thumbnail Input */}
                            <div className="mb-4">
                              <label className="block text-sm font-medium text-gray-600 mb-1">
                                Thumbnail URL
                              </label>
                              <input
                                type="text"
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                placeholder="https://example.com/thumbnail.jpg"
                                value={thumbnailIndex !== -1 ? seriesThumbnails[thumbnailIndex].url : ""}
                                onChange={(e) => updateSeriesThumbnailPreview(thumbnailIndex, e.target.value)}
                              />
                              
                              {thumbnailIndex !== -1 && seriesThumbnails[thumbnailIndex].preview && (
                                <div className="mt-2">
                                  <div className="h-24 w-18 overflow-hidden rounded border border-gray-200">
                                    <img 
                                      src={seriesThumbnails[thumbnailIndex].preview} 
                                      alt={`Preview for book ${bookNumber}`}
                                      className="h-full w-full object-cover"
                                      onError={(e) => {
                                        e.currentTarget.src = "https://via.placeholder.com/120x160?text=No Preview"; 
                                      }}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                            
                            {/* PDF Input */}
                            <div className="mb-4">
                              <label className="block text-sm font-medium text-gray-600 mb-1">
                                PDF File
                              </label>
                              <input
                                type="file"
                                accept=".pdf"
                                onChange={(e) => handleSeriesBookPdfChange(pdfIndex, e)}
                                className="block w-full text-sm text-gray-500 file:mr-4 file:rounded-md file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100"
                                disabled={pdfIndex !== -1 && seriesBookPdfs[pdfIndex].isUploading}
                              />
                              {pdfIndex !== -1 && seriesBookPdfs[pdfIndex].file && (
                                <p className="mt-1 text-xs text-gray-600">
                                  Selected: {seriesBookPdfs[pdfIndex].file.name} ({(seriesBookPdfs[pdfIndex].file.size / 1024 / 1024).toFixed(2)} MB)
                                </p>
                              )}
                              
                              {/* Add progress bar for uploading files */}
                              {pdfIndex !== -1 && seriesBookPdfs[pdfIndex].isUploading && (
                                <div className="mt-2">
                                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                                    <div 
                                      className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-in-out" 
                                      style={{ width: `${seriesBookPdfs[pdfIndex].uploadProgress || 0}%` }}
                                    ></div>
                                  </div>
                                  <p className="text-xs text-gray-600 mt-1">
                                    Uploading... {seriesBookPdfs[pdfIndex].uploadProgress || 0}%
                                  </p>
                                </div>
                              )}
                              
                              {/* Show success message when upload is complete */}
                              {pdfIndex !== -1 && seriesBookPdfs[pdfIndex].pdfUrl && (
                                <div className="mt-2 flex items-center text-sm text-green-600">
                                  <FiCheckCircle className="mr-1" />
                                  <span>Upload complete!</span>
                                  <button 
                                    type="button"
                                    onClick={() => window.open(seriesBookPdfs[pdfIndex].pdfUrl, '_blank')}
                                    className="ml-2 text-blue-600 hover:text-blue-800 underline text-xs"
                                  >
                                    View file
                                  </button>
                                </div>
                              )}
                              
                              {/* Show error message if upload failed */}
                              {pdfIndex !== -1 && 
                               seriesThumbnails.find(t => t.bookNumber === seriesBookPdfs[pdfIndex].bookNumber)?.errorMessage && (
                                <div className="mt-2 text-sm text-red-600">
                                  <span>
                                    {seriesThumbnails.find(t => t.bookNumber === seriesBookPdfs[pdfIndex].bookNumber)?.errorMessage}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <div className="md:w-2/3">
                            {/* Metadata URL for this specific book */}
                            <div className="mb-4">
                              <label className="block text-sm font-medium text-gray-600 mb-1">
                                <div className="flex items-center">
                                  <FiLink className="mr-2 h-4 w-4 text-gray-500" />
                                  Book Metadata URL
                                </div>
                              </label>
                              <div className="flex rounded-md shadow-sm">
                                <input
                                  type="text"
                                  className="block w-full flex-1 rounded-none rounded-l-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                  placeholder="Paste a Goodreads URL for this specific book"
                                  value={thumbnailIndex !== -1 ? seriesThumbnails[thumbnailIndex].metadataUrl || "" : ""}
                                  onChange={(e) => updateSeriesBookMetadataUrl(thumbnailIndex, e.target.value)}
                                />
                                <button
                                  type="button"
                                  onClick={() => thumbnailIndex !== -1 && fetchBookMetadata(thumbnailIndex, seriesThumbnails[thumbnailIndex].metadataUrl || "")}
                                  disabled={thumbnailIndex === -1 || !seriesThumbnails[thumbnailIndex].metadataUrl || seriesThumbnails[thumbnailIndex].isLoading}
                                  className="inline-flex items-center rounded-r-md border border-l-0 border-gray-300 bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-75 disabled:cursor-not-allowed"
                                >
                                  {thumbnailIndex !== -1 && seriesThumbnails[thumbnailIndex].isLoading ? (
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
                              {thumbnailIndex !== -1 && seriesThumbnails[thumbnailIndex].errorMessage && (
                                <p className="mt-1 text-sm text-red-500">{seriesThumbnails[thumbnailIndex].errorMessage}</p>
                              )}
                              {thumbnailIndex !== -1 && seriesThumbnails[thumbnailIndex].successMessage && (
                                <p className="mt-1 text-sm text-green-600 flex items-center">
                                  <FiCheckCircle className="mr-1 h-4 w-4" /> {seriesThumbnails[thumbnailIndex].successMessage}
                                </p>
                              )}
                              {thumbnailIndex !== -1 && !seriesThumbnails[thumbnailIndex].errorMessage && !seriesThumbnails[thumbnailIndex].successMessage && (
                                <p className="mt-1 text-xs text-gray-500">
                                  Paste a Goodreads URL to auto-fill book details
                                </p>
                              )}
                            </div>
                            
                            {/* Book Summary */}
                            <div className="mb-4">
                              <label className="block text-sm font-medium text-gray-600 mb-1">
                                Book Summary
                              </label>
                              <textarea
                                rows={3}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                placeholder="Enter a brief summary of the book..."
                                value={thumbnailIndex !== -1 ? seriesThumbnails[thumbnailIndex].summary || "" : ""}
                                onChange={(e) => updateSeriesBookSummary(thumbnailIndex, e.target.value)}
                              />
                            </div>
                            
                            {/* New fields */}
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                              {/* Publication Date */}
                              <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-600 mb-1">
                                  Publication Date
                                </label>
                                <div className="flex items-center">
                                  {thumbnailIndex !== -1 && seriesThumbnails[thumbnailIndex]?.isYearOnly ? (
                                    <input
                                      type="text"
                                      placeholder="YYYY"
                                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                      value={thumbnailIndex !== -1 ? seriesThumbnails[thumbnailIndex].publicationDate || "" : ""}
                                      onChange={(e) => updateSeriesBookPublicationDate(thumbnailIndex, e.target.value)}
                                      pattern="\d{4}"
                                    />
                                  ) : (
                                    <input
                                      type="date"
                                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                      value={thumbnailIndex !== -1 ? seriesThumbnails[thumbnailIndex].publicationDate || "" : ""}
                                      onChange={(e) => updateSeriesBookPublicationDate(thumbnailIndex, e.target.value)}
                                    />
                                  )}
                                </div>
                              </div>
                              
                              {/* Publisher */}
                              <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-600 mb-1">
                                  Publisher
                                </label>
                                <input
                                  type="text"
                                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                  placeholder="Publisher name"
                                  value={thumbnailIndex !== -1 ? seriesThumbnails[thumbnailIndex].publisher || "" : ""}
                                  onChange={(e) => {
                                    if (thumbnailIndex !== -1) {
                                      setSeriesThumbnails(prev => 
                                        prev.map((thumbnail, i) => 
                                          i === thumbnailIndex ? { ...thumbnail, publisher: e.target.value } : thumbnail
                                        )
                                      );
                                    }
                                  }}
                                />
                              </div>
                              
                              {/* Number of Pages */}
                              <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-600 mb-1">
                                  Number of Pages
                                </label>
                                <input
                                  type="number"
                                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                  placeholder="Number of pages"
                                  value={thumbnailIndex !== -1 && seriesThumbnails[thumbnailIndex].numberOfPages ? seriesThumbnails[thumbnailIndex].numberOfPages : ""}
                                  onChange={(e) => {
                                    if (thumbnailIndex !== -1) {
                                      setSeriesThumbnails(prev => 
                                        prev.map((thumbnail, i) => 
                                          i === thumbnailIndex ? { ...thumbnail, numberOfPages: parseInt(e.target.value) || undefined } : thumbnail
                                        )
                                      );
                                    }
                                  }}
                                />
                              </div>
                              
                              {/* Ratings */}
                              <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-600 mb-1">
                                  Ratings
                                </label>
                                <input
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  max="5"
                                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                  placeholder="Rating (0-5)"
                                  value={thumbnailIndex !== -1 && seriesThumbnails[thumbnailIndex].ratings ? seriesThumbnails[thumbnailIndex].ratings : ""}
                                  onChange={(e) => {
                                    if (thumbnailIndex !== -1) {
                                      setSeriesThumbnails(prev => 
                                        prev.map((thumbnail, i) => 
                                          i === thumbnailIndex ? { ...thumbnail, ratings: parseFloat(e.target.value) || undefined } : thumbnail
                                        )
                                      );
                                    }
                                  }}
                                />
                              </div>
                              
                              {/* Average Rating */}
                              <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-600 mb-1">
                                  Average Rating
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max="5"
                                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                  placeholder="Average Rating (0-5)"
                                  value={thumbnailIndex !== -1 && seriesThumbnails[thumbnailIndex].averageRating ? seriesThumbnails[thumbnailIndex].averageRating : ""}
                                  onChange={(e) => {
                                    if (thumbnailIndex !== -1) {
                                      setSeriesThumbnails(prev => 
                                        prev.map((thumbnail, i) => 
                                          i === thumbnailIndex ? { ...thumbnail, averageRating: parseFloat(e.target.value) || undefined } : thumbnail
                                        )
                                      );
                                    }
                                  }}
                                />
                              </div>
                              
                              {/* Language */}
                              <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-600 mb-1">
                                  Language
                                </label>
                                <input
                                  type="text"
                                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                  placeholder="Language"
                                  value={thumbnailIndex !== -1 ? seriesThumbnails[thumbnailIndex].language || "" : ""}
                                  onChange={(e) => {
                                    if (thumbnailIndex !== -1) {
                                      setSeriesThumbnails(prev => 
                                        prev.map((thumbnail, i) => 
                                          i === thumbnailIndex ? { ...thumbnail, language: e.target.value } : thumbnail
                                        )
                                      );
                                    }
                                  }}
                                />
                              </div>
                              
                              {/* Genres - as a comma-separated input */}
                              <div className="mb-4 col-span-2">
                                <label className="block text-sm font-medium text-gray-600 mb-1">
                                  Genres (comma separated)
                                </label>
                                <input
                                  type="text"
                                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                  placeholder="Fantasy, Adventure, Mystery"
                                  value={thumbnailIndex !== -1 && seriesThumbnails[thumbnailIndex].genres ? seriesThumbnails[thumbnailIndex].genres.join(", ") : ""}
                                  onChange={(e) => {
                                    if (thumbnailIndex !== -1) {
                                      const genresArray = e.target.value.split(",").map(genre => genre.trim()).filter(genre => genre !== "");
                                      setSeriesThumbnails(prev => 
                                        prev.map((thumbnail, i) => 
                                          i === thumbnailIndex ? { ...thumbnail, genres: genresArray } : thumbnail
                                        )
                                      );
                                    }
                                  }}
                                />
                              </div>
                              
                              {/* Characters - as a comma-separated input */}
                              <div className="mb-4 col-span-2">
                                <label className="block text-sm font-medium text-gray-600 mb-1">
                                  Characters (comma separated)
                                </label>
                                <input
                                  type="text"
                                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                  placeholder="Harry Potter, Hermione Granger, Ron Weasley"
                                  value={thumbnailIndex !== -1 && seriesThumbnails[thumbnailIndex].characters ? seriesThumbnails[thumbnailIndex].characters.join(", ") : ""}
                                  onChange={(e) => {
                                    if (thumbnailIndex !== -1) {
                                      const charactersArray = e.target.value.split(",").map(character => character.trim()).filter(character => character !== "");
                                      setSeriesThumbnails(prev => 
                                        prev.map((thumbnail, i) => 
                                          i === thumbnailIndex ? { ...thumbnail, characters: charactersArray } : thumbnail
                                        )
                                      );
                                    }
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="mt-4 text-center text-sm text-gray-500">
                          <p>This is book {i + 1} of {getTotalBooksInSeries()}. Use the tabs above to edit other books.</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Single Book Thumbnail Input */}
          {!isSeries && (
            <div className="form-field">
              <label htmlFor="thumbnailUrl" className="mb-1 block text-sm font-medium text-gray-700">
                <div className="flex items-center">
                  <FiImage className="mr-2 h-4 w-4 text-gray-500" />
                  Thumbnail URL
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
                  <div className="h-16 w-12 overflow-hidden rounded border border-gray-200">
                    <img 
                      src={thumbnailPreview} 
                      alt="Thumbnail preview" 
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = "https://via.placeholder.com/120x160?text=Error"; 
                      }}
                    />
                  </div>
                  <span className="ml-2 text-xs text-gray-500">Thumbnail preview</span>
                </div>
              )}
            </div>
          )}

          {/* Book PDF File Input for single book */}
          {!isSeries && (
            <div className="form-field">
              <label htmlFor="bookPdf" className="mb-1 block text-sm font-medium text-gray-700">
                <div className="flex items-center">
                  <FiFileText className="mr-2 h-4 w-4 text-gray-500" />
                  Book File (PDF) <span className="ml-1 text-xs text-gray-500">(Will be uploaded to Files.vc)</span>
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
          )}

          {/* Remove or hide the global publication date when in series mode */}
          {!isSeries && (
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
          )}

          {/* Book Summary Field for single book after the PDF input */}
          {!isSeries && (
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
          )}

          {/* Additional fields for single book */}
          {!isSeries && (
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
          )}

          {/* Metadata URL Input for Series */}
          {isSeries && (
            <div className="form-field mb-6">
              {/* Remove this entire section */}
            </div>
          )}

          {/* Metadata URL Input for Single Books */}
          {!isSeries && (
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
          )}

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
              {isSubmitting ? "Saving..." : isSeries ? `Save Series (${getTotalBooksInSeries()} ${getTotalBooksInSeries() === 1 ? "book" : "books"})` : "Save Book"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 