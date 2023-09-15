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
  NumberRange,
  LogarithmicAxis,
  ENumericFormat,
} from "scichart";

const fftCount = 50;
const fftSize = 128; // TODO SET SAME VALUE ON SERVER
const sampleRate = 10;
const freqSpacing = sampleRate / 2 / fftSize;
const numChannels = 32;

const showFFTs = false;
const showSpectrograms = true;
const showCouplingIndices = true;
const couplingIndexWindow = 50;

const inter = Inter({ subsets: ["latin"] });

// TODO dictionary of source-detector pair (1-16) to corresp channel numbers (0-31)
const SDPairToChannel = {
  1: [0, 1],
  2: [2, 3],
  3: [4, 5],
  4: [6, 7],
  5: [8, 9],
  6: [10, 11],
  7: [12, 13],
  8: [14, 15],
  9: [16, 17],
  10: [18, 19],
  11: [20, 21],
  12: [22, 23],
  13: [24, 25],
  14: [26, 27],
  15: [28, 29],
  16: [30, 31],
};

const SDPairToDescription = {
  1: "S1 <> D1",
  2: "S1 <> D2",
  3: "S1 <> D3",
  4: "S1 <> D4",
  5: "S2 <> D1",
  6: "S2 <> D2",
  7: "S2 <> D3",
  8: "S2 <> D4",
  9: "S3 <> D5",
  10: "S3 <> D6",
  11: "S3 <> D7",
  12: "S3 <> D8",
  13: "S4 <> D5",
  14: "S4 <> D6",
  15: "S4 <> D7",
  16: "S4 <> D8",
};

async function initCharts() {
  // WebSocket URL -  35.186.191.80:8080 if external server, 127.0.0.1:8080 if local
  const socketURL = "ws://35.186.191.80:8080/";
  // Create a WebSocket connection
  const socket = new WebSocket(socketURL);
  // Create another socket URL and connection
  const anotherSocketURL = "ws://35.186.191.80:8081/";
  const anotherSocket = new WebSocket(anotherSocketURL);
  let xyDScharts = [];
  let spectrogramDScharts = [];
  let spectrogramValuesAllChannels = [];
  let indexCharts = [];
  let scalpCouplingIndices = [];

  if (showCouplingIndices) {
    for (let i = 0; i < numChannels / 2; i++) {
      let initCouplingData = Array(couplingIndexWindow).fill(0);
      const indexChart = await initFFTChart(
        initCouplingData,
        `index-${i + 1}`,
        "white",
        false
      );
      indexCharts.push(indexChart);
      scalpCouplingIndices.push(initCouplingData);
    }
  }

  for (let i = 0; i < numChannels; i++) {
    if (showFFTs) {
      const xyDS = await initFFTChart(
        Array(fftSize).fill(0),
        `scichart-root-${i}`,
        "steelblue"
      );
      xyDScharts.push(xyDS);
    }
    if (showSpectrograms) {
      // initialize spectrogram values to a fftCount x fftSize array of 0s
      let spectrogramValues = Array(fftCount)
        .fill()
        .map(() => Array(fftSize).fill(0));
      const spectrogramDS = await initSpectrogramChart(
        spectrogramValues,
        `spectrogram-${i}`
      );
      spectrogramDScharts.push(spectrogramDS);
      spectrogramValuesAllChannels.push(spectrogramValues);
    }
  }

  // Handle incoming data on socket for FFT & spectrogram
  socket.addEventListener("message", (event) => {
    console.log(`received data ${event}`);
    let data = event.data;
    let parsed = JSON.parse(data);
    for (let i = 0; i < numChannels; i++) {
      if (parsed[i]) {
        // do FFT on parsed[i] data
        const psdData = doFFT(parsed[i]);
        let x = psdData.map((_, index) => index * freqSpacing);
        // update FFT chart i
        if (showFFTs) {
          xyDScharts[i].clear();
          xyDScharts[i].appendRange(x, psdData);
        }
        // let max = Math.max(...psdData);
        // console.log("max value: ", max);
        // update spectrogram chart i
        if (showSpectrograms) {
          spectrogramValuesAllChannels[i].shift();
          spectrogramValuesAllChannels[i].push(psdData);
          spectrogramDScharts[i].setZValues(spectrogramValuesAllChannels[i]);
        }
      }
    }
  });

  // handle incoming data on anotherSocket for coupling indices
  if (showCouplingIndices) {
    anotherSocket.addEventListener("message", (event) => {
      console.log(`received coupling index ${event}`);
      let data = event.data;
      let parsed = JSON.parse(data);
      // console.log("parsed", parsed);
      // update coupling index charts
      for (let i = 0; i < numChannels / 2; i++) {
        scalpCouplingIndices[i].shift();
        scalpCouplingIndices[i].push(parsed[i]);
        indexCharts[i].clear();
        let xVals = Array.from(
          { length: couplingIndexWindow },
          (_, index) => index
        );
        indexCharts[i].appendRange(xVals, scalpCouplingIndices[i]);
      }
    });
  }
}

async function initFFTChart(data, divId, colour, doFourier = true) {
  // LICENSING
  // Commercial licenses set your license code here
  // Purchased license keys can be viewed at https://www.scichart.com/profile
  // How-to steps at https://www.scichart.com/licensing-scichart-js/
  // SciChartSurface.setRuntimeLicenseKey(
  //   "KaVEKkK+l4Ju2dJG8VMHXz76WtUxjNXp6YiAUlSH9LYGi9A5U69GaQCcVRCj/imnBfeHC6mbFXtsJufzS0JB2xrnAsQoHxMFaifN9460/Moc4BrXys2tfvayObZNoMkrh66iPG/a6wCNaeLLtqDE/YqdrmR+22pRt9k4Vu6gmdi/bDq9SuMoO/tsA5HFgmiRXfJcqj8O1LvfIZRMqmZKNE3dAr7kIQvjfK9GputCJoQL96JahutpcRun60RkIiEfPBCEPJvynHZdNkUNAyrjuETEfgzinU4/rAypgARbHMtfS5oZ+0W5XW6+3KdShlM7bA2ezmF3N0E8ln1mWtODVrcCpc5+xQLj7bFfEheAapTo8EISgDHPXtEmC3XBKJ/bU26JEeFt+n9fc4r/YRzwUeRTDFu72CnnyFxHwLR3EJaOlEaOiVl6pqGb3jCswwll1BcgbZWh5/cA4b17ssbgIGhHOQFAWHMkExHM8BvB+/ZEAN0ErK3rhywGP/doHFqJcDwrtaDbiSTSapjjpLDWSA3QtnddqIJrLMbXpNyR0EXx3Q98Wdl6ZyPcgu+dKQ=="
  // );
  SciChartSurface.UseCommunityLicense();

  // Initialize SciChartSurface. Don't forget to await!
  const { sciChartSurface, wasmContext } = await SciChartSurface.create(divId, {
    theme: new SciChartJsNavyTheme(),
    title: doFourier
      ? "Power spectrum of signal " + divId.split("-")[1]
      : "Coupling index of channel " + divId.split("-")[1],
    titleStyle: { fontSize: 12, placeWithinChart: true },
  });
  let fftDS = new XyDataSeries(wasmContext, {
    xValues: data.map((value, index) =>
      doFourier ? index * freqSpacing : index
    ),
    yValues: data,
  });

  // Create an XAxis and YAxis with growBy padding
  const growBy = new NumberRange(0.1, 0.1);
  sciChartSurface.xAxes.add(
    new NumericAxis(wasmContext, {
      ...(doFourier
        ? { axisTitle: "frequency (Hz)", axisTitleStyle: { fontSize: 12 } }
        : {}),
      ...(!doFourier ? { drawLabels: false } : {}),
      growBy,
    })
  );
  if (doFourier) {
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
  } else {
    sciChartSurface.xAxes.DrawLabels = false;
    sciChartSurface.yAxes.add(
      new NumericAxis(wasmContext, {
        autoRange: EAutoRange.Always,
        growBy,
      })
    );
  }

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
  const signal = data.slice(0, fftSize);
  const fft = new FFT(signal.length);

  // Extend the signal with zeros to match the FFT size
  const complexSignal = new Array(signal.length).fill(0);

  // Perform FFT on the complex signal
  const spectrum = fft.createComplexArray();
  fft.realTransform(spectrum, signal);
  return spectrum.map((value) => Math.pow(value, 2)).slice(0, signal.length);
}

async function initSpectrogramChart(spectrogramValues, divId) {
  SciChartSurface.UseCommunityLicense();
  const { sciChartSurface, wasmContext } = await SciChartSurface.create(divId, {
    theme: new SciChartJsNavyTheme(),
    title: "Spectrogram " + divId.split("-")[1],
    titleStyle: { fontSize: 12, placeWithinChart: true },
  });

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
      maximum: 503345012, // TODO take printed max value, reduce by 2-3 orders of magnitude
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
  useEffect(() => {
    let promise = initCharts();
  }, []);
  return (
    <main
      className={`flex min-h-screen flex-col items-center justify-between p-16 ${inter.className}`}
    >
      <div className="z-10 max-w-8xl w-full items-center justify-between font-mono text-sm">
        <h2>Power Spectral Density (PSD) & Spectrograms</h2>
        <div className="flex flex-wrap space-between">
          {showFFTs &&
            Array(numChannels)
              .fill(0)
              .map((_, i) => (
                <div
                  key={`fft-${i}`}
                  id={`scichart-root-${i}`}
                  className="charts"
                />
              ))}

          {showSpectrograms &&
            Object.keys(SDPairToChannel).map((key) => (
              <div key={`SDpair-${key}`} className="charts">
                <h3 className="text-center">
                  SD Pair {key} ({SDPairToDescription[key]})
                </h3>
                <div key={`index-${key}`} id={`index-${key}`} />
                {SDPairToChannel[key].map((channel, _) => (
                  <div key={`spec-${channel}`} id={`spectrogram-${channel}`} />
                ))}
              </div>
            ))}
        </div>
      </div>
    </main>
  );
}
