/**
 * Goodreads Scraper Fallback
 * A fallback implementation for scraping book details from Goodreads
 */

const { scrapeGoodreads } = require('./scraper');

/**
 * Main export for the Goodreads Scraper fallback
 */
module.exports = {
  /**
   * Scrape book details from a Goodreads URL
   * 
   * @param {string} url - The Goodreads book URL to scrape
   * @returns {Promise<Object>} - A promise that resolves to a book details object
   */
  scrapeGoodreads
}; 