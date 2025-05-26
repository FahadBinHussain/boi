"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FiPlus, FiX, FiArrowLeft, FiSave, FiImage, FiLink, FiCalendar, FiUsers, FiBook, FiLayers } from "react-icons/fi";
import gsap from "gsap";

interface Author {
  id: string;
  name: string;
}

interface HostUrl {
  id: string;
  label: string;
  url: string;
}

// Add an interface for series thumbnails
interface SeriesThumbnail {
  bookNumber: number;
  url: string;
  preview: string;
}

export default function AddNewBook() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSeries, setIsSeries] = useState(false);
  const [formErrors, setFormErrors] = useState<{
    bookName?: string;
    authors?: string;
    thumbnailUrl?: string;
    hostUrls?: string;
    publicationDate?: string;
    seriesStart?: string;
    seriesEnd?: string;
    seriesThumbnails?: string; // For general series thumbnail errors
  }>({});

  // Form state for single book
  const [bookName, setBookName] = useState("");
  const [authors, setAuthors] = useState<Author[]>([{ id: crypto.randomUUID(), name: "" }]);
  const [thumbnailUrl, setThumbnailUrl] = useState(""); // Used for single book mode
  const [hostUrls, setHostUrls] = useState<HostUrl[]>([
    { id: crypto.randomUUID(), label: "Default", url: "" }
  ]);
  const [publicationDate, setPublicationDate] = useState("");
  const [thumbnailPreview, setThumbnailPreview] = useState(""); // Used for single book mode
  
  // Additional form state for series
  const [seriesBaseName, setSeriesBaseName] = useState("");
  const [seriesStart, setSeriesStart] = useState(1);
  const [seriesEnd, setSeriesEnd] = useState(10);
  const [numberingSystem, setNumberingSystem] = useState<"western" | "bengali">("western");
  const [seriesThumbnails, setSeriesThumbnails] = useState<SeriesThumbnail[]>([]); // For series mode

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

  // Initialize or update seriesThumbnails when series range or mode changes
  useEffect(() => {
    if (isSeries) {
      const newThumbnails: SeriesThumbnail[] = [];
      const currentTotalBooks = Math.max(0, seriesEnd - seriesStart + 1);
      for (let i = 0; i < currentTotalBooks; i++) {
        const bookNumber = seriesStart + i;
        // Try to preserve existing URL if book number matches
        const existingThumbnail = seriesThumbnails.find(st => st.bookNumber === bookNumber);
        newThumbnails.push({
          bookNumber: bookNumber,
          url: existingThumbnail?.url || "",
          preview: existingThumbnail?.preview || "",
        });
      }
      setSeriesThumbnails(newThumbnails);
    } else {
      setSeriesThumbnails([]); // Clear when not in series mode
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

  // Add host URL field
  const addHostUrl = () => {
    setHostUrls([...hostUrls, { id: crypto.randomUUID(), label: "", url: "" }]);
  };

  // Remove host URL field
  const removeHostUrl = (id: string) => {
    if (hostUrls.length > 1) {
      setHostUrls(hostUrls.filter(host => host.id !== id));
    }
  };

  // Update host URL field
  const updateHostUrl = (id: string, field: 'label' | 'url', value: string) => {
    setHostUrls(hostUrls.map(host => 
      host.id === id ? { ...host, [field]: value } : host
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

  // Validate form
  const validateForm = () => {
    const errors: {
      bookName?: string;
      authors?: string;
      thumbnailUrl?: string; // For single book thumbnail error
      hostUrls?: string;
      publicationDate?: string;
      seriesStart?: string;
      seriesEnd?: string;
      seriesThumbnails?: string; // For general series thumbnail errors
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
      // Example: Make all series thumbnails required
      // const hasEmptySeriesThumbnail = seriesThumbnails.some(thumb => !thumb.url.trim());
      // if (hasEmptySeriesThumbnail && getTotalBooksInSeries() > 0) {
      //   errors.seriesThumbnails = "A thumbnail URL is required for each book in the series.";
      // }
    }

    const hasEmptyAuthor = authors.some(author => !author.name.trim());
    if (hasEmptyAuthor) {
      errors.authors = "All author fields must be filled";
    }

    const hasEmptyHostUrl = hostUrls.some(host => !host.url.trim() || !host.label.trim());
    if (hasEmptyHostUrl) {
      errors.hostUrls = "All host URL fields must be filled";
    }

    const hasInvalidUrl = hostUrls.some(host => host.url.trim() !== "" && !urlPattern.test(host.url));
    if (hasInvalidUrl) {
      errors.hostUrls = "Please enter valid URLs for all host entries";
    }

    if (!publicationDate) {
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
      if (!isSeries) {
        // Single book submission
        const bookData = {
          name: bookName,
          authors: authors.map(author => author.name),
          thumbnailUrl, // Single thumbnail
          hostUrls: hostUrls.map(host => ({ label: host.label, url: host.url })),
          publicationDate
        };

        console.log("Book data to be submitted:", bookData);
      } else {
        // Series submission
        const seriesData = {
          baseName: seriesBaseName,
          startNumber: seriesStart,
          endNumber: seriesEnd,
          totalBooks: getTotalBooksInSeries(),
          authors: authors.map(author => author.name),
          hostUrls: hostUrls.map(host => ({ label: host.label, url: host.url })),
          publicationDate,
          numberingSystem,
          thumbnails: seriesThumbnails.map(st => ({ bookNumber: st.bookNumber, url: st.url })) // Pass structured thumbnails
        };
        
        console.log("Series data to be submitted:", seriesData);
        
        const books = [];
        for (let i = 0; i < getTotalBooksInSeries(); i++) {
          const currentBookNumber = seriesStart + i;
          const formattedNumber = getFormattedSeriesNumber(currentBookNumber);
          const bookThumbnail = seriesThumbnails.find(st => st.bookNumber === currentBookNumber)?.url || "";

          const book = {
            name: `${seriesBaseName} ${formattedNumber}`,
            authors: authors.map(author => author.name),
            thumbnailUrl: bookThumbnail, // Assign individual thumbnail
            hostUrls: hostUrls.map(host => ({ label: host.label, url: host.url })),
            publicationDate,
            seriesInfo: {
              seriesName: seriesBaseName,
              numberInSeries: currentBookNumber
            }
          };
          books.push(book);
        }
        
        console.log(`Created ${books.length} books in series`);
        // In a real app, you would send this to your API
      }
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Redirect to books page after successful submission
      router.push("/admin/books");
    } catch (error) {
      console.error("Error submitting form:", error);
    } finally {
      setIsSubmitting(false);
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

          {/* Thumbnail URL - Conditional Rendering */}
          {!isSeries ? (
            // Single Book Thumbnail Input
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
          ) : (
            // Series Thumbnails Input
            <div className="form-field series-thumbnail-section space-y-4 overflow-hidden rounded-md bg-gray-50 p-4">
              <h3 className="text-base font-medium text-gray-900">
                Series Thumbnails ({getTotalBooksInSeries()} {getTotalBooksInSeries() === 1 ? "book" : "books"})
              </h3>
              {getTotalBooksInSeries() > 0 ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {seriesThumbnails.map((thumbnail, index) => (
                    <div key={thumbnail.bookNumber} className="form-field space-y-1">
                       <label htmlFor={`seriesThumbnail-${thumbnail.bookNumber}`} className="block text-xs font-medium text-gray-600">
                        {`Thumbnail for: ${seriesBaseName || "Book"} ${getFormattedSeriesNumber(thumbnail.bookNumber)}`}
                      </label>
                      <input
                        type="text"
                        id={`seriesThumbnail-${thumbnail.bookNumber}`}
                        className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
                          formErrors.seriesThumbnails && thumbnail.url.trim() !== "" && !/^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([\/\w .-]*)*\/?$/.test(thumbnail.url) ? "border-red-500" : ""
                        }`}
                        placeholder={`URL for ${seriesBaseName || "Book"} ${getFormattedSeriesNumber(thumbnail.bookNumber)}`}
                        value={thumbnail.url}
                        onChange={(e) => updateSeriesThumbnailPreview(index, e.target.value)}
                      />
                      {thumbnail.preview && (
                        <div className="mt-1 flex items-center">
                          <div className="h-16 w-12 overflow-hidden rounded border border-gray-200">
                            <img 
                              src={thumbnail.preview} 
                              alt={`Preview for book ${thumbnail.bookNumber}`}
                              className="h-full w-full object-cover"
                              onError={(e) => {
                                e.currentTarget.src = "https://via.placeholder.com/120x160?text=No Preview"; 
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  Adjust the series range (Start and End Number) to add thumbnails. Minimum 1 book required.
                </p>
              )}
              {formErrors.seriesThumbnails && (
                <p className="mt-1 text-sm text-red-500">{formErrors.seriesThumbnails}</p>
              )}
            </div>
          )}

          {/* Host URLs */}
          <div className="form-field">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              <div className="flex items-center">
                <FiLink className="mr-2 h-4 w-4 text-gray-500" />
                Host URLs <span className="text-red-500">*</span>
                {isSeries && <span className="ml-1 text-xs text-gray-500">(applied to all books in series)</span>}
              </div>
            </label>
            <div className="space-y-3">
              {hostUrls.map((host, index) => (
                <div key={host.id} className="grid grid-cols-12 gap-2">
                  <div className="col-span-3">
                    <input
                      type="text"
                      className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
                        formErrors.hostUrls ? "border-red-500" : ""
                      }`}
                      placeholder="Label (e.g. 'Google Drive')"
                      value={host.label}
                      onChange={(e) => updateHostUrl(host.id, 'label', e.target.value)}
                    />
                  </div>
                  <div className="col-span-8">
                    <input
                      type="text"
                      className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
                        formErrors.hostUrls ? "border-red-500" : ""
                      }`}
                      placeholder="https://example.com/download"
                      value={host.url}
                      onChange={(e) => updateHostUrl(host.id, 'url', e.target.value)}
                    />
                  </div>
                  <div className="col-span-1">
                    <button
                      type="button"
                      onClick={() => removeHostUrl(host.id)}
                      disabled={hostUrls.length === 1}
                      className={`inline-flex h-full w-full items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-500 ${
                        hostUrls.length === 1 ? "cursor-not-allowed opacity-50" : ""
                      }`}
                    >
                      <FiX className="h-5 w-5" />
                      <span className="sr-only">Remove host URL</span>
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addHostUrl}
                className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
              >
                <FiPlus className="mr-2 h-4 w-4" />
                Add Another Host URL
              </button>
            </div>
            {formErrors.hostUrls && (
              <p className="mt-1 text-sm text-red-500">{formErrors.hostUrls}</p>
            )}
          </div>

          {/* Publication Date */}
          <div className="form-field">
            <label htmlFor="publicationDate" className="mb-1 block text-sm font-medium text-gray-700">
              <div className="flex items-center">
                <FiCalendar className="mr-2 h-4 w-4 text-gray-500" />
                Publication Date <span className="text-red-500">*</span>
                {isSeries && <span className="ml-1 text-xs text-gray-500">(applied to all books in series)</span>}
              </div>
            </label>
            <input
              type="date"
              id="publicationDate"
              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
                formErrors.publicationDate ? "border-red-500" : ""
              }`}
              value={publicationDate}
              onChange={(e) => setPublicationDate(e.target.value)}
            />
            {formErrors.publicationDate && (
              <p className="mt-1 text-sm text-red-500">{formErrors.publicationDate}</p>
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
              {isSubmitting ? "Saving..." : isSeries ? `Save Series (${getTotalBooksInSeries()} ${getTotalBooksInSeries() === 1 ? "book" : "books"})` : "Save Book"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 