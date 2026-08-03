FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY src ./src
COPY openapi.yaml ./openapi.yaml
USER node
EXPOSE 8080
CMD ["node", "src/server.js"]
