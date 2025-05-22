import { useState } from "react";
import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import pinataLogo from "/pinnie.png";
import "./App.css";
import { useUpload, convert } from "pinata/react";

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [link, setLink] = useState("");

  const { upload, uploadResponse, loading, error, progress, pause, resume, cancel } = useUpload();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    const urlRes = await fetch(`${import.meta.env.VITE_SERVER_URL}/presigned_url`);
    const urlData = await urlRes.json();

    try {
      // Use the upload function from useUpload hook
      await upload(file, "public", urlData.url, {
        metadata: {
          name: file.name || "Upload from Web",
          keyvalues: {
            app: "Pinata Web Demo",
            timestamp: Date.now().toString(),
          },
        },
      });
    } catch (uploadError) {
      console.error("Upload error:", uploadError);
    }
  };

  // Set the link when upload is successful
  if (uploadResponse && !link) {
    async function setIpfsLink() {
      let ipfsLink: string = "";
      if (typeof uploadResponse === "string") {
        ipfsLink = await convert(uploadResponse, "https://ipfs.io");
      } else if (uploadResponse) {
        ipfsLink = await convert(uploadResponse.cid, "https://ipfs.io");
      }
      setLink(ipfsLink);
    }
    setIpfsLink();
  }

  // Get upload status message
  const getStatusMessage = () => {
    if (loading) return `Uploading file to Pinata...`;
    if (error) return `Upload error: ${error?.message || "Unknown error"}`;
    return "";
  };

  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
        <a href="https://pinata.cloud" target="_blank">
          <img src={pinataLogo} className="logo pinata" alt="Pinata logo" />
        </a>
      </div>
      <h1>Vite + React + Pinata</h1>
      <div className="card">
        <input type="file" onChange={handleFileChange} />
        <button onClick={handleUpload} disabled={!file || loading}>
          {loading ? "Uploading..." : "Upload to Pinata"}
        </button>

        {loading && (
          <div className="upload-status-container">
            <p>{getStatusMessage()}</p>

            <div className="upload-controls-container">
              {progress < 100 && (
                <>
                  <button onClick={pause} className="control-button pause">
                    Pause
                  </button>
                  <button onClick={resume} className="control-button resume">
                    Resume
                  </button>
                  <button onClick={cancel} className="control-button cancel">
                    Cancel
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {!loading && getStatusMessage() && <p>{getStatusMessage()}</p>}

        {link && (
          <div className="success-container">
            <p className="success-title">Upload Complete!</p>
            <a href={link} target="_blank" className="view-link">
              View File
            </a>
          </div>
        )}
      </div>
      <p className="read-the-docs">Click on the Vite and React logos to learn more</p>
    </>
  );
}

export default App;
