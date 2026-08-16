.PHONY: build run test migrate clean

build:
	go build -o bin/fmc-node ./cmd/node

run:
	go run ./cmd/node

test:
	go test ./... -v

migrate:
	go run ./cmd/node -migrate-only

clean:
	rm -rf bin/

deps:
	go mod tidy

lint:
	go vet ./...
