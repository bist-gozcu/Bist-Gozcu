/**
 * BIST Gözcü — Merkezi hata loglama yardımcıları
 * 
 * Tüm catch bloklarında tutarsız hata kaydı için kullanılır.
 * İleride Sentry/Crashlytics entegrasyonu eklendiğinde
 * bu dosya tek güncelleme noktası olacaktır.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_PREFIXES: Record<LogLevel, string> = {
  debug: '[DEBUG]',
  info: '[INFO]',
  warn: '[WARN]',
  error: '[ERROR]',
};

function formatMessage(level: LogLevel, context: string, message: string): string {
  const timestamp = new Date().toISOString().slice(11, 19);
  return `${timestamp} ${LOG_PREFIXES[level]} [${context}] ${message}`;
}

/**
 * Geliştirme ortamında konsola log yazar.
 * Production'da uzak hata takip servisine gönderilebilir.
 */
function log(level: LogLevel, context: string, message: string, error?: unknown): void {
  if (__DEV__) {
    const formatted = formatMessage(level, context, message);
    switch (level) {
      case 'debug':
        console.debug(formatted, error ?? '');
        break;
      case 'info':
        console.info(formatted, error ?? '');
        break;
      case 'warn':
        console.warn(formatted, error ?? '');
        break;
      case 'error':
        console.error(formatted, error ?? '');
        break;
    }
  }
  // TODO: Sentry entegrasyonu eklendiğinde burada captureException çağrılacak
}

export const logger = {
  debug: (context: string, message: string, error?: unknown) => log('debug', context, message, error),
  info: (context: string, message: string, error?: unknown) => log('info', context, message, error),
  warn: (context: string, message: string, error?: unknown) => log('warn', context, message, error),
  error: (context: string, message: string, error?: unknown) => log('error', context, message, error),
};
