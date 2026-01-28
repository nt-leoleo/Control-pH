import { useContext } from "react";
import Header from "./Header";
import ShowpH from "./ShowpH";
import HandleAdmin from "./HandleAdmin";
import PHBar from "./PHBar";
import PHChart from "./PHChart";
import { PHContext } from "./PHContext";

export default function App() {
  const { ph, setPH } = useContext(PHContext);

  return (
    <>
      <Header />
      <main>
        <ShowpH />
        <HandleAdmin />
        <PHBar ph={ph} />
        <PHChart />
        <input 
          type="number" 
          value={ph} 
          onChange={(e) => setPH(parseFloat(e.target.value))}
          min="6"
          max="8"
          step="0.1"
          style={{
            margin: '2em auto',
            padding: '0.5em',
            fontSize: '1em',
            borderRadius: '0.5em',
            border: 'none',
            backgroundColor: 'rgba(127, 255, 212, 0.2)',
            color: 'whitesmoke'
          }}
        />
      </main>
    </>
  );
}
