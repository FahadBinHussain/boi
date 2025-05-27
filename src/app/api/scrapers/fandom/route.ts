import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Adjust the path to your Fandom-Scraper's main script
// Assumes scraper.js is the entry point and is in the root of the Fandom-Scraper submodule
const scraperScriptPath = path.resolve(process.cwd(), 'src/lib/scrapers/Fandom-Scraper/scraper.js');

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
    // You'll need to adapt this command based on how your scraper.js is meant to be run
    // e.g., if it takes the URL as a command-line argument
    const { stdout, stderr } = await execAsync(`node ${scraperScriptPath} "${fandomUrl}"`);

    if (stderr) {
      console.error('Error during scraping:', stderr);
      return NextResponse.json({ error: 'Scraping process error', details: stderr }, { status: 500 });
    }

    // Assuming the scraper.js outputs JSON to stdout
    const scrapedData = JSON.parse(stdout);
    console.log('Scraping successful, data:', scrapedData);

    return NextResponse.json(scrapedData, { status: 200 });

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