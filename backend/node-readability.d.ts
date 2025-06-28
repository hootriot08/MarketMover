declare module 'node-readability' {
  export function Readability(
    url: string,
    callback: (err: any, article: { content?: string; textBody?: string; close?: () => void }) => void
  ): void;
} 