import 'http';

declare module 'http' {
  interface IncomingMessage {
    id?: string; // pino-http set ediyor
  }
}
