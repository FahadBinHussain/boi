import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
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
      select: { filesVcApiKey: true }
    }) as { filesVcApiKey?: string; filesVcAccountId?: string } | null;
    
    let apiKey = '';
    let accountId = '';
    if (userSettings) {
      apiKey = userSettings?.filesVcApiKey || '';
      // Get account ID from a separate query to avoid schema type issues
      const accountSettings = await prisma.$queryRaw`
        SELECT "filesVcAccountId" FROM "UserSettings" WHERE "userId" = ${adminUser.id}
      ` as { filesVcAccountId?: string }[];
      
      if (accountSettings && accountSettings.length > 0) {
        accountId = accountSettings[0].filesVcAccountId || '';
      }
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
      
      // Return the successful response
      return NextResponse.json({
        success: true,
        message: 'File uploaded successfully',
        fileData: {
          url: uploadResult.file_url || uploadResult.page_url,
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
      
      return NextResponse.json({
        error: 'Upload Error',
        details: uploadError.message || 'Unknown upload error'
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in upload handler:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json(
      { error: 'Internal Server Error', details: errorMessage },
      { status: 500 },
    );
  }
} 