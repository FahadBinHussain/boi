import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Adjust the path to your Fandom-Scraper's main script
// Assumes scraper.js is the entry point and is in the root of the Fandom-Scraper submodule
const scraperScriptPath = path.resolve(process.cwd(), 'src/lib/scrapers/Fandom-Scraper/scraper.js');

// Define interfaces for the expected data structure
interface FandomScraperOutput {
  title: string;
  plot_summary?: string;
  author?: string;
  publication_date?: string;
  cover_image_url?: string;
  [key: string]: any; // Allow additional properties
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
  console.log('Fandom scraper API endpoint hit');
  try {
    const body = await request.json();
    // Accept both 'fandomUrl' (legacy) and 'url' (new) parameters
    const url = body.url || body.fandomUrl;

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
      // Parse the JSON output from the scraper
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
        // Goodreads data is already in the expected format or needs different transformation
        transformedData = {
          title: scrapedData.bookName,
          imageUrl: scrapedData.imageUrl,
          summary: scrapedData.bookSummary,
          publicationDate: scrapedData.publicationDate,
          authors: scrapedData.authors,
          publisher: scrapedData.publisher,
          genres: scrapedData.genres,
          ratings: scrapedData.ratings,
          numberOfPages: scrapedData.numberOfPages,
          characters: scrapedData.characters,
          language: scrapedData.language
        };
      } else {
        transformedData = scrapedData; // Use as-is if structure is unknown
      }
      
      return NextResponse.json(transformedData, { status: 200 });
    } catch (parseError) {
      console.error('Failed to parse scraper output:', parseError);
      console.error('Raw stdout:', stdout);
      return NextResponse.json({ 
        error: 'Failed to parse scraped data (not valid JSON). Check scraper output.',
        details: String(parseError),
        stdout: stdout  // Include the raw output for debugging
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