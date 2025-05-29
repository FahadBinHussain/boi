export interface Book {
  id: string;
  title: string;
  author: string;
  coverImage: string;
  description: string;
  categories: string[];
  downloadLink: string;
  fileSize: string;
  format: string;
  publicationDate: string;
}

// List of all possible categories
export const categories = [
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