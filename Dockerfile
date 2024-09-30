# syntax=docker/dockerfile:1

FROM node:20-alpine AS builder

ENV GENERATE_SOURCEMAP=false
ENV NODE_OPTIONS=--max_old_space_size=4096
WORKDIR /build
COPY app/ .
WORKDIR /build/frontend
RUN npm install
RUN npm run build

FROM python:3.12
WORKDIR /code
COPY --from=builder /build/backend .

ARG fromconfig="./config/default.json"
COPY $fromconfig /code/config.json
COPY "./config/base.json"  /code/base.json

RUN pip install --no-cache-dir --upgrade -r requirements.txt

EXPOSE 8000
CMD ["gunicorn","app:backend"]