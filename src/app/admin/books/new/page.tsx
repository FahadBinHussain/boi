"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FiPlus, FiX, FiArrowLeft, FiSave, FiImage, FiLink, FiCalendar, FiUsers, FiBook } from "react-icons/fi";
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

export default function AddNewBook() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<{
    bookName?: string;
    authors?: string;
    thumbnailUrl?: string;
    hostUrls?: string;
    publicationDate?: string;
  }>({});

  // Form state
  const [bookName, setBookName] = useState("");
  const [authors, setAuthors] = useState<Author[]>([{ id: crypto.randomUUID(), name: "" }]);
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [hostUrls, setHostUrls] = useState<HostUrl[]>([
    { id: crypto.randomUUID(), label: "Default", url: "" }
  ]);
  const [publicationDate, setPublicationDate] = useState("");
  const [thumbnailPreview, setThumbnailPreview] = useState("");

  // Update thumbnail preview when URL changes
  useEffect(() => {
    if (thumbnailUrl && thumbnailUrl.trim() !== "") {
      setThumbnailPreview(thumbnailUrl);
    } else {
      setThumbnailPreview("");
    }
  }, [thumbnailUrl]);

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

  // Validate form
  const validateForm = () => {
    const errors: {
      bookName?: string;
      authors?: string;
      thumbnailUrl?: string;
      hostUrls?: string;
      publicationDate?: string;
    } = {};

    if (!bookName.trim()) {
      errors.bookName = "Book name is required";
    }

    const hasEmptyAuthor = authors.some(author => !author.name.trim());
    if (hasEmptyAuthor) {
      errors.authors = "All author fields must be filled";
    }

    const urlPattern = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/;
    
    if (thumbnailUrl && !urlPattern.test(thumbnailUrl)) {
      errors.thumbnailUrl = "Please enter a valid URL";
    }

    const hasEmptyHostUrl = hostUrls.some(host => !host.url.trim() || !host.label.trim());
    if (hasEmptyHostUrl) {
      errors.hostUrls = "All host URL fields must be filled";
    }

    const hasInvalidUrl = hostUrls.some(host => host.url && !urlPattern.test(host.url));
    if (hasInvalidUrl) {
      errors.hostUrls = "Please enter valid URLs";
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
      // Here you would typically send the data to your API
      // For now, we'll simulate a successful submission
      const bookData = {
        name: bookName,
        authors: authors.map(author => author.name),
        thumbnailUrl,
        hostUrls: hostUrls.map(host => ({ label: host.label, url: host.url })),
        publicationDate
      };

      console.log("Book data to be submitted:", bookData);
      
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
          <h1 className="text-2xl font-bold text-gray-900">Add New Book</h1>
        </div>
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

          {/* Thumbnail URL */}
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

          {/* Host URLs */}
          <div className="form-field">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              <div className="flex items-center">
                <FiLink className="mr-2 h-4 w-4 text-gray-500" />
                Host URLs <span className="text-red-500">*</span>
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
              {isSubmitting ? "Saving..." : "Save Book"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 