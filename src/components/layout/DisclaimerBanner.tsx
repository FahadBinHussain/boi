import { FiInfo } from 'react-icons/fi';

const DisclaimerBanner = () => {
  return (
    <div className="bg-amber-50 border-b border-amber-100 py-2">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center text-sm text-amber-700">
          <FiInfo className="mr-2 flex-shrink-0" />
          <p>
            Disclaimer: বই does not own or scan any books hosted on this site. All content is provided by third parties or is in the public domain.
          </p>
        </div>
      </div>
    </div>
  );
};

export default DisclaimerBanner; 