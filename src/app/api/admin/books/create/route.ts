import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Import the uploadFile function from the submodule
const { uploadFile } = require('../../../../../../files.vc-Uploader/lib/uploader');

export async function POST(req: NextRequest) {
  try {
    // Authenticate the admin
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ 
        error: 'Unauthorized: Only administrators can create books',
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

    // Process the form data
    const formData = await req.formData();
    
    // Extract common fields
    const authorNames = formData.getAll('authors') as string[];
    
    // Single book mode
    const bookName = formData.get('bookName') as string;
    const thumbnailUrl = formData.get('thumbnailUrl') as string;
    const publicationDate = formData.get('publicationDate') as string;
    const summary = formData.get('summary') as string;
    
    // Get optional metadata fields
    const publisher = formData.get('publisher') as string || undefined;
    const genresJson = formData.get('genres') as string;
    const genres = genresJson ? JSON.parse(genresJson) as string[] : [];
    const ratingsStr = formData.get('ratings') as string;
    const ratings = ratingsStr ? parseFloat(ratingsStr) : undefined;
    const avgRatingStr = formData.get('averageRating') as string;
    const averageRating = avgRatingStr ? parseFloat(avgRatingStr) : undefined;
    const pagesStr = formData.get('numberOfPages') as string;
    const numberOfPages = pagesStr ? parseInt(pagesStr) : undefined;
    const charactersJson = formData.get('characters') as string;
    const characters = charactersJson ? JSON.parse(charactersJson) as string[] : [];
    const language = formData.get('language') as string || undefined;
    
    // Get the PDF file or URL
    const pdfFile = formData.get('pdf') as File | null;
    const pdfUrl = formData.get('pdfUrl') as string | null;
    
    let fileUrl: string | undefined;
    
    // If we have a pdfUrl from previous upload, use it directly
    if (pdfUrl) {
      fileUrl = pdfUrl;
      console.log('Using pre-uploaded PDF URL:', fileUrl);
    }
    // Otherwise, upload the PDF file if provided
    else if (pdfFile) {
      try {
        console.log('Uploading PDF file:', pdfFile.name);
        
        // Save the file temporarily
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'book-pdf-'));
        const tempFilePath = path.join(tempDir, pdfFile.name);
        
        // Convert the File object to a Node.js readable stream and save it
        const arrayBuffer = await pdfFile.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        fs.writeFileSync(tempFilePath, buffer);
        
        // Get API key from user settings
        const userSettings = await prisma.userSettings.findUnique({
          where: { userId: adminUser.id },
          select: { filesVcApiKey: true, filesVcAccountId: true }
        });

        if (!userSettings?.filesVcApiKey) {
          return NextResponse.json(
            { error: 'Files.vc API key not configured in settings' },
            { status: 400 }
          );
        }
        
        if (!userSettings?.filesVcAccountId) {
          return NextResponse.json(
            { error: 'Files.vc Account ID not configured in settings' },
            { status: 400 }
          );
        }

        const apiKey = userSettings.filesVcApiKey;
        const accountId = userSettings.filesVcAccountId;
        
        console.log('Using API key:', apiKey.substring(0, 10) + '...');
        console.log('Using Account ID:', accountId);
        
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
        
        fileUrl = uploadResult.file_url || uploadResult.page_url;
        
      } catch (error: any) {
        console.error('Error uploading PDF:', error);
        return NextResponse.json({
          error: 'Failed to upload PDF file',
          details: error.message || 'Unknown error'
        }, { status: 500 });
      }
    }
    
    // Create the book in the database
    try {
      // First create authors if they don't exist
      const authorIds = await Promise.all(authorNames.map(async (name) => {
        // Find existing author by name
        const existingAuthor = await prisma.author.findFirst({
          where: { name }
        });
        
        // If author exists, return their ID
        if (existingAuthor) {
          return existingAuthor.id;
        }
        
        // Otherwise create a new author
        const newAuthor = await prisma.author.create({
          data: { name }
        });
        return newAuthor.id;
      }));
      
      // Create the book
      const book = await prisma.book.create({
        data: {
          title: bookName,
          imageUrl: thumbnailUrl,
          publicationDate: publicationDate,
          summary: summary,
          publisher: publisher,
          genres: genres,
          ratings: ratings,
          averageRating: averageRating,
          numberOfPages: numberOfPages,
          characters: characters,
          language: language,
          authors: {
            connect: authorIds.map(id => ({ id }))
          }
        }
      });
      
      return NextResponse.json({
        success: true,
        message: 'Book created successfully',
        book: {
          id: book.id,
          title: book.title,
          pdfUrl: fileUrl
        }
      });
    } catch (error) {
      console.error('Error creating book in database:', error);
      return NextResponse.json({
        error: 'Failed to create book in database',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Unexpected error in book creation:', error);
    return NextResponse.json({
      error: 'Unexpected error during book creation',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 