FROM node:26.12-alpine AS kiosk
WORKDIR /kiosk
COPY kiosk/package.json kiosk/package-lock.json ./
RUN npm ci
COPY kiosk ./
RUN npm run build

FROM node:26.12-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm install --no-save --ignore-scripts tsx@4.23.15
COPY tsconfig.json ./
COPY src ./src
COPY data ./data
COPY --from=kiosk /kiosk/out ./kiosk/out
ENV NODE_ENV=production
CMD ["npx", "tsx", "src/main.ts"]
