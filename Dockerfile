# Build stage
FROM node:24-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Production stage
FROM node:24-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy built JavaScript files from builder
COPY --from=builder /app/dist ./dist

# Copy views to dist/views (app expects views at __dirname/views which is dist/views)
COPY --from=builder /app/src/views ./dist/views

# Copy public assets to root (app expects public at __dirname/../public which is /app/public)
COPY --from=builder /app/public ./public

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
