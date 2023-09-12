import Image from "next/image";
import { Inter } from "next/font/google";
import React, { useEffect, useState } from "react";
import FFT from "fft.js";
import Plot from "react-plotly.js";

const inter = Inter({ subsets: ["latin"] });

export default function Home() {
  const [psd, setJsonData] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch("/data.json");
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        const data = await response.json();
        const signal = data.slice(0, 512);
        const fft = new FFT(signal.length);

        // Extend the signal with zeros to match the FFT size
        const complexSignal = new Array(signal.length).fill(0);

        // Perform FFT on the complex signal
        const spectrum = fft.createComplexArray();
        fft.realTransform(spectrum, signal);
        const psdData = spectrum.map((value) => Math.log(Math.pow(value, 2)));

        setJsonData(psdData.slice(0, signal.length));

        // setJsonData(psdData);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    }

    fetchData();
  }, []);
  return (
    <main
      className={`flex min-h-screen flex-col items-center justify-between p-24 ${inter.className}`}
    >
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm lg:flex">
        <h2>Power Spectral Density (PSD)</h2>
        {psd && (
          <Plot
            data={[
              {
                x: psd.map((value, index) => index), // X-axis: Frequency bins
                y: psd, // Y-axis: PSD values
                type: "scatter",
                mode: "lines",
                marker: { color: "blue" },
              },
            ]}
            layout={{
              title: "PSD Plot",
              xaxis: { title: "Frequency Bin" },
              yaxis: { title: "PSD" },
            }}
          />
        )}
      </div>
    </main>
  );
}
