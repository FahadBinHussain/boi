import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Add proper type annotations for Next.js 15
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Get the book ID from the URL params
    const { id } = await context.params;
    
    // Authenticate the admin
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ 
        error: 'Unauthorized'
      }, { status: 401 });
    }
    
    // Delete the book from the database
    const deletedBook = await prisma.book.delete({
      where: { id }
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