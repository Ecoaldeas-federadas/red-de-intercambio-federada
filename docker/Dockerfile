# Multi-stage Dockerfile for Federated Credit Node

# Stage 1: Build Go binary
FROM golang:1.23-alpine AS go-builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 go build -o /fmc-node ./cmd/node

# Stage 2: Final image
FROM alpine:3.20

RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app

COPY --from=go-builder /fmc-node /app/fmc-node
COPY --from=go-builder /app/internal/db/migrations /app/internal/db/migrations
COPY --from=go-builder /app/config.yaml /app/config.yaml

EXPOSE 8080 8443

CMD ["/app/fmc-node"]
