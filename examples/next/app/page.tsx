"use client";

import Image from "next/image";
import { useState } from "react";
import { pinata } from "./utils/pinata";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState("");
  const [link, setLink] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    try {
      setUploadStatus("Getting upload URL...");
      const urlResponse = await fetch("/api/presigned_url");
      const { data } = await urlResponse.json();

      setUploadStatus("Uploading file...");
      const upload = await pinata.upload.public.file(file).url(data);

      if (upload.cid) {
        setUploadStatus("File uploaded successfully!");
        const ipfsLink = await pinata.gateways.public.convert(upload.cid);
        setLink(ipfsLink);
      } else {
        setUploadStatus("Upload failed");
      }
    } catch (error) {
      setUploadStatus(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
        <div className="flex gap-4">
          <Image
            className="dark:invert"
            src="/next.svg"
            alt="Next.js logo"
            width={180}
            height={38}
            priority
          />
          <Image
            src="/pinnie.png"
            alt="pinnie"
            width={100}
            height={200}
            priority
          />
        </div>

        <div className="bg-black/[.05] dark:bg-white/[.06] px-6 py-4 rounded-lg w-full max-w-md">
          <h2 className="text-lg font-semibold mb-4">Upload to Pinata</h2>
          <div className="flex flex-col gap-4">
            <input
              type="file"
              onChange={handleFileChange}
              className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:font-medium
              file:bg-foreground file:text-background hover:file:bg-[#383838] dark:hover:file:bg-[#ccc]"
            />
            <button
              onClick={handleUpload}
              disabled={!file}
              className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Upload to Pinata
            </button>

            {uploadStatus && (
              <p className="text-sm font-[family-name:var(--font-geist-mono)]">{uploadStatus}</p>
            )}

            {link && (
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                View Uploaded File
              </a>
            )}
          </div>
        </div>

      </main>
      <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center">
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/file.svg"
            alt="File icon"
            width={16}
            height={16}
          />
          Learn
        </a>
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/window.svg"
            alt="Window icon"
            width={16}
            height={16}
          />
          Examples
        </a>
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://nextjs.org?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/globe.svg"
            alt="Globe icon"
            width={16}
            height={16}
          />
          Go to nextjs.org →
        </a>
      </footer>
    </div>
  );
}
