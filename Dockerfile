# syntax=docker/dockerfile:1
FROM node:19-alpine AS builder

WORKDIR /build
COPY app/ .
WORKDIR /build/frontend
RUN npm install
RUN npm run build

FROM python:3.11
WORKDIR /code
COPY --from=builder /build/backend .
RUN pip install --no-cache-dir --upgrade -r requirements.txt
EXPOSE 8000

CMD ["python","-m","gunicorn","main:app"]