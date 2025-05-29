import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authenticate the admin
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ 
        error: 'Unauthorized: Only administrators can delete books',
        details: 'Authentication failed or user is not an admin'
      }, { status: 401 });
    }

    const bookId = params.id;
    
    if (!bookId) {
      return NextResponse.json({ 
        error: 'Missing book ID',
        details: 'Book ID is required to delete a book'
      }, { status: 400 });
    }

    console.log(`Deleting book with ID: ${bookId}`);

    // Delete the book from the database
    const deletedBook = await prisma.book.delete({
      where: {
        id: bookId
      }
    });

    console.log(`Book deleted successfully: ${deletedBook.title}`);

    return NextResponse.json({ 
      success: true,
      message: 'Book deleted successfully',
      deletedBook
    });
  } catch (error) {
    console.error('Error deleting book:', error);
    return NextResponse.json(
      { 
        error: 'Failed to delete book', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
} 