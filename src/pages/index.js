import Image from "next/image";
import { Inter } from "next/font/google";
import React, { useEffect, useState } from "react";
import FFT from "fft.js";
// import Plot from "react-plotly.js";
import {
  EAutoRange,
  UniformHeatmapDataSeries,
  UniformHeatmapRenderableSeries,
  HeatmapColorMap,
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

const fftCount = 50;
const fftSize = 512;

const inter = Inter({ subsets: ["latin"] });

async function initCharts() {
  // WebSocket URL - Replace with your WebSocket server URL
  const socketURL = "ws://35.186.191.80:8080/";
  // Create a WebSocket connection
  const socket = new WebSocket(socketURL);

  const xyDS = await initFFTChart(
    Array(512).fill(0),
    "scichart-root",
    "steelblue"
  );
  const xyDS2 = await initFFTChart(Array(512).fill(0), "another", "white");

  let spectrogramValues = new Array(fftCount);
  for (let i = 0; i < fftCount; i++) {
    spectrogramValues[i] = new Array(fftSize);
    for (let j = 0; j < fftSize; j++) {
      spectrogramValues[i][j] = 0;
    }
  }
  const spectrogramDS = await initSpectogramChart(spectrogramValues);

  // Handle incoming messages
  socket.addEventListener("message", (event) => {
    console.log(`event ${event}`);
    let data = event.data;
    let parsed = JSON.parse(data);
    const psdData = doFFT(parsed["data"]);
    const noiseFFT = doFFT(parsed["noise"]);
    let x = psdData.map((value, index) => index * 0.01);
    // update FFT charts
    xyDS.clear();
    xyDS.appendRange(x, psdData);
    xyDS2.clear();
    xyDS2.appendRange(x, noiseFFT);
    // update spectrogram
    // console.log(psdData);
    // print max of psdData
    let max = Math.max(...psdData);
    console.log(max);
    spectrogramValues.shift();
    spectrogramValues.push(psdData);
    spectrogramDS.setZValues(spectrogramValues);
  });
}
async function initFFTChart(data, divId, colour) {
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
  let fftDS = new XyDataSeries(wasmContext, {
    xValues: data.map((value, index) => index * 0.01),
    yValues: data,
  });

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

  return fftDS;
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

async function initSpectogramChart(spectrogramValues) {
  const { sciChartSurface, wasmContext } = await SciChartSurface.create(
    "spectrogram",
    {
      theme: new SciChartJsNavyTheme(),
      title: "Spectrogram Chart",
      titleStyle: { fontSize: 14 },
    }
  );

  const xAxis = new NumericAxis(wasmContext, {
    autoRange: EAutoRange.Always,
    drawLabels: false,
    drawMinorTickLines: false,
    drawMajorTickLines: false,
  });
  sciChartSurface.xAxes.add(xAxis);

  const yAxis = new NumericAxis(wasmContext, {
    autoRange: EAutoRange.Always,
    drawLabels: false,
    drawMinorTickLines: false,
    drawMajorTickLines: false,
  });
  sciChartSurface.yAxes.add(yAxis);

  let spectrogramDS = new UniformHeatmapDataSeries(wasmContext, {
    xStart: 0,
    xStep: 1,
    yStart: 0,
    yStep: 1,
    zValues: spectrogramValues,
  });

  const rs = new UniformHeatmapRenderableSeries(wasmContext, {
    dataSeries: spectrogramDS,
    colorMap: new HeatmapColorMap({
      minimum: 0,
      maximum: 5000000000, // TODO EDIT THIS TO FIT DATA
      gradientStops: [
        { offset: 0, color: "#000000" },
        { offset: 0.25, color: "#800080" },
        { offset: 0.5, color: "#FF0000" },
        { offset: 0.75, color: "#FFFF00" },
        { offset: 1, color: "#FFFFFF" },
      ],
    }),
  });
  sciChartSurface.renderableSeries.add(rs);

  return spectrogramDS;
}

export default function Home() {
  const [json, setJsonData] = useState(null);
  const [noise, setNoiseData] = useState(null);
  // json will be set to the FFT data

  useEffect(() => {
    let promise = initCharts();
  }, []);
  return (
    <main
      className={`flex min-h-screen flex-col items-center justify-between p-24 ${inter.className}`}
    >
      <div className="z-10 max-w-7xl w-full items-center justify-between font-mono text-sm">
        <h2>Power Spectral Density (PSD)</h2>
        <div className="flex flex-wrap space-between">
          <div id="scichart-root" className="charts" />
          <div id="another" className="charts" />
          <div id="spectrogram" className="charts" />
        </div>
      </div>
    </main>
  );
}
