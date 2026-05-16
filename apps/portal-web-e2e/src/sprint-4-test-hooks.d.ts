interface Window {
  __testConnectionStateOverride__: (state: 'Connected' | 'Disconnected' | 'Reconnecting') => void;
}

declare module 'uuid' {
  export function v4(): string;
}
