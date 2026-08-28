# Multi-stage Dockerfile for Federated Credit Node

# Stage 1: Build Go binary
FROM golang:1.25-alpine AS go-builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

ARG BUILD_COMMIT=unknown
RUN echo "$BUILD_COMMIT" > /app/BUILD_COMMIT

RUN CGO_ENABLED=0 go build -o /fmc-node ./cmd/node

# Stage 2: Build frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /web

COPY web/package.json web/package-lock.json ./
RUN npm ci --silent

COPY web/ .
RUN npm run build

# Stage 3: Final image
FROM alpine:3.20

RUN apk --no-cache add ca-certificates tzdata docker-cli docker-cli-compose git

WORKDIR /app

COPY --from=go-builder /fmc-node /app/fmc-node
COPY --from=go-builder /app/BUILD_COMMIT /app/BUILD_COMMIT
COPY --from=go-builder /app/internal/db/migrations /app/internal/db/migrations
COPY --from=go-builder /app/config.yaml /app/config.yaml
COPY --from=go-builder /app/config.demo.yaml /app/config.demo.yaml
COPY --from=go-builder /app/firmware /app/firmware
COPY --from=frontend-builder /web/dist /app/web/dist

EXPOSE 8080 8443

CMD ["/app/fmc-node"]
