import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    // Get books from the database with their authors
    const books = await prisma.book.findMany({
      include: {
        authors: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Transform the data to match the expected format for the frontend
    const transformedBooks = books.map(book => {
      // Get the first author's name or empty string if no authors
      const authorName = book.authors.length > 0 ? book.authors[0].name : '';
      
      // Get the genres as categories
      const categories = book.genres || [];
      
      return {
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
    });

    return NextResponse.json(transformedBooks);
  } catch (error) {
    console.error('Error fetching books:', error);
    return NextResponse.json(
      { error: 'Failed to fetch books', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 