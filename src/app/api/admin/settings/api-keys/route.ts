import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

// Real authentication implementation using NextAuth.js
async function getAuthenticatedAdminId(req: Request): Promise<string | null> {
  try {
    // Get the session from NextAuth (this works in App Router API routes)
    const session = await getServerSession(authOptions);
    
    // Log authentication attempt for debugging
    console.log('Auth attempt in API keys route:', { 
      hasSession: !!session,
      email: session?.user?.email,
      role: session?.user?.role
    });
    
    // Check if user is authenticated
    if (!session || !session.user) {
      console.warn('No authenticated session found in API keys route');
      return null;
    }
    
    // Check if user has the ADMIN role
    if (session.user.role !== 'ADMIN') {
      console.warn(`User ${session.user.email} attempted to access admin API but has role: ${session.user.role}`);
      return null;
    }
    
    // Find the user in the database to get the ID
    const user = await prisma.user.findUnique({
      where: { email: session.user.email as string },
      select: { id: true }
    });
    
    if (!user) {
      console.warn(`User found in session but not in database: ${session.user.email}`);
      return null;
    }
    
    return user.id;
  } catch (error) {
    console.error('Error in getAuthenticatedAdminId:', error);
    return null;
  }
}

export async function POST(req: Request) {
  try {
    // Authenticate the admin
    const adminId = await getAuthenticatedAdminId(req);
    if (!adminId) {
      return NextResponse.json({ 
        error: 'Unauthorized: Only administrators can manage API keys.',
        details: 'Authentication failed or user is not an admin'
      }, { status: 401 });
    }

    // Parse the request body
    let body;
    try {
      body = await req.json();
    } catch (error) {
      console.error('Failed to parse request body:', error);
      return NextResponse.json({ 
        error: 'Bad Request', 
        details: 'Failed to parse request body as JSON'
      }, { status: 400 });
    }

    const { serviceName, apiKey } = body;

    if (!serviceName || typeof serviceName !== 'string' || !apiKey || typeof apiKey !== 'string') {
      return NextResponse.json(
        { error: 'Bad Request', details: 'Service name (string) and API key (string) are required' },
        { status: 400 },
      );
    }

    // Save to database
    try {
      // Use raw query to handle the AdminApiKey model that might not be fully recognized by TypeScript
      await prisma.$executeRaw`
        INSERT INTO "AdminApiKey" ("adminId", "serviceName", "apiKey")
        VALUES (${adminId}, ${serviceName}, ${apiKey})
        ON CONFLICT ("adminId", "serviceName") 
        DO UPDATE SET "apiKey" = ${apiKey}
      `;
    } catch (error) {
      console.error('Database error when saving API key:', error);
      return NextResponse.json({ 
        error: 'Database Error', 
        details: 'Failed to save API key to database. Check server logs and database connection.' 
      }, { status: 500 });
    }

    return NextResponse.json(
      { message: `${serviceName} API key saved successfully.` },
      { status: 200 },
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error('Error in POST /api/admin/settings/api-keys:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: errorMessage },
      { status: 500 },
    );
  }
}

export async function GET(req: Request) {
  try {
    // Authenticate the admin
    const adminId = await getAuthenticatedAdminId(req);
    if (!adminId) {
      return NextResponse.json({ 
        error: 'Unauthorized: Only administrators can view API key status.',
        details: 'Authentication failed or user is not an admin' 
      }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const serviceName = searchParams.get('serviceName');

    if (!serviceName || typeof serviceName !== 'string') {
      return NextResponse.json(
        { error: 'Bad Request', details: 'Service name (string) is required as a query parameter' },
        { status: 400 },
      );
    }

    // Check if the API key exists
    try {
      // Use raw query to check if the API key exists
      const result = await prisma.$queryRaw<{ exists: boolean }[]>`
        SELECT EXISTS(
          SELECT 1 FROM "AdminApiKey" 
          WHERE "adminId" = ${adminId} AND "serviceName" = ${serviceName}
        ) as "exists"
      `;

      return NextResponse.json(
        { isSet: result[0].exists, serviceName },
        { status: 200 },
      );
    } catch (error) {
      console.error('Database error when checking API key status:', error);
      return NextResponse.json({ 
        error: 'Database Error', 
        details: 'Failed to check API key status in database. Check server logs and database connection.' 
      }, { status: 500 });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error('Error in GET /api/admin/settings/api-keys:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: errorMessage },
      { status: 500 },
    );
  }
}

// Function to retrieve an API key
async function getApiKey(adminId: string, serviceName: string): Promise<string | null> {
  if (!adminId || !serviceName) return null;

  try {
    // Use raw query to get the API key
    const result = await prisma.$queryRaw<{ apiKey: string }[]>`
      SELECT "apiKey" FROM "AdminApiKey" 
      WHERE "adminId" = ${adminId} AND "serviceName" = ${serviceName}
    `;

    if (result.length > 0 && result[0].apiKey) {
      return result[0].apiKey;
    }
    return null;
  } catch (error) {
    console.error(`Failed to retrieve API key for admin ${adminId}, service ${serviceName}:`, error);
    return null;
  }
}