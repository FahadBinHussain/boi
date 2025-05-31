import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { scrapeGoodreadsBook, transformGoodreadsData } from '@/lib/scrapers/goodreads-helper';

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
    
    let scrapedData;
    let transformedData;
    
    if (urlType === 'fandom') {
      // Path to Fandom scraper
      const scraperScriptPath = path.resolve(process.cwd(), 'src/lib/scrapers/Fandom-Scraper/scraper.js');
      
      console.log(`Executing Fandom scraper script at: ${scraperScriptPath}`);

      // Ensure the scraper submodule has its dependencies installed.
      try {
        console.log(`Ensuring Fandom scraper dependencies...`);
        await execAsync('npm install', { cwd: path.dirname(scraperScriptPath) });
        console.log(`Fandom scraper dependencies are ready.`);
      } catch (depError) {
        console.error(`Error installing Fandom scraper dependencies:`, depError);
        return NextResponse.json({ error: `Failed to prepare Fandom scraper dependencies`, details: depError instanceof Error ? depError.message : String(depError) }, { status: 500 });
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
      
      // Parse JSON output from the scraper
      scrapedData = JSON.parse(stdout);
      
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
      try {
        // Use the new goodreads-helper
        console.log("Using updated Goodreads scraper for URL:", url);
        
        // Scrape the book using the new helper
        scrapedData = await scrapeGoodreadsBook(url);
        
        // Log the raw scraped data structure from Goodreads
        console.log("Raw Goodreads scraped data:", JSON.stringify(scrapedData, null, 2));
        
        // Transform the data to match our expected format
        transformedData = transformGoodreadsData(scrapedData);
        
        // Enhanced logging for transformed data
        console.log("Transformed Goodreads data:", transformedData);
      } catch (goodreadsError) {
        console.error("Error using updated Goodreads scraper:", goodreadsError);
        return NextResponse.json({ 
          error: 'Failed to scrape Goodreads data', 
          details: goodreadsError instanceof Error ? goodreadsError.message : String(goodreadsError) 
        }, { status: 500 });
      }
    } else {
      // If we get here, it's an unknown scraper type
      return NextResponse.json({ error: 'Unsupported URL type' }, { status: 400 });
    }
      
    console.log("Final transformed data:", transformedData);
    return NextResponse.json(transformedData, { status: 200 });
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