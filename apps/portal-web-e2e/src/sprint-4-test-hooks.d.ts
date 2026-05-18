interface Window {
  __testConnectionStateOverride__: (state: 'Connected' | 'Disconnected' | 'Reconnecting') => void;
}
