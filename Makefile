.PHONY: install dev build typecheck go-build run clean

install:
	npm install

dev:
	npm run dev

build:
	npm run build

typecheck:
	npm run typecheck

go-build:
	go build -o bin/web ./cmd/web

run: build go-build
	DIST_DIR=./dist ./bin/web

clean:
	rm -rf dist node_modules bin
