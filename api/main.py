# built-in modules
import asyncio
import json
import logging
from typing import Any, Dict, List

# external deps
from fastapi import FastAPI, WebSocket
from starlette.responses import JSONResponse
from starlette.websockets import WebSocketDisconnect
from pydantic import BaseModel
from commmons import init_logger_with_handlers

# internal deps
import timelapse

logger = init_logger_with_handlers("rtsp-timelapse", logging.INFO,
                                   "/var/log/rtsp-timelapse.log")

fastapi_app = FastAPI()
sockets = []


class TimelapsesResponse(BaseModel):
    timelapses: List[Dict[Any, Any]]


@fastapi_app.exception_handler(AssertionError)
def unicorn_exception_handler(_, e: AssertionError):
    return JSONResponse(
        status_code=400,
        content=dict(message=str(e))
    )


@fastapi_app.exception_handler(NotImplementedError)
def unicorn_exception_handler(*args, **kwargs):
    return JSONResponse(
        status_code=500,
        content=dict(message="Not implemented")
    )


@fastapi_app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    try:
        await websocket.accept()
        logger.info("Socket open")
        sockets.append(websocket)
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        sockets.remove(websocket)
        logger.info("Socket closed")


def broadcast(timelapse: dict):
    async def _broadcast():
        for socket in sockets:
            logger.info(f"Broadcasting to: {socket.client.host=}")
            await socket.send_text(json.dumps(timelapse))

    asyncio.run(_broadcast())


@fastapi_app.post("/timelapses")
def create_timelapse(payload: Dict[Any, Any]):
    return dict(timelapse=timelapse.submit(
        payload.get("url"),
        payload.get("interval"),
        payload.get("frames"),
        broadcast=broadcast
    ))


@fastapi_app.delete("/timelapses/{timelapse_id}")
def delete_timelapse(timelapse_id: str):
    timelapse.cancel(timelapse_id)
    return dict(result="success")
