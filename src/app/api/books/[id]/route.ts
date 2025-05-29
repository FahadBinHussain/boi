import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Get the book from the database with its authors, genres, and series
    const book = await prisma.book.findUnique({
      where: { id },
      include: {
        authors: true,
        bookGenres: true,
        bookSeries: true
      }
    });

    if (!book) {
      return NextResponse.json(
        { error: 'Book not found' },
        { status: 404 }
      );
    }

    // Transform the data to match the expected format for the frontend
    // Get all authors
    const authors = book.authors || [];
    
    // Get the genres from both the array and relation
    const genres = book.genres || [];
    const bookGenres = book.bookGenres?.map(genre => genre.name) || [];
    const allGenres = [...new Set([...genres, ...bookGenres])];
    
    // Get series information
    const seriesName = book.bookSeries?.name || book.series || '';
    
    const transformedBook = {
      id: book.id,
      title: book.title,
      authors: authors,
      imageUrl: book.imageUrl || '',
      summary: book.summary || '',
      genres: allGenres,
      pdfUrl: book.pdfUrl || '#',
      publicationDate: book.publicationDate || '',
      seriesId: book.seriesId || '',
      seriesName: seriesName,
      seriesPosition: book.seriesPosition || [],
      // Legacy format support
      author: authors.length > 0 ? authors[0].name : '',
      coverImage: book.imageUrl || '',
      description: book.summary || '',
      categories: allGenres,
      downloadLink: book.pdfUrl || '#',
      fileSize: '2.5 MB', // This could be calculated from the actual file if needed
      format: 'PDF'
    };

    return NextResponse.json(transformedBook);
  } catch (error) {
    console.error('Error fetching book by ID:', error);
    return NextResponse.json(
      { error: 'Failed to fetch book', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 