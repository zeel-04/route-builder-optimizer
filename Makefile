.PHONY: dev backend frontend backend-test

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

# Backend for UI testing on :8100 — password login, and the pytest database
# instead of the real one, so test tenants and customers never touch production.
backend-test:
	cd backend && DB_NAME=test_$$(grep '^DB_NAME=' .env | cut -d= -f2) SSO_ENABLED=false \
		uv run python manage.py runserver 8100
