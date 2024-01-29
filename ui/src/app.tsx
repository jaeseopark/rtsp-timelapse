import "./app.css";
import { useSignal } from "@preact/signals";
import { timelapses } from "./state";
import History from "./history";

const LOCAL_RTSP_URL_KEY = "last-rtsp-url";
const FPS = 24;

const getLastRtspUrl = () => {
  const url = localStorage.getItem(LOCAL_RTSP_URL_KEY);
  return url || "rtsp://PLACEHOLDER/stream1";
};

const Params = () => {
  const sigVideoDuration = useSignal(8); // seconds
  const sigPrintDuration = useSignal(60); // minutes
  const sigRtspUrl = useSignal(getLastRtspUrl());
  const frames = Math.ceil(sigVideoDuration.value * FPS);
  const interval = (sigPrintDuration.value * 60) / frames;

  const start = () => {
    fetch("/api/timelapses", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: sigRtspUrl.value,
        interval: interval,
        frames: frames,
      }),
    })
      .then((res) => res.json())
      .then(({ timelapse }) => {
        console.log("Timelapse started", timelapse);
        // @ts-ignore
        timelapses.value = [...timelapses.value, timelapse];
        localStorage.setItem(LOCAL_RTSP_URL_KEY, sigRtspUrl.value);
      });
  };

  // @ts-ignore
  const updateVideoDuration = ({ target }) => {
    sigVideoDuration.value = parseFloat(target.value);
  };

  // @ts-ignore
  const updateDuration = ({ target }) => {
    sigPrintDuration.value = parseFloat(target.value);
  };

  // @ts-ignore
  const updateUrl = ({ target }) => {
    sigRtspUrl.value = target.value;
  };

  const getIntervalMessage = (): string => {
    if (interval < 5) {
      // alternative implementation: https://gist.github.com/alfonsrv/a788f8781fb1616e81a6b9cebf1ea2fa
      return `Interval (${interval} s) too low; RTSP server may not be fast enough to create this timelapse.`;
    }

    return `The interval will be ${interval} s at ${FPS} fps.`;
  };

  return (
    <div className="params">
      <table width="100%">
        <tbody>
          <tr>
            <td>Timelapse Duration (s)</td>
            <td>
              <input
                type="number"
                value={sigVideoDuration.value}
                min={0}
                step={0.1}
                onChange={updateVideoDuration}
              />
            </td>
          </tr>
          <tr>
            <td />
            <td>
              <span className="interval-message">{getIntervalMessage()}</span>
            </td>
          </tr>
          <tr>
            <td>Capture Duration (m)</td>
            <td>
              <input
                type="number"
                value={sigPrintDuration.value}
                min={1}
                step={0.1}
                onChange={updateDuration}
              />
            </td>
          </tr>
          <tr>
            <td>URL</td>
            <td>
              <input
                type="text"
                style={{ minWidth: "400px" }}
                value={sigRtspUrl.value}
                onChange={updateUrl}
              />
            </td>
          </tr>
        </tbody>
      </table>
      <button onClick={start}>Start</button>
    </div>
  );
};

export function App() {
  return (
    <div>
      <Params />
      <History />
    </div>
  );
}
