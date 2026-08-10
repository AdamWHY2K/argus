.PHONY: install build dev dev-web run deploy restart logs status

PNPM := pnpm

install:
	$(PNPM) install

build:
	$(PNPM) --filter @argus/web build

## Backend with reload, expects `make dev-web` alongside for the UI.
dev:
	$(PNPM) --filter @argus/server dev

dev-web:
	$(PNPM) --filter @argus/web dev

## Run the built app exactly as the service does.
run: build
	$(PNPM) --filter @argus/server start

## Install/refresh the systemd user unit and restart with the current build.
deploy: install build
	install -Dm644 deploy/argus.service $(HOME)/.config/systemd/user/argus.service
	systemctl --user daemon-reload
	systemctl --user enable --now argus.service
	systemctl --user restart argus.service
	@sleep 2 && $(MAKE) --no-print-directory status

restart:
	systemctl --user restart argus.service

status:
	@systemctl --user --no-pager --lines=0 status argus.service || true
	@curl -fsS localhost:8797/api/stats && echo

logs:
	journalctl --user -u argus.service -f -n 50
