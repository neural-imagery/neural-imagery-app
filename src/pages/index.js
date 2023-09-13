import Image from "next/image";
import { Inter } from "next/font/google";
import React, { useEffect, useState } from "react";
import FFT from "fft.js";
// import Plot from "react-plotly.js";
import {
  SciChartSurface,
  NumericAxis,
  FastLineRenderableSeries,
  XyDataSeries,
  EllipsePointMarker,
  SweepAnimation,
  SciChartJsNavyTheme,
  SciChartJsTheme,
  NumberRange,
  LogarithmicAxis,
  ENumericFormat,
} from "scichart";

const inter = Inter({ subsets: ["latin"] });

async function initSciChart(data, divId, colour) {
  let fftDS;
  // LICENSING
  // Commercial licenses set your license code here
  // Purchased license keys can be viewed at https://www.scichart.com/profile
  // How-to steps at https://www.scichart.com/licensing-scichart-js/
  SciChartSurface.setRuntimeLicenseKey(
    "KaVEKkK+l4Ju2dJG8VMHXz76WtUxjNXp6YiAUlSH9LYGi9A5U69GaQCcVRCj/imnBfeHC6mbFXtsJufzS0JB2xrnAsQoHxMFaifN9460/Moc4BrXys2tfvayObZNoMkrh66iPG/a6wCNaeLLtqDE/YqdrmR+22pRt9k4Vu6gmdi/bDq9SuMoO/tsA5HFgmiRXfJcqj8O1LvfIZRMqmZKNE3dAr7kIQvjfK9GputCJoQL96JahutpcRun60RkIiEfPBCEPJvynHZdNkUNAyrjuETEfgzinU4/rAypgARbHMtfS5oZ+0W5XW6+3KdShlM7bA2ezmF3N0E8ln1mWtODVrcCpc5+xQLj7bFfEheAapTo8EISgDHPXtEmC3XBKJ/bU26JEeFt+n9fc4r/YRzwUeRTDFu72CnnyFxHwLR3EJaOlEaOiVl6pqGb3jCswwll1BcgbZWh5/cA4b17ssbgIGhHOQFAWHMkExHM8BvB+/ZEAN0ErK3rhywGP/doHFqJcDwrtaDbiSTSapjjpLDWSA3QtnddqIJrLMbXpNyR0EXx3Q98Wdl6ZyPcgu+dKQ=="
  );

  // Initialize SciChartSurface. Don't forget to await!
  const { sciChartSurface, wasmContext } = await SciChartSurface.create(divId, {
    theme: new SciChartJsNavyTheme(),
    title: "Power spectrum of signal",
    titleStyle: { fontSize: 14 },
  });
  fftDS = new XyDataSeries(wasmContext, {
    xValues: data.map((value, index) => index * 0.01),
    yValues: data,
  });

  function updateAnalysers(fftXValues, fftData) {
    // Update FFT Chart. Clear() and appendRange() is a fast replace for data (if same size)
    fftDS.clear();
    // console.log({ fftXValues, fftData });
    fftDS.appendRange(fftXValues, fftData);
  }

  // Create an XAxis and YAxis with growBy padding
  const growBy = new NumberRange(0.1, 0.1);
  sciChartSurface.xAxes.add(
    new NumericAxis(wasmContext, {
      axisTitle: "frequency (Hz)",
      axisTitleStyle: { fontSize: 12 },
      growBy,
    })
  );
  sciChartSurface.yAxes.add(
    new LogarithmicAxis(wasmContext, {
      axisTitle: "Power",
      axisTitleStyle: { fontSize: 12 },
      logBase: 10,
      // Format with E
      labelFormat: ENumericFormat.Exponential,
      labelPrecision: 1,
      minorsPerMajor: 1,
      // Adjust major/minor gridline style to make it clearer for the demo
      majorGridLineStyle: { color: "#50C7E077" },
      minorGridLineStyle: { color: "#50C7E033" },
      visibleRange: new NumberRange(1, 1000_000_000),
      growBy,
    })
  );

  // Create a line series with some initial data
  sciChartSurface.renderableSeries.add(
    new FastLineRenderableSeries(wasmContext, {
      stroke: colour,
      strokeThickness: 1,
      dataSeries: fftDS,
      pointMarker: new EllipsePointMarker(wasmContext, {
        width: 1,
        height: 1,
        fill: "#fff",
      }),
      animation: new SweepAnimation({ duration: 300, fadeEffect: true }),
    })
  );
  // let frameCounter = 0;
  // const updateChart = () => {
  //   if (frameCounter > data.length - 512) {
  //     frameCounter = 0;
  //   }
  //   // if (!dataProvider.isDeleted) {
  //   let y = doFFT(data.slice(frameCounter, frameCounter + 512));
  //   let x = y.map((value, index) => index * 0.01);
  //   updateAnalysers(x, y);
  //   frameCounter++;
  //   let timerId = setTimeout(updateChart, 20);
  //   // }
  // };
  // updateChart();

  return sciChartSurface;
}

function doFFT(data) {
  const signal = data.slice(0, 512);
  const fft = new FFT(signal.length);

  // Extend the signal with zeros to match the FFT size
  const complexSignal = new Array(signal.length).fill(0);

  // Perform FFT on the complex signal
  const spectrum = fft.createComplexArray();
  fft.realTransform(spectrum, signal);
  return spectrum.map((value) => Math.pow(value, 2)).slice(0, signal.length);
}

export default function Home() {
  const [json, setJsonData] = useState(null);
  const [noise, setNoiseData] = useState(null);
  // json will be set to the FFT data

  useEffect(() => {
    // WebSocket URL - Replace with your WebSocket server URL
    const socketURL = "ws://35.186.191.80:8080/";
    // Create a WebSocket connection
    const socket = new WebSocket(socketURL);

    // Handle incoming messages
    socket.addEventListener("message", (event) => {
      console.log(`event ${event}`);
      let data = event.data;
      let parsed = JSON.parse(data);
      setJsonData(parsed);
      const psdData = doFFT(parsed["data"]);
      const noiseFFT = doFFT(parsed["noise"]);
      setJsonData(psdData);
      setNoiseData(noiseFFT);
    });
    // async function fetchData() {
    //   try {
    //     const response = await fetch("/data1.json");
    //     if (!response.ok) {
    //       throw new Error("Network response was not ok");
    //     }
    //     const data = await response.json();

    //     // const psdData = doFFT(data);

    //     setJsonData(data);

    //     // setJsonData(psdData);
    //   } catch (error) {
    //     console.error("Error fetching data:", error);
    //   }
    // }
    // fetchData();
  }, []);
  useEffect(() => {
    if (!json) return;
    const chartInitializationPromise = initSciChart(
      json,
      "scichart-root",
      "steelblue"
    );
    const another = initSciChart(noise, "another", "white");
  }, [json]);
  return (
    <main
      className={`flex min-h-screen flex-col items-center justify-between p-24 ${inter.className}`}
    >
      <div className="z-10 max-w-7xl w-full items-center justify-between font-mono text-sm">
        <h2>Power Spectral Density (PSD)</h2>
        <div className="flex flex-wrap space-between">
          <div id="scichart-root" className="charts" />
          <div id="another" className="charts" />
        </div>
      </div>
    </main>
  );
}
