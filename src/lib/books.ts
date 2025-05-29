export interface Book {
  id: string;
  title: string;
  author: string;
  coverImage: string;
  description: string;
  genres: string[];
  downloadLink: string;
  fileSize: string;
  format: string;
  publicationDate: string;
}

// List of all possible genres
export const genres = [
  "Classic",
  "Fiction",
  "Novel",
  "Coming-of-age",
  "Dystopian",
  "Science Fiction",
  "Political",
  "Romance",
  "Fantasy",
  "Adventure",
  "Young Adult"
]; 