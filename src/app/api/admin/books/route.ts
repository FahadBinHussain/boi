import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    // Authenticate the admin
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ 
        error: 'Unauthorized: Only administrators can access books data',
        details: 'Authentication failed or user is not an admin'
      }, { status: 401 });
    }
    
    // Get books from the database with their authors
    const books = await prisma.book.findMany({
      include: {
        authors: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Transform the data to match the expected format for the admin panel
    const transformedBooks = books.map(book => {
      // Get the first author's name or empty string if no authors
      const authorName = book.authors.length > 0 ? book.authors[0].name : '';
      
      // Get the first genre as category
      const category = book.genres.length > 0 ? book.genres[0] : 'Uncategorized';
      
      return {
        id: book.id,
        title: book.title,
        author: authorName,
        category: category,
        downloads: 0, // This could be tracked in a real app
        status: "active", // This could be a real status in a more complete app
        createdAt: book.createdAt.toISOString(),
      };
    });

    return NextResponse.json(transformedBooks);
  } catch (error) {
    console.error('Error fetching books for admin:', error);
    return NextResponse.json(
      { error: 'Failed to fetch books', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 