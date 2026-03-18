import { useState } from "react";

function App() {
  const [Total, setTotal] = useState(3235);
  const [CallInc, setCallInc] = useState(0);
  return (
    <div className="App">
      {" "}
      <header>Month Total: {Total}</header>
    </div>
  );
}

export default App;
