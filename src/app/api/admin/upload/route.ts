import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { getDecryptedApiKey } from '@/app/api/admin/settings/api-keys/route';

// Maximum file size (10GB - Files.vc limit)
const MAX_FILE_SIZE = 10 * 1024 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    // Authenticate the admin
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ 
        error: 'Unauthorized: Only administrators can upload files',
        details: 'Authentication failed or user is not an admin'
      }, { status: 401 });
    }
    
    // Find the admin user in the database to get the ID
    const adminUser = await prisma.user.findUnique({
      where: { email: session.user.email as string },
      select: { id: true }
    });
    
    if (!adminUser) {
      return NextResponse.json({
        error: 'Admin user not found in database',
        details: 'The authenticated admin user was not found in the database'
      }, { status: 404 });
    }

    // Get the files.vc API key
    const apiKey = await getDecryptedApiKey(adminUser.id, 'files_vc');
    
    if (!apiKey) {
      return NextResponse.json({
        error: 'Missing Files.vc API Key',
        details: 'No API key found for Files.vc. Please set it in the admin settings.'
      }, { status: 400 });
    }

    // Clone the request to be able to read it twice (once for content type check, once for formData)
    const contentType = req.headers.get('content-type') || '';
    
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({
        error: 'Invalid request',
        details: 'Request must be multipart/form-data'
      }, { status: 400 });
    }

    // Parse the form data
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({
        error: 'No file provided',
        details: 'No file was provided in the request'
      }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({
        error: 'File too large',
        details: `File size exceeds the maximum allowed size of ${MAX_FILE_SIZE / (1024 * 1024)} MB`
      }, { status: 400 });
    }

    // Create a new FormData to send to Files.vc
    const uploadFormData = new FormData();
    uploadFormData.append('file', file);

    // Optional: Add account ID if provided
    const accountId = formData.get('accountId');
    if (accountId && typeof accountId === 'string') {
      const headers = {
        'X-Account-ID': accountId
      };
    }

    // Upload to Files.vc
    console.log('Uploading file to Files.vc:', file.name, 'Size:', file.size);
    const uploadResponse = await fetch('https://api.files.vc/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: uploadFormData
    });

    if (!uploadResponse.ok) {
      // Try to get more detailed error information
      let errorDetail = '';
      try {
        const errorData = await uploadResponse.json();
        errorDetail = JSON.stringify(errorData);
      } catch (e) {
        errorDetail = `Status: ${uploadResponse.status} ${uploadResponse.statusText}`;
      }

      return NextResponse.json({
        error: 'Upload to Files.vc failed',
        details: errorDetail
      }, { status: uploadResponse.status });
    }

    // Parse the response from Files.vc
    const uploadResult = await uploadResponse.json();
    
    // Return the successful response with the Files.vc data
    return NextResponse.json({
      success: true,
      message: 'File uploaded successfully to Files.vc',
      fileData: uploadResult
    }, { status: 200 });
    
  } catch (error) {
    console.error('Error in Files.vc upload:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    
    return NextResponse.json({
      error: 'Server error during upload',
      details: errorMessage
    }, { status: 500 });
  }
} 