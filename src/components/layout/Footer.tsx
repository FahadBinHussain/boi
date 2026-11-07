import Link from 'next/link';
import { FiHeart, FiGithub, FiMessageCircle } from 'react-icons/fi';
import MotionIcon from '../ui/MotionIcon';
import { CONTACT_URL, REPO_URL } from '@/lib/site';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-base-200 text-base-content border-t border-base-300 transition-colors">
      <div className="shell py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* About */}
          <div>
            <h3 className="text-sm font-semibold text-base-content tracking-wider uppercase mb-4">
              About <span lang="bn">বই</span>
            </h3>
            <p className="text-base-content/75 text-sm leading-relaxed">
              <span lang="bn">বই</span> is a digital library offering free access to books across various genres.
              Our mission is to promote reading and make knowledge accessible to everyone.
            </p>
          </div>

          {/* Quick links */}
          <div>
            <h3 className="text-sm font-semibold text-base-content tracking-wider uppercase mb-4">
              Quick links
            </h3>
            <ul className="space-y-3">
              <li>
                <Link 
                  href="/" 
                  className="text-base-content/75 hover:text-primary text-sm transition-colors inline-block py-1"
                >
                  Home
                </Link>
              </li>
              <li>
                <Link 
                  href="/books" 
                  className="text-base-content/75 hover:text-primary text-sm transition-colors inline-block py-1"
                >
                  Browse books
                </Link>
              </li>
              <li>
                <Link 
                  href="/genres" 
                  className="text-base-content/75 hover:text-primary text-sm transition-colors inline-block py-1"
                >
                  Genres
                </Link>
              </li>
              <li>
                <Link 
                  href="/authors" 
                  className="text-base-content/75 hover:text-primary text-sm transition-colors inline-block py-1"
                >
                  Authors
                </Link>
              </li>
              <li>
                <Link 
                  href="/dataset" 
                  className="text-base-content/75 hover:text-primary text-sm transition-colors inline-block py-1"
                >
                  Dataset
                </Link>
              </li>
              <li>
                <Link 
                  href="/about" 
                  className="text-base-content/75 hover:text-primary text-sm transition-colors inline-block py-1"
                >
                  About <span lang="bn">বই</span>
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
                  className="text-base-content/75 hover:text-primary text-sm transition-colors inline-block py-1"
                >
                  Privacy policy
                </Link>
              </li>
              <li>
                <Link 
                  href="/terms" 
                  className="text-base-content/75 hover:text-primary text-sm transition-colors inline-block py-1"
                >
                  Terms of service
                </Link>
              </li>
              <li>
                <Link 
                  href="/copyright" 
                  className="text-base-content/75 hover:text-primary text-sm transition-colors inline-block py-1"
                >
                  Copyright notice
                </Link>
              </li>
              <li>
                <Link 
                  href="/dmca" 
                  className="text-base-content/75 hover:text-primary text-sm transition-colors inline-block py-1"
                >
                  DMCA policy
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-sm font-semibold text-base-content tracking-wider uppercase mb-4">
              Connect with us
            </h3>
            <div className="flex gap-3 mb-4">
              <a
                href={REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="বই on GitHub"
                className="btn btn-ghost btn-circle btn-sm text-base-content/75 hover:text-primary"
              >
                <MotionIcon animation="bounce">
                  <FiGithub size={18} />
                </MotionIcon>
              </a>
              <a
                href={CONTACT_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Report a problem on বই GitHub"
                className="btn btn-ghost btn-circle btn-sm text-base-content/75 hover:text-primary"
              >
                <MotionIcon animation="float">
                  <FiMessageCircle size={18} />
                </MotionIcon>
              </a>
            </div>
            <p className="text-sm text-base-content/75">
              Questions or suggestions?{' '}
              <a
                href={CONTACT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline ms-1"
              >
                Open an issue
              </a>
            </p>
          </div>
        </div>

        <div className="border-t border-base-300 mt-8 pt-8 flex flex-col items-center">
          <p className="text-sm text-base-content/75 mb-2">
            &copy; {currentYear} <span lang="bn">বই</span>. All rights reserved.
          </p>
          <p className="flex items-center text-xs text-base-content/75">
            Made with <MotionIcon animation="pulse" trigger="always"><FiHeart className="mx-1 text-error" /></MotionIcon> for book lovers worldwide
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;