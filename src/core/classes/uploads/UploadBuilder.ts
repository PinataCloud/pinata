import type { PinataConfig, PinataMetadata, UploadOptions } from "../../types";

export class UploadBuilder<T> {
	private config: PinataConfig | undefined;
	private uploadFunction: (
		config: PinataConfig | undefined,
		...args: any[]
	) => Promise<T>;
	private args: any[];
	private metadata: PinataMetadata | undefined = {};
	private keys: string | undefined;
	private groupId: string | undefined;
	private vector: boolean | undefined;
	private uploadUrl: string | undefined;
	private isStreamable: boolean | undefined;
	private peerAddresses: string[] | undefined;

	constructor(
		config: PinataConfig | undefined,
		uploadFunction: (
			config: PinataConfig | undefined,
			...args: any[]
		) => Promise<T>,
		...args: any[]
	) {
		this.config = config;
		this.uploadFunction = uploadFunction;
		this.args = args;
	}

	// Replace addMetadata with these two methods:
	name(name: string): UploadBuilder<T> {
		if (!this.metadata) {
			this.metadata = {};
		}
		this.metadata.name = name;
		return this;
	}

	keyvalues(keyvalues: Record<string, string>): UploadBuilder<T> {
		if (!this.metadata) {
			this.metadata = {};
		}
		this.metadata.keyvalues = keyvalues;
		return this;
	}

	key(jwt: string): UploadBuilder<T> {
		this.keys = jwt;
		return this;
	}

	vectorize(): UploadBuilder<T> {
		this.vector = true;
		return this;
	}

	url(url: string): UploadBuilder<T> {
		this.uploadUrl = url;
		return this;
	}

	// cidVersion(v: 0 | 1): UploadBuilder<T> {
	// 	this.version = v;
	// 	return this;
	// }

	group(groupId: string): UploadBuilder<T> {
		this.groupId = groupId;
		return this;
	}

	streamable(): UploadBuilder<T> {
		this.isStreamable = true;
		return this;
	}

	peerAddress(peerAddresses: string[]): UploadBuilder<T> {
		this.peerAddresses = peerAddresses;
		return this;
	}

	then<TResult1 = T, TResult2 = never>(
		onfulfilled?:
			| ((value: T) => TResult1 | PromiseLike<TResult1>)
			| null
			| undefined,
		onrejected?:
			| ((reason: any) => TResult2 | PromiseLike<TResult2>)
			| null
			| undefined,
	): Promise<TResult1 | TResult2> {
		const options: UploadOptions = this.args[this.args.length - 1] || {};
		if (this.metadata) {
			options.metadata = this.metadata;
		}
		if (this.keys) {
			options.keys = this.keys;
		}
		if (this.groupId) {
			options.groupId = this.groupId;
		}
		if (this.vector) {
			options.vectorize = this.vector;
		}
		if (this.uploadUrl) {
			options.url = this.uploadUrl;
		}
		if (this.isStreamable) {
			options.streamable = this.isStreamable;
		}
		if (this.peerAddresses) {
			options.peerAddresses = this.peerAddresses;
		}
		this.args[this.args.length - 1] = options;
		return this.uploadFunction(this.config, ...this.args).then(
			onfulfilled,
			onrejected,
		);
	}
}
