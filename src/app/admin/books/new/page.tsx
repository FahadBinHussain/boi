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
}

// Interface for book PDF files in a series
interface SeriesBookPdf {
  bookNumber: number;
  file: File | null;
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
    seriesThumbnails?: string;
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
        });
        newBookPdfs.push({
          bookNumber: bookNumber,
          file: existingPdf?.file || null,
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
    if (event.target.files && event.target.files[0]) {
      setBookPdfFile(event.target.files[0]);
    } else {
      setBookPdfFile(null);
    }
  };

  const handleSeriesBookPdfChange = (index: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files && event.target.files[0] ? event.target.files[0] : null;
    setSeriesBookPdfs(prev => 
      prev.map((pdfItem, i) => 
        i === index ? { ...pdfItem, file } : pdfItem
      )
    );
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
      thumbnailUrl?: string; // For single book thumbnail error
      publicationDate?: string;
      seriesStart?: string;
      seriesEnd?: string;
      seriesThumbnails?: string; // For general series thumbnail errors
      bookPdf?: string; // For single book PDF error
      seriesBookPdfs?: string; // For series PDF errors
      seriesBookNames?: string;
    } = {};

    const urlPattern = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([\/\w .-]*)*\/?$/;

    if (!isSeries) {
      // Single book validation
      if (!bookName.trim()) {
        errors.bookName = "Book name is required";
      }
      if (thumbnailUrl && !urlPattern.test(thumbnailUrl)) { // Validate single thumbnail URL
        errors.thumbnailUrl = "Please enter a valid URL for the thumbnail";
      }
      // Validate single book publication date
      if (!publicationDate) {
        errors.publicationDate = "Publication date is required";
      }
    } else {
      // Series validation
      if (!useDifferentNames && !seriesBaseName.trim()) {
        errors.bookName = "Series base name is required";
      }
      
      if (seriesStart <= 0) {
        errors.seriesStart = "Start number must be greater than 0.";
      }
      if (seriesStart > seriesEnd) {
        errors.seriesStart = "Start number must be less than or equal to end number";
      }
      
      if (seriesEnd - seriesStart + 1 > 1000) { // Max 1000 books
        errors.seriesEnd = "Series is too large. Please create series with at most 1000 books at once.";
      }

      // Validate series thumbnails
      const invalidThumbnails = seriesThumbnails.some(thumb => thumb.url.trim() !== "" && !urlPattern.test(thumb.url));
      if (invalidThumbnails) {
        errors.seriesThumbnails = "One or more thumbnail URLs are invalid. Please check each one.";
      }
      
      // Validate publication dates in series
      const invalidDates = seriesThumbnails.some(thumb => {
        if (!thumb.publicationDate) return true;
        
        if (thumb.isYearOnly) {
          return !/^\d{4}$/.test(thumb.publicationDate);
        } else {
          return !/^\d{4}-\d{2}-\d{2}$/.test(thumb.publicationDate);
        }
      });
      
      if (invalidDates) {
        errors.seriesThumbnails = "One or more publication dates are invalid. Please check each one.";
      }

      // Validate custom book names when in different names mode
      if (useDifferentNames) {
        const emptyNames = seriesThumbnails.some(thumb => !thumb.customName?.trim());
        if (emptyNames) {
          errors.seriesBookNames = "All book names are required";
        }
      }
    }

    const hasEmptyAuthor = authors.some(author => !author.name.trim());
    if (hasEmptyAuthor) {
      errors.authors = "All author fields must be filled";
    }

    if (!isSeries && !publicationDate) {
      errors.publicationDate = "Publication date is required";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      console.error("Form validation failed");
      showNotification('error', 'Please fix the errors in the form before submitting.');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Prepare form data
      const formData = new FormData();
      
      if (isSeries) {
        // Adding series metadata
        formData.append("seriesName", seriesBaseName);
        formData.append("bookCount", getTotalBooksInSeries().toString());
        formData.append("seriesStart", seriesStart.toString());
        formData.append("seriesEnd", seriesEnd.toString());
        formData.append("useDifferentNames", useDifferentNames.toString());
        
        // Add authors information
        formData.append("authorsCount", authors.length.toString());
        authors.forEach((author, index) => {
          formData.append(`author_${index}`, author.name);
        });
        
        // Add each book's information
        for (let i = 0; i < seriesThumbnails.length; i++) {
          const book = seriesThumbnails[i];
          const pdfFile = seriesBookPdfs.find(p => p.bookNumber === book.bookNumber)?.file;
          
          if (pdfFile) {
            formData.append(`pdf_${book.bookNumber}`, pdfFile);
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
      } else {
        // Single book details
        formData.append("bookName", bookName);
        
        // Add authors information
        formData.append("authorsCount", authors.length.toString());
        authors.forEach((author, index) => {
          formData.append(`author_${index}`, author.name);
        });
        
        formData.append("thumbnailUrl", thumbnailUrl);
        formData.append("publicationDate", publicationDate);
        formData.append("isYearOnly", isYearOnly.toString());
        
        // Include summary for single book
        formData.append("summary", summary || '');
        
        if (bookPdfFile) {
          formData.append("pdf", bookPdfFile);
        }
      }
      
      // Add log to see form data before submission
      console.log("Form submission data:");
      for (const [key, value] of formData.entries()) {
        // Don't log the actual PDF file contents
        if (key.startsWith('pdf_') || key === 'pdf') {
          console.log(key, '[PDF File]');
        } else {
          console.log(key, value);
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
    // Find this book's data
    const thumbnail = seriesThumbnails.find(t => t.bookNumber === bookNumber);
    const pdf = seriesBookPdfs.find(p => p.bookNumber === bookNumber);
    
    // Validate this specific book
    let canApprove = true;
    let message = "";
    
    if (!thumbnail?.url) {
      canApprove = false;
      message += "Missing thumbnail URL. ";
    }
    
    if (!pdf?.file) {
      canApprove = false;
      message += "Missing PDF file. ";
    }

    // Check publication date based on format
    if (!thumbnail?.publicationDate) {
      canApprove = false;
      message += "Missing publication date. ";
    } else if (thumbnail.isYearOnly) {
      // For year-only format, validate that it's a valid year (4 digits)
      const yearRegex = /^\d{4}$/;
      if (!yearRegex.test(thumbnail.publicationDate)) {
        canApprove = false;
        message += "Invalid year format (should be YYYY). ";
      }
    } else {
      // For full date format, validate that it's a valid date
      if (!(/^\d{4}-\d{2}-\d{2}$/.test(thumbnail.publicationDate))) {
        canApprove = false;
        message += "Invalid date format (should be YYYY-MM-DD). ";
      }
    }
    
    if (!canApprove) {
      alert(`Cannot approve book ${seriesBaseName} ${getFormattedSeriesNumber(bookNumber)}: ${message}`);
      return;
    }
    
    // If we get here, we know pdf and pdf.file are defined
    const pdfFile = pdf!.file as File;
    
    try {
      // Show progress message
      alert(`Attempting to upload PDF for book ${seriesBaseName} ${getFormattedSeriesNumber(bookNumber)}. Please wait...`);
      
      // Test upload the PDF to files.vc
      const uploadResult = await uploadPdfToFilesVc(pdfFile);
      
      if (!uploadResult) {
        alert(`Failed to upload PDF for book ${seriesBaseName} ${getFormattedSeriesNumber(bookNumber)}. Please try again.`);
        return;
      }
      
      // PDF upload successful, get the URL
      const pdfUrl = uploadResult.fileData.url;
      
      // Check if the URL is valid
      if (!pdfUrl) {
        alert(`Received invalid URL from Files.vc for book ${seriesBaseName} ${getFormattedSeriesNumber(bookNumber)}. Please try again.`);
        return;
      }
      
      // Update approval state
      setApprovedBooks(prev => 
        prev.map(book => 
          book.bookNumber === bookNumber ? { ...book, isApproved: true } : book
        )
      );
      
      // Now try to access the URL to make sure it works
      alert(`Book ${seriesBaseName} ${getFormattedSeriesNumber(bookNumber)} was approved!
      
PDF uploaded successfully to Files.vc
URL: ${pdfUrl}
      
The PDF will be uploaded again during the final form submission.`);

      // Open in a new tab to test URL
      window.open(pdfUrl, '_blank');
      
    } catch (error) {
      console.error('Error during book approval:', error);
      alert(`An error occurred while approving book ${seriesBaseName} ${getFormattedSeriesNumber(bookNumber)}. Please try again.`);
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

  // Function to determine URL type
  const detectUrlType = (url: string): string | null => {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      
      if (hostname.includes('fandom.com') || hostname.endsWith('.fandom.com')) {
        return 'fandom';
      }
      
      // Add more URL type detections as you add more scrapers
      // Example:
      // if (hostname.includes('goodreads.com')) {
      //   return 'goodreads';
      // }
      
      return null; // Unknown URL type
    } catch (error) {
      // Not a valid URL
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
      setScrapingError("Unsupported URL type. Currently supports: Fandom");
      return;
    }
    
    setIsScrapingMetadata(true);
    setScrapingError(null);
    setMetadataSuccess(null);
    
    try {
      // Call the appropriate scraper API endpoint based on URL type
      let apiEndpoint = '';
      
      switch (urlType) {
        case 'fandom':
          apiEndpoint = '/api/scrapers/fandom';
          break;
        // Add cases for other scrapers when available
      }
      
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fandomUrl: url }),
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
                successMessage: undefined
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
            errorMessage: "Unsupported URL type. Currently supports: Fandom",
            successMessage: undefined
          };
        }
        return updated;
      });
      showNotification('error', "Unsupported URL type. Currently supports: Fandom");
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
      // Call the appropriate scraper API endpoint based on URL type
      let apiEndpoint = '';
      
      switch (urlType) {
        case 'fandom':
          apiEndpoint = '/api/scrapers/fandom';
          break;
        // Add cases for other scrapers when available
      }
      
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fandomUrl: url }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to fetch metadata: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Update only this book's data
      if ('title' in data) {
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
              successMessage: `"${data.title}" data imported successfully!`,
              errorMessage: undefined,
              isLoading: false
            };
          }
          
          return updated;
        });

        // If this is the first book and it has authors, update the global authors
        if (index === 0 && data.authors && Array.isArray(data.authors) && data.authors.length > 0) {
          const newAuthors = data.authors.map((authorName: string) => ({ name: authorName }));
          setAuthors(newAuthors);
        }

        showNotification('success', `Book "${data.title}" data imported successfully!`);
      } else if ('seriesTitle' in data && data.books && Array.isArray(data.books) && index < data.books.length) {
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
                
                {/* Series Range */}
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Series Range</label>
                    <p className="text-xs text-gray-500 mt-1">Define the starting and ending numbers for your book series</p>
                    <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="group">
                        <label htmlFor="seriesStart" className="block text-sm font-medium text-gray-700">
                          Start Number
                        </label>
                        <div className="mt-1 relative rounded-md">
                          <input
                            type="number"
                            id="seriesStart"
                            min="1"
                            className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
                              formErrors.seriesStart ? "border-red-500" : ""
                            }`}
                            value={seriesStart}
                            onChange={(e) => setSeriesStart(parseInt(e.target.value) || 1)}
                          />
                          {formErrors.seriesStart && (
                            <p className="mt-1 text-sm text-red-500">{formErrors.seriesStart}</p>
                          )}
                        </div>
                      </div>
                      <div>
                        <label htmlFor="seriesEnd" className="block text-sm font-medium text-gray-700">
                          End Number
                        </label>
                        <div className="mt-1 relative rounded-md">
                          <input
                            type="number"
                            id="seriesEnd"
                            min={seriesStart} // Ensure end is not less than start
                            className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
                              formErrors.seriesEnd ? "border-red-500" : ""
                            }`}
                            value={seriesEnd}
                            onChange={(e) => setSeriesEnd(parseInt(e.target.value) || seriesStart)}
                          />
                          {formErrors.seriesEnd && (
                            <p className="mt-1 text-sm text-red-500">{formErrors.seriesEnd}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Series Naming Mode */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Naming Style</label>
                    <p className="text-xs text-gray-500 mt-1">Choose how to name books in your series</p>
                    <div className="mt-3 flex flex-col gap-4">
                      {/* Option 1: Use same name for all books */}
                      <div className={`flex items-start p-4 border rounded-md ${!useDifferentNames ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200'}`}>
                        <input
                          type="radio"
                          id="consistent-names"
                          checked={!useDifferentNames}
                          onChange={() => setUseDifferentNames(false)}
                          className="h-4 w-4 mt-1 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                        />
                        <div className="ml-3">
                          <label htmlFor="consistent-names" className="font-medium text-gray-800 cursor-pointer">Use consistent series name</label>
                          <p className="text-sm text-gray-600 mt-1">All books will follow the same naming pattern with different numbers</p>
                        </div>
                      </div>
                      
                      {/* Option 2: Use different names for each book */}
                      <div className={`flex items-start p-4 border rounded-md ${useDifferentNames ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200'}`}>
                        <input
                          type="radio"
                          id="different-names"
                          checked={useDifferentNames}
                          onChange={() => setUseDifferentNames(true)}
                          className="h-4 w-4 mt-1 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                        />
                        <div className="ml-3">
                          <label htmlFor="different-names" className="font-medium text-gray-800 cursor-pointer">Use different names for each book</label>
                          <p className="text-sm text-gray-600 mt-1">Each book in the series will have its own unique name</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Series Preview */}
                {getTotalBooksInSeries() > 0 && (
                  <div className="mt-6 rounded-lg bg-indigo-50 p-4 border border-indigo-100">
                    <div className="flex items-start">
                      <div className="flex-shrink-0 pt-0.5">
                        <svg className="h-5 w-5 text-indigo-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-indigo-800">Series Preview</h3>
                        <div className="mt-2 space-y-1 text-sm">
                          {generateSeriesPreview().map((title, index) => (
                            <div key={index} className="text-indigo-700">{title}</div>
                          ))}
                        </div>
                        <div className="mt-2">
                          <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                            {getTotalBooksInSeries()} {getTotalBooksInSeries() === 1 ? "book" : "books"} will be created
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Step 2: Book Details */}
              {getTotalBooksInSeries() > 0 && (
                <div className="series-fields rounded-lg border border-gray-100 bg-white p-6 shadow-sm">
                  <div className="border-b border-gray-100 pb-4 mb-6">
                    <div className="flex items-center">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 mr-3">
                        <span className="font-medium">2</span>
                      </div>
                      <h3 className="text-lg font-medium text-gray-900">Books Details</h3>
                    </div>
                    <p className="mt-1 text-sm text-gray-500 ml-11">Configure details for each book in the series</p>
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
                                />
                                {pdfIndex !== -1 && seriesBookPdfs[pdfIndex].file && (
                                  <p className="mt-1 text-xs text-gray-600">
                                    Selected: {seriesBookPdfs[pdfIndex].file.name} ({(seriesBookPdfs[pdfIndex].file.size / 1024 / 1024).toFixed(2)} MB)
                                  </p>
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
                                    placeholder="Paste a Fandom URL for this specific book"
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
                                    Paste a Fandom URL for this specific book to auto-fill its details
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
                              
                              {/* Publication Date */}
                              <div className="mb-4">
                                <div className="flex items-center justify-between mb-1">
                                  <label className="block text-sm font-medium text-gray-600">
                                    Publication Date <span className="text-red-500">*</span>
                                  </label>
                                  <div className="flex items-center space-x-3">
                                    <div className="flex items-center">
                                      <input
                                        type="radio"
                                        id={`year-only-${bookNumber}`}
                                        checked={thumbnailIndex !== -1 && seriesThumbnails[thumbnailIndex]?.isYearOnly}
                                        onChange={() => thumbnailIndex !== -1 && toggleSeriesBookYearOnly(thumbnailIndex)}
                                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                                      />
                                      <label htmlFor={`year-only-${bookNumber}`} className="ml-2 text-xs text-gray-700">Year only</label>
                                    </div>
                                    <div className="flex items-center">
                                      <input
                                        type="radio"
                                        id={`full-date-${bookNumber}`}
                                        checked={thumbnailIndex !== -1 && !seriesThumbnails[thumbnailIndex]?.isYearOnly}
                                        onChange={() => thumbnailIndex !== -1 && !seriesThumbnails[thumbnailIndex]?.isYearOnly && toggleSeriesBookYearOnly(thumbnailIndex)}
                                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                                      />
                                      <label htmlFor={`full-date-${bookNumber}`} className="ml-2 text-xs text-gray-700">Full date</label>
                                    </div>
                                  </div>
                                </div>
                                
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
                              
                              <div className="mt-4 flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => handleApproveBook(bookNumber)}
                                  className={`inline-flex items-center rounded-md px-4 py-2 text-sm font-medium ${
                                    isApproved 
                                      ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                                      : 'bg-indigo-100 text-indigo-800 hover:bg-indigo-200'
                                  }`}
                                >
                                  <FiCheckCircle className="mr-2 h-4 w-4" />
                                  {isApproved ? 'Approved' : 'Approve Book'}
                                </button>
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
              )}
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
              />
              {bookPdfFile && (
                <p className="mt-1 text-sm text-gray-600">
                  Selected: {bookPdfFile.name} ({(bookPdfFile.size / 1024 / 1024).toFixed(2)} MB)
                </p>
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
                  placeholder="Paste a Fandom URL to auto-fill book details"
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
                <p className="mt-1 text-xs text-gray-500">Paste a URL from Fandom to automatically fill book details.</p>
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