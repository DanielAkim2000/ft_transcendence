# ─────────────────────────────────────────────────────────────────────────────
# ft_transcendence : commandes du projet. `make` (ou `make help`) liste tout.
# ─────────────────────────────────────────────────────────────────────────────

# Production (images compilées) et développement (hot reload).
COMPOSE_PROD := docker compose -f docker-compose.yml
COMPOSE_DEV  := docker compose -f docker-compose.dev.yml

# Environnement ciblé par les commandes génériques (logs, ps, shell, db-*...).
# Dev par défaut ; `make logs ENV=prod` pour la production.
ENV ?= dev
ifeq ($(ENV),prod)
COMPOSE := $(COMPOSE_PROD)
else
COMPOSE := $(COMPOSE_DEV)
endif

# Service visé par logs / shell / restart (`make logs S=frontend`).
S ?= backend

.DEFAULT_GOAL := help

# ─── Aide ────────────────────────────────────────────────────────────────────
.PHONY: help
help: ## Affiche cette aide
	@echo "Usage : make <cible> [ENV=dev|prod] [S=service]"
	@echo ""
	@awk 'BEGIN {FS = ":.*##"} \
		/^# ─── / {gsub(/^# ─── | ─+$$/, ""); printf "\n\033[1m%s\033[0m\n", $$0} \
		/^[a-zA-Z0-9_-]+:.*##/ {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo ""

# ─── Installation ────────────────────────────────────────────────────────────
.PHONY: setup
setup: ## Crée .env et les secrets Docker à partir des exemples
	@./scripts/setup-docker.sh

.PHONY: check-env
check-env:
	@test -f .env && test -f secrets/postgres_password || { \
		echo "Il manque .env ou les secrets : lance d'abord 'make setup'."; exit 1; }

# ─── Lancement ───────────────────────────────────────────────────────────────
.PHONY: all dev prod up down stop restart
all: prod ## Alias de prod

dev: check-env ## Lance l'environnement de développement (hot reload), au premier plan
	@$(COMPOSE_PROD) down --remove-orphans >/dev/null 2>&1 || true
	$(COMPOSE_DEV) up --build

prod: check-env ## Lance l'environnement de production (images compilées), au premier plan
	@$(COMPOSE_DEV) down --remove-orphans >/dev/null 2>&1 || true
	$(COMPOSE_PROD) up --build

up: check-env ## Lance l'environnement ENV en arrière-plan
	$(COMPOSE) up --build -d
	@$(COMPOSE) ps

down: ## Arrête et supprime les conteneurs de ENV (les données sont conservées)
	$(COMPOSE) down

stop: ## Arrête tout, dev et prod
	-$(COMPOSE_DEV) down
	-$(COMPOSE_PROD) down

restart: ## Redémarre le service S (ex. make restart S=frontend)
	$(COMPOSE) restart $(S)

# ─── Observation ─────────────────────────────────────────────────────────────
.PHONY: ps logs shell
ps: ## État des conteneurs de ENV
	$(COMPOSE) ps

logs: ## Suit les logs du service S (S=all pour tous)
ifeq ($(S),all)
	$(COMPOSE) logs -f --tail=100
else
	$(COMPOSE) logs -f --tail=100 $(S)
endif

shell: ## Ouvre un shell dans le service S
	$(COMPOSE) exec $(S) sh

# ─── Base de données ─────────────────────────────────────────────────────────
.PHONY: migrate seed db-backup db-backups db-restore db-shell
migrate: ## Applique les migrations Prisma (backend démarré)
	$(COMPOSE) exec backend pnpm exec prisma migrate deploy

seed: ## Remplit la base avec les données de démo
	$(COMPOSE) exec backend pnpm run prisma:seed

db-backup: ## Crée une sauvegarde de la base maintenant
	$(COMPOSE) exec backup /db-backup.sh once

db-backups: ## Liste les sauvegardes disponibles
	$(COMPOSE) exec backup /db-backup.sh list

db-restore: ## Restaure la sauvegarde la plus récente (F=fichier pour une précise)
	COMPOSE_FILE=$(if $(filter prod,$(ENV)),docker-compose.yml,docker-compose.dev.yml) ./scripts/db-restore.sh $(F)

db-shell: ## Ouvre psql sur la base
	$(COMPOSE) exec db sh -c 'psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"'

# ─── Qualité du code ─────────────────────────────────────────────────────────
.PHONY: lint typecheck test check
lint: ## Lint du frontend et du backend
	cd frontend && pnpm run lint
	cd backend && pnpm exec eslint "{src,apps,libs,test}/**/*.ts"

typecheck: ## Vérifie les types du frontend et du backend
	cd frontend && pnpm exec tsc --noEmit -p tsconfig.app.json
	cd backend && pnpm exec tsc --noEmit --incremental false -p .

test: ## Tests unitaires du backend
	cd backend && pnpm test

check: typecheck lint test ## Tout vérifier avant un commit

# ─── Nettoyage ───────────────────────────────────────────────────────────────
.PHONY: clean fclean re
clean: stop ## Arrête tout et supprime les images du projet (volumes conservés)
	-$(COMPOSE_DEV) down --rmi local --remove-orphans
	-$(COMPOSE_PROD) down --rmi local --remove-orphans

fclean: ## Supprime aussi les volumes : BASE DE DONNÉES ET SAUVEGARDES PERDUES (confirmation)
	@printf "Supprimer conteneurs, images ET volumes (base de données incluse) ? [y/N] "; \
	read answer; [ "$$answer" = "y" ] || { echo "Annulé."; exit 1; }
	-$(COMPOSE_DEV) down -v --rmi local --remove-orphans
	-$(COMPOSE_PROD) down -v --rmi local --remove-orphans

re: stop dev ## Arrête tout puis relance le développement
