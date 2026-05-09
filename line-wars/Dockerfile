# Dockerfile for Render deployment
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy built assets and server
COPY dist ./dist
COPY client/dist ./client/dist

# Expose ports
EXPOSE 10000
EXPOSE 8080

# Set production environment
ENV NODE_ENV=production
ENV PORT=10000
ENV LINE_WARS_PORT=8080

# Start the server
CMD ["node", "dist/index.js"]
