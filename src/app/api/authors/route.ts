import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    // Fetch all authors with their books
    const authors = await prisma.author.findMany({
      include: {
        books: {
          select: {
            id: true,
            title: true,
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    // Return the authors
    return NextResponse.json(authors);
  } catch (error) {
    console.error('Error fetching authors:', error);
    return NextResponse.json(
      { error: 'Failed to fetch authors' },
      { status: 500 }
    );
  }
} 