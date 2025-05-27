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
}

export async function POST(request: NextRequest) {
  console.log('Fandom scraper API endpoint hit');
  try {
    const body = await request.json();
    const { fandomUrl } = body;

    if (!fandomUrl || typeof fandomUrl !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid fandomUrl' }, { status: 400 });
    }

    console.log(`Scraping URL: ${fandomUrl}`);
    console.log(`Executing scraper script at: ${scraperScriptPath}`);

    // Ensure the Fandom-Scraper submodule has its dependencies installed.
    // This is a simplified approach; in production, you'd ensure this during a build/deploy step.
    try {
      console.log('Ensuring Fandom-Scraper dependencies...');
      await execAsync('npm install', { cwd: path.dirname(scraperScriptPath) });
      console.log('Fandom-Scraper dependencies are ready.');
    } catch (depError) {
      console.error('Error installing Fandom-Scraper dependencies:', depError);
      return NextResponse.json({ error: 'Failed to prepare scraper dependencies', details: depError instanceof Error ? depError.message : String(depError) }, { status: 500 });
    }

    // Execute the scraper script
    const { stdout, stderr } = await execAsync(`node ${scraperScriptPath} "${fandomUrl}"`);

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
      const scrapedData: FandomScraperOutput = JSON.parse(stdout);
      
      // Map the Fandom scraper output to our expected format
      const bookData: ScrapedBookData = {
        title: scrapedData.title || 'Untitled Book',
        imageUrl: scrapedData.cover_image_url,
        summary: scrapedData.plot_summary,
        publicationDate: scrapedData.publication_date,
        authors: scrapedData.author ? [scrapedData.author] : undefined
      };
      
      return NextResponse.json(bookData, { status: 200 });
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
    console.error('Error in Fandom scraper API:', error);
    let errorMessage = 'Failed to scrape Fandom URL.';
    if (error instanceof SyntaxError) {
      errorMessage = 'Failed to parse scraped data (not valid JSON). Check scraper output.';
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json({ error: errorMessage, details: String(error) }, { status: 500 });
  }
} 