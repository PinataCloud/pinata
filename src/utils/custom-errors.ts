export class PinataError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public details?: any,
  ) {
    super(message);
    this.name = "PinataError";
  }
}

export class NetworkError extends PinataError {
  constructor(message: string, statusCode?: number, details?: any) {
    super(message, statusCode, details);
    this.name = "NetworkError";
  }
}

export class AuthenticationError extends PinataError {
  constructor(message: string, statusCode?: number, details?: any) {
    super(message, statusCode, details);
    this.name = "AuthenticationError";
  }
}

export class ValidationError extends PinataError {
  constructor(message: string, details?: any) {
    super(message, undefined, details);
    this.name = "ValidationError";
  }
}
