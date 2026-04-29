import { createSignedUploadURL } from "../../src/core/functions";
import type { PinataConfig, SignedUploadUrlOptions } from "../../src";
import {
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../src/utils/custom-errors";

describe("createSignedUploadURL function", () => {
	let originalFetch: typeof fetch;

	beforeEach(() => {
		originalFetch = global.fetch;
	});

	afterEach(() => {
		global.fetch = originalFetch;
		jest.clearAllMocks();
	});

	const mockConfig: PinataConfig = {
		pinataJwt: "test-jwt",
		pinataGateway: "https://test.mypinata.cloud",
	};

	const signedUrl =
		"https://uploads.pinata.cloud/v3/files/00000000-0000-0000-0000-000000000000?X-Algorithm=PINATA1&X-Signature=abc";

	const getJsonBody = () => {
		const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
		return JSON.parse(fetchCall[1].body as string);
	};

	it("should throw ValidationError if config is missing", async () => {
		await expect(
			createSignedUploadURL(undefined, { expires: 60 }, "public"),
		).rejects.toThrow(ValidationError);
	});

	it("should POST to /files/sign with the basic payload and return data", async () => {
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: jest.fn().mockResolvedValueOnce({ data: signedUrl }),
		});

		const url = await createSignedUploadURL(
			mockConfig,
			{ expires: 60 },
			"public",
		);

		expect(url).toBe(signedUrl);
		expect(global.fetch).toHaveBeenCalledWith(
			"https://uploads.pinata.cloud/v3/files/sign",
			expect.objectContaining({
				method: "POST",
				headers: expect.objectContaining({
					Authorization: "Bearer test-jwt",
					"Content-Type": "application/json",
				}),
			}),
		);

		const body = getJsonBody();
		expect(body.expires).toBe(60);
		expect(body.network).toBe("public");
	});

	describe("forDirectory option", () => {
		it("should add 'directory' to allow_mime_types when forDirectory=true and no mimeTypes set", async () => {
			global.fetch = jest.fn().mockResolvedValueOnce({
				ok: true,
				json: jest.fn().mockResolvedValueOnce({ data: signedUrl }),
			});

			const opts: SignedUploadUrlOptions = {
				expires: 60,
				forDirectory: true,
			};
			await createSignedUploadURL(mockConfig, opts, "public");

			const body = getJsonBody();
			expect(body.allow_mime_types).toEqual(["directory"]);
		});

		it("should merge 'directory' with caller-supplied mimeTypes", async () => {
			global.fetch = jest.fn().mockResolvedValueOnce({
				ok: true,
				json: jest.fn().mockResolvedValueOnce({ data: signedUrl }),
			});

			const opts: SignedUploadUrlOptions = {
				expires: 60,
				forDirectory: true,
				mimeTypes: ["text/plain", "image/png"],
			};
			await createSignedUploadURL(mockConfig, opts, "public");

			const body = getJsonBody();
			expect(body.allow_mime_types).toEqual(
				expect.arrayContaining(["directory", "text/plain", "image/png"]),
			);
			expect(body.allow_mime_types).toHaveLength(3);
		});

		it("should not duplicate 'directory' if already in mimeTypes", async () => {
			global.fetch = jest.fn().mockResolvedValueOnce({
				ok: true,
				json: jest.fn().mockResolvedValueOnce({ data: signedUrl }),
			});

			const opts: SignedUploadUrlOptions = {
				expires: 60,
				forDirectory: true,
				mimeTypes: ["directory", "text/plain"],
			};
			await createSignedUploadURL(mockConfig, opts, "public");

			const body = getJsonBody();
			expect(body.allow_mime_types).toEqual(["directory", "text/plain"]);
		});

		it("should not set allow_mime_types when forDirectory is false/absent and no mimeTypes given", async () => {
			global.fetch = jest.fn().mockResolvedValueOnce({
				ok: true,
				json: jest.fn().mockResolvedValueOnce({ data: signedUrl }),
			});

			await createSignedUploadURL(mockConfig, { expires: 60 }, "public");

			const body = getJsonBody();
			expect(body.allow_mime_types).toBeUndefined();
		});

		it("should pass mimeTypes through unchanged when forDirectory is not set", async () => {
			global.fetch = jest.fn().mockResolvedValueOnce({
				ok: true,
				json: jest.fn().mockResolvedValueOnce({ data: signedUrl }),
			});

			await createSignedUploadURL(
				mockConfig,
				{ expires: 60, mimeTypes: ["application/json"] },
				"public",
			);

			const body = getJsonBody();
			expect(body.allow_mime_types).toEqual(["application/json"]);
		});
	});

	it("should propagate other options to the request body", async () => {
		global.fetch = jest.fn().mockResolvedValueOnce({
			ok: true,
			json: jest.fn().mockResolvedValueOnce({ data: signedUrl }),
		});

		await createSignedUploadURL(
			mockConfig,
			{
				expires: 120,
				groupId: "group-1",
				name: "myfile.txt",
				keyvalues: { env: "prod" },
				maxFileSize: 1024,
				streamable: true,
				date: 1700000000,
			},
			"private",
		);

		const body = getJsonBody();
		expect(body).toMatchObject({
			expires: 120,
			group_id: "group-1",
			filename: "myfile.txt",
			keyvalues: { env: "prod" },
			max_file_size: 1024,
			streamable: true,
			date: 1700000000,
			network: "private",
		});
	});

	it("should throw AuthenticationError on 401 without retrying", async () => {
		const fetchMock = jest.fn().mockResolvedValueOnce({
			ok: false,
			status: 401,
			url: "https://uploads.pinata.cloud/v3/files/sign",
			text: jest.fn().mockResolvedValueOnce("Unauthorized"),
		});
		global.fetch = fetchMock;

		await expect(
			createSignedUploadURL(mockConfig, { expires: 60 }, "public"),
		).rejects.toThrow(AuthenticationError);

		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("should throw NetworkError on 4xx (non-429) without retrying", async () => {
		const fetchMock = jest.fn().mockResolvedValueOnce({
			ok: false,
			status: 400,
			url: "https://uploads.pinata.cloud/v3/files/sign",
			text: jest.fn().mockResolvedValueOnce("Bad Request"),
		});
		global.fetch = fetchMock;

		await expect(
			createSignedUploadURL(mockConfig, { expires: 60 }, "public"),
		).rejects.toThrow(NetworkError);

		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});
