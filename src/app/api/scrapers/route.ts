import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Helper function to parse series position from various formats
function parseSeriesPosition(positionStr: string | number | undefined): string | number | undefined {
  console.log("Parsing series position from:", positionStr, "type:", typeof positionStr);
  
  if (positionStr === undefined) {
    console.log("Series position is undefined, returning undefined");
    return undefined;
  }
  
  // If it's already a number, return it as a string
  if (typeof positionStr === 'number') {
    console.log("Series position is a number, returning as string:", positionStr.toString());
    return positionStr.toString();
  }
  
  // If it's a string, preserve the original format
  if (typeof positionStr === 'string') {
    // Return the string as-is for formats like "1/1"
    console.log("Preserving original series position format:", positionStr);
    return positionStr;
  }
  
  console.log("Could not parse series position, returning undefined");
  return undefined;
}

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
  series?: string;
  seriesPosition?: string | number;
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
          language: scrapedData.language,
          series: scrapedData.series || scrapedData.seriesName,
          seriesPosition: parseSeriesPosition(scrapedData.seriesPosition || scrapedData.positionInSeries)
        };
      } else if (urlType === 'goodreads') {
        // Log the raw scraped data structure from Goodreads
        console.log("Raw Goodreads scraped data:", JSON.stringify(scrapedData, null, 2));
        console.log("Authors data from Goodreads:", scrapedData.authors);
        console.log("Author data from Goodreads:", scrapedData.author);
        console.log("Publication date from Goodreads:", scrapedData.publicationDate);
        
        // Enhanced logging for series information
        console.log("Series name from Goodreads (seriesName):", scrapedData.seriesName);
        console.log("Series name from Goodreads (series):", scrapedData.series);
        console.log("Position in series from Goodreads (positionInSeries):", scrapedData.positionInSeries);
        console.log("Position in series from Goodreads (seriesPosition):", scrapedData.seriesPosition);
        
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
          
          // Check if it's already in a standard format
          const yearOnlyMatch = /^\d{4}$/.test(publicationDate);
          const fullDateMatch = /^\d{4}-\d{2}-\d{2}$/.test(publicationDate);
          
          if (!yearOnlyMatch && !fullDateMatch) {
            // First try to parse the date with JavaScript Date
            try {
              const date = new Date(publicationDate);
              if (!isNaN(date.getTime())) {
                // Use local date components instead of ISO string to avoid timezone issues
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                publicationDate = `${year}-${month}-${day}`;
                console.log("Normalized publication date to local date format:", publicationDate);
              } else {
                // If JavaScript Date parsing fails, try with regex patterns
                
                // Map of month names to their numeric values
                const monthMap: Record<string, string> = {
                  "january": "01", "february": "02", "march": "03", "april": "04",
                  "may": "05", "june": "06", "july": "07", "august": "08",
                  "september": "09", "october": "10", "november": "11", "december": "12"
                };
                
                // Check for "Month Day, Year" format (e.g., "January 1, 1998")
                const goodreadsDateRegex = /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:,|\s+|st|nd|rd|th)\s+(\d{4})\b/i;
                const match = publicationDate.toLowerCase().match(goodreadsDateRegex);
                
                if (match) {
                  const monthName = match[1].toLowerCase();
                  const day = String(parseInt(match[2])).padStart(2, '0');
                  const year = match[3];
                  const month = monthMap[monthName];
                  
                  if (month) {
                    publicationDate = `${year}-${month}-${day}`;
                    console.log("Converted Goodreads date format to YYYY-MM-DD:", publicationDate);
                  } else {
                    // Try to extract year only if we can't parse the full date
                    const yearMatch = publicationDate.match(/\b(19|20)\d{2}\b/);
                    if (yearMatch && yearMatch[0]) {
                      publicationDate = yearMatch[0];
                      console.log("Normalized publication date to year as fallback:", publicationDate);
                    }
                  }
                } else {
                  // Try "Month Year" format
                  const monthYearRegex = /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})\b/i;
                  const monthYearMatch = publicationDate.toLowerCase().match(monthYearRegex);
                  
                  if (monthYearMatch) {
                    const monthName = monthYearMatch[1].toLowerCase();
                    const year = monthYearMatch[2];
                    const month = monthMap[monthName];
                    
                    if (month) {
                      publicationDate = `${year}-${month}-01`; // Default to 1st of month
                      console.log("Converted Month Year format to YYYY-MM-DD:", publicationDate);
                    } else {
                      // Fallback to year extraction
                      publicationDate = year;
                      console.log("Normalized Month Year to just year as fallback:", publicationDate);
                    }
                  } else {
                    // Last resort: extract year if nothing else works
                    const yearMatch = publicationDate.match(/\b(19|20)\d{2}\b/);
                    if (yearMatch && yearMatch[0]) {
                      publicationDate = yearMatch[0];
                      console.log("Normalized publication date to year as last resort:", publicationDate);
                    }
                  }
                }
              }
            } catch (error) {
              console.warn("Error during date parsing:", error);
              
              // Fallback to extracting year if Date parsing fails
              const yearMatch = publicationDate.match(/\b(19|20)\d{2}\b/);
              if (yearMatch && yearMatch[0]) {
                publicationDate = yearMatch[0];
                console.log("Normalized to year after Date parsing error:", publicationDate);
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
          characters: scrapedData.characters,
          series: scrapedData.seriesName || scrapedData.series,
          seriesPosition: parseSeriesPosition(scrapedData.positionInSeries || scrapedData.seriesPosition)
        };
        
        // Enhanced logging for transformed series data
        console.log("Series in transformed data:", transformedData.series);
        console.log("Series position in transformed data:", transformedData.seriesPosition, "type:", typeof transformedData.seriesPosition);
        
        console.log("Transformed Goodreads data:", transformedData);
      } else {
        // If we get here, it's an unknown scraper type but the JSON parsed successfully
        transformedData = scrapedData;
      }
      
      console.log("Final transformed data:", transformedData);
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