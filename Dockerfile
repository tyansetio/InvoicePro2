# Stage 1: Build
FROM node:20-alpine AS build

WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build the application
# Frontend goes to dist/public, Backend goes to dist/index.js
RUN npm run build

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm install --omit=dev

# Copy built assets from build stage
COPY --from=build /app/dist ./dist

# Copy drizzle config and schema for migrations
COPY drizzle.config.ts ./
COPY shared ./shared
COPY migrations ./migrations

# Copy entrypoint script and fix Windows line endings
COPY docker-entrypoint.sh ./
RUN sed -i 's/\r$//' docker-entrypoint.sh && chmod +x docker-entrypoint.sh

# Expose the application port
EXPOSE 5000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=5000

# Start the application using the entrypoint script
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
