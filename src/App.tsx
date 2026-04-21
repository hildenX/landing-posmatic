import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Pagar from "./pages/Pagar";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/pagar" element={<Pagar />} />
        <Route path="/pagar.html" element={<Pagar />} />
      </Routes>
    </BrowserRouter>
  );
}
