import Link from 'next/link';
import { FiBook, FiMail, FiHeart, FiInfo } from 'react-icons/fi';
import MotionIcon from '@/components/ui/MotionIcon';

export default function AboutPage() {
  return (
    <div className="bg-base-100 text-base-content min-h-screen py-12 transition-colors">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl text-primary mb-4 shadow-sm">
            <MotionIcon animation="float">
              <FiBook size={28} />
            </MotionIcon>
          </div>
          <h1 className="text-4xl font-extrabold text-base-content mb-3">About বই</h1>
          <p className="text-base text-base-content/70 max-w-2xl mx-auto">
            A digital library offering free access to books across various genres and categories.
          </p>
        </div>

        {/* Main Content */}
        <div className="card bg-base-200/60 border border-base-content/10 rounded-3xl shadow-xl overflow-hidden mb-12">
          <div className="card-body p-8 md:p-12">
            <h2 className="text-2xl font-bold text-base-content mb-4">Our Mission</h2>
            <p className="text-base-content/80 mb-6 leading-relaxed">
              বই was created with a simple mission: to promote reading and make knowledge accessible to everyone around the world. We believe that books are one of humanity's greatest treasures, and access to them should not be limited by financial constraints.
            </p>
            <p className="text-base-content/80 mb-8 leading-relaxed">
              Our platform offers a collection of books that are either in the public domain or have been made available for free distribution by their authors and publishers. We strive to maintain a diverse collection covering various genres, topics, and interests.
            </p>

            <h2 className="text-2xl font-bold text-base-content mb-6">What We Offer</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <div className="card bg-base-100 border border-base-content/10 p-6 rounded-2xl shadow-sm">
                <h3 className="text-lg font-bold text-base-content mb-2">Wide Selection</h3>
                <p className="text-base-content/70 text-sm">
                  Access thousands of books across various genres and categories, from classics to contemporary books.
                </p>
              </div>
              <div className="card bg-base-100 border border-base-content/10 p-6 rounded-2xl shadow-sm">
                <h3 className="text-lg font-bold text-base-content mb-2">Multiple Formats</h3>
                <p className="text-base-content/70 text-sm">
                  Download books in various formats including PDF, EPUB, and MOBI, compatible with all your devices.
                </p>
              </div>
              <div className="card bg-base-100 border border-base-content/10 p-6 rounded-2xl shadow-sm">
                <h3 className="text-lg font-bold text-base-content mb-2">User-Friendly Interface</h3>
                <p className="text-base-content/70 text-sm">
                  Our clean, modern interface makes it easy to search, browse, and download books with just a few clicks.
                </p>
              </div>
              <div className="card bg-base-100 border border-base-content/10 p-6 rounded-2xl shadow-sm">
                <h3 className="text-lg font-bold text-base-content mb-2">No Registration Required</h3>
                <p className="text-base-content/70 text-sm">
                  Download books instantly without having to create an account or provide personal information.
                </p>
              </div>
            </div>

            <h2 className="text-2xl font-bold text-base-content mb-4">Copyright and Fair Use</h2>
            <p className="text-base-content/80 mb-4 leading-relaxed">
              বই respects intellectual property rights and complies with copyright laws. The books available on our platform are either:
            </p>
            <ul className="list-disc pl-6 mb-6 text-base-content/80 space-y-1.5 text-sm">
              <li>In the public domain (copyright has expired)</li>
              <li>Shared with permission from the copyright holders</li>
              <li>Available under various Creative Commons licenses</li>
              <li>Offered for free by their authors or publishers</li>
            </ul>
            <p className="text-base-content/80 mb-8 leading-relaxed">
              If you believe that any content on our site infringes upon your copyright, please contact us immediately through our{' '}
              <Link href="/dmca" className="text-primary hover:underline font-medium">DMCA page</Link>, and we will promptly address your concerns.
            </p>
            
            <div className="alert alert-warning shadow-md rounded-2xl">
              <MotionIcon animation="wiggle">
                <FiInfo className="w-5 h-5 shrink-0" />
              </MotionIcon>
              <div>
                <h3 className="font-bold text-sm">Disclaimer</h3>
                <p className="text-xs mt-0.5">
                  বই does not own or scan any books hosted on this site. All content is provided by third parties or is in the public domain. We make our best effort to ensure that all materials comply with copyright laws, but we rely on the information provided by our sources.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Contact Section */}
        <div className="card bg-base-200 border border-base-content/10 rounded-3xl p-8 md:p-12 text-center shadow-lg">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 rounded-full text-primary mx-auto mb-4">
            <MotionIcon animation="float">
              <FiMail size={20} />
            </MotionIcon>
          </div>
          <h2 className="text-2xl font-bold text-base-content mb-2">Get In Touch</h2>
          <p className="text-base-content/70 mb-6 max-w-xl mx-auto text-sm">
            Have questions, suggestions, or feedback? We'd love to hear from you. Reach out to our team.
          </p>
          <div>
            <a 
              href="mailto:contact@boi.com" 
              className="btn btn-primary rounded-full px-8 gap-2 font-medium shadow-md"
            >
              <MotionIcon animation="bounce">
                <FiMail size={16} />
              </MotionIcon>
              Contact Us
            </a>
          </div>
        </div>

        {/* Thank You Note */}
        <div className="text-center mt-12">
          <p className="flex items-center justify-center text-base-content/50 text-xs">
            Made with <MotionIcon animation="pulse" trigger="always"><FiHeart className="mx-1 text-error" /></MotionIcon> for book lovers worldwide
          </p>
        </div>
      </div>
    </div>
  );
}
