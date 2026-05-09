# Dockerfile for Render deployment
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy server-only package file
COPY package-server.json ./package.json

# Install ALL dependencies (including devDependencies for esbuild)
RUN npm install

# Copy source files
COPY server/_core ./server/_core
COPY server/line-wars ./server/line-wars

# Bundle with esbuild into a single ESM file
RUN npx esbuild server/line-wars/start-server.ts \
    --platform=node \
    --packages=external \
    --bundle \
    --format=esm \
    --outfile=dist/start-server.js

# Prune dev dependencies after build
RUN npm prune --production

# Expose Render's default port
EXPOSE 10000

# Set production environment
ENV NODE_ENV=production
ENV PORT=10000

# Start server
CMD ["node", "dist/start-server.js"]
