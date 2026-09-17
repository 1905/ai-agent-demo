PORT ?= 5180

.PHONY: dev build test

dev: node_modules/.package-lock.json
	npm run dev -- --port $(PORT) --strictPort

build: node_modules/.package-lock.json
	npm run build

test: node_modules/.package-lock.json
	npm test

node_modules/.package-lock.json: package.json package-lock.json
	npm ci
