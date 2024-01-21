FROM python:3.12-slim

RUN apt-get -y update
RUN apt-get -y upgrade
RUN apt-get install -y ffmpeg

WORKDIR /app

COPY requirements.txt ./requirements.txt
RUN pip install -r requirements.txt
