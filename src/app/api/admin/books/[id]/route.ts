import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Simple GET handler for fetching a single book
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const bookId = params.id;
    
    const book = await prisma.book.findUnique({
      where: { id: bookId },
      include: {
        authors: true,
        bookGenres: true,
        bookSeries: true
      }
    });
    
    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }
    
    return NextResponse.json(book);
  } catch (error) {
    console.error('Error fetching book:', error);
    return NextResponse.json(
      { error: 'Failed to fetch book' },
      { status: 500 }
    );
  }
} 