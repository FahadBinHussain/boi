import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma'; // Use the singleton Prisma instance instead of creating a new one

// Removed separate PrismaClient instantiation to avoid connection pool issues
// const prisma = new PrismaClient();

const ENCRYPTION_KEY = process.env.API_ENCRYPTION_KEY; // Must be 32-byte (256-bit) key
const ALGORITHM = 'aes-256-gcm';

// Log environment status at startup for debugging
console.log('API_ENCRYPTION_KEY status:', {
  isSet: !!ENCRYPTION_KEY,
  length: ENCRYPTION_KEY?.length || 0,
});

if (!ENCRYPTION_KEY) {
  console.error('FATAL ERROR: API_ENCRYPTION_KEY is not set in .env.local. It must be a 64-character hex string (32 bytes).');
  // In a real app, you might throw an error here or prevent startup if the key is critical.
}

function ensureKeyIsValid(key: string | undefined): Buffer {
  if (!key || typeof key !== 'string' || key.length !== 64 || !/^[0-9a-fA-F]+$/.test(key)) {
    throw new Error(
      'Invalid API_ENCRYPTION_KEY: Must be a 64-character hex string (32 bytes).',
    );
  }
  return Buffer.from(key, 'hex');
}

// Encryption function
function encrypt(text: string): { iv: string; encryptedData: string } {
  try {
    const keyBuffer = ensureKeyIsValid(ENCRYPTION_KEY);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return { iv: iv.toString('hex'), encryptedData: encrypted };
  } catch (error) {
    console.error('Encryption error:', error);
    throw error; // Re-throw for proper error handling upstream
  }
}

// Decryption function (will be needed by the upload handler later)
function decrypt(text: { iv: string; encryptedData: string }): string {
  try {
    const keyBuffer = ensureKeyIsValid(ENCRYPTION_KEY);
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      keyBuffer,
      Buffer.from(text.iv, 'hex'),
    );
    let decrypted = decipher.update(text.encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw error; // Re-throw for proper error handling upstream
  }
}

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
    // Check encryption key first for clearer error messages
    if (!ENCRYPTION_KEY) {
      console.error('API_ENCRYPTION_KEY is not set - POST request failed');
      return NextResponse.json({ 
        error: 'Server configuration error: Encryption service not available.',
        details: 'API_ENCRYPTION_KEY environment variable is not set'
      }, { status: 500 });
    }

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

    // Encrypt the API key
    let encryptedPayload;
    try {
      encryptedPayload = encrypt(apiKey);
    } catch (error) {
      console.error('Failed to encrypt API key:', error);
      return NextResponse.json({ 
        error: 'Server Error', 
        details: 'Failed to encrypt API key. Check server logs.' 
      }, { status: 500 });
    }

    // Save to database
    try {
      await prisma.adminApiKey.upsert({
        where: { adminId_serviceName: { adminId, serviceName } },
        update: { encryptedApiKey: encryptedPayload.encryptedData, iv: encryptedPayload.iv },
        create: { adminId, serviceName, encryptedApiKey: encryptedPayload.encryptedData, iv: encryptedPayload.iv },
      });
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
    // Check encryption key first for clearer error messages
    if (!ENCRYPTION_KEY) {
      console.error('API_ENCRYPTION_KEY is not set - GET request failed');
      return NextResponse.json({ 
        error: 'Server configuration error: Encryption service not available.',
        details: 'API_ENCRYPTION_KEY environment variable is not set'
      }, { status: 500 });
    }

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
      const apiKeyRecord = await prisma.adminApiKey.findUnique({
        where: { adminId_serviceName: { adminId, serviceName } },
      });

      return NextResponse.json(
        { isSet: !!apiKeyRecord, serviceName },
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

// Function to retrieve and decrypt an API key (will be used by your upload handler)
// This should also be protected and only callable from trusted server-side code.
export async function getDecryptedApiKey(adminId: string, serviceName: string): Promise<string | null> {
  if (!adminId || !serviceName) return null;
  if (!ENCRYPTION_KEY) {
    console.error("Cannot decrypt: Encryption key not set.");
    return null;
  }

  try {
    const apiKeyRecord = await prisma.adminApiKey.findUnique({
      where: { adminId_serviceName: { adminId, serviceName } },
    });

    if (apiKeyRecord && apiKeyRecord.encryptedApiKey && apiKeyRecord.iv) {
      return decrypt({ iv: apiKeyRecord.iv, encryptedData: apiKeyRecord.encryptedApiKey });
    }
    return null;
  } catch (error) {
    console.error(`Failed to retrieve or decrypt API key for admin ${adminId}, service ${serviceName}:`, error);
    return null;
  }
}