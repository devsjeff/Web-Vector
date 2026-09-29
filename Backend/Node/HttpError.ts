// An error that carries an HTTP status. Fastify's error handler (server.ts) turns it into a JSON response,
// and because `expose` is true the frontend gets the real message (e.g. "Server is full").
export class HttpError extends Error {
  statusCode: number;
  expose = true;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}
