# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS web-build
WORKDIR /src
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

FROM golang:1.25-alpine AS go-build
WORKDIR /src
COPY go.mod go.sum* ./
RUN go mod download
COPY cmd ./cmd
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/web ./cmd/web

FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
COPY --from=go-build /out/web /app/web
COPY --from=web-build /src/dist /app/dist
ENV DIST_DIR=/app/dist
ENV ADDR=:8081
USER nonroot:nonroot
EXPOSE 8081
ENTRYPOINT ["/app/web"]
