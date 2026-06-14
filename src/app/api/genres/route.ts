import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    // Fetch all genres with their books
    const genres = await prisma.genre.findMany({
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

    // Return the genres
    return NextResponse.json(genres);
  } catch (error) {
    console.error('Error fetching genres:', error);
    return NextResponse.json(
      { error: 'Failed to fetch genres' },
      { status: 500 }
    );
  }
} 