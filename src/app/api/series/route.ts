import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    // Fetch all series with their books
    const seriesList = await prisma.series.findMany({
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

    // Return the series
    return NextResponse.json(seriesList);
  } catch (error) {
    console.error('Error fetching series:', error);
    return NextResponse.json(
      { error: 'Failed to fetch series' },
      { status: 500 }
    );
  }
} 