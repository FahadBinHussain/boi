import Link from 'next/link';
import { FiHeart, FiGithub, FiTwitter, FiMail } from 'react-icons/fi';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-50 border-t border-gray-100">
      <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* About */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 tracking-wider uppercase mb-4">
              About বই
            </h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              বই is a digital library offering free access to books across various genres.
              Our mission is to promote reading and make knowledge accessible to everyone.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 tracking-wider uppercase mb-4">
              Quick Links
            </h3>
            <ul className="space-y-3">
              <li>
                <Link 
                  href="/" 
                  className="text-gray-600 hover:text-indigo-600 text-sm transition-colors"
                >
                  Home
                </Link>
              </li>
              <li>
                <Link 
                  href="/books" 
                  className="text-gray-600 hover:text-indigo-600 text-sm transition-colors"
                >
                  Browse Books
                </Link>
              </li>
              <li>
                <Link 
                  href="/genres" 
                  className="text-gray-600 hover:text-indigo-600 text-sm transition-colors"
                >
                  Genres
                </Link>
              </li>
              <li>
                <Link 
                  href="/about" 
                  className="text-gray-600 hover:text-indigo-600 text-sm transition-colors"
                >
                  About Us
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 tracking-wider uppercase mb-4">
              Legal
            </h3>
            <ul className="space-y-3">
              <li>
                <Link 
                  href="/privacy" 
                  className="text-gray-600 hover:text-indigo-600 text-sm transition-colors"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link 
                  href="/terms" 
                  className="text-gray-600 hover:text-indigo-600 text-sm transition-colors"
                >
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link 
                  href="/copyright" 
                  className="text-gray-600 hover:text-indigo-600 text-sm transition-colors"
                >
                  Copyright Notice
                </Link>
              </li>
              <li>
                <Link 
                  href="/dmca" 
                  className="text-gray-600 hover:text-indigo-600 text-sm transition-colors"
                >
                  DMCA Policy
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 tracking-wider uppercase mb-4">
              Connect With Us
            </h3>
            <div className="flex space-x-4 mb-4">
              <a href="#" className="text-gray-500 hover:text-indigo-600 transition-colors">
                <FiGithub size={20} />
              </a>
              <a href="#" className="text-gray-500 hover:text-indigo-600 transition-colors">
                <FiTwitter size={20} />
              </a>
              <a href="mailto:contact@boi.com" className="text-gray-500 hover:text-indigo-600 transition-colors">
                <FiMail size={20} />
              </a>
            </div>
            <p className="text-sm text-gray-600">
              Questions or suggestions? 
              <a href="mailto:contact@boi.com" className="text-indigo-600 hover:text-indigo-800 ml-1">
                Reach out to us
              </a>
            </p>
          </div>
        </div>

        <div className="border-t border-gray-200 mt-8 pt-8 flex flex-col items-center">
          <p className="text-sm text-gray-500 mb-2">
            &copy; {currentYear} বই. All rights reserved.
          </p>
          <p className="flex items-center text-xs text-gray-400">
            Made with <FiHeart className="mx-1 text-red-500" /> for book lovers worldwide
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 