import "./app.css";
import { useSignal } from "@preact/signals";
import { timelapses } from "./state";
import History from "./history";

const LOCAL_RTSP_URL_KEY = "last-rtsp-url";

const getLastRtspUrl = () => {
  const url = localStorage.getItem(LOCAL_RTSP_URL_KEY);
  return url || "rtsp://PLACEHOLDER/stream1";
};

const Params = () => {
  const sigInterval = useSignal(10);
  const sigDuration = useSignal(20);
  const sigRtspUrl = useSignal(getLastRtspUrl());
  const frames = Math.ceil((sigDuration.value * 60) / sigInterval.value);

  const start = () => {
    fetch("/api/timelapses", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: sigRtspUrl.value,
        interval: sigInterval.value,
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
  const updateInterval = ({ target }) => {
    sigInterval.value = parseFloat(target.value);
  };

  // @ts-ignore
  const updateDuration = ({ target }) => {
    sigDuration.value = parseFloat(target.value);
  };

  // @ts-ignore
  const updateUrl = ({ target }) => {
    sigRtspUrl.value = target.value;
  };

  const getIntervalMessage = () => {
    if (frames < 120) {
      return `Frame count too low; suggested interval=${((sigDuration.value * 60) / 120).toFixed(1)} or less`;
    }

    return `The timelapse will be ${(frames / 24).toFixed(1)} seconds long at 24fps.`;
  };

  return (
    <div className="params">
      <table width="100%">
        <tbody>
          <tr>
            <td>Interval (s)</td>
            <td>
              <input
                type="number"
                value={sigInterval.value}
                min={0}
                step={0.1}
                onChange={updateInterval}
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
            <td>Duration (m)</td>
            <td>
              <input
                type="number"
                value={sigDuration.value}
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
