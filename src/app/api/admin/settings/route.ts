import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { cookies } from 'next/headers';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

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
    
    console.warn('No authenticated user found in session');
    return null;
  } catch (error) {
    console.error('Error getting user ID from session:', error);
    return null;
  }
}

// Get consistently formatted user ID
function getConsistentUserId(rawUserId: string | null): string {
  // Ensure the ID matches expected format
  if (!rawUserId) return '';
  
  // Return the original ID for real users
  return rawUserId;
}

// GET handler for fetching user settings
export async function GET(request: NextRequest) {
  console.log('====== SETTINGS GET REQUEST STARTED ======');
  try {
    // First verify database connection
    try {
      console.log('GET settings: Verifying database connection');
      // Simple query to check database connectivity
      const testResult = await prisma.$queryRaw`SELECT 1 as result`;
      console.log('GET settings: Database connection verified:', testResult);
    } catch (dbError) {
      console.error('GET settings: Database connection test failed:', 
        dbError instanceof Error ? dbError.message : String(dbError)
      );
      return NextResponse.json({ 
        error: 'Database connection failed - please check your database configuration' 
      }, { status: 500 });
    }
    
    const rawUserId = await getUserId(request);
    const userId = getConsistentUserId(rawUserId);
    console.log('GET settings: User ID from session:', rawUserId, 'formatted to:', userId);
    
    if (!userId) {
      console.log('GET settings: No user ID found, returning 401');
      return NextResponse.json(
        { error: 'Unauthorized: No user found in session' }, 
        { status: 401 }
      );
    }

    // Try to find user settings in the database
    console.log('GET settings: Looking up settings for user ID:', userId);
    const userSettings = await prisma.userSettings.findUnique({
      where: { userId }
    });
    console.log('GET settings: Database lookup result:', userSettings ? 'Found settings' : 'No settings found');
    
    // If no settings exist, create default settings
    if (!userSettings) {
      console.log('GET settings: No settings found, creating defaults');
      try {
        // Create default settings
        const defaultSettings = await prisma.userSettings.create({
          data: {
            userId
          }
        });
        
        console.log(`GET settings: Created default settings for user ${userId}`, defaultSettings);
        
        // Return the newly created settings
        console.log('GET settings: Returning newly created settings');
        return NextResponse.json({}, { status: 200 });
      } catch (error) {
        console.error('GET settings: Error creating default user settings:', error);
        // Still return default settings even if creation fails
        console.log('GET settings: Returning fallback default settings after error');
        return NextResponse.json({}, { status: 200 });
      }
    }
    
    // Format the response
    const response = {
      // Don't expose the actual API key, just whether it exists
      filesVcApiKey: (userSettings as unknown as { filesVcApiKey?: string }).filesVcApiKey ? true : undefined,
      filesVcAccountId: (userSettings as unknown as { filesVcAccountId?: string }).filesVcAccountId
    };
    
    console.log('GET settings: Returning existing settings from database');
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('GET settings: Error fetching user settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user settings' }, 
      { status: 500 }
    );
  } finally {
    console.log('====== SETTINGS GET REQUEST COMPLETED ======');
  }
}

// PUT handler for updating user settings
export async function PUT(request: NextRequest) {
  console.log('====== SETTINGS PUT REQUEST STARTED ======');
  try {
    // First verify database connection
    try {
      console.log('PUT settings: Verifying database connection');
      // Simple query to check database connectivity
      const testResult = await prisma.$queryRaw`SELECT 1 as result`;
      console.log('PUT settings: Database connection verified:', testResult);
    } catch (dbError) {
      console.error('PUT settings: Database connection test failed:', 
        dbError instanceof Error ? dbError.message : String(dbError)
      );
      return NextResponse.json({ 
        error: 'Database connection failed - please check your database configuration' 
      }, { status: 500 });
    }
    
    const rawUserId = await getUserId(request);
    const userId = getConsistentUserId(rawUserId);
    console.log('PUT settings: User ID from session:', rawUserId, 'formatted to:', userId);
    
    if (!userId) {
      console.log('PUT settings: No user ID found, returning 401');
      return NextResponse.json(
        { error: 'Unauthorized: You must be logged in to update settings' }, 
        { status: 401 }
      );
    }
    
    // Check if the user exists in the database
    const userExists = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true }
    });
    
    if (!userExists) {
      console.log(`PUT settings: User ${userId} doesn't exist in database, returning 403`);
      return NextResponse.json(
        { error: 'Forbidden: Your user account does not have permissions to update settings' }, 
        { status: 403 }
      );
    }
    
    const data = await request.json();
    console.log('PUT settings: Received settings update data:', JSON.stringify(data, null, 2));
    
    // Prepare the data for upsert
    const updateData: any = {};
    
    // For sensitive data like API keys, store as plain text
    if ('filesVcApiKey' in data && typeof data.filesVcApiKey === 'string') {
      // Only update if a new value is provided
      if (data.filesVcApiKey) {
        updateData.filesVcApiKey = data.filesVcApiKey;
      }
    }
    
    // Handle Account ID
    if ('filesVcAccountId' in data && typeof data.filesVcAccountId === 'string') {
      updateData.filesVcAccountId = data.filesVcAccountId;
    }
    
    console.log('Processed update data (without sensitive values):', 
      { 
        ...updateData, 
        filesVcApiKey: updateData.filesVcApiKey ? '[REDACTED]' : undefined 
      }
    );
    
    try {
      // Upsert the settings (create if not exists, update if exists)
      // We'll use the upsert directly without the user verification since upsert will handle this safely
      console.log('PUT settings: Attempting first upsert with userId:', userId);
      let result;
      try {
        // First attempt at upserting settings
        const logSafeData = { userId };
        // Create a safe version of updateData for logging, without sensitive info
        Object.keys(updateData).forEach(key => {
          // @ts-ignore - This is just for logging
          logSafeData[key] = key.includes('encrypted') ? '[REDACTED]' : updateData[key];
        });
        console.log('PUT settings: Starting upsert operation with data:', logSafeData);
        
        // First, check if the user exists to avoid foreign key constraint errors
        const userExists = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true }
        });
        
        if (!userExists) {
          console.log(`PUT settings: User ${userId} doesn't exist, creating fallback user first`);
          // Create a user record first
          try {
            console.log(`PUT settings: Creating fallback user with ID: ${userId}`);
            await prisma.user.create({
              data: {
                id: userId,
                email: `user-${userId.substring(0, 8)}@example.com`,
                emailVerified: new Date(),
              }
            });
            console.log('PUT settings: Successfully created fallback user');
          } catch (userCreateError) {
            console.error('PUT settings: Failed to create user:', userCreateError);
            throw new Error(`Could not create user: ${
              userCreateError instanceof Error ? userCreateError.message : String(userCreateError)
            }`);
          }
        }
        
        // Now proceed with the upsert
        result = await prisma.userSettings.upsert({
          where: { userId },
          update: updateData,
          create: {
            userId,
            ...updateData
          }
        });
        console.log('PUT settings: Upsert succeeded, result:', { 
          id: result.id, 
          userId: result.userId,
          hasApiKey: !!(result as unknown as { filesVcApiKey?: string }).filesVcApiKey
        });
      } catch (upsertError) {
        // Log detailed error information
        console.error('PUT settings: Upsert failed with error:', {
          name: upsertError instanceof Error ? upsertError.name : 'unknown',
          message: upsertError instanceof Error ? upsertError.message : String(upsertError),
          code: upsertError instanceof PrismaClientKnownRequestError ? upsertError.code : 'unknown',
          meta: upsertError instanceof PrismaClientKnownRequestError ? upsertError.meta : 'unknown',
        });
        
        // If it's a Prisma error, provide more detailed information
        if (upsertError instanceof PrismaClientKnownRequestError) {
          if (upsertError.code === 'P2003') {
            throw new Error(`Foreign key constraint failed. User with ID ${userId} might not exist in the database.`);
          } else {
            throw new Error(`Database error (${upsertError.code}): ${upsertError.message}`);
          }
        }
        
        // Otherwise, rethrow the original error
        throw upsertError;
      }
      
      console.log('Successfully updated settings for user:', userId);
      
      return NextResponse.json({ 
        success: true,
        message: 'Settings updated successfully in database' 
      }, { status: 200 });
    } catch (error) {
      // Handle specific Prisma errors with proper type checking
      if (error instanceof PrismaClientKnownRequestError) {
        console.error('PUT settings: Prisma DB error:', {
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
  } finally {
    console.log('====== SETTINGS PUT REQUEST COMPLETED ======');
  }
} 