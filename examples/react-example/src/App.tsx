import { useState } from "react";
import { pinata } from "./utils/config"
import { NetworkError } from "../../../dist"

function App() {
  const [selectedFile, setSelectedFile]: any = useState();
  const changeHandler = (event: any) => {
    setSelectedFile(event.target.files[0]);
  };

  const handleSubmission = async () => {
    try {
      const upload = await pinata.upload.private.file(selectedFile)
      console.log(upload);
    } catch (e) {
      const error = e as NetworkError
      console.log(error)
    }
  };

  return (
    <>
      <label className="form-label"> Choose File</label>
      <input type="file" onChange={changeHandler} />
      <button onClick={handleSubmission}>Submit</button>
    </>
  );
}

export default App;
