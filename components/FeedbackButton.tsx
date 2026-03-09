'use client';

interface Props {
  onClick: () => void;
}

export default function FeedbackButton({ onClick }: Props) {
  return (
    <button
      className="fixed bottom-4 left-4 z-40 w-11 h-11 rounded-full bg-space-lighter border border-gray-700 flex items-center justify-center text-lg hover:border-neon hover:text-neon transition-colors shadow-lg safe-bottom"
      onClick={onClick}
      title="Send Feedback"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}
    >
      💬
    </button>
  );
}
