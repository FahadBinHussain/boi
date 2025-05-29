import Link from 'next/link';
import { FiBook, FiMail, FiHeart, FiInfo } from 'react-icons/fi';

export default function AboutPage() {
  return (
    <div className="bg-gray-50 min-h-screen py-12">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-full text-indigo-600 mb-4">
            <FiBook size={28} />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">About বই</h1>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            A digital library offering free access to books across various genres and categories.
          </p>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200 mb-12">
          <div className="p-8 md:p-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Our Mission</h2>
            <p className="text-gray-700 mb-6 leading-relaxed">
              বই was created with a simple mission: to promote reading and make knowledge accessible to everyone around the world. We believe that books are one of humanity's greatest treasures, and access to them should not be limited by financial constraints.
            </p>
            <p className="text-gray-700 mb-6 leading-relaxed">
              Our platform offers a collection of books that are either in the public domain or have been made available for free distribution by their authors and publishers. We strive to maintain a diverse collection covering various genres, topics, and interests.
            </p>

            <h2 className="text-2xl font-bold text-gray-900 mt-10 mb-6">What We Offer</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border border-gray-100 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Wide Selection</h3>
                <p className="text-gray-700">
                  Access thousands of books across various genres and categories, from classics to contemporary works.
                </p>
              </div>
              <div className="border border-gray-100 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Multiple Formats</h3>
                <p className="text-gray-700">
                  Download books in various formats including PDF, EPUB, and MOBI, compatible with all your devices.
                </p>
              </div>
              <div className="border border-gray-100 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-3">User-Friendly Interface</h3>
                <p className="text-gray-700">
                  Our clean, modern interface makes it easy to search, browse, and download books with just a few clicks.
                </p>
              </div>
              <div className="border border-gray-100 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-3">No Registration Required</h3>
                <p className="text-gray-700">
                  Download books instantly without having to create an account or provide personal information.
                </p>
              </div>
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mt-10 mb-6">Copyright and Fair Use</h2>
            <p className="text-gray-700 mb-6 leading-relaxed">
              বই respects intellectual property rights and complies with copyright laws. The books available on our platform are either:
            </p>
            <ul className="list-disc pl-6 mb-6 text-gray-700 space-y-2">
              <li>In the public domain (copyright has expired)</li>
              <li>Shared with permission from the copyright holders</li>
              <li>Available under various Creative Commons licenses</li>
              <li>Offered for free by their authors or publishers</li>
            </ul>
            <p className="text-gray-700 mb-6 leading-relaxed">
              If you believe that any content on our site infringes upon your copyright, please contact us immediately through our <Link href="/dmca" className="text-indigo-600 hover:underline">DMCA page</Link>, and we will promptly address your concerns.
            </p>
            
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-6 my-8">
              <h3 className="text-xl font-semibold text-gray-900 mb-3 flex items-center">
                <FiInfo className="mr-2 text-amber-700" /> Disclaimer
              </h3>
              <p className="text-gray-700 leading-relaxed">
                বই does not own or scan any books hosted on this site. All content is provided by third parties or is in the public domain. We make our best effort to ensure that all materials comply with copyright laws, but we rely on the information provided by our sources.
              </p>
            </div>
          </div>
        </div>

        {/* Contact Section */}
        <div className="bg-indigo-50 rounded-xl overflow-hidden border border-indigo-100 p-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-indigo-100 rounded-full text-indigo-600 mb-4">
            <FiMail size={20} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Get In Touch</h2>
          <p className="text-gray-700 mb-6 max-w-2xl mx-auto">
            Have questions, suggestions, or feedback? We'd love to hear from you. Reach out to our team.
          </p>
          <a 
            href="mailto:contact@bookvault.com" 
            className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
          >
            Contact Us
          </a>
        </div>

        {/* Thank You Note */}
        <div className="text-center mt-12">
          <p className="flex items-center justify-center text-gray-600 text-sm">
            Made with <FiHeart className="mx-1 text-red-500" /> for book lovers worldwide
          </p>
        </div>
      </div>
    </div>
  );
} 