# /backend/Dockerfile
FROM node:20-slim

# Définition de l'environnement par défaut (sera écrasé par Cloud Run)
ENV NODE_ENV=development
ENV PORT=8080

WORKDIR /app

# On copie d'abord les fichiers de dépendances pour profiter du cache Docker
COPY package*.json ./

# Installation des dépendances (uniquement prod pour réduire la taille de l'image)
RUN npm install --omit=dev

# Copie du reste du code source
COPY . .

# Cloud Run injecte la variable PORT, on s'assure qu'elle est exposée
EXPOSE 8080

# Utilisation du script "start" défini dans ton package.json
CMD ["npm", "run", "dev"]