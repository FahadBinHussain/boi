import { FiInfo } from 'react-icons/fi';
import MotionIcon from '../ui/MotionIcon';

const DisclaimerBanner = () => {
  return (
    <div className="bg-warning/10 border-b border-warning/20 py-2 text-base-content">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center text-xs font-medium text-base-content/80">
          <MotionIcon animation="wiggle" trigger="always" className="mr-2 flex-shrink-0 text-warning">
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