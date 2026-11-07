'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FiArrowLeft, FiLoader } from 'react-icons/fi';
import MotionIcon from '@/components/ui/MotionIcon';
import BookDetailPanel, { type BookDetailBook } from '@/components/ui/BookDetailPanel';

export default function BookDetailPage() {
  const params = useParams<{ id: string }>();
  const bookId = params?.id;
  const [book, setBook] = useState<BookDetailBook | null>(null);
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
          <p className="text-base-content/75 font-medium">Loading book details…</p>
        </div>
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-100 text-base-content px-4">
        <div className="text-center card bg-base-200 border border-base-content/10 p-8 max-w-md shadow-xl rounded-3xl">
          <h2 className="text-2xl font-bold text-base-content mb-2">{error || 'Book not found'}</h2>
          <p className="text-base-content/75 mb-6">The book you're looking for doesn't seem to exist.</p>
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

  // Get the download link - convert direct file URL to Files.vc download page URL
  const downloadUrl = book.pdfUrl || book.downloadLink || '#';
  const filesVcDownloadLink = downloadUrl.includes('cdn-1.files.vc') || downloadUrl.includes('cdn-2.files.vc')
    ? `https://files.vc/d/dl?hash=${downloadUrl.split('/').pop()?.split('.')[0] || ''}`
    : downloadUrl;

  return (
    <div className="min-h-screen bg-base-100 text-base-content py-8 transition-colors">
      <div className="mx-auto max-w-7xl px-4">
        <Link
          href="/books"
          className="btn btn-ghost btn-sm gap-2 text-primary mb-6"
        >
          <MotionIcon animation="bounce">
            <FiArrowLeft size={16} />
          </MotionIcon>
          Back to all books
        </Link>

        <BookDetailPanel book={book} downloadUrl={filesVcDownloadLink} />
      </div>
    </div>
  );
}
