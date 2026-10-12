import { FiInfo } from 'react-icons/fi';
import MotionIcon from '../ui/MotionIcon';

const DisclaimerBanner = () => {
  return (
    <div className="bg-amber-50 border-b border-amber-100 py-2">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center text-sm text-amber-700">
          <MotionIcon animation="wiggle" className="mr-2 flex-shrink-0">
            <FiInfo />
          </MotionIcon>
          <p>
            Disclaimer: বই does not own or scan any books hosted on this site. All content is provided by third parties or is in the public domain.
          </p>
        </div>
      </div>
    </div>
  );
};

export default DisclaimerBanner; 