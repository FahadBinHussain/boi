import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const totalBooks = await prisma.book.count();
    const totalUsers = await prisma.user.count();
    let activeUsers = 0;
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      console.log('thirtyDaysAgo:', thirtyDaysAgo);
      const users = await prisma.user.findMany({
        where: {
          lastLogin: {
            not: null,
            gte: thirtyDaysAgo
          }
        },
        select: { email: true, lastLogin: true }
      });
      console.log('Active users found:', users);
      activeUsers = users.length;
    } catch (e) {
      activeUsers = 0;
    }
    return new Response(JSON.stringify({
      totalBooks,
      totalUsers,
      activeUsers
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