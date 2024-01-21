import asyncio
import json
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

logger = logging.getLogger("rtsp-timelapse")
apprise_instance = Apprise()

with open("/app/config.json") as fp:
    for service in json.load(fp).get("notifications", []):
        apprise_instance.add(service)


class Timelapse:
    def __init__(self, snapshot_dir: str, output_dir: str, rtsp_url: str) -> None:
        self.snapshot_dir = snapshot_dir
        self.output_dir = output_dir
        self.rtsp_url = rtsp_url
        self.is_active = False

    def run(self, interval: float, frames: int, callback: Callable = None, progress: Callable[[int], None] = None, block=False):
        self.is_active = True

        os.makedirs(self.snapshot_dir, exist_ok=True)
        os.makedirs(self.output_dir, exist_ok=True)

        self._run(end_callback=callback, interval=interval,
                  remaining=frames, progress=progress)
        if block:
            self.wait()

    def _run(self, interval: float, remaining: int, end_callback: Callable = None, progress: Callable[[int], None] = None):
        if remaining == 0:
            self.is_active = False
            if end_callback:
                end_callback()
            return

        def next_run():
            if progress:
                logger.info("progress function exists; calling...")
                progress(remaining - 1)
            self._run(interval=interval, remaining=remaining -
                      1, end_callback=end_callback, progress=progress)
            self._take_snapshot()

        threading.Timer(interval, next_run).start()

    def _take_snapshot(self):
        filename = f"{datetime.now().strftime('%Y%m%d-%H%M%S')}.png"
        subprocess.run([
            "ffmpeg",
            "-i", self.rtsp_url,
            "-vframes", "1",
            os.path.join(self.snapshot_dir, filename)
        ])
        logger.info(f"A frame was saved as: {filename}")

    def wait(self, interval=5):
        while True:
            if not self.is_active:
                break

            time.sleep(interval)


def create_timelapse(timelapse_id: str, input_dir: str, output_dir: str):
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
        timelapse_path = create_timelapse(
            timelapse_id, snapshot_dir, output_dir)
        send_video(timelapse_path)
        empty_folder(snapshot_dir)

    timelapse = dict(
        timelapse_id=timelapse_id,
        rtsp_url_hash=sha256(rtsp_url.encode('utf-8')).hexdigest(),
        created=int(time.time()),
        updated=int(time.time()),
        interval=interval,
        frames=frames,
        remaining=frames
    )

    def _progress(remaining: int):
        logger.info("entering inner progress function")
        timelapse.update(dict(remaining=remaining, updated=int(time.time())))
        asyncio.run(progress(timelapse))

    Timelapse(snapshot_dir=snapshot_dir, output_dir=output_dir, rtsp_url=rtsp_url) \
        .run(interval=interval, frames=frames, callback=post_process, progress=_progress)

    return timelapse
