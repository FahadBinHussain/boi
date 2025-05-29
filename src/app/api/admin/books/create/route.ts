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
    let publicationDate = formData.get('publicationDate') as string;
    const summary = formData.get('summary') as string;
    
    // Simplified validation and normalization of publication date format
    if (publicationDate) {
      console.log('Original publication date:', publicationDate);
      
      // If it's already in YYYY-MM-DD format, validate it
      if (/^\d{4}-\d{2}-\d{2}$/.test(publicationDate)) {
        try {
          const date = new Date(publicationDate);
          if (isNaN(date.getTime())) {
            // Invalid date despite correct format, extract year
            publicationDate = publicationDate.substring(0, 4);
            console.log('Invalid full date despite correct format, using year:', publicationDate);
          } else {
            console.log('Valid full date, keeping as is:', publicationDate);
          }
        } catch (error) {
          // If parsing fails, just use the year part
          publicationDate = publicationDate.substring(0, 4);
          console.log('Error parsing full date, using year:', publicationDate);
        }
      } 
      // If it's already in YYYY format, keep it as is
      else if (/^\d{4}$/.test(publicationDate)) {
        console.log('Valid year-only format:', publicationDate);
      }
      // Try to handle Goodreads format if it made it to here
      else if (/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:,|\s+)\s*\d{4}\b/i.test(publicationDate)) {
        try {
          // Use Date object to parse it
          const date = new Date(publicationDate);
          if (!isNaN(date.getTime())) {
            publicationDate = date.toISOString().split('T')[0]; // Convert to YYYY-MM-DD
            console.log('Parsed Goodreads date format to:', publicationDate);
          } else {
            // If failed, try to extract year
            const yearMatch = publicationDate.match(/(19|20)\d{2}/);
            if (yearMatch) {
              publicationDate = yearMatch[0];
              console.log('Extracted year from Goodreads format:', publicationDate);
            }
          }
        } catch (error) {
          // If all parsing fails, extract year
          const yearMatch = publicationDate.match(/(19|20)\d{2}/);
          if (yearMatch) {
            publicationDate = yearMatch[0];
            console.log('Error parsing Goodreads date, using year:', publicationDate);
          }
        }
      }
      // For other formats, try to extract a year
      else {
        const yearMatch = publicationDate.match(/(19|20)\d{2}/);
        if (yearMatch) {
          publicationDate = yearMatch[0];
          console.log('Extracted year from non-standard format:', publicationDate);
        } else {
          // If all else fails, try Date object
          try {
            const date = new Date(publicationDate);
            if (!isNaN(date.getTime())) {
              publicationDate = date.toISOString().split('T')[0]; // YYYY-MM-DD format
              console.log('Parsed date with Date object:', publicationDate);
            } else {
              console.log('Failed to parse date, keeping original value:', publicationDate);
            }
          } catch (error) {
            console.log('Error parsing date, keeping original value:', publicationDate);
          }
        }
      }
    }
    
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
    
    // Get series information
    const series = formData.get('series') as string || undefined;
    const seriesPositionStr = formData.get('seriesPosition') as string;
    
    // Parse series position as an array for the updated schema
    let seriesPosition: number[] = [];
    if (seriesPositionStr) {
      if (seriesPositionStr.includes(',')) {
        // Handle comma-separated values
        seriesPosition = seriesPositionStr
          .split(',')
          .map(p => parseFloat(p.trim()))
          .filter(p => !isNaN(p));
      } else {
        // Handle single number - convert to array with one element
        const parsed = parseFloat(seriesPositionStr);
        if (!isNaN(parsed)) {
          seriesPosition = [parsed];
        }
      }
    }
    
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
          series: series,
          seriesPosition: seriesPosition,
          pdfUrl: fileUrl,
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