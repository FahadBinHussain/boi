import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Get the book from the database with its authors
    const book = await prisma.book.findUnique({
      where: { id },
      include: {
        authors: true
      }
    });

    if (!book) {
      return NextResponse.json(
        { error: 'Book not found' },
        { status: 404 }
      );
    }

    // Transform the data to match the expected format for the frontend
    const authorName = book.authors.length > 0 ? book.authors[0].name : '';
    const categories = book.genres || [];
    
    const transformedBook = {
      id: book.id,
      title: book.title,
      author: authorName,
      coverImage: book.imageUrl || '',
      description: book.summary || '',
      categories: categories,
      downloadLink: book.pdfUrl || '#',
      fileSize: '2.5 MB', // This could be calculated from the actual file if needed
      format: 'PDF',
      publicationDate: book.publicationDate || ''
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