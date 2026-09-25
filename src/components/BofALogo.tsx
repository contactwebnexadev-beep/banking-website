import React from 'react';

interface BofALogoProps {
  className?: string;
  variant?: 'dark' | 'white';
  showSubtitle?: boolean;
}

export const BofALogo: React.FC<BofALogoProps> = ({
  className = 'h-10',
  variant = 'dark',
  showSubtitle = false,
}) => {
  const isWhite = variant === 'white';
  const textColor = isWhite ? '#FFFFFF' : '#002663';
  const subColor = isWhite ? '#D1D5DB' : '#5A6872';

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* Professional Polish Brand Emblem */}
      <div className="w-10 h-10 bg-white flex items-center justify-center rounded-sm shadow-xs flex-shrink-0 border border-white/20">
        <div className="w-6 h-6 bg-[#002663] flex items-center justify-center transform rotate-45">
          <div className="w-4 h-4 bg-[#DC143C] flex items-center justify-center">
            <div className="w-2 h-2 bg-white" />
          </div>
        </div>
      </div>

      <div className="flex flex-col leading-none">
        <div className="flex items-center gap-1.5">
          <span
            style={{ color: textColor }}
            className="font-bold tracking-tight text-xl md:text-2xl font-serif"
          >
            Bank of America
          </span>
          <span className="text-[10px] font-sans font-medium text-red-500 self-start">
            ®
          </span>
        </div>
        {showSubtitle && (
          <span
            style={{ color: subColor }}
            className="text-[10px] tracking-widest uppercase font-sans font-semibold mt-0.5"
          >
            Online Banking
          </span>
        )}
      </div>
    </div>
  );
};

