const axios = require('axios');
const cheerio = require('cheerio');

async function scrapeGoodreads(url) {
  try {
    const { data } = await axios.get(url, {
      headers: { // Goodreads might block requests without a common user-agent
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    const $ = cheerio.load(data);

    const bookDetails = {
        bookName: null,
        authors: [],
        imageUrl: null,
        bookSummary: null,
        publicationDate: null,
        publisher: null,
        genres: [],
        ratings: "0",
        averageRating: null,
        numberOfPages: null,
        language: null,
        seriesName: null,
        positionInSeries: null,
        characters: []
    };

    // Book Name
    bookDetails.bookName = $('h1[data-testid="bookTitle"]').text().trim();

    // Author Name - Get all authors
    const authorElements = $('span[data-testid="authorName"], .ContributorLink__name');
    if (authorElements.length > 0) {
        // Process all author elements
        authorElements.each((i, el) => {
            const authorName = $(el).text().trim();
            if (authorName && !bookDetails.authors.includes(authorName)) {
                bookDetails.authors.push(authorName);
            }
        });
    }

    // Image URL
    bookDetails.imageUrl = $('.BookCover__image .ResponsiveImage').attr('src');

    // Book Summary
    let summary = '';
    
    // Try a more specific selector for the summary parts
    const descriptionContainer = $('.BookPageMetadataSection__description .DetailsLayoutRightParagraph__widthConstrained .Formatted');
    
    if (descriptionContainer.length > 0) {
        // Get the HTML content to preserve <br> tags
        const html = descriptionContainer.html();
        
        if (html) {
            // Replace <br> tags with newlines before extracting text
            const modifiedHtml = html.replace(/<br\s*\/?>/gi, '\n');
            
            // Load the modified HTML and extract text, which will now have newlines
            const $temp = cheerio.load(`<div>${modifiedHtml}</div>`);
            summary = $temp('div').text().trim();
        } else {
            // Fallback to direct text extraction if HTML is not available
            summary = descriptionContainer.text().trim();
        }
    }
    
    // Keep original formatting with preserved line breaks
    bookDetails.bookSummary = summary;

    // Publication Date & Publisher
    const publicationInfoText = $('[data-testid="publicationInfo"]').text().trim();
    const firstPublishedMatch = publicationInfoText.match(/First published\s+(.+)/);
    
    if (firstPublishedMatch) {
        bookDetails.publicationDate = firstPublishedMatch[1].trim();
    }

    // Genres
    $('.BookPageMetadataSection__genres .Button__labelItem').each((i, el) => {
        bookDetails.genres.push($(el).text().trim());
    });
    // Remove "Show all genres" if present
    bookDetails.genres = bookDetails.genres.filter(genre => genre !== 'Show all genres' && genre !== '...more');

    // Ratings
    const ratingsText = $('[data-testid="ratingsCount"]').text().trim();
    const ratingsMatch = ratingsText.match(/([\d,]+)/); // Extract numbers
    bookDetails.ratings = ratingsMatch ? ratingsMatch[1].replace(/,/g, '') : "0";

    let avgRating = $('.RatingStatistics__rating').text().trim();
    if (!avgRating) { // Fallback to data-testid
        avgRating = $('[data-testid="ratingValue"]').text().trim();
    }
    const avgRatingMatch = avgRating.match(/(\d{1,2}\.\d{1,2})/);
    if (avgRatingMatch && avgRatingMatch[0]) {
        bookDetails.averageRating = avgRatingMatch[0];
    } else {
        bookDetails.averageRating = avgRating;
    }

    // Additional details from the Book Details section
    $('div[data-testid="pagesFormat"]').each((i, el) => {
        const text = $(el).text().trim();
        const pagesMatch = text.match(/(\d+)\s+pages/i);
        if (pagesMatch && pagesMatch[1]) {
            bookDetails.numberOfPages = parseInt(pagesMatch[1], 10);
        }
    });

    // Publisher
    $('span[data-testid="publisher"]').each((i, el) => {
        bookDetails.publisher = $(el).text().trim();
    });

    // Language
    $('div.BookDetails div.DescListItem').each((i, el) => {
        const term = $(el).find('dt.DescListItem__term').text().trim();
        if (term.toLowerCase() === 'language') {
            bookDetails.language = $(el).find('dd.DescListItem__desc').text().trim();
        }
    });

    // Series information
    const seriesElements = $('.BookPageTitleSection__series a[href*="/series/"]');
    if (seriesElements.length > 0) {
        const seriesText = seriesElements.text().trim();
        const seriesMatch = seriesText.match(/^(.+?)(?:\s*\(#(\d+(?:\.\d+)?)\))?$/);
        if (seriesMatch && seriesMatch[1]) {
            bookDetails.seriesName = seriesMatch[1].trim();
            if (seriesMatch[2]) {
                bookDetails.positionInSeries = seriesMatch[2];
            }
        }
    }

    // Characters
    $('a').each((i, element) => {
        const href = $(element).attr('href');
        if (href && href.includes('/characters/')) {
            const text = $(element).text().trim();
            if (text && !bookDetails.characters.includes(text)) {
                bookDetails.characters.push(text);
            }
        }
    });

    return bookDetails;
  } catch (error) {
    console.error('Error scraping Goodreads:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
    }
    return null;
  }
}

module.exports = { scrapeGoodreads }; 