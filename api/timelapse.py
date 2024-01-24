import asyncio
import logging
import time
from typing import Any, Callable, Dict
import os
import subprocess
from datetime import datetime
import threading
import glob
import uuid
from hashlib import sha256

from apprise import Apprise

CANCELLING_CODE = -2
CANCELLED_CODE = -1

logger = logging.getLogger("rtsp-timelapse")
apprise_instance = Apprise()
timelapses = dict()

for target in (os.getenv("APPRISE_TARGETS") or "").split(","):
    if target.strip():
        apprise_instance.add(target.strip())


class Timelapse:
    def __init__(self, timelapse_id: str, frames: int, interval: float, snapshot_dir: str, output_dir: str, rtsp_url: str, callback: Callable, progress: Callable) -> None:
        self.timelapse_id = timelapse_id
        self.snapshot_dir = snapshot_dir
        self.output_dir = output_dir
        self.rtsp_url = rtsp_url
        self.frames = frames
        self.interval = interval
        self.created = int(time.time())
        self.callback = callback
        self._progress = progress
        self.is_active = False

    def run(self, block=False):
        self.is_active = True

        os.makedirs(self.snapshot_dir, exist_ok=True)
        os.makedirs(self.output_dir, exist_ok=True)

        self._run(remaining=self.frames)
        if block:
            self.wait()

    def _run(self, remaining: int):
        def next_run():
            if not self.is_active:
                logger.info("Timelapse cancelled. Calling progress with the cancellation code...")
                return self.progress(CANCELLED_CODE)
    
            if remaining == 0:
                self.is_active = False
                return self.callback()

            next_remaining = remaining - 1
            self._run(remaining=next_remaining,)
            self._take_snapshot()
            self.progress(next_remaining)

        threading.Timer(self.interval, next_run).start()

    def _take_snapshot(self):
        filename = f"{datetime.now().strftime('%Y%m%d-%H%M%S')}.png"
        full_path = os.path.join(self.snapshot_dir, filename)
        subprocess.run([
            "ffmpeg",
            "-i", self.rtsp_url,
            "-vframes", "1",
            full_path
        ])
        logger.info(f"A frame was saved as: {full_path}")

    def wait(self, retry_interval=5):
        while True:
            if not self.is_active:
                break

            time.sleep(retry_interval)

    def cancel(self):
        # Do not really need to worry about thread-safety in the current implementation.
        self.is_active = False

    def to_dict(self, remaining: int) -> dict:
        return dict(
            timelapse_id=self.timelapse_id,
            rtsp_url_hash=sha256(self.rtsp_url.encode('utf-8')).hexdigest(),
            created=self.created,
            updated=int(time.time()),
            interval=self.interval,
            frames=self.frames,
            remaining=remaining
        )

    def progress(self, remaining: int):
        logger.info(f"Reporting progress with {remaining=} ...")
        dct = self.to_dict(remaining=remaining)
        asyncio.run(self._progress(dct))


def create_video(timelapse_id: str, input_dir: str, output_dir: str):
    """
    :returns: The path of the timelapse video
    """
    filename = f"{timelapse_id}.mp4"
    timelapse_fullpath = os.path.join(output_dir, filename)
    subprocess.run([
        "ffmpeg",
        "-pattern_type",
        "glob",
        "-i", f"{input_dir}/*.png",
        timelapse_fullpath,
    ])

    return timelapse_fullpath


def send_video(timelapse_path: str):
    apprise_instance.notify(
        body=f"A new video is created. {timelapse_path=}",
        attach=[timelapse_path]
    )
    logger.info("Video sent")


def empty_folder(dir: str) -> str:
    files = glob.glob(f'{dir}/*')
    for f in files:
        os.remove(f)


def submit(rtsp_url: str, interval: float, frames: int, progress: Callable[[Dict], None]) -> Dict[str, Any]:
    timelapse_id = str(uuid.uuid4())
    snapshot_dir = os.path.join("/tmp", "snapshots", timelapse_id)
    output_dir = "/data/timelapses"

    def post_process():
        timelapse_path = create_video(
            timelapse_id, snapshot_dir, output_dir)
        send_video(timelapse_path)
        empty_folder(snapshot_dir)

    timelapse = Timelapse(timelapse_id=timelapse_id, snapshot_dir=snapshot_dir,
                          output_dir=output_dir, rtsp_url=rtsp_url, progress=progress,
                          interval=interval, frames=frames, callback=post_process)
    timelapse.run()

    timelapses[timelapse_id] = timelapse

    return timelapse.to_dict(frames)


def cancel(timelapse_id: str) -> None:
    timelapse = timelapses.get(timelapse_id)
    assert timelapse, f"{timelapse_id=} must exist"

    # Note: setting the progress code first to avoid race conditions where the "cancelled" message gets sent out to the clients before "cancelling"
    timelapse.progress(CANCELLING_CODE)
    timelapse.cancel()

