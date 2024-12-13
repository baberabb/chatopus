import React from 'react'
import { ThumbsUp } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ReactionButtonProps {
  onClick: () => void;
  className?: string;
}

export const ReactionButton: React.FC<ReactionButtonProps> = ({ onClick, className }) => {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      className={className}
      aria-label="React with thumbs up"
    >
      <ThumbsUp className="h-4 w-4" />
    </Button>
  );
};

