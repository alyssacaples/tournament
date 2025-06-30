import React from 'react';
import { SHAPE_COLOR_COMBOS } from '@/data/constants';

interface ParticipantShapeProps {
  visualId?: number;
  shape?: number;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
  className?: string;
}

const ParticipantShape: React.FC<ParticipantShapeProps> = ({ 
  visualId = 0, 
  shape,
  size = 'md', 
  className = '' 
}) => {
  // Use either the shape or visualId prop
  const shapeIndex = shape !== undefined ? shape : visualId;
  const combo = SHAPE_COLOR_COMBOS[shapeIndex % SHAPE_COLOR_COMBOS.length];
  
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
    xxl: 'w-24 h-24'
  };
  
  const baseClasses = `${sizeClasses[size]} ${className}`;
  
  const renderShape = () => {
    const commonProps = {
      className: baseClasses,
      viewBox: "0 0 32 32",
      style: { filter: 'drop-shadow(2px 2px 4px rgba(0,0,0,0.2))' }
    };

    switch (combo.shape) {
      case 'circle':
        return (
          <svg {...commonProps}>
            <circle 
              cx="16" 
              cy="16" 
              r="14" 
              fill={combo.fillColor}
              stroke={combo.outlineColor}
              strokeWidth="3"
            />
          </svg>
        );
        
      case 'square':
        return (
          <svg {...commonProps}>
            <rect 
              x="2" 
              y="2" 
              width="28" 
              height="28" 
              fill={combo.fillColor}
              stroke={combo.outlineColor}
              strokeWidth="3"
              rx="2"
            />
          </svg>
        );
        
      case 'triangle':
        return (
          <svg {...commonProps}>
            <polygon 
              points="16,3 29,26 3,26" 
              fill={combo.fillColor}
              stroke={combo.outlineColor}
              strokeWidth="3"
              strokeLinejoin="round"
            />
          </svg>
        );
        
      case 'diamond':
        return (
          <svg {...commonProps}>
            <polygon 
              points="16,3 29,16 16,29 3,16" 
              fill={combo.fillColor}
              stroke={combo.outlineColor}
              strokeWidth="3"
              strokeLinejoin="round"
            />
          </svg>
        );
        
      case 'hexagon':
        return (
          <svg {...commonProps}>
            <polygon 
              points="8,3 24,3 29,16 24,29 8,29 3,16" 
              fill={combo.fillColor}
              stroke={combo.outlineColor}
              strokeWidth="3"
              strokeLinejoin="round"
            />
          </svg>
        );
        
      case 'star':
        return (
          <svg {...commonProps}>
            <polygon 
              points="16,2 19,11 29,11 21,17 24,27 16,21 8,27 11,17 3,11 13,11" 
              fill={combo.fillColor}
              stroke={combo.outlineColor}
              strokeWidth="3"
              strokeLinejoin="round"
            />
          </svg>
        );
        
      default:
        return (
          <svg {...commonProps}>
            <circle 
              cx="16" 
              cy="16" 
              r="14" 
              fill={combo.fillColor}
              stroke={combo.outlineColor}
              strokeWidth="3"
            />
          </svg>
        );
    }
  };
  
  return renderShape();
};

export default ParticipantShape;
