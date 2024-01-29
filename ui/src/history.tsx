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
          <th>Capture Duration</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {timelapses.value.map(
          ({ timelapse_id, created, updated, frames, interval, remaining }) => {
            const getStatusCell = (): string | JSX.Element => {
              if (remaining === CANCELLED_CODE) {
                return "Cancelled";
              }
              if (remaining === CANCELLING_CODE) {
                return "Cancelling...";
              }
              if (remaining === 0) {
                return "100%";
              }

              const handleCancelClick = () =>
                cancel(timelapse_id).then(({ result }) => {
                  if (result !== "success") {
                    // TODO: handle error
                  }
                });

              const remainingMinutes = (remaining * interval) / 60;
              const progressPercentage = ((frames - remaining) * 100) / frames;
              const text = `${progressPercentage.toFixed(1)}% (${remainingMinutes.toFixed(1)} m remaining)`;
              return (
                <>
                  <span>{text}</span>
                  {progressPercentage < 100 && (
                    <button
                      style={{ marginLeft: "5px" }}
                      onClick={handleCancelClick}
                    >
                      Cancel
                    </button>
                  )}
                </>
              );
            };
            return (
              <tr key={timelapse_id}>
                <td style={{ paddingInline: "1em", textAlign: "center" }}>
                  {timeFormatter.format(created * 1000)}
                </td>
                <td style={{ paddingInline: "1em", textAlign: "center" }}>
                  {timeFormatter.format(updated * 1000)}
                </td>
                <td style={{ paddingInline: "1em", textAlign: "center" }}>
                  {((interval * frames) / 60).toFixed()} m
                </td>
                <td style={{ paddingInline: "1em", textAlign: "center" }}>
                  {getStatusCell()}
                </td>
              </tr>
            );
          },
        )}
      </tbody>
    </table>
  );
};

export default History;
