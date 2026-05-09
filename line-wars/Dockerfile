# Dockerfile for Render deployment
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy server-only package file
COPY package-server.json ./package.json

# Install dependencies
RUN npm install --production

# Copy source files (not built)
COPY server/_core ./server/_core
COPY server/line-wars ./server/line-wars

# Install TypeScript globally and build
RUN npm install -g typescript
RUN npx tsc server/_core/index.ts --outDir dist --target es2020 --module commonjs

# Expose ports
EXPOSE 10000
EXPOSE 8080

# Set production environment
ENV NODE_ENV=production
ENV PORT=10000
ENV LINE_WARS_PORT=8080

# Start server
CMD ["node", "dist/_core/index.js"]
