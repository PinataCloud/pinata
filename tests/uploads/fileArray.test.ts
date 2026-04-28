import { uploadFileArray } from "../../src/core/functions";
import type {
	PinataConfig,
	UploadOptions,
	UploadResponse,
	CidVersion,
} from "../../src";
import {
	PinataError,
	NetworkError,
	AuthenticationError,
	ValidationError,
} from "../../src/utils/custom-errors";

describe("uploadFileArray function", () => {
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

	const mockFiles = [
		new File(["one"], "a.txt", { type: "text/plain" }),
		new File(["two"], "b.txt", { type: "text/plain" }),
	];

	// Legacy pinFileToIPFS shape (PascalCase keys)
	const mockLegacyResponse = {
		ID: "legacy-id",
		Name: "folder_from_sdk",
		IpfsHash: "QmLegacyDirectory",
		PinSize: 246,
		Timestamp: "2023-01-01T00:00:00Z",
		NumberOfFiles: 2,
		MimeType: "directory",
		GroupId: null,
		Keyvalues: {},
	};

	// v3 envelope-style response (returned by signed-URL endpoint)
	const mockV3Response: UploadResponse = {
		id: "v3-id",
		name: "folder_from_sdk",
		cid: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
		size: 246,
		created_at: "2023-01-01T00:00:00Z",
		number_of_files: 2,
		mime_type: "directory",
		group_id: null,
		keyvalues: {},
		vectorized: false,
		network: "public",
	};

	it("should throw ValidationError if config is missing", async () => {
		await expect(
			uploadFileArray(undefined, mockFiles, "public"),
		).rejects.toThrow(ValidationError);
	});

	describe("legacy pinFileToIPFS path", () => {
		it("should POST to pinFileToIPFS and remap response", async () => {
			global.fetch = jest.fn().mockResolvedValueOnce({
				ok: true,
				json: jest.fn().mockResolvedValueOnce(mockLegacyResponse),
			});

			const result = await uploadFileArray(mockConfig, mockFiles, "public");

			expect(result).toEqual({
				id: "legacy-id",
				name: "folder_from_sdk",
				cid: "QmLegacyDirectory",
				size: 246,
				created_at: "2023-01-01T00:00:00Z",
				number_of_files: 2,
				mime_type: "directory",
				group_id: null,
				keyvalues: {},
				vectorized: false,
				network: "public",
			});

			expect(global.fetch).toHaveBeenCalledWith(
				"https://api.pinata.cloud/pinning/pinFileToIPFS",
				expect.objectContaining({
					method: "POST",
					headers: {
						Source: "sdk/fileArray",
						Authorization: "Bearer test-jwt",
					},
					body: expect.any(FormData),
				}),
			);

			const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
			const formData = fetchCall[1].body as FormData;
			const fileEntries = formData.getAll("file");
			expect(fileEntries).toHaveLength(2);

			const metadata = JSON.parse(formData.get("pinataMetadata") as string);
			expect(metadata.name).toBe("folder_from_sdk");

			const opts = JSON.parse(formData.get("pinataOptions") as string);
			expect(opts.cidVersion).toBe(1);
		});

		it("should respect a custom legacyUploadUrl", async () => {
			global.fetch = jest.fn().mockResolvedValueOnce({
				ok: true,
				json: jest.fn().mockResolvedValueOnce(mockLegacyResponse),
			});

			await uploadFileArray(
				{ ...mockConfig, legacyUploadUrl: "https://custom.example/legacy" },
				mockFiles,
				"public",
			);

			expect(global.fetch).toHaveBeenCalledWith(
				"https://custom.example/legacy",
				expect.any(Object),
			);
		});
	});

	describe("signed URL path (options.url)", () => {
		const signedUrl =
			"https://uploads.pinata.cloud/v3/files/00000000-0000-0000-0000-000000000000?X-Algorithm=PINATA1&X-Signature=abc";

		it("should POST to options.url instead of pinFileToIPFS", async () => {
			global.fetch = jest.fn().mockResolvedValueOnce({
				ok: true,
				json: jest.fn().mockResolvedValueOnce({ data: mockV3Response }),
			});

			const result = await uploadFileArray(mockConfig, mockFiles, "public", {
				url: signedUrl,
			});

			expect(result).toEqual(mockV3Response);
			expect(global.fetch).toHaveBeenCalledTimes(1);

			const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
			expect(fetchCall[0]).toBe(signedUrl);
			expect(fetchCall[1].method).toBe("POST");
		});

		it("should never hit the legacy pinFileToIPFS endpoint", async () => {
			global.fetch = jest.fn().mockResolvedValueOnce({
				ok: true,
				json: jest.fn().mockResolvedValueOnce({ data: mockV3Response }),
			});

			await uploadFileArray(mockConfig, mockFiles, "public", {
				url: signedUrl,
			});

			const calls = (global.fetch as jest.Mock).mock.calls;
			for (const call of calls) {
				expect(call[0]).not.toContain("api.pinata.cloud/pinning/pinFileToIPFS");
			}
		});

		it("should send the v3 directory shape, not the legacy pinata* fields", async () => {
			global.fetch = jest.fn().mockResolvedValueOnce({
				ok: true,
				json: jest.fn().mockResolvedValueOnce({ data: mockV3Response }),
			});

			const options: UploadOptions = {
				url: signedUrl,
				groupId: "group-1",
				metadata: {
					name: "my-folder",
					keyvalues: { env: "prod" },
				},
				cid_version: "v1" as CidVersion,
				expires_at: 1735689600,
				streamable: true,
				car: true,
			};

			await uploadFileArray(mockConfig, mockFiles, "public", options);

			const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
			const formData = fetchCall[1].body as FormData;

			expect(formData.get("name")).toBe("my-folder");
			expect(formData.get("network")).toBe("public");
			expect(formData.get("group_id")).toBe("group-1");
			expect(formData.get("keyvalues")).toBe(JSON.stringify({ env: "prod" }));
			expect(formData.get("cid_version")).toBe("v1");
			expect(formData.get("expires_at")).toBe("1735689600");
			expect(formData.get("streamable")).toBe("true");
			expect(formData.get("car")).toBe("true");

			expect(formData.get("pinataMetadata")).toBeNull();
			expect(formData.get("pinataOptions")).toBeNull();
		});

		it("should preserve webkitRelativePath when present, otherwise prefix with folder name", async () => {
			global.fetch = jest.fn().mockResolvedValueOnce({
				ok: true,
				json: jest.fn().mockResolvedValueOnce({ data: mockV3Response }),
			});

			const fileWithPath = new File(["x"], "nested.txt", {
				type: "text/plain",
			});
			Object.defineProperty(fileWithPath, "webkitRelativePath", {
				value: "my-folder/sub/nested.txt",
			});
			const fileWithoutPath = new File(["y"], "plain.txt", {
				type: "text/plain",
			});

			await uploadFileArray(
				mockConfig,
				[fileWithPath, fileWithoutPath],
				"public",
				{
					url: "https://uploads.pinata.cloud/v3/files/test",
					metadata: { name: "the-folder" },
				},
			);

			const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
			const formData = fetchCall[1].body as FormData;
			const entries = formData.getAll("file") as File[];

			expect(entries).toHaveLength(2);
			expect(entries[0].name).toBe("my-folder/sub/nested.txt");
			expect(entries[1].name).toBe("the-folder/plain.txt");
		});

		it("should send Bearer header containing the empty JWT for browser/signed-URL flow", async () => {
			global.fetch = jest.fn().mockResolvedValueOnce({
				ok: true,
				json: jest.fn().mockResolvedValueOnce({ data: mockV3Response }),
			});

			await uploadFileArray({ pinataJwt: "" }, mockFiles, "public", {
				url: "https://uploads.pinata.cloud/v3/files/test",
			});

			const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
			expect(fetchCall[1].headers.Authorization).toBe("Bearer ");
		});

		it("should unwrap response.data and not remap legacy fields", async () => {
			global.fetch = jest.fn().mockResolvedValueOnce({
				ok: true,
				json: jest.fn().mockResolvedValueOnce({ data: mockV3Response }),
			});

			const result = await uploadFileArray(mockConfig, mockFiles, "public", {
				url: "https://uploads.pinata.cloud/v3/files/test",
			});

			expect(result.cid).toBe(mockV3Response.cid);
			expect(result.mime_type).toBe("directory");
		});

		it("should throw AuthenticationError on 401", async () => {
			global.fetch = jest.fn().mockResolvedValueOnce({
				ok: false,
				status: 401,
				url: "https://uploads.pinata.cloud/v3/files/test",
				text: jest.fn().mockResolvedValueOnce("token is malformed"),
			});

			await expect(
				uploadFileArray(mockConfig, mockFiles, "public", {
					url: "https://uploads.pinata.cloud/v3/files/test",
				}),
			).rejects.toThrow(AuthenticationError);
		});

		it("should throw NetworkError on non-auth error response", async () => {
			global.fetch = jest.fn().mockResolvedValueOnce({
				ok: false,
				status: 400,
				url: "https://uploads.pinata.cloud/v3/files/test",
				text: jest
					.fn()
					.mockResolvedValueOnce(
						"Presigned URL does not grant permissions to upload detected MIME type: directory",
					),
			});

			await expect(
				uploadFileArray(mockConfig, mockFiles, "public", {
					url: "https://uploads.pinata.cloud/v3/files/test",
				}),
			).rejects.toThrow(NetworkError);
		});

		it("should throw PinataError when fetch itself rejects", async () => {
			global.fetch = jest
				.fn()
				.mockRejectedValueOnce(new Error("Network failure"));

			await expect(
				uploadFileArray(mockConfig, mockFiles, "public", {
					url: "https://uploads.pinata.cloud/v3/files/test",
				}),
			).rejects.toThrow(PinataError);
		});

		it("should pass network=private through to FormData", async () => {
			global.fetch = jest.fn().mockResolvedValueOnce({
				ok: true,
				json: jest.fn().mockResolvedValueOnce({
					data: { ...mockV3Response, network: "private" },
				}),
			});

			await uploadFileArray(mockConfig, mockFiles, "private", {
				url: "https://uploads.pinata.cloud/v3/files/test",
			});

			const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
			const formData = fetchCall[1].body as FormData;
			expect(formData.get("network")).toBe("private");
		});
	});
});
