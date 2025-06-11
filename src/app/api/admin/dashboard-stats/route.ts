import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const totalBooks = await prisma.book.count();
    const totalUsers = await prisma.user.count();

    return new Response(JSON.stringify({
      totalBooks,
      totalUsers
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch dashboard stats' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 