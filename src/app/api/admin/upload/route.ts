import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { getDecryptedApiKey } from '@/app/api/admin/settings/api-keys/route';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Import the uploadFile function from our submodule
// We need to require it dynamically since it's not a proper module
const uploadFilesVc = async (filePath, apiKey, accountId = null) => {
  try {
    // Since the files.vc-Uploader expects the API key in an environment variable,
    // we'll create a custom implementation based on its code
    const axios = require('axios');
    const FormData = require('form-data');
    
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));
    
    // Set headers with the API key
    const headers = {
      'X-API-Key': apiKey,
      ...form.getHeaders()
    };
    
    // Add account ID if provided
    if (accountId) {
      headers['X-Account-ID'] = accountId;
    }
    
    const response = await axios.post('https://api.files.vc/upload', form, { headers });
    
    if (response.data && (response.data.file_url || response.data.page_url)) {
      console.log('Upload successful!');
      return {
        success: true,
        data: response.data
      };
    } else {
      console.error('Upload failed: Unexpected response format');
      return {
        success: false,
        error: 'Unexpected response format from Files.vc'
      };
    }
  } catch (error) {
    console.error('Upload failed:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data || error.message
    };
  }
};

// Maximum file size (10GB - Files.vc limit)
const MAX_FILE_SIZE = 10 * 1024 * 1024 * 1024;

// Hardcoded API key for testing - REMOVE IN PRODUCTION
const HARDCODED_API_KEY = 'filesvc-4a615a4f2bdf4961a0bf969e90e0ff02';
const USE_HARDCODED_KEY = false; // Set to false to use the stored key from database

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
    let apiKey;
    try {
      if (USE_HARDCODED_KEY) {
        console.log('Using hardcoded API key for testing');
        apiKey = HARDCODED_API_KEY;
      } else {
        apiKey = await getDecryptedApiKey(adminUser.id, 'files_vc');
      }
    } catch (decryptError) {
      console.error(`API key decryption error for admin ${adminUser.id}:`, decryptError);
      return NextResponse.json({
        error: 'API Key Decryption Error',
        details: 'Failed to decrypt the Files.vc API key. Please re-save your API key in the admin settings.'
      }, { status: 400 });
    }
    
    if (!apiKey) {
      return NextResponse.json({
        error: 'Missing Files.vc API Key',
        details: 'No API key found for Files.vc or decryption failed. Please set or re-save your API key in the admin settings.'
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

    // Optional: Add account ID if provided
    const accountId = formData.get('accountId');
    
    // Save the file temporarily
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'filesvc-upload-'));
    const tempFilePath = path.join(tempDir, file.name);
    
    console.log('Saving temporary file to:', tempFilePath);
    
    // Convert the File object to a Node.js readable stream and save it
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(tempFilePath, buffer);
    
    // Upload to Files.vc using our module
    console.log('Uploading file to Files.vc:', file.name, 'Size:', file.size);
    console.log('Using API key:', apiKey.substring(0, 10) + '...');
    
    let uploadResult;
    try {
      uploadResult = await uploadFilesVc(
        tempFilePath, 
        apiKey, 
        typeof accountId === 'string' ? accountId : null
      );
      
      // Clean up the temporary file
      fs.unlinkSync(tempFilePath);
      fs.rmdirSync(tempDir);
      
      if (!uploadResult.success) {
        return NextResponse.json({
          error: 'Upload to Files.vc failed',
          details: uploadResult.error
        }, { status: 500 });
      }
    } catch (uploadError) {
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
        details: uploadError instanceof Error ? uploadError.message : 'Unknown upload error'
      }, { status: 500 });
    }

    // Return the successful response
    return NextResponse.json({
      success: true,
      message: 'File uploaded successfully',
      fileData: {
        url: uploadResult.data.file_url || uploadResult.data.page_url,
        name: file.name,
        size: file.size,
        ...uploadResult.data
      }
    });
  } catch (error) {
    console.error('Error in upload handler:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json(
      { error: 'Internal Server Error', details: errorMessage },
      { status: 500 },
    );
  }
} 