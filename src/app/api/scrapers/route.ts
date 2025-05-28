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
  numberOfPages?: number;
  characters?: string[];
  language?: string;
}

interface ScrapedSeriesData {
  seriesTitle: string;
  books?: ScrapedBookData[];
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

    try {
      console.log("Raw stdout before parsing:", stdout.substring(0, 200) + "...");
      
      // For Goodreads scraper, use a different parsing approach
      if (urlType === 'goodreads') {
        // Extract data using regex patterns since the JSON might have formatting issues
        const extractData = () => {
          const bookData: Record<string, any> = {};
          
          // Helper functions to extract data with updated regex patterns for non-quoted keys
          const extractField = (key: string, defaultValue: string | null = null): string | null => {
            // Updated pattern to handle non-quoted keys and possible quotes around values
            const pattern = new RegExp(`${key}\\s*:\\s*['"]([^'"]*)['"](,|\\s|$)`, 'i');
            const match = stdout.match(pattern);
            return match ? match[1] : defaultValue;
          };
          
          const extractNumber = (key: string, defaultValue: number | null = null): number | null => {
            // Updated pattern to handle non-quoted keys and numeric values without quotes
            const pattern = new RegExp(`${key}\\s*:\\s*(\\d+)(,|\\s|$)`, 'i');
            const match = stdout.match(pattern);
            return match ? Number(match[1]) : defaultValue;
          };
          
          const extractFloat = (key: string, defaultValue: number | null = null): number | null => {
            // Updated pattern to handle non-quoted keys and possible quotes around float values
            const pattern = new RegExp(`${key}\\s*:\\s*['"]?([0-9.]+)['"]?(,|\\s|$)`, 'i');
            const match = stdout.match(pattern);
            return match ? parseFloat(match[1]) : defaultValue;
          };
          
          // Try to extract arrays using a more manual approach
          const extractArray = (key: string): any[] => {
            // Updated pattern to handle non-quoted keys
            const startPattern = new RegExp(`${key}\\s*:\\s*\\[`, 'i');
            const startMatch = stdout.match(startPattern);
            
            if (!startMatch) return [];
            
            // Find the starting position of the array
            const startPos = startMatch.index! + startMatch[0].length;
            
            // Find the closing bracket
            let bracketCount = 1;
            let endPos = startPos;
            
            for (let i = startPos; i < stdout.length; i++) {
              if (stdout[i] === '[') bracketCount++;
              if (stdout[i] === ']') bracketCount--;
              
              if (bracketCount === 0) {
                endPos = i;
                break;
              }
            }
            
            if (bracketCount !== 0) return []; // Couldn't find matching bracket
            
            // Extract the array content
            const arrayContent = stdout.substring(startPos, endPos);
            
            // Split by commas and clean up each item
            return arrayContent
              .split(',')
              .map(item => item.trim())
              .filter(Boolean)
              .map(item => {
                // Remove quotes if present
                if ((item.startsWith("'") && item.endsWith("'")) || 
                    (item.startsWith('"') && item.endsWith('"'))) {
                  return item.substring(1, item.length - 1);
                }
                return item;
              });
          };
          
          // Special function to extract multi-line text fields like bookSummary
          const extractMultilineField = (key: string, defaultValue: string | null = null): string | null => {
            // First, find the key in the output
            const keyPattern = new RegExp(`${key}\\s*:\\s*['"]`, 'i');
            const keyMatch = stdout.match(keyPattern);
            
            if (!keyMatch) return defaultValue;
            
            // Find the starting position after the opening quote
            const startPos = keyMatch.index! + keyMatch[0].length;
            
            // Find the ending position (closing quote followed by comma or newline)
            let endPos = startPos;
            let insideQuote = true;
            
            for (let i = startPos; i < stdout.length; i++) {
              if (stdout[i] === '"' || stdout[i] === "'") {
                // Check if this quote is escaped
                if (i > 0 && stdout[i-1] === '\\') {
                  continue; // Skip escaped quotes
                }
                
                // Check if this is the end of the field (quote followed by comma or newline)
                if (i + 1 < stdout.length && (stdout[i+1] === ',' || stdout[i+1] === '\n')) {
                  endPos = i;
                  break;
                }
              }
            }
            
            if (endPos === startPos) {
              // Fallback: try to find the next field key
              const nextKeyPattern = new RegExp('\\s*,\\s*\\w+\\s*:', 'i');
              const nextKeyMatch = stdout.substring(startPos).match(nextKeyPattern);
              
              if (nextKeyMatch) {
                endPos = startPos + nextKeyMatch.index! - 1;
              } else {
                return defaultValue; // Couldn't find the end of the field
              }
            }
            
            // Extract the field content
            return stdout.substring(startPos, endPos);
          };
          
          // Extract book data with the correct field names from Goodreads output
          bookData.title = extractField('bookName');
          bookData.imageUrl = extractField('imageUrl');
          
          // Try to extract summary using a more specific approach for multi-line text
          const summaryPattern = /bookSummary:\s*'([^']*(?:\\'[^']*)*)'|bookSummary:\s*"([^"]*(?:\\"[^"]*)*)"|\bbookSummary\b\s*:\s*['"]([^'"]+)['"]/i;
          const summaryMatch = stdout.match(summaryPattern);
          bookData.summary = summaryMatch ? (summaryMatch[1] || summaryMatch[2] || summaryMatch[3]) : null;
          
          bookData.publicationDate = extractField('publicationDate');
          bookData.publisher = extractField('publisher');
          bookData.language = extractField('language');
          bookData.numberOfPages = extractNumber('numberOfPages');
          
          // Try to extract ratings using a more specific approach
          const ratingsPattern = /\bratings\b\s*:\s*['"]?(\d+)['"]?/i;
          const ratingsMatch = stdout.match(ratingsPattern);
          bookData.ratings = ratingsMatch ? Number(ratingsMatch[1]) : null;
          
          bookData.averageRating = extractFloat('averageRating');
          bookData.genres = extractArray('genres');
          bookData.characters = extractArray('characters');
          bookData.seriesName = extractField('seriesName');
          bookData.positionInSeries = extractField('positionInSeries');
          
          console.log("Extracted field values:", {
            title: bookData.title,
            imageUrl: bookData.imageUrl ? bookData.imageUrl.substring(0, 30) + "..." : null,
            summary: bookData.summary ? bookData.summary.substring(0, 30) + "..." : null,
            ratings: bookData.ratings,
            averageRating: bookData.averageRating
          });
          
          return bookData;
        };
        
        const goodreadsData = extractData();
        console.log("Extracted Goodreads data:", goodreadsData);
        
        return NextResponse.json(goodreadsData, { status: 200 });
      }
      
      // For other scrapers, try the standard JSON parsing approach
      try {
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
          
          return NextResponse.json(transformedData, { status: 200 });
        }
        
        // If we get here, it's an unknown scraper type but the JSON parsed successfully
        return NextResponse.json(scrapedData, { status: 200 });
      } catch (parseError) {
        console.error('Failed to parse JSON directly:', parseError);
        
        // If it's not the Goodreads scraper, return an error
        if (urlType === 'fandom') {
          return NextResponse.json({ 
            error: 'Failed to parse scraped data. The output format was unexpected.',
            details: parseError instanceof Error ? parseError.message : String(parseError),
            stdout: stdout.substring(0, 500) // Include part of the raw output for debugging
          }, { status: 500 });
        }
        
        // For Goodreads, we already handled it above
        throw new Error('Unexpected code path - Goodreads scraper should have been handled earlier');
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