import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

async function handleBulkDelete(req: Request) {
  try {
    // Authenticate the admin
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ 
        error: 'Unauthorized: Only administrators can delete books',
        details: 'Authentication failed or user is not an admin'
      }, { status: 401 });
    }

    // Get book IDs from request body
    const { bookIds } = await req.json();
    
    if (!bookIds || !Array.isArray(bookIds) || bookIds.length === 0) {
      return NextResponse.json({ 
        error: 'Missing book IDs',
        details: 'Book IDs are required to delete books'
      }, { status: 400 });
    }

    console.log(`Bulk deleting ${bookIds.length} books`);

    // Delete one by one in a transaction for better reliability and debuggability.
    // This prevents one hidden failure from looking like a generic bulk failure.
    const deletedBooks = await prisma.$transaction(
      bookIds.map((id: string) =>
        prisma.book.delete({
          where: { id }
        })
      )
    );

    console.log(`${deletedBooks.length} books deleted successfully`);

    return NextResponse.json({ 
      success: true,
      message: `${deletedBooks.length} books deleted successfully`,
      count: deletedBooks.length
    });
  } catch (error) {
    console.error('Error deleting books:', error);
    return NextResponse.json(
      { 
        error: 'Failed to delete books', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  return handleBulkDelete(req);
}

export async function DELETE(req: Request) {
  return handleBulkDelete(req);
}
