FRONTEND_DIR = ./web
BACKEND_DIR = .

.PHONY: all build-frontend start-backend check-backend check-frontend-fast check-frontend check-all

all: build-frontend start-backend

build-frontend:
	@echo "Building frontend..."
	@cd $(FRONTEND_DIR) && bun install && DISABLE_ESLINT_PLUGIN='true' VITE_REACT_APP_VERSION=$(cat VERSION) bun run build

start-backend:
	@echo "Starting backend dev server..."
	@cd $(BACKEND_DIR) && go run main.go &

check-backend:
	@echo "Checking backend gofmt..."
	@unformatted="$$(find $(BACKEND_DIR) -name '*.go' -not -path './web/*' -not -path './.git/*' -not -path './.gocache/*' -not -path './.gomodcache/*' -print | xargs gofmt -l)"; \
	if [ -n "$$unformatted" ]; then \
		echo "$$unformatted"; \
		echo "gofmt check failed: run gofmt on the files above"; \
		exit 1; \
	fi
	@echo "Running go vet..."
	@cd $(BACKEND_DIR) && go vet ./...
	@echo "Running golangci-lint..."
	@cd $(BACKEND_DIR) && golangci-lint run --timeout=5m
	@echo "Running go tests..."
	@cd $(BACKEND_DIR) && go test ./... -count=1
	@echo "Building backend..."
	@cd $(BACKEND_DIR) && go build ./...

check-frontend-fast:
	@echo "Installing frontend dependencies..."
	@cd $(FRONTEND_DIR) && bun install --frozen-lockfile
	@echo "Checking frontend formatting..."
	@cd $(FRONTEND_DIR) && bun run lint
	@echo "Running frontend eslint..."
	@cd $(FRONTEND_DIR) && bun run eslint
	@echo "Checking frontend i18n..."
	@cd $(FRONTEND_DIR) && bun run i18n:lint
	@echo "Running frontend tests..."
	@cd $(FRONTEND_DIR) && bun run test

check-frontend: check-frontend-fast
	@echo "Building frontend..."
	@cd $(FRONTEND_DIR) && DISABLE_ESLINT_PLUGIN='true' VITE_REACT_APP_VERSION=$$(cat ../VERSION) bun run build

check-all: check-frontend check-backend
