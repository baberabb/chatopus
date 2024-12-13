import React from 'react'
import { TextSelect } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface SelectTextButtonProps {
  onClick: () => void;
  className?: string;
}

export const SelectTextButton: React.FC<SelectTextButtonProps> = ({ onClick, className }) => {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      className={className}
      aria-label="Select text"
    >
      <TextSelect className="h-4 w-4" />
    </Button>
  );
};

