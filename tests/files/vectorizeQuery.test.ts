import { vectorizeQuery } from "../../src/core/functions/files/vectorizeQuery";
import type {
  PinataConfig,
  VectorizeQueryResponse,
  VectorizeQuery,
  VectorQueryMatch
} from "../../src/core/types";
import {
  PinataError,
  NetworkError,
  AuthenticationError,
  ValidationError,
} from "../../src/utils/custom-errors";

describe("vectorizeQuery function", () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const mockConfig: PinataConfig = {
    pinataJwt: "test_jwt",
    pinataGateway: "test.cloud",
  };

  const mockMatch: VectorQueryMatch = {
    file_id: "test-id",
    cid: "QmTest",
    score: 0.95
  };

  const mockQuery: VectorizeQuery = {
    groupId: "test-group",
    query: "test query"
  };

  it("should query vectors successfully", async () => {
    const mockResponse: VectorizeQueryResponse = {
      count: 1,
      matches: [mockMatch]
    };

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({ data: mockResponse }),
    });

    const result = await vectorizeQuery(mockConfig, mockQuery);

    expect(global.fetch).toHaveBeenCalledWith(
      "https://uploads.pinata.cloud/v3/vectorize/groups/test-group/query",
      {
        method: "POST",
        headers: {
          Source: "sdk/vectorQuery",
          Authorization: `Bearer ${mockConfig.pinataJwt}`,
        },
        body: JSON.stringify({
          text: mockQuery.query
        }),
      },
    );
    expect(result).toEqual(mockResponse);
  });

  it("should throw ValidationError if config is missing", async () => {
    await expect(vectorizeQuery(undefined, mockQuery)).rejects.toThrow(ValidationError);
  });

  it("should throw AuthenticationError on 401 response", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: jest.fn().mockResolvedValueOnce("Unauthorized"),
    });

    await expect(vectorizeQuery(mockConfig, mockQuery)).rejects.toThrow(AuthenticationError);
  });

  it("should throw NetworkError on non-401 error response", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: jest.fn().mockResolvedValueOnce("Server Error"),
    });

    await expect(vectorizeQuery(mockConfig, mockQuery)).rejects.toThrow(NetworkError);
  });

  it("should throw PinataError on fetch failure", async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValueOnce(new Error("Network failure"));

    await expect(vectorizeQuery(mockConfig, mockQuery)).rejects.toThrow(PinataError);
  });

  it("should throw PinataError on unexpected errors", async () => {
    global.fetch = jest.fn().mockImplementationOnce(() => {
      throw new Error("Unexpected error");
    });

    await expect(vectorizeQuery(mockConfig, mockQuery)).rejects.toThrow(PinataError);
  });

  it("should use custom endpoint if provided", async () => {
    const customConfig: PinataConfig = {
      ...mockConfig,
      uploadUrl: "https://custom.uploads.pinata.cloud",
    };

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({ data: { count: 0, matches: [] } }),
    });

    await vectorizeQuery(customConfig, mockQuery);

    expect(global.fetch).toHaveBeenCalledWith(
      "https://custom.uploads.pinata.cloud/vectorize/groups/test-group/query",
      expect.any(Object),
    );
  });

  it("should use custom headers if provided", async () => {
    const customConfig: PinataConfig = {
      ...mockConfig,
      customHeaders: { "X-Custom-Header": "CustomValue" },
    };

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({ data: { count: 0, matches: [] } }),
    });

    await vectorizeQuery(customConfig, mockQuery);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-Custom-Header": "CustomValue",
        }),
      }),
    );
  });

  // it("should fetch file when returnFile is true", async () => {
  //   const mockVectorResponse: VectorizeQueryResponse = {
  //     count: 1,
  //     matches: [mockMatch]
  //   };

  //   const mockFileResponse = {
  //     data: {
  //       some: "filedata"
  //     },
  //     contentType: "application/json"
  //   };

  //   // First fetch for vector query
  //   global.fetch = jest.fn()
  //     .mockResolvedValueOnce({
  //       ok: true,
  //       json: jest.fn().mockResolvedValueOnce({ data: mockVectorResponse }),
  //     });

  //   // Second fetch for getting file
  //   jest.spyOn(global, 'fetch').mockResolvedValueOnce({
  //     ok: true,
  //     headers: {
  //       get: jest.fn().mockReturnValue('application/json')
  //     },
  //     json: jest.fn().mockResolvedValueOnce(mockFileResponse.data)
  //   });

  //   const result = await vectorizeQuery(mockConfig, { ...mockQuery, returnFile: true });

  //   expect(global.fetch).toHaveBeenCalledTimes(2);
  //   expect(result).toEqual(mockFileResponse);
  // });

  it("should throw PinataError when no matches found with returnFile", async () => {
    const mockVectorResponse: VectorizeQueryResponse = {
      count: 0,
      matches: []
    };

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({ data: mockVectorResponse }),
    });

    await expect(vectorizeQuery(mockConfig, { ...mockQuery, returnFile: true }))
      .rejects.toThrow(PinataError);
  });
});
