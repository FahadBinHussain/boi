import Link from 'next/link';
import { FiHeart, FiGithub, FiTwitter, FiMail } from 'react-icons/fi';
import MotionIcon from '../ui/MotionIcon';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-base-200 text-base-content border-t border-base-300 transition-colors">
      <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* About */}
          <div>
            <h3 className="text-sm font-semibold text-base-content tracking-wider uppercase mb-4">
              About বই
            </h3>
            <p className="text-base-content/70 text-sm leading-relaxed">
              বই is a digital library offering free access to books across various genres.
              Our mission is to promote reading and make knowledge accessible to everyone.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-sm font-semibold text-base-content tracking-wider uppercase mb-4">
              Quick Links
            </h3>
            <ul className="space-y-3">
              <li>
                <Link 
                  href="/" 
                  className="text-base-content/70 hover:text-primary text-sm transition-colors"
                >
                  Home
                </Link>
              </li>
              <li>
                <Link 
                  href="/books" 
                  className="text-base-content/70 hover:text-primary text-sm transition-colors"
                >
                  Browse Books
                </Link>
              </li>
              <li>
                <Link 
                  href="/genres" 
                  className="text-base-content/70 hover:text-primary text-sm transition-colors"
                >
                  Genres
                </Link>
              </li>
              <li>
                <Link 
                  href="/authors" 
                  className="text-base-content/70 hover:text-primary text-sm transition-colors"
                >
                  Authors
                </Link>
              </li>
              <li>
                <Link 
                  href="/dataset" 
                  className="text-base-content/70 hover:text-primary text-sm transition-colors"
                >
                  Dataset
                </Link>
              </li>
              <li>
                <Link 
                  href="/about" 
                  className="text-base-content/70 hover:text-primary text-sm transition-colors"
                >
                  About Us
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-sm font-semibold text-base-content tracking-wider uppercase mb-4">
              Legal
            </h3>
            <ul className="space-y-3">
              <li>
                <Link 
                  href="/privacy" 
                  className="text-base-content/70 hover:text-primary text-sm transition-colors"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link 
                  href="/terms" 
                  className="text-base-content/70 hover:text-primary text-sm transition-colors"
                >
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link 
                  href="/copyright" 
                  className="text-base-content/70 hover:text-primary text-sm transition-colors"
                >
                  Copyright Notice
                </Link>
              </li>
              <li>
                <Link 
                  href="/dmca" 
                  className="text-base-content/70 hover:text-primary text-sm transition-colors"
                >
                  DMCA Policy
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-sm font-semibold text-base-content tracking-wider uppercase mb-4">
              Connect With Us
            </h3>
            <div className="flex space-x-3 mb-4">
              <a href="#" className="btn btn-ghost btn-circle btn-sm text-base-content/70 hover:text-primary">
                <MotionIcon animation="bounce">
                  <FiGithub size={18} />
                </MotionIcon>
              </a>
              <a href="#" className="btn btn-ghost btn-circle btn-sm text-base-content/70 hover:text-primary">
                <MotionIcon animation="wiggle">
                  <FiTwitter size={18} />
                </MotionIcon>
              </a>
              <a href="mailto:contact@boi.com" className="btn btn-ghost btn-circle btn-sm text-base-content/70 hover:text-primary">
                <MotionIcon animation="float">
                  <FiMail size={18} />
                </MotionIcon>
              </a>
            </div>
            <p className="text-sm text-base-content/70">
              Questions or suggestions? 
              <a href="mailto:contact@boi.com" className="text-primary hover:underline ml-1">
                Reach out to us
              </a>
            </p>
          </div>
        </div>

        <div className="border-t border-base-300 mt-8 pt-8 flex flex-col items-center">
          <p className="text-sm text-base-content/60 mb-2">
            &copy; {currentYear} বই. All rights reserved.
          </p>
          <p className="flex items-center text-xs text-base-content/50">
            Made with <MotionIcon animation="pulse" trigger="always"><FiHeart className="mx-1 text-error" /></MotionIcon> for book lovers worldwide
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;