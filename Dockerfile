# ---- build frontend ----
FROM node:22-alpine AS client
WORKDIR /client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ---- runtime ----
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
# OCR for the Portfólió screenshot import (Hungarian + English)
RUN apk add --no-cache tesseract-ocr tesseract-ocr-data-hun tesseract-ocr-data-eng
COPY server/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server/src ./src
COPY --from=client /client/dist ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://localhost:3000/api/health || exit 1
CMD ["node", "src/index.js"]
