import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Add proper type annotations for Next.js 15
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    
    const book = await prisma.book.findUnique({
      where: { id },
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