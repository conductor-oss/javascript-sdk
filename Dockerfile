FROM node:18-alpine AS build
WORKDIR /package
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM build AS harness-build
RUN npx tsup harness/main.ts \
      --outDir /app \
      --format cjs \
      --target node18 \
      --no-splitting

FROM node:18-alpine AS harness-deps
WORKDIR /package
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:18-alpine AS harness
RUN adduser -D -u 65532 nonroot
USER nonroot
WORKDIR /app
COPY --from=harness-deps /package/node_modules /app/node_modules
COPY --from=harness-deps /package/package.json /app/package.json
COPY --from=harness-build /app/main.js /app/main.js
ENTRYPOINT ["node", "main.js"]
