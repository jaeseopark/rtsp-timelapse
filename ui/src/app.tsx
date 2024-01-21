import './app.css'
import { signal, useSignal } from '@preact/signals'

import ReconnectingWebSocket from "reconnecting-websocket";

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

export function App() {
  const sigInterval = useSignal(10);
  const sigFrames = useSignal(6);
  const sigRtspUrl = useSignal("rtsp://PLACEHOLDER/stream1");
  
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
        frames: sigFrames.value
      }),
    }).then((res) => res.json())
    .then(({timelapse}) => {
      console.log("Timelapse started", timelapse);
      // @ts-ignore
      timelapses.value = [...timelapses.value, timelapse]
    })
  }

  // @ts-ignore
  const updateInterval = ({target}) => {sigInterval.value = target.value;};

  // @ts-ignore
  const updateFrames = ({target}) => {sigFrames.value = target.value;};

  // @ts-ignore
  const updateUrl = ({target}) => {sigRtspUrl.value = target.value;};

  return (
    <div>
      <div className="params">
        <table>
          <tbody>
            <tr>
              <td>Interval (s)</td>
              <td><input type="number" value={sigInterval.value} onChange={updateInterval} /></td>
            </tr>
            <tr>
              <td>Frames</td>
              <td><input type="number" value={sigFrames.value} onChange={updateFrames} /></td>
            </tr>
            <tr>
              <td>URL</td>
              <td><input type="text" style={{"minWidth": "400px"}} value={sigRtspUrl.value} onChange={updateUrl} /></td>
            </tr>
          </tbody>
        </table>
        <button onClick={start}>Start</button>
      </div>
      <table className="history">
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
          <td>{created}</td>
          <td>{updated}</td>
          <td>{interval} s</td>
          <td>{progressPercentage.toFixed(1)}% ({remainingMinutes.toFixed(1)}m remaining)</td>
        </tr>
})}
      </tbody>
    </table>
    </div>
  )
}
