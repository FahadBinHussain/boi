/**
 * Goodreads Scraper Helper
 * 
 * A wrapper for the goodreads-scraper module that standardizes 
 * the interface and adds type safety for use in our application.
 */

// Import directly from the submodule path
const { scrapeGoodreads } = require('../scrapers/Goodreads-Scraper');

/**
 * The structure of book data returned by the scraper
 */
export interface GoodreadsBookData {
  bookName: string;
  authors: string[];
  imageUrl: string | null;
  bookSummary: string | null;
  publicationDate: string | null;
  publisher: string | null;
  genres: string[];
  ratings: string;
  averageRating: string | null;
  numberOfPages: number | null;
  language: string | null;
  seriesName: string | null;
  positionInSeries: string | null;
  characters: string[];
}

/**
 * Scrape book details from a Goodreads URL
 * 
 * @param url The Goodreads book URL to scrape
 * @returns Promise resolving to the book details
 */
export async function scrapeGoodreadsBook(url: string): Promise<GoodreadsBookData> {
  try {
    // Validate URL format
    if (!url.match(/^https?:\/\/www\.goodreads\.com\/book\/show\/\d+/)) {
      throw new Error('Invalid Goodreads URL. URL should be in the format: https://www.goodreads.com/book/show/[book_id]');
    }

    // Call the scraper
    const bookDetails = await scrapeGoodreads(url);
    
    return bookDetails as GoodreadsBookData;
  } catch (error) {
    console.error('Error scraping Goodreads:', error);
    throw error;
  }
}

/**
 * Transform the raw Goodreads data to match our application's expected format
 */
export function transformGoodreadsData(scrapedData: GoodreadsBookData) {
  // Handle author data appropriately
  let authorsList: string[] = [];
  
  if (Array.isArray(scrapedData.authors)) {
    authorsList = scrapedData.authors;
  }
  
  // Parse ratings to number
  const ratings = scrapedData.ratings ? Number(scrapedData.ratings) : undefined;
  
  // Parse average rating to number
  const averageRating = scrapedData.averageRating ? Number(scrapedData.averageRating) : undefined;
  
  // Handle publication date
  let publicationDate = scrapedData.publicationDate;
  
  if (publicationDate) {
    // Check if it's already in a standard format
    const yearOnlyMatch = /^\d{4}$/.test(publicationDate);
    const fullDateMatch = /^\d{4}-\d{2}-\d{2}$/.test(publicationDate);
    
    if (!yearOnlyMatch && !fullDateMatch) {
      // Try to parse the date with JavaScript Date
      try {
        const date = new Date(publicationDate);
        if (!isNaN(date.getTime())) {
          // Use local date components instead of ISO string to avoid timezone issues
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          publicationDate = `${year}-${month}-${day}`;
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
            } else {
              // Extract year only if we can't parse the full date
              const yearMatch = publicationDate.match(/\b(19|20)\d{2}\b/);
              if (yearMatch && yearMatch[0]) {
                publicationDate = yearMatch[0];
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
              } else {
                // Fallback to year extraction
                publicationDate = year;
              }
            } else {
              // Last resort: extract year if nothing else works
              const yearMatch = publicationDate.match(/\b(19|20)\d{2}\b/);
              if (yearMatch && yearMatch[0]) {
                publicationDate = yearMatch[0];
              }
            }
          }
        }
      } catch (error) {
        // Fallback to extracting year if Date parsing fails
        const yearMatch = publicationDate.match(/\b(19|20)\d{2}\b/);
        if (yearMatch && yearMatch[0]) {
          publicationDate = yearMatch[0];
        }
      }
    }
  }
  
  // Parse series position
  const seriesPosition = parseSeriesPosition(scrapedData.positionInSeries || undefined);
  
  // Return transformed data
  return {
    title: scrapedData.bookName,
    imageUrl: scrapedData.imageUrl,
    summary: scrapedData.bookSummary,
    publicationDate: publicationDate,
    publisher: scrapedData.publisher,
    authors: authorsList,
    genres: scrapedData.genres,
    ratings: ratings,
    averageRating: averageRating,
    numberOfPages: scrapedData.numberOfPages,
    language: scrapedData.language,
    characters: scrapedData.characters,
    series: scrapedData.seriesName,
    seriesPosition: seriesPosition
  };
}

/**
 * Helper function to parse series position from various formats
 */
function parseSeriesPosition(positionStr: string | number | undefined): string | number | undefined {
  if (positionStr === undefined) {
    return undefined;
  }
  
  // If it's already a number, return it as a string
  if (typeof positionStr === 'number') {
    return positionStr.toString();
  }
  
  // If it's a string, preserve the original format
  if (typeof positionStr === 'string') {
    // Return the string as-is for formats like "1/1"
    return positionStr;
  }
  
  return undefined;
} 