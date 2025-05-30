import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

// Minimal implementation with standard types
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Get the book ID from the URL params
    const bookId = params.id;
    
    // Authenticate the admin
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ 
        error: 'Unauthorized'
      }, { status: 401 });
    }
    
    // Delete the book from the database
    const deletedBook = await prisma.book.delete({
      where: { id: bookId }
    });
    
    return NextResponse.json({ 
      success: true,
      deletedBook
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete book' },
      { status: 500 }
    );
  }
} 