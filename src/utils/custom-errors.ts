interface ErrorDetails {
	error?: string;
	code?: string;
	metadata?: Record<string, any>;
}

export class PinataError extends Error {
	constructor(
		message: string,
		public statusCode?: number,
		public details?: ErrorDetails,
	) {
		super(message);
		this.name = "PinataError";
	}
}

export class NetworkError extends PinataError {
	constructor(message: string, statusCode?: number, details?: ErrorDetails) {
		super(message, statusCode, details);
		this.name = "NetworkError";
	}
}

export class AuthenticationError extends PinataError {
	constructor(message: string, statusCode?: number, details?: ErrorDetails) {
		super(message, statusCode, details);
		this.name = "AuthenticationError";
	}
}

export class ValidationError extends PinataError {
	constructor(message: string, details?: ErrorDetails) {
		super(message, undefined, details);
		this.name = "ValidationError";
	}
}
