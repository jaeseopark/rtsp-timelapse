import './app.css'
import { signal, useSignal } from '@preact/signals'
import ReconnectingWebSocket from "reconnecting-websocket";
import TimeAgo from 'javascript-time-ago'
import TimeAgoLocaleEn from 'javascript-time-ago/locale/en'

TimeAgo.addDefaultLocale(TimeAgoLocaleEn)
const timeFormatter = new TimeAgo("en-US");

const LOCAL_RTSP_URL_KEY = "last-rtsp-url";

type Timelapse = {
  timelapse_id: string;
  created:number;
  updated:number;
  frames:number;
  interval:number;
  remaining:number;
}

const timelapses = signal<Timelapse[]>([])
const socket = new ReconnectingWebSocket("/api/ws", "ws");
socket.onmessage = (({data}) => {
  const timelapse = JSON.parse(data);
  console.log("Incoming update", timelapse);
  timelapses.value = [
    ...timelapses.value.filter(({timelapse_id}) => timelapse_id !== timelapse.timelapse_id),
    timelapse
  ];
})

const getLastRtspUrl = () => {
  const url = localStorage.getItem(LOCAL_RTSP_URL_KEY)
  return url || "rtsp://PLACEHOLDER/stream1";
}

export function App() {
  const sigInterval = useSignal(10);
  const sigDuration = useSignal(20);
  const sigRtspUrl = useSignal(getLastRtspUrl());
  const frames = Math.ceil(sigDuration.value * 60 / sigInterval.value);
  
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
        frames: frames
      }),
    }).then((res) => res.json())
    .then(({timelapse}) => {
      console.log("Timelapse started", timelapse);
      // @ts-ignore
      timelapses.value = [...timelapses.value, timelapse]
      localStorage.setItem(LOCAL_RTSP_URL_KEY, sigRtspUrl.value);
    })
  }

  // @ts-ignore
  const updateInterval = ({target}) => {sigInterval.value = parseFloat(target.value);};

  // @ts-ignore
  const updateDuration = ({target}) => {sigDuration.value = parseFloat(target.value);};

  // @ts-ignore
  const updateUrl = ({target}) => {sigRtspUrl.value = target.value;};

  const getIntervalMessage = () => {
    if (frames < 120) {
      return `Frame count too low; suggested interval=${(sigDuration.value*60/120).toFixed(1)} or less`
    }

    return `The timelapse will be ${(frames / 24).toFixed(1)} seconds long at 24fps.`
  }

  return (
    <div>
      <div className="params">
        <table width="100%">
          <tbody>
            <tr>
              <td>Interval (s)</td>
              <td><input type="number" value={sigInterval.value} min={0} step={.1} onChange={updateInterval} /></td>
            </tr>
            <tr>
              <td />
              <td> <span className="interval-message">{getIntervalMessage()}</span></td>
              </tr>
            <tr>
              <td>Duration (m)</td>
              <td><input type="number" value={sigDuration.value} min={1} step={.1} onChange={updateDuration} /></td>
            </tr>
            <tr>
              <td>URL</td>
              <td><input type="text" style={{"minWidth": "400px"}} value={sigRtspUrl.value} onChange={updateUrl} /></td>
            </tr>
          </tbody>
        </table>
        <button onClick={start}>Start</button>
      </div>
      <table className="history" width="100%">
      <thead>
        <tr>
          <th>Created</th>
          <th>Updated</th>
          <th>Interval</th>
          <th>Progress</th>
        </tr>
      </thead>
      <tbody>
      {timelapses.value.map(({timelapse_id, created, updated, frames, interval, remaining})=> {
        const progressPercentage = (frames - remaining) * 100 / frames ;
        const remainingMinutes = remaining * interval / 60;
        return <tr key={timelapse_id}>
          <td>{timeFormatter.format(created*1000)}</td>
          <td>{timeFormatter.format(updated*1000)}</td>
          <td>{interval} s</td>
          <td>{progressPercentage.toFixed(1)}% ({remainingMinutes.toFixed(1)} m remaining)</td>
        </tr>
})}
      </tbody>
    </table>
    </div>
  )
}
