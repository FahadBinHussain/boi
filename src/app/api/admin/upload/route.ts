import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Import the uploadFile function from the submodule
const { uploadFile } = require('../../../../../files.vc-Uploader/lib/uploader');

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

    // Get API key and Account ID from user settings
    const userSettings = await prisma.userSettings.findUnique({
      where: { userId: adminUser.id },
      select: { filesVcApiKey: true, filesVcAccountId: true }
    });
    
    let apiKey = '';
    let accountId = '';
    if (userSettings) {
      apiKey = userSettings.filesVcApiKey || '';
      accountId = userSettings.filesVcAccountId || '';
    }
    
    if (!apiKey) {
      console.log('Upload: No Files.vc API key found for user');
      return NextResponse.json(
        { error: 'Files.vc API key not configured in settings' },
        { status: 400 }
      );
    }
    
    if (!accountId) {
      console.log('Upload: No Files.vc Account ID found for user');
      return NextResponse.json(
        { error: 'Files.vc Account ID not configured in settings' },
        { status: 400 }
      );
    }

    // Parse the form data
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({
        error: 'Invalid request',
        details: 'Request must be multipart/form-data'
      }, { status: 400 });
    }

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
    
    // Save the file temporarily
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'filesvc-upload-'));
    const tempFilePath = path.join(tempDir, file.name);
    
    console.log('Saving temporary file to:', tempFilePath);
    
    // Convert the File object to a Node.js readable stream and save it
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(tempFilePath, buffer);
    
    // Upload to Files.vc using the submodule
    console.log('Uploading file to Files.vc:', file.name, 'Size:', file.size);
    console.log('Using API key:', apiKey.substring(0, 10) + '...');
    console.log('Using Account ID:', accountId);
    
    try {
      // Create a custom logger for the upload process
      const logger = (message: string) => {
        console.log(`[Files.vc Upload] ${message}`);
      };
      
      // Use the uploadFile function from the submodule
      const uploadResult = await uploadFile(tempFilePath, {
        apiKey,
        accountId,
        logger
      });
      
      // Clean up the temporary file
      fs.unlinkSync(tempFilePath);
      fs.rmdirSync(tempDir);
      
      // Get the file URL from the upload result
      let fileUrl = uploadResult.file_url || uploadResult.page_url;
      
      // Convert direct file URL to Files.vc download page URL if needed
      if (fileUrl && (fileUrl.includes('cdn-1.files.vc') || fileUrl.includes('cdn-2.files.vc'))) {
        const fileHash = fileUrl.split('/').pop()?.split('.')[0];
        if (fileHash) {
          fileUrl = `https://files.vc/d/dl?hash=${fileHash}`;
          console.log('Converted to Files.vc download page URL:', fileUrl);
        }
      }
      
      // Return the successful response
      return NextResponse.json({
        success: true,
        message: 'File uploaded successfully',
        fileData: {
          url: fileUrl,
          name: file.name,
          size: file.size,
          ...uploadResult
        }
      });
    } catch (uploadError: any) {
      console.error('Error during Files.vc upload:', uploadError);
      
      // Clean up the temporary file
      try {
        fs.unlinkSync(tempFilePath);
        fs.rmdirSync(tempDir);
      } catch (cleanupError) {
        console.error('Error cleaning up temporary file:', cleanupError);
      }
      
      // Check for specific network errors
      const errorMessage = uploadError.message || 'Unknown upload error';
      let status = 500;
      let userFriendlyMessage = errorMessage;
      
      // Handle specific error types with more user-friendly messages
      if (errorMessage.includes('ECONNRESET') || errorMessage.includes('Connection reset')) {
        userFriendlyMessage = 'The connection to the upload server was interrupted. This could be due to network issues or server load. Please try again with a smaller file or try later.';
        status = 503; // Service Unavailable
      } else if (errorMessage.includes('ETIMEDOUT') || errorMessage.includes('timeout')) {
        userFriendlyMessage = 'The upload timed out. This could be due to a slow connection or the file being too large. Please try again with a smaller file or on a faster connection.';
        status = 504; // Gateway Timeout
      }
      
      return NextResponse.json({
        error: 'Upload Error',
        details: userFriendlyMessage,
        retryable: status === 503 || status === 504, // Indicate if the error is likely temporary
        originalError: errorMessage
      }, { status });
    }
  } catch (error) {
    console.error('Error in upload handler:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    
    // Clean up any temporary files if they exist
    try {
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
      if (tempDir && fs.existsSync(tempDir)) {
        fs.rmdirSync(tempDir);
      }
    } catch (cleanupError) {
      console.error('Error cleaning up after general error:', cleanupError);
    }
    
    return NextResponse.json(
      { error: 'Internal Server Error', details: errorMessage },
      { status: 500 },
    );
  }
} 