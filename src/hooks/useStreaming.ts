import { useMessageStore } from '../store/message';

export function useStreaming() {
  const { streaming } = useMessageStore();
  return {
    isStreaming: () => streaming.isActive,
    status: () => streaming.status,
  };
}
