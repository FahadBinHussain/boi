import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface ScrapedBookData {
  title: string;
  imageUrl?: string;
  summary?: string;
  publicationDate?: string;
  authors?: string[];
  publisher?: string;
  genres?: string[];
  ratings?: number;
  averageRating?: number;
  numberOfPages?: number;
  characters?: string[];
  language?: string;
}

// Helper function to detect URL type
function detectUrlType(url: string): 'fandom' | 'goodreads' | null {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();
    
    if (hostname.includes('fandom.com')) {
      return 'fandom';
    } else if (hostname.includes('goodreads.com')) {
      return 'goodreads';
    }
    
    return null;
  } catch (error) {
    console.error('Invalid URL:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  console.log('Scraper API endpoint hit');
  try {
    const body = await request.json();
    const url = body.url;

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid URL' }, { status: 400 });
    }

    // Determine the URL type to use the appropriate scraper
    const urlType = detectUrlType(url);
    if (!urlType) {
      return NextResponse.json({ error: 'Unsupported URL type. Currently supports: Fandom, Goodreads' }, { status: 400 });
    }

    console.log(`Scraping URL: ${url} (type: ${urlType})`);
    
    let scraperScriptPath;
    if (urlType === 'fandom') {
      // Path to Fandom scraper
      scraperScriptPath = path.resolve(process.cwd(), 'src/lib/scrapers/Fandom-Scraper/scraper.js');
    } else if (urlType === 'goodreads') {
      // Path to Goodreads scraper
      scraperScriptPath = path.resolve(process.cwd(), 'src/lib/scrapers/Goodreads-Scraper/scraper.js');
    } else {
      return NextResponse.json({ error: 'Unsupported URL type' }, { status: 400 });
    }
    
    console.log(`Executing scraper script at: ${scraperScriptPath}`);

    // Ensure the scraper submodule has its dependencies installed.
    try {
      console.log(`Ensuring ${urlType} scraper dependencies...`);
      await execAsync('npm install', { cwd: path.dirname(scraperScriptPath) });
      console.log(`${urlType} scraper dependencies are ready.`);
    } catch (depError) {
      console.error(`Error installing ${urlType} scraper dependencies:`, depError);
      return NextResponse.json({ error: `Failed to prepare ${urlType} scraper dependencies`, details: depError instanceof Error ? depError.message : String(depError) }, { status: 500 });
    }

    // Execute the scraper script
    const { stdout, stderr } = await execAsync(`node ${scraperScriptPath} "${url}"`);

    if (stderr) {
      console.error('Error output from scraper:', stderr);
      // Only return error if stderr indicates a true error (note that many tools output non-error information to stderr)
      if (stderr.includes('Error') || stderr.includes('exception') || stderr.includes('failed')) {
        return NextResponse.json({ error: 'Scraping process error', details: stderr }, { status: 500 });
      }
    }

    // Ensure we have output before trying to parse it
    if (!stdout || stdout.trim() === '') {
      return NextResponse.json({ error: 'Empty response from scraper' }, { status: 500 });
    }

    console.log("Raw stdout before parsing:", stdout.substring(0, 200) + "...");
    
    try {
      // Parse JSON output from the scraper - now both scrapers output valid JSON
      const scrapedData = JSON.parse(stdout);
      
      // Transform the data based on which scraper was used
      let transformedData;
      
      if (urlType === 'fandom') {
        // Map the Fandom scraper output to our expected format
        transformedData = {
          title: scrapedData.title || 'Untitled Book',
          imageUrl: scrapedData.cover_image_url,
          summary: scrapedData.plot_summary,
          publicationDate: scrapedData.publication_date,
          authors: scrapedData.author ? [scrapedData.author] : undefined,
          publisher: scrapedData.publisher,
          genres: scrapedData.genres,
          ratings: scrapedData.ratings,
          numberOfPages: scrapedData.numberOfPages,
          characters: scrapedData.characters,
          language: scrapedData.language
        };
      } else if (urlType === 'goodreads') {
        // Log the raw scraped data structure from Goodreads
        console.log("Raw Goodreads scraped data:", JSON.stringify(scrapedData, null, 2));
        console.log("Authors data from Goodreads:", scrapedData.authors);
        console.log("Author data from Goodreads:", scrapedData.author);
        console.log("Publication date from Goodreads:", scrapedData.publicationDate);
        
        // Handle author data appropriately
        let authorsList = [];
        
        // Check for author field first (this is what Goodreads scraper actually uses)
        if (scrapedData.author) {
          console.log("Found author field:", scrapedData.author);
          authorsList = [scrapedData.author];
        } 
        // Then check for authors field as fallback
        else if (scrapedData.authors) {
          console.log("Found authors field:", scrapedData.authors);
          if (Array.isArray(scrapedData.authors)) {
            authorsList = scrapedData.authors;
          } else if (typeof scrapedData.authors === 'string') {
            authorsList = [scrapedData.authors];
          }
        }
        
        console.log("Final authors list:", authorsList);
        
        // Handle publication date
        let publicationDate = scrapedData.publicationDate;
        
        // Check if the publication date is in a standardized format
        if (publicationDate) {
          console.log("Original publication date:", publicationDate);
          
          // Check if it's a year-only format
          const yearOnlyMatch = /^\d{4}$/.test(publicationDate);
          // Check if it's already in YYYY-MM-DD format
          const fullDateMatch = /^\d{4}-\d{2}-\d{2}$/.test(publicationDate);
          
          if (!yearOnlyMatch && !fullDateMatch) {
            // Try to extract year
            const yearMatch = publicationDate.match(/\b(19|20)\d{2}\b/);
            if (yearMatch && yearMatch[0]) {
              publicationDate = yearMatch[0];
              console.log("Normalized publication date to year:", publicationDate);
            } else {
              // Try to parse as a date
              try {
                const date = new Date(publicationDate);
                if (!isNaN(date.getTime())) {
                  publicationDate = date.toISOString().split('T')[0]; // YYYY-MM-DD format
                  console.log("Normalized publication date to ISO format:", publicationDate);
                }
              } catch (error) {
                console.warn("Failed to normalize publication date:", error);
              }
            }
          }
        }
        
        // Map the Goodreads scraper output to our expected format
        transformedData = {
          title: scrapedData.bookName,
          imageUrl: scrapedData.imageUrl,
          summary: scrapedData.bookSummary,
          publicationDate: publicationDate,
          publisher: scrapedData.publisher,
          authors: authorsList,
          genres: scrapedData.genres,
          ratings: scrapedData.ratings ? Number(scrapedData.ratings) : undefined,
          averageRating: scrapedData.averageRating ? Number(scrapedData.averageRating) : undefined,
          numberOfPages: scrapedData.numberOfPages ? Number(scrapedData.numberOfPages) : undefined,
          language: scrapedData.language,
          characters: scrapedData.characters
        };
        
        console.log("Transformed Goodreads data:", transformedData);
      } else {
        // If we get here, it's an unknown scraper type but the JSON parsed successfully
        transformedData = scrapedData;
      }
      
      return NextResponse.json(transformedData, { status: 200 });
    } catch (parseError) {
      console.error('Failed to parse JSON:', parseError);
      console.error('Raw stdout:', stdout);
      return NextResponse.json({ 
        error: 'Failed to parse scraped data (not valid JSON). Check scraper output.',
        details: parseError instanceof Error ? parseError.message : String(parseError),
        stdout: stdout.substring(0, 500) // Include part of the raw output for debugging
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in scraper API:', error);
    let errorMessage = 'Failed to scrape URL.';
    if (error instanceof SyntaxError) {
      errorMessage = 'Failed to parse scraped data (not valid JSON). Check scraper output.';
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json({ error: errorMessage, details: String(error) }, { status: 500 });
  }
} 