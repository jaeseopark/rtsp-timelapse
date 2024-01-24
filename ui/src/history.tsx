import TimeAgo from "javascript-time-ago";
import TimeAgoLocaleEn from "javascript-time-ago/locale/en";
import { timelapses } from "./state";
import ReconnectingWebSocket from "reconnecting-websocket";

TimeAgo.addDefaultLocale(TimeAgoLocaleEn);
const timeFormatter = new TimeAgo("en-US");

const CANCELLING_CODE = -2;
const CANCELLED_CODE = -1;

const socket = new ReconnectingWebSocket("/api/ws", "ws");
socket.onmessage = ({ data }) => {
  const timelapse = JSON.parse(data);
  console.log("Incoming update", timelapse);
  timelapses.value = [
    ...timelapses.value.filter(
      ({ timelapse_id }) => timelapse_id !== timelapse.timelapse_id,
    ),
    timelapse,
  ];
};

const History = () => {
  const cancel = (timelapse_id: string): Promise<{ result: string }> =>
    fetch(`/api/timelapses/${timelapse_id}`, {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    }).then((res) => res.json());

  return (
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
        {timelapses.value.map(
          ({ timelapse_id, created, updated, frames, interval, remaining }) => {
            const getProgressCell = () => {
              if (remaining === CANCELLED_CODE) {
                return <td>Cancelled</td>;
              }
              if (remaining === CANCELLING_CODE) {
                return <td>Cancelling...</td>;
              }

              const handleCancelClick = () =>
                cancel(timelapse_id).then(({ result }) => {
                  if (result !== "success") {
                    // TODO: handle error
                  }
                });

              const remainingMinutes = (remaining * interval) / 60;
              const text = `${progressPercentage.toFixed(1)}% (${remainingMinutes.toFixed(1)} m remaining`;
              return (
                <td>
                  <span>{text}</span>
                  <button onClick={handleCancelClick}>Cancel</button>
                </td>
              );
            };
            const progressPercentage = ((frames - remaining) * 100) / frames;
            return (
              <tr key={timelapse_id}>
                <td>{timeFormatter.format(created * 1000)}</td>
                <td>{timeFormatter.format(updated * 1000)}</td>
                <td>{interval} s</td>
                {getProgressCell()}
              </tr>
            );
          },
        )}
      </tbody>
    </table>
  );
};

export default History;
