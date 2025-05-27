"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FiPlus, FiX, FiArrowLeft, FiSave, FiImage, FiCalendar, FiUsers, FiBook, FiLayers, FiFileText, FiCheckCircle } from "react-icons/fi";
import gsap from "gsap";
import { useUserSettings } from "@/hooks/useUserSettings";
import { useNotification } from "@/contexts/NotificationContext";

interface Author {
  id: string;
  name: string;
}

// Add an interface for series thumbnails
interface SeriesThumbnail {
  bookNumber: number;
  url: string;
  preview: string;
  publicationDate: string; // Add publication date for each book
  isYearOnly: boolean; // Track if the date is year-only format
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

export default function AddNewBook() {
  const router = useRouter();
  const { settings, isLoading: isSettingsLoading, syncStatus, lastSyncMessage } = useUserSettings();
  const { showNotification } = useNotification();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSeries, setIsSeries] = useState(false);
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
  }>({});

  // Form state for single book
  const [bookName, setBookName] = useState("");
  const [authors, setAuthors] = useState<Author[]>([{ id: crypto.randomUUID(), name: "" }]);
  const [thumbnailUrl, setThumbnailUrl] = useState(""); // Used for single book mode
  const [publicationDate, setPublicationDate] = useState("");
  const [thumbnailPreview, setThumbnailPreview] = useState(""); // Used for single book mode
  const [bookPdfFile, setBookPdfFile] = useState<File | null>(null); // For single book PDF
  
  // Use user's preferred date format from settings or default to year-only
  const [isYearOnly, setIsYearOnly] = useState(true);

  // Additional form state for series
  const [seriesBaseName, setSeriesBaseName] = useState("");
  const [seriesStart, setSeriesStart] = useState(1);
  const [seriesEnd, setSeriesEnd] = useState(10);
  const [numberingSystem, setNumberingSystem] = useState<"western" | "bengali">("western");
  const [seriesThumbnails, setSeriesThumbnails] = useState<SeriesThumbnail[]>([]); // For series mode
  const [seriesBookPdfs, setSeriesBookPdfs] = useState<SeriesBookPdf[]>([]); // For series PDFs

  // Add state for approved books
  const [approvedBooks, setApprovedBooks] = useState<ApprovedBook[]>([]);

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
  const convertToBengaliNumeral = (num: number): string => {
    const bengaliNumerals = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return num.toString().split('').map(digit => bengaliNumerals[parseInt(digit)]).join('');
  };
  
  const getFormattedSeriesNumber = (num: number): string => {
    return numberingSystem === "bengali" ? convertToBengaliNumeral(num) : num.toString();
  };

  // Update thumbnail preview when URL changes (single book mode)
  useEffect(() => {
    if (!isSeries && thumbnailUrl && thumbnailUrl.trim() !== "") {
      setThumbnailPreview(thumbnailUrl);
    } else if (!isSeries) {
      setThumbnailPreview("");
    }
  }, [thumbnailUrl, isSeries]);

  // Update the useEffect that initializes seriesThumbnails to include publicationDate and isYearOnly
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

  // Generate book series preview
  const generateSeriesPreview = (): string[] => {
    const preview: string[] = [];
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
    
    return preview.slice(0, maxDisplay); // Ensure we don't exceed maxDisplay
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
      if (!seriesBaseName.trim()) {
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
      return;
    }

    setIsSubmitting(true);

    try {
      let bookData: any;
      let uploadResults: (UploadResult | SeriesUploadResult)[] = [];

      if (!isSeries) {
        // Single book submission
        bookData = {
          name: bookName,
          authors: authors.map(author => author.name),
          thumbnailUrl, // Single thumbnail
          publicationDate,
        };

        console.log("Book data to be submitted:", bookData);
        
        // Upload PDF if provided
        if (bookPdfFile) {
          const uploadResult = await uploadPdfToFilesVc(bookPdfFile);
          if (uploadResult) {
            bookData.pdfUrl = uploadResult.fileData.url;
            uploadResults.push(uploadResult);
          }
        }
      } else {
        // Series submission
        const seriesData = {
          baseName: seriesBaseName,
          startNumber: seriesStart,
          endNumber: seriesEnd,
          totalBooks: getTotalBooksInSeries(),
          authors: authors.map(author => author.name),
          numberingSystem,
          thumbnails: seriesThumbnails.map(st => ({ 
            bookNumber: st.bookNumber, 
            url: st.url,
            publicationDate: st.publicationDate // Include publication date for each book
          })),
        };
        
        console.log("Series data to be submitted:", seriesData);
        
        const books = [];
        
        // Get list of approved book numbers
        const approvedBookNumbers = approvedBooks
          .filter(book => book.isApproved)
          .map(book => book.bookNumber);
        
        if (approvedBookNumbers.length === 0) {
          alert("Please approve at least one book before submission.");
          setIsSubmitting(false);
          return;
        }
        
        // Upload PDFs for approved books only
        const seriesPdfUploads: Promise<SeriesUploadResult | null>[] = [];
        for (const pdfItem of seriesBookPdfs) {
          // Only upload PDFs for approved books
          if (pdfItem.file && approvedBookNumbers.includes(pdfItem.bookNumber)) {
            const uploadPromise = uploadPdfToFilesVc(pdfItem.file)
              .then(result => {
                if (result) {
                  return {
                    bookNumber: pdfItem.bookNumber,
                    fileData: result.fileData
                  } as SeriesUploadResult;
                }
                return null;
              });
            seriesPdfUploads.push(uploadPromise);
          }
        }
        
        if (seriesPdfUploads.length > 0) {
          const results = await Promise.all(seriesPdfUploads);
          uploadResults = results.filter(Boolean) as SeriesUploadResult[];
        }
        
        // Create book objects with uploaded PDF URLs (only for approved books)
        for (let i = 0; i < getTotalBooksInSeries(); i++) {
          const currentBookNumber = seriesStart + i;
          
          // Skip non-approved books
          if (!approvedBookNumbers.includes(currentBookNumber)) {
            continue;
          }
          
          const formattedNumber = getFormattedSeriesNumber(currentBookNumber);
          const bookThumbnail = seriesThumbnails.find(st => st.bookNumber === currentBookNumber);
          
          // Find the upload result for this book number
          const bookUploadResult = (uploadResults as SeriesUploadResult[]).find(result => result.bookNumber === currentBookNumber);
          const pdfUrl = bookUploadResult ? bookUploadResult.fileData.url : null;

          const book = {
            name: `${seriesBaseName} ${formattedNumber}`,
            authors: authors.map(author => author.name),
            thumbnailUrl: bookThumbnail?.url || "",
            publicationDate: bookThumbnail?.publicationDate || "", // Use the book-specific publication date
            seriesInfo: {
              seriesName: seriesBaseName,
              numberInSeries: currentBookNumber
            },
            pdfUrl: pdfUrl,
            isApproved: true
          };
          books.push(book);
        }
        
        console.log(`Created ${books.length} approved books in series with ${uploadResults.length} PDF uploads`);
        bookData = { seriesBooks: books };
      }

      // Here you would send the book data to your book database
      console.log("Final book data to be saved:", bookData);
      console.log("Files.vc uploads successful:", uploadResults.length);
      
      // Redirect to books page after successful submission
      router.push("/admin/books");
    } catch (error) {
      console.error("Error submitting form:", error);
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

      <div className="mb-4 rounded-md bg-green-50 p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <FiCheckCircle className="h-5 w-5 text-green-400" aria-hidden="true" />
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-green-800">Files.vc Integration Active</h3>
            <div className="mt-2 text-sm text-green-700">
              <p>
                Files.vc API key is configured. PDF files will be uploaded to Files.vc.
              </p>
            </div>
          </div>
        </div>
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
          <div className="form-field">
            <label htmlFor="bookName" className="mb-1 block text-sm font-medium text-gray-700">
              <div className="flex items-center">
                {isSeries ? (
                  <>
                    <FiLayers className="mr-2 h-4 w-4 text-gray-500" />
                    Series Base Name <span className="text-red-500">*</span>
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
                placeholder="Enter series base name (e.g. 'মাসুদ রানা')"
                value={seriesBaseName}
                onChange={(e) => setSeriesBaseName(e.target.value)}
              />
            )}
            {formErrors.bookName && (
              <p className="mt-1 text-sm text-red-500">{formErrors.bookName}</p>
            )}
          </div>

          {/* Series Configuration - only shown when in series mode */}          
          {isSeries && (
            <div className="series-fields space-y-4 overflow-hidden rounded-md bg-gray-50 p-4">
              <h3 className="text-base font-medium text-gray-900">Series Configuration</h3>
              
              {/* Numbering System Selection */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Numbering System</label>
                <div className="flex space-x-4">
                  <div className="flex items-center">
                    <input
                      id="western"
                      type="radio"
                      name="numberingSystem"
                      checked={numberingSystem === "western"}
                      onChange={() => setNumberingSystem("western")}
                      className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor="western" className="ml-2 block text-sm text-gray-700">
                      Western (1, 2, 3...)
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      id="bengali"
                      type="radio"
                      name="numberingSystem"
                      checked={numberingSystem === "bengali"}
                      onChange={() => setNumberingSystem("bengali")}
                      className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor="bengali" className="ml-2 block text-sm text-gray-700">
                      Bengali (১, ২, ৩...)
                    </label>
                  </div>
                </div>
              </div>
              
              {/* Series Range */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="seriesStart" className="block text-sm font-medium text-gray-700">
                    Start Number
                  </label>
                  <input
                    type="number"
                    id="seriesStart"
                    min="1"
                    className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
                      formErrors.seriesStart ? "border-red-500" : ""
                    }`}
                    value={seriesStart}
                    onChange={(e) => setSeriesStart(parseInt(e.target.value) || 1)}
                  />
                  {formErrors.seriesStart && (
                    <p className="mt-1 text-sm text-red-500">{formErrors.seriesStart}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="seriesEnd" className="block text-sm font-medium text-gray-700">
                    End Number
                  </label>
                  <input
                    type="number"
                    id="seriesEnd"
                    min={seriesStart} // Ensure end is not less than start
                    className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
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
              
              {/* Series Preview */}
              {seriesBaseName && getTotalBooksInSeries() > 0 && (
                <div className="rounded-md bg-gray-100 p-3">
                  <p className="mb-2 text-sm font-medium text-gray-700">Series Preview:</p>
                  <div className="space-y-1 text-sm">
                    {generateSeriesPreview().map((title, index) => (
                      <div key={index} className="text-gray-600">{title}</div>
                    ))}
                  </div>
                  <div className="mt-3 text-sm font-medium text-gray-700">
                    Total books to create: {getTotalBooksInSeries()}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Authors */}
          <div className="form-field">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              <div className="flex items-center">
                <FiUsers className="mr-2 h-4 w-4 text-gray-500" />
                Authors <span className="text-red-500">*</span>
              </div>
            </label>
            <div className="space-y-3">
              {authors.map((author, index) => (
                <div key={author.id} className="flex items-center space-x-2">
                  <input
                    type="text"
                    className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
                      formErrors.authors ? "border-red-500" : ""
                    }`}
                    placeholder={`Author ${index + 1}`}
                    value={author.name}
                    onChange={(e) => updateAuthor(author.id, e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => removeAuthor(author.id)}
                    disabled={authors.length === 1}
                    className={`inline-flex items-center rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500 ${
                      authors.length === 1 ? "cursor-not-allowed opacity-50" : ""
                    }`}
                  >
                    <FiX className="h-5 w-5" />
                    <span className="sr-only">Remove author</span>
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addAuthor}
                className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
              >
                <FiPlus className="mr-2 h-4 w-4" />
                Add Another Author
              </button>
            </div>
            {formErrors.authors && (
              <p className="mt-1 text-sm text-red-500">{formErrors.authors}</p>
            )}
          </div>

          {/* Combined Series Books Section - replaces separate thumbnails and PDFs sections */}
          {isSeries && (
            <div className="form-field space-y-4 overflow-hidden rounded-md bg-gray-50 p-4">
              <h3 className="text-base font-medium text-gray-900">
                Series Books ({getTotalBooksInSeries()} {getTotalBooksInSeries() === 1 ? "book" : "books"})
              </h3>
              {getTotalBooksInSeries() > 0 ? (
                <div className="space-y-6">
                  {Array.from({ length: getTotalBooksInSeries() }, (_, i) => {
                    const bookNumber = seriesStart + i;
                    const thumbnailIndex = seriesThumbnails.findIndex(t => t.bookNumber === bookNumber);
                    const pdfIndex = seriesBookPdfs.findIndex(p => p.bookNumber === bookNumber);
                    const isApproved = approvedBooks.find(book => book.bookNumber === bookNumber)?.isApproved || false;
                    
                    return (
                      <div 
                        key={bookNumber} 
                        className={`rounded-md border p-4 ${isApproved ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <h4 className="text-sm font-medium text-gray-900">
                            {seriesBaseName || "Book"} {getFormattedSeriesNumber(bookNumber)}
                          </h4>
                          <span className={`flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${isApproved ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {isApproved ? <FiCheckCircle className="mr-1 h-3 w-3"/> : <FiFileText className="mr-1 h-3 w-3"/>}
                            {isApproved ? 'Approved' : 'Pending'}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          {/* Thumbnail Input */}
                          <div className="space-y-2">
                            <label htmlFor={`seriesThumbnail-${bookNumber}`} className="block text-xs font-medium text-gray-600">
                              Thumbnail URL
                            </label>
                            <input
                              type="text"
                              id={`seriesThumbnail-${bookNumber}`}
                              className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
                                formErrors.seriesThumbnails && thumbnailIndex !== -1 && seriesThumbnails[thumbnailIndex].url.trim() !== "" && 
                                !/^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([\/\w .-]*)*\/?$/.test(seriesThumbnails[thumbnailIndex].url) ? "border-red-500" : ""
                              }`}
                              placeholder="https://example.com/thumbnail.jpg"
                              value={thumbnailIndex !== -1 ? seriesThumbnails[thumbnailIndex].url : ""}
                              onChange={(e) => updateSeriesThumbnailPreview(thumbnailIndex, e.target.value)}
                            />
                            
                            {thumbnailIndex !== -1 && seriesThumbnails[thumbnailIndex].preview && (
                              <div className="mt-1 flex items-center">
                                <div className="h-16 w-12 overflow-hidden rounded border border-gray-200">
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
                          <div className="space-y-2">
                            <label htmlFor={`seriesPdf-${bookNumber}`} className="block text-xs font-medium text-gray-600">
                              PDF File <span className="text-xs text-gray-500">(Will be uploaded to Files.vc)</span>
                            </label>
                            <input
                              type="file"
                              id={`seriesPdf-${bookNumber}`}
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
                        
                        {/* Publication Date for this specific book */}
                        <div className="mt-4">
                          <label htmlFor={`publicationDate-${bookNumber}`} className="flex items-center justify-between text-xs font-medium text-gray-600">
                            <span>Publication Date <span className="text-red-500">*</span></span>
                            <div className="flex items-center">
                              <span className="mr-2 text-xs">
                                {thumbnailIndex !== -1 && seriesThumbnails[thumbnailIndex]?.isYearOnly 
                                  ? "Year only" 
                                  : "Full date"}
                              </span>
                              <button 
                                type="button"
                                onClick={() => thumbnailIndex !== -1 && toggleSeriesBookYearOnly(thumbnailIndex)}
                                className="text-xs text-indigo-600 hover:text-indigo-800"
                              >
                                Toggle format
                              </button>
                            </div>
                          </label>
                          {thumbnailIndex !== -1 && seriesThumbnails[thumbnailIndex]?.isYearOnly ? (
                            <input
                              type="text"
                              id={`publicationDate-${bookNumber}`}
                              placeholder="YYYY"
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                              value={thumbnailIndex !== -1 ? seriesThumbnails[thumbnailIndex].publicationDate || "" : ""}
                              onChange={(e) => updateSeriesBookPublicationDate(thumbnailIndex, e.target.value)}
                              pattern="\d{4}"
                            />
                          ) : (
                            <input
                              type="date"
                              id={`publicationDate-${bookNumber}`}
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                              value={thumbnailIndex !== -1 ? seriesThumbnails[thumbnailIndex].publicationDate || "" : ""}
                              onChange={(e) => updateSeriesBookPublicationDate(thumbnailIndex, e.target.value)}
                            />
                          )}
                        </div>
                        
                        {/* Approve Button */}
                        <div className="mt-4 flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleApproveBook(bookNumber)}
                            className={`inline-flex items-center rounded-md px-3 py-2 text-sm font-medium ${
                              isApproved 
                                ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                                : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                            }`}
                          >
                            <FiCheckCircle className="mr-2 h-4 w-4" />
                            {isApproved ? 'Approved' : 'Approve Book'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  Adjust the series range to add books. Minimum 1 book required.
                </p>
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