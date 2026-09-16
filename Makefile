.PHONY: dev backend frontend

# Runs both; Ctrl-C stops both.
dev:
	@trap 'kill 0' INT TERM; \
	$(MAKE) backend & \
	$(MAKE) frontend & \
	wait

backend:
	cd backend && uv run python manage.py runserver

frontend:
	cd frontend && pnpm dev
