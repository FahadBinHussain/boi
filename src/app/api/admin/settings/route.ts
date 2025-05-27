import { NextRequest, NextResponse } from 'next/server';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { cookies } from 'next/headers';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

// IMPORTANT: Use a proper key management system in production
const ENCRYPTION_KEY = process.env.SETTINGS_ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

// Encrypt sensitive data
function encryptData(data: string): { encryptedData: string, iv: string } {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return {
    encryptedData: encrypted,
    iv: iv.toString('hex')
  };
}

// Decrypt sensitive data
function decryptData(encryptedData: string, iv: string): string {
  const decipher = createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), Buffer.from(iv, 'hex'));
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Get user ID from session
async function getUserId(request: NextRequest): Promise<string | null> {
  try {
    // Get the session from next-auth
    // In App Router with route handlers, we don't need to pass request/response
    const session = await getServerSession(authOptions);
    
    // Log session for debugging
    console.log('Session in getUserId:', 
      session ? 
      { hasUser: !!session.user, userId: session.user?.id, email: session.user?.email } : 
      'No session found'
    );
    
    if (session?.user?.id) {
      console.log('Found user ID in session:', session.user.id);
      return session.user.id;
    }
    
    // Second attempt: Instead of using cookies directly, use the request cookies
    // This is more reliable in route handlers
    const sessionCookie = request.cookies.get('next-auth.session-token')?.value;
    
    if (sessionCookie) {
      console.log('Found session token in request cookies, but no user in session');
      
      // In a real app, you'd use the session token to look up the user
      // For now, we'll just log that we found it
    }
    
    // Fallback for development only
    if (process.env.NODE_ENV === 'development') {
      console.log('Using development fallback user ID (no session found)');
      // Use an existing user ID from your database instead of a made-up one
      // Based on the logs, we can see a real user ID we can use
      return 'cmb59u5yf0000udrgre8dq752';
    }
    
    console.warn('No authenticated user found in session or cookies');
    return null;
  } catch (error) {
    console.error('Error getting user ID from session:', error);
    
    // Fallback for development only
    if (process.env.NODE_ENV === 'development') {
      console.log('Using development fallback user ID after error');
      return 'cmb59u5yf0000udrgre8dq752';
    }
    
    return null;
  }
}

// GET handler for fetching user settings
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized: No user found in session' }, 
        { status: 401 }
      );
    }

    // Try to find user settings in the database
    const userSettings = await prisma.userSettings.findUnique({
      where: { userId }
    });
    
    // If no settings exist, return default values
    if (!userSettings) {
      return NextResponse.json({
        preferYearOnlyDateFormat: true
      }, { status: 200 });
    }
    
    // Format the response
    const response = {
      preferYearOnlyDateFormat: userSettings.preferYearOnlyDateFormat,
      // Don't expose the actual API key, just whether it exists
      filesVcApiKey: userSettings.encryptedFilesVcApiKey ? true : undefined
    };
    
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Error fetching user settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user settings' }, 
      { status: 500 }
    );
  }
}

// PUT handler for updating user settings
export async function PUT(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized: No user found in session' }, 
        { status: 401 }
      );
    }
    
    // Verify that the user exists in the database before proceeding
    const userExists = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true }
    });
    
    if (!userExists) {
      console.error(`User with ID ${userId} does not exist in the database`);
      return NextResponse.json(
        { error: 'The user does not exist in the database' }, 
        { status: 400 }
      );
    }
    
    const data = await request.json();
    console.log('Received settings update data:', JSON.stringify(data, null, 2));
    
    // Prepare the data for upsert
    const updateData: any = {};
    
    // Process settings and encrypt sensitive data if needed
    if ('preferYearOnlyDateFormat' in data) {
      updateData.preferYearOnlyDateFormat = data.preferYearOnlyDateFormat;
    }
    
    // For sensitive data like API keys, encrypt before storing
    if ('filesVcApiKey' in data && typeof data.filesVcApiKey === 'string') {
      // Only encrypt and update if a new value is provided
      if (data.filesVcApiKey) {
        const { encryptedData, iv } = encryptData(data.filesVcApiKey);
        updateData.encryptedFilesVcApiKey = encryptedData;
        updateData.apiKeyIv = iv;
      }
    }
    
    console.log('Processed update data (without sensitive values):', 
      { 
        ...updateData, 
        encryptedFilesVcApiKey: updateData.encryptedFilesVcApiKey ? '[ENCRYPTED]' : undefined 
      }
    );
    
    try {
      // Upsert the settings (create if not exists, update if exists)
      const result = await prisma.userSettings.upsert({
        where: { userId },
        update: updateData,
        create: {
          userId,
          ...updateData,
          // Set defaults for any missing fields
          preferYearOnlyDateFormat: 'preferYearOnlyDateFormat' in updateData 
            ? updateData.preferYearOnlyDateFormat 
            : true
        }
      });
      
      console.log('Successfully updated settings for user:', userId);
      
      return NextResponse.json({ 
        success: true,
        message: 'Settings updated successfully in database' 
      }, { status: 200 });
    } catch (error) {
      // Handle specific Prisma errors with proper type checking
      if (error instanceof PrismaClientKnownRequestError) {
        console.error('Prisma DB error:', {
          code: error.code,
          meta: error.meta,
          message: error.message
        });
        
        // P2002 is a unique constraint violation
        if (error.code === 'P2002') {
          return NextResponse.json({ 
            error: 'A settings entry already exists for this user' 
          }, { status: 409 });
        }
        
        // P2003 is a foreign key constraint failure
        if (error.code === 'P2003') {
          return NextResponse.json({ 
            error: 'The referenced user does not exist in the database' 
          }, { status: 400 });
        }
      }
      
      // Re-throw for the general catch block
      throw error;
    }
  } catch (error) {
    console.error('Error updating user settings:', error);
    
    // Create a more detailed error message
    let errorMessage = 'Failed to update user settings';
    if (error instanceof Error) {
      errorMessage += ': ' + error.message;
    }
    
    return NextResponse.json(
      { error: errorMessage }, 
      { status: 500 }
    );
  }
} 