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

export const books: Book[] = [
  {
    id: "1",
    title: "The Great Gatsby",
    author: "F. Scott Fitzgerald",
    coverImage: "https://m.media-amazon.com/images/I/71FTb9X6wsL._AC_UF1000,1000_QL80_.jpg",
    description: "A novel of the Jazz Age, it tells the tragic story of Jay Gatsby, a self-made millionaire, and his pursuit of Daisy Buchanan.",
    categories: ["Classic", "Fiction", "Novel"],
    downloadLink: "#",
    fileSize: "2.3 MB",
    format: "PDF, EPUB, MOBI",
    publicationDate: "1925"
  },
  {
    id: "2",
    title: "To Kill a Mockingbird",
    author: "Harper Lee",
    coverImage: "https://upload.wikimedia.org/wikipedia/commons/4/4f/To_Kill_a_Mockingbird_%28first_edition_cover%29.jpg",
    description: "The story of racial inequality and the destruction of innocence, set in a sleepy Alabama town during the Great Depression.",
    categories: ["Classic", "Fiction", "Coming-of-age"],
    downloadLink: "#",
    fileSize: "1.8 MB",
    format: "PDF, EPUB",
    publicationDate: "1960"
  },
  {
    id: "3",
    title: "1984",
    author: "George Orwell",
    coverImage: "https://m.media-amazon.com/images/I/71kxa1-0mfL._AC_UF1000,1000_QL80_.jpg",
    description: "A dystopian novel set in a totalitarian society where critical thought is suppressed by a privileged elite.",
    categories: ["Dystopian", "Science Fiction", "Political"],
    downloadLink: "#",
    fileSize: "1.5 MB",
    format: "PDF, EPUB, MOBI",
    publicationDate: "1949"
  },
  {
    id: "4",
    title: "Pride and Prejudice",
    author: "Jane Austen",
    coverImage: "https://m.media-amazon.com/images/I/71Q1tPupKjL._AC_UF1000,1000_QL80_.jpg",
    description: "The story follows the main character, Elizabeth Bennet, as she deals with issues of manners, upbringing, morality, education, and marriage.",
    categories: ["Classic", "Romance", "Novel"],
    downloadLink: "#",
    fileSize: "2.1 MB",
    format: "PDF, EPUB",
    publicationDate: "1813"
  },
  {
    id: "5",
    title: "The Hobbit",
    author: "J.R.R. Tolkien",
    coverImage: "https://m.media-amazon.com/images/I/710+HcoP38L._AC_UF1000,1000_QL80_.jpg",
    description: "The adventure of Bilbo Baggins, a homebody who embarks on a journey to win a share of the treasure guarded by a dragon.",
    categories: ["Fantasy", "Adventure", "Fiction"],
    downloadLink: "#",
    fileSize: "3.2 MB",
    format: "PDF, EPUB, MOBI",
    publicationDate: "1937"
  },
  {
    id: "6",
    title: "Harry Potter and the Philosopher's Stone",
    author: "J.K. Rowling",
    coverImage: "https://m.media-amazon.com/images/I/81m1s4wIPML._AC_UF1000,1000_QL80_.jpg",
    description: "The story of a young wizard, Harry Potter, who discovers his magical heritage on his eleventh birthday.",
    categories: ["Fantasy", "Adventure", "Young Adult"],
    downloadLink: "#",
    fileSize: "2.8 MB",
    format: "PDF, EPUB, MOBI",
    publicationDate: "1997"
  }
];

export const categories = [...new Set(books.flatMap(book => book.categories))].sort(); 