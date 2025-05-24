import { books, categories } from '@/lib/books';
import HeroSection from '@/components/ui/HeroSection';
import BookGrid from '@/components/ui/BookGrid';
import { FiBookOpen, FiDownload, FiUsers, FiLogIn } from 'react-icons/fi';
import Link from 'next/link';
import AuthCTA from '@/components/auth/AuthCTA';

export default function Home() {
  // Featured books - just take the first 3 for the homepage
  const featuredBooks = books.slice(0, 3);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <HeroSection />

      {/* Features Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Why বই?</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              We provide a simple, fast, and user-friendly platform to discover and download free books.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-gray-50 p-6 rounded-lg text-center">
              <div className="w-16 h-16 mx-auto bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 mb-4">
                <FiBookOpen size={28} />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Wide Selection</h3>
              <p className="text-gray-600">
                Access thousands of books across various genres and categories.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-gray-50 p-6 rounded-lg text-center">
              <div className="w-16 h-16 mx-auto bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 mb-4">
                <FiDownload size={28} />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Easy Downloads</h3>
              <p className="text-gray-600">
                Simple one-click downloads in multiple formats including PDF, EPUB, and MOBI.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-gray-50 p-6 rounded-lg text-center">
              <div className="w-16 h-16 mx-auto bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 mb-4">
                <FiUsers size={28} />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Community Driven</h3>
              <p className="text-gray-600">
                Join a community of book lovers who share and review their favorite reads.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Books Section */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-12">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Featured Books</h2>
              <p className="text-lg text-gray-600">
                Check out our most popular books this week
              </p>
            </div>
            <Link 
              href="/books" 
              className="inline-block mt-4 md:mt-0 text-indigo-600 font-medium hover:text-indigo-700 transition-colors"
            >
              View all books →
            </Link>
          </div>

          <BookGrid books={featuredBooks} selectedCategories={[]} />
        </div>
      </section>

      {/* Categories Preview */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Explore Categories</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Find your next read by browsing our collection by category
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {categories.slice(0, 8).map((category) => (
              <Link 
                key={category} 
                href={`/categories?selected=${category}`}
                className="bg-gray-50 hover:bg-indigo-50 border border-gray-200 rounded-lg p-6 text-center transition-colors group"
              >
                <h3 className="font-medium text-gray-900 group-hover:text-indigo-600 transition-colors">
                  {category}
                </h3>
              </Link>
            ))}
          </div>

          <div className="text-center mt-8">
            <Link 
              href="/categories" 
              className="inline-block px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium rounded-lg transition-colors"
            >
              See All Categories
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section with Authentication */}
      <AuthCTA />
    </div>
  );
}
