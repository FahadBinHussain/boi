'use client';

import Image from 'next/image';
import Link from 'next/link';
import { FiArrowRight, FiBook, FiDownload, FiExternalLink } from 'react-icons/fi';
import { FaAmazon, FaGoodreads, FaWikipediaW } from 'react-icons/fa';
import { SiWikipedia } from 'react-icons/si';
import MotionIcon from '@/components/ui/MotionIcon';

export interface BookDetailAuthor {
  id: string;
  name: string;
}

export interface BookDetailBook {
  id: string;
  title: string;
  authors?: BookDetailAuthor[];
  imageUrl?: string;
  coverImage?: string;
  summary?: string;
  description?: string;
  publisher?: string;
  genres?: string[];
  categories?: string[];
  ratings?: number;
  averageRating?: number;
  numberOfPages?: number;
  characters?: string[];
  language?: string;
  pdfUrl?: string;
  downloadLink?: string;
  seriesName?: string;
  seriesPosition?: string;
  seriesId?: string;
  publicationDate?: string;
  scraperUrl?: string;
  fileSize?: string;
  format?: string;
  // Legacy single-author field, used when the record has no author rows.
  author?: string;
}

// The source link points at whatever site the record was scraped from, so the
// label has to name that site rather than say "Source".
const getSourceInfo = (url: string | undefined) => {
  if (!url) return null;

  const lowerUrl = url.toLowerCase();

  if (lowerUrl.includes('goodreads.com')) {
    return { icon: FaGoodreads, name: 'Goodreads' };
  }
  if (lowerUrl.includes('fandom.com') || lowerUrl.includes('wikia.com')) {
    return { icon: FaWikipediaW, name: 'Fandom' };
  }
  if (lowerUrl.includes('wikipedia.org')) {
    return { icon: SiWikipedia, name: 'Wikipedia' };
  }
  if (lowerUrl.includes('amazon.com') || lowerUrl.includes('amzn.')) {
    return { icon: FaAmazon, name: 'Amazon' };
  }
  return { icon: FiExternalLink, name: 'Source' };
};

interface BookDetailPanelProps {
  book: BookDetailBook;
  downloadUrl: string;
}

/**
 * The reading panel for a single record.
 *
 * Built from a design image (2752x1536). The image has no CSS pixel grid, so
 * every size here is read off the render and scaled by ~2x — the factor that
 * puts the uppercase micro-labels at their measured cap height. The ratios
 * between elements are exact; the absolute values are the closest token fit.
 * The design called its micro-label 11px, which is below this project's 12px
 * type floor, so the label is 12px and the rest of the scale follows it.
 */
export default function BookDetailPanel({ book, downloadUrl }: BookDetailPanelProps) {
  const coverImage = book.imageUrl || book.coverImage || '';
  const description = book.summary || book.description || '';
  const authors = book.authors || [];
  const genres = book.genres || book.categories || [];
  const characters = Array.isArray(book.characters) ? book.characters : [];
  const source = getSourceInfo(book.scraperUrl);

  // The metadata grid keeps the design's order: the four fields the design
  // showed first, then the remaining ones. Empty fields drop out entirely
  // instead of leaving a blank cell.
  const details: { label: string; value: string }[] = [];
  if (book.publicationDate) {
    details.push({ label: 'Publication date', value: book.publicationDate });
  }
  if (book.publisher) {
    details.push({ label: 'Publisher', value: book.publisher });
  }
  if (book.language) {
    details.push({ label: 'Language', value: book.language });
  }
  if (book.fileSize) {
    details.push({ label: 'File size', value: book.fileSize });
  }
  if (book.format) {
    details.push({ label: 'Format', value: book.format });
  }
  if (book.numberOfPages) {
    details.push({ label: 'Pages', value: String(book.numberOfPages) });
  }
  if (book.seriesName) {
    details.push({ label: 'Series', value: book.seriesName });
  }
  if (book.seriesPosition) {
    details.push({ label: 'Position in series', value: book.seriesPosition });
  }
  if (typeof book.averageRating === 'number' && book.averageRating > 0) {
    details.push({ label: 'Rating', value: `${book.averageRating.toFixed(1)} / 5` });
  }

  return (
    <article className="overflow-hidden rounded-3xl border border-base-content/10 bg-base-200/60 shadow-xl">
      <div className="grid md:grid-cols-[minmax(0,44%)_minmax(0,56%)]">
        {/* Cover plate */}
        <div className="p-4 sm:p-6 md:p-8">
          <div className="flex items-center justify-center rounded-2xl bg-base-100 p-5 sm:p-8">
            <div className="relative aspect-[2/3] w-full max-w-[320px] overflow-hidden rounded-xl shadow-2xl ring-1 ring-base-content/10">
              {coverImage ? (
                <Image
                  src={coverImage}
                  alt={book.title}
                  fill
                  sizes="(max-width: 768px) 90vw, 320px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-base-300">
                  <MotionIcon animation="float">
                    <FiBook className="h-16 w-16 text-base-content/30" />
                  </MotionIcon>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Record */}
        <div className="border-t border-base-content/10 p-6 sm:p-8 md:border-l md:border-t-0 md:py-10 md:pl-10 md:pr-12">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-base-content/75">
            <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
            Archive entry
          </p>

          <h1 className="mt-4 text-3xl font-extrabold leading-[1.35] tracking-tight text-base-content sm:text-[34px]">
            <bdi>{book.title}</bdi>
          </h1>

          <div className="mt-3 border-b border-base-content/10 pb-6">
            {authors.length > 0 ? (
              <p className="text-base text-base-content/75">
                By{' '}
                {authors.map((author, index) => (
                  <span key={author.id}>
                    <Link
                      href={`/authors/${author.id}`}
                      className="font-medium text-secondary hover:underline"
                    >
                      <bdi>{author.name}</bdi>
                    </Link>
                    {index < authors.length - 1 && <span className="text-base-content/75">,</span>}
                  </span>
                ))}
              </p>
            ) : book.author ? (
              <p className="text-base text-base-content/75">By {book.author}</p>
            ) : null}
          </div>

          {/* The design carried the description as a bare paragraph. The heading
              stays for screen readers and for the document outline. */}
          <section className="mt-6">
            <h2 className="sr-only">Description</h2>
            <p className="text-base leading-relaxed text-base-content/80">{description}</p>
          </section>

          {details.length > 0 && (
            <dl className="mt-6 grid grid-cols-2 overflow-hidden rounded-2xl border-l border-t border-base-content/10">
              {details.map((detail) => (
                <div key={detail.label} className="border-b border-r border-base-content/10 p-4">
                  <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-base-content/75">
                    {detail.label}
                  </dt>
                  <dd className="mt-1 text-base font-medium text-base-content">{detail.value}</dd>
                </div>
              ))}
            </dl>
          )}

          {genres.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {genres.map((genre, index) => (
                <span
                  key={index}
                  className="badge badge-outline h-auto max-w-full rounded-full border-base-content/20 px-3 py-1.5 text-sm text-base-content/80"
                >
                  {genre}
                </span>
              ))}
            </div>
          )}

          {characters.length > 0 && (
            <div className="mt-6">
              <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-base-content/75">
                Characters
              </h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {characters.map((character, index) => (
                  <span
                    key={index}
                    className="badge badge-outline h-auto max-w-full rounded-full border-base-content/20 px-3 py-1.5 text-sm text-base-content/80"
                  >
                    {character}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <a
              href={downloadUrl}
              className="btn btn-primary rounded-full gap-2 px-6 shadow-lg"
              target="_blank"
              rel="noopener noreferrer"
            >
              <MotionIcon animation="bounce">
                <FiDownload size={18} />
              </MotionIcon>
              Download {book.format || 'PDF'}
            </a>

            {source && (
              <a
                href={book.scraperUrl}
                className="btn btn-outline rounded-full gap-2"
                target="_blank"
                rel="noopener noreferrer"
              >
                <MotionIcon animation="wiggle">
                  <source.icon size={18} />
                </MotionIcon>
                <span>{source.name}</span>
              </a>
            )}

            <Link
              href="/books"
              className="inline-flex items-center gap-2 py-1 text-sm font-medium text-secondary hover:underline"
            >
              All books
              <MotionIcon animation="hover">
                <FiArrowRight size={16} />
              </MotionIcon>
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
